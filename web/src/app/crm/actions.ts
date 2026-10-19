"use server";

// Серверные экшены CRM. Все чтения/записи — сессионным клиентом (RLS), шифрование/расшифровка контактов и заметок —
// здесь, на сервере (ключ в .env). В браузер уходят уже расшифрованные значения только тех записей, что разрешены RLS.
import { translate } from "@/app/(dev)/dev/chat/actions";
import type { Lang } from "@/i18n";
import { assertWrite, audit, branchesOf, crmCtx, dec, dekOfAdmin, enc, forgetRole, hashOf, lostReasonsOf, membersOf, wsOfProfile, type Ctx, assertOwner } from "@/lib/crm/server";
import { decField, encField, normalizeContact, valueHash } from "@/lib/crm/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { notify } from "@/lib/notify";
import { ROLE_OF_KIND, REQUEST_FIELDS } from "@/lib/crm/requestFields";
import { unitKey } from "@/lib/crm/types";
import { newSourceToken } from "@/lib/crm/crypto";
import type { ObjRef, UnitBrief, Branch, Client, StageScope, ClientInput, ClientRole, Contact, ContactKind, CrmEvent, CrmMe, CrmMember, CrmRequest, Deal, DealInput, DupHit, EventKind, Kvkk, MemberRole, RequestBrief, RequestInput, RequestStatus, Source, Stage, Task, TaskInput, Want } from "@/lib/crm/types";

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));
const n = (v: unknown) => (v == null || v === "" ? null : Number(v));

// ---------- bootstrap ----------
export async function crmBootstrap(): Promise<{ me: CrmMe; stages: Stage[]; cstages: Stage[]; sources: Source[] }> {
  const c = await crmCtx();
  const [members, stages, cstages, sources, branches, lostReasons] = await Promise.all([membersOf(c.sb, c.ws, c.me), loadStages(c, "deal"), loadStages(c, "client"), loadSources(c), branchesOf(c.sb, c.ws), lostReasonsOf(c.sb, c.ws)]);
  return { me: { ws: c.ws, access: c.access, trialUntil: c.trialUntil, paidTo: c.paidTo, isAdmin: c.isAdmin, meId: c.me.id, role: c.role, branchId: c.branchId, members, branches, lostReasons }, stages, cstages, sources };
}
async function loadStages(c: Ctx, scope: StageScope = "deal"): Promise<Stage[]> {
  const { data } = await c.sb.from("crm_stages").select("*").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).eq("scope", scope).order("sort");
  return (data ?? []).map((r: Row) => ({ id: r.id as string, key: r.key as string, name: (r.name as Record<Lang, string>) ?? {}, kind: r.kind as Stage["kind"], color: s(r.color), sort: r.sort as number, scope: (r.scope as StageScope) ?? "deal" }));
}
async function loadSources(c: Ctx): Promise<Source[]> {
  const { data } = await c.sb.from("crm_sources").select("id, name, kind, active, sort, token_hash").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).order("sort");
  return (data ?? []).map((r: Row) => ({ id: r.id as string, name: r.name as string, kind: r.kind as Source["kind"], active: !!r.active, sort: r.sort as number, hasToken: !!r.token_hash }));
}

// ---------- клиенты ----------
function rowClient(c: Ctx, r: Row, contacts: Contact[], dealsN: number, openN: number, nextTask: Client["nextTask"], requests: RequestBrief[] = [], visitAt: string | null = null): Client {
  const id = r.id as string;
  return {
    id, no: Number(r.no ?? 0), ownerId: s(r.owner_id), name: r.name as string, lang: (r.lang as Lang) || "RU", sourceId: s(r.source_id),
    kind: (r.kind as Client["kind"]) || "person", company: s(r.company), roles: ((r.roles as ClientRole[]) ?? []), stage: (r.stage as Client["stage"]) || "new", priority: (r.priority as Client["priority"]) ?? null,
    country: s(r.country), citizenship: s(r.citizenship), channel: (r.channel as Client["channel"]) ?? null, contactTime: s(r.contact_time), campaign: s(r.campaign),
    refKind: (r.ref_kind as Client["refKind"]) || "none", refProfileId: s(r.ref_profile_id), refAgencyId: s(r.ref_agency_id), refClientId: s(r.ref_client_id), refText: s(r.ref_text),
    branchId: s(r.branch_id), kvkk: ((r.kvkk as Kvkk) ?? {}), requests, boardPos: n(r.board_pos),
    budgetMin: n(r.budget_min), budgetMax: n(r.budget_max), cur: (r.cur as string) || "TRY", want: (r.want as Want) ?? {},
    notes: dec(c, "crm_clients", "notes", id, r.notes_enc as string | null), tags: (r.tags as string[]) ?? [], consent: !!r.consent, consentAt: s(r.consent_at),
    dossier: parseDossier(c, id, r.dossier_enc as string | null),
    status: r.status as Client["status"], createdAt: r.created_at as string, updatedAt: r.updated_at as string, lastActivityAt: (r.last_activity_at as string | null) ?? (r.updated_at as string),
    contacts, dealsN, openDealsN: openN, nextTask, visitAt,
  };
}
function rowContact(c: Ctx, r: Row): Contact {
  const id = r.id as string;
  return { id, kind: r.kind as ContactKind, value: dec(c, "crm_contacts", "value", id, r.value_enc as string), label: s(r.label), isMain: !!r.is_main };
}

export async function listClients(opts: { q?: string; status?: "active" | "archived"; ownerId?: string | null; branchId?: string | null } = {}): Promise<Client[]> {
  const c = await crmCtx();
  return listClientsFor(c, opts);
}
/** Страница клиентов одним вызовом (12.10.2026, «долго подгружается список»): список + сводка сделок + счётчики, один crmCtx. */
export async function crmClientsPage(opts: { q?: string; status?: "active" | "archived" } = {}): Promise<{ list: Client[]; deals: Record<string, DealSummary>; counts: { clients: number; deals: number; tasks: number } }> {
  const c = await crmCtx();
  const [list, counts] = await Promise.all([listClientsFor(c, opts), countsFor(c)]);
  const deals = await dealSummaryFor(c, list.map((x) => x.id));
  return { list, deals, counts };
}
async function listClientsFor(c: Ctx, opts: { q?: string; status?: "active" | "archived"; ownerId?: string | null; branchId?: string | null }): Promise<Client[]> {
  let q = c.sb.from("crm_clients").select("*").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).is("merged_into", null).eq("status", opts.status ?? "active").order("last_activity_at", { ascending: false }).limit(500);
  if (opts.ownerId) q = q.eq("owner_id", opts.ownerId);
  if (opts.branchId) q = q.eq("branch_id", opts.branchId);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  let rows = (data ?? []) as Row[];
  const term = (opts.q ?? "").trim();
  if (term) {
    // по имени — на сервере после выборки; по телефону/e-mail — по хэшу (сам номер в базе не хранится открытым)
    const kinds: ContactKind[] = /@/.test(term) ? ["email"] : /\d{4,}/.test(term) ? ["phone", "whatsapp"] : [];
    const hashes = kinds.map((k) => hashOf(c, k, term));
    let hitIds = new Set<string>();
    if (hashes.length) {
      const { data: hits } = await c.sb.from("crm_contacts").select("client_id").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).in("value_hash", hashes);
      hitIds = new Set((hits ?? []).map((h) => h.client_id as string));
    }
    const low = term.toLowerCase();
    // по номеру (0026): «C-100001», «100001»; старый вид «#D2B93EAE» (первые символы uuid) — тоже
    const noq = term.match(/^(?:c-?|#)?(\d{3,})$/i); const noN = noq ? Number(noq[1]) : 0;
    const idq = !noq && /^#?[0-9a-f-]{4,}$/i.test(term) ? term.replace(/^#/, "").toLowerCase() : "";
    rows = rows.filter((r) => (r.name as string).toLowerCase().includes(low) || hitIds.has(r.id as string) || (!!noN && Number(r.no) === noN) || (!!idq && (r.id as string).toLowerCase().startsWith(idq)));
  }
  const ids = rows.map((r) => r.id as string);
  if (!ids.length) return [];
  const [{ data: cts }, { data: deals }, { data: tasks }, { data: reqs }] = await Promise.all([
    c.sb.from("crm_contacts").select("*").in("client_id", ids).order("is_main", { ascending: false }).order("sort"),
    c.sb.from("crm_deals").select("client_id, closed_at").in("client_id", ids),
    c.sb.from("crm_tasks").select("id, client_id, title, due_at, kind").in("client_id", ids).is("done_at", null).order("due_at"),
    c.sb.from("crm_requests").select("id, client_id, kind, status, priority, fields").in("client_id", ids).order("created_at"),
  ]);
  const byClient = <T extends Row>(list: T[] | null) => { const m = new Map<string, T[]>(); (list ?? []).forEach((x) => { const k = x.client_id as string; m.set(k, [...(m.get(k) ?? []), x]); }); return m; };
  const cm = byClient(cts as Row[] | null), dm = byClient(deals as Row[] | null), tm = byClient(tasks as Row[] | null), rm = byClient(reqs as Row[] | null);
  return rows.map((r) => {
    const id = r.id as string;
    const ds = dm.get(id) ?? [];
    const t0 = (tm.get(id) ?? [])[0];
    return rowClient(c, r, (cm.get(id) ?? []).map((x) => rowContact(c, x)), ds.length, ds.filter((d) => !d.closed_at).length,
      t0 ? { id: t0.id as string, title: t0.title as string, dueAt: t0.due_at as string, kind: t0.kind as Task["kind"] } : null, (rm.get(id) ?? []).map(rowBrief).sort((a, b) => Number(a.status === "closed") - Number(b.status === "closed")),
      ((tm.get(id) ?? []).find((x) => x.kind === "meeting")?.due_at as string | undefined) ?? null);
  });
}

