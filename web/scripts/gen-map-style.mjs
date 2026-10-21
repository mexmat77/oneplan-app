#!/usr/bin/env node
// Стиль подложки карты «в духе Apple Maps» (22.10.2026, просьба пользователя «такие же скины, как у карты в ChatGPT»):
// берём стиль OpenFreeMap «liberty» (те же тайлы, спрайты и шрифты) и переопределяем только цвета/видимость слоёв —
// тёплая светлая земля, нежно-голубая вода, спокойные парки, песочные дома с мягкой обводкой, белые дороги с серой каймой,
// жёлтый только у автомагистралей, дома плоские (без 3D), без автобусных остановок и мелких заведений на средних масштабах, подписи улиц серые.
// Данные, хороплет, пины и логика карт не затрагиваются. Результат — web/public/map-style.json (подключён в lib/mapBase.ts).
// Запуск: cd web && node scripts/gen-map-style.mjs   (после обновления стиля upstream — перегенерировать).
import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const SRC = "https://tiles.openfreemap.org/styles/liberty";
const out = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "map-style.json");

const C = {
  land: "#f4f1ec", residential: "hsla(32,14%,91%,0.55)",
  park: "#cfe7bb", parkLine: "#bddca6", wood: "hsla(98,40%,74%,0.55)", grass: "#cfe4bc", pitch: "#d9e7c6", cemetery: "#d8e3c6", hospital: "#f5e8e8", school: "#eeead9",
  sand: "#f5e9c6", water: "#9fd0f2", waterLine: "#9fd0f2", waterText: "#4e8fcb",
  building: "#e7e0d3", buildingLine: "#d2c9ba",
  casing: "#d9d4cc", casingMajor: "#cfc9bf", white: "#ffffff", primary: "#ffffff", primaryCasing: "#c9c2b7", motorway: "#f9e2a1", motorwayCasing: "#e4c67f",
  rail: "#c9c4bc", boundary: "#b8b3ab", road: "#6f6f6f", poi: "#6a6a6a",
};

/** paint-переопределения по id слоя (только цвета) */
const PAINT = {
  background: { "background-color": C.land },
  park: { "fill-color": C.park, "fill-opacity": 0.85, "fill-outline-color": C.parkLine },
  park_outline: { "line-color": C.parkLine },
  landuse_residential: { "fill-color": C.residential },
  landcover_wood: { "fill-color": C.wood },
  landcover_grass: { "fill-color": C.grass },
  landuse_pitch: { "fill-color": C.pitch }, landuse_track: { "fill-color": C.pitch }, landuse_cemetery: { "fill-color": C.cemetery },
  landuse_hospital: { "fill-color": C.hospital }, landuse_school: { "fill-color": C.school },
  waterway_tunnel: { "line-color": C.waterLine }, waterway_river: { "line-color": C.waterLine }, waterway_other: { "line-color": C.waterLine },
  water: { "fill-color": C.water },
  landcover_sand: { "fill-color": C.sand },
  building: { "fill-color": C.building, "fill-outline-color": C.buildingLine },
  "building-3d": { "fill-extrusion-color": C.building, "fill-extrusion-opacity": 0.6 },
  boundary_3: { "line-color": C.boundary }, boundary_2: { "line-color": "#9a948b" }, boundary_disputed: { "line-color": "#9a948b" },
  waterway_line_label: { "text-color": C.waterText }, water_name_point_label: { "text-color": C.waterText }, water_name_line_label: { "text-color": C.waterText },
  "highway-name-path": { "text-color": "#8f8a82" }, "highway-name-minor": { "text-color": C.road }, "highway-name-major": { "text-color": C.road },
  poi_r20: { "text-color": C.poi }, poi_r7: { "text-color": C.poi }, poi_r1: { "text-color": C.poi },
};
/** дороги: по суффиксу id для tunnel_/road_/bridge_ */
const ROAD = {
  motorway_casing: { "line-color": C.motorwayCasing }, motorway: { "line-color": C.motorway },
  motorway_link_casing: { "line-color": C.motorwayCasing }, motorway_link: { "line-color": C.motorway },
  trunk_primary_casing: { "line-color": C.primaryCasing }, trunk_primary: { "line-color": C.primary },
  link_casing: { "line-color": C.primaryCasing }, link: { "line-color": C.primary },
  secondary_tertiary_casing: { "line-color": C.casingMajor }, secondary_tertiary: { "line-color": C.white },
  minor_casing: { "line-color": C.casing }, minor: { "line-color": C.white },
  street_casing: { "line-color": C.casing }, street: { "line-color": C.white },
  service_track_casing: { "line-color": C.casing }, service_track: { "line-color": C.white },
  path_pedestrian_casing: { "line-color": C.casing }, path_pedestrian: { "line-color": C.white },
  major_rail: { "line-color": C.rail }, major_rail_hatching: { "line-color": C.rail }, transit_rail: { "line-color": C.rail }, transit_rail_hatching: { "line-color": C.rail },
};
/** скрытые слои: объёмные дома (у Apple дома плоские) */
const HIDE = new Set(["building-3d"]);
/** видимость: меньше шума на средних масштабах */
const MINZOOM = { poi_transit: 17, poi_r1: 16.5, poi_r7: 16 };

const style = await (await fetch(SRC)).json();
let patched = 0;
for (const l of style.layers) {
  const p = PAINT[l.id];
  if (p) { l.paint = { ...(l.paint ?? {}), ...p }; patched++; }
  const m = l.id.match(/^(tunnel|road|bridge)_(.+)$/);
  if (m && ROAD[m[2]]) { l.paint = { ...(l.paint ?? {}), ...ROAD[m[2]] }; patched++; }
  if (MINZOOM[l.id] !== undefined) { l.minzoom = Math.max(l.minzoom ?? 0, MINZOOM[l.id]); patched++; }
  if (HIDE.has(l.id)) { l.layout = { ...(l.layout ?? {}), visibility: "none" }; patched++; }
  if (l.id === "building") { delete l.maxzoom; patched++; } // в liberty плоские дома только до z14 (дальше 3D) — у нас плоские всегда
}
style.name = "OnePlan light";
writeFileSync(out, JSON.stringify(style));
console.log(`map style: ${style.layers.length} layers, ${patched} patched → ${out}`);
