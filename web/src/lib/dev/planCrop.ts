"use client";

// Вырезка квартиры с поэтажного плана по контуру → картинка типа планировки (`PlanType.autoImgs[uid]`).
//   cropPolygon(imgSrc, poly, w, h)  — canvas: bbox контура (+поле ≈4%, ≥24px), белый фон, клип по контуру,
//                                      расширенному от центроида на ≈3% (чтобы стены попали в кадр), ≤1600px по стороне → PNG.
//   syncUnitCrop(objId, plan, area, unit) — crop → Storage `dev/<id>/plans/auto` → автотип квартиры → `setPlanTypeAutoImg`.
//   scheduleUnitCrop(objId, planKey, uid) — дебаунс 1500 мс на квартиру (после замыкания/выравнивания/перетаскивания);
//   при срабатывании контур читается из стора заново, поэтому всегда режется актуальная версия. `useCropBusy()` — uid в работе
//   (индикатор у контура). Ошибки загрузки картинки без CORS («tainted» canvas) — reject с понятным текстом.
//   runMirrorSplit(objId) — зеркальные типы `Tip A-L`/`Tip A-R` по контурам (`applyMirrorSplit`): после каждой вырезки,
//   после «Обновить планировки с плана» (один раз в конце) и по кнопке «Найти зеркальные» в модалке планировок.
import { useSyncExternalStore } from "react";
import { uploadFile } from "@/lib/upload";
import { getDev, mutate, removePlanTypeAutoImg, setPlanTypeAutoImg, setPlanTypes, touch } from "@/store/dev";
import { centroid, deskewAngle, rotatePts, type Pt } from "./floorplan";
import { applyMirrorSplit, buildAutoTypes, ensureAutoType, ptFor, ptTagOf } from "./planTypes";
import type { FloorPlan, FloorPlanArea, Unit } from "./types";

export type CropOpts = {
  /** Поле вокруг bbox контура — доля большей стороны bbox (по умолчанию 0.04). */
  pad?: number;
  /** Минимальное поле в пикселях исходника (24). */
  minPadPx?: number;
  /** Расширение контура от центроида (0.03 → ×1.03). */
  grow?: number;
  /** Максимальная сторона результата (1600). */
  maxSide?: number;
  /** Фон под клипом. */
  bg?: string;
};

export class CropError extends Error {
  constructor(message: string, readonly code: "load" | "tainted" | "canvas" | "poly") { super(message); this.name = "CropError"; }
}

// Декодированные картинки планов (экспликация может быть 100+ Мп — декодировать на каждую вырезку дорого); держим пару последних.
const imgCache = new Map<string, Promise<HTMLImageElement>>();
const IMG_CACHE_MAX = 2;

/** Загрузить картинку для canvas: с `crossOrigin="anonymous"` (как в `planEdges.ts`); `blob:`/`data:` — без него. Кэш по src. */
export function loadPlanImage(src: string): Promise<HTMLImageElement> {
  const hit = imgCache.get(src);
  if (hit) return hit;
  const p = new Promise<HTMLImageElement>((resolve, reject) => {
    if (typeof window === "undefined" || !src) { reject(new CropError("no image", "load")); return; }
    const img = new Image();
    if (!/^(blob|data):/.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => { imgCache.delete(src); reject(new CropError(img.crossOrigin ? "plan image is not available for cropping (CORS)" : "plan image failed to load", "load")); };
    img.src = src;
  });
  if (src && typeof window !== "undefined") {
    if (imgCache.size >= IMG_CACHE_MAX) imgCache.delete(imgCache.keys().next().value as string);
    imgCache.set(src, p);
  }
  return p;
}

/** Контур, расширенный от центроида на `grow` (×(1+grow)), в нормализованных координатах. */
export function growPoly(poly: Pt[], grow: number): Pt[] {
  const [cx, cy] = centroid(poly);
  const k = 1 + grow;
  return poly.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k]);
}