export async function getClient(id: string): Promise<{ client: Client; deals: Deal[]; tasks: Task[]; events: CrmEvent[]; requests: CrmRequest[]; dups: DupHit[]; objs: Record<string, ListingBrief>; units: Record<string, UnitBrief> } | null> {
  const c = await crmCtx();
  const { data: r } = await c.sb.from("crm_clients").select("*").eq("id", id).maybeSingle();
  if (!r) return null;
  const [{ data: cts }, deals, tasks, events, requests] = await Promise.all([
    c.sb.from("crm_contacts").select("*").eq("client_id", id).order("is_main", { ascending: false }).order("sort"),
    listDealsFor(c, { clientId: id }), listTasksFor(c, { clientId: id }), loadEvents(c, { clientId: id }), listRequestsFor(c, id, s(r.owner_id)),
  ]);
  const contacts = ((cts ?? []) as Row[]).map((x) => rowContact(c, x));
  // дубли и объекты — тем же вызовом (раньше карточка делала три серверных вызова подряд)
  const variantRefs = requests.flatMap((q) => q.variants);
  const [dups, objs, units] = await Promise.all([
    findDupsFor(c, contacts.map((x) => ({ kind: x.kind, value: x.value })), id),
    listingBriefsFor(c, [...requests.map((q) => q.listingId), ...deals.map((d) => d.listingId), ...variantRefs.map((v) => (v.kind === "listing" ? v.id : null))].filter(Boolean) as string[]),
    unitBriefsFor(c, [...deals.map((d) => (d.projectId && d.unitUid != null ? { projectId: Number(d.projectId), unitUid: d.unitUid } : null)), ...variantRefs.map((v) => (v.kind === "unit" ? { projectId: v.projectId, unitUid: v.unitUid } : null))].filter(Boolean) as { projectId: number; unitUid: number }[]),
    audit(c.sb, c.ws, c.me.id, "view_client", id, {}),
  ]);
  const open = deals.filter((d) => !d.closedAt).length;
  const t0 = tasks.find((t) => !t.doneAt);
  const briefs: RequestBrief[] = requests.filter((x) => x.status !== "closed").map((x) => ({ id: x.id, kind: x.kind, status: x.status, priority: x.priority, fields: x.fields }));
  return { client: rowClient(c, r as Row, contacts, deals.length, open, t0 ? { id: t0.id, title: t0.title, dueAt: t0.dueAt, kind: t0.kind } : null, briefs), deals, tasks, events, requests, dups, objs, units };
}

/** Дубли по контактам (телефон/e-mail) среди клиентов ws. */
export async function findDups(contacts: { kind: ContactKind; value: string }[], excludeId?: string | null): Promise<DupHit[]> {
  const c = await crmCtx();
  return findDupsFor(c, contacts, excludeId);
}
async function findDupsFor(c: Ctx, contacts: { kind: ContactKind; value: string }[], excludeId?: string | null): Promise<DupHit[]> {
  const pairs = contacts.filter((x) => x.value.trim() && (x.kind === "phone" || x.kind === "whatsapp" || x.kind === "email")).map((x) => ({ kind: x.kind, hash: hashOf(c, x.kind, x.value) }));
  if (!pairs.length) return [];
  const { data } = await c.sb.from("crm_contacts").select("client_id, kind, crm_clients!inner(id, name, owner_id, merged_into, status)").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).in("value_hash", pairs.map((p) => p.hash));
  const out = new Map<string, DupHit>();
  (data ?? []).forEach((h: Row) => {
    const cl = (Array.isArray(h.crm_clients) ? h.crm_clients[0] : h.crm_clients) as Row | null;
    if (!cl || cl.merged_into || cl.id === excludeId) return;
    out.set(cl.id as string, { clientId: cl.id as string, name: cl.name as string, kind: h.kind as ContactKind, ownerId: s(cl.owner_id) });
  });
  return [...out.values()];
}

export async function saveClient(input: ClientInput, id?: string | null): Promise<string> {
  const c = await crmCtx(); assertWrite(c);
  const cid = id || crypto.randomUUID();
  const roles = [...new Set<ClientRole>([...input.roles, ...(input.firstRequest ? [ROLE_OF_KIND[input.firstRequest.kind]] : [])])];
  const consentOn = !!(input.kvkk.consent?.call || input.kvkk.consent?.sms || input.kvkk.consent?.whatsapp || input.kvkk.consent?.email);
  const kvkk: Kvkk = { ...input.kvkk };
  if (consentOn && !kvkk.consent?.at) kvkk.consent = { ...kvkk.consent, at: new Date().toISOString() };
  if (kvkk.info?.method && !kvkk.info.at) kvkk.info = { ...kvkk.info, at: new Date().toISOString() };
  const row = {
    id: cid, ws_kind: c.ws.kind, ws_id: c.ws.id, owner_id: input.ownerId || c.me.id, name: input.name.trim(), lang: input.lang, source_id: input.sourceId,
    kind: input.kind, company: input.kind === "company" ? input.company.trim() || null : null, roles, stage: input.stage, priority: input.priority,
    country: input.country || null, citizenship: input.citizenship || null, channel: input.channel, contact_time: input.contactTime.trim() || null, campaign: input.campaign.trim() || null,
    ref_kind: input.refKind, ref_profile_id: input.refKind === "realtor" ? input.refProfileId : null, ref_agency_id: input.refKind === "agency" ? input.refAgencyId : null,
    ref_client_id: input.refKind === "client" ? input.refClientId : null, ref_text: input.refKind === "text" ? input.refText.trim() || null : null,
    branch_id: input.branchId ?? (id ? undefined : c.branchId), kvkk,
    notes_enc: enc(c, "crm_clients", "notes", cid, input.notes.trim()), tags: input.tags, consent: consentOn,
    consent_at: consentOn ? kvkk.consent?.at ?? new Date().toISOString() : null,
    created_by: id ? undefined : c.me.id,
  };
  const { error } = await c.sb.from("crm_clients").upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);
  if (!id && input.firstRequest) await saveRequestFor(c, { clientId: cid, kind: input.firstRequest.kind, status: "active", ownerId: row.owner_id, branchId: c.branchId, listingId: s(input.firstRequest.fields.listing), priority: input.priority, deadline: null, fields: input.firstRequest.fields, closed: {} }, null, true);
  if (!id && input.firstTask?.dueAt) await c.sb.from("crm_tasks").insert({ ws_kind: c.ws.kind, ws_id: c.ws.id, client_id: cid, owner_id: row.owner_id, kind: input.firstTask.kind, title: input.firstTask.title.trim() || "", due_at: input.firstTask.dueAt, created_by: c.me.id });
  // контакты: полная замена набора
  const keep = input.contacts.filter((x) => x.value.trim());
  const { data: old } = await c.sb.from("crm_contacts").select("id").eq("client_id", cid);
  const keepIds = new Set(keep.map((x) => x.id).filter(Boolean));
  const gone = (old ?? []).map((o) => o.id as string).filter((x) => !keepIds.has(x));
  if (gone.length) await c.sb.from("crm_contacts").delete().in("id", gone);
  if (keep.length) {
    const rows = keep.map((x, i) => { const xid = x.id || crypto.randomUUID(); return { id: xid, client_id: cid, ws_kind: c.ws.kind, ws_id: c.ws.id, kind: x.kind, value_enc: enc(c, "crm_contacts", "value", xid, x.value.trim()), value_hash: hashOf(c, x.kind, x.value), label: x.label.trim() || null, is_main: x.isMain || i === 0, sort: i }; });
    const { error: e2 } = await c.sb.from("crm_contacts").upsert(rows, { onConflict: "id" });
    if (e2) throw new Error(e2.message);
  }
  await addEvent(c, { clientId: cid, kind: id ? "edit" : "created", payload: {} });
  return cid;
}

export async function setClientStatus(id: string, status: "active" | "archived"): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const { error } = await c.sb.from("crm_clients").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Полное удаление клиента (KVKK/GDPR): контакты, сделки, задачи, история — каскадом; след остаётся только в журнале. */
export async function deleteClient(id: string): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const { error } = await c.sb.from("crm_clients").delete().eq("id", id);
  if (error) throw new Error(error.message);
  await audit(c.sb, c.ws, c.me.id, "delete_client", id, {});
}

/** Слияние дублей: контакты/сделки/задачи/история переезжают в keepId, dropId помечается merged_into. */
export async function mergeClients(keepId: string, dropId: string): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  if (keepId === dropId) return;
  const { data: oldC } = await c.sb.from("crm_contacts").select("*").eq("client_id", dropId);
  const { data: keepC } = await c.sb.from("crm_contacts").select("value_hash").eq("client_id", keepId);
  const have = new Set((keepC ?? []).map((x) => x.value_hash as string));
  for (const x of (oldC ?? []) as Row[]) {
    if (have.has(x.value_hash as string)) { await c.sb.from("crm_contacts").delete().eq("id", x.id as string); continue; }
    // перешифровать под новый id записи нельзя без расшифровки — переносим с тем же id (AAD привязан к id контакта, не клиента)
    await c.sb.from("crm_contacts").update({ client_id: keepId, is_main: false }).eq("id", x.id as string);
  }
  await Promise.all([
    c.sb.from("crm_deals").update({ client_id: keepId }).eq("client_id", dropId),
    c.sb.from("crm_tasks").update({ client_id: keepId }).eq("client_id", dropId),
    c.sb.from("crm_events").update({ client_id: keepId }).eq("client_id", dropId),
    c.sb.from("crm_inbound").update({ client_id: keepId }).eq("client_id", dropId),
  ]);
  await c.sb.from("crm_clients").update({ merged_into: keepId, status: "archived" }).eq("id", dropId);
  await addEvent(c, { clientId: keepId, kind: "merge", payload: { from: dropId } });
  await audit(c.sb, c.ws, c.me.id, "merge", keepId, { from: dropId });
}

