"use client";

// Состояние каталога вторички (`/catalog` без `?q=`): фильтры и режим список/карта живут в памяти вкладки, как в SPA-прототипе,
// поэтому «Назад» со страницы объекта возвращает на ту же карту с тем же спуском по зонам (+ копия в sessionStorage, см. ниже).
// Аналог `useNbUi` для новостроек.
import { useSyncExternalStore } from "react";
import { EMPTY_FILTERS, type Filters } from "@/lib/filters";

type U = { f: Filters; view: "list" | "map" };
const U0: U = { f: EMPTY_FILTERS, view: "list" };
let ui: U = U0;
const listeners = new Set<() => void>();
// Копия в sessionStorage (16.10.2026, «с карты в квартиру, назад — а он в список»): на телефоне объект открывается полной
// загрузкой страницы, и память вкладки терялась — «Назад» возвращал в список с пустыми фильтрами. Снимок восстанавливается
// при первой подписке (после гидрации, чтобы HTML сервера и клиента совпали), живёт до закрытия вкладки.
const KEY = "opl-cat-ui";
let loaded = false;
const load = () => {
  if (loaded || typeof window === "undefined") return; loaded = true;
  try {
    const v = JSON.parse(sessionStorage.getItem(KEY) || "null") as Partial<U> | null;
    if (v && typeof v === "object") { ui = { f: { ...EMPTY_FILTERS, ...(v.f ?? {}) }, view: v.view === "map" ? "map" : "list" }; queueMicrotask(() => listeners.forEach((l) => l())); }
  } catch {}
};
const subscribe = (l: () => void) => { listeners.add(l); load(); return () => { listeners.delete(l); }; };
const write = (next: U) => { ui = next; try { sessionStorage.setItem(KEY, JSON.stringify(next)); } catch {} listeners.forEach((l) => l()); };

const set = (patch: Partial<Filters>) => write({ ...ui, f: { ...ui.f, ...patch } });
const setView = (view: "list" | "map") => write({ ...ui, view });

export function useCatUi() {
  const s = useSyncExternalStore(subscribe, () => ui, () => U0);
  return { f: s.f, view: s.view, set, setView }; // функции стабильны — безопасны в зависимостях хуков
}
