"use client";

// Client selections («подборки»): seeded demo data + localStorage until Supabase is wired.
import { useSyncExternalStore } from "react";
import type { L10n } from "@/lib/types";

export type SelStatus = "draft" | "sent" | "viewed";
export type Reaction = "like" | "maybe" | "no";
export type Selection = {
  id: string;
  slug: string;              // one-plan.pro/s/<slug> — the last 6 chars of the id, upper-cased (prototype line 4299)
  title: string;
  name: string;              // client name
  note: string;
  items: string[];           // listing ids
  cm: Record<string, string>; // per-listing comments
  status: SelStatus;
  views: number;
  reacts: Record<string, Reaction>;
  date?: L10n;               // prototype `sl.date[lang]` («Сегодня, 14:20», «Вчера», «Только что»)
  createdAt: string;         // ISO
  updatedAt: string;
};

const KEY = "oneplan-selections";
const d = (daysAgo: number, h = 14, m = 20) => { const x = new Date(); x.setDate(x.getDate() - daysAgo); x.setHours(h, m, 0, 0); return x.toISOString(); };
export const slugOf = (id: string) => id.toUpperCase().slice(-6);
// Demo data from the prototype (lines 2507–2511).
const SEED: Selection[] = [
  { id: "s1", slug: "S1", title: "Анна · у моря", name: "Анна Соколова", items: ["o3", "o2", "o6", "o1", "o9"], status: "viewed", views: 2, reacts: { o3: "like", o2: "like", o6: "like" }, cm: { o3: "Первая линия, вид на море", o2: "Подходит под гражданство" }, note: "Подобрал варианты у моря по вашему бюджету.", date: { RU: "Сегодня, 14:20", EN: "Today, 14:20", TR: "Bugün 14:20" }, createdAt: d(0), updatedAt: d(0) },
  { id: "s2", slug: "S2", title: "Дмитрий и Елена · виллы", name: "Дмитрий и Елена", items: ["o4", "o6", "o5"], status: "viewed", views: 1, reacts: { o4: "like", o6: "like" }, cm: {}, note: "", date: { RU: "Вчера", EN: "Yesterday", TR: "Dün" }, createdAt: d(1), updatedAt: d(1) },
  { id: "s3", slug: "S3", title: "Игорь · до 130к", name: "Игорь Браун", items: ["o2", "o5", "o1", "o8", "o7", "m1"], status: "sent", views: 0, reacts: {}, cm: {}, note: "", date: { RU: "2 дня назад", EN: "2 days ago", TR: "2 gün önce" }, createdAt: d(2), updatedAt: d(2) },
  { id: "s4", slug: "S4", title: "Olga · Germany", name: "Olga (Germany)", items: ["o6", "o4"], status: "sent", views: 0, reacts: {}, cm: {}, note: "", date: { RU: "3 дня назад", EN: "3 days ago", TR: "3 gün önce" }, createdAt: d(3), updatedAt: d(3) },
];

let snapshot: Selection[] | null = null;
const listeners = new Set<() => void>();
// С входом подборки живут в базе: `store/realtorRemote.ts` подсовывает список и получает каждое изменение (`SelHook`).
export type SelHook = { upsert: (s: Selection) => void; remove: (id: string) => void };
let hook: SelHook | null = null;
let remoteMode = false;
export function setSelectionHook(h: SelHook | null) { hook = h; remoteMode = !!h; }
export function seedSelections(list: Selection[]) { snapshot = list; listeners.forEach((l) => l()); }
export const newSelId = () => (remoteMode && typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `s${Date.now()}`);
function read(): Selection[] {
  if (snapshot) return snapshot;
  if (remoteMode) { snapshot = []; return snapshot; }
  let next = SEED;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const list = JSON.parse(raw) as Selection[];
      // Older local data: slug was a transliterated name; migrate to the prototype format and restore seed dates.
      next = list.map((s) => ({ ...s, slug: slugOf(s.id), date: s.date ?? SEED.find((x) => x.id === s.id)?.date }));
    }
  } catch {}
  snapshot = next;
  return next;
}
function write(next: Selection[]) {
  snapshot = next;
  if (!remoteMode) try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useSelections(): Selection[] {
  return useSyncExternalStore(subscribe, read, () => SEED);
}
export const likedCount = (s: Selection) => Object.values(s.reacts).filter((r) => r === "like").length;
// One link format for the card, the done-state and the public route (prototype 3472 / 4299).
export const selectionUrl = (s: Selection) => `https://one-plan.pro/s/${s.slug}`;
export const findBySlug = (list: Selection[], slug: string) => list.find((x) => x.slug === slug || slugOf(x.id) === slug || x.id === slug);

export function createSelection(input: { title: string; name: string; note: string; items: string[]; cm: Record<string, string> }): Selection {
  const now = new Date().toISOString();
  const id = newSelId();
  const s: Selection = {
    id, slug: slugOf(id), title: input.title || input.name || "—", name: input.name || "—", note: input.note, items: input.items, cm: input.cm,
    status: "sent", views: 0, reacts: {}, date: { RU: "Только что", EN: "Just now", TR: "Az önce" }, createdAt: now, updatedAt: now,
  };
  write([s, ...read()]);
  hook?.upsert(s);
  return s;
}
export function updateSelection(id: string, patch: Partial<Selection>) {
  const next = read().map((x) => (x.id === id ? { ...x, ...patch, updatedAt: new Date().toISOString() } : x));
  write(next);
  const s = next.find((x) => x.id === id); if (s) hook?.upsert(s);
}
export function removeSelection(id: string) {
  write(read().filter((x) => x.id !== id));
  hook?.remove(id);
}
export function reactTo(id: string, listingId: string, r: Reaction | null) {
  const s = read().find((x) => x.id === id);
  if (!s) return;
  const reacts = { ...s.reacts };
  if (r) reacts[listingId] = r; else delete reacts[listingId];
  updateSelection(id, { reacts });
}
export function markViewed(id: string) {
  const s = read().find((x) => x.id === id);
  if (!s) return;
  updateSelection(id, { status: "viewed", views: s.views + 1 });
}

// Where «В кабинет» returns to (prototype keeps the previous screen under the overlay; we use a route).
const RET_KEY = "oneplan-cli-return";
export function setClientReturn(path: string) { try { sessionStorage.setItem(RET_KEY, path); } catch {} }
export function getClientReturn(): string { try { return sessionStorage.getItem(RET_KEY) || "/sels"; } catch { return "/sels"; } }
