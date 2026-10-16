"use client";

// Listings created in the form live in localStorage until Supabase is wired;
// `useAllListings()` merges them with the demo seed (and applies the status
// overrides `stOver`, prototype `stOf`) so every screen sees the same data.
// Also here: portal export toggles `expMap[id]`, the drafts list `drafts[]`
// (prototype `doDraft`), Nominatim geo extras and the «Назад» screen memory.
import { useMemo, useSyncExternalStore } from "react";
import { GEO, IL_OF, SEMT2ILCE, addGeo, getSeedListings } from "@/lib/seed";
import type { Listing, ListingStatus } from "@/lib/types";

type Store<T> = { key: string; snapshot: T | null; empty: T; listeners: Set<() => void> };
function mk<T>(key: string, empty: T): Store<T> { return { key, snapshot: null, empty, listeners: new Set() }; }
function readOf<T>(s: Store<T>): T {
  if (s.snapshot) return s.snapshot;
  let next: T = s.empty;
  try { const raw = localStorage.getItem(s.key); if (raw) next = JSON.parse(raw); } catch {}
  s.snapshot = next;
  return next;
}
function writeOf<T>(s: Store<T>, next: T) {
  s.snapshot = next;
  try { localStorage.setItem(s.key, JSON.stringify(next)); } catch {}
  s.listeners.forEach((l) => l());
}
const subOf = <T,>(s: Store<T>) => (l: () => void) => { s.listeners.add(l); return () => { s.listeners.delete(l); }; };

/* ---------- geo extras: İl/İlçe/Semt that Nominatim added to GEO (prototype `'z'+nrm(name)`) ---------- */
type GeoExtra = { il: string; ilce: string; semt: string };
const GEO_KEY = "opl-geo-extra";
let geoLoaded = false;
function loadGeoExtras() {
  if (geoLoaded) return;
  geoLoaded = true;
  try { const raw = localStorage.getItem(GEO_KEY); if (raw) (JSON.parse(raw) as GeoExtra[]).forEach((g) => addGeo(g)); } catch {}
}
/** Prototype `_setAddPin` tail: match Nominatim names onto GEO keys, registering unknown ones. */
export function matchGeo(names: GeoExtra): GeoExtra {
  loadGeoExtras();
  const keys = addGeo(names);
  if ((keys.il + keys.ilce + keys.semt).includes("z")) {
    try {
      const cur: GeoExtra[] = JSON.parse(localStorage.getItem(GEO_KEY) || "[]");
      if (!cur.some((g) => g.il === names.il && g.ilce === names.ilce && g.semt === names.semt)) localStorage.setItem(GEO_KEY, JSON.stringify([...cur, names]));
    } catch {}
  }
  return keys;
}
export const ilOfIlce = (ilce: string) => IL_OF[ilce] ?? "";
export const ilceOfSemt = (semt: string) => SEMT2ILCE[semt] ?? "";
export const geoOf = (il: string, ilce: string, semt: string) => {
  const gIl = GEO.find((x) => x.k === il);
  const gIlce = gIl?.ilces.find((x) => x.k === ilce);
  const gSemt = gIlce?.semts.find((x) => x.k === semt);
  return { gIl, gIlce, gSemt };
};

/* ---------- local listings (без входа) и объявления из базы (с входом — `store/realtorRemote.ts`) ---------- */
const LOCAL = mk<Listing[]>("oneplan-local-listings", []);
function readLocal(): Listing[] { loadGeoExtras(); return readOf(LOCAL); }
export function useLocalListings(): Listing[] {
  return useSyncExternalStore(subOf(LOCAL), readLocal, () => LOCAL.empty);
}
export const getLocalListings = (): Listing[] => readLocal();
/** Запасная запись в localStorage, если база не приняла объявление (уедет в базу при следующем входе — `migrateLocal`). */
export function keepLocalCopy(o: Listing) { const cur = readLocal(); writeOf(LOCAL, cur.some((x) => x.id === o.id) ? cur.map((x) => (x.id === o.id ? o : x)) : [...cur, o]); }
export function clearLocalListings() { writeOf(LOCAL, []); }