/**
 * Вырезать фрагмент плана по контуру. `poly` — нормализованные 0..1 координаты; `w`/`h` — размеры плана из стора
 * (используются, если у картинки нет natural-размеров). Результат — PNG-blob.
 */
export async function cropPolygon(imgSrc: string, poly: Pt[], w: number, h: number, opts: CropOpts = {}): Promise<Blob> {
  const { pad = 0.04, minPadPx = 24, grow = 0.03, maxSide = 1400, bg = "#fff" } = opts;
  if (!poly || poly.length < 3) throw new CropError("outline needs at least 3 points", "poly");
  const img = await loadPlanImage(imgSrc);
  const iw = img.naturalWidth || w, ih = img.naturalHeight || h;
  if (!iw || !ih) throw new CropError("plan image has no size", "load");
  // контур в пикселях исходника, расширенный от центроида
  const px = growPoly(poly, grow).map(([x, y]) => [x * iw, y * ih] as Pt);
  // выпрямление: квартира в доме «дугой» стоит на плане под углом — поворачиваем вырезку так, чтобы стены шли ровно
  const ang0 = deskewAngle(px);
  const ang = Math.abs(ang0) > 0.035 ? ang0 : 0; // меньше ~2° не трогаем
  const c0 = centroid(px);
  const rp = ang ? rotatePts(px, ang, c0) : px;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  rp.forEach(([x, y]) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; });
  const padPx = Math.max(minPadPx, pad * Math.max(x1 - x0, y1 - y0));
  const bx = Math.floor(x0 - padPx), by = Math.floor(y0 - padPx);
  const bw = Math.ceil(x1 + padPx) - bx, bh = Math.ceil(y1 + padPx) - by;
  if (bw < 2 || bh < 2) throw new CropError("outline is too small", "poly");
  // мелкую квартиру на общем листе не раздуваем больше чем вдвое — иначе картинка «мыльная»
  const k = Math.min(2, maxSide / Math.max(bw, bh));
  const cw = Math.max(1, Math.round(bw * k)), ch = Math.max(1, Math.round(bh * k));
  const cv = document.createElement("canvas");
  cv.width = cw; cv.height = ch;
  const ctx = cv.getContext("2d");
  if (!ctx) throw new CropError("canvas is not available", "canvas");
  ctx.fillStyle = bg; ctx.fillRect(0, 0, cw, ch);
  ctx.imageSmoothingQuality = "high";
  ctx.save();
  ctx.scale(k, k);
  ctx.translate(-bx, -by);
  if (ang) { ctx.translate(c0[0], c0[1]); ctx.rotate(ang); ctx.translate(-c0[0], -c0[1]); }
  ctx.beginPath();
  px.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
  ctx.closePath();
  ctx.clip();
  // рисуем только нужный кусок исходника (bbox исходного контура с полем)
  let sx0 = Infinity, sy0 = Infinity, sx1 = -Infinity, sy1 = -Infinity;
  px.forEach(([x, y]) => { if (x < sx0) sx0 = x; if (y < sy0) sy0 = y; if (x > sx1) sx1 = x; if (y > sy1) sy1 = y; });
  const qx = Math.max(0, Math.floor(sx0 - 2)), qy = Math.max(0, Math.floor(sy0 - 2));
  const qw = Math.min(iw, Math.ceil(sx1 + 2)) - qx, qh = Math.min(ih, Math.ceil(sy1 + 2)) - qy;
  if (qw > 0 && qh > 0) ctx.drawImage(img, qx, qy, qw, qh, qx, qy, qw, qh);
  ctx.restore();
  return new Promise<Blob>((resolve, reject) => {
    try {
      cv.toBlob((b) => (b ? resolve(b) : reject(new CropError("canvas export failed", "canvas"))), "image/jpeg", 0.86);
    } catch (e) {
      // SecurityError: картинка с чужого домена без CORS → canvas «tainted»
      reject(new CropError(e instanceof DOMException && e.name === "SecurityError" ? "plan image is not available for cropping (CORS)" : e instanceof Error ? e.message : String(e), "tainted"));
    }
  });
}