// ---------- история ----------
async function addEvent(c: Ctx, e: { clientId?: string | null; dealId?: string | null; kind: EventKind; payload?: Record<string, unknown>; text?: string }): Promise<number> {
  const { data, error } = await c.sb.from("crm_events").insert({ ws_kind: c.ws.kind, ws_id: c.ws.id, client_id: e.clientId ?? null, deal_id: e.dealId ?? null, actor_id: c.me.id, kind: e.kind, payload: e.payload ?? {} }).select("id").single();
  if (error) throw new Error(error.message);
  const id = data.id as number;
  if (e.text?.trim()) await c.sb.from("crm_events").update({ text_enc: enc(c, "crm_events", "text", String(id), e.text.trim()) }).eq("id", id);
  return id;
}
async function loadEvents(c: Ctx, f: { clientId?: string; dealId?: string }): Promise<CrmEvent[]> {
  let q = c.sb.from("crm_events").select("*, crm_event_tr(lang, text_enc)").order("created_at", { ascending: false }).limit(300);
  if (f.clientId) q = q.eq("client_id", f.clientId);
  if (f.dealId) q = q.eq("deal_id", f.dealId);
  const { data } = await q;
  return ((data ?? []) as Row[]).map((r) => {
    const id = r.id as number;
    const tr: Partial<Record<Lang, string>> = {};
    ((r.crm_event_tr as Row[]) ?? []).forEach((x) => { tr[x.lang as Lang] = dec(c, "crm_event_tr", String(x.lang), id, x.text_enc as string); });
    return { id, clientId: s(r.client_id), dealId: s(r.deal_id), actorId: s(r.actor_id), kind: r.kind as EventKind, payload: (r.payload as Record<string, unknown>) ?? {}, text: dec(c, "crm_events", "text", id, r.text_enc as string | null), createdAt: r.created_at as string, tr };
  });
}
export async function addNote(clientId: string | null, dealId: string | null, kind: EventKind, text: string): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  await addEvent(c, { clientId, dealId, kind, text });
}
/** Перевод заметки по запросу смотрящего; результат кэшируется (зашифрованно), второй раз не платим. */
export async function translateNote(eventId: number, to: Lang): Promise<string> {
  const c = await crmCtx();
  const { data: r } = await c.sb.from("crm_events").select("id, text_enc").eq("id", eventId).maybeSingle();
  if (!r?.text_enc) return "";
  const src = dec(c, "crm_events", "text", eventId, r.text_enc as string);
  const { data: cached } = await c.sb.from("crm_event_tr").select("text_enc").eq("event_id", eventId).eq("lang", to).maybeSingle();
  if (cached) return dec(c, "crm_event_tr", to, eventId, cached.text_enc as string);
  const res = await translate(src, to, "chat");
  if (res.fallback) throw new Error("translate");
  await c.sb.from("crm_event_tr").upsert({ event_id: eventId, lang: to, text_enc: enc(c, "crm_event_tr", to, String(eventId), res.text) });
  return res.text;
}

/** Анкета клиента (0027): расшифровка; битое/пустое → {}. */
function parseDossier(c: Ctx, id: string, enc_: string | null): Record<string, string> {
  if (!enc_) return {};
  try { return JSON.parse(dec(c, "crm_clients", "dossier", id, enc_) || "{}"); } catch { return {}; }
}
/** Анкета для договоров — сохранить (заполняется один раз, подставляется во все документы). */
export async function saveDossier(clientId: string, values: Record<string, string>): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const clean: Record<string, string> = {}; for (const [k, v] of Object.entries(values)) if (v?.trim()) clean[k] = v.trim();
  const { error } = await c.sb.from("crm_clients").update({ dossier_enc: enc(c, "crm_clients", "dossier", clientId, JSON.stringify(clean)) }).eq("id", clientId);
  if (error) throw new Error(error.message);
  await addEvent(c, { clientId, kind: "edit", payload: { dossier: true } });
}

