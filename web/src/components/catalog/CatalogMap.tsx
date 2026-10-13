"use client";

// Общая карта каталога (вторичка `/catalog` и новостройки `/newb`) — порт прототипа `_syncMap` (строки 2744–2940) и
// обвязки карты (367–382): хороплет по медианной цене, спуск il → ilçe → mahalle → объекты, крошки, легенда.
// Полигоны — из нашей базы (`/api/geo`, таблицы geo_* из OSM + расчётные зоны махалле; 09.10.2026); Nominatim не опрашивается.
// На уровнях ilçe и mahalle рисуются ВСЕ зоны выбранной территории: с объектами — цветом по медиане, пустые — бледно
// (правило пользователя 09.10.2026: махалле без объектов тоже должны быть видны).
// Режим «карта» занимает весь экран под закреплённой панелью фильтров (как Sahibinden/Zillow): при входе страница
// прокручивается к панели, высота карты = высота окна − панель; колесо мыши масштабирует карту, только когда она
// «пристыкована» к панели, иначе прокручивает страницу. Объекты открываются в новой вкладке.
import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import { createMap } from "@/lib/mapBase";
import "leaflet/dist/leaflet.css";
import { IconArrowBackUp } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { fmtShort } from "@/lib/money";
import { GEO, SEMT2ILCE } from "@/lib/seed";
import { geoUrl } from "@/lib/geo";

export type MapItem = {
  id: string; ll: [number, number]; price: number; il?: string; ilce?: string; semt?: string;
  st?: string; // "reserved" | "sold" — цвет пина
  pin: string; // подпись пина на уровне объектов
  tip: string; // HTML всплывашки
  href: string; // открывается в новой вкладке
};
export type GeoSel = { il: string; ilces: string[]; semts: string[] };
type Lvl = "il" | "ilce" | "semt" | "obj";
type Poly = { k: string; name: string; geom: GeoJSON.Geometry; c?: number[] };
type Ring = number[][];

// Module-level caches survive re-mounts (prototype `_trGeo`, `_geoSub`, `_geoSubReq`).
let trGeo: GeoJSON.FeatureCollection | null = null;
let trGeoReq = false;
let trGeoDone = false; // запрос границ il завершён (пусть и неудачно) — можно кадрировать по объектам
const geoSub: Record<string, Poly[]> = {};
const geoSubReq: Record<string, boolean> = {};

const norm = (x: string) => String(x || "").toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z]/g, "");
const ILCES = Object.fromEntries(GEO.flatMap((g) => g.ilces.map((ic) => [ic.k, ic])));
const ilName = (k: string) => GEO.find((x) => x.k === k)?.n ?? k;
const ilceName = (k: string) => ILCES[k]?.n ?? k;
const semtName = (k: string) => ILCES[SEMT2ILCE[k]]?.semts.find((x) => x.k === k)?.n ?? k;
const nameOf = (lvl: Lvl, k: string) => (lvl === "il" ? ilName(k) : lvl === "ilce" ? ilceName(k) : semtName(k));
const sameName = (a: string, b: string) => { const x = norm(a), y = norm(b); return x === y || x.indexOf(y) === 0 || y.indexOf(x) === 0; };
const outerRing = (g: GeoJSON.Geometry): Ring => (g.type === "Polygon" ? g.coordinates[0] : g.type === "MultiPolygon" ? g.coordinates[0]?.[0] ?? [] : []) as Ring;
const ringOk = (g: GeoJSON.Geometry) => outerRing(g).length >= 4;
const EMPTY_STYLE: L.PathOptions = { color: "#b8bfc9", weight: 0.6, fillColor: "#e3e6ea", fillOpacity: 0.3 };
const EMPTY_HOVER: L.PathOptions = { weight: 1.4, fillOpacity: 0.45 };

