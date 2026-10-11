"use client";

// Состояние каталога вторички (`/catalog` без `?q=`): фильтры и режим список/карта живут в памяти вкладки, как в SPA-прототипе,
// поэтому «Назад» со страницы объекта возвращает на ту же карту с тем же спуском по зонам. Аналог `useNbUi` для новостроек.
import { useSyncExternalStore } from "react";
import { EMPTY_FILTERS, type Filters } from "@/lib/filters";

type U = { f: Filters; view: "list" | "map" };
const U0: U = { f: EMPTY_FILTERS, view: "list" };
let ui: U = U0;
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const write = (next: U) => { ui = next; listeners.forEach((l) => l()); };

const set = (patch: Partial<Filters>) => write({ ...ui, f: { ...ui.f, ...patch } });
const setView = (view: "list" | "map") => write({ ...ui, view });

export function useCatUi() {
  const s = useSyncExternalStore(subscribe, () => ui, () => U0);
  return { f: s.f, view: s.view, set, setView }; // функции стабильны — безопасны в зависимостях хуков
}
