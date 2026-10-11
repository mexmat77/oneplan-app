import "server-only";

// Серверный контекст CRM: кто, какое рабочее пространство (риэлтор / компания застройщика), доступ (пробный период
// 6 мес → ограниченный режим без оплаты), ключ данных ws (конвертное шифрование, см. crypto.ts), наборы по умолчанию.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { decField, encField, newWrappedKey, normalizeContact, unwrapKey, valueHash } from "./crypto";
import { DEFAULT_SOURCES, DEFAULT_STAGES, type CrmAccess, type CrmMember, type Ws, type WsKind } from "./types";

export const TRIAL_MONTHS = 6;

export type Ctx = { sb: SupabaseClient; me: CurrentUser; ws: Ws; dek: Buffer; access: CrmAccess; trialUntil: string | null; paidTo: string | null; isAdmin: boolean };

const dekCache = new Map<string, Buffer>();

export async function crmCtx(): Promise<Ctx> {
  const me = await getCurrentUser();
  if (!me) throw new Error("no-session");
  const sb = await createClient();
  const ws = await wsOf(sb, me);
  const { access, trialUntil, paidTo } = await accessOf(sb, ws);
  const dek = await dekOf(sb, ws, me.id);
  const isAdmin = ws.kind === "realtor" || me.devRole === "admin" || me.role === "admin";
  return { sb, me, ws, dek, access, trialUntil, paidTo, isAdmin };
}

/** Рабочее пространство: застройщик → его компания (profiles.developer_id или первое членство), иначе — сам пользователь. */
async function wsOf(sb: SupabaseClient, me: CurrentUser): Promise<Ws> {
  if (me.role === "developer") {
    if (me.developerId) return { kind: "developer", id: me.developerId };
    const { data } = await sb.from("developer_members").select("developer_id").eq("profile_id", me.id).limit(1).maybeSingle();
    if (data?.developer_id) return { kind: "developer", id: data.developer_id as string };
    throw new Error("no-company");
  }
  return { kind: "realtor", id: me.id };
}

/** Пробный период стартует при первом открытии CRM; после него без оплаты — только чтение. */
async function accessOf(sb: SupabaseClient, ws: Ws): Promise<{ access: CrmAccess; trialUntil: string | null; paidTo: string | null }> {
  const table = ws.kind === "realtor" ? "profiles" : "developers";
  const { data } = await sb.from(table).select("crm_started_at, crm_paid_to").eq("id", ws.id).maybeSingle();
  let started = data?.crm_started_at as string | null;
  if (!started) {
    started = new Date().toISOString();
    await sb.from(table).update({ crm_started_at: started }).eq("id", ws.id);
  }
  const until = new Date(started); until.setMonth(until.getMonth() + TRIAL_MONTHS);
  const paidTo = (data?.crm_paid_to as string | null) ?? null;
  const now = Date.now();
  const full = now < until.getTime() || (!!paidTo && new Date(paidTo).getTime() + 86400000 > now);
  return { access: full ? "full" : "readonly", trialUntil: until.toISOString(), paidTo };
}

/** Ключ данных ws: из crm_keys (кэш в памяти процесса); при первом обращении создаётся и пишется в журнал. */
async function dekOf(sb: SupabaseClient, ws: Ws, actor: string): Promise<Buffer> {
  const k = `${ws.kind}:${ws.id}`;
  const cached = dekCache.get(k);
  if (cached) return cached;
  const { data } = await sb.from("crm_keys").select("wrapped_key").eq("ws_kind", ws.kind).eq("ws_id", ws.id).maybeSingle();
  let wrapped = data?.wrapped_key as string | undefined;
  if (!wrapped) {
    const nk = newWrappedKey(ws.kind, ws.id);
    const { error } = await sb.from("crm_keys").insert({ ws_kind: ws.kind, ws_id: ws.id, wrapped_key: nk.wrapped, key_ver: nk.keyVer });
    if (error) { // гонка: ключ уже создал коллега
      const again = await sb.from("crm_keys").select("wrapped_key").eq("ws_kind", ws.kind).eq("ws_id", ws.id).maybeSingle();
      wrapped = again.data?.wrapped_key as string | undefined;
      if (!wrapped) throw new Error(error.message);
    } else {
      wrapped = nk.wrapped;
      await audit(sb, ws, actor, "key_created", null, {});
      await ensureDefaults(sb, ws);
    }
  }
  const dek = unwrapKey(wrapped, ws.kind, ws.id);
  dekCache.set(k, dek);
  return dek;
}

