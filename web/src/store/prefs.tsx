"use client";

// Per-user working state (favourites, current selection folder, dismissed hints).
// Kept in localStorage for now; favourites and selections move to Supabase later.
import { createContext, useContext, useMemo, useSyncExternalStore, type ReactNode } from "react";

export type SelDraft = { editingSel: string | null; title: string; name: string; note: string; cm: Record<string, string> };
type Prefs = { favs: string[]; sel: string[]; hintHidden: boolean; selDraft: SelDraft };
type Ctx = Prefs & {
  toggleFav: (id: string) => void;
  toggleSel: (id: string) => void;
  clearSel: () => void;
  setSel: (ids: string[]) => void;
  setSelDraft: (patch: Partial<SelDraft>) => void;
  resetSelDraft: () => void;
  hideHint: () => void;
};

const KEY = "oneplan-prefs";
const EMPTY_DRAFT: SelDraft = { editingSel: null, title: "", name: "", note: "", cm: {} };
const DEFAULT: Prefs = { favs: [], sel: [], hintHidden: false, selDraft: EMPTY_DRAFT };

// Tiny external store so React can subscribe without effects (and SSR renders defaults).
let snapshot: Prefs | null = null;
const listeners = new Set<() => void>();
function read(): Prefs {
  if (snapshot) return snapshot;
  let next: Prefs = DEFAULT;
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) { const p = JSON.parse(raw); next = { ...DEFAULT, ...p, selDraft: { ...EMPTY_DRAFT, ...(p.selDraft || {}) } }; }
  } catch {}
  snapshot = next;
  return next;
}
function write(next: Prefs) {
  snapshot = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
}
function subscribe(l: () => void) {
  listeners.add(l);
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { snapshot = null; l(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
}

/** Избранное в базе (с входом): `store/realtorRemote.ts` ставит обработчик и подсовывает список при загрузке. */
let favHook: ((id: string, on: boolean) => void) | null = null;
export function setFavHook(fn: typeof favHook) { favHook = fn; }
export function seedFavs(ids: string[]) { write({ ...read(), favs: ids }); }

const PrefsCtx = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  const p = useSyncExternalStore(subscribe, read, () => DEFAULT);

  const value = useMemo<Ctx>(() => {
    const toggle = (k: "favs" | "sel") => (id: string) => {
      const cur = read();
      const on = !cur[k].includes(id);
      write({ ...cur, [k]: on ? [...cur[k], id] : cur[k].filter((x) => x !== id) });
      if (k === "favs" && favHook) favHook(id, on);
    };
    return {
      ...p,
      toggleFav: toggle("favs"),
      toggleSel: toggle("sel"),
      // Prototype `clearSel` (line 4286): only the folder and the edit mode are dropped; title/name/comments stay.
      clearSel: () => { const cur = read(); write({ ...cur, sel: [], selDraft: { ...cur.selDraft, editingSel: null } }); },
      setSel: (ids) => write({ ...read(), sel: ids }),
      setSelDraft: (patch) => { const cur = read(); write({ ...cur, selDraft: { ...cur.selDraft, ...patch } }); },
      resetSelDraft: () => write({ ...read(), sel: [], selDraft: EMPTY_DRAFT }),
      hideHint: () => write({ ...read(), hintHidden: true }),
    };
  }, [p]);

  return <PrefsCtx.Provider value={value}>{children}</PrefsCtx.Provider>;
}

export function usePrefs(): Ctx {
  const ctx = useContext(PrefsCtx);
  if (!ctx) throw new Error("usePrefs must be used inside <PrefsProvider>");
  return ctx;
}