// Объявления из Supabase: источник истины для вошедшего пользователя. Пока синхронизация не запущена — пусто и неактивно.
type Remote = { list: Listing[]; active: boolean; loaded: boolean };
let remote: Remote = { list: [], active: false, loaded: false };
const remoteSubs = new Set<() => void>();
const remoteSub = (l: () => void) => { remoteSubs.add(l); return () => { remoteSubs.delete(l); }; };
const REMOTE_EMPTY: Remote = { list: [], active: false, loaded: false };
export const getRemoteListings = () => remote;
export function setRemoteListings(list: Listing[], active = true) { remote = { list, active, loaded: true }; remoteSubs.forEach((l) => l()); }
/** Первая загрузка из базы завершилась (успехом или ошибкой) — до этого «не найдено» решать нельзя. */
export function markRemoteLoaded() { if (!remote.loaded) { remote = { ...remote, loaded: true }; remoteSubs.forEach((l) => l()); } }
export function useRemoteListings(): Remote { return useSyncExternalStore(remoteSub, getRemoteListings, () => REMOTE_EMPTY); }
/** Можно ли уже судить об отсутствии объявления: в демо-режиме (meId "me") сразу, с входом — после первой загрузки из базы
 *  (страница объекта отдавала 404 на объявления из базы, пока шёл запрос, 10.10.2026). */
export function useListingsReady(meId: string): boolean { const rem = useRemoteListings(); return meId === "me" || rem.loaded; }
/** Запись в базу (ставит `store/realtorRemote.ts`); без неё — localStorage. */
export type ListingWriteHook = { upsert: (o: Listing) => void; status: (id: string, st: ListingStatus) => void; exports: (id: string, map: Record<string, boolean>) => void; remove: (id: string) => void };
let writeHook: ListingWriteHook | null = null;
export function setListingWriteHook(h: ListingWriteHook | null) { writeHook = h; }

/** Обновить объявление ТОЛЬКО в памяти (без записи в базу) — после передачи другому риэлтору: запись уже сделала функция базы,
 *  а повторный upsert с owner_id = me возвращал объект обратно (16.10.2026, «передал Константину — осталось у меня»). */
