"use client";

// New-build state: watched projects and starred units (localStorage until Supabase) plus the
// catalogue UI state (`nb*` filters, list/map view) which — like the prototype — lives only in memory
// and therefore survives the `/newb` ↔ `/newb?dev=` ↔ `/newb?p=` route changes.
import { useSyncExternalStore } from "react";
import { EMPTY_NB_FILTER, type NbFilter } from "@/lib/newb";

type S = { watch: string[]; favU: string[] }; // favU: "<projectKey>#<unitNo>"
const KEY = "oneplan-newb";
const EMPTY: S = { watch: [], favU: [] };
let snapshot: S | null = null;
const listeners = new Set<() => void>();
function read(): S {
  if (snapshot) return snapshot;
  let next = EMPTY;
  try { const raw = localStorage.getItem(KEY); if (raw) next = { ...EMPTY, ...JSON.parse(raw) }; } catch {}
  snapshot = next;
  return next;
}
function write(next: S) {
  snapshot = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

export function useNewbPrefs() {
  const s = useSyncExternalStore(subscribe, read, () => EMPTY);
  return {
    ...s,
    toggleWatch: (k: string) => write({ ...read(), watch: toggle(read().watch, k) }),
    toggleFavU: (id: string) => write({ ...read(), favU: toggle(read().favU, id) }),
  };
}

// ---- catalogue UI state (sessionStorage snapshot, prototype `nbVM`, `nbType`, `nbRooms`, …) ----
type U = { f: NbFilter; vm: "list" | "map" };
const U0: U = { f: EMPTY_NB_FILTER, vm: "list" };
let ui: U = U0;
const uiListeners = new Set<() => void>();
// Копия в sessionStorage — как `store/catalogUi`: «Назад» с карточки возвращает на ту же карту и после полной загрузки (16.10.2026).
const UI_KEY = "opl-nb-ui";
let uiLoaded = false;
const uiLoad = () => {
  if (uiLoaded || typeof window === "undefined") return; uiLoaded = true;
  try {
    const v = JSON.parse(sessionStorage.getItem(UI_KEY) || "null") as Partial<U> | null;
    if (v && typeof v === "object") { ui = { f: { ...EMPTY_NB_FILTER, ...(v.f ?? {}) }, vm: v.vm === "map" ? "map" : "list" }; queueMicrotask(() => uiListeners.forEach((l) => l())); }
  } catch {}
};
const uiSubscribe = (l: () => void) => { uiListeners.add(l); uiLoad(); return () => { uiListeners.delete(l); }; };
const uiWrite = (next: U) => { ui = next; try { sessionStorage.setItem(UI_KEY, JSON.stringify(next)); } catch {} uiListeners.forEach((l) => l()); };

export function useNbUi() {
  const s = useSyncExternalStore(uiSubscribe, () => ui, () => U0);
  return {
    f: s.f,
    vm: s.vm,
    set: (patch: Partial<NbFilter>) => uiWrite({ ...ui, f: { ...ui.f, ...patch } }),
    reset: () => uiWrite({ ...ui, f: EMPTY_NB_FILTER }),
    setVm: (vm: "list" | "map") => uiWrite({ ...ui, vm }),
  };
}