// ---------- сделки ----------
function rowDeal(r: Row, clientName: string, sellerName: string | null = null): Deal {
  return { id: r.id as string, no: Number(r.no ?? 0), clientId: r.client_id as string, clientName, ownerId: s(r.owner_id), stageId: s(r.stage_id), title: (r.title as string) ?? "", deal: (r.deal as string) || "sale", amount: n(r.amount), cur: (r.cur as string) || "TRY", listingId: s(r.listing_id), projectId: s(r.project_id), unitUid: n(r.unit_uid), selectionId: s(r.selection_id), sourceId: s(r.source_id), lostReason: s(r.lost_reason), closedAt: s(r.closed_at), createdAt: r.created_at as string, updatedAt: r.updated_at as string,
    requestId: s(r.request_id), branchId: s(r.branch_id), commission: n(r.commission), commissionKind: (r.commission_kind as Deal["commissionKind"]) ?? null, deposit: n(r.deposit), depositAt: s(r.deposit_at), boardPos: n(r.board_pos), objectText: s(r.object_text), companyProfileId: s(r.company_profile_id), sellerClientId: s(r.seller_client_id), sellerName };
}
async function listDealsFor(c: Ctx, f: { clientId?: string }): Promise<Deal[]> {
  let q = c.sb.from("crm_deals").select("*, crm_clients!crm_deals_client_id_fkey(name)").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).order("updated_at", { ascending: false }).limit(1000);
  if (f.clientId) q = q.eq("client_id", f.clientId);
  const { data } = await q;
  return ((data ?? []) as Row[]).map((r) => { const cl = (Array.isArray(r.crm_clients) ? r.crm_clients[0] : r.crm_clients) as Row | null; return rowDeal(r, (cl?.name as string) ?? ""); });
}
export async function listDeals(): Promise<Deal[]> { const c = await crmCtx(); return listDealsFor(c, {}); }
export async function saveDeal(input: DealInput, id?: string | null): Promise<string> {
  const c = await crmCtx(); assertWrite(c);
  const did = id || crypto.randomUUID();
  // источник — свойство клиента (12.10.2026): сделка наследует источник клиента, в форме сделки его нет
  const { data: clRow } = await c.sb.from("crm_clients").select("source_id").eq("id", input.clientId).maybeSingle();
  const row = { id: did, ws_kind: c.ws.kind, ws_id: c.ws.id, client_id: input.clientId, owner_id: input.ownerId || c.me.id, stage_id: input.stageId, title: input.title.trim(), deal: input.deal, amount: input.amount, cur: input.cur || "TRY", listing_id: input.listingId, project_id: input.projectId, unit_uid: input.unitUid, selection_id: input.selectionId, object_text: input.objectText?.trim() || null, company_profile_id: input.companyProfileId || null, seller_client_id: input.sellerClientId || null, source_id: (clRow?.source_id as string | null) ?? input.sourceId ?? null, request_id: input.requestId, commission: input.commission, commission_kind: input.commission != null ? input.commissionKind ?? "sum" : null, deposit: input.deposit, deposit_at: input.depositAt, branch_id: id ? undefined : c.branchId, created_by: id ? undefined : c.me.id };
  const { error } = await c.sb.from("crm_deals").upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);
  if (!id) await addEvent(c, { clientId: input.clientId, dealId: did, kind: "deal", payload: { title: row.title } });
  return did;
}
export async function moveDeal(id: string, stageId: string, lostReason?: string, boardPos?: number | null): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const [{ data: d }, { data: st }] = await Promise.all([c.sb.from("crm_deals").select("client_id, stage_id").eq("id", id).maybeSingle(), c.sb.from("crm_stages").select("key, kind, name").eq("id", stageId).maybeSingle()]);
  if (!d || !st) throw new Error("not-found");
  // в событие пишем и ключ/имя обоих этапов: после смены воронки (0027/0028) старые id не находятся и лента показывала «Без этапа → Без этапа»
  const { data: from } = d.stage_id ? await c.sb.from("crm_stages").select("key, name").eq("id", d.stage_id as string).maybeSingle() : { data: null };
  const closed = st.kind === "open" ? null : new Date().toISOString();
  const { error } = await c.sb.from("crm_deals").update({ stage_id: stageId, closed_at: closed, lost_reason: st.kind === "lost" ? lostReason ?? null : null, ...(boardPos !== undefined ? { board_pos: boardPos } : {}) }).eq("id", id);
  if (error) throw new Error(error.message);
  await addEvent(c, { clientId: d.client_id as string, dealId: id, kind: "stage", payload: { from: d.stage_id, to: stageId, key: st.key, toName: st.name ?? null, fromKey: from?.key ?? null, fromName: from?.name ?? null } });
}
export async function deleteDeal(id: string): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const { error } = await c.sb.from("crm_deals").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- задачи ----------
function rowTask(r: Row, clientName: string | null): Task {
  return { id: r.id as string, clientId: s(r.client_id), clientName, dealId: s(r.deal_id), ownerId: s(r.owner_id), kind: r.kind as Task["kind"], title: (r.title as string) ?? "", dueAt: r.due_at as string, doneAt: s(r.done_at), createdAt: r.created_at as string };
}
async function listTasksFor(c: Ctx, f: { clientId?: string; dealId?: string; open?: boolean }): Promise<Task[]> {
  let q = c.sb.from("crm_tasks").select("*, crm_clients(name)").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).order("due_at").limit(500);
  if (f.clientId) q = q.eq("client_id", f.clientId);
  if (f.dealId) q = q.eq("deal_id", f.dealId);
  if (f.open) q = q.is("done_at", null);
  const { data } = await q;
  return ((data ?? []) as Row[]).map((r) => { const cl = (Array.isArray(r.crm_clients) ? r.crm_clients[0] : r.crm_clients) as Row | null; return rowTask(r, (cl?.name as string) ?? null); });
}
export async function listTasks(open = true): Promise<Task[]> { const c = await crmCtx(); return listTasksFor(c, { open }); }
export async function saveTask(input: TaskInput, id?: string | null): Promise<string> {
  const c = await crmCtx(); assertWrite(c);
  const tid = id || crypto.randomUUID();
  const { error } = await c.sb.from("crm_tasks").upsert({ id: tid, ws_kind: c.ws.kind, ws_id: c.ws.id, client_id: input.clientId, deal_id: input.dealId, owner_id: input.ownerId || c.me.id, kind: input.kind, title: input.title.trim(), due_at: input.dueAt, created_by: id ? undefined : c.me.id }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return tid;
}
/** Статус «Приедет» + напоминание одним вызовом (19.10.2026, у клиента статус стоял, а задачи с датой не было: два отдельных
 *  вызова, второй падал молча). Открытая задача «Приезд клиента» у клиента обновляется, а не дублируется. Возвращает id задачи. */
export async function setClientVisit(clientId: string, dueAt: string, ownerId: string | null, title: string): Promise<string> {
  const c = await crmCtx(); assertWrite(c);
  const { error: e1 } = await c.sb.from("crm_clients").update({ stage: "visit" }).eq("id", clientId);
  if (e1) throw new Error(e1.message);
  const { data: ex } = await c.sb.from("crm_tasks").select("id").eq("client_id", clientId).eq("kind", "meeting").eq("title", title.trim()).is("done_at", null).order("due_at").limit(1).maybeSingle();
  const tid = ex?.id ?? crypto.randomUUID();
  const { error } = await c.sb.from("crm_tasks").upsert({ id: tid, ws_kind: c.ws.kind, ws_id: c.ws.id, client_id: clientId, deal_id: null, owner_id: ownerId || c.me.id, kind: "meeting", title: title.trim(), due_at: dueAt, created_by: c.me.id });
  if (error) throw new Error(error.message);
  return tid;
}
export async function doneTask(id: string, done: boolean): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const { data: t } = await c.sb.from("crm_tasks").select("client_id, deal_id, title, kind").eq("id", id).maybeSingle();
  const { error } = await c.sb.from("crm_tasks").update({ done_at: done ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw new Error(error.message);
  if (done && t) await addEvent(c, { clientId: s(t.client_id), dealId: s(t.deal_id), kind: "task", payload: { title: t.title, taskKind: t.kind } });
}
export async function deleteTask(id: string): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  await c.sb.from("crm_tasks").delete().eq("id", id);
}

// ---------- настройки: этапы и источники ----------
export async function saveStages(stages: { id?: string; key: string; name: Record<string, string>; kind: Stage["kind"]; color: string | null }[], scope: StageScope = "deal"): Promise<Stage[]> {
  const c = await crmCtx(); assertOwner(c);
  // свои имена этапов: введённое на одном языке переводится на два других (замечание пользователя 12.10.2026)
  const named = await Promise.all(stages.map(async (x) => {
    const name: Record<string, string> = { ...x.name };
    const langs: Lang[] = ["RU", "EN", "TR"];
    const src = langs.find((l) => name[l]?.trim());
    if (src) for (const l of langs) if (l !== src && !name[l]?.trim()) { try { const r = await translate(name[src], l, "label"); if (!r.fallback) name[l] = r.text; } catch { /* оставим пустым — покажется исходный */ } }
    return { ...x, name };
  }));
  const rows = named.map((x, i) => ({ id: x.id || crypto.randomUUID(), ws_kind: c.ws.kind, ws_id: c.ws.id, key: x.key || `s${i}`, name: x.name, kind: x.kind, color: x.color, sort: i, scope }));
  const { error } = await c.sb.from("crm_stages").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(error.message);
  const ids = rows.map((r) => r.id);
  const { data: old } = await c.sb.from("crm_stages").select("id").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).eq("scope", scope);
  const gone = (old ?? []).map((o) => o.id as string).filter((x) => !ids.includes(x));
  if (gone.length) await c.sb.from("crm_stages").delete().in("id", gone); // сделки на удалённом этапе → stage_id null
  return loadStages(c, scope);
}
export async function saveSource(src: { id?: string; name: string; kind: Source["kind"]; active: boolean }): Promise<Source[]> {
  const c = await crmCtx(); assertOwner(c);
  const { error } = await c.sb.from("crm_sources").upsert({ id: src.id || crypto.randomUUID(), ws_kind: c.ws.kind, ws_id: c.ws.id, name: src.name.trim(), kind: src.kind, active: src.active }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return loadSources(c);
}
export async function deleteSource(id: string): Promise<Source[]> {
  const c = await crmCtx(); assertOwner(c);
  await c.sb.from("crm_sources").delete().eq("id", id);
  return loadSources(c);
}
/** Токен для внешнего сайта (показывается один раз). */
export async function issueSourceToken(id: string): Promise<string> {
  const c = await crmCtx(); assertOwner(c);
  const { token, hash } = newSourceToken();
  const { error } = await c.sb.from("crm_sources").update({ token_hash: hash }).eq("id", id);
  if (error) throw new Error(error.message);
  await audit(c.sb, c.ws, c.me.id, "source_token", id, {});
  return token;
}

// ---------- журнал доступа ----------
export async function listAudit(): Promise<{ id: number; actorId: string | null; action: string; targetId: string | null; meta: Record<string, unknown>; createdAt: string }[]> {
  const c = await crmCtx();
  const { data } = await c.sb.from("crm_audit").select("*").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).order("created_at", { ascending: false }).limit(300);
  return ((data ?? []) as Row[]).map((r) => ({ id: r.id as number, actorId: s(r.actor_id), action: r.action as string, targetId: s(r.target_id), meta: (r.meta as Record<string, unknown>) ?? {}, createdAt: r.created_at as string }));
}

/** Экспорт клиентов в CSV (пишется в журнал). */
export async function exportClientsCsv(): Promise<string> {
  const c = await crmCtx();
  const list = await listClients({});
  await audit(c.sb, c.ws, c.me.id, "export", null, { n: list.length });
  const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const lines = [["name", "lang", "roles", "stage", "priority", "phones", "emails", "tags", "notes", "created_at"].join(";")];
  for (const cl of list) {
    lines.push([cl.name, cl.lang, cl.roles.join(", "), cl.stage, cl.priority ?? "", cl.contacts.filter((x) => x.kind === "phone" || x.kind === "whatsapp").map((x) => x.value).join(" / "), cl.contacts.filter((x) => x.kind === "email").map((x) => x.value).join(" / "), cl.tags.join(", "), cl.notes, cl.createdAt].map(esc).join(";"));
  }
  return "﻿" + lines.join("\n");
}

// ---------- справочник «кто привёл»: риэлторы и агентства базы (для застройщика) ----------
export async function listReferrers(): Promise<{ realtors: { id: string; name: string; agency: string }[]; agencies: { id: string; name: string }[] }> {
  const c = await crmCtx();
  const [{ data: ps }, { data: ags }] = await Promise.all([
    c.sb.from("profiles").select("id, name, agency_text, agencies(name)").eq("status", "active").eq("role", "realtor").order("name").limit(2000),
    c.sb.from("agencies").select("id, name").order("name").limit(2000),
  ]);
  return {
    realtors: ((ps ?? []) as Row[]).map((p) => { const ag = (Array.isArray(p.agencies) ? p.agencies[0] : p.agencies) as Row | null; return { id: p.id as string, name: (p.name as string) || "—", agency: (ag?.name as string) || (p.agency_text as string) || "" }; }),
    agencies: ((ags ?? []) as Row[]).map((a) => ({ id: a.id as string, name: a.name as string })),
  };
}