type GeoFeat = { type: "Feature"; properties: { k: string; name: string; exact?: boolean; c?: number[] }; geometry: GeoJSON.Geometry };
async function loadGeo(key: string, url: string, onDone: () => void) {
  if (geoSub[key] || geoSubReq[key]) return;
  geoSubReq[key] = true;
  try {
    const r = await fetch(url);
    const j = r.ok ? ((await r.json()) as { features?: GeoFeat[] }) : { features: [] };
    geoSub[key] = (j.features ?? []).filter((f) => f.geometry && ringOk(f.geometry)).map((f) => ({ k: f.properties.k, name: f.properties.name, geom: f.geometry, c: f.properties.c }));
  } catch { geoSub[key] = []; }
  onDone();
}
const openHref = (href: string) => { try { sessionStorage.setItem("opl-prev-screen", "catalog"); } catch {} window.open(href, "_blank", "noopener"); };
// Планшет/телефон (нет hover): первый тап по пину показывает всплывашку-предпросмотр, второй тап по нему или тап по
// всплывашке открывает объект (13.10.2026, замечание пользователя «на айпаде сразу открывается объект»). На компьютере —
// предпросмотр при наведении, клик открывает, как было.
const touchMode = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(hover: none)").matches;

// Пристыковка: страница прокручивается так, чтобы панель фильтров `[data-fsticky]` встала к верху окна (шапка при этом
// прячется — `AppChrome`), затем высота карты = окно − верх карты.
function dock(wrap: HTMLElement | null, setH: (h: number) => void) {
  const bar = document.querySelector<HTMLElement>("[data-fsticky]");
  if (bar) { const top = bar.getBoundingClientRect().top + window.scrollY; if (Math.abs(window.scrollY - top) > 1) window.scrollTo({ top: Math.max(0, top) }); }
  const measure = () => { if (!wrap) return; const top = wrap.getBoundingClientRect().top; setH(Math.max(380, Math.round(window.innerHeight - top))); };
  requestAnimationFrame(() => requestAnimationFrame(measure));
}

