"use client";

// Синхронизация кабинета риэлтора с Supabase (миграции 0001 + 0012): объявления, избранное, подборки, сохранённые поиски,
// запросы базы и профили коллег. Сторы остаются прежними (экраны их не замечают): при входе (`startRealtorSync`) этот модуль
//   • грузит данные и кладёт их в сторы (база — источник истины; демо-каталог прототипа остаётся рядом);
//   • локальные объявления, созданные до переезда, один раз выгружает в базу (фото — в Storage) и очищает localStorage;
//   • каждое изменение сторов пишет в базу сразу (optimistic UI: стор меняется до ответа; при ошибке — toast);
//   • при возврате на вкладку перечитывает объявления и запросы (изменения коллег).
// Без сессии (демо-режим) ничего не делает — сторы работают на localStorage, как раньше.
import { showToast } from "@/components/ui/toast";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import { uploadPhotos } from "@/lib/photos";
import { grossArea, type Listing, type ListingStatus, type Realtor } from "@/lib/types";
import { clearLocalListings, getLocalListings, keepLocalCopy, markRemoteLoaded, seedExpMap, setListingWriteHook, setRemoteListings, getRemoteListings } from "./listings";
import { seedFavs, setFavHook } from "./prefs";
import { seedSelections, setSelectionHook, slugOf, type Selection } from "./selections";
import { seedReqs, setReqHook, type BaseRequest, type SavedSearch } from "./reqs";
import { setRealtors } from "./realtors";

type Sb = ReturnType<typeof createClient>;
let sb: Sb | null = null;
let me = "";
let started = false;

// ---------- объявления: строка ↔ Listing ----------
type ListingRow = {
  id: string; owner_id: string; status: ListingStatus; price: number | string; photos: string[] | null; cover_url: string | null;
  exports: Record<string, boolean> | null; data: Listing; updated_at: string; short_id?: number | null;
};
const num = (v: unknown) => (typeof v === "number" ? v : parseFloat(String(v ?? 0)) || 0);
function rowToListing(r: ListingRow): Listing {
  const d = r.data ?? ({} as Listing);
  const photos = r.photos?.length ? r.photos : d.photos ?? [];
  return { ...d, id: r.id, owner: r.owner_id, st: r.status ?? d.st, price: num(r.price) || d.price, photos, img: r.cover_url || photos[0] || d.img, no: r.short_id ?? d.no };
}
function listingToRow(o: Listing) {
  return {
    id: o.id, owner_id: me, title: o.t, description: o.desc, base_lang: o.base, deal: o.deal, type: o.type, status: o.st, badge: o.badge ?? null,
    price: Math.round(o.price), rooms: o.rooms, area: Math.round(o.area), gross_area: grossArea(o), floor_n: o.floorN || null, floors_total: o.floorsTotal || null,
    il: o.il ?? null, ilce: o.ilce ?? null, semt: o.semt ?? null, loc: o.loc, lat: o.ll?.[0] ?? null, lng: o.ll?.[1] ?? null, cover_url: o.photos[0] ?? o.img ?? null,
    comm: o.comm ?? 0, furn: !!o.furn, feats: o.feats ?? [], vnj: !!o.vnj, cit: !!o.cit, cur: o.cur ?? "TRY", photos: o.photos, data: o, relisted_from: o.relistedFrom ?? null, updated_at: new Date().toISOString(),
  };
}
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

async function upsertListing(o: Listing): Promise<boolean> {
  if (!sb) return false;
  let full = { ...o, owner: me };
  try {
    const photos = await uploadPhotos(me, o.id, o.photos ?? []); // data:-URL → Storage, остальное как есть
    full = { ...full, photos, img: photos[0] ?? o.img }; // запасная копия хранит уже загруженные URL — без повторной загрузки фото
    const { error } = await sb.from("listings").upsert(listingToRow(full), { onConflict: "id" });
    if (error) throw new Error(error.message);
    const cur = getRemoteListings().list;
    setRemoteListings(cur.some((x) => x.id === o.id) ? cur.map((x) => (x.id === o.id ? full : x)) : [full, ...cur]);
    return true;
  } catch (e) { console.warn("[realtor sync] upsert:", (e as Error).message); keepLocalCopy(full); showToast("Не удалось сохранить в базу, объявление сохранено в браузере: " + (e as Error).message); return false; }
}

async function loadListings() {
  if (!sb) return;
  const { data, error } = await sb.from("listings").select("id, owner_id, status, price, photos, cover_url, exports, data, updated_at, short_id").order("created_at", { ascending: false });
  if (error) { console.warn("[realtor sync] listings:", error.message); markRemoteLoaded(); return; }
  const rows = (data ?? []) as ListingRow[];
  setRemoteListings(rows.map(rowToListing), true);
  const exp: Record<string, Record<string, boolean>> = {};
  rows.forEach((r) => { if (r.exports && Object.keys(r.exports).length) exp[r.id] = r.exports; });
  if (Object.keys(exp).length) seedExpMap(exp);
}

