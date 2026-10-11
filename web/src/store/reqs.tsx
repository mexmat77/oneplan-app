"use client";

// Saved searches («Мои поиски») and base requests («Запросы базы»): seed + localStorage until Supabase.
import { useSyncExternalStore } from "react";
import breqsJson from "@/mock/breqs.json";
import type { Filters } from "@/lib/filters";
import type { Deal, L10n, PropType } from "@/lib/types";

export type SearchParams = Pick<Filters, "il" | "ilces" | "semts" | "min" | "max" | "rooms" | "deal" | "type">;
export type SavedSearch = { id: string; name: string; params: SearchParams; newN: number; published: boolean; createdAt: string };
export type BaseRequest = {
  id: string; by: string; deal: Deal; type: PropType; rooms: string; il: string; geo: string; max: number;
  days: number; featKeys?: string[]; c: L10n; fromSearch?: string; createdAt?: string;
};

const SEED_SEARCHES: SavedSearch[] = [
  { id: "q1", name: "Анна · у моря до 9,6 млн ₺", params: { il: "antalya", ilces: [], semts: [], min: "", max: "9600000", rooms: ["2+1", "3+1"], deal: "sale", type: "" }, newN: 2, published: false, createdAt: new Date().toISOString() },
  { id: "q2", name: "Игорь · Аланья до 6,24 млн ₺", params: { il: "antalya", ilces: ["alanya"], semts: [], min: "", max: "6240000", rooms: [], deal: "sale", type: "" }, newN: 0, published: false, createdAt: new Date().toISOString() },
];
const SEED_REQS = breqsJson as BaseRequest[];

type State = { searches: SavedSearch[]; reqs: BaseRequest[]; replies: Record<string, string>; area: "mine" | "all" };
const KEY = "oneplan-reqs";
const DEFAULT: State = { searches: SEED_SEARCHES, reqs: SEED_REQS, replies: {}, area: "mine" };

let snapshot: State | null = null;
const listeners = new Set<() => void>();
// С входом поиски/запросы живут в базе: `store/realtorRemote.ts` подсовывает состояние и получает изменения (`ReqHook`).
export type ReqHook = {
  search: (s: SavedSearch) => void; removeSearch: (id: string) => void;
  request: (r: BaseRequest) => void; removeRequest: (id: string) => void; reply: (reqId: string, listingId: string) => void;
};
let hook: ReqHook | null = null;
let remoteMode = false;
export function setReqHook(h: ReqHook | null) { hook = h; remoteMode = !!h; }
export function seedReqs(patch: Partial<State>) { snapshot = { ...(snapshot ?? { ...DEFAULT, searches: [], reqs: [] }), ...patch }; listeners.forEach((l) => l()); }
const newId = (p: string) => (remoteMode && typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${p}${Date.now()}`);
function read(): State {
  if (snapshot) return snapshot;
  if (remoteMode) { snapshot = { ...DEFAULT, searches: [], reqs: [] }; return snapshot; }
  let next = DEFAULT;
  try { const raw = localStorage.getItem(KEY); if (raw) next = { ...DEFAULT, ...JSON.parse(raw) }; } catch {}
  snapshot = next;
  return next;
}
function write(next: State) {
  snapshot = next;
  if (!remoteMode) try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
}
const upd = (id: string, fn: (s: SavedSearch) => SavedSearch) => { const next = read().searches.map((s) => (s.id === id ? fn(s) : s)); write({ ...read(), searches: next }); const s = next.find((x) => x.id === id); if (s) hook?.search(s); };
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useReqs(): State {
  return useSyncExternalStore(subscribe, read, () => DEFAULT);
}
export function saveSearch(name: string, params: SearchParams): SavedSearch {
  const s: SavedSearch = { id: newId("q"), name, params, newN: 0, published: false, createdAt: new Date().toISOString() };
  write({ ...read(), searches: [s, ...read().searches] });
  hook?.search(s);
  return s;
}
export function renameSearch(id: string, name: string) { upd(id, (s) => ({ ...s, name })); }
export function removeSearch(id: string) { write({ ...read(), searches: read().searches.filter((s) => s.id !== id) }); hook?.removeSearch(id); }
export function openSearch(id: string) { if (read().searches.some((s) => s.id === id && s.newN)) upd(id, (s) => ({ ...s, newN: 0 })); }
export function togglePublish(id: string) { upd(id, (s) => ({ ...s, published: !s.published })); }
export function setArea(area: "mine" | "all") { write({ ...read(), area }); try { localStorage.setItem("oneplan-reqs-area", area); } catch {} }
export function addRequest(r: Omit<BaseRequest, "id" | "days" | "createdAt">): BaseRequest {
  const req: BaseRequest = { ...r, id: newId("bn"), days: 30, createdAt: new Date().toISOString() };
  write({ ...read(), reqs: [req, ...read().reqs] });
  hook?.request(req);
  return req;
}
export function removeRequest(id: string) { write({ ...read(), reqs: read().reqs.filter((r) => r.id !== id) }); hook?.removeRequest(id); }
export function markReplied(reqId: string, listingId: string) { write({ ...read(), replies: { ...read().replies, [reqId]: listingId } }); hook?.reply(reqId, listingId); }