export default function CatalogMap({ items, f, set, hint }: { items: MapItem[]; f: GeoSel; set: (p: Partial<GeoSel>) => void; hint?: string }) {
  const { t } = useI18n();
  const ref = useRef<HTMLDivElement>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const markers = useRef<Map<string, L.Marker | L.CircleMarker>>(new Map()); // пины по id — для тапа на планшете
  const tapped = useRef<string | null>(null); // id пина после первого тапа (предпросмотр открыт)
  const map = useRef<L.Map | null>(null);
  const layer = useRef<L.LayerGroup | null>(null);
  const sig = useRef("");
  const lastFit = useRef("");
  const [tick, setTick] = useState(0); // bumped when async polygons arrive
  const [h, setH] = useState(0);
  const setRef = useRef(set); useEffect(() => { setRef.current = set; }, [set]);

  const lvl: Lvl = !f.il ? "il" : !f.ilces.length ? "ilce" : !f.semts.length ? "semt" : "obj";
  const mapIl = f.il, mapIlce = f.ilces[0] || "";
  const semtsKey = f.semts.join(",");

  useEffect(() => { document.documentElement.setAttribute("data-mapmode", "1"); return () => document.documentElement.removeAttribute("data-mapmode"); }, []);
  useEffect(() => {
    const el = ref.current;
    if (!el || map.current) return;
    // zoomSnap 0.25: кадр по зоне подбирается дробным зумом, иначе Leaflet округляет вниз до целого и область занимает треть экрана
    const m = createMap(el, { scrollWheelZoom: true, zoomSnap: 0.25 }).setView([36.75, 31.1], 9);
    map.current = m;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __oplMap?: L.Map }).__oplMap = m; // отладка в браузере
    layer.current = L.layerGroup().addTo(m);
    const onPinClick = (e: MouseEvent) => {
      if (!touchMode()) return;
      const a = (e.target as HTMLElement).closest?.("a.opl-pin[data-id]") as HTMLAnchorElement | null;
      if (!a) return;
      e.preventDefault(); e.stopPropagation();
      const id = a.dataset.id || "";
      if (tapped.current === id) { tapped.current = null; openHref(a.getAttribute("href") || "#"); return; }
      tapped.current = id; markers.current.forEach((mk, k) => { if (k !== id) mk.closeTooltip(); });
      markers.current.get(id)?.openTooltip();
    };
    el.addEventListener("click", onPinClick, true);
    m.on("click", () => { tapped.current = null; markers.current.forEach((mk) => mk.closeTooltip()); });
    // Размер контейнера меняется (пристыковка, окно) → пересчёт карты; без таймеров — они стреляли по уже снятой карте.
    const ro = new ResizeObserver(() => { if (map.current === m) m.invalidateSize(); });
    ro.observe(el);
    // Колесо: масштаб карты только когда карта пристыкована к панели (её верх у верха окна), иначе — прокрутка страницы.
    const sync = () => {
      const w = wrapRef.current; if (!w) return;
      const bar = document.querySelector<HTMLElement>("[data-fsticky]");
      const limit = bar ? bar.getBoundingClientRect().bottom + 16 : 80;
      const docked = w.getBoundingClientRect().top <= limit;
      if (docked) m.scrollWheelZoom.enable(); else m.scrollWheelZoom.disable();
    };
    sync();
    window.addEventListener("scroll", sync, { passive: true });
    window.addEventListener("resize", sync);
    const onResize = () => dock(wrapRef.current, setH);
    window.addEventListener("resize", onResize);
    return () => { el.removeEventListener("click", onPinClick, true); ro.disconnect(); window.removeEventListener("scroll", sync); window.removeEventListener("resize", sync); window.removeEventListener("resize", onResize); map.current = null; layer.current = null; sig.current = ""; m.remove(); };
  }, []);
  // Вход в режим карты и смена фильтров (меняется ряд чипов над картой) → пристыковать и пересчитать высоту.
  useEffect(() => { dock(wrapRef.current, setH); }, [mapIl, mapIlce, semtsKey]);

  useEffect(() => {
    const m = map.current, lg = layer.current;
    if (!m || !lg) return;
    const objs = items.filter((o) => o.ll);
    const lls: L.LatLngExpression[] = [];
    const s = `${lvl}:${mapIl}:${mapIlce}:${semtsKey}:${tick}:${h}:${objs.map((o) => o.id).join(",")}`;
    if (s === sig.current) return;
    sig.current = s;
    lg.clearLayers(); markers.current.clear(); tapped.current = null;
    const bump = () => { sig.current = ""; setTick((x) => x + 1); };
    const fmtP = fmtShort;
    const selOutlines: L.Layer[] = []; const grpLayers: L.Layer[] = [];
    let objReady = false, grpReady = false; // полигоны уровня загружены — кадр ставится один раз, без «моргания»
    const pinOf = (o: MapItem, ll: [number, number]) => {
      const cls = "opl-pin" + (o.st === "reserved" ? " res" : o.st === "sold" ? " sold" : "");
      const mk = L.marker(ll, { icon: L.divIcon({ className: "", html: `<a class="${cls}" href="${o.href}" target="_blank" rel="noopener" data-id="${o.id}">${o.pin}</a>`, iconSize: undefined }) });
      mk.bindTooltip(o.tip, { direction: "top", opacity: 1, interactive: true });
      mk.on("tooltipopen", (e) => { const t = (e as L.TooltipEvent).tooltip.getElement(); if (t) { t.style.cursor = "pointer"; t.onclick = () => openHref(o.href); } }); // тап/клик по предпросмотру открывает объект
      markers.current.set(o.id, mk);
      return mk;
    };

    if (lvl === "obj") {
      const ckS = "semt:" + mapIlce;
      const ic0 = ILCES[mapIlce];
      const missing: string[] = []; const found = new Set<string>();
      f.semts.forEach((sk) => {
        const nm0 = ic0?.semts.find((x) => x.k === sk)?.n ?? sk;
        const poly = (geoSub[ckS] || []).find((p) => p.k === sk) ?? (geoSub["sel:" + sk] || [])[0] ?? (geoSub[ckS] || []).find((p) => sameName(p.name, nm0));
        if (poly) {
          const ol = L.geoJSON(poly.geom, { style: { color: "#1f3a63", weight: 2.4, fillColor: "#3b5fd6", fillOpacity: 0.05 } });
          lg.addLayer(ol); selOutlines.push(ol); found.add(sk);
        } else if (!geoSub[ckS] && !geoSubReq[ckS]) void loadGeo(ckS, geoUrl(`level=mahalle&ilce=${encodeURIComponent(mapIlce)}`), bump);
        else if (geoSub[ckS] && !geoSub["sel:" + sk]) missing.push(sk);
      });
      missing.forEach((sk) => void loadGeo("sel:" + sk, geoUrl(`level=mahalle&k=${encodeURIComponent(sk)}`), bump));
      objReady = f.semts.every((sk) => found.has(sk) || geoSub["sel:" + sk] !== undefined);
      objs.forEach((o) => { lls.push(o.ll); lg.addLayer(pinOf(o, o.ll)); });
    } else {
      const groups: Record<string, typeof objs> = {};
      objs.forEach((o) => { const k = o[lvl]; if (!k) return; (groups[k] = groups[k] || []).push(o); });
      const stats: Record<string, { g: typeof objs; med: number; cnt: number }> = {};
      Object.keys(groups).forEach((k) => { const g = groups[k]; const ps = g.map((o) => o.price).sort((a, b) => a - b); stats[k] = { g, med: ps[Math.floor(ps.length / 2)], cnt: g.length }; });
      const meds = Object.values(stats).map((x) => x.med);
      const mn = Math.min(...meds), mx = Math.max(...meds);
      const colOf = (v: number) => { const tt = mx > mn ? (v - mn) / (mx - mn) : 0.5; return `hsl(${Math.round(115 - 100 * tt)},52%,${Math.round(64 - 12 * tt)}%)`; };
      const drill = (k: string) => () => { if (lvl === "il") setRef.current({ il: k, ilces: [], semts: [] }); else if (lvl === "ilce") setRef.current({ ilces: [k], semts: [] }); else setRef.current({ semts: [k] }); };
      const tip = (k: string) => `<b>${nameOf(lvl, k)}</b> · ${stats[k].cnt} · ${fmtP(stats[k].med)}`;

      if (lvl === "il" && !trGeo && !trGeoReq) {
        trGeoReq = true;
        (async () => {
          try { const r = await fetch(geoUrl("level=il")); if (r.ok) { const j = (await r.json()) as GeoJSON.FeatureCollection; if (j.features?.length) { trGeo = j; trGeoDone = true; bump(); return; } } } catch {}
          // без Supabase (UI-режим) — публичный файл границ il
          for (const u of ["https://raw.githubusercontent.com/alpers/Turkey-Maps-GeoJSON/master/tr-cities.json", "https://raw.githubusercontent.com/cihadturhan/tr-geojson/master/geo/tr-cities-utf8.json"]) {
            try { const r = await fetch(u); if (r.ok) { trGeo = await r.json(); trGeoDone = true; bump(); return; } } catch {}
          }
          trGeoDone = true; bump();
        })();
      }
      let drewPoly = false;
      if (lvl === "il" && trGeo) {
        const keyByNorm: Record<string, string> = {}; GEO.forEach((x) => { keyByNorm[norm(x.n)] = x.k; });
        const keyOf = (ft: GeoJSON.Feature) => { const p = (ft.properties || {}) as Record<string, string>; return p.k && GEO.some((x) => x.k === p.k) ? p.k : keyByNorm[norm(p.name || p.NAME || p.Name || p.il_adi)]; };
        try {
          const gj = L.geoJSON(trGeo, {
            style: (ft) => { const st = ft && stats[keyOf(ft)]; return st ? { color: "#5f7355", weight: 1, fillColor: colOf(st.med), fillOpacity: 0.5 } : EMPTY_STYLE; },
            onEachFeature: (ft, ly) => {
              const k = keyOf(ft); const st = k && stats[k];
              if (!st) { ly.bindTooltip(`<b>${((ft.properties || {}) as Record<string, string>).name || ilName(k || "")}</b> · 0`, { sticky: true }); return; }
              grpLayers.push(ly);
              ly.bindTooltip(tip(k), { sticky: true });
              ly.on("click", drill(k));
              ly.on("mouseover", () => (ly as L.Path).setStyle({ weight: 2.4, fillOpacity: 0.68 }));
              ly.on("mouseout", () => (ly as L.Path).setStyle({ weight: 1, fillOpacity: 0.5 }));
            },
          });
          lg.addLayer(gj); drewPoly = true;
        } catch { drewPoly = false; }
      }
      let subPolys: Poly[] | null = null;
      if (lvl !== "il") {
        const ck = `${lvl}:${lvl === "ilce" ? mapIl : mapIlce}`;
        if (geoSub[ck]) subPolys = geoSub[ck];
        else void loadGeo(ck, lvl === "ilce" ? geoUrl(`level=ilce&il=${encodeURIComponent(mapIl)}`) : geoUrl(`level=mahalle&ilce=${encodeURIComponent(mapIlce)}`), bump);
      }
      const full: Poly[] = [];
      if (subPolys && !drewPoly) {
        // зона → ключ группы объектов (по ключу справочника, иначе по имени)
        const keyOfPoly = (p: Poly) => (stats[p.k] ? p.k : Object.keys(stats).find((k) => sameName(p.name, nameOf(lvl, k))) ?? "");
        const used = new Set<string>();
        const empty: Poly[] = [];
        subPolys.forEach((p) => { const k = keyOfPoly(p); if (k && !used.has(k)) { used.add(k); full.push({ ...p, k }); } else empty.push(p); });
        empty.forEach((p) => {
          const pl = L.geoJSON(p.geom, { style: EMPTY_STYLE, interactive: true });
          pl.bindTooltip(`<b>${p.name}</b> · 0`, { sticky: true });
          pl.on("mouseover", () => pl.setStyle(EMPTY_HOVER));
          pl.on("mouseout", () => pl.setStyle(EMPTY_STYLE));
          lg.addLayer(pl); grpLayers.push(pl); // вся территория целиком попадает в кадр
        });
        full.forEach((p) => {
          const k = p.k;
          const pl = L.geoJSON(p.geom, { style: { color: "#5f7355", weight: 1.2, fillColor: colOf(stats[k].med), fillOpacity: 0.42 } });
          pl.bindTooltip(tip(k), { sticky: true });
          pl.on("click", drill(k));
          pl.on("mouseover", () => pl.setStyle({ weight: 2.4, fillOpacity: 0.6 }));
          pl.on("mouseout", () => pl.setStyle({ weight: 1.2, fillOpacity: 0.42 }));
          lg.addLayer(pl); grpLayers.push(pl);
        });
      }
      grpReady = lvl === "il" ? !!trGeo || trGeoDone : !!subPolys;
      objs.forEach((o) => {
        lls.push(o.ll);
        const d = L.circleMarker(o.ll, { radius: 5.5, color: "#fff", weight: 1.5, fillColor: o.st === "sold" ? "#8a93a2" : o.st === "reserved" ? "#f0ad00" : "#3b5fd6", fillOpacity: 0.95 });
        d.bindTooltip(o.tip, { direction: "top", opacity: 1, interactive: true });
        d.on("tooltipopen", (e) => { const t = (e as L.TooltipEvent).tooltip.getElement(); if (t) { t.style.cursor = "pointer"; t.onclick = () => openHref(o.href); } });
        d.on("click", (e) => {
          if (!touchMode()) { openHref(o.href); return; }
          L.DomEvent.stop(e);
          if (tapped.current === o.id) { tapped.current = null; openHref(o.href); return; }
          tapped.current = o.id; markers.current.forEach((mk, k) => { if (k !== o.id) mk.closeTooltip(); }); d.openTooltip();
        });
        markers.current.set(o.id, d);
        lg.addLayer(d);
      });
    }
    // Кадр: один раз на уровень/территорию, когда полигоны загружены (правило пользователя 09.10.2026: без «моргания»,
    // область целиком в видимой части). Отступы — под крошки/подсказку сверху и легенду снизу.
    const fitKey = `${lvl}:${mapIl}:${mapIlce}:${semtsKey}`;
    const ready = (lvl === "obj" ? objReady : grpReady) && h > 0; // h > 0 — высота после пристыковки уже измерена
    if (ready && fitKey !== lastFit.current) {
      lastFit.current = fitKey;
      m.invalidateSize({ animate: false }); // высота контейнера уже изменена пристыковкой, ResizeObserver сработает позже
      const pad = { paddingTopLeft: [24, 70] as L.PointExpression, paddingBottomRight: [24, 76] as L.PointExpression };
      if (lvl === "obj" && selOutlines.length) m.fitBounds(L.featureGroup(selOutlines).getBounds(), pad);
      else if (lvl !== "obj" && grpLayers.length) { try { m.fitBounds(L.featureGroup(grpLayers).getBounds(), pad); } catch (e) { console.warn("[map] fit", e); if (lls.length) m.fitBounds(L.latLngBounds(lls), { ...pad, maxZoom: 12 }); } }
      else if (lls.length) m.fitBounds(L.latLngBounds(lls), { ...pad, maxZoom: lvl === "obj" ? 15 : lvl === "semt" ? 14 : 12 });
    }
  }, [items, lvl, mapIl, mapIlce, semtsKey, f.semts, tick, h]);

  // Crumbs, «level up», legend (prototype lines 3230–3239)
  const crumb = "Türkiye" + (f.il ? " › " + ilName(f.il) : "") + (f.ilces.length ? " › " + f.ilces.map(ilceName).join(", ") : "") + (f.semts.length ? " › " + f.semts.map(semtName).join(", ") : "");
  const canUp = !!(f.il || f.ilces.length || f.semts.length);
  const up = () => { if (f.semts.length) set({ semts: [] }); else if (f.ilces.length) set({ ilces: [] }); else if (f.il) set({ il: "" }); };
  let legend: [string, string] | null = null;
  if (items.length && lvl !== "obj") {
    const lg: Record<string, number[]> = {}; items.forEach((o) => { const k = o[lvl]; if (k) (lg[k] = lg[k] || []).push(o.price); });
    const meds = Object.values(lg).map((ps) => { ps.sort((a, b) => a - b); return ps[Math.floor(ps.length / 2)]; });
    if (meds.length > 1) legend = [fmtShort(Math.min(...meds)), fmtShort(Math.max(...meds))];
  }

  return (
    <div ref={wrapRef} className="relative z-0 mx-[calc(50%-50vw)] overflow-hidden border-y border-line bg-surface [isolation:isolate]" style={{ height: h ? h : "calc(100dvh - 88px)" }}>
      <div ref={ref} id="opl-map" className="h-full" />
      <div className="absolute left-[56px] top-3 z-800 flex max-w-[calc(100%-76px)] flex-wrap items-center gap-2">
        <span className="max-w-full truncate rounded-[10px] bg-surface px-[13px] py-[9px] text-[12.5px] font-bold text-ink shadow-[0_4px_14px_rgba(20,36,63,.2)]">{crumb}</span>
        {canUp && <button type="button" onClick={up} className="inline-flex cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[10px] bg-ink px-[13px] py-[9px] text-[12.5px] font-bold text-white shadow-[0_4px_14px_rgba(20,36,63,.2)] hover:bg-blue-2"><IconArrowBackUp size={15} /> {t.cat.mapUp}</button>}
        {hint && lvl !== "obj" && <span className="hidden max-w-[520px] rounded-[10px] bg-surface/90 px-[11px] py-[7px] text-[11.5px] leading-[1.35] text-muted shadow-[0_4px_14px_rgba(20,36,63,.14)] md:block">{hint}</span>}
      </div>
      {legend && (
        <div className="absolute bottom-[14px] left-[14px] z-800 rounded-[12px] bg-surface px-[14px] py-[10px] shadow-[0_6px_20px_rgba(20,36,63,.18)]">
          <div className="mb-[6px] text-[10px] font-bold uppercase tracking-[.05em] text-muted">{t.cat.legend}</div>
          <div className="flex items-center gap-2"><span className="text-[11px] font-bold text-ink">{legend[0]}</span><span className="h-2 w-[110px] rounded-[4px]" style={{ background: "linear-gradient(to right,hsl(115,52%,64%),hsl(65,52%,58%),hsl(15,52%,52%))" }} /><span className="text-[11px] font-bold text-ink">{legend[1]}</span></div>
        </div>
      )}
    </div>
  );
}
