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

// ---- catalogue UI state (not persisted, prototype `nbVM`, `nbType`, `nbRooms`, …) ----
type U = { f: NbFilter; vm: "list" | "map" };
const U0: U = { f: EMPTY_NB_FILTER, vm: "list" };
let ui: U = U0;
const uiListeners = new Set<() => void>();
const uiSubscribe = (l: () => void) => { uiListeners.add(l); return () => { uiListeners.delete(l); }; };
const uiWrite = (next: U) => { ui = next; uiListeners.forEach((l) => l()); };

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
