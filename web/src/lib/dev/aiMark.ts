"use client";

// ИИ-разметка поэтажного плана в два прохода — так, как это делает человек: сначала окинуть лист, потом рассмотреть каждую
// квартиру крупно.
//   1. Поиск. Маленький лист (одна секция, ≤ 12 квартир) уходит в модель целиком. Большой лист (всё здание, десятки мелких
//      квартир) режется на перекрывающиеся фрагменты в ПОЛНОМ разрешении — на уменьшенном целом листе модель не различает
//      стены, отсюда контуры «мимо». Каждый фрагмент размечается отдельно (`detectFloorAreas` с `tile`), результаты склеиваются:
//      для квартиры берётся вариант из того фрагмента, где она видна целиком (не упирается в край).
//   2. Уточнение (`refineUnitArea`). Для каждой найденной квартиры вырезается крупный фрагмент вокруг грубого контура, и
//      модель возвращает точный контур по стенам. Результат проверяется (площадь и положение близки к грубому), иначе
//      остаётся грубый контур.
//   Затем контуры подравниваются по чертежу (`orthoSnap` + `snapToEdges`) и записываются в стор.
//   Стоимость: ≈ $0.17 на фрагмент поиска + ≈ $0.05 на квартиру уточнения; время — минуты (запросы идут параллельно).
import { detectFloorAreas, refineUnitArea, type ExpectedUnit, type PlanImage } from "@/app/(dev)/dev/floorplan-actions";
import { getDev, mutUnits, setPlanAreas } from "@/store/dev";
import type { Unit } from "./types";
import { centroid, fpUnits, levelOf, unitFloors, type Pt } from "./floorplan";
import { findFreeApartments, fitUnitsToWalls, grayFromImage, roughSanity, wallScale, type WallFitUnit } from "./planWalls";
import { loadPlanImage } from "./planCrop";
import { blockAt, isSchemeSheet, rgbFromImage, segmentBlocks, type Block } from "./planBlocks";

export type AiMarkResult = { ok: true; found: number; of: number; refined: number; /** контуров, точно подогнанных по стенам чертежа */ walls: number; /** квартир, помеченных дуплексами по внутренней лестнице на плане */ duplex?: number; /** этажи с тем же листом, куда скопированы контуры */ copied?: number[] } | { ok: false; reason: string };
export type AiMarkProgress = { phase: "search" | "refine"; i: number; n: number };
export type AiMarkOpts = {
  /** Второй проход (точные контуры). По умолчанию выключен (см. `NEXT_PUBLIC_FLOORPLAN_REFINE`). */
  refine?: boolean;
  /** Уже размеченные квартиры не искать заново (только новые). */
  keep?: Set<number>;
  onProgress?: (p: AiMarkProgress) => void;
};

const TILE_PX = 1800;      // сторона фрагмента поиска в пикселях исходника
const TILE_OVERLAP = 0.18; // перекрытие фрагментов
const MAX_TILES = 12;
const SEND_MAX = 2000;     // сторона картинки, уходящей в модель
const REFINE_MIN_PX = 700; // минимальный фрагмент уточнения
const PAR = 4;             // параллельных запросов

/** Вырезать область исходника (пиксели) в JPEG-payload для модели, не крупнее `SEND_MAX` по стороне. */
type Overlay = { poly: Pt[]; color: string; width: number; dash?: number[] }; // контур в пикселях исходника
function cropPayload(img: HTMLImageElement, x: number, y: number, w: number, h: number, overlays: Overlay[] = []): PlanImage {
  const k = Math.min(1, SEND_MAX / Math.max(w, h));
  const cv = document.createElement("canvas");
  cv.width = Math.max(1, Math.round(w * k)); cv.height = Math.max(1, Math.round(h * k));
  const ctx = cv.getContext("2d")!;
  ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, x, y, w, h, 0, 0, cv.width, cv.height);
  // «визуальная подсказка»: грубые контуры рисуются поверх фрагмента — модели проще поправить линию, чем искать квартиру с нуля
  overlays.forEach((o) => {
    ctx.beginPath();
    o.poly.forEach(([px, py], i) => { const X = (px - x) * k, Y = (py - y) * k; if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); });
    ctx.closePath();
    ctx.setLineDash(o.dash ?? []); ctx.lineWidth = o.width; ctx.strokeStyle = o.color; ctx.stroke();
  });
  return { data: cv.toDataURL("image/jpeg", 0.85).split(",")[1], mediaType: "image/jpeg" };
}
/** Картинка плана целиком, уменьшенная для модели (если canvas недоступен из-за CORS — URL как есть). */
export async function planPayload(src: string): Promise<PlanImage> {
  try { const img = await loadPlanImage(src); return cropPayload(img, 0, 0, img.naturalWidth, img.naturalHeight); }
  catch { return { url: src }; }
}

