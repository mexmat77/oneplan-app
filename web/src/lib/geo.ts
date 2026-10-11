"use client";
// Ленивый справочник махалле (46 тыс. записей по Турции): статический `public/geo/mahalle.json` ({ ilceK: [{k,n,kind,x}] })
// грузится один раз при первом обращении и вливается в реестр `GEO` (ic.semts) и `SEMT2ILCE` из `lib/seed`.
// il/ilçe (81/973) лежат в `mock/geo.json` и доступны синхронно. Полигоны — в Supabase (`geo_*`), см. `/api/geo`.
import { useSyncExternalStore } from "react";
import { GEO, ILCES, SEMT2ILCE, type GeoSemt } from "./seed";

/** Версия геоданных (дата последней заливки geo_* и mahalle.json): параметр в URL, чтобы кэш браузера/прокси не отдавал старое. */
export const GEO_VER = "202610101604";
export const geoUrl = (q: string) => `/api/geo?${q}&v=${GEO_VER}`;

export type MahalleRow = { k: string; n: string; kind: "mahalle" | "koy"; x: 0 | 1 };
let state: "idle" | "loading" | "ready" | "error" = "idle";
let promise: Promise<void> | null = null;
const subs = new Set<() => void>();
const notify = () => subs.forEach((f) => f());

export function loadMahalle(): Promise<void> {
  if (promise) return promise;
  state = "loading";
  promise = (async () => {
    try {
      const r = await fetch(`/geo/mahalle.json?v=${GEO_VER}`, { cache: "force-cache" });
      if (!r.ok) throw new Error(String(r.status));
      const data = (await r.json()) as Record<string, MahalleRow[]>;
      for (const [ilceK, rows] of Object.entries(data)) {
        const ic = ILCES[ilceK]; if (!ic) continue;
        const have = new Set(ic.semts.map((s) => s.k));
        for (const m of rows) { if (have.has(m.k)) continue; const sm: GeoSemt = { k: m.k, n: m.n }; ic.semts.push(sm); SEMT2ILCE[m.k] = ilceK; }
      }
      state = "ready";
    } catch { state = "error"; }
    notify();
  })();
  return promise;
}
const subscribe = (cb: () => void) => { subs.add(cb); if (state === "idle") void loadMahalle(); return () => { subs.delete(cb); }; };
/** true, когда махалле загружены; подписывает компонент на перерисовку после загрузки. */
export function useMahalleLoaded(): boolean {
  return useSyncExternalStore(subscribe, () => state === "ready", () => false);
}
export const mahalleState = () => state;
export const ilOf = (k: string) => GEO.find((g) => g.k === k);