// ---------- v2: обзор, расширенный список клиентов, групповые действия ----------
export type Overview = {
  clients7: number; clients30: number; clientsTotal: number;
  openDeals: number; openSum: Record<string, number>; wonMonth: number; wonMonthSum: Record<string, number>; lostMonth: number;
  tasksToday: number; tasksOverdue: number;
  funnel: { stageId: string | null; n: number; sum: Record<string, number> }[];
  recentLeads: { clientId: string; name: string; at: string; dup: boolean; sourceId: string | null }[];
  todayTasks: Task[];
  recent: { id: string; name: string; updatedAt: string; ownerId: string | null }[];
};
export async function crmOverview(): Promise<Overview> {
  const c = await crmCtx();
  const now = new Date(); const d7 = new Date(now.getTime() - 7 * 864e5).toISOString(); const d30 = new Date(now.getTime() - 30 * 864e5).toISOString();
  const m0 = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const ws = (q: ReturnType<typeof c.sb.from>) => q;
  void ws;
  const [{ count: c7 }, { count: c30 }, { count: ct }, { data: deals }, { data: tasks }, { data: inbound }, { data: recent }] = await Promise.all([
    c.sb.from("crm_clients").select("id", { count: "exact", head: true }).eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).is("merged_into", null).gte("created_at", d7),
    c.sb.from("crm_clients").select("id", { count: "exact", head: true }).eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).is("merged_into", null).gte("created_at", d30),
    c.sb.from("crm_clients").select("id", { count: "exact", head: true }).eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).is("merged_into", null).eq("status", "active"),
    c.sb.from("crm_deals").select("id, stage_id, amount, cur, closed_at, updated_at, crm_stages(kind)").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id),
    c.sb.from("crm_tasks").select("*, crm_clients(name)").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).is("done_at", null).lte("due_at", end.toISOString()).order("due_at"),
    c.sb.from("crm_inbound").select("client_id, is_dup, source_id, created_at, crm_clients(name)").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).order("created_at", { ascending: false }).limit(8),
    c.sb.from("crm_clients").select("id, name, updated_at, owner_id").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).is("merged_into", null).eq("status", "active").order("updated_at", { ascending: false }).limit(8),
  ]);
  const add = (m: Record<string, number>, cur: string, v: unknown) => { const n = Number(v ?? 0); if (n) m[cur] = (m[cur] ?? 0) + n; };
  const openSum: Record<string, number> = {}, wonSum: Record<string, number> = {};
  const funnelM = new Map<string | null, { n: number; sum: Record<string, number> }>();
  let open = 0, won = 0, lost = 0;
  for (const d of (deals ?? []) as Row[]) {
    const st = (Array.isArray(d.crm_stages) ? d.crm_stages[0] : d.crm_stages) as Row | null;
    const kind = (st?.kind as string) ?? "open";
    if (!d.closed_at) { open++; add(openSum, (d.cur as string) || "TRY", d.amount); const k = s(d.stage_id); const f = funnelM.get(k) ?? { n: 0, sum: {} }; f.n++; add(f.sum, (d.cur as string) || "TRY", d.amount); funnelM.set(k, f); }
    else if (String(d.closed_at) >= m0) { if (kind === "won") { won++; add(wonSum, (d.cur as string) || "TRY", d.amount); } else if (kind === "lost") lost++; }
  }
  const todayTasks = ((tasks ?? []) as Row[]).map((r) => { const cl = (Array.isArray(r.crm_clients) ? r.crm_clients[0] : r.crm_clients) as Row | null; return rowTask(r, (cl?.name as string) ?? null); });
  const nowIso = now.toISOString();
  return {
    clients7: c7 ?? 0, clients30: c30 ?? 0, clientsTotal: ct ?? 0, openDeals: open, openSum, wonMonth: won, wonMonthSum: wonSum, lostMonth: lost,
    tasksToday: todayTasks.filter((t) => t.dueAt >= nowIso || t.dueAt.slice(0, 10) === nowIso.slice(0, 10)).length, tasksOverdue: todayTasks.filter((t) => t.dueAt < nowIso && t.dueAt.slice(0, 10) !== nowIso.slice(0, 10)).length,
    funnel: [...funnelM.entries()].map(([stageId, f]) => ({ stageId, ...f })),
    recentLeads: ((inbound ?? []) as Row[]).map((r) => { const cl = (Array.isArray(r.crm_clients) ? r.crm_clients[0] : r.crm_clients) as Row | null; return { clientId: r.client_id as string, name: (cl?.name as string) ?? "—", at: r.created_at as string, dup: !!r.is_dup, sourceId: s(r.source_id) }; }),
    todayTasks,
    recent: ((recent ?? []) as Row[]).map((r) => ({ id: r.id as string, name: r.name as string, updatedAt: r.updated_at as string, ownerId: s(r.owner_id) })),
  };
}

/** Сводка по сделкам для списка клиентов: последняя открытая сделка (этап, сумма) по клиенту. */
export type DealSummary = { id: string; stageId: string | null; amount: number | null; cur: string; title: string; deal: string; closed: "won" | "lost" | null };
/** Открытая сделка клиента (последняя), а если открытых нет — последняя закрытая (успех/отказ) для статуса «Купили»/«Отказ». */
export async function clientDealSummary(ids: string[]): Promise<Record<string, DealSummary>> {
  const c = await crmCtx();
  return dealSummaryFor(c, ids);
}
async function dealSummaryFor(c: Ctx, ids: string[]): Promise<Record<string, DealSummary>> {
  if (!ids.length) return {};
  const { data } = await c.sb.from("crm_deals").select("id, client_id, stage_id, amount, cur, title, deal, updated_at, closed_at, crm_stages(kind)").in("client_id", ids).order("updated_at", { ascending: false });
  const out: Record<string, DealSummary> = {};
  const mk = (d: Row): DealSummary => { const st = (Array.isArray(d.crm_stages) ? d.crm_stages[0] : d.crm_stages) as Row | null; const kind = (st?.kind as string) ?? "open"; return { id: d.id as string, stageId: s(d.stage_id), amount: n(d.amount), cur: (d.cur as string) || "TRY", title: (d.title as string) ?? "", deal: (d.deal as string) || "sale", closed: d.closed_at ? (kind === "won" ? "won" : "lost") : null }; };
  for (const d of (data ?? []) as Row[]) { const k = d.client_id as string; if (!d.closed_at && (!out[k] || out[k].closed)) out[k] = mk(d); else if (!out[k]) out[k] = mk(d); }
  return out;
}

/** Групповые действия над клиентами: ответственный, тег, архив/восстановление. */
export async function bulkClients(ids: string[], patch: { ownerId?: string | null; branchId?: string | null; addTag?: string; removeTag?: string; status?: "active" | "archived" }): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  if (!ids.length) return;
  if (patch.ownerId !== undefined) for (const cid of ids) await reassignFor(c, cid, patch.ownerId);
  if (patch.branchId !== undefined || patch.status) {
    const upd: Record<string, unknown> = {}; if (patch.branchId !== undefined) upd.branch_id = patch.branchId; if (patch.status) upd.status = patch.status;
    const { error } = await c.sb.from("crm_clients").update(upd).in("id", ids); if (error) throw new Error(error.message);
    if (patch.branchId !== undefined) for (const cid of ids) await addEvent(c, { clientId: cid, kind: "transfer", payload: { toBranch: patch.branchId ?? null } });
  }
  if (patch.addTag || patch.removeTag) {
    const { data } = await c.sb.from("crm_clients").select("id, tags").in("id", ids);
    for (const r of (data ?? []) as Row[]) {
      let tags = ((r.tags as string[]) ?? []).slice();
      if (patch.addTag && !tags.includes(patch.addTag)) tags.push(patch.addTag);
      if (patch.removeTag) tags = tags.filter((x) => x !== patch.removeTag);
      await c.sb.from("crm_clients").update({ tags }).eq("id", r.id as string);
    }
  }
}

/** Счётчики для бокового меню: активные клиенты, открытые сделки, невыполненные задачи. */
export async function crmCounts(): Promise<{ clients: number; deals: number; tasks: number }> {
  const c = await crmCtx();
  return countsFor(c);
}
async function countsFor(c: Ctx): Promise<{ clients: number; deals: number; tasks: number }> {
  const [{ count: a }, { count: b }, { count: d }] = await Promise.all([
    c.sb.from("crm_clients").select("id", { count: "exact", head: true }).eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).is("merged_into", null).eq("status", "active"),
    c.sb.from("crm_deals").select("id", { count: "exact", head: true }).eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).is("closed_at", null),
    c.sb.from("crm_tasks").select("id", { count: "exact", head: true }).eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).is("done_at", null),
  ]);
  return { clients: a ?? 0, deals: b ?? 0, tasks: d ?? 0 };
}