/** Локальные объявления (созданные до переезда или без сети) → в базу, затем localStorage очищается. */
async function migrateLocal() {
  const local = getLocalListings();
  if (!local.length) return;
  const have = new Set(getRemoteListings().list.map((x) => x.id));
  let ok = true;
  for (const o of local) {
    if (have.has(o.id)) continue;
    const id = isUuid(o.id) ? o.id : crypto.randomUUID();
    if (!(await upsertListing({ ...o, id, owner: me }))) ok = false;
  }
  if (ok) clearLocalListings();
}

// ---------- профили коллег ----------
type ProfRow = { id: string; name: string; color: string | null; phone: string | null; city: string | null; langs: string | null; agency_text: string | null; last_seen: string | null; agencies: { name: string } | { name: string }[] | null };
async function loadProfiles() {
  if (!sb) return;
  const { data, error } = await sb.from("profiles").select("id, name, color, phone, city, langs, agency_text, last_seen, agencies(name)").eq("status", "active");
  if (error) { console.warn("[realtor sync] profiles:", error.message); return; }
  const now = Date.now();
  setRealtors(((data ?? []) as ProfRow[]).map((p): Realtor => {
    const ag = Array.isArray(p.agencies) ? p.agencies[0]?.name : p.agencies?.name;
    const city = p.city ?? "";
    return { id: p.id, name: p.name || "—", ag: ag || p.agency_text || "—", color: p.color || "#4d7cfe", phone: p.phone ?? "", city: { RU: city, EN: city, TR: city }, langs: p.langs ?? "", online: !!p.last_seen && now - Date.parse(p.last_seen) < 5 * 60 * 1000, objs: 0, sels: 0, likes: 0, la: { RU: "", EN: "", TR: "" } };
  }));
}

// ---------- избранное ----------
async function loadFavs() {
  if (!sb) return;
  const { data } = await sb.from("favorites").select("listing_id").eq("user_id", me);
  seedFavs((data ?? []).map((r) => r.listing_id as string));
}

// ---------- подборки ----------
type SelRow = { id: string; slug: string; title: string; client_name: string | null; note: string | null; status: Selection["status"]; views: number; created_at: string; updated_at: string };
type SelItem = { selection_id: string; listing_id: string; comment: string | null; sort: number; reaction: Selection["reacts"][string] | null };
async function loadSelections() {
  if (!sb) return;
  const [{ data: rows }, { data: items }] = await Promise.all([sb.from("selections").select("*").eq("owner_id", me).order("created_at", { ascending: false }), sb.from("selection_items").select("*")]);
  const byId: Record<string, SelItem[]> = {};
  ((items ?? []) as SelItem[]).forEach((it) => (byId[it.selection_id] ??= []).push(it));
  seedSelections(((rows ?? []) as SelRow[]).map((r) => {
    const its = (byId[r.id] ?? []).sort((a, b) => a.sort - b.sort);
    const reacts: Selection["reacts"] = {}; const cm: Record<string, string> = {};
    its.forEach((it) => { if (it.reaction) reacts[it.listing_id] = it.reaction; if (it.comment) cm[it.listing_id] = it.comment; });
    return { id: r.id, slug: r.slug || slugOf(r.id), title: r.title, name: r.client_name ?? "—", note: r.note ?? "", items: its.map((it) => it.listing_id), cm, status: r.status, views: r.views, reacts, createdAt: r.created_at, updatedAt: r.updated_at };
  }));
}
async function upsertSelection(s: Selection) {
  if (!sb) return;
  const { error } = await sb.from("selections").upsert({ id: s.id, slug: s.slug, owner_id: me, title: s.title, client_name: s.name, note: s.note, status: s.status, views: s.views, updated_at: new Date().toISOString() }, { onConflict: "id" });
  if (error) { showToast("Подборка не сохранена: " + error.message); return; }
  await sb.from("selection_items").delete().eq("selection_id", s.id);
  if (s.items.length) {
    const { error: e2 } = await sb.from("selection_items").insert(s.items.map((lid, i) => ({ selection_id: s.id, listing_id: lid, comment: s.cm[lid] ?? null, sort: i, reaction: s.reacts[lid] ?? null })));
    if (e2) showToast("Состав подборки не сохранён: " + e2.message);
  }
}

