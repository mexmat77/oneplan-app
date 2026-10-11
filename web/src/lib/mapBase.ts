"use client";
// Общая основа всех карт (09.10.2026, по образцу Emlakjet/Endeksa): векторная подложка OpenFreeMap (стиль «liberty», тайлы
// OpenMapTiles на данных OSM, бесплатно и без ключа) через MapLibre GL внутри Leaflet; без WebGL — растровые тайлы OSM.
// Кнопки масштаба — справа внизу, стиль «пилюля» (globals.css `.leaflet-control-zoom`). `makeResizable` — карту можно
// растянуть за уголок, как поле описания.
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "maplibre-gl/dist/maplibre-gl.css";
import "@maplibre/maplibre-gl-leaflet";
import { setWorkerUrl } from "maplibre-gl";
// Воркер MapLibre лежит в public/ (копия node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs, версия как в package.json):
// Next отдаёт модульный воркер из бандла как HTML → «Worker failed to load», карта пустая. Обновлять вместе с пакетом.
if (typeof window !== "undefined") { try { setWorkerUrl("/maplibre-gl-worker.mjs"); } catch { /* старая сборка без API */ } }

export const BASE_STYLE = "https://tiles.openfreemap.org/styles/liberty";
const OSM = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const ATTR_VECTOR = '<a href="https://openfreemap.org" target="_blank" rel="noopener">OpenFreeMap</a> © <a href="https://www.openmaptiles.org/" target="_blank" rel="noopener">OpenMapTiles</a> · © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';
const ATTR_RASTER = '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>';

const hasWebGL = () => { try { const c = document.createElement("canvas"); return !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { return false; } };

/** Подложка: вектор (MapLibre) или растр OSM. */
export function addBaseLayer(m: L.Map): void {
  if (hasWebGL()) {
    try { L.maplibreGL({ style: BASE_STYLE, attribution: ATTR_VECTOR } as unknown as L.LeafletMaplibreGLOptions).addTo(m); return; } catch { /* падение WebGL — ниже растр */ }
  }
  L.tileLayer(OSM, { attribution: ATTR_RASTER, maxZoom: 19 }).addTo(m);
}

/** Карта с нашей подложкой и кнопками масштаба справа внизу. */
export function createMap(el: HTMLElement, opts: L.MapOptions = {}): L.Map {
  // Подпись без префикса Leaflet (в нём флаг): только обязательные © OpenMapTiles / OpenStreetMap и OpenFreeMap — нейтрально (правило пользователя 10.10.2026)
  const m = L.map(el, { zoomControl: false, attributionControl: false, ...opts });
  L.control.attribution({ prefix: false, position: "bottomright" }).addTo(m);
  L.control.zoom({ position: "bottomright", zoomInTitle: "+", zoomOutTitle: "−" }).addTo(m);
  addBaseLayer(m);
  return m;
}

/** Растягивание карты за уголок (как textarea): CSS `resize: vertical` + перерасчёт размера Leaflet. Возвращает disposer. */
export function makeResizable(el: HTMLElement, m: L.Map, minH = 200, maxH = Math.round(window.innerHeight * 0.85)): () => void {
  el.style.resize = "vertical"; el.style.minHeight = `${minH}px`; el.style.maxHeight = `${maxH}px`;
  el.classList.add("opl-map-resizable");
  if (typeof ResizeObserver === "undefined") return () => {};
  let raf = 0;
  const ro = new ResizeObserver(() => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => m.invalidateSize()); });
  ro.observe(el);
  return () => { ro.disconnect(); cancelAnimationFrame(raf); };
}