/** Этапы и источники по умолчанию при первом использовании ws. */
export async function ensureDefaults(sb: SupabaseClient, ws: Ws) {
  const { count } = await sb.from("crm_stages").select("id", { count: "exact", head: true }).eq("ws_kind", ws.kind).eq("ws_id", ws.id);
  if (!count) {
    await sb.from("crm_stages").insert(DEFAULT_STAGES[ws.kind as WsKind].map((s, i) => ({ ws_kind: ws.kind, ws_id: ws.id, key: s.key, kind: s.kind, color: s.color, sort: i, name: {} })));
  }
  const { count: sn } = await sb.from("crm_sources").select("id", { count: "exact", head: true }).eq("ws_kind", ws.kind).eq("ws_id", ws.id);
  if (!sn) {
    await sb.from("crm_sources").insert(DEFAULT_SOURCES.map((s, i) => ({ ws_kind: ws.kind, ws_id: ws.id, name: s.key, kind: s.kind, sort: i })));
  }
}

export async function audit(sb: SupabaseClient, ws: Ws, actor: string, action: string, targetId: string | null, meta: Record<string, unknown>) {
  await sb.from("crm_audit").insert({ ws_kind: ws.kind, ws_id: ws.id, actor_id: actor, action, target_id: targetId, meta });
}

/** Участники ws (для выбора ответственного): у риэлтора — он сам, у застройщика — команда компании. */
export async function membersOf(sb: SupabaseClient, ws: Ws, me: CurrentUser): Promise<CrmMember[]> {
  if (ws.kind === "realtor") return [{ id: me.id, name: me.name || me.email, color: "#4d7cfe" }];
  const [{ data: a }, { data: b }] = await Promise.all([
    sb.from("profiles").select("id, name, color").eq("developer_id", ws.id).eq("status", "active"),
    sb.from("developer_members").select("profiles(id, name, color, status, platform_staff)").eq("developer_id", ws.id),
  ]);
  const map = new Map<string, CrmMember>();
  (a ?? []).forEach((p) => map.set(p.id as string, { id: p.id as string, name: (p.name as string) || "—", color: (p.color as string) || "#4d7cfe" }));
  (b ?? []).forEach((r) => {
    const p = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as { id: string; name: string; color: string; status: string; platform_staff: boolean } | null;
    if (p && p.status === "active" && !p.platform_staff) map.set(p.id, { id: p.id, name: p.name || "—", color: p.color || "#4d7cfe" });
  });
  if (!map.has(me.id)) map.set(me.id, { id: me.id, name: me.name || me.email, color: "#4d7cfe" });
  return [...map.values()];
}

// ---------- шифрование полей (AAD = таблица.поле:id) ----------
export const enc = (c: Ctx, table: string, field: string, id: string, v: string) => (v ? encField(c.dek, v, `${table}.${field}:${id}`) : null);
export const dec = (c: Ctx, table: string, field: string, id: string | number, v: string | null | undefined) => decField(c.dek, v, `${table}.${field}:${id}`);
export const hashOf = (c: Ctx, kind: string, raw: string) => valueHash(c.ws.kind, c.ws.id, kind === "whatsapp" ? "phone" : kind, normalizeContact(kind, raw));

export function assertWrite(c: Ctx) {
  if (c.access !== "full") throw new Error("readonly");
}
