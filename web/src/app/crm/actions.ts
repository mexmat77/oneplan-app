"use server";

// Серверные экшены CRM. Все чтения/записи — сессионным клиентом (RLS), шифрование/расшифровка контактов и заметок —
// здесь, на сервере (ключ в .env). В браузер уходят уже расшифрованные значения только тех записей, что разрешены RLS.
import { translate } from "@/app/(dev)/dev/chat/actions";
import type { Lang } from "@/i18n";
import { assertWrite, audit, crmCtx, dec, enc, hashOf, membersOf, type Ctx } from "@/lib/crm/server";
import { newSourceToken } from "@/lib/crm/crypto";
import type { Client, ClientInput, Contact, ContactKind, CrmEvent, CrmMe, Deal, DealInput, DupHit, EventKind, Source, Stage, Task, TaskInput, Want } from "@/lib/crm/types";

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));
const n = (v: unknown) => (v == null || v === "" ? null : Number(v));

// ---------- bootstrap ----------
export async function crmBootstrap(): Promise<{ me: CrmMe; stages: Stage[]; sources: Source[] }> {
  const c = await crmCtx();
  const [members, stages, sources] = await Promise.all([membersOf(c.sb, c.ws, c.me), loadStages(c), loadSources(c)]);
  return { me: { ws: c.ws, access: c.access, trialUntil: c.trialUntil, paidTo: c.paidTo, isAdmin: c.isAdmin, meId: c.me.id, members }, stages, sources };
}
async function loadStages(c: Ctx): Promise<Stage[]> {
  const { data } = await c.sb.from("crm_stages").select("*").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).order("sort");
  return (data ?? []).map((r: Row) => ({ id: r.id as string, key: r.key as string, name: (r.name as Record<Lang, string>) ?? {}, kind: r.kind as Stage["kind"], color: s(r.color), sort: r.sort as number }));
}
async function loadSources(c: Ctx): Promise<Source[]> {
  const { data } = await c.sb.from("crm_sources").select("id, name, kind, active, sort, token_hash").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).order("sort");
  return (data ?? []).map((r: Row) => ({ id: r.id as string, name: r.name as string, kind: r.kind as Source["kind"], active: !!r.active, sort: r.sort as number, hasToken: !!r.token_hash }));
}

// ---------- клиенты ----------
function rowClient(c: Ctx, r: Row, contacts: Contact[], dealsN: number, openN: number, nextTask: Client["nextTask"]): Client {
  const id = r.id as string;
  return {
    id, ownerId: s(r.owner_id), name: r.name as string, lang: (r.lang as Lang) || "RU", sourceId: s(r.source_id),
    refKind: (r.ref_kind as Client["refKind"]) || "none", refProfileId: s(r.ref_profile_id), refAgencyId: s(r.ref_agency_id), refText: s(r.ref_text),
    budgetMin: n(r.budget_min), budgetMax: n(r.budget_max), cur: (r.cur as string) || "TRY", want: (r.want as Want) ?? {},
    notes: dec(c, "crm_clients", "notes", id, r.notes_enc as string | null), tags: (r.tags as string[]) ?? [], consent: !!r.consent, consentAt: s(r.consent_at),
    status: r.status as Client["status"], createdAt: r.created_at as string, updatedAt: r.updated_at as string,
    contacts, dealsN, openDealsN: openN, nextTask,
  };
}
function rowContact(c: Ctx, r: Row): Contact {
  const id = r.id as string;
  return { id, kind: r.kind as ContactKind, value: dec(c, "crm_contacts", "value", id, r.value_enc as string), label: s(r.label), isMain: !!r.is_main };
}