// ---------- заявки (0017) ----------
/** Поля заявки: перенесённые миграцией 0017 из «Что ищет» лежат плоско (il/ilces/semts, propType) — сводим к форме реестра (geo). */
function normFields(f: Record<string, unknown> | null | undefined): Record<string, unknown> {
  const o = { ...(f ?? {}) };
  if (!o.geo && o.il) { o.geo = { il: o.il, ilces: (o.ilces as string[]) ?? [], semts: (o.semts as string[]) ?? [] }; delete o.il; delete o.ilces; delete o.semts; }
  return o;
}
function rowBrief(r: Row): RequestBrief { return { id: r.id as string, kind: r.kind as RequestBrief["kind"], status: r.status as RequestStatus, priority: (r.priority as RequestBrief["priority"]) ?? null, fields: normFields(r.fields as Record<string, unknown>) }; }
/** Закрытые поля видят владелец/руководитель и ответственный за клиента или заявку. */
const canSeeClosed = (c: Ctx, reqOwner: string | null, clientOwner: string | null) => c.role !== "agent" || reqOwner === c.me.id || clientOwner === c.me.id;
function rowRequest(c: Ctx, r: Row, clientOwner: string | null): CrmRequest {
  const id = r.id as string;
  let closed: Record<string, unknown> = {};
  if (r.closed_enc && canSeeClosed(c, s(r.owner_id), clientOwner)) { try { closed = JSON.parse(dec(c, "crm_requests", "closed", id, r.closed_enc as string) || "{}"); } catch { closed = {}; } }
  return { id, clientId: r.client_id as string, kind: r.kind as CrmRequest["kind"], status: r.status as RequestStatus, ownerId: s(r.owner_id), branchId: s(r.branch_id), listingId: s(r.listing_id), projectId: s(r.project_id), unitUid: n(r.unit_uid),
    priority: (r.priority as CrmRequest["priority"]) ?? null, deadline: (r.deadline as CrmRequest["deadline"]) ?? null, fields: normFields(r.fields as Record<string, unknown>), closed, createdAt: r.created_at as string, updatedAt: r.updated_at as string, variants: Array.isArray(r.variants) ? (r.variants as ObjRef[]) : [] };
}
async function listRequestsFor(c: Ctx, clientId: string, clientOwner: string | null): Promise<CrmRequest[]> {
  const { data } = await c.sb.from("crm_requests").select("*").eq("client_id", clientId).order("created_at");
  return ((data ?? []) as Row[]).map((r) => rowRequest(c, r, clientOwner));
}
export async function listRequests(clientId: string): Promise<CrmRequest[]> {
  const c = await crmCtx();
  const { data: cl } = await c.sb.from("crm_clients").select("owner_id").eq("id", clientId).maybeSingle();
  return listRequestsFor(c, clientId, s(cl?.owner_id));
}
async function saveRequestFor(c: Ctx, input: RequestInput, id: string | null, silent = false): Promise<string> {
  const rid = id || crypto.randomUUID();
  const allowed = new Set(REQUEST_FIELDS[input.kind].map((f) => f.key));
  const fields: Record<string, unknown> = {}; const closed: Record<string, unknown> = {};
  for (const f of REQUEST_FIELDS[input.kind]) { const v = (f.closed ? input.closed : input.fields)[f.key]; if (v !== undefined && v !== null && v !== "" && !(Array.isArray(v) && !v.length)) (f.closed ? closed : fields)[f.key] = v; }
  void allowed;
  const row = { id: rid, ws_kind: c.ws.kind, ws_id: c.ws.id, client_id: input.clientId, kind: input.kind, status: input.status, owner_id: input.ownerId || c.me.id, branch_id: input.branchId ?? (id ? undefined : c.branchId),
    listing_id: input.listingId, variants: input.variants ?? [], priority: input.priority, deadline: input.deadline, fields, closed_enc: Object.keys(closed).length ? enc(c, "crm_requests", "closed", rid, JSON.stringify(closed)) : null, created_by: id ? undefined : c.me.id };
  const { error } = await c.sb.from("crm_requests").upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);
  // роль клиента по типу заявки
  const { data: cl } = await c.sb.from("crm_clients").select("roles").eq("id", input.clientId).maybeSingle();
  const roles = new Set<string>((cl?.roles as string[]) ?? []); if (!roles.has(ROLE_OF_KIND[input.kind])) { roles.add(ROLE_OF_KIND[input.kind]); await c.sb.from("crm_clients").update({ roles: [...roles] }).eq("id", input.clientId); }
  if (!silent) await addEvent(c, { clientId: input.clientId, kind: "request", payload: { requestKind: input.kind, status: input.status, edit: !!id } });
  return rid;
}
export async function saveRequest(input: RequestInput, id?: string | null): Promise<string> {
  const c = await crmCtx(); assertWrite(c);
  if (id) { // закрытые поля: агент без права их видеть не должен их затирать
    const { data: old } = await c.sb.from("crm_requests").select("owner_id, closed_enc, client_id").eq("id", id).maybeSingle();
    if (old?.closed_enc) { const { data: cl } = await c.sb.from("crm_clients").select("owner_id").eq("id", old.client_id as string).maybeSingle(); if (!canSeeClosed(c, s(old.owner_id), s(cl?.owner_id))) { try { input.closed = JSON.parse(dec(c, "crm_requests", "closed", id, old.closed_enc as string) || "{}"); } catch { /* keep */ } } }
  }
  return saveRequestFor(c, input, id ?? null);
}
export async function setRequestStatus(id: string, status: RequestStatus): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const { data: r } = await c.sb.from("crm_requests").select("client_id, kind").eq("id", id).maybeSingle();
  const { error } = await c.sb.from("crm_requests").update({ status }).eq("id", id);
  if (error) throw new Error(error.message);
  if (r) await addEvent(c, { clientId: r.client_id as string, kind: "request", payload: { requestKind: r.kind, status, edit: true } });
}
export async function deleteRequest(id: string): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const { error } = await c.sb.from("crm_requests").delete().eq("id", id);
  if (error) throw new Error(error.message);
}

// ---------- команда и филиалы (0017; только владелец пространства) ----------
export async function listTeam(): Promise<{ members: CrmMember[]; branches: Branch[] }> {
  const c = await crmCtx();
  const [members, branches] = await Promise.all([membersOf(c.sb, c.ws, c.me), branchesOf(c.sb, c.ws)]);
  return { members, branches };
}
export async function setMember(profileId: string, role: MemberRole, branchId: string | null): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  if (c.role !== "owner") throw new Error("forbidden");
  if (c.ws.kind === "realtor") return;
  const admin = createAdminClient();
  // застройщик: роли CRM owner/agent ↔ роли организации admin/editor (0022); филиал — общий
  const orgRole = c.ws.kind === "developer" ? (role === "owner" ? "admin" : "editor") : role;
  if (profileId === c.me.id && role !== "owner") { // единственный администратор не может снять себя
    const { count } = await admin.from("org_members").select("profile_id", { count: "exact", head: true }).eq("org_kind", c.ws.kind).eq("org_id", c.ws.id).eq("role", c.ws.kind === "developer" ? "admin" : "owner");
    if ((count ?? 0) <= 1) throw new Error("last-owner");
  }
  const { error } = await admin.from("org_members").upsert({ org_kind: c.ws.kind, org_id: c.ws.id, profile_id: profileId, role: orgRole, branch_id: branchId }, { onConflict: "org_kind,org_id,profile_id" });
  if (error) throw new Error(error.message);
  forgetRole(c.ws, profileId);
  await audit(c.sb, c.ws, c.me.id, "member_role", profileId, { role: orgRole, branchId });
}
export async function saveBranch(b: { id?: string; name: string; city: string; headId: string | null }): Promise<Branch[]> {
  const c = await crmCtx(); assertWrite(c);
  if (c.role !== "owner") throw new Error("forbidden");
  const { error } = await c.sb.from("crm_branches").upsert({ id: b.id || crypto.randomUUID(), ws_kind: c.ws.kind, ws_id: c.ws.id, name: b.name.trim(), city: b.city.trim() || null, head_id: b.headId }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return branchesOf(c.sb, c.ws);
}
export async function deleteBranch(id: string): Promise<Branch[]> {
  const c = await crmCtx(); assertWrite(c);
  if (c.role !== "owner") throw new Error("forbidden");
  await c.sb.from("crm_branches").delete().eq("id", id); // клиенты/сотрудники филиала → без филиала (on delete set null)
  return branchesOf(c.sb, c.ws);
}
export async function saveLostReasons(list: string[]): Promise<string[]> {
  const c = await crmCtx(); assertOwner(c);
  if (c.role !== "owner") throw new Error("forbidden");
  const clean = [...new Set(list.map((x) => x.trim()).filter(Boolean))];
  const { error } = await c.sb.from("crm_settings").upsert({ ws_kind: c.ws.kind, ws_id: c.ws.id, lost_reasons: clean }, { onConflict: "ws_kind,ws_id" });
  if (error) throw new Error(error.message);
  return clean;
}

// ---------- быстрые правки из шапки карточки (12.10.2026: статус/приоритет без открытия формы) ----------
export async function patchClient(id: string, patch: { stage?: Client["stage"]; priority?: Client["priority"]; ownerId?: string | null; boardPos?: number | null }): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  if (patch.ownerId !== undefined) await reassignFor(c, id, patch.ownerId);
  const upd: Record<string, unknown> = {}; if (patch.stage) upd.stage = patch.stage; if (patch.priority !== undefined) upd.priority = patch.priority; if (patch.boardPos !== undefined) upd.board_pos = patch.boardPos;
  if (!Object.keys(upd).length) return;
  const { error } = await c.sb.from("crm_clients").update(upd).eq("id", id);
  if (error) throw new Error(error.message);
}

/** Передача клиента другому ответственному ВНУТРИ пространства (12.10.2026, «передать клиента в агентстве»).
 *  Право: ответственный за клиента, администратор агентства, руководитель филиала (в пределах видимости RLS).
 *  Запись — сервисным ключом: политика update проверяет строку после изменения, и риэлтор не мог отдать своего клиента.
 *  Вместе с клиентом переходят его открытые заявки, сделки и невыполненные задачи того же ответственного; получатель получает
 *  уведомление `client_transfer`. */
async function reassignFor(c: Ctx, clientId: string, toId: string | null): Promise<void> {
  const { data: cl } = await c.sb.from("crm_clients").select("id, name, owner_id").eq("id", clientId).maybeSingle(); // видимость по RLS
  if (!cl) throw new Error("not-found");
  const from = (cl.owner_id as string | null) ?? null;
  if (from === toId) return;
  if (from !== c.me.id && c.role === "agent") throw new Error("forbidden");
  if (toId) { const members = await membersOf(c.sb, c.ws, c.me); if (!members.some((m) => m.id === toId)) throw new Error("not-member"); }
  const admin = createAdminClient();
  const { error } = await admin.from("crm_clients").update({ owner_id: toId }).eq("id", clientId).eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id);
  if (error) throw new Error(error.message);
  if (toId) {
    const mine = (t: "crm_requests" | "crm_deals" | "crm_tasks") => { const q = admin.from(t).update({ owner_id: toId }).eq("client_id", clientId); return from ? q.eq("owner_id", from) : q.is("owner_id", null); };
    await mine("crm_requests").eq("status", "active");
    await mine("crm_deals");
    await mine("crm_tasks").is("done_at", null);
  }
  await addEvent(c, { clientId, kind: "transfer", payload: { toOwner: toId, fromOwner: from } });
  if (toId && toId !== c.me.id) await notify([toId], "client_transfer", { name: cl.name as string, from: c.me.name, href: `${c.ws.kind === "developer" ? "/dev/crm" : "/crm"}/c/${clientId}` });
}