/** Квартира, для которой имеет смысл тип планировки (`ptFor` для `''`/`1*` возвращает null). */
const hasPtType = (u: Unit) => !!u.type && u.type !== "1*";

/**
 * Вырезать квартиру с плана, загрузить в Storage и записать в её тип планировки (создав автотип при отсутствии).
 * Возвращает URL картинки или null, если у квартиры нет типа (`''`/`1*`).
 */
export async function syncUnitCrop(objId: number, plan: FloorPlan, area: FloorPlanArea, unit: Unit, planKey = ""): Promise<string | null> {
  if (!hasPtType(unit)) return null;
  const blob = await cropPolygon(plan.img, area.poly, plan.w, plan.h);
  const up = await uploadFile(new File([blob], `unit-${unit.uid}${planKey ? "-" + planKey.replace(/[^a-z0-9]+/gi, "_") : ""}.jpg`, { type: "image/jpeg" }), `dev/${objId}/plans/auto`);
  // тип квартиры: `ptId` → rooms+area → создать автотип
  const s = getDev();
  let list = s.planTypes[objId] ?? buildAutoTypes(s.units[objId] ?? []);
  // Сначала убеждаемся, что точный автотип квартиры (комнаты + площадь + тег) существует: иначе `ptFor` отдал бы
  // «первый тип той же комнатности», и вырезка легла бы в чужой тип (квартира без площади → картинка у «3+1 · 106 м²»).
  if (!unit.ptId) list = ensureAutoType(list, unit.type, unit.area, unit.wing, ptTagOf(unit)).list;
  let pt = ptFor(list, unit);
  if (!pt) { const r = ensureAutoType(list, unit.type, unit.area, unit.wing, ptTagOf(unit)); list = r.list; pt = r.type; }
  if (list !== s.planTypes[objId]) setPlanTypes(objId, list);
  setPlanTypeAutoImg(objId, pt.id, unit.uid, up.url, planKey);
  if (!mirrorHold) runMirrorSplit(objId);
  return up.url;
}

// ───── зеркальные типы по контурам ─────
let mirrorHold = 0; // >0 — массовая вырезка идёт, split запускается один раз в конце
/**
 * Найти зеркальные планировки по контурам плана и разделить типы (`applyMirrorSplit`) — одной мутацией стора.
 * Возвращает { created — новых `-R` типов за этот запуск, total — всего зеркальных типов у объекта }.
 */
export function runMirrorSplit(objId: number): { created: number; moved: number; total: number } {
  let created = 0, moved = 0, total = 0;
  mutate((s) => {
    const project = s.projects.find((p) => p.id === objId);
    const units = s.units[objId] ?? [];
    const list = s.planTypes[objId] ?? buildAutoTypes(units);
    if (!project) return s;
    const r = applyMirrorSplit(list, units, project);
    created = r.created; moved = r.moved;
    total = r.list.filter((x) => x.mirrorOf).length;
    if (r.list === list && r.units === units && s.planTypes[objId]) return s; // ничего не изменилось (в т.ч. имена -L/-R)
    return { ...s, planTypes: { ...s.planTypes, [objId]: r.list }, units: r.created || r.moved ? { ...s.units, [objId]: r.units } : s.units };
  });
  if (created || moved) touch();
  return { created, moved, total };
}

// ───── очередь: дебаунс на квартиру + индикатор «в работе» ─────
const timers = new Map<string, ReturnType<typeof setTimeout>>();
const chains = new Map<string, Promise<unknown>>();
const busySet = new Set<number>();
let busySnap: number[] = [];
const busyListeners = new Set<() => void>();
const setBusy = (uid: number, on: boolean) => {
  if (on ? busySet.has(uid) : !busySet.has(uid)) return;
  if (on) busySet.add(uid); else busySet.delete(uid);
  busySnap = [...busySet];
  busyListeners.forEach((l) => l());
};
const subBusy = (l: () => void) => { busyListeners.add(l); return () => { busyListeners.delete(l); }; };
const EMPTY: number[] = [];
/** uid квартир, чьи вырезки сейчас режутся/грузятся (общий список по объектам — индикатор читают только экраны текущего объекта). */
export function useCropBusy(): number[] { return useSyncExternalStore(subBusy, () => busySnap, () => EMPTY); }
export const isCropBusy = (uid: number) => busySet.has(uid);