const bbox = (poly: Pt[]) => { let x0 = 1, y0 = 1, x1 = 0, y1 = 0; poly.forEach(([x, y]) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; }); return { x0, y0, x1, y1 }; };
const polyArea = (poly: Pt[]) => { let a = 0; for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]; a += x0 * y1 - x1 * y0; } return Math.abs(a) / 2; };
async function runPar<T>(items: T[], n: number, fn: (x: T) => Promise<void>) { const q = [...items]; await Promise.all(Array.from({ length: Math.min(n, q.length) }, async () => { for (let it = q.shift(); it !== undefined; it = q.shift()) await fn(it); })); }

/** Разметить этаж одного блока. */
export const aiMarkPlan = (objId: number, wing: string, floor: number, opts?: AiMarkOpts): Promise<AiMarkResult> => aiMarkSheet(objId, [wing], floor, opts);

/**
 * Разметить лист этажа (один блок или несколько блоков на одном рисунке): поиск по фрагментам → уточнение → запись
 * контуров в планы своих блоков.
 */
export async function aiMarkSheet(objId: number, wings: string[], floor: number, opts: AiMarkOpts = {}): Promise<AiMarkResult> {
  const s = getDev();
  const units = s.units[objId] ?? [];
  const plans = s.projects.find((p) => p.id === objId)?.floorPlans ?? {};
  const act = wings.filter((w) => !!plans[`${w || ""}|${floor}`]?.img && fpUnits(units, w, floor).length > 0);
  const plan = act.length ? plans[`${act[0] || ""}|${floor}`] : undefined;
  if (!plan?.img || !/^https?:\/\//.test(plan.img)) return act.length ? { ok: false, reason: "no-image" } : { ok: true, found: 0, of: 0, refined: 0, walls: 0 };
  const expectedAll: ExpectedUnit[] = act.flatMap((w) => fpUnits(units, w, floor).map((u) => ({ uid: u.uid, num: u.num, type: u.type, area: u.area, block: w, levels: unitFloors(u).length })));
  // Готовые контуры (оставленные пользователем) участвуют в геометрии как контекст: по ним комнаты получают хозяев,
  // и общий коридор, в который ведут двери соседей, не достаётся размечаемой квартире.
  const keptRough = opts.keep?.size ? act.flatMap((w) => (plans[`${w || ""}|${floor}`]?.areas ?? []).filter((a) => opts.keep!.has(a.uid) && a.poly?.length >= 3).map((a) => ({ uid: a.uid, poly: a.poly.map((p) => [p[0], p[1]] as Pt) }))) : [];
  const expected = opts.keep ? expectedAll.filter((u) => !opts.keep!.has(u.uid)) : expectedAll;
  const wingOfUid = new Map(act.flatMap((w) => fpUnits(units, w, floor).map((u) => [u.uid, w] as const)));
  if (!expected.length) return { ok: true, found: 0, of: 0, refined: 0, walls: 0 };
  const img = await loadPlanImage(plan.img).catch(() => null);
  const iw = img?.naturalWidth || plan.w || 1000, ih = img?.naturalHeight || plan.h || 700;
  const boxOf = (poly: Pt[]) => { const b = bbox(poly); return `x ${b.x0.toFixed(2)}–${b.x1.toFixed(2)}, y ${b.y0.toFixed(2)}–${b.y1.toFixed(2)}`; };
  const numOf = (uid: number) => `№${expectedAll.find((u) => u.uid === uid)?.num ?? uid}`;
  // Дорисовка части квартир (пользователь оставил готовые контуры): модели сообщаем, где уже стоят остальные, —
  // без этого квартиру без номера на чертеже и без типа/площади в прайсе ей не найти (искать «методом исключения»).
  const keptNote = (() => {
    if (!opts.keep?.size) return undefined;
    const kept = act.flatMap((w) => (plans[`${w || ""}|${floor}`]?.areas ?? []).filter((a) => opts.keep!.has(a.uid) && a.poly?.length >= 3).map((a) => `${numOf(a.uid)} at ${boxOf(a.poly)}`));
    if (!kept.length) return undefined;
    return `IMPORTANT: the floor has ${expectedAll.length} apartments in total; these are ALREADY located and must NOT be returned or overlapped: ${kept.join("; ")}. Find the remaining ${expected.length} apartment(s) from the list: they occupy the rest of the floor (by elimination), even if the drawing shows no apartment numbers and the list gives no type/area for them.`;
  })();

  // Верх дуплексов: лист верхнего уровня — те же квартиры, что этажом ниже, вокруг той же лестницы. Контур нижнего
  // уровня — подсказка модели (где искать) и запасной грубый контур, если модель квартиру не нашла или поставила мимо.
  const lowerRough = new Map<number, Pt[]>();
  expected.forEach((u) => {
    const unit = units.find((x) => x.uid === u.uid); if (!unit || levelOf(unit, floor) !== "upper") return;
    const a = plans[`${u.block || ""}|${floor - 1}`]?.areas.find((x) => x.uid === u.uid); if (a && a.poly.length >= 3) lowerRough.set(u.uid, a.poly.map((p) => [p[0], p[1]] as Pt));
  });
  const upperNote = lowerRough.size ? `IMPORTANT: this sheet is the UPPER level of duplex apartments (bedrooms, bathrooms, terraces around each apartment's own internal staircase). The lower level of each apartment is on the floor below at the same place of the sheet, and the upper level is around the SAME staircase, so it overlaps the lower level's area: ${[...lowerRough.entries()].map(([uid, poly]) => `${numOf(uid)} lower level at ${boxOf(poly)}`).join("; ")}. Return the upper-level outline of every apartment (several rooms, not a narrow strip).` : undefined;
  const firstNote = [keptNote, upperNote].filter(Boolean).join("\n") || undefined;

  // ── 1. поиск ──
  let numbered = false; // на чертеже напечатаны номера квартир — тогда номерам модели можно верить
  const found = new Map<number, { poly: Pt[]; clipped: boolean; area: number }>();
  const stairs = new Set<number>(); // квартиры со своей внутренней лестницей на плане — кандидаты в дуплексы
  const put = (uid: number, poly: Pt[], clipped: boolean) => {
    const a = polyArea(poly), prev = found.get(uid);
    if (!prev || (prev.clipped && !clipped) || (prev.clipped === clipped && a > prev.area)) found.set(uid, { poly, clipped, area: a });
  };
  const big = expected.length > 12 || Math.max(iw, ih) > 2.2 * TILE_PX;
  // Сначала всегда один запрос по всему листу: он говорит, напечатаны ли номера. Без номеров положение квартир
  // определяет геометрия, и долгий поиск по фрагментам (минуты на большом листе) не нужен.
  {
    opts.onProgress?.({ phase: "search", i: 0, n: 1 });
    const res = await detectFloorAreas(img ? cropPayload(img, 0, 0, iw, ih) : { url: plan.img }, expected, { note: firstNote });
    if (!res.ok) return { ok: false, reason: res.reason };
    numbered = res.numbered;
    res.units.forEach((u) => { put(u.uid, u.poly, false); if (u.stairs) stairs.add(u.uid); });
    opts.onProgress?.({ phase: "search", i: 1, n: 1 });
  }
  if (img && big && numbered) {
    // сетка фрагментов с перекрытием; при очень большом листе фрагменты крупнее, чтобы уложиться в MAX_TILES
    let side = TILE_PX;
    let cols = Math.ceil(iw / (side * (1 - TILE_OVERLAP))), rows = Math.ceil(ih / (side * (1 - TILE_OVERLAP)));
    while (cols * rows > MAX_TILES) { side *= 1.25; cols = Math.ceil(iw / (side * (1 - TILE_OVERLAP))); rows = Math.ceil(ih / (side * (1 - TILE_OVERLAP))); }
    const stepX = cols > 1 ? (iw - side) / (cols - 1) : 0, stepY = rows > 1 ? (ih - side) / (rows - 1) : 0;
    const tiles: { x: number; y: number; w: number; h: number }[] = [];
    for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { const x = Math.max(0, Math.round(c * stepX)), y = Math.max(0, Math.round(r * stepY)); tiles.push({ x, y, w: Math.min(side, iw - x), h: Math.min(side, ih - y) }); }
    let done = 0, fatal = "";
    opts.onProgress?.({ phase: "search", i: 0, n: tiles.length });
    await runPar(tiles, PAR, async (tl) => {
      if (fatal) return;
      const res = await detectFloorAreas(cropPayload(img, tl.x, tl.y, tl.w, tl.h), expected, { tile: true });
      if (!res.ok) { if (res.reason === "no-key" || res.reason === "no-session") fatal = res.reason; }
      else { if (res.numbered) numbered = true; res.units.forEach((u) => {
        if (u.stairs) stairs.add(u.uid);
        const poly = u.poly.map(([x, y]) => [(tl.x + x * tl.w) / iw, (tl.y + y * tl.h) / ih] as Pt);
        const b = bbox(u.poly), m = 0.02; // упирается ли контур в край фрагмента (тогда он, скорее всего, обрезан)
        const clipped = (b.x0 < m && tl.x > 0) || (b.y0 < m && tl.y > 0) || (b.x1 > 1 - m && tl.x + tl.w < iw) || (b.y1 > 1 - m && tl.y + tl.h < ih);
        put(u.uid, poly, clipped);
      }); }
      done++; opts.onProgress?.({ phase: "search", i: done, n: tiles.length });
    });
    if (fatal) return { ok: false, reason: fatal };
  }
  if (!found.size) return { ok: true, found: 0, of: expected.length, refined: 0, walls: 0 };

  // ── 2. уточнение ──
  let refined = 0;
  // Второй проход пока экспериментальный: на тестовом листе он ухудшал контуры (модель «поправляла» линию мимо стен).
  // Включается явно: `NEXT_PUBLIC_FLOORPLAN_REFINE=1` — до проверки на наборе реальных планов.
  const refineOn = opts.refine ?? process.env.NEXT_PUBLIC_FLOORPLAN_REFINE === "1";
  if (refineOn && img) {
    const list = [...found.entries()];
    let done = 0;
    opts.onProgress?.({ phase: "refine", i: 0, n: list.length });
    await runPar(list, PAR, async ([uid, f]) => {
      const u = expected.find((x) => x.uid === uid)!;
      const b = bbox(f.poly);
      const bw = (b.x1 - b.x0) * iw, bh = (b.y1 - b.y0) * ih;
      const side = Math.max(REFINE_MIN_PX, Math.max(bw, bh) * 2.4);
      const cx = ((b.x0 + b.x1) / 2) * iw, cy = ((b.y0 + b.y1) / 2) * ih;
      const x = Math.max(0, Math.min(iw - side, cx - side / 2)), y = Math.max(0, Math.min(ih - side, cy - side / 2));
      const w = Math.min(side, iw - x), h = Math.min(side, ih - y);
      const toPx = (poly: Pt[]) => poly.map(([px, py]) => [px * iw, py * ih] as Pt);
      // на фрагменте рисуем: красным — грубый контур этой квартиры, серым пунктиром — соседей (чтобы модель их не захватила)
      const overlays: Overlay[] = [...found.entries()].filter(([o]) => o !== uid).map(([, g]) => ({ poly: toPx(g.poly), color: "rgba(90,90,90,.75)", width: 3, dash: [10, 8] }));
      overlays.push({ poly: toPx(f.poly), color: "#e5322d", width: 4 });
      const res = await refineUnitArea(cropPayload(img, x, y, w, h, overlays), u, [(cx - x) / w, (cy - y) / h]).catch(() => null);
      if (res && res.ok && res.poly && res.poly.length >= 3) {
        const poly = res.poly.map(([px, py]) => [(x + px * w) / iw, (y + py * h) / ih] as Pt);
        // принимаем, если новый контур — правка грубого, а не другая квартира: центр рядом, площадь близка
        const [ccx, ccy] = centroid(poly), [rcx, rcy] = centroid(f.poly), ratio = polyArea(poly) / (f.area || 1e-9);
        const nearby = Math.abs(ccx - rcx) * iw < Math.max(bw, bh) * 0.5 && Math.abs(ccy - rcy) * ih < Math.max(bw, bh) * 0.5;
        if (nearby && ratio > 0.5 && ratio < 2) { found.set(uid, { poly, clipped: false, area: polyArea(poly) }); refined++; }
      }
      done++; opts.onProgress?.({ phase: "refine", i: done, n: list.length });
    });
  }

  // ── 2¼. блок-схема этажа (квартира — цветной блок с подписью): контуры — по границам цветных областей ──
  // Стен и дверей нет, геометрия по стенам неприменима. Полигон модели нужен только чтобы найти блок (по центру);
  // без напечатанных номеров — блоки раздаются по типу и порядку чтения (площади на схеме не в масштабе).
  const rgb = img ? rgbFromImage(img) : null;
  const blocks = rgb ? segmentBlocks(rgb) : [];
  const schemeMode = !!rgb && isSchemeSheet(rgb, blocks);
  if (schemeMode) console.log(`[planBlocks] scheme sheet: ${blocks.length} blocks, ${found.size} AI polygons, numbered=${numbered}`);
  const perLevel0 = (u: ExpectedUnit) => { const unit = units.find((x) => x.uid === u.uid); const lv = unit ? unitFloors(unit).length : 1; return u.area ? u.area / lv : 0; };
  const schemeMap = new Map<number, Pt[]>();
  if (schemeMode) {
    const usedB = new Set<Block>();
    const pick = (c: Pt): Block | undefined => { let b = blockAt(blocks, c); if (!b || usedB.has(b)) { let bd = 0.03; b = undefined; blocks.forEach((x) => { if (usedB.has(x)) return; const d = Math.hypot(x.cx - c[0], x.cy - c[1]); if (d < bd) { bd = d; b = x; } }); } return b; };
    found.forEach((f, uid) => { const b = pick(centroid(f.poly)); if (b) { usedB.add(b); schemeMap.set(uid, b.poly); } });
    if (!numbered) {
      // переназначение по типу и порядку чтения: внутри типа блоки слева направо, сверху вниз ↔ номера по возрастанию
      const numKey = (n: string | number) => { const m = String(n).match(/\d+/); return m ? +m[0] : 0; };
      const groups = new Map<string, ExpectedUnit[]>(); expected.filter((u) => schemeMap.has(u.uid)).forEach((u) => groups.set(u.type || "", [...(groups.get(u.type || "") ?? []), u]));
      const re = new Map<number, Pt[]>();
      groups.forEach((grp) => { const polys = grp.map((u) => schemeMap.get(u.uid)!).map((p) => ({ p, c: centroid(p) })).sort((a, b) => Math.floor(a.c[1] / 0.12) - Math.floor(b.c[1] / 0.12) || a.c[0] - b.c[0]); [...grp].sort((a, b) => numKey(a.num) - numKey(b.num)).forEach((u, k) => { if (polys[k]) re.set(u.uid, polys[k].p); }); });
      re.forEach((p, uid) => schemeMap.set(uid, p));
    }
  }
  void perLevel0;

  // ── 2⅓. верх дуплексов: контур нижнего уровня — грубый контур верхнего (та же квартира вокруг той же лестницы),
  // номер наследуется; полигон модели для таких квартир не нужен (на мансарде он ставил квартиры мимо — A5 Miray) ──
  lowerRough.forEach((poly, uid) => { if (!schemeMode) found.set(uid, { poly, clipped: false, area: polyArea(poly) }); });

  // ── 2½. лист без напечатанных номеров: положение квартир задаёт геометрия, а не модель ──
  // Модель на таких листах раздаёт номера наугад и порой возвращает «плитки» по всему листу; масштаб, площади и нумерация
  // от этого отравляются. Вместо её полигонов: комнаты листа, связанные дверями (коридор-«узел» вырезан), — кандидаты в
  // квартиры; строки прайса сопоставляются по площади (крупные первыми). Окончательные номера — ниже, по площади и порядку чтения.
  const grayEarly = img ? grayFromImage(img) : null;
  const perLevel = (u: ExpectedUnit) => { const unit = units.find((x) => x.uid === u.uid); const lv = unit ? unitFloors(unit).length : 1; return u.area ? u.area / lv : 0; };
  const freeExpected = expected.filter((u) => !lowerRough.has(u.uid));
  if (!numbered && grayEarly && !schemeMode && freeExpected.length) {
    const dbg = (m: string) => console.log("[planWalls]", m);
    let px = wallScale(grayEarly);
    const kept = [...keptRough.map((k) => k.poly), ...[...lowerRough.values()]];
    let cands = findFreeApartments(grayEarly, kept, px, dbg);
    const want = freeExpected.map(perLevel).filter((a) => a > 0);
    if (want.length && cands.length) {
      const n = freeExpected.length, sumWant = (want.reduce((a, b) => a + b, 0) * n) / want.length, sumGot = cands.slice(0, n).reduce((a, c) => a + c.areaM2, 0);
      const k = Math.sqrt(sumGot / sumWant);
      if (k > 0.6 && k < 1.6) { px *= k; cands = findFreeApartments(grayEarly, kept, px, dbg); }
    }
    if (cands.length) {
      freeExpected.forEach((u) => found.delete(u.uid)); stairs.clear();
      const used = new Set<number>();
      [...freeExpected].sort((a, b) => perLevel(b) - perLevel(a)).forEach((u) => {
        const w0 = perLevel(u); let best = -1, bd = Infinity;
        cands.forEach((c, k) => { if (used.has(k)) return; const d = w0 ? Math.abs(c.areaM2 / w0 - 1) : 0; if (d < bd && (!w0 || d <= 0.45)) { bd = d; best = k; } });
        if (best < 0) return;
        used.add(best); found.set(u.uid, { poly: cands[best].poly, clipped: false, area: polyArea(cands[best].poly) });
      });
      console.log(`[planWalls] unnumbered sheet: ${found.size - lowerRough.size}/${freeExpected.length} apartments placed by geometry (${cands.map((c) => c.areaM2).join(" ")} м²)`);
    }
  }

  // ── 3. точная геометрия по стенам чертежа (`planWalls`) ──
  // Поиск ИИ стохастичен: иногда квартира ставится мимо (в шкаф, за дом). Такой грубый контур геометрия отвергает;
  // для отвергнутых квартир запрашиваем поиск ещё раз (весь лист, только они, с подсказкой), и снова подгоняем.
  const gray = grayEarly;
  const sane = (poly: Pt[]) => { if (!gray) return true; const r = roughSanity(gray, poly); return r.outside <= 0.35 && r.areaFrac >= 0.004; };
  let pxPerM = 0;
  const fitAll = () => { const r = fitByWalls(img!, [...keptRough, ...[...found.entries()].map(([uid, f]) => ({ uid, poly: f.poly }))], units, new Set(lowerRough.keys())); pxPerM = r.pxPerM || pxPerM; keptRough.forEach((k) => r.polys.delete(k.uid)); return r.polys; };
  let byWalls = schemeMode ? schemeMap : img ? fitAll() : new Map<number, Pt[]>();
  // повтор — для всех квартир без точного контура (не найдена, мимо здания, площадь не сходится, захватила соседей):
  // до двух раз, с подсказкой, где уже стоят найденные, чтобы модель искала остальные в оставшихся местах
  for (let attempt = 0; attempt < 2 && img && numbered && !schemeMode; attempt++) {
    const bad = expected.filter((u) => !byWalls.has(u.uid));
    if (!bad.length || (byWalls.size === 0 && attempt > 0)) break;
    opts.onProgress?.({ phase: "search", i: attempt, n: 2 });
    const keptBoxes = opts.keep?.size ? act.flatMap((w) => (plans[`${w || ""}|${floor}`]?.areas ?? []).filter((a) => opts.keep!.has(a.uid) && a.poly?.length >= 3).map((a) => `${numOf(a.uid)} at ${boxOf(a.poly)}`)) : [];
    const located = [...keptBoxes, ...[...byWalls.entries()].map(([uid, poly]) => `${numOf(uid)} at ${boxOf(poly)}`)];
    const note = `IMPORTANT: a previous attempt did not find these apartments or placed them wrongly (outside the building outline, on a single room, or covering two apartments at once): ${bad.map((u) => `№${u.num}`).join(", ")}. Look again carefully: every apartment lies INSIDE the building's outer walls, spans several rooms (living room + bedrooms + bathroom + balcony) and does not include any part of another apartment; use the room labels (SALON, MUTFAK, YATAK ODASI, BANYO, BALKON…) and the apartment's room count and area.${located.length ? ` The floor has ${expectedAll.length} apartments in total; these are ALREADY located correctly and must NOT be returned or overlapped: ${located.join("; ")}. The missing ones occupy the remaining part of the floor (by elimination) — return them even if the drawing shows no apartment numbers and the list gives no type/area.` : ""}`;
    const res = await detectFloorAreas(cropPayload(img, 0, 0, iw, ih), bad, { note }).catch(() => null);
    if (!res || !res.ok) break;
    res.units.forEach((u) => { if (sane(u.poly)) found.set(u.uid, { poly: u.poly, clipped: false, area: polyArea(u.poly) }); });
    byWalls = fitAll();
  }
  // Запасные грубые контуры для квартир, которые так и не легли по стенам: верх дуплекса — контур нижнего уровня;
  // остальные — «потерянные» квартиры по свободным комнатам листа (`findFreeApartments`), подбор по площади.
  if (img && !schemeMode) {
    let changed = false;
    expected.forEach((u) => { const lr = lowerRough.get(u.uid); if (!byWalls.has(u.uid) && lr) { found.set(u.uid, { poly: lr, clipped: false, area: polyArea(lr) }); changed = true; } });
    if (changed) byWalls = fitAll();
    const missing = expected.filter((u) => !byWalls.has(u.uid));
    if (missing.length && gray && pxPerM > 0) {
      const taken = [...keptRough.map((k) => k.poly), ...[...byWalls.values()]];
      const cands = findFreeApartments(gray, taken, pxPerM, (m) => console.log("[planWalls]", m));
      const used = new Set<number>(); let any = false;
      [...missing].sort((a, b) => (b.area || 0) - (a.area || 0)).forEach((u) => {
        const unit = units.find((x) => x.uid === u.uid); const lv = unit ? unitFloors(unit).length : 1; const want = u.area ? u.area / lv : 0;
        let best = -1, bd = Infinity;
        cands.forEach((c, k) => { if (used.has(k)) return; const d = want ? Math.abs(c.areaM2 / want - 1) : 0; if (d < bd && (!want || (d <= 0.6))) { bd = d; best = k; } });
        if (best < 0) return;
        used.add(best); found.set(u.uid, { poly: cands[best].poly, clipped: false, area: polyArea(cands[best].poly) }); any = true;
      });
      if (any) byWalls = fitAll();
    }
  }
  // Лист без напечатанных номеров: номера модели — догадка. Переназначаем детерминированно: контуры ↔ строки прайса по площади
  // (точный контур даёт площадь по стенам), среди одинаковых по типу и площади — слева направо, сверху вниз, по возрастанию номера.
  if (!numbered && gray && pxPerM > 0 && byWalls.size > 1 && !schemeMode) {
    const polys = [...byWalls.entries()].filter(([uid]) => !lowerRough.has(uid)).map(([uid, poly]) => ({ uid, poly, m2: polyArea(poly) * gray.w * gray.h / (pxPerM * pxPerM), cx: centroid(poly)[0], cy: centroid(poly)[1] }));
    const rows = expected.filter((u) => byWalls.has(u.uid) && !lowerRough.has(u.uid)).map((u) => { const unit = units.find((x) => x.uid === u.uid); const lv = unit ? unitFloors(unit).length : 1; return { u, want: u.area ? u.area / lv : 0, key: `${u.type}|${u.area ? Math.round(u.area / lv) : 0}` }; });
    const numKey = (n: string | number) => { const m = String(n).match(/\d+/); return m ? +m[0] : 0; };
    const bandH = 0.12; // полосы по высоте листа: сначала верхний ряд, потом следующий
    const order = (p: { cx: number; cy: number }) => Math.floor(p.cy / bandH) * 10 + p.cx;
    const free = new Set(polys.map((p) => p.uid));
    const assign = new Map<number, Pt[]>();
    // 1) группы одинаковых строк берут ближайшие по площади контуры (жадно, крупные первыми)
    const groups = new Map<string, typeof rows>(); rows.forEach((r) => groups.set(r.key, [...(groups.get(r.key) ?? []), r]));
    [...groups.values()].sort((a, b) => b[0].want - a[0].want).forEach((grp) => {
      const pick = polys.filter((p) => free.has(p.uid)).map((p) => ({ p, d: grp[0].want ? Math.abs(p.m2 / grp[0].want - 1) : 0 })).sort((a, b) => a.d - b.d).slice(0, grp.length).map((x) => x.p);
      pick.forEach((p) => free.delete(p.uid));
      // 2) внутри группы — порядок чтения ↔ возрастание номера
      const ps = pick.sort((a, b) => order(a) - order(b)); const us = [...grp].sort((a, b) => numKey(a.u.num) - numKey(b.u.num));
      us.forEach((r, k) => { if (ps[k]) assign.set(r.u.uid, ps[k].poly); });
    });
    const moved = [...assign.entries()].filter(([uid, poly]) => byWalls.get(uid) !== poly).length;
    if (moved) { console.log(`[planWalls] unnumbered sheet: ${moved} contours reassigned by area and reading order`); byWalls = new Map([...byWalls.entries()].map(([uid, poly]) => [uid, assign.get(uid) ?? poly])); }
  }
  // Запись: только точный контур по стенам. Сырой контур ИИ не сохраняем никогда — лучше «не найдено», чем ерунда.
  // Квартиры, которые переразмечались (не «оставленные» пользователем) и не легли по стенам, теряют старый контур:
  // устаревший или ошибочный контур хуже, чем «не отмечена».
  let saved = 0;
  const drop = new Set(expected.filter((u) => !byWalls.has(u.uid)).map((u) => u.uid));
  act.forEach((w) => {
    const mine = [...found.entries()].filter(([uid]) => wingOfUid.get(uid) === w && byWalls.has(uid));
    const dropHere = [...drop].filter((uid) => wingOfUid.get(uid) === w);
    if (!mine.length && !dropHere.length) return;
    saved += mine.length;
    setPlanAreas(objId, `${w || ""}|${floor}`, (list) => { const m = new Map(list.filter((a) => !drop.has(a.uid)).map((a) => [a.uid, a])); mine.forEach(([uid]) => m.set(uid, { uid, poly: byWalls.get(uid)! })); return [...m.values()]; });
  });
  // Дуплексы по плану: у квартиры своя лестница, тега в прайсе нет, а этаж выше в этом корпусе пуст (там её верхний
  // уровень) — ставим «дуплекс». Прайсы часто помечают дуплексом только заголовок группы, и строки теряют признак.
  const allUnits = getDev().units[objId] ?? [];
  const toDuplex = expected.filter((u) => stairs.has(u.uid)).map((u) => allUnits.find((x) => x.uid === u.uid)).filter((x): x is Unit => !!x && !x.tag && !x.vl)
    .filter((x) => !allUnits.some((y) => !y.vl && (y.wing || "") === (x.wing || "") && y.floor === x.floor + 1 && y.uid !== x.uid && !(y.tag === "tduplex")));
  if (toDuplex.length) { const ids = new Set(toDuplex.map((x) => x.uid)); mutUnits(objId, (list) => list.map((x) => (ids.has(x.uid) ? { ...x, tag: "duplex" as const } : x))); }
  const copied = saved ? [...new Set(act.flatMap((w) => propagateSameSheet(objId, w, floor)))].sort((a, b) => a - b) : [];
  return { ok: true, found: saved, of: expected.length, refined, walls: byWalls.size, duplex: toDuplex.length, copied };
}

/** Подогнать грубые контуры по стенам чертежа: ч/б картинка → `fitUnitsToWalls`. Площадь многоуровневой квартиры делим на
 *  число уровней (на листе виден один). Возвращает только уверенные контуры (uid → контур). */
function fitByWalls(img: HTMLImageElement, rough: { uid: number; poly: Pt[] }[], units: Unit[], noArea?: Set<number>): { polys: Map<number, Pt[]>; pxPerM: number } {
  const out = new Map<number, Pt[]>();
  let pxPerM = 0;
  if (!rough.length) return { polys: out, pxPerM };
  const gray = grayFromImage(img);
  if (!gray) return { polys: out, pxPerM };
  // верх дуплекса: паспортная площадь «за все уровни» и без террас — на листе мансарды она только мешает (террасы 32 м²
  // у 3+1 Miray); масштаб тогда по толщине стены, контур — без проверки площади
  const input: WallFitUnit[] = rough.map((r) => { const u = units.find((x) => x.uid === r.uid); const lv = u ? unitFloors(u).length : 1; return { uid: r.uid, poly: r.poly, area: u?.area && !noArea?.has(r.uid) ? u.area / lv : undefined }; });
  try {
    const r1 = fitUnitsToWalls(gray, input);
    pxPerM = r1.pxPerM;
    r1.fitted.forEach((f) => out.set(f.uid, f.poly));
    // второй проход: точный контур первого прохода — грубый контур второго. Грубый контур ИИ часто не накрывает
    // лестницу или кладовую за прихожей; от точного контура их комнаты уже «свои», и заливка их подбирает.
    const again: WallFitUnit[] = r1.fitted.map((f) => ({ uid: f.uid, poly: f.poly, area: input.find((x) => x.uid === f.uid)?.area }));
    if (again.length) {
      const r2 = fitUnitsToWalls(gray, again);
      r2.fitted.forEach((f) => { const a = r1.fitted.find((x) => x.uid === f.uid); if (!a || Math.abs(f.ratio - 1) <= Math.abs(a.ratio - 1) + 0.03) out.set(f.uid, f.poly); });
    }
  } catch (e) { console.warn("[planWalls]", e); }
  return { polys: out, pxPerM };
}

/** Типовые этажи: один и тот же лист (та же картинка) на нескольких этажах корпуса → контуры считаются один раз и
 *  копируются на остальные этажи с этим листом (по позиции квартиры). Иначе каждый этаж размечался бы заново и по-своему. */
export function propagateSameSheet(objId: number, wing: string, floor: number): number[] {
  const s = getDev();
  const plans = s.projects.find((p) => p.id === objId)?.floorPlans ?? {};
  const src = plans[`${wing || ""}|${floor}`];
  if (!src?.img) return [];
  const out: number[] = [];
  for (const [k, fp] of Object.entries(plans)) {
    const [w, f] = k.split("|"); const f2 = +f;
    if ((w || "") !== (wing || "") || f2 === floor || !fp?.img || fp.img !== src.img) continue;
    if (copyPlanAreas(objId, wing, floor, f2) > 0) out.push(f2);
  }
  return out.sort((a, b) => a - b);
}

export type WallsFitResult = { ok: true; fitted: number; of: number; /** этажи с тем же листом, куда скопированы контуры */ copied: number[] } | { ok: false; reason: "no-image" | "no-areas" | "canvas" };
/** Подогнать уже имеющиеся контуры плана этажа по стенам (без ИИ): отправная точка — текущие контуры (ручные или ИИ). */
export async function fitPlanToWalls(objId: number, wing: string, floor: number, uids?: Set<number>): Promise<WallsFitResult> {
  const s = getDev();
  const key = `${wing || ""}|${floor}`;
  const plan = s.projects.find((p) => p.id === objId)?.floorPlans?.[key];
  if (!plan?.img || !/^https?:\/\//.test(plan.img)) return { ok: false, reason: "no-image" };
  // в геометрию идут все контуры листа (соседи — контекст для общего коридора), записываются только запрошенные
  const rough = plan.areas.map((a) => ({ uid: a.uid, poly: a.poly.map((p) => [p[0], p[1]] as Pt) }));
  if (!rough.filter((a) => !uids || uids.has(a.uid)).length) return { ok: false, reason: "no-areas" };
  const img = await loadPlanImage(plan.img).catch(() => null);
  if (!img || !grayFromImage(img, 64)) return { ok: false, reason: "canvas" };
  const upper = new Set((s.units[objId] ?? []).filter((u) => levelOf(u, floor) === "upper").map((u) => u.uid));
  const byWalls = fitByWalls(img, rough, s.units[objId] ?? [], upper).polys;
  if (uids) for (const k of [...byWalls.keys()]) if (!uids.has(k)) byWalls.delete(k);
  if (byWalls.size) setPlanAreas(objId, key, (list) => list.map((a) => (byWalls.has(a.uid) ? { uid: a.uid, poly: byWalls.get(a.uid)! } : a)));
  const copied = byWalls.size ? propagateSameSheet(objId, wing, floor) : [];
  return { ok: true, fitted: byWalls.size, of: uids ? rough.filter((a) => uids.has(a.uid)).length : rough.length, copied };
}

/** Перенести контуры с этажа `from` на этаж `to` того же блока (одинаковая планировка): привязка по ряду и позиции, иначе по порядку. */
export function copyPlanAreas(objId: number, wing: string, from: number, to: number): number {
  const s = getDev();
  const units = s.units[objId] ?? [];
  const src = s.projects.find((p) => p.id === objId)?.floorPlans?.[`${wing || ""}|${from}`];
  if (!src) return 0;
  const srcUnits = fpUnits(units, wing, from), dstUnits = fpUnits(units, wing, to);
  const byPos = new Map<string, number>();
  dstUnits.forEach((u) => { const k = `${u.band || "out"}|${u.pos}`; if (!byPos.has(k)) byPos.set(k, u.uid); });
  const used = new Set<number>();
  const areas: { uid: number; poly: [number, number][] }[] = [];
  src.areas.forEach((a) => {
    const su = srcUnits.find((u) => u.uid === a.uid);
    if (!su) return;
    let tu = dstUnits.some((u) => u.uid === su.uid) ? su.uid : byPos.get(`${su.band || "out"}|${su.pos}`);
    if (tu == null || used.has(tu)) tu = dstUnits[srcUnits.indexOf(su)]?.uid;
    if (tu == null || used.has(tu)) return;
    used.add(tu);
    areas.push({ uid: tu, poly: a.poly.map((p) => [p[0], p[1]] as [number, number]) });
  });
  setPlanAreas(objId, `${wing || ""}|${to}`, areas);
  return areas.length;
}