/** Краткие данные объектов базы для карточки клиента (заявка/сделка → объект). */
export type ListingBrief = { id: string; no: number | null; title: string; price: number; deal: string; type: string; rooms: string; area: number; gross: number | null; floor: string; il: string | null; ilce: string | null; semt: string | null; cover: string | null; status: string };
export async function listingBriefs(ids: string[]): Promise<Record<string, ListingBrief>> {
  const c = await crmCtx();
  return listingBriefsFor(c, ids);
}
async function listingBriefsFor(c: Ctx, ids: string[]): Promise<Record<string, ListingBrief>> {
  const uuids = [...new Set(ids.filter((x) => /^[0-9a-f-]{36}$/i.test(x)))];
  if (!uuids.length) return {};
  const { data } = await c.sb.from("listings").select("id, short_id, title, price, deal, type, rooms, area, gross_area, floor_n, floors_total, il, ilce, semt, cover_url, status").in("id", uuids);
  const out: Record<string, ListingBrief> = {};
  for (const r of (data ?? []) as Row[]) {
    const t = (r.title as Record<string, string>) ?? {};
    out[r.id as string] = { id: r.id as string, no: n(r.short_id), title: t.RU || t.EN || t.TR || "", price: Number(r.price ?? 0), deal: String(r.deal ?? "sale"), type: String(r.type ?? "flat"), rooms: String(r.rooms ?? ""), area: Number(r.area ?? 0), gross: n(r.gross_area), floor: r.floor_n != null ? `${r.floor_n}${r.floors_total != null ? `/${r.floors_total}` : ""}` : "", il: s(r.il), ilce: s(r.ilce), semt: s(r.semt), cover: s(r.cover_url), status: String(r.status ?? "active") };
  }
  return out;
}

// ---------- контакты по одному (12.10.2026: «Добавить контакт» в карточке — без открытия всей формы) ----------
export async function addContact(clientId: string, c0: { kind: ContactKind; value: string; label: string; isMain?: boolean }): Promise<Contact> {
  const c = await crmCtx(); assertWrite(c);
  const v = c0.value.trim(); if (!v) throw new Error("empty");
  const { count } = await c.sb.from("crm_contacts").select("id", { count: "exact", head: true }).eq("client_id", clientId);
  const id = crypto.randomUUID();
  const row = { id, client_id: clientId, ws_kind: c.ws.kind, ws_id: c.ws.id, kind: c0.kind, value_enc: enc(c, "crm_contacts", "value", id, v), value_hash: hashOf(c, c0.kind, v), label: c0.label.trim() || null, is_main: !!c0.isMain || !count, sort: count ?? 0 };
  const { error } = await c.sb.from("crm_contacts").insert(row);
  if (error) throw new Error(error.message);
  await addEvent(c, { clientId, kind: "contact", payload: { kind: c0.kind, add: true } });
  return { id, kind: c0.kind, value: v, label: row.label, isMain: row.is_main };
}
export async function removeContact(id: string): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const { data: r } = await c.sb.from("crm_contacts").select("client_id, kind").eq("id", id).maybeSingle();
  const { error } = await c.sb.from("crm_contacts").delete().eq("id", id);
  if (error) throw new Error(error.message);
  if (r) await addEvent(c, { clientId: r.client_id as string, kind: "contact", payload: { kind: r.kind, remove: true } });
}

// ---------- перенос клиента другому риэлтору (12.10.2026) ----------
/** Внутри пространства — смена ответственного; в другое пространство — перенос строк с перешифровкой под его ключ
 *  (контакты, заметки, лента, закрытые поля заявок, сырые заявки, доп. данные сделок). Документы остаются в старом
 *  хранилище и не переносятся. Право: ответственный за клиента, владелец/руководитель пространства. */
export async function transferClient(clientId: string, toProfileId: string): Promise<{ moved: boolean }> {
  const c = await crmCtx(); assertWrite(c);
  const { data: cl } = await c.sb.from("crm_clients").select("id, name, owner_id, ws_kind, ws_id").eq("id", clientId).maybeSingle();
  if (!cl) throw new Error("not-found");
  if (cl.owner_id !== c.me.id && c.role === "agent") throw new Error("forbidden");
  const admin = createAdminClient();
  const target = await wsOfProfile(admin, toProfileId);
  const sameWs = target.kind === c.ws.kind && target.id === c.ws.id;
  if (sameWs) { await reassignFor(c, clientId, toProfileId); return { moved: false }; }
  const dek2 = await dekOfAdmin(admin, target, c.me.id);
  const re = (table: string, field: string, id: string | number, v: string | null | undefined) => (v ? encField(dek2, decField(c.dek, v, `${table}.${field}:${id}`), `${table}.${field}:${id}`) : null);
  const wsRow = { ws_kind: target.kind, ws_id: target.id };
  // контакты: значение и хэш под новое пространство
  const { data: cts } = await admin.from("crm_contacts").select("id, kind, value_enc").eq("client_id", clientId);
  for (const x of (cts ?? []) as Row[]) { const plain = decField(c.dek, x.value_enc as string, `crm_contacts.value:${x.id}`); await admin.from("crm_contacts").update({ ...wsRow, value_enc: encField(dek2, plain, `crm_contacts.value:${x.id}`), value_hash: valueHash(target.kind, target.id, x.kind === "whatsapp" ? "phone" : (x.kind as string), normalizeContact(x.kind as string, plain)) }).eq("id", x.id as string); }
  const { data: full } = await admin.from("crm_clients").select("notes_enc").eq("id", clientId).maybeSingle();
  const { error } = await admin.from("crm_clients").update({ ...wsRow, owner_id: toProfileId, branch_id: null, stage: "new", source_id: null, ref_kind: "none", ref_profile_id: null, ref_agency_id: null, ref_client_id: null, notes_enc: re("crm_clients", "notes", clientId, full?.notes_enc as string | null) }).eq("id", clientId);
  if (error) throw new Error(error.message);
  const { data: rq } = await admin.from("crm_requests").select("id, closed_enc").eq("client_id", clientId);
  for (const x of (rq ?? []) as Row[]) await admin.from("crm_requests").update({ ...wsRow, owner_id: toProfileId, branch_id: null, closed_enc: re("crm_requests", "closed", x.id as string, x.closed_enc as string | null) }).eq("id", x.id as string);
  const { data: dl } = await admin.from("crm_deals").select("id, extra_enc").eq("client_id", clientId);
  for (const x of (dl ?? []) as Row[]) await admin.from("crm_deals").update({ ...wsRow, owner_id: toProfileId, branch_id: null, stage_id: null, source_id: null, extra_enc: re("crm_deals", "extra", x.id as string, x.extra_enc as string | null) }).eq("id", x.id as string);
  await admin.from("crm_tasks").update({ ...wsRow, owner_id: toProfileId }).eq("client_id", clientId);
  const { data: ev } = await admin.from("crm_events").select("id, text_enc").eq("client_id", clientId);
  for (const x of (ev ?? []) as Row[]) {
    await admin.from("crm_events").update({ ...wsRow, text_enc: re("crm_events", "text", x.id as number, x.text_enc as string | null) }).eq("id", x.id as number);
    const { data: trs } = await admin.from("crm_event_tr").select("lang, text_enc").eq("event_id", x.id as number);
    for (const tr of (trs ?? []) as Row[]) await admin.from("crm_event_tr").update({ text_enc: re("crm_event_tr", tr.lang as string, x.id as number, tr.text_enc as string | null) }).eq("event_id", x.id as number).eq("lang", tr.lang as string);
  }
  const { data: inb } = await admin.from("crm_inbound").select("id, raw_enc").eq("client_id", clientId);
  for (const x of (inb ?? []) as Row[]) await admin.from("crm_inbound").update({ ...wsRow, raw_enc: re("crm_inbound", "raw", x.id as string, x.raw_enc as string | null) }).eq("id", x.id as string);
  await admin.from("crm_events").insert({ ...wsRow, client_id: clientId, actor_id: c.me.id, kind: "transfer", payload: { fromWs: c.ws.id, fromOwner: cl.owner_id, toOwner: toProfileId } });
  await audit(c.sb, c.ws, c.me.id, "transfer_out", clientId, { to: toProfileId });
  await audit(admin, target, c.me.id, "transfer_in", clientId, { from: c.me.id });
  await notify([toProfileId], "client_transfer", { name: cl.name as string, from: c.me.name, href: `${target.kind === "developer" ? "/dev/crm" : "/crm"}/c/${clientId}` });
  return { moved: true };
}

// ---------- объекты в CRM (0024, 12.10.2026): из базы или свободно ----------
/** Поиск объявлений для привязки к сделке/заявке (риэлтор, агентство). Пусто + scope: «мои» / «избранное» / недавние;
 *  с текстом: № объявления (цифры), заголовок на любом языке, район/махалле. Не больше 30 строк — при тысяче объектов
 *  список без поиска бесполезен (замечание пользователя). */
export async function searchListings(q: string, scope: "mine" | "favs" | "all" = "all"): Promise<ListingBrief[]> {
  const c = await crmCtx();
  const text = q.trim();
  let qb = c.sb.from("listings").select("id, short_id, title, price, deal, type, rooms, area, gross_area, floor_n, floors_total, il, ilce, semt, cover_url, status, updated_at").limit(30).order("updated_at", { ascending: false });
  if (scope === "mine") qb = qb.eq("owner_id", c.me.id);
  if (scope === "favs") {
    const { data: f } = await c.sb.from("favorites").select("listing_id").eq("user_id", c.me.id);
    const ids = (f ?? []).map((x) => x.listing_id as string);
    if (!ids.length) return [];
    qb = qb.in("id", ids);
  }
  const no = text.match(/^(?:op-?)?(\d+)$/i);
  if (no) qb = qb.eq("short_id", Number(no[1]));
  else if (text) { const like = `%${text.replace(/[%_]/g, "")}%`; qb = qb.or(`title->>RU.ilike.${like},title->>EN.ilike.${like},title->>TR.ilike.${like},il.ilike.${like},ilce.ilike.${like},semt.ilike.${like}`); }
  // без текста «вся база» = последние объявления всей базы (12.10.2026: раньше подставлялись свои — путало)
  const { data } = await qb;
  return ((data ?? []) as Row[]).map(rowListingBrief);
}
function rowListingBrief(r: Row): ListingBrief {
  const t = (r.title as Record<string, string>) ?? {};
  return { id: r.id as string, no: n(r.short_id), title: t.RU || t.EN || t.TR || "", price: Number(r.price ?? 0), deal: String(r.deal ?? "sale"), type: String(r.type ?? "flat"), rooms: String(r.rooms ?? ""), area: Number(r.area ?? 0), gross: n(r.gross_area), floor: r.floor_n != null ? `${r.floor_n}/${r.floors_total ?? "—"}` : "", il: s(r.il), ilce: s(r.ilce), semt: s(r.semt), cover: s(r.cover_url), status: String(r.status ?? "active") };
}