// ---------- сохранённые поиски и запросы ----------
type SearchRow = { id: string; name: string; params: SavedSearch["params"]; new_n: number; published: boolean; created_at: string };
type ReqRow = { id: string; by_id: string; deal: BaseRequest["deal"]; type: BaseRequest["type"]; rooms: string | null; il: string | null; geo: string | null; max_price: number | string | null; feat_keys: string[]; comment: BaseRequest["c"]; expires_at: string; created_at: string; from_search: string | null };
async function loadReqs() {
  if (!sb) return;
  const [{ data: ss }, { data: rr }, { data: rp }] = await Promise.all([
    sb.from("saved_searches").select("*").eq("owner_id", me).order("created_at", { ascending: false }),
    sb.from("requests").select("*").gt("expires_at", new Date().toISOString()).order("created_at", { ascending: false }),
    sb.from("request_replies").select("request_id, listing_id").eq("by_id", me),
  ]);
  const searches: SavedSearch[] = ((ss ?? []) as SearchRow[]).map((r) => ({ id: r.id, name: r.name, params: r.params, newN: r.new_n ?? 0, published: !!r.published, createdAt: r.created_at }));
  const reqs: BaseRequest[] = ((rr ?? []) as ReqRow[]).map((r) => ({ id: r.id, by: r.by_id, deal: r.deal, type: r.type, rooms: r.rooms ?? "", il: r.il ?? "", geo: r.geo ?? "", max: num(r.max_price), days: Math.max(0, Math.ceil((Date.parse(r.expires_at) - Date.now()) / 86400000)), featKeys: r.feat_keys ?? [], c: r.comment ?? { RU: "", EN: "", TR: "" }, fromSearch: r.from_search ?? undefined, createdAt: r.created_at }));
  const replies: Record<string, string> = {}; ((rp ?? []) as { request_id: string; listing_id: string }[]).forEach((r) => { replies[r.request_id] = r.listing_id; });
  let area: "mine" | "all" = "mine"; try { if (localStorage.getItem("oneplan-reqs-area") === "all") area = "all"; } catch {}
  seedReqs({ searches, reqs, replies, area });
}
const err = (what: string) => (e: { message: string } | null) => { if (e) showToast(`${what}: ${e.message}`); };

// ---------- запуск ----------
export function startRealtorSync(meId: string) {
  if (started || !hasSupabaseEnv() || !meId || typeof window === "undefined") return;
  started = true; me = meId; sb = createClient();
  setListingWriteHook({
    upsert: (o) => { void upsertListing(o); },
    status: (id, st) => { void sb!.from("listings").update({ status: st, updated_at: new Date().toISOString() }).eq("id", id).then(({ error }) => err("Статус не сохранён")(error)); },
    exports: (id, map) => { void sb!.from("listings").update({ exports: map }).eq("id", id).then(({ error }) => err("Экспорт не сохранён")(error)); },
    remove: (id) => { void (async () => {
      const { error } = await sb!.from("listings").delete().eq("id", id);
      if (error) { err("Объявление не удалено")(error); return; }
      // фото объявления в bucket photos/<uid>/<listing>/ — убрать, чтобы не копились (best-effort)
      try { const { data } = await sb!.storage.from("photos").list(`${me}/${id}`); const names = (data ?? []).map((f) => `${me}/${id}/${f.name}`); if (names.length) await sb!.storage.from("photos").remove(names); } catch { /* не критично */ }
    })(); },
  });
  setFavHook((id, on) => { void (on ? sb!.from("favorites").upsert({ user_id: me, listing_id: id }) : sb!.from("favorites").delete().eq("user_id", me).eq("listing_id", id)).then(({ error }) => err("Избранное не сохранено")(error)); });
  setSelectionHook({ upsert: (s) => { void upsertSelection(s); }, remove: (id) => { void sb!.from("selections").delete().eq("id", id).then(({ error }) => err("Подборка не удалена")(error)); } });
  setReqHook({
    search: (s) => { void sb!.from("saved_searches").upsert({ id: s.id, owner_id: me, name: s.name, params: s.params, new_n: s.newN, published: s.published, last_opened: new Date().toISOString() }, { onConflict: "id" }).then(({ error }) => err("Поиск не сохранён")(error)); },
    removeSearch: (id) => { void sb!.from("saved_searches").delete().eq("id", id).then(({ error }) => err("Поиск не удалён")(error)); },
    request: (r) => { void sb!.from("requests").upsert({ id: r.id, by_id: me, deal: r.deal, type: r.type, rooms: r.rooms, il: r.il, geo: r.geo, max_price: r.max || null, feat_keys: r.featKeys ?? [], comment: r.c, from_search: r.fromSearch && isUuid(r.fromSearch) ? r.fromSearch : null }, { onConflict: "id" }).then(({ error }) => err("Запрос не сохранён")(error)); },
    removeRequest: (id) => { void sb!.from("requests").delete().eq("id", id).then(({ error }) => err("Запрос не удалён")(error)); },
    reply: (reqId, listingId) => { void sb!.from("request_replies").upsert({ request_id: reqId, listing_id: listingId, by_id: me }).then(({ error }) => err("Ответ не сохранён")(error)); },
  });
  void (async () => {
    await Promise.all([loadListings(), loadProfiles(), loadFavs(), loadSelections(), loadReqs()]);
    await migrateLocal();
  })();
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") { void loadListings(); void loadReqs(); } });
}