export function patchRemoteListing(id: string, patch: Partial<Listing>) {
  if (remote.active) setRemoteListings(remote.list.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  else { const cur = readLocal(); writeOf(LOCAL, cur.map((x) => (x.id === id ? { ...x, ...patch } : x))); }
}
export function upsertLocalListing(o: Listing) {
  if (remote.active && writeHook) {
    const i = remote.list.findIndex((x) => x.id === o.id);
    setRemoteListings(i >= 0 ? remote.list.map((x) => (x.id === o.id ? o : x)) : [o, ...remote.list]); // оптимистично
    writeHook.upsert(o);
    return;
  }
  const cur = readLocal();
  const i = cur.findIndex((x) => x.id === o.id);
  writeOf(LOCAL, i >= 0 ? cur.map((x) => (x.id === o.id ? o : x)) : [...cur, o]);
}

/** Удалить своё объявление (12.10.2026): из базы (hook) или из localStorage; оптимистично убирается из списка. */
export function removeListing(id: string) {
  if (remote.active && writeHook) { setRemoteListings(remote.list.filter((x) => x.id !== id)); writeHook.remove(id); return; }
  writeOf(LOCAL, readLocal().filter((x) => x.id !== id));
}

/* ---------- status overrides + portal export map (prototype `stOver` / `expMap`, line 3449–3459) ---------- */
type Meta = { stOver: Record<string, ListingStatus>; expMap: Record<string, Record<string, boolean>> };
const META = mk<Meta>("opl-listing-meta", { stOver: {}, expMap: {} });
const readMeta = () => readOf(META);
export function useListingMeta(): Meta {
  return useSyncExternalStore(subOf(META), readMeta, () => META.empty);
}
export function setStOver(id: string, st: ListingStatus) {
  if (remote.active && writeHook && remote.list.some((x) => x.id === id)) {
    setRemoteListings(remote.list.map((x) => (x.id === id ? { ...x, st } : x)));
    writeHook.status(id, st);
    return;
  }
  const cur = readMeta();
  writeOf(META, { ...cur, stOver: { ...cur.stOver, [id]: st } });
}
export function toggleExp(id: string, portal: string) {
  const cur = readMeta();
  const pm = cur.expMap[id] || {};
  const next = { ...pm, [portal]: !pm[portal] };
  writeOf(META, { ...cur, expMap: { ...cur.expMap, [id]: next } });
  if (remote.active && writeHook && remote.list.some((x) => x.id === id)) writeHook.exports(id, next);
}
/** Сброс отметок порталов у объявления (после передачи другому риэлтору — база сбрасывает сама, 0032). */
export function clearExp(id: string) { const cur = readMeta(); const m = { ...cur.expMap }; delete m[id]; writeOf(META, { ...cur, expMap: m }); }
/** Экспорт на порталы из базы → в meta (при загрузке объявлений). */
export function seedExpMap(map: Record<string, Record<string, boolean>>) {
  const cur = readMeta();
  writeOf(META, { ...cur, expMap: { ...cur.expMap, ...map } });
}

/** Seed + local listings with `stOver` applied (prototype `stOf(o)`). */
export function useAllListings(): Listing[] {
  const local = useLocalListings();
  const rem = useRemoteListings();
  const { stOver } = useListingMeta();
  return useMemo(() => {
    // с входом: ТОЛЬКО объявления из базы (16.10.2026, решение пользователя «оставим только реальные» — демо-каталог
    // прототипа больше не подмешивается); без входа (UI-режим) — демо + локальные
    const all = rem.active ? rem.list : [...getSeedListings(), ...local];
    return Object.keys(stOver).length ? all.map((o) => (stOver[o.id] && stOver[o.id] !== o.st ? { ...o, st: stOver[o.id] } : o)) : all;
  }, [local, rem, stOver]);
}

/* ---------- drafts (prototype `drafts[]`, `doDraft` line 3781, cards 3785–3789) ---------- */
export type DraftSnap = Record<string, unknown> & { dcId: string; aDraftId: string };
const DRAFTS = mk<DraftSnap[]>("opl-drafts", []);
const readDrafts = () => readOf(DRAFTS);
export function useDrafts(): DraftSnap[] {
  return useSyncExternalStore(subOf(DRAFTS), readDrafts, () => DRAFTS.empty);
}
export function putDraft(snap: DraftSnap) {
  writeOf(DRAFTS, [...readDrafts().filter((x) => x.dcId !== snap.dcId), snap]);
}
export function delDraft(dcId: string) {
  writeOf(DRAFTS, readDrafts().filter((x) => x.dcId !== dcId));
}

/* ---------- «Назад» on the object page (prototype `prevScreen`, line 4315) ---------- */
export type PrevScreen = "catalog" | "mine" | "favs" | "add" | "newb";
const PREV_KEY = "opl-prev-screen";
export function setPrevScreen(s: PrevScreen) { try { sessionStorage.setItem(PREV_KEY, s); } catch {} }
export function prevScreenFromPath(path: string): PrevScreen | null {
  if (path.startsWith("/catalog")) return "catalog";
  if (path.startsWith("/mine")) return "mine";
  if (path.startsWith("/favs")) return "favs";
  if (path.startsWith("/add")) return "add";
  if (path.startsWith("/newb")) return "newb";
  return null;
}
export function getPrevScreen(): PrevScreen {
  try { const v = sessionStorage.getItem(PREV_KEY) as PrevScreen | null; if (v && ["catalog", "mine", "favs", "add", "newb"].includes(v)) return v; } catch {}
  return "catalog";
}
