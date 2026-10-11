import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { encField, normalizeContact, tokenHash, unwrapKey, valueHash } from "@/lib/crm/crypto";
import { notify } from "@/lib/notify";
import { DEFAULT_SOURCES } from "@/lib/crm/types";

// Входящие заявки с внешних сайтов/телефонии в CRM (11.10.2026):
//   POST /api/crm/inbound  Authorization: Bearer <токен источника>  JSON {name, phone?, email?, message?, lang?}
// Токен выдаётся в настройках CRM на источник типа «сайт» (хранится только его хэш). По телефону/e-mail ищем дубль
// (HMAC-хэш, сам номер в базе не хранится открытым): есть — заявка привязывается к существующему клиенту с пометкой
// «дубль», нет — создаётся новый клиент. Сырая заявка хранится зашифрованной. Без сессии → сервисный клиент.
export const runtime = "nodejs";

type Body = { name?: string; phone?: string; email?: string; message?: string; lang?: string };
const bad = (status: number, error: string) => NextResponse.json({ ok: false, error }, { status });

export async function POST(req: Request) {
  const auth = req.headers.get("authorization") ?? "";
  const token = auth.replace(/^Bearer\s+/i, "").trim();
  if (!token.startsWith("ops_")) return bad(401, "token");
  let body: Body;
  try { body = (await req.json()) as Body; } catch { return bad(400, "json"); }
  const name = (body.name ?? "").toString().trim().slice(0, 200);
  const phone = (body.phone ?? "").toString().trim().slice(0, 40);
  const email = (body.email ?? "").toString().trim().slice(0, 120);
  const message = (body.message ?? "").toString().trim().slice(0, 4000);
  if (!name && !phone && !email) return bad(400, "empty");

  const sb = createAdminClient();
  const { data: src } = await sb.from("crm_sources").select("id, ws_kind, ws_id, active").eq("token_hash", tokenHash(token)).maybeSingle();
  if (!src || !src.active) return bad(401, "token");
  const ws = { kind: src.ws_kind as string, id: src.ws_id as string };
  const { data: k } = await sb.from("crm_keys").select("wrapped_key").eq("ws_kind", ws.kind).eq("ws_id", ws.id).maybeSingle();
  if (!k) return bad(409, "crm-not-initialized");
  const dek = unwrapKey(k.wrapped_key as string, ws.kind, ws.id);
  const enc = (table: string, field: string, id: string, v: string) => encField(dek, v, `${table}.${field}:${id}`);

  // дубль по телефону / e-mail
  const hashes = [phone && valueHash(ws.kind, ws.id, "phone", normalizeContact("phone", phone)), email && valueHash(ws.kind, ws.id, "email", normalizeContact("email", email))].filter(Boolean) as string[];
  let clientId: string | null = null, isDup = false;
  if (hashes.length) {
    const { data: hit } = await sb.from("crm_contacts").select("client_id, crm_clients!inner(id, merged_into)").eq("ws_kind", ws.kind).eq("ws_id", ws.id).in("value_hash", hashes).limit(1).maybeSingle();
    if (hit) { clientId = hit.client_id as string; isDup = true; }
  }
  const lang = ["RU", "EN", "TR"].includes((body.lang ?? "").toUpperCase()) ? (body.lang as string).toUpperCase() : "RU";
  if (!clientId) {
    clientId = crypto.randomUUID();
    const { error } = await sb.from("crm_clients").insert({ id: clientId, ws_kind: ws.kind, ws_id: ws.id, owner_id: null, name: name || phone || email, lang, source_id: src.id, notes_enc: null });
    if (error) return bad(500, "insert");
    const contacts = [phone && { kind: "phone", v: phone }, email && { kind: "email", v: email }].filter(Boolean) as { kind: string; v: string }[];
    if (contacts.length) {
      await sb.from("crm_contacts").insert(contacts.map((x, i) => { const id = crypto.randomUUID(); return { id, client_id: clientId, ws_kind: ws.kind, ws_id: ws.id, kind: x.kind, value_enc: enc("crm_contacts", "value", id, x.v), value_hash: valueHash(ws.kind, ws.id, x.kind, normalizeContact(x.kind, x.v)), is_main: i === 0, sort: i }; }));
    }
  }
  const inboundId = crypto.randomUUID();
  await sb.from("crm_inbound").insert({ id: inboundId, ws_kind: ws.kind, ws_id: ws.id, source_id: src.id, raw_enc: enc("crm_inbound", "raw", inboundId, JSON.stringify({ name, phone, email, message, lang, at: new Date().toISOString() })), client_id: clientId, is_dup: isDup });
  const { data: ev } = await sb.from("crm_events").insert({ ws_kind: ws.kind, ws_id: ws.id, client_id: clientId, actor_id: null, kind: "lead", payload: { sourceId: src.id, dup: isDup, inboundId } }).select("id").single();
  if (ev && message) await sb.from("crm_events").update({ text_enc: enc("crm_events", "text", String(ev.id), message) }).eq("id", ev.id);
  // уведомление: риэлтору — ему, компании — всем участникам (колокольчик + realtime)
  const to: string[] = ws.kind === "realtor" ? [ws.id] : [];
  if (ws.kind === "developer") {
    const [{ data: a }, { data: b }] = await Promise.all([sb.from("profiles").select("id").eq("developer_id", ws.id).eq("status", "active"), sb.from("developer_members").select("profile_id").eq("developer_id", ws.id)]);
    (a ?? []).forEach((p) => to.push(p.id as string)); (b ?? []).forEach((p) => to.push(p.profile_id as string));
  }
  const { data: srcRow } = await sb.from("crm_sources").select("name").eq("id", src.id).maybeSingle();
  const srcName = (srcRow?.name as string) ?? "";
  // имена источников по умолчанию — ключи i18n (site, phone…); в уведомлении их не показываем, только свои названия
  await notify(to, "crm_lead", { name: name || phone || email, source: DEFAULT_SOURCES.some((d) => d.key === srcName) ? "" : srcName, clientId, href: ws.kind === "realtor" ? `/crm/${clientId}` : `/dev/crm/${clientId}` });
  return NextResponse.json({ ok: true, clientId, duplicate: isDup });
}