export async function listClients(opts: { q?: string; status?: "active" | "archived"; ownerId?: string | null } = {}): Promise<Client[]> {
  const c = await crmCtx();
  let q = c.sb.from("crm_clients").select("*").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).is("merged_into", null).eq("status", opts.status ?? "active").order("updated_at", { ascending: false }).limit(500);
  if (opts.ownerId) q = q.eq("owner_id", opts.ownerId);
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
    rows = rows.filter((r) => (r.name as string).toLowerCase().includes(low) || hitIds.has(r.id as string));
  }
  const ids = rows.map((r) => r.id as string);
  if (!ids.length) return [];
  const [{ data: cts }, { data: deals }, { data: tasks }] = await Promise.all([
    c.sb.from("crm_contacts").select("*").in("client_id", ids).order("is_main", { ascending: false }).order("sort"),
    c.sb.from("crm_deals").select("client_id, closed_at").in("client_id", ids),
    c.sb.from("crm_tasks").select("id, client_id, title, due_at, kind").in("client_id", ids).is("done_at", null).order("due_at"),
  ]);
  const byClient = <T extends Row>(list: T[] | null) => { const m = new Map<string, T[]>(); (list ?? []).forEach((x) => { const k = x.client_id as string; m.set(k, [...(m.get(k) ?? []), x]); }); return m; };
  const cm = byClient(cts as Row[] | null), dm = byClient(deals as Row[] | null), tm = byClient(tasks as Row[] | null);
  return rows.map((r) => {
    const id = r.id as string;
    const ds = dm.get(id) ?? [];
    const t0 = (tm.get(id) ?? [])[0];
    return rowClient(c, r, (cm.get(id) ?? []).map((x) => rowContact(c, x)), ds.length, ds.filter((d) => !d.closed_at).length,
      t0 ? { id: t0.id as string, title: t0.title as string, dueAt: t0.due_at as string, kind: t0.kind as Task["kind"] } : null);
  });
}

export async function getClient(id: string): Promise<{ client: Client; deals: Deal[]; tasks: Task[]; events: CrmEvent[] } | null> {
  const c = await crmCtx();
  const { data: r } = await c.sb.from("crm_clients").select("*").eq("id", id).maybeSingle();
  if (!r) return null;
  const [{ data: cts }, deals, tasks, events] = await Promise.all([
    c.sb.from("crm_contacts").select("*").eq("client_id", id).order("is_main", { ascending: false }).order("sort"),
    listDealsFor(c, { clientId: id }), listTasksFor(c, { clientId: id }), loadEvents(c, { clientId: id }),
  ]);
  await audit(c.sb, c.ws, c.me.id, "view_client", id, {});
  const open = deals.filter((d) => !d.closedAt).length;
  const t0 = tasks.find((t) => !t.doneAt);
  return { client: rowClient(c, r as Row, ((cts ?? []) as Row[]).map((x) => rowContact(c, x)), deals.length, open, t0 ? { id: t0.id, title: t0.title, dueAt: t0.dueAt, kind: t0.kind } : null), deals, tasks, events };
}

/** Дубли по контактам (телефон/e-mail) среди клиентов ws. */
export async function findDups(contacts: { kind: ContactKind; value: string }[], excludeId?: string | null): Promise<DupHit[]> {
  const c = await crmCtx();
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
  const row = {
    id: cid, ws_kind: c.ws.kind, ws_id: c.ws.id, owner_id: input.ownerId || c.me.id, name: input.name.trim(), lang: input.lang, source_id: input.sourceId,
    ref_kind: input.refKind, ref_profile_id: input.refKind === "realtor" ? input.refProfileId : null, ref_agency_id: input.refKind === "agency" ? input.refAgencyId : null,
    ref_text: input.refKind === "text" ? input.refText.trim() || null : null,
    budget_min: input.budgetMin, budget_max: input.budgetMax, cur: input.cur || "TRY", want: input.want ?? {},
    notes_enc: enc(c, "crm_clients", "notes", cid, input.notes.trim()), tags: input.tags, consent: input.consent,
    consent_at: input.consent ? new Date().toISOString() : null,
    created_by: id ? undefined : c.me.id,
  };
  const { error } = await c.sb.from("crm_clients").upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);
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