type DevUnitRow = { uid: number; num: string | number; floor: number; wing?: string; type: string; area: number; price: number; status: string };
const SPECIAL = new Set(["sosyal", "otopark", "teknik", ""]);
function unitBrief(pid: number, pname: string, cur: string, u: DevUnitRow): UnitBrief {
  return { projectId: pid, projectName: pname, uid: u.uid, num: String(u.num ?? ""), wing: u.wing ?? null, floor: Number(u.floor ?? 0), type: String(u.type ?? ""), area: Number(u.area ?? 0), price: Number(u.price ?? 0), cur, status: String(u.status ?? "free") };
}
/** Квартиры компании-застройщика: проекты для выбора и помещения по фильтру (проект, корпус, текст — номер/тип). */
export async function searchUnits(q: string, opts: { projectId?: number | null; wing?: string | null; onlyFree?: boolean } = {}): Promise<{ projects: { id: number; name: string; wings: string[] }[]; units: UnitBrief[] }> {
  const c = await crmCtx();
  if (c.ws.kind !== "developer") return { projects: [], units: [] };
  const { data } = await c.sb.from("dev_objects").select("id, data, units").eq("developer_id", c.ws.id);
  const rows = ((data ?? []) as Row[]).map((r) => ({ id: Number(r.id), data: (r.data as Record<string, unknown>) ?? {}, units: (Array.isArray(r.units) ? r.units : []) as DevUnitRow[] }));
  const projects = rows.map((r) => ({ id: r.id, name: String(r.data.name ?? r.id), wings: [...new Set(r.units.map((u) => u.wing ?? "").filter(Boolean))].sort() })).sort((a, b) => a.name.localeCompare(b.name));
  const text = q.trim().toLowerCase();
  const units: UnitBrief[] = [];
  for (const r of rows) {
    if (opts.projectId && r.id !== opts.projectId) continue;
    const cur = String(r.data.pricesIn ?? r.data.cur ?? "EUR");
    for (const u of r.units) {
      if (SPECIAL.has(String(u.type ?? ""))) continue;
      if (opts.wing && (u.wing ?? "") !== opts.wing) continue;
      if (opts.onlyFree && u.status !== "free") continue;
      if (text && !`${u.num} ${u.type} ${u.wing ?? ""} ${String(r.data.name ?? "")}`.toLowerCase().includes(text)) continue;
      units.push(unitBrief(r.id, String(r.data.name ?? r.id), cur, u));
      if (units.length >= 300) break;
    }
  }
  units.sort((a, b) => a.projectName.localeCompare(b.projectName) || (a.wing ?? "").localeCompare(b.wing ?? "") || a.floor - b.floor || a.num.localeCompare(b.num, undefined, { numeric: true }));
  return { projects, units };
}
async function unitBriefsFor(c: Ctx, refs: { projectId: number; unitUid: number }[]): Promise<Record<string, UnitBrief>> {
  const out: Record<string, UnitBrief> = {};
  if (!refs.length) return out;
  const ids = [...new Set(refs.map((x) => x.projectId))];
  const { data } = await c.sb.from("dev_objects").select("id, data, units").in("id", ids);
  for (const r of (data ?? []) as Row[]) {
    const pid = Number(r.id); const d = (r.data as Record<string, unknown>) ?? {}; const cur = String(d.pricesIn ?? d.cur ?? "EUR");
    for (const ref of refs.filter((x) => x.projectId === pid)) {
      const u = ((Array.isArray(r.units) ? r.units : []) as DevUnitRow[]).find((x) => x.uid === ref.unitUid);
      if (u) out[unitKey(pid, ref.unitUid)] = unitBrief(pid, String(d.name ?? pid), cur, u);
    }
  }
  return out;
}

/** Сделка закрыта успешно → объект снимается с продажи (решение пользователя 12.10.2026): объявление → «продано»
 *  (аренда → «снято»), квартира застройщика → «продана» в шахматке. Объявление коллеги по агентству — сервисным ключом после
 *  проверки, что владелец в команде. Возвращает, что изменилось (для подсказки и локального стора). */
export async function closeDealObject(dealId: string): Promise<{ listing?: { id: string; status: string }; unit?: { projectId: number; unitUid: number } }> {
  const c = await crmCtx(); assertWrite(c);
  const { data: d } = await c.sb.from("crm_deals").select("client_id, listing_id, project_id, unit_uid, deal").eq("id", dealId).maybeSingle();
  if (!d) throw new Error("not-found");
  const out: { listing?: { id: string; status: string }; unit?: { projectId: number; unitUid: number } } = {};
  if (d.listing_id) {
    const status = String(d.deal).startsWith("rent") ? "off" : "sold";
    const { data: l } = await c.sb.from("listings").select("id, owner_id").eq("id", d.listing_id as string).maybeSingle();
    if (l) {
      const members = await membersOf(c.sb, c.ws, c.me);
      if (l.owner_id === c.me.id) { const { error } = await c.sb.from("listings").update({ status, updated_at: new Date().toISOString() }).eq("id", l.id as string); if (error) throw new Error(error.message); out.listing = { id: l.id as string, status }; }
      else if (members.some((m) => m.id === l.owner_id)) { const { error } = await createAdminClient().from("listings").update({ status, updated_at: new Date().toISOString() }).eq("id", l.id as string); if (error) throw new Error(error.message); out.listing = { id: l.id as string, status }; }
    }
  }
  if (d.project_id && d.unit_uid != null && c.ws.kind === "developer") {
    const pid = Number(d.project_id);
    const { data: o } = await c.sb.from("dev_objects").select("id, units, developer_id").eq("id", pid).maybeSingle();
    if (o && o.developer_id === c.ws.id) {
      const units = ((Array.isArray(o.units) ? o.units : []) as DevUnitRow[]).map((u) => (u.uid === d.unit_uid ? { ...u, status: "sold" } : u));
      const { error } = await c.sb.from("dev_objects").update({ units, updated_at: new Date().toISOString(), updated_by: c.me.id }).eq("id", pid);
      if (error) throw new Error(error.message);
      out.unit = { projectId: pid, unitUid: d.unit_uid as number };
    }
  }
  if (out.listing || out.unit) await addEvent(c, { clientId: d.client_id as string, dealId, kind: "object_closed", payload: { listingId: out.listing?.id ?? null, status: out.listing?.status ?? null, projectId: out.unit?.projectId ?? null, unitUid: out.unit?.unitUid ?? null } });
  return out;
}

// ---------- карточка сделки (13.10.2026): одна страница как у клиента ----------
export async function getDeal(id: string): Promise<{ deal: Deal; client: { id: string; no: number; name: string; phone: string | null; lang: string }; events: CrmEvent[]; tasks: Task[]; objs: Record<string, ListingBrief>; units: Record<string, UnitBrief>; requests: { id: string; label: string }[] } | null> {
  const c = await crmCtx();
  const { data: r } = await c.sb.from("crm_deals").select("*, crm_clients!crm_deals_client_id_fkey(id, no, name, lang)").eq("id", id).maybeSingle();
  if (!r) return null;
  const cl = (Array.isArray(r.crm_clients) ? r.crm_clients[0] : r.crm_clients) as Row | null;
  if (!cl) return null;
  const { data: seller } = r.seller_client_id ? await c.sb.from("crm_clients").select("name").eq("id", r.seller_client_id as string).maybeSingle() : { data: null };
  const deal = rowDeal(r as Row, String(cl.name ?? ""), (seller?.name as string | undefined) ?? null);
  const [{ data: cts }, events, tasks, { data: rq }] = await Promise.all([
    c.sb.from("crm_contacts").select("*").eq("client_id", cl.id as string).order("is_main", { ascending: false }).order("sort"),
    loadEvents(c, { dealId: id }), listTasksFor(c, { dealId: id }),
    c.sb.from("crm_requests").select("id, kind, fields, status").eq("client_id", cl.id as string).order("created_at"),
  ]);
  const phone = ((cts ?? []) as Row[]).map((x) => rowContact(c, x)).find((x) => x.kind === "phone" || x.kind === "whatsapp")?.value ?? null;
  const ref = deal.projectId && deal.unitUid != null ? [{ projectId: Number(deal.projectId), unitUid: deal.unitUid }] : [];
  const [objs, units] = await Promise.all([listingBriefsFor(c, deal.listingId ? [deal.listingId] : []), unitBriefsFor(c, ref)]);
  const requests = ((rq ?? []) as Row[]).map((x) => ({ id: x.id as string, label: `${x.kind}${x.status === "active" ? "" : ` (${x.status})`}` }));
  await audit(c.sb, c.ws, c.me.id, "view_deal", id, {});
  return { deal, client: { id: cl.id as string, no: Number(cl.no ?? 0), name: String(cl.name ?? ""), phone, lang: String(cl.lang ?? "RU") }, events, tasks, objs, units, requests };
}
/** Ответственный за сделку (шапка карточки сделки). */
export async function patchDealOwner(id: string, ownerId: string | null): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const { error } = await c.sb.from("crm_deals").update({ owner_id: ownerId }).eq("id", id);
  if (error) throw new Error(error.message);
}