const tkey = (objId: number, uid: number) => `${objId}|${uid}`;

/**
 * Вырезать квартиру `uid` по актуальному контуру из стора. Если контура уже нет — снимает авто-картинку.
 * Возвращает true, если картинка записана. Ошибки crop/upload — throw (вызывающий показывает тост).
 */
export async function runUnitCrop(objId: number, planKey: string, uid: number): Promise<boolean> {
  const s = getDev();
  const plan = s.projects.find((p) => p.id === objId)?.floorPlans?.[planKey];
  const area = plan?.areas.find((a) => a.uid === uid);
  const unit = (s.units[objId] ?? []).find((u) => u.uid === uid);
  if (!plan?.img || !area || !unit) { removePlanTypeAutoImg(objId, uid, planKey); return false; }
  setBusy(uid, true);
  try { return (await syncUnitCrop(objId, plan, area, unit, planKey)) != null; }
  finally { setBusy(uid, false); }
}

/** Отложенная вырезка (дебаунс на квартиру): повторный вызов сдвигает таймер; одновременно для одного uid — по очереди. */
export function scheduleUnitCrop(objId: number, planKey: string, uid: number, onError?: (e: Error) => void, delay = 1500) {
  const k = tkey(objId, uid);
  const old = timers.get(k);
  if (old) clearTimeout(old);
  timers.set(k, setTimeout(() => {
    timers.delete(k);
    const prev = chains.get(k) ?? Promise.resolve();
    const next = prev.catch(() => undefined).then(() => runUnitCrop(objId, planKey, uid)).catch((e) => onError?.(e instanceof Error ? e : new Error(String(e))));
    chains.set(k, next);
    next.finally(() => { if (chains.get(k) === next) chains.delete(k); });
  }, delay));
}

/** Отменить отложенную вырезку (контур удалён). */
export function cancelUnitCrop(objId: number, uid: number) {
  const k = tkey(objId, uid);
  const old = timers.get(k);
  if (old) { clearTimeout(old); timers.delete(k); }
}

/** Удалить контур → снять отложенную задачу и авто-картинку из типов. */
export function dropUnitCrop(objId: number, uid: number, planKey?: string) {
  cancelUnitCrop(objId, uid);
  removePlanTypeAutoImg(objId, uid, planKey);
}

/**
 * Прогнать все обведённые квартиры плана (кнопка «Обновить планировки с плана»): последовательно, с прогрессом.
 * Возвращает число успешно записанных и список ошибок.
 */
export async function syncAllCrops(objId: number, planKey: string, onProgress?: (i: number, n: number) => void): Promise<{ done: number; errors: Error[] }> {
  const s = getDev();
  const plan = s.projects.find((p) => p.id === objId)?.floorPlans?.[planKey];
  const units = new Set((s.units[objId] ?? []).map((u) => u.uid));
  const uids = (plan?.areas ?? []).map((a) => a.uid).filter((uid) => units.has(uid));
  const errors: Error[] = [];
  let done = 0;
  mirrorHold++;
  try {
    for (let i = 0; i < uids.length; i++) {
      cancelUnitCrop(objId, uids[i]);
      onProgress?.(i, uids.length);
      try { if (await runUnitCrop(objId, planKey, uids[i])) done++; }
      catch (e) { errors.push(e instanceof Error ? e : new Error(String(e))); }
    }
  } finally { mirrorHold--; }
  runMirrorSplit(objId);
  onProgress?.(uids.length, uids.length);
  return { done, errors };
}