// ---------- сделки ----------
function rowDeal(r: Row, clientName: string): Deal {
  return { id: r.id as string, clientId: r.client_id as string, clientName, ownerId: s(r.owner_id), stageId: s(r.stage_id), title: (r.title as string) ?? "", deal: (r.deal as string) || "sale", amount: n(r.amount), cur: (r.cur as string) || "TRY", listingId: s(r.listing_id), projectId: s(r.project_id), unitUid: n(r.unit_uid), selectionId: s(r.selection_id), sourceId: s(r.source_id), lostReason: s(r.lost_reason), closedAt: s(r.closed_at), createdAt: r.created_at as string, updatedAt: r.updated_at as string };
}
async function listDealsFor(c: Ctx, f: { clientId?: string }): Promise<Deal[]> {
  let q = c.sb.from("crm_deals").select("*, crm_clients(name)").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).order("updated_at", { ascending: false }).limit(1000);
  if (f.clientId) q = q.eq("client_id", f.clientId);
  const { data } = await q;
  return ((data ?? []) as Row[]).map((r) => { const cl = (Array.isArray(r.crm_clients) ? r.crm_clients[0] : r.crm_clients) as Row | null; return rowDeal(r, (cl?.name as string) ?? ""); });
}
export async function listDeals(): Promise<Deal[]> { const c = await crmCtx(); return listDealsFor(c, {}); }
export async function saveDeal(input: DealInput, id?: string | null): Promise<string> {
  const c = await crmCtx(); assertWrite(c);
  const did = id || crypto.randomUUID();
  const row = { id: did, ws_kind: c.ws.kind, ws_id: c.ws.id, client_id: input.clientId, owner_id: input.ownerId || c.me.id, stage_id: input.stageId, title: input.title.trim(), deal: input.deal, amount: input.amount, cur: input.cur || "TRY", listing_id: input.listingId, project_id: input.projectId, unit_uid: input.unitUid, selection_id: input.selectionId, source_id: input.sourceId, created_by: id ? undefined : c.me.id };
  const { error } = await c.sb.from("crm_deals").upsert(row, { onConflict: "id" });
  if (error) throw new Error(error.message);
  if (!id) await addEvent(c, { clientId: input.clientId, dealId: did, kind: "deal", payload: { title: row.title } });
  return did;
}
export async function moveDeal(id: string, stageId: string, lostReason?: string): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const [{ data: d }, { data: st }] = await Promise.all([c.sb.from("crm_deals").select("client_id, stage_id").eq("id", id).maybeSingle(), c.sb.from("crm_stages").select("key, kind").eq("id", stageId).maybeSingle()]);
  if (!d || !st) throw new Error("not-found");
  const closed = st.kind === "open" ? null : new Date().toISOString();
  const { error } = await c.sb.from("crm_deals").update({ stage_id: stageId, closed_at: closed, lost_reason: st.kind === "lost" ? lostReason ?? null : null }).eq("id", id);
  if (error) throw new Error(error.message);
  await addEvent(c, { clientId: d.client_id as string, dealId: id, kind: "stage", payload: { from: d.stage_id, to: stageId, key: st.key } });
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
async function listTasksFor(c: Ctx, f: { clientId?: string; open?: boolean }): Promise<Task[]> {
  let q = c.sb.from("crm_tasks").select("*, crm_clients(name)").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).order("due_at").limit(500);
  if (f.clientId) q = q.eq("client_id", f.clientId);
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
export async function saveStages(stages: { id?: string; key: string; name: Record<string, string>; kind: Stage["kind"]; color: string | null }[]): Promise<Stage[]> {
  const c = await crmCtx(); assertWrite(c);
  const rows = stages.map((x, i) => ({ id: x.id || crypto.randomUUID(), ws_kind: c.ws.kind, ws_id: c.ws.id, key: x.key || `s${i}`, name: x.name, kind: x.kind, color: x.color, sort: i }));
  const { error } = await c.sb.from("crm_stages").upsert(rows, { onConflict: "id" });
  if (error) throw new Error(error.message);
  const ids = rows.map((r) => r.id);
  const { data: old } = await c.sb.from("crm_stages").select("id").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id);
  const gone = (old ?? []).map((o) => o.id as string).filter((x) => !ids.includes(x));
  if (gone.length) await c.sb.from("crm_stages").delete().in("id", gone); // сделки на удалённом этапе → stage_id null
  return loadStages(c);
}
export async function saveSource(src: { id?: string; name: string; kind: Source["kind"]; active: boolean }): Promise<Source[]> {
  const c = await crmCtx(); assertWrite(c);
  const { error } = await c.sb.from("crm_sources").upsert({ id: src.id || crypto.randomUUID(), ws_kind: c.ws.kind, ws_id: c.ws.id, name: src.name.trim(), kind: src.kind, active: src.active }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return loadSources(c);
}
export async function deleteSource(id: string): Promise<Source[]> {
  const c = await crmCtx(); assertWrite(c);
  await c.sb.from("crm_sources").delete().eq("id", id);
  return loadSources(c);
}
/** Токен для внешнего сайта (показывается один раз). */
export async function issueSourceToken(id: string): Promise<string> {
  const c = await crmCtx(); assertWrite(c);
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
  const lines = [["name", "lang", "phones", "emails", "budget_min", "budget_max", "cur", "tags", "notes", "created_at"].join(";")];
  for (const cl of list) {
    lines.push([cl.name, cl.lang, cl.contacts.filter((x) => x.kind === "phone" || x.kind === "whatsapp").map((x) => x.value).join(" / "), cl.contacts.filter((x) => x.kind === "email").map((x) => x.value).join(" / "), String(cl.budgetMin ?? ""), String(cl.budgetMax ?? ""), cl.cur, cl.tags.join(", "), cl.notes, cl.createdAt].map(esc).join(";"));
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
