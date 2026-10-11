import "server-only";

// Серверный контекст CRM: кто, какое рабочее пространство (риэлтор / компания застройщика), доступ (пробный период
// 6 мес → ограниченный режим без оплаты), ключ данных ws (конвертное шифрование, см. crypto.ts), наборы по умолчанию.
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { decField, encField, newWrappedKey, normalizeContact, unwrapKey, valueHash } from "./crypto";
import { DEFAULT_SOURCES, DEFAULT_STAGES, type Branch, type CrmAccess, type CrmMember, type MemberRole, type Ws, type WsKind } from "./types";

export const TRIAL_MONTHS = 6;

export type Ctx = { sb: SupabaseClient; me: CurrentUser; ws: Ws; dek: Buffer; access: CrmAccess; trialUntil: string | null; paidTo: string | null; isAdmin: boolean; role: MemberRole; branchId: string | null };

const dekCache = new Map<string, Buffer>();

export async function crmCtx(): Promise<Ctx> {
  const me = await getCurrentUser();
  if (!me) throw new Error("no-session");
  const sb = await createClient();
  const ws = await wsOf(sb, me);
  const { access, trialUntil, paidTo } = await accessOf(sb, ws);
  const dek = await dekOf(sb, ws, me.id);
  // роль в пространстве (0017): одиночка — владелец; агентство/компания — первый открывший становится владельцем, остальные агенты
  const { role, branchId } = await roleOf(sb, ws, me.id);
  const isAdmin = role === "owner";
  return { sb, me, ws, dek, access, trialUntil, paidTo, isAdmin, role, branchId };
}

async function roleOf(sb: SupabaseClient, ws: Ws, meId: string): Promise<{ role: MemberRole; branchId: string | null }> {
  if (ws.kind === "realtor") return { role: "owner", branchId: null };
  const { data: r } = await sb.rpc("crm_claim_member", { kind: ws.kind, ws: ws.id });
  const { data: m } = await sb.from("crm_members").select("role, branch_id").eq("ws_kind", ws.kind).eq("ws_id", ws.id).eq("profile_id", meId).maybeSingle();
  const role = ((m?.role as MemberRole) ?? (r as MemberRole) ?? "agent");
  return { role, branchId: (m?.branch_id as string | null) ?? null };
}

/** Рабочее пространство: застройщик → его компания (profiles.developer_id или первое членство); риэлтор в агентстве →
 *  агентство (0017, одна CRM на всех сотрудников); иначе — сам пользователь. */
async function wsOf(sb: SupabaseClient, me: CurrentUser): Promise<Ws> {
  if (me.role === "developer") {
    if (me.developerId) return { kind: "developer", id: me.developerId };
    const { data } = await sb.from("developer_members").select("developer_id").eq("profile_id", me.id).limit(1).maybeSingle();
    if (data?.developer_id) return { kind: "developer", id: data.developer_id as string };
    throw new Error("no-company");
  }
  const { data: p } = await sb.from("profiles").select("agency_id").eq("id", me.id).maybeSingle();
  if (p?.agency_id) return { kind: "agency", id: p.agency_id as string };
  return { kind: "realtor", id: me.id };
}

/** Пробный период стартует при первом открытии CRM; после него без оплаты — только чтение. */
async function accessOf(sb: SupabaseClient, ws: Ws): Promise<{ access: CrmAccess; trialUntil: string | null; paidTo: string | null }> {
  const table = ws.kind === "realtor" ? "profiles" : ws.kind === "agency" ? "agencies" : "developers";
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

/** Участники ws (для выбора ответственного): одиночка — он сам; агентство — активные риэлторы агентства; застройщик — команда
 *  компании. Роль и филиал — из crm_members (0017; нет записи → agent без филиала). */
export async function membersOf(sb: SupabaseClient, ws: Ws, me: CurrentUser): Promise<CrmMember[]> {
  const map = new Map<string, CrmMember>();
  const put = (id: string, name: string, color: string) => map.set(id, { id, name: name || "—", color: color || "#4d7cfe", role: "agent", branchId: null });
  if (ws.kind === "realtor") put(me.id, me.name || me.email, "#4d7cfe");
  else if (ws.kind === "agency") {
    const { data } = await sb.from("profiles").select("id, name, color").eq("agency_id", ws.id).eq("status", "active").order("name");
    (data ?? []).forEach((p) => put(p.id as string, p.name as string, p.color as string));
  } else {
    const [{ data: a }, { data: b }] = await Promise.all([
      sb.from("profiles").select("id, name, color").eq("developer_id", ws.id).eq("status", "active"),
      sb.from("developer_members").select("profiles(id, name, color, status, platform_staff)").eq("developer_id", ws.id),
    ]);
    (a ?? []).forEach((p) => put(p.id as string, p.name as string, p.color as string));
    (b ?? []).forEach((r) => {
      const p = (Array.isArray(r.profiles) ? r.profiles[0] : r.profiles) as { id: string; name: string; color: string; status: string; platform_staff: boolean } | null;
      if (p && p.status === "active" && !p.platform_staff) put(p.id, p.name, p.color);
    });
  }
  if (!map.has(me.id)) put(me.id, me.name || me.email, "#4d7cfe");
  if (ws.kind !== "realtor") {
    const { data: ms } = await sb.from("crm_members").select("profile_id, role, branch_id").eq("ws_kind", ws.kind).eq("ws_id", ws.id);
    (ms ?? []).forEach((m) => { const x = map.get(m.profile_id as string); if (x) { x.role = m.role as MemberRole; x.branchId = (m.branch_id as string | null) ?? null; } });
  } else { const x = map.get(me.id); if (x) x.role = "owner"; }
  return [...map.values()];
}

/** Филиалы пространства (0017). */
export async function branchesOf(sb: SupabaseClient, ws: Ws): Promise<Branch[]> {
  if (ws.kind === "realtor") return [];
  const { data } = await sb.from("crm_branches").select("id, name, city, head_id, sort").eq("ws_kind", ws.kind).eq("ws_id", ws.id).order("sort").order("name");
  return (data ?? []).map((b) => ({ id: b.id as string, name: b.name as string, city: (b.city as string | null) ?? null, headId: (b.head_id as string | null) ?? null, sort: (b.sort as number) ?? 0 }));
}

/** Справочник причин отказа пространства (crm_settings.lost_reasons). */
export async function lostReasonsOf(sb: SupabaseClient, ws: Ws): Promise<string[]> {
  const { data } = await sb.from("crm_settings").select("lost_reasons").eq("ws_kind", ws.kind).eq("ws_id", ws.id).maybeSingle();
  const v = data?.lost_reasons; return Array.isArray(v) ? (v as string[]) : [];
}

// ---------- шифрование полей (AAD = таблица.поле:id) ----------
export const enc = (c: Ctx, table: string, field: string, id: string, v: string) => (v ? encField(c.dek, v, `${table}.${field}:${id}`) : null);
export const dec = (c: Ctx, table: string, field: string, id: string | number, v: string | null | undefined) => decField(c.dek, v, `${table}.${field}:${id}`);
export const hashOf = (c: Ctx, kind: string, raw: string) => valueHash(c.ws.kind, c.ws.id, kind === "whatsapp" ? "phone" : kind, normalizeContact(kind, raw));

export function assertWrite(c: Ctx) {
  if (c.access !== "full") throw new Error("readonly");
}
