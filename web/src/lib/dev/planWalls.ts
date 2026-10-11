// Подгонка контуров квартир по стенам чертежа — чистая геометрия по пикселям, без ИИ.
// Модель («зрение») отвечает за смысл: какая квартира где, грубая область. Точную границу берём из самого рисунка:
//   1. Стены. Тёмные пиксели (`darkT`) → морфологическое «открытие» убирает тонкие линии (мебель, надписи, двери),
//      остаются толстые — стены. Толщину стены оцениваем по длинам тёмных отрезков.
//   2. Комнаты. Дверные проёмы (разрывы в стенах до `doorM`) заделываются заплатками (`closeDoors`), затем отступаем от
//      стен на `coreM` — каждая комната становится отдельным пятном-ядром (масштаб px/м — из площадей квартир и толщины стен).
//   3. Раздача. Ядро принадлежит квартире, если ≥ `minFrac` его площади лежит в её грубой области (с запасом `margin`).
//      Коридор, лестницы, фон листа и соседи так не проходят.
//   4. Заливка. Все ядра одновременно «растекаются» по свободному месту до стен (многозатравочный BFS) — так комната
//      заполняется целиком с прямыми углами, а в дверном проёме граница проходит посередине стены. Объединение
//      пятен квартиры → заливка дырок → контур → упрощение → выравнивание по осям.
//   5. Масштаб уточняется по уже полученным площадям, и шаги 2–4 повторяются (точнее r).
// Работает на ч/б массиве яркости (canvas в браузере или любой декодер в Node), поэтому тестируется без UI.
import type { Pt } from "./floorplan";

export type Gray = { w: number; h: number; data: Uint8Array };          // яркость 0..255, построчно
export type WallFitUnit = { uid: number; poly: Pt[]; area?: number };  // грубый контур (норм. координаты) и площадь, м²
export type WallFitOpts = {
  darkT?: number;    // порог «стены» по яркости (0..255), по умолчанию 24
  doorM?: number;    // ширина дверного проёма, м (закрываем проёмы до этой ширины), по умолчанию 1.2
  coreM?: number;    // отступ от стен для ядер комнат, м, по умолчанию 0.55 (меньше — комнаты сливаются через незакрытые проёмы)
  marginM?: number;  // запас вокруг грубой области, м, по умолчанию 0.6
  minFrac?: number;  // доля пятна внутри грубой области, чтобы отдать его квартире, по умолчанию 0.5
  debug?: (msg: string) => void;
  /** отладка: пиксель (в координатах картинки), о котором печатать принадлежность на каждом этапе */
  probe?: Pt;
  /** отладка: маска квартиры перед трассировкой (вырезка bb) */
  debugMask?: (uid: number, bb: { x0: number; y0: number; x1: number; y1: number }, mask: Uint8Array) => void;
};
export type WallFitOut = { uid: number; poly: Pt[]; ratio: number; comps: number; areaM2: number }; // ratio — площадь контура / ожидаемая (м² × масштаб)
export type WallFitResult = { fitted: WallFitOut[]; pxPerM: number; r: number; wallPx: number };

const INF = 1e10;

/** Ч/б яркость картинки плана через canvas (браузер), не крупнее `maxSide` по большей стороне. null — canvas недоступен
 *  (картинка с чужого домена без CORS → «tainted»). */
/**
 * Уменьшение серого изображения усреднением по площади (box filter, дробные веса по краям). Детерминировано и одинаково
 * в браузере и на стенде (Node + sharp): масштабирование canvas и библиотек различается в тонких линиях и ломало
 * воспроизводимость (мансарда A5 Miray: стенд чисто, прод — лишний «карман»).
 */
export function boxDownscale(src: Uint8Array, nw: number, nh: number, w: number, h: number): Uint8Array {
  const out = new Uint8Array(w * h);
  if (w >= nw && h >= nh) { for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) out[y * w + x] = src[Math.min(nh - 1, y) * nw + Math.min(nw - 1, x)]; return out; }
  const sx = nw / w, sy = nh / h;
  // горизонтальный проход → строки nh × w, затем вертикальный
  const tmp = new Float32Array(nh * w);
  for (let x = 0; x < w; x++) {
    const x0 = x * sx, x1 = (x + 1) * sx; const i0 = Math.floor(x0), i1 = Math.min(nw - 1, Math.ceil(x1) - 1);
    for (let y = 0; y < nh; y++) { let s = 0, wsum = 0; const row = y * nw; for (let i = i0; i <= i1; i++) { const wt = Math.min(x1, i + 1) - Math.max(x0, i); if (wt <= 0) continue; s += src[row + i] * wt; wsum += wt; } tmp[y * w + x] = wsum ? s / wsum : 0; }
  }
  for (let y = 0; y < h; y++) {
    const y0 = y * sy, y1 = (y + 1) * sy; const j0 = Math.floor(y0), j1 = Math.min(nh - 1, Math.ceil(y1) - 1);
    for (let x = 0; x < w; x++) { let s = 0, wsum = 0; for (let j = j0; j <= j1; j++) { const wt = Math.min(y1, j + 1) - Math.max(y0, j); if (wt <= 0) continue; s += tmp[j * w + x] * wt; wsum += wt; } out[y * w + x] = Math.round(wsum ? s / wsum : 0); }
  }
  return out;
}

export function grayFromImage(img: HTMLImageElement, maxSide = 1800): Gray | null {
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh || typeof document === "undefined") return null;
  const k = Math.min(1, maxSide / Math.max(nw, nh));
  const w = Math.max(2, Math.round(nw * k)), h = Math.max(2, Math.round(nh * k));
  try {
    // читаем в родном разрешении и уменьшаем сами (см. boxDownscale)
    const cv = document.createElement("canvas");
    cv.width = nw; cv.height = nh;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, nw, nh);
    ctx.drawImage(img, 0, 0, nw, nh);
    const px = ctx.getImageData(0, 0, nw, nh).data;
    const full = new Uint8Array(nw * nh);
    for (let i = 0, j = 0; i < full.length; i++, j += 4) full[i] = (px[j] * 299 + px[j + 1] * 587 + px[j + 2] * 114) / 1000;
    return { w, h, data: k < 1 ? boxDownscale(full, nw, nh, w, h) : full };
  } catch { return null; }
}

/** Точное евклидово расстояние до ближайшего пикселя препятствия (Felzenszwalb–Huttenlocher), в пикселях. */
export function edt(obstacle: Uint8Array, w: number, h: number): Float32Array {
  const f = new Float32Array(w * h);
  for (let i = 0; i < f.length; i++) f[i] = obstacle[i] ? 0 : INF;
  const n = Math.max(w, h);
  const d = new Float32Array(n), v = new Int32Array(n), z = new Float32Array(n + 1), col = new Float32Array(n);
  const dt1d = (len: number) => {
    let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
    for (let q = 1; q < len; q++) {
      let s = (col[q] + q * q - (col[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
      while (s <= z[k]) { k--; s = (col[q] + q * q - (col[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
      k++; v[k] = q; z[k] = s; z[k + 1] = INF;
    }
    k = 0;
    for (let q = 0; q < len; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + col[v[k]]; }
  };
  for (let x = 0; x < w; x++) { for (let y = 0; y < h; y++) col[y] = f[y * w + x]; dt1d(h); for (let y = 0; y < h; y++) f[y * w + x] = d[y]; }
  for (let y = 0; y < h; y++) { const o = y * w; for (let x = 0; x < w; x++) col[x] = f[o + x]; dt1d(w); for (let x = 0; x < w; x++) f[o + x] = Math.sqrt(d[x]); }
  return f;
}

/** Маска тёмных пикселей (стены, линии, текст). */
export function darkMask(g: Gray, darkT: number): Uint8Array {
  const m = new Uint8Array(g.w * g.h);
  for (let i = 0; i < m.length; i++) if (g.data[i] <= darkT) m[i] = 1;
  return m;
}

/** Морфологическое открытие радиусом k: убирает структуры тоньше ~2k+1 px (тонкие линии), стены остаются. */
export function openMask(mask: Uint8Array, w: number, h: number, k: number): Uint8Array {
  if (k <= 0) return mask;
  const inv = new Uint8Array(mask.length); for (let i = 0; i < inv.length; i++) inv[i] = mask[i] ? 0 : 1;
  const dIn = edt(inv, w, h);                       // расстояние до «не-маски»: глубина внутри маски
  const eroded = new Uint8Array(mask.length); for (let i = 0; i < eroded.length; i++) if (dIn[i] > k) eroded[i] = 1;
  const dEr = edt(eroded, w, h);
  const out = new Uint8Array(mask.length); for (let i = 0; i < out.length; i++) if (dEr[i] <= k) out[i] = 1;
  return out;
}

/** Типичная толщина стены, px: медиана длин отрезков 3..60 px по строкам и столбцам маски. */
export function wallThickness(mask: Uint8Array, w: number, h: number): number {
  const runs: number[] = [];
  const push = (r: number) => { if (r >= 3 && r <= 60) runs.push(r); };
  for (let y = 0; y < h; y += 2) { let r = 0; for (let x = 0; x < w; x++) { if (mask[y * w + x]) r++; else { push(r); r = 0; } } push(r); }
  for (let x = 0; x < w; x += 2) { let r = 0; for (let y = 0; y < h; y++) { if (mask[y * w + x]) r++; else { push(r); r = 0; } } push(r); }
  if (!runs.length) return 4;
  runs.sort((a, b) => a - b);
  return runs[Math.floor(runs.length / 2)];
}

/** Маска стен: тёмное → открытие радиусом 1 (линии мебели, дуги дверей, штриховка долой) → убрать мелкие компоненты
 *  (надписи, значки): стены — крупные связные структуры. */
/**
 * Штрихованные стены (чёрно-белые чертежи): стена — контур с диагональной штриховкой, после уменьшения листа штрихи
 * бледные (серые) и в 1 px. Тёмный (< T) пиксель с тёмными соседями по диагонали на два шага в обе стороны — штрих;
 * закрытие радиусом R превращает штрихи в сплошную полосу; мелкие компоненты (буквы, дуги дверей) отбрасываются.
 */
export function hatchMask(g: Gray, T = 160, R = 6): { mask: Uint8Array; frac: number } {
  const { w, h } = g;
  const dark = new Uint8Array(w * h); for (let i = 0; i < dark.length; i++) if (g.data[i] < T) dark[i] = 1;
  const diag = new Uint8Array(w * h); let nd = 0;
  for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
    const i = y * w + x; if (!dark[i]) continue;
    if ((dark[i - w + 1] && dark[i + w - 1] && dark[i - 2 * w + 2] && dark[i + 2 * w - 2]) || (dark[i - w - 1] && dark[i + w + 1] && dark[i - 2 * w - 2] && dark[i + 2 * w + 2])) { diag[i] = 1; nd++; }
  }
  const frac = nd / (w * h);
  // только для белых (штриховых) чертежей: на цветном плане диагонали дают текстуры полов и ковров
  let nWhite = 0; for (let i = 0; i < g.data.length; i++) if (g.data[i] >= 240) nWhite++;
  if (frac < 0.003 || nWhite / (w * h) < 0.6) return { mask: new Uint8Array(w * h), frac: 0 };
  const dD = edt(diag, w, h); const dil = new Uint8Array(w * h); for (let i = 0; i < dil.length; i++) if (dD[i] <= R) dil[i] = 1;
  const inv = new Uint8Array(w * h); for (let i = 0; i < inv.length; i++) inv[i] = dil[i] ? 0 : 1;
  const dI = edt(inv, w, h); const closed = new Uint8Array(w * h); for (let i = 0; i < closed.length; i++) if (dI[i] > R) closed[i] = 1;
  // компоненты: не мельче 24 px и со штрихами не реже 8 % площади (буквы, дуги дверей, размерные линии — нет)
  const { labels, area } = label4(closed, w, h);
  const dn = new Int32Array(area.length); for (let i = 0; i < labels.length; i++) if (labels[i] && diag[i]) dn[labels[i]]++;
  const bx0: number[] = [], by0: number[] = [], bx1: number[] = [], by1: number[] = [];
  for (let i = 0; i < labels.length; i++) { const l = labels[i]; if (!l) continue; const x = i % w, y = (i - x) / w; if (bx0[l] === undefined) { bx0[l] = bx1[l] = x; by0[l] = by1[l] = y; } else { if (x < bx0[l]) bx0[l] = x; if (x > bx1[l]) bx1[l] = x; if (y < by0[l]) by0[l] = y; if (y > by1[l]) by1[l] = y; } }
  const mask = new Uint8Array(w * h);
  for (let i = 0; i < labels.length; i++) { const l = labels[i]; if (l && Math.max(bx1[l] - bx0[l], by1[l] - by0[l]) >= 24 && dn[l] >= 0.08 * area[l]) mask[i] = 1; }
  return { mask, frac };
}

/** Улица для штрихового чертежа: всё, куда можно дойти от края кадра по светлым пикселям; тонкие линии окон, ограждений и
 *  рамки — препятствия (на ч/б чертеже окно — проём в стене, перекрытый тонкими линиями). */
export function lineExterior(g: Gray, obstacles?: Uint8Array, T = 200): Uint8Array {
  const { w, h } = g;
  const out = new Uint8Array(w * h);
  const q = new Int32Array(w * h); let head = 0, tail = 0;
  const push = (i: number) => { if (!out[i] && g.data[i] >= T && !(obstacles && obstacles[i])) { out[i] = 1; q[tail++] = i; } };
  for (let x = 0; x < w; x++) { push(x); push((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
  while (head < tail) { const i = q[head++]; const x = i % w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (i >= w) push(i - w); if (i + w < w * h) push(i + w); }
  return out;
}

export function wallMask(g: Gray, darkT: number, debug?: (m: string) => void): { walls: Uint8Array; thick: Uint8Array; wallPx: number; hatched: boolean } {
  const { w, h } = g;
  const dark = darkMask(g, darkT);
  const opened = openMask(dark, w, h, 1);
  const { labels, area } = label4(opened, w, h);
  const minSide = Math.max(24, Math.round(0.025 * Math.max(w, h)));
  const bx0: number[] = [], by0: number[] = [], bx1: number[] = [], by1: number[] = [];
  for (let i = 0; i < labels.length; i++) { const l = labels[i]; if (!l) continue; const x = i % w, y = (i - x) / w; if (bx0[l] === undefined) { bx0[l] = bx1[l] = x; by0[l] = by1[l] = y; } else { if (x < bx0[l]) bx0[l] = x; if (x > bx1[l]) bx1[l] = x; if (y < by0[l]) by0[l] = y; if (y > by1[l]) by1[l] = y; } }
  const keep = new Uint8Array(area.length);
  for (let l = 1; l < area.length; l++) if (Math.max(bx1[l] - bx0[l], by1[l] - by0[l]) >= minSide) keep[l] = 1;
  const walls = new Uint8Array(w * h);
  for (let i = 0; i < walls.length; i++) if (labels[i] && keep[labels[i]]) walls[i] = 1;
  // штрихованные стены (ч/б чертежи) — тоже стены
  const hatch = hatchMask(g); const hatched = hatch.frac >= 0.003;
  if (hatched) { let n = 0; for (let i = 0; i < walls.length; i++) if (hatch.mask[i]) { walls[i] = 1; n++; } debug?.(`hatched drawing: diag ${(100 * hatch.frac).toFixed(2)}%, hatch walls ${n}px`); }
  const thick = new Uint8Array(walls);
  // длинные прямые тонкие линии (ограждения балконов, козырьки) — тоже границы: длина ≥ minLong и вытянутость ≥ 4:1.
  // Контуры мебели (коробчатые), дуги дверей и текст под это не попадают.
  // тонкие линии бледнее стен (серые, 1–2 px, рваные после уменьшения): порог мягче, и расширяем на 1 px, чтобы
  // обрывки одной линии склеились в одну компоненту
  // ореол сглаживания вдоль стен (серые пиксели у каждой стены) исключаем — иначе все линии, касающиеся стен,
  // слипаются с ним в одну гигантскую компоненту
  const dWalls = edt(walls, w, h);
  const thin0 = new Uint8Array(w * h);
  for (let i = 0; i < thin0.length; i++) if (g.data[i] <= Math.max(darkT, 110) && dWalls[i] > 2.5) thin0[i] = 1;
  const dT = edt(thin0, w, h);
  const thin = new Uint8Array(w * h);
  for (let i = 0; i < thin.length; i++) if (dT[i] <= 1 && !walls[i]) thin[i] = 1;
  const tl = label4(thin, w, h);
  const tx0: number[] = [], ty0: number[] = [], tx1: number[] = [], ty1: number[] = [];
  for (let i = 0; i < tl.labels.length; i++) { const l = tl.labels[i]; if (!l) continue; const x = i % w, y = (i - x) / w; if (tx0[l] === undefined) { tx0[l] = tx1[l] = x; ty0[l] = ty1[l] = y; } else { if (x < tx0[l]) tx0[l] = x; if (x > tx1[l]) tx1[l] = x; if (y < ty0[l]) ty0[l] = y; if (y > ty1[l]) ty1[l] = y; } }
  const minLong = Math.max(40, Math.round(0.06 * Math.max(w, h)));
  const keepThin = new Uint8Array(tl.area.length);
  for (let l = 1; l < tl.area.length; l++) { const bw = tx1[l] - tx0[l] + 1, bh = ty1[l] - ty0[l] + 1, lo = Math.min(bw, bh), hi = Math.max(bw, bh); if (hi >= minLong && lo <= 0.25 * hi) keepThin[l] = 1; }
  let addedThin = 0, keptThin = 0;
  for (let l = 1; l < tl.area.length; l++) if (keepThin[l]) keptThin++;
  // добавляем с запасом в 2 px, чтобы линия сомкнулась со стеной через вырезанный ореол
  const keptPx = new Uint8Array(w * h);
  for (let i = 0; i < keptPx.length; i++) if (tl.labels[i] && keepThin[tl.labels[i]]) keptPx[i] = 1;
  const dK = edt(keptPx, w, h);
  for (let i = 0; i < walls.length; i++) if (dK[i] <= 2.5 && !walls[i]) { walls[i] = 1; addedThin++; }
  debug?.(`walls: thick comps kept ${keep.reduce((a, b) => a + b, 0)}, thin comps ${tl.area.length - 1}, long thin kept ${keptThin} (+${addedThin}px), minLong ${minLong}`);
  return { walls, thick, wallPx: wallThickness(thick, w, h), hatched };
}

/** Внешний фон листа: почти белые области, доходящие до края кадра. На цветных (отрисованных) планах полы и балконы
 *  текстурные, а снаружи здания — белая бумага; такая «белизна» становится препятствием, чтобы комнаты не вытекали
 *  наружу через балконы с тонким ограждением и окна. Белая мебель внутри (диваны, сантехника) края не касается и не
 *  попадает. */
export function exteriorMask(g: Gray, whiteT = 240, debug?: (m: string) => void): Uint8Array {
  const { w, h } = g;
  const white = new Uint8Array(w * h);
  for (let i = 0; i < white.length; i++) if (g.data[i] >= whiteT) white[i] = 1;
  // тонкие линии (козырьки балконов, рамки) не должны отрезать кусок белого поля от внешнего: закрытие на 2 px
  const dW = edt(white, w, h); const dil = new Uint8Array(w * h); for (let i = 0; i < dil.length; i++) if (dW[i] <= 2) dil[i] = 1;
  const notD = new Uint8Array(w * h); for (let i = 0; i < notD.length; i++) notD[i] = dil[i] ? 0 : 1;
  const dN = edt(notD, w, h); const closed = new Uint8Array(w * h); for (let i = 0; i < closed.length; i++) if (dN[i] > 2) closed[i] = 1;
  const { labels, border, area } = label4(closed, w, h);
  // Рамка листа (толстые чёрные полосы по краю во всю ширину/высоту) отрезает белое поле внутри от края кадра:
  // белые области, прилегающие к рамке, — тоже улица (иначе коридор через окно «вытекает» на белое поле под ним)
  const frame = new Uint8Array(w * h);
  {
    const dark = new Uint8Array(w * h); for (let i = 0; i < dark.length; i++) if (g.data[i] < 60) dark[i] = 1;
    const dl = label4(dark, w, h);
    const bx0: number[] = [], by0: number[] = [], bx1: number[] = [], by1: number[] = [];
    for (let i = 0; i < dl.labels.length; i++) { const l = dl.labels[i]; if (!l) continue; const x = i % w, y = (i - x) / w; if (bx0[l] === undefined) { bx0[l] = bx1[l] = x; by0[l] = by1[l] = y; } else { if (x < bx0[l]) bx0[l] = x; if (x > bx1[l]) bx1[l] = x; if (y < by0[l]) by0[l] = y; if (y > by1[l]) by1[l] = y; } }
    const isFrame: boolean[] = [];
    // рамка: тёмная полоса во всю ширину/высоту листа у края кадра (касается края или в пределах 8 % от него)
    const nearEdge = (l: number) => bx0[l] <= 0.08 * w || by0[l] <= 0.08 * h || bx1[l] >= 0.92 * w || by1[l] >= 0.92 * h;
    // полоса: длинная И узкая (стены здания тоже тянутся почти на весь лист, но они не полоса)
    for (let l = 1; l < dl.area.length; l++) isFrame[l] = (dl.border[l] || nearEdge(l)) && ((bx1[l] - bx0[l] >= 0.8 * w && by1[l] - by0[l] <= 0.06 * h) || (by1[l] - by0[l] >= 0.8 * h && bx1[l] - bx0[l] <= 0.06 * w));
    for (let i = 0; i < frame.length; i++) if (dl.labels[i] && isFrame[dl.labels[i]]) frame[i] = 1;
  }
  const dF = edt(frame, w, h);
  const touchFrame: boolean[] = [];
  for (let i = 0; i < labels.length; i++) if (labels[i] && dF[i] <= 3) touchFrame[labels[i]] = true;
  const out = new Uint8Array(w * h);
  const minFrameWhite = Math.round(0.002 * w * h); // мелкие белые пятна у рамки (подписи) — не улица
  for (let i = 0; i < out.length; i++) { const l = labels[i]; if (l && (border[l] || (touchFrame[l] && area[l] >= minFrameWhite))) out[i] = 1; }
  // Бумага листа за рамкой чертежа (A5 Miray: белое поле → чёрная полоса → белая полоса → тонкая линия → серое 224 →
  // здание). Улица — ровные (разброс яркости в окне 5×5 ≤ 8) светлые области тона бумаги (пики яркости у рамки/края,
  // ±16), достижимые от края/рамки; тонкие линии (тёмные пробеги ≤ 3 px) пересекаются, стены (толстые) — нет, текстурные
  // полы (террасы, комнаты) — нет. Вариант «ровные области у рамки» 08.10.2026 протекал через двери на все полы.
  {
    const R = 2, N = (2 * R + 1) * (2 * R + 1), W1 = w + 1;
    const S1 = new Float64Array(W1 * (h + 1)), S2 = new Float64Array(W1 * (h + 1));
    for (let y = 1; y <= h; y++) { let r1 = 0, r2 = 0; for (let x = 1; x <= w; x++) { const v = g.data[(y - 1) * w + x - 1]; r1 += v; r2 += v * v; S1[y * W1 + x] = S1[(y - 1) * W1 + x] + r1; S2[y * W1 + x] = S2[(y - 1) * W1 + x] + r2; } }
    const flat = new Uint8Array(w * h);
    for (let y = R; y < h - R; y++) for (let x = R; x < w - R; x++) {
      const i = y * w + x; if (frame[i] || g.data[i] < 150) continue;
      const a = (y - R) * W1 + (x - R), b = (y - R) * W1 + (x + R + 1), c = (y + R + 1) * W1 + (x - R), d = (y + R + 1) * W1 + (x + R + 1);
      const m = (S1[d] - S1[b] - S1[c] + S1[a]) / N; const v = (S2[d] - S2[b] - S2[c] + S2[a]) / N - m * m; if (v <= 8) flat[i] = 1;
    }
    // тонкие тёмные линии: пробег тёмного (<150) по горизонтали или вертикали ≤ 3 px
    const dark = new Uint8Array(w * h); for (let i = 0; i < dark.length; i++) if (g.data[i] < 150 && !frame[i]) dark[i] = 1;
    const thin = new Uint8Array(w * h);
    for (let y = 0; y < h; y++) { let x = 0; while (x < w) { if (!dark[y * w + x]) { x++; continue; } let e = x; while (e < w && dark[y * w + e]) e++; if (e - x <= 3) for (let k = x; k < e; k++) thin[y * w + k] = 1; x = e; } }
    for (let x = 0; x < w; x++) { let y = 0; while (y < h) { if (!dark[y * w + x]) { y++; continue; } let e = y; while (e < h && dark[e * w + x]) e++; if (e - y <= 3) for (let k = y; k < e; k++) thin[k * w + x] = 1; y = e; } }
    // тона бумаги: пики яркости ровных пикселей у рамки (6–30 px) или у края кадра
    const hasFrame = dF.some((v) => v === 0);
    const vals: number[] = []; const seedAt: number[] = [];
    for (let i = 0; i < flat.length; i++) { if (!flat[i]) continue; const x = i % w, y = (i - x) / w; const nearEdge = x < 12 || y < 12 || x >= w - 12 || y >= h - 12; if ((hasFrame && dF[i] >= 6 && dF[i] <= 30) || nearEdge) { vals.push(g.data[i]); seedAt.push(i); } }
    if (vals.length > 100) {
      const hist = new Int32Array(32); vals.forEach((v) => hist[v >> 3]++);
      const tones: number[] = []; for (let b = 0; b < 32; b++) if (hist[b] >= 0.06 * vals.length && (b === 0 || hist[b] >= hist[b - 1]) && (b === 31 || hist[b] > hist[b + 1])) tones.push(b * 8 + 4);
      // у тонкой линии окно 5×5 захватывает её и «ровность» не проходит — рядом с линией (≤2,5 px) достаточно тона
      const dT = edt(thin, w, h);
      const paperPix = (i: number) => !frame[i] && g.data[i] >= 150 && (flat[i] === 1 || dT[i] <= 2.5) && tones.some((t) => Math.abs(g.data[i] - t) <= 16);
      const vis = new Uint8Array(w * h); const q = new Int32Array(w * h); let head = 0, tail = 0;
      for (const i of seedAt) if (paperPix(i) && !vis[i]) { vis[i] = 1; q[tail++] = i; }
      while (head < tail) { const i = q[head++]; const x = i % w; for (const j of [x > 0 ? i - 1 : -1, x < w - 1 ? i + 1 : -1, i - w, i + w]) { if (j < 0 || j >= w * h || vis[j]) continue; if (paperPix(j) || thin[j]) { vis[j] = 1; q[tail++] = j; } } }
      let nAdd = 0; for (let i = 0; i < vis.length; i++) if (vis[i] && !out[i] && !thin[i]) nAdd++;
      let nOut = 0; for (let i = 0; i < out.length; i++) nOut += out[i];
      debug?.(`exterior: white ${(100 * nOut / (w * h)).toFixed(1)}%, paper tones ${tones.join("/")}, flat flood ${(100 * nAdd / (w * h)).toFixed(1)}% → ${nAdd >= 0.01 * w * h ? "added" : "ignored"}`);
      if (nAdd >= 0.01 * w * h) for (let i = 0; i < out.length; i++) if (vis[i] && !thin[i]) out[i] = 1;
    }
  }
  return out;
}

/** «Закрыть двери»: узкие разрывы в стенах (проёмы шириной до 2ρ) заделываются. Морфологическое закрытие стен радиусом ρ
 *  даёт заплатки; оставляем только те, что похожи на проём, а не на угол комнаты: небольшие и почти не прилегающие к
 *  стене по периметру (у заплатки проёма со стеной соприкасаются лишь два коротких торца). */
export function closeDoors(walls: Uint8Array, w: number, h: number, rho: number, wallPx: number): Uint8Array {
  const dW = edt(walls, w, h);
  const dil = new Uint8Array(w * h); for (let i = 0; i < dil.length; i++) if (dW[i] <= rho) dil[i] = 1;
  const notDil = new Uint8Array(w * h); for (let i = 0; i < notDil.length; i++) notDil[i] = dil[i] ? 0 : 1;
  const dN = edt(notDil, w, h);
  const cand = new Uint8Array(w * h); for (let i = 0; i < cand.length; i++) if (dN[i] > rho && !walls[i]) cand[i] = 1;
  const { labels, area } = label4(cand, w, h);
  const n = area.length;
  const wallAdj = new Int32Array(n), freeAdj = new Int32Array(n);
  const bx0 = new Int32Array(n).fill(w), bx1 = new Int32Array(n).fill(-1), by0 = new Int32Array(n).fill(h), by1 = new Int32Array(n).fill(-1);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x, l = labels[i]; if (!l) continue;
    if (x < bx0[l]) bx0[l] = x; if (x > bx1[l]) bx1[l] = x; if (y < by0[l]) by0[l] = y; if (y > by1[l]) by1[l] = y;
    for (const j of [i - 1, i + 1, i - w, i + w]) { if (labels[j] === l) continue; if (walls[j]) wallAdj[l]++; else freeAdj[l]++; }
  }
  // заплатка проёма: небольшая, тонкая (толщина ≈ стена: проём — разрыв в прямой стене, а не мостик через комнату)
  // и почти не прилегает к стене по периметру (только двумя торцами)
  const maxArea = 2 * rho * Math.max(3 * wallPx, 12) * 1.5, maxThin = 2.5 * wallPx + 2;
  const keep = new Uint8Array(n);
  for (let l = 1; l < n; l++) {
    const per = wallAdj[l] + freeAdj[l], thin = Math.min(bx1[l] - bx0[l], by1[l] - by0[l]) + 1;
    if (area[l] <= maxArea && thin <= maxThin && per > 0 && wallAdj[l] / per < 0.45) keep[l] = 1;
  }
  const out = new Uint8Array(walls);
  // заплатка — строгий прямоугольник между косяками (у морфологического закрытия концы скруглены → зигзаг в контуре);
  // если компонента явно не прямоугольная (косая стена), оставляем как есть
  for (let l = 1; l < n; l++) {
    if (!keep[l]) continue;
    const bw = bx1[l] - bx0[l] + 1, bh = by1[l] - by0[l] + 1;
    if (bw * bh <= area[l] * 1.35) { for (let y = by0[l]; y <= by1[l]; y++) for (let x = bx0[l]; x <= bx1[l]; x++) if (!walls[y * w + x]) out[y * w + x] = 1; }
    else for (let i = 0; i < out.length; i++) if (labels[i] === l) out[i] = 1;
  }
  return out;
}

/** «Закрыть двери» напрямую: проём — это разрыв в стене. Свободный пиксель лежит в проёме, если вдоль одной оси до стены
 *  с обеих сторон в сумме ≤ doorPx, а сами эти стены в этом месте тонкие поперёк (их протяжённость по другой оси ≤ maxT),
 *  то есть это торцы одной стены, а не две длинные стены узкой комнаты (прихожая, коридор). Так проёмы закрываются и в
 *  узких помещениях, где морфологическое закрытие «съедало» всю комнату и отбрасывало её вместе с дверью. */
export function closeDoorsDirect(walls: Uint8Array, w: number, h: number, doorPx: number, wallPx: number): Uint8Array {
  return closeGaps(walls, w, h, doorPx, wallPx);
}
/**
 * Окна на штриховом чертеже: проём в стене шириной до winPx, перекрытый тонкими линиями (стекло, ограждение). Закрываем
 * только тёмные пиксели проёма (сами линии) и 1 px вокруг них — комната не вытекает через окно наружу, а улица не
 * заходит внутрь; широкие проёмы без линий (проход между комнатами) остаются открытыми.
 */
export function closeWindows(walls: Uint8Array, g: Gray, winPx: number, wallPx: number, T = 200): Uint8Array {
  const { w, h } = g;
  const lines = closeGaps(walls, w, h, winPx, wallPx, (i) => g.data[i] < T);
  const out = new Uint8Array(lines);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x; if (walls[i] || lines[i]) continue; if ((lines[i - 1] && !walls[i - 1]) || (lines[i + 1] && !walls[i + 1]) || (lines[i - w] && !walls[i - w]) || (lines[i + w] && !walls[i + w])) out[i] = 1; }
  return out;
}
/** Закрытие проёмов шириной ≤ maxPx между торцами стен (см. closeDoorsDirect); `pred` ограничивает закрываемые пиксели. */
function closeGaps(walls: Uint8Array, w: number, h: number, doorPx: number, wallPx: number, pred?: (i: number) => boolean): Uint8Array {
  const out = new Uint8Array(walls);
  const maxT = Math.round(2.5 * wallPx) + 2;
  const isW = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && walls[y * w + x] === 1;
  // протяжённость стены через точку (x,y) вдоль оси (dx,dy): сколько подряд стена в обе стороны
  const extent = (x: number, y: number, dx: number, dy: number) => { let n = 1; for (let k = 1; k <= maxT + 1; k++) { if (isW(x + dx * k, y + dy * k)) n++; else break; } for (let k = 1; k <= maxT + 1; k++) { if (isW(x - dx * k, y - dy * k)) n++; else break; } return n; };
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = y * w + x; if (walls[i] || (pred && !pred(i))) continue;
    for (const [dx, dy] of [[1, 0], [0, 1]] as const) {
      let a = 0; while (a < doorPx && !isW(x - dx * (a + 1), y - dy * (a + 1))) { if (x - dx * (a + 1) < 0 || y - dy * (a + 1) < 0) { a = doorPx; break; } a++; }
      if (a >= doorPx) continue;
      let b = 0; while (a + b < doorPx && !isW(x + dx * (b + 1), y + dy * (b + 1))) { if (x + dx * (b + 1) >= w || y + dy * (b + 1) >= h) { b = doorPx; break; } b++; }
      if (a + b >= doorPx) continue;
      const e1x = x - dx * (a + 1), e1y = y - dy * (a + 1), e2x = x + dx * (b + 1), e2y = y + dy * (b + 1);
      if (extent(e1x, e1y, dy, dx) <= maxT && extent(e2x, e2y, dy, dx) <= maxT) { out[i] = 1; break; }
    }
  }
  return out;
}

/** Растеризация полигона (в пикселях) в маску по чётно-нечётному правилу; возвращает ограничивающий прямоугольник. */
function rasterPoly(poly: Pt[], w: number, h: number, out: Uint8Array): { x0: number; y0: number; x1: number; y1: number } {
  let x0 = w, y0 = h, x1 = -1, y1 = -1;
  poly.forEach(([x, y]) => { x0 = Math.min(x0, Math.floor(x)); y0 = Math.min(y0, Math.floor(y)); x1 = Math.max(x1, Math.ceil(x)); y1 = Math.max(y1, Math.ceil(y)); });
  x0 = Math.max(0, x0); y0 = Math.max(0, y0); x1 = Math.min(w - 1, x1); y1 = Math.min(h - 1, y1);
  const xs: number[] = [];
  for (let y = y0; y <= y1; y++) {
    const yc = y + 0.5; xs.length = 0;
    for (let i = 0; i < poly.length; i++) {
      const [ax, ay] = poly[i], [bx, by] = poly[(i + 1) % poly.length];
      if ((ay <= yc && by > yc) || (by <= yc && ay > yc)) xs.push(ax + ((yc - ay) * (bx - ax)) / (by - ay));
    }
    xs.sort((a, b) => a - b);
    for (let k = 0; k + 1 < xs.length; k += 2) {
      const xa = Math.max(0, Math.round(xs[k])), xb = Math.min(w - 1, Math.round(xs[k + 1]) - 1);
      for (let x = xa; x <= xb; x++) out[y * w + x] = 1;
    }
  }
  return { x0, y0, x1, y1 };
}

/** Связные компоненты (4-связность): метки 1..n, площади, касание края кадра. */
function label4(mask: Uint8Array, w: number, h: number): { labels: Int32Array; area: number[]; border: boolean[] } {
  const labels = new Int32Array(w * h);
  const area: number[] = [0]; const border: boolean[] = [false];
  const stack = new Int32Array(w * h);
  let n = 0;
  for (let i = 0; i < mask.length; i++) {
    if (!mask[i] || labels[i]) continue;
    n++; let sp = 0; stack[sp++] = i; labels[i] = n; let cnt = 0; let touch = false;
    while (sp) {
      const p = stack[--sp]; cnt++;
      const x = p % w, y = (p - x) / w;
      if (x === 0 || y === 0 || x === w - 1 || y === h - 1) touch = true;
      if (x > 0 && mask[p - 1] && !labels[p - 1]) { labels[p - 1] = n; stack[sp++] = p - 1; }
      if (x < w - 1 && mask[p + 1] && !labels[p + 1]) { labels[p + 1] = n; stack[sp++] = p + 1; }
      if (y > 0 && mask[p - w] && !labels[p - w]) { labels[p - w] = n; stack[sp++] = p - w; }
      if (y < h - 1 && mask[p + w] && !labels[p + w]) { labels[p + w] = n; stack[sp++] = p + w; }
    }
    area.push(cnt); border.push(touch);
  }
  return { labels, area, border };
}

/** Многозатравочная заливка: метки ядер растекаются по свободным (не-стена) пикселям до встречи друг с другом. */
function floodLabels(labels: Int32Array, walls: Uint8Array, w: number, h: number, into?: Uint8Array, maxDepth = Infinity): Int32Array {
  const out = new Int32Array(labels);
  const q = new Int32Array(w * h);
  let head = 0, tail = 0;
  for (let i = 0; i < out.length; i++) if (out[i]) q[tail++] = i;
  const ok = (j: number) => !out[j] && (into ? into[j] === 1 : !walls[j]);
  let layerEnd = tail, depth = 0;
  while (head < tail) {
    if (head === layerEnd) { depth++; layerEnd = tail; if (depth > maxDepth) break; }
    const p = q[head++]; const l = out[p];
    const x = p % w, y = (p - x) / w;
    if (x > 0 && ok(p - 1)) { out[p - 1] = l; q[tail++] = p - 1; }
    if (x < w - 1 && ok(p + 1)) { out[p + 1] = l; q[tail++] = p + 1; }
    if (y > 0 && ok(p - w)) { out[p - w] = l; q[tail++] = p - w; }
    if (y < h - 1 && ok(p + w)) { out[p + w] = l; q[tail++] = p + w; }
  }
  return out;
}

/** Внешний контур самой большой компоненты маски (обход Мура, 8-связность) — точки в пикселях (центры). */
export function traceOutline(mask: Uint8Array, w: number, h: number): Pt[] {
  const { labels, area } = label4(mask, w, h);
  if (area.length < 2) return [];
  let best = 1; for (let i = 2; i < area.length; i++) if (area[i] > area[best]) best = i;
  const on = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && labels[y * w + x] === best;
  let sx = -1, sy = -1;
  outer: for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) if (labels[y * w + x] === best) { sx = x; sy = y; break outer; }
  if (sx < 0) return [];
  // направления по часовой: В, ЮВ, Ю, ЮЗ, З, СЗ, С, СВ
  const DX = [1, 1, 0, -1, -1, -1, 0, 1], DY = [0, 1, 1, 1, 0, -1, -1, -1];
  const out: Pt[] = [[sx, sy]];
  let cx = sx, cy = sy, dir = 0; // стартовый пиксель — самый верхний-левый, обход по часовой стрелке
  const maxSteps = w * h * 2;
  for (let step = 0; step < maxSteps; step++) {
    let found = -1;
    for (let k = 0; k < 8; k++) { const d = (dir + 6 + k) % 8; if (on(cx + DX[d], cy + DY[d])) { found = d; break; } } // просмотр с поворота на 90° влево от направления прихода
    if (found < 0) break; // одиночный пиксель
    cx += DX[found]; cy += DY[found]; dir = found;
    if (cx === sx && cy === sy && out.length > 2) break;
    out.push([cx, cy]);
  }
  return out;
}

/** Залить дырки (области, не достижимые от границы кадра по «не-маске»). */
export function fillHoles(mask: Uint8Array, w: number, h: number): void {
  const outside = new Uint8Array(w * h);
  const stack = new Int32Array(w * h);
  let sp = 0;
  const seed = (i: number) => { if (!mask[i] && !outside[i]) { outside[i] = 1; stack[sp++] = i; } };
  for (let x = 0; x < w; x++) { seed(x); seed((h - 1) * w + x); }
  for (let y = 0; y < h; y++) { seed(y * w); seed(y * w + w - 1); }
  while (sp) {
    const p = stack[--sp]; const x = p % w, y = (p - x) / w;
    if (x > 0) seed(p - 1); if (x < w - 1) seed(p + 1); if (y > 0) seed(p - w); if (y < h - 1) seed(p + w);
  }
  for (let i = 0; i < mask.length; i++) if (!mask[i] && !outside[i]) mask[i] = 1;
}

/** Ломаная по пиксельному контуру — «инженерная» регуляризация:
 *   1) вершины РДП; 2) каждое ребро — прямая по всем точкам контура между вершинами (наименьшие квадраты);
 *   3) доминирующие направления контура (оси здания: кластеры углов по длине) — рёбра в пределах ±snapTol° к ним
 *      ставятся строго по направлению (скошенные фасады и балконы образуют свои направления и остаются косыми);
 *   4) соседние коллинеарные рёбра сливаются (одно направление и смещение ≤ полстены);
 *   5) вершины — пересечения соседних прямых; короткие рёбра: фаска между непараллельными соседями убирается,
 *      уступ между параллельными — либо сливается (смещение мало), либо становится строгой ступенькой под 90°.
 *  Координаты — пиксели вырезки. */
function fitStraight(outline: Pt[], eps: number, wallPx: number, chamferAreaLim: number, snapTol = 2.5): Pt[] {
  const n = outline.length;
  if (n < 8) return outline;
  let far = 0, md = -1;
  for (let i = 1; i < n; i++) { const d = Math.hypot(outline[i][0] - outline[0][0], outline[i][1] - outline[0][1]); if (d > md) { md = d; far = i; } }
  const rdp = (a: number, b: number, out: number[]) => {
    let best = -1, bd = eps;
    const [ax, ay] = outline[a], [bx, by] = outline[b % n];
    const L = Math.hypot(bx - ax, by - ay) || 1e-9;
    for (let i = a + 1; i < b; i++) { const [px, py] = outline[i % n]; const d = Math.abs((bx - ax) * (ay - py) - (ax - px) * (by - ay)) / L; if (d > bd) { bd = d; best = i; } }
    if (best < 0) return;
    rdp(a, best, out); out.push(best); rdp(best, b, out);
  };
  const idx: number[] = [0]; rdp(0, far, idx); idx.push(far); rdp(far, n, idx);
  const uniq = idx.filter((v, i, a) => i === 0 || v !== a[i - 1]).map((v) => v % n);
  if (uniq.length < 3) return outline;
  type Line = { x: number; y: number; ang: number; from: number; to: number; len: number; rms: number; fixed?: boolean };
  const norm = (a: number) => { let d = a % 180; if (d < 0) d += 180; return d; }; // угол прямой 0..180
  const fitRaw = (from: number, to: number): Line => {
    const cnt = ((to - from + n) % n) + 1;
    let sx = 0, sy = 0; for (let k = 0; k < cnt; k++) { const p = outline[(from + k) % n]; sx += p[0]; sy += p[1]; }
    const mx = sx / cnt, my = sy / cnt;
    let sxx = 0, syy = 0, sxy = 0; for (let k = 0; k < cnt; k++) { const p = outline[(from + k) % n]; const ux = p[0] - mx, uy = p[1] - my; sxx += ux * ux; syy += uy * uy; sxy += ux * uy; }
    const angR = 0.5 * Math.atan2(2 * sxy, sxx - syy);
    const ang = norm((angR * 180) / Math.PI);
    // среднеквадратичное отклонение точек от прямой: чистая прямая ≈ 1 px, «пила» из ниш и уступов — заметно больше
    const nx = -Math.sin(angR), ny = Math.cos(angR);
    let se = 0; for (let k = 0; k < cnt; k++) { const p = outline[(from + k) % n]; const d = (p[0] - mx) * nx + (p[1] - my) * ny; se += d * d; }
    const p0 = outline[from], p1 = outline[to];
    return { x: mx, y: my, ang, from, to, len: Math.hypot(p1[0] - p0[0], p1[1] - p0[1]), rms: Math.sqrt(se / cnt) };
  };
  const dAng = (a: number, b: number) => { const d = Math.abs(norm(a) - norm(b)); return Math.min(d, 180 - d); };
  let lines: Line[] = uniq.map((v, k) => fitRaw(v, uniq[(k + 1) % uniq.length]));
  // доминирующие направления: кластеры углов, взвешенные длиной; оси 0/90 — всегда кандидаты
  const total = lines.reduce((a, l) => a + l.len, 0);
  const doms: number[] = [0, 90];
  const sorted = [...lines].sort((a, b) => b.len - a.len);
  // своё направление получает только чистая прямая (малый rms), достаточно длинная и не «почти осевая»
  for (const l of sorted) {
    if (l.len < 3 * wallPx) break;
    if (l.rms > 1.6 || doms.some((d) => dAng(d, l.ang) < 5)) continue; // настоящий косой фасад отличается от оси не меньше чем на 5°
    const w = lines.filter((m) => dAng(m.ang, l.ang) <= snapTol).reduce((a, m) => a + m.len, 0);
    if (w >= 0.12 * total || l.len >= 8 * wallPx) doms.push(l.ang);
  }
  // «пила» (большой rms) прилипает к направлению и при большем отклонении: наклон у неё от ниш и проёмов, а не от стены
  // длинная стена (> 8 толщин) с наклоном до 3,5° — осевая: такие «почти вертикали» в домах не бывают
  // оси здания в приоритете: если ребро в допуске от 0°/90° — оно осевое, даже когда косое направление (балкон) ближе;
  // косое направление берётся только для рёбер, которые осям не подходят
  const snap = (l: Line): Line => {
    const jagged = l.rms > 1.6; // «пила» (ниши, уступы, объединение через ступеньку) — только к осям, косое направление ей не положено
    const tol = jagged ? snapTol * 2 : l.len > 8 * wallPx ? 3.5 : snapTol;
    const dAx = Math.min(dAng(0, l.ang), dAng(90, l.ang));
    if (dAx < tol) return { ...l, ang: dAng(0, l.ang) <= dAng(90, l.ang) ? 0 : 90 };
    if (jagged) return l;
    let best = -1, bd = tol; for (const d of doms) { const dd = dAng(d, l.ang); if (dd < bd) { bd = dd; best = d; } }
    return best < 0 ? l : { ...l, ang: best };
  };
  const fit = (from: number, to: number) => snap(fitRaw(from, to));
  lines = lines.map(snap);
  const dir = (l: Line) => [Math.cos((l.ang * Math.PI) / 180), Math.sin((l.ang * Math.PI) / 180)];
  const offset = (a: Line, b: Line) => { const [dx, dy] = dir(a); return Math.abs((b.x - a.x) * dy - (b.y - a.y) * dx); };
  const colTol = 0.5 * wallPx;
  const rotate = (arr: Line[], k: number) => [...arr.slice(k), ...arr.slice(0, k)];
  // соседние коллинеарные прямые (одно направление, смещение ≤ полстены) — в одну
  // объединение двух прямых одного направления: если одна заметно короче (выступ вытяжки, оконная ниша, обрывок у стыка),
  // геометрия длинной остаётся как есть — иначе примесь короткого куска наклоняет всю стену
  const isDomAng = (ang: number) => doms.some((d) => dAng(d, ang) < 0.5);
  const join = (a: Line, b: Line): Line => {
    const short = Math.min(a.len, b.len), long = Math.max(a.len, b.len);
    if (short < 3 * wallPx && long >= 2 * short) {
      const L = a.len >= b.len ? a : b, S = L === a ? b : a;
      // направление — осевое, если хоть одна из двух прилипла к оси; центр — у длинной
      const ang = isDomAng(L.ang) ? L.ang : isDomAng(S.ang) ? S.ang : L.ang;
      return { ...L, ang, from: a.from, to: b.to, len: a.len + b.len };
    }
    return fit(a.from, b.to);
  };
  const mergeCollinear = () => {
    for (let guard = 0; guard < lines.length * 3; guard++) {
      let changed = false;
      for (let k = 0; k < lines.length && lines.length > 3; k++) {
        const a = lines[k], b = lines[(k + 1) % lines.length];
        if (dAng(a.ang, b.ang) <= 3 && offset(a, b) <= colTol * 2) { lines = rotate(lines, k); lines.splice(0, 2, join(a, b)); changed = true; break; }
      }
      if (!changed) break;
    }
  };
  mergeCollinear();
  // косая «перемычка» между двумя параллельными стенами (уступ у шахт, колонн) — на самом деле ступенька:
  // ставим её строго перпендикулярно соседям через её же середину
  const squareSteps = () => {
    for (let k = 0; k < lines.length; k++) {
      const a = lines[(k - 1 + lines.length) % lines.length], b = lines[(k + 1) % lines.length], l = lines[k];
      if (dAng(a.ang, b.ang) < 10 && l.len < 4 * wallPx && dAng(l.ang, a.ang + 90) > 0.5 && dAng(l.ang, a.ang) > 20) lines[k] = { ...l, ang: norm(a.ang + 90) };
    }
  };
  squareSteps();
  // короткое ребро, близкое к направлению здания (до 12°), — шум на стыке стен/шахт: ставим по направлению,
  // затем оно сольётся с соседней стеной или отпадёт как фаска
  const snapShort = () => {
    for (let k = 0; k < lines.length; k++) {
      const l = lines[k]; if (l.len >= 10 * wallPx) continue;
      // рёбра короче ~10 толщин стены (≈2,5 м) с наклоном до 15° — стык стен/раздел между квартирами, а не косой фасад
      // (настоящие косые фасады и балконы длинные); чем короче, тем больший наклон прощаем
      const tol = l.len < 4 * wallPx ? 20 : 15;
      const dAx = Math.min(dAng(0, l.ang), dAng(90, l.ang));
      if (dAx <= 0.5) continue; // уже осевое — не трогаем (иначе уходило к косому направлению балкона)
      if (dAx < tol) { lines[k] = { ...l, ang: dAng(0, l.ang) <= dAng(90, l.ang) ? 0 : 90 }; continue; }
      let best = -1, bd = tol; for (const d of doms) { const dd = dAng(d, l.ang); if (dd > 0.5 && dd < bd) { bd = dd; best = d; } }
      if (best >= 0) lines[k] = { ...l, ang: best };
    }
  };
  snapShort(); mergeCollinear(); squareSteps();
  // Вершины. Соседи под углом ≥ 20° — пересечение прямых. Почти параллельные соседи (уступ) — пересечения нет или оно
  // далеко; тогда ставится ступенька: точка стыка проецируется на первую прямую, а затем на вторую строго по
  // перпендикуляру. Так ни одна вершина не может «улететь».
  const proj = (p: Pt, l: Line): Pt => { const [dx, dy] = dir(l); const t = (p[0] - l.x) * dx + (p[1] - l.y) * dy; return [l.x + dx * t, l.y + dy * t]; };
  const build = (ls: Line[]): { verts: Pt[]; owner: number[] } => { // owner[i] — индекс прямой, которой принадлежит ребро verts[i]→verts[i+1]; -1 — ступенька
    const verts: Pt[] = [], owner: number[] = [];
    for (let k = 0; k < ls.length; k++) {
      const a = ls[(k - 1 + ls.length) % ls.length], b = ls[k];
      if (dAng(a.ang, b.ang) >= 20) {
        const [adx, ady] = dir(a), [bdx, bdy] = dir(b);
        const den = adx * bdy - ady * bdx;
        const t = ((b.x - a.x) * bdy - (b.y - a.y) * bdx) / den;
        verts.push([a.x + adx * t, a.y + ady * t]); owner.push(k);
      } else {
        const P = proj(outline[b.from], a), Q = proj(P, b);
        verts.push(P); owner.push(-1); verts.push(Q); owner.push(k);
      }
    }
    return { verts, owner };
  };
  // убираем фаски и мелкие уступы: прямая, чьё ребро короче chamferMax (или короче stepMax, если это ступенька между
  // параллельными), удаляется; соседи после этого либо пересекутся, либо получат строгую ступеньку
  const chamferMax = 1.8 * wallPx, stepMax = 1.5 * wallPx; // уступ до полутора толщин стены (оконные ниши, кромка балкона против грани стены) — не излом
  let res = build(lines);
  for (let guard = 0; guard < 80 && lines.length > 3; guard++) {
    const { verts, owner } = res;
    const edgeLen = new Map<number, number>();
    for (let i = 0; i < verts.length; i++) { const o = owner[i]; if (o < 0) continue; const p = verts[i], q = verts[(i + 1) % verts.length]; edgeLen.set(o, (edgeLen.get(o) ?? 0) + Math.hypot(q[0] - p[0], q[1] - p[1])); }
    let kMin = -1, lMin = Infinity;
    const isDom = (l: Line) => doms.some((d) => dAng(d, l.ang) < 0.5);
    for (let k = 0; k < lines.length; k++) {
      const L = edgeLen.get(k) ?? 0;
      const a = lines[(k - 1 + lines.length) % lines.length], b = lines[(k + 1) % lines.length];
      const between = dAng(a.ang, b.ang);
      const par = between < 20;
      let lim = par ? stepMax : chamferMax;
      // срез между двумя осевыми стенами под прямым углом (стык у шахт, колонн): угол должен быть углом — убираем и длинный
      // срез, если отсекаемый им треугольник мал (до chamferAreaLim)
      if (!par && isDom(a) && isDom(b) && between >= 60 && L >= lim) {
        const [adx, ady] = dir(a), [bdx, bdy] = dir(b); const den = adx * bdy - ady * bdx;
        if (Math.abs(den) > 1e-6) {
          const t = ((b.x - a.x) * bdy - (b.y - a.y) * bdx) / den; const C: Pt = [a.x + adx * t, a.y + ady * t];
          const i0 = owner.indexOf(k); const P = verts[i0], Q = verts[(i0 + 1) % verts.length];
          const tri = Math.abs((P[0] - C[0]) * (Q[1] - C[1]) - (Q[0] - C[0]) * (P[1] - C[1])) / 2;
          if (tri <= chamferAreaLim) lim = L + 1;
        }
      }
      if (L < lim && L < lMin) { lMin = L; kMin = k; }
    }
    if (kMin < 0) {
      // «клин» из двух коротких неосевых рёбер между двумя осевыми стенами под углом (выемка в толстом углу стены,
      // где никто не дотянулся до середины): срезаем оба, если отсекаемая площадь мала — стены пересекутся в углу
      let done = false;
      for (let k = 0; k < lines.length && lines.length > 4 && !done; k++) {
        const l1 = lines[k], l2 = lines[(k + 1) % lines.length], a = lines[(k - 1 + lines.length) % lines.length], b = lines[(k + 2) % lines.length];
        if (isDom(l1) || isDom(l2) || !isDom(a) || !isDom(b)) continue;
        if ((edgeLen.get(k) ?? 0) >= 3 * wallPx || (edgeLen.get((k + 1) % lines.length) ?? 0) >= 3 * wallPx) continue;
        // V-образная перемычка между двумя параллельными стенами (уступ) — убираем обе, ступеньку построит build
        if (dAng(a.ang, b.ang) < 20) { if (offset(a, b) <= 6 * wallPx) { lines = rotate(lines, k); lines.splice(0, 2); done = true; } continue; }
        if (dAng(a.ang, b.ang) < 60) continue;
        const [adx, ady] = dir(a), [bdx, bdy] = dir(b); const den = adx * bdy - ady * bdx; if (Math.abs(den) < 1e-6) continue;
        const t = ((b.x - a.x) * bdy - (b.y - a.y) * bdx) / den; const C: Pt = [a.x + adx * t, a.y + ady * t];
        const i0 = owner.indexOf(k), i1 = owner.indexOf((k + 1) % lines.length); if (i0 < 0 || i1 < 0) continue;
        const P = verts[i0], M = verts[i1], Q = verts[(i1 + 1) % verts.length];
        const tri = (u: Pt, v: Pt) => Math.abs((u[0] - C[0]) * (v[1] - C[1]) - (v[0] - C[0]) * (u[1] - C[1])) / 2;
        if (tri(P, M) + tri(M, Q) <= chamferAreaLim) { lines = rotate(lines, k); lines.splice(0, 2); done = true; }
      }
      if (!done) break;
    } else lines.splice(kMin, 1);
    snapShort(); mergeCollinear(); squareSteps();
    res = build(lines);
  }
  // ступеньки короче полстены схлопываем (вершины P и Q совпадают с точностью до шума)
  const out: Pt[] = [];
  for (let i = 0; i < res.verts.length; i++) {
    const p = res.verts[i], q = res.verts[(i + 1) % res.verts.length];
    if (res.owner[i] < 0 && Math.hypot(q[0] - p[0], q[1] - p[1]) < 1.5) continue;
    out.push(p);
  }
  return out.length >= 3 ? out : outline;
}

/** Доля грубого контура, лежащая вне здания (на белом поле листа), и его площадь в долях листа — проверка результата ИИ. */
export function roughSanity(g: Gray, poly: Pt[]): { outside: number; areaFrac: number } {
  const { w, h } = g;
  const ext = exteriorMask(g);
  const m = new Uint8Array(w * h);
  rasterPoly(poly.map(([x, y]) => [x * w, y * h] as Pt), w, h, m);
  let n = 0, out = 0;
  for (let i = 0; i < m.length; i++) if (m[i]) { n++; if (ext[i]) out++; }
  return { outside: n ? out / n : 1, areaFrac: n / (w * h) };
}

const polyAreaPx = (poly: Pt[]) => { let a = 0; for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]; a += x0 * y1 - x1 * y0; } return Math.abs(a) / 2; };
const median = (xs: number[]) => { if (!xs.length) return 0; const s = [...xs].sort((a, b) => a - b); return s[Math.floor(s.length / 2)]; };

type Pass = { fitted: WallFitOut[]; areasPx: Map<number, number>; r: number };
type Opts = { /** штриховой ч/б чертёж: окна закрываются по тонким линиям */ hatched?: boolean; darkT: number; doorM: number; coreM: number; marginM: number; minFrac: number; debug?: (msg: string) => void; debugMask?: WallFitOpts["debugMask"]; probe?: Pt };

function fitPass(g: Gray, walls0: Uint8Array, thick: Uint8Array, ext: Uint8Array | null, tiny: Uint8Array, wallPx: number, units: WallFitUnit[], pxPerM: number, o: Opts): Pass {
  const { w, h } = g;
  const toPx = (poly: Pt[]): Pt[] => poly.map(([x, y]) => [x * w, y * h]);
  const rough = units.map((u) => ({ u, px: toPx(u.poly) }));
  const rho = Math.max(4, Math.min(Math.round((o.doorM / 2) * pxPerM), Math.round(0.08 * Math.max(w, h)))); // полширины двери
  const r = Math.max(3, Math.round(o.coreM * pxPerM));
  const margin = Math.round(o.marginM * pxPerM);
  let walls = walls0;

  // входные и межкомнатные двери «закрываем» заплатками — квартира становится замкнутой, прихожие не утекают в коридор.
  // В несколько шагов по возрастанию ширины: при большом радиусе сразу заплатка проёма слипается с заливкой углов и
  // отбраковывается целиком, а поэтапно узкие проёмы уже закрыты, и крупный шаг видит только широкие.
  walls = closeDoorsDirect(walls, w, h, Math.round(o.doorM * pxPerM), wallPx);
  if (o.hatched) walls = closeWindows(walls, g, Math.round(3.0 * pxPerM), wallPx);
  void rho;
  // ядра комнат: дальше r от стен
  const dWall = edt(walls, w, h);
  const core = new Uint8Array(w * h);
  for (let i = 0; i < core.length; i++) if (dWall[i] > r) core[i] = 1;
  const { labels, area, border } = label4(core, w, h);
  const nComp = area.length - 1;
  o.debug?.(`pass: pxPerM ${pxPerM.toFixed(1)}, door ρ ${rho}, core r ${r}, cores ${nComp}`);
  if (!nComp) return { fitted: [], areasPx: new Map(), r };

  // раздача ядер квартирам по доле площади внутри расширенной грубой области
  const minArea = Math.max(9, Math.round(0.3 * 0.3 * pxPerM * pxPerM));
  const cx = new Float64Array(nComp + 1), cy = new Float64Array(nComp + 1);
  for (let i = 0; i < labels.length; i++) { const l = labels[i]; if (l) { const x = i % w; cx[l] += x; cy[l] += (i - x) / w; } }
  for (let l = 1; l <= nComp; l++) { cx[l] /= area[l]; cy[l] /= area[l]; }
  const rc = rough.map((ru) => { let sx = 0, sy = 0; ru.px.forEach(([x, y]) => { sx += x; sy += y; }); return [sx / ru.px.length, sy / ru.px.length] as Pt; });
  const distC = (l: number, ui: number) => Math.hypot(cx[l] - rc[ui][0], cy[l] - rc[ui][1]);
  const bestFrac = new Float32Array(nComp + 1), bestUnit = new Int32Array(nComp + 1).fill(-1);
  const inside = new Uint8Array(w * h);
  const counts = new Int32Array(nComp + 1);
  const skip = new Uint8Array(rough.length);
  const ghost = new Int32Array(w * h).fill(-1); // грубые области отвергнутых квартир: комнаты, которые «числятся» за соседями
  const expMask: ({ x0: number; y0: number; cw: number; ch: number; m: Uint8Array } | undefined)[] = [];
  rough.forEach((ru, ui) => {
    inside.fill(0);
    const bb = rasterPoly(ru.px, w, h, inside);
    // грубый контур, который в основном за пределами здания (на белом поле) или ничтожно мал, — ошибка поиска; не используем
    { let nIn = 0, nExt = 0; for (let i = 0; i < inside.length; i++) if (inside[i]) { nIn++; if (ext && ext[i]) nExt++; } const m2 = nIn / (pxPerM * pxPerM); const exp = ru.u.area ?? 0;
      // и грубый контур, площадь которого не вяжется с паспортной (в 2,5 раза больше — захватил соседей; втрое меньше — комната)
      if ((ext && nExt > 0.35 * nIn) || m2 < 8 || (exp > 0 && (m2 > 2.5 * exp || m2 < 0.35 * exp))) { skip[ui] = 1; for (let i = 0; i < inside.length; i++) if (inside[i]) ghost[i] = ui; o.debug?.(`unit ${ru.u.uid}: rough rejected (outside ${(100 * nExt / Math.max(1, nIn)).toFixed(0)}%, ${m2.toFixed(1)}м² vs ${exp}м²)`); return; } }
    // расстояние до грубой области считаем только в её окрестности (вырезка) — дёшево даже для десятков квартир
    const X0 = Math.max(0, bb.x0 - margin - 1), X1 = Math.min(w - 1, bb.x1 + margin + 1), Y0 = Math.max(0, bb.y0 - margin - 1), Y1 = Math.min(h - 1, bb.y1 + margin + 1);
    const cw = X1 - X0 + 1, ch = Y1 - Y0 + 1;
    const sub = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) sub[y * cw + x] = inside[(Y0 + y) * w + X0 + x];
    const dIn = edt(sub, cw, ch); // 0 внутри области
    counts.fill(0);
    const em = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const i = (Y0 + y) * w + X0 + x; const l = labels[i]; const inExp = dIn[y * cw + x] <= margin; if (inExp) em[y * cw + x] = 1; if (l && inExp) counts[l]++; }
    expMask[ui] = { x0: X0, y0: Y0, cw, ch, m: em };
    for (let l = 1; l <= nComp; l++) {
      if (!counts[l] || area[l] < minArea || border[l]) continue; // ядра, упирающиеся в край листа, — фон
      const frac = counts[l] / area[l];
      // при равной доле (грубые области перекрываются) — та квартира, чей грубый центр ближе к центру ядра
      if (frac > bestFrac[l] + 0.02 || (Math.abs(frac - bestFrac[l]) <= 0.02 && bestUnit[l] >= 0 && distC(l, ui) < distC(l, bestUnit[l]))) { bestFrac[l] = frac; bestUnit[l] = ui; }
    }
  });

  if (o.debug) { const rows: string[] = []; for (let l = 1; l <= nComp; l++) if (area[l] > 0.8 * pxPerM * pxPerM) rows.push(`#${l} ${(area[l] / (pxPerM * pxPerM)).toFixed(1)}м²@${Math.round(cx[l])},${Math.round(cy[l])}→${bestUnit[l]}/${bestFrac[l].toFixed(2)}${border[l] ? "B" : ""}`); o.debug(`cores: ${rows.join(" ")}`); }
  const pi = o.probe ? Math.round(o.probe[1]) * w + Math.round(o.probe[0]) : -1;
  if (pi >= 0) o.debug?.(`probe: wall0 ${walls0[pi]} wall ${walls[pi]} core ${labels[pi]} ext ${ext ? ext[pi] : 0}`);
  // заливка до стен всеми ядрами сразу (и чужими тоже — они не дают квартире вытечь в коридор через дверь)
  const flood = floodLabels(labels, walls, w, h);
  const compUnit = new Int32Array(nComp + 1).fill(-1);
  for (let l = 1; l <= nComp; l++) if (bestUnit[l] >= 0 && bestFrac[l] >= o.minFrac) compUnit[l] = bestUnit[l];
  // ядро, чья залитая область (комната целиком) в основном лежит вне грубой области квартиры, — чужое: маленький кусочек
  // коридора в зоне запаса квартиры не должен утащить за собой весь коридор и лестницу
  {
    const tot = new Int32Array(nComp + 1), ins = new Int32Array(nComp + 1);
    for (let i = 0; i < flood.length; i++) { const l = flood[i]; if (!l || compUnit[l] < 0) continue; tot[l]++; const e = expMask[compUnit[l]]; if (!e) continue; const x = i % w, y = (i - x) / w; if (x >= e.x0 && y >= e.y0 && x < e.x0 + e.cw && y < e.y0 + e.ch && e.m[(y - e.y0) * e.cw + (x - e.x0)]) ins[l]++; }
    for (let l = 1; l <= nComp; l++) if (compUnit[l] >= 0 && tot[l] && ins[l] < 0.5 * tot[l]) { o.debug?.(`core #${l} revoked from unit ${compUnit[l]}: flooded ${(tot[l] / (pxPerM * pxPerM)).toFixed(1)}м², inside ${(100 * ins[l] / tot[l]).toFixed(0)}%`); compUnit[l] = -1; }
  }
  // Общий коридор: область, из которой двери ведут в комнаты двух и более ДРУГИХ квартир, — общая (холл с лифтом,
  // лестничная клетка), даже если грубый контур ИИ её накрыл и её ядро досталось квартире. Такое ядро отбираем: квартира
  // без паспортной площади иначе «проглатывает» весь этаж. Считаем по области заливки каждого ядра (не по комнате
  // целиком): кухня, у которой не распозналась дверь в коридор, сливается с ним в одну «комнату», но её ядро заливает
  // лишь свой угол и чужих дверей не касается.
  {
    const free = new Uint8Array(w * h); for (let i = 0; i < free.length; i++) if (!walls[i]) free[i] = 1;
    const rm = label4(free, w, h);
    const nU = rough.length;
    const cnt = new Map<number, number>(); // комната×квартира → залитых пикселей
    const roomOfLabel = new Int32Array(nComp + 1);
    for (let i = 0; i < flood.length; i++) { const l = flood[i]; if (!l || compUnit[l] < 0) continue; const r = rm.labels[i]; if (!r) continue; roomOfLabel[l] = r; const k = r * nU + compUnit[l]; cnt.set(k, (cnt.get(k) ?? 0) + 1); }
    const own = new Int32Array(rm.area.length).fill(-1), ownPx = new Int32Array(rm.area.length);
    cnt.forEach((n, k) => { const r = Math.floor(k / nU), u = k % nU; if (n > ownPx[r]) { ownPx[r] = n; own[r] = u; } });
    // Ничья комната считается комнатой соседа, если её в основном накрывает грубая область квартиры, отвергнутой
    // проверкой площади (ИИ поставил соседа мимо — но где его прихожая, он показал верно).
    { const gc = new Map<number, number>(); for (let i = 0; i < ghost.length; i++) { const g = ghost[i]; if (g < 0) continue; const r = rm.labels[i]; if (!r || own[r] >= 0) continue; const k = r * nU + g; gc.set(k, (gc.get(k) ?? 0) + 1); } gc.forEach((n, k) => { const r = Math.floor(k / nU), g = k % nU; if (n >= 0.5 * rm.area[r] && own[r] < 0) own[r] = g; }); }
    const patch = new Uint8Array(w * h); for (let i = 0; i < patch.length; i++) if (walls[i] && !walls0[i]) patch[i] = 1;
    const pl = label4(patch, w, h);
    const pRooms: number[][] = [], pLabels: number[][] = []; // заплатка → комнаты и области заливки по её сторонам
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, l = pl.labels[i]; if (!l) continue;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        const r = rm.labels[j]; if (!r) continue;
        const a = (pRooms[l] ??= []); if (!a.includes(r)) a.push(r);
        const f = flood[j]; if (f && compUnit[f] >= 0) { const b = (pLabels[l] ??= []); if (!b.includes(f)) b.push(f); }
      }
    }
    const others = new Map<number, Set<number>>();
    for (let l = 1; l < pl.area.length; l++) {
      const rs = pRooms[l], fs = pLabels[l]; if (!rs || rs.length < 2 || !fs) continue;
      for (const f of fs) { const u = compUnit[f]; for (const r2 of rs) { if (r2 === roomOfLabel[f] || own[r2] < 0 || own[r2] === u) continue; (others.get(f) ?? others.set(f, new Set()).get(f)!).add(own[r2]); } }
    }
    let revoked = 0;
    others.forEach((set, f) => { if (set.size >= 2 && compUnit[f] >= 0) { o.debug?.(`core #${f} revoked from unit ${compUnit[f]}: common area (doors to ${set.size} other units)`); compUnit[f] = -1; revoked++; } });
    if (revoked && o.debug) o.debug(`common areas: ${revoked} cores revoked`);
  }
  // «карманы» без ядра (прихожие, узкие балконы): замкнутые незалитые области. Карман отдаём квартире, если через
  // дверные заплатки он граничит с комнатами только этой квартиры (коридор и прочие незакреплённые ядра не в счёт).
  // Несколько проходов: балкон за кухней, которую квартира получила как карман, подбирается следующим проходом.
  for (let iter = 0; iter < 3; iter++) {
    const pocket = new Uint8Array(w * h);
    for (let i = 0; i < pocket.length; i++) if (!walls[i] && (!flood[i] || compUnit[flood[i]] < 0)) pocket[i] = 1; // незалитое или ничьё; заплатки дверей — стены, иначе прихожая сливается с коридором
    const pk = label4(pocket, w, h);
    const touchUnit = new Int32Array(pk.area.length).fill(-1), conflict = new Uint8Array(pk.area.length), viaPatch = new Uint8Array(pk.area.length), bigUnowned = new Uint8Array(pk.area.length);
    const touch = (l: number, u: number) => { if (touchUnit[l] < 0) touchUnit[l] = u; else if (touchUnit[l] !== u) conflict[l] = 1; };
    for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
      const i = y * w + x, l = pk.labels[i]; if (!l) continue;
      for (const j of [i - 1, i + 1, i - w, i + w]) {
        if (pk.labels[j] === l) continue;
        const fl = flood[j]; if (!fl) continue;
        const u = compUnit[fl]; if (u < 0) continue;
        touch(l, u);
      }
    }
    // прихожая соединена с комнатами квартиры только через ДВЕРИ (заплатки): считаем соседство и через заплатку —
    // заплатка, у которой с одной стороны карман, а с другой комнаты одной квартиры, отдаёт карман этой квартире
    {
      const patch = new Uint8Array(w * h); for (let i = 0; i < patch.length; i++) if (walls[i] && !walls0[i]) patch[i] = 1;
      const pl = label4(patch, w, h);
      const pUnit = new Int32Array(pl.area.length).fill(-1), pConf = new Uint8Array(pl.area.length), pPock = new Int32Array(pl.area.length).fill(0);
      const pPocks: number[][] = []; // все карманы у заплатки: кухня с дверью в ничейный коридор — не «своя» комната
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x, l = pl.labels[i]; if (!l) continue;
        for (const j of [i - 1, i + 1, i - w, i + w]) {
          if (pl.labels[j] === l) continue;
          if (pk.labels[j]) { if (!pPock[l]) pPock[l] = pk.labels[j]; const a = (pPocks[l] ??= []); if (!a.includes(pk.labels[j])) a.push(pk.labels[j]); continue; }
          const fl = flood[j]; if (!fl) continue; const u = compUnit[fl]; if (u < 0) continue;
          if (pUnit[l] < 0) pUnit[l] = u; else if (pUnit[l] !== u) pConf[l] = 1;
        }
      }
      for (let l = 1; l < pl.area.length; l++) if (pPock[l] && pUnit[l] >= 0 && !pConf[l]) { touch(pPock[l], pUnit[l]); viaPatch[pPock[l]] = 1; }
      // карман, который в основном накрыт грубым контуром ДРУГОЙ квартиры (пусть и отвергнутым по площади), — её комната
    { const gc = new Map<number, number>(); for (let i = 0; i < ghost.length; i++) { const g = ghost[i]; const l = pk.labels[i]; if (g < 0 || !l) continue; const k = l * rough.length + g; gc.set(k, (gc.get(k) ?? 0) + 1); } gc.forEach((n, k) => { const l = Math.floor(k / rough.length), g = k % rough.length; if (n >= 0.5 * pk.area[l] && touchUnit[l] >= 0 && touchUnit[l] !== g) conflict[l] = 1; }); }
    const bigNb = Math.round(5 * pxPerM * pxPerM);
      for (let l = 1; l < pl.area.length; l++) { const ps = pPocks[l]; if (!ps || ps.length < 2) continue; for (const a of ps) for (const b of ps) if (a !== b && pk.area[b] >= bigNb) bigUnowned[a] = 1; }
    }
    const maxPocket = Math.round(12 * pxPerM * pxPerM); // до ~12 м² при прямом соседстве; через дверь — до 30 м²
    const coreFrac = new Uint8Array(pk.area.length); { const cnt = new Int32Array(pk.area.length); for (let i = 0; i < pocket.length; i++) { const l = pk.labels[i]; if (l && flood[i]) cnt[l]++; } for (let l = 1; l < pk.area.length; l++) if (cnt[l] > 0.5 * pk.area[l]) coreFrac[l] = 1; }
    const seedOf = new Int32Array(rough.length).fill(0);
    for (let l = 1; l <= nComp; l++) if (compUnit[l] >= 0 && !seedOf[compUnit[l]]) seedOf[compUnit[l]] = l;
    // крупный карман через дверь — если он не был самостоятельным ядром (ядро без хозяина больше 12 м² — коридор/холл);
    // комната со своим ядром (кухня, которую грубый контур ИИ не накрыл) — до 40 м², если её двери ведут только в эту
    // квартиру и ни одна — в крупную ничейную область (коридор)
    const limit = (l: number) => !viaPatch[l] ? maxPocket : !coreFrac[l] ? 2.5 * maxPocket : bigUnowned[l] ? maxPocket : Math.round(40 * pxPerM * pxPerM);
    const okPocket = (l: number) => touchUnit[l] >= 0 && !conflict[l] && !pk.border[l] && pk.area[l] <= limit(l);
    let added = 0;
    for (let i = 0; i < pocket.length; i++) {
      const l = pk.labels[i]; if (!l) continue;
      if (okPocket(l)) { flood[i] = seedOf[touchUnit[l]]; added++; }
    }
    if (pi >= 0) { const l = pk.labels[pi]; o.debug?.(`probe: pocket ${l} area ${l ? (pk.area[l] / (pxPerM * pxPerM)).toFixed(1) : "-"}м² touch ${l ? touchUnit[l] : "-"} conflict ${l ? conflict[l] : "-"} viaPatch ${l ? viaPatch[l] : "-"} border ${l ? pk.border[l] : "-"} → flood ${flood[pi]} unit ${flood[pi] ? compUnit[flood[pi]] : "-"}`); }
    if (o.debug) {
      const skipped: string[] = [];
      const px0: number[] = [], py0: number[] = [];
      for (let i = 0; i < pk.labels.length; i++) { const l = pk.labels[i]; if (l) { const x = i % w; px0[l] = (px0[l] ?? 0) + x; py0[l] = (py0[l] ?? 0) + (i - x) / w; } }
      for (let l = 1; l < pk.area.length; l++) if (pk.area[l] > 0.8 * pxPerM * pxPerM && !okPocket(l)) skipped.push(`#${l} ${(pk.area[l] / (pxPerM * pxPerM)).toFixed(1)}м² @${Math.round(px0[l] / pk.area[l])},${Math.round(py0[l] / pk.area[l])} unit ${touchUnit[l]}${conflict[l] ? " conflict" : ""}${pk.border[l] ? " border" : ""}${viaPatch[l] ? " viaPatch" : ""}`);
      o.debug(`pockets[${iter}]: ${pk.area.length - 1}, pixels added ${added}; not absorbed: ${skipped.slice(0, 12).join(" | ")}`);
    }
    if (!added) break;
  }

  const fitted: WallFitOut[] = [];
  const areasPx = new Map<number, number>();
  const shaftOwner = new Int32Array(w * h).fill(-1); // хозяин каждой шахты (решается ниже, до закрытия выемок)
  // Стены раздаём соседям: метки комнат растекаются в толщу стен (кроме улицы) до встречи. Так стена между квартирами
  // делится по оси, внутренние стены и шахты целиком уходят своей квартире, наружная стена — до внешней грани.
  // Растекаются только квартиры: стена между квартирой и коридором целиком уходит квартире (контур — по внешней грани
  // стены коридора, ровной линией), стена между двумя квартирами делится пополам.
  // Стена рядом с крупным ничейным пространством (коридор, лифт, лестница, двор) отдаётся только до своей оси:
  // иначе квартира «обнимала» бы шахту лифта по её стенам, а лифт заливался бы как дырка.
  const floodArea = new Int32Array(nComp + 1); for (let i = 0; i < flood.length; i++) if (flood[i]) floodArea[flood[i]]++;
  const bigFree = new Uint8Array(w * h);
  {
    const minBig = Math.round(1.5 * pxPerM * pxPerM);
    for (let i = 0; i < bigFree.length; i++) { const l = flood[i]; if (l && compUnit[l] < 0 && floodArea[l] > minBig) bigFree[i] = 1; }
    const unl = new Uint8Array(w * h); for (let i = 0; i < unl.length; i++) if (!walls0[i] && !flood[i]) unl[i] = 1;
    const ul = label4(unl, w, h);
    for (let i = 0; i < unl.length; i++) { const l = ul.labels[i]; if (l && ul.area[l] > minBig) bigFree[i] = 1; }
  }
  const dBig = edt(bigFree, w, h);
  // захватываемая стена — вместе с заплатками дверей и окон (`walls`, не `walls0`), иначе у каждого проёма остаётся вмятина
  const intoWalls = new Uint8Array(w * h); for (let i = 0; i < intoWalls.length; i++) if (walls[i] && !(ext && ext[i]) && dBig[i] > wallPx * 0.5) intoWalls[i] = 1;
  const seedW = new Int32Array(w * h); for (let i = 0; i < seedW.length; i++) { const l = flood[i]; if (l && compUnit[l] >= 0) seedW[i] = l; }
  const floodW1 = floodLabels(seedW, walls0, w, h, intoWalls, Math.ceil(0.5 * wallPx) + 1); // ровно до оси обычной стены; колонны глубже не берём
  // шахты (мелкие полости) и перегородки между ними делим между соседями целиком — иначе у них остаются «галочки»
  const dTiny = edt(tiny, w, h);
  const intoTiny = new Uint8Array(w * h); for (let i = 0; i < intoTiny.length; i++) if (intoWalls[i] && dTiny[i] <= wallPx) intoTiny[i] = 1;
  const floodW = floodLabels(floodW1, walls0, w, h, intoTiny);
  if (pi >= 0) o.debug?.(`probe: floodW ${floodW[pi]} unit ${floodW[pi] ? compUnit[floodW[pi]] : "-"}`);
  // Шахта целиком уходит одной квартире — той, в чей угол она «ложится»: считаем, с скольких сторон (слева/справа/
  // сверху/снизу, в пределах ~1 м) шахту окружают комнаты каждой квартиры; побеждает квартира с большим числом сторон
  // (шахта в её вогнутом углу — 2–3 стороны, у соседа — одна). При равенстве — большинство пикселей захвата.
  // Границы квартир после этого не пересекаются: у шахты ровно один хозяин.
  {
    const tl = label4(tiny, w, h);
    const nT = tl.area.length;
    const bx0 = new Int32Array(nT).fill(w), bx1 = new Int32Array(nT).fill(-1), by0 = new Int32Array(nT).fill(h), by1 = new Int32Array(nT).fill(-1);
    for (let i = 0; i < tl.labels.length; i++) { const l = tl.labels[i]; if (!l) continue; const x = i % w, y = (i - x) / w; if (x < bx0[l]) bx0[l] = x; if (x > bx1[l]) bx1[l] = x; if (y < by0[l]) by0[l] = y; if (y > by1[l]) by1[l] = y; }
    const votes = new Map<number, Map<number, number>>();
    for (let i = 0; i < tl.labels.length; i++) { const l = tl.labels[i]; if (!l || !floodW[i]) continue; const u = compUnit[floodW[i]]; if (u < 0) continue; let m = votes.get(l); if (!m) { m = new Map(); votes.set(l, m); } m.set(u, (m.get(u) ?? 0) + 1); }
    const D = Math.round(1.0 * pxPerM);
    const ray = (x: number, y: number, dx: number, dy: number): number => { for (let k = 1; k <= D; k++) { const xx = x + dx * k, yy = y + dy * k; if (xx < 0 || yy < 0 || xx >= w || yy >= h) return -1; const i = yy * w + xx; if (tiny[i]) continue; if (walls0[i]) continue; const fl = flood[i]; return fl ? compUnit[fl] : -1; } return -1; };
    const seedOfU = new Int32Array(rough.length).fill(0); for (let l = 1; l <= nComp; l++) if (compUnit[l] >= 0 && !seedOfU[compUnit[l]]) seedOfU[compUnit[l]] = l;
    const winner = new Map<number, number>();
    for (let l = 1; l < nT; l++) {
      const cx = Math.round((bx0[l] + bx1[l]) / 2), cy = Math.round((by0[l] + by1[l]) / 2);
      const sides = [ray(bx0[l], cy, -1, 0), ray(bx1[l], cy, 1, 0), ray(cx, by0[l], 0, -1), ray(cx, by1[l], 0, 1)].filter((u) => u >= 0);
      const score = new Map<number, number>(); sides.forEach((u) => score.set(u, (score.get(u) ?? 0) + 1));
      let bu = -1, bs = 0; score.forEach((c, u) => { if (c > bs) { bs = c; bu = u; } });
      const tie = [...score.entries()].filter(([, c]) => c === bs).map(([u]) => u);
      if (tie.length > 1) { const m = votes.get(l); let bc = -1; tie.forEach((u) => { const c = m?.get(u) ?? 0; if (c > bc) { bc = c; bu = u; } }); }
      if (bu < 0) { const m = votes.get(l); if (m) { let bc = 0; m.forEach((c, u) => { if (c > bc) { bc = c; bu = u; } }); } }
      if (bu >= 0) winner.set(l, bu);
    }
    for (let i = 0; i < tl.labels.length; i++) { const l = tl.labels[i]; if (l && winner.has(l)) { const u = winner.get(l)!; floodW[i] = seedOfU[u]; shaftOwner[i] = u; } }
  }
  // Маска квартиры → контур: стены по заливке, заполнение дыр, прямоугольное закрытие выемок, тонкие линии, ломаная.
  const buildUnit = (ui: number, dbg = false): { poly: Pt[]; px: number; cnt: number } | null => {
    const ru = rough[ui];
    let x0 = w, y0 = h, x1 = -1, y1 = -1, cnt = 0;
    for (let i = 0; i < floodW.length; i++) { const l = floodW[i]; if (l && compUnit[l] === ui) { cnt++; const x = i % w, y = (i - x) / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; } }
    if (!cnt) return null;
    const pad = Math.round(0.7 * pxPerM) + 3;
    const bb = { x0: Math.max(0, x0 - pad), y0: Math.max(0, y0 - pad), x1: Math.min(w - 1, x1 + pad), y1: Math.min(h - 1, y1 + pad) };
    const cw = bb.x1 - bb.x0 + 1, ch = bb.y1 - bb.y0 + 1;
    const m = new Uint8Array(cw * ch);
    for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) { const l = floodW[(bb.y0 + y) * w + bb.x0 + x]; if (l && compUnit[l] === ui) m[y * cw + x] = 1; }
    fillHoles(m, cw, ch);
    // Выемки в толще стен (шахты в углу, уступы) — внутрь, «прямоугольным» закрытием: пиксель заполняется, если по двум
    // осям (слева и справа, сверху и снизу, или в вогнутом углу — слева и сверху и т. п.) в пределах ≈0,6 м есть маска.
    // В отличие от дискового закрытия не даёт скруглений и диагоналей. Только по стенам/шахтам: не по комнатам, не по
    // улице, не по стенам, уже отданным соседу; шахту берёт первая квартира, у которой она в выемке.
    {
      const rc = Math.max(2, Math.round(0.6 * pxPerM));
      const okPix = (gi: number) => walls0[gi] && !(ext && ext[gi]) && (tiny[gi] ? shaftOwner[gi] === ui : !floodW[gi] || compUnit[floodW[gi]] === ui);
      for (let pass = 0; pass < 4; pass++) {
        let grew = false;
        const near = (x: number, y: number, dx: number, dy: number) => { for (let k = 1; k <= rc; k++) { const xx = x + dx * k, yy = y + dy * k; if (xx < 0 || yy < 0 || xx >= cw || yy >= ch) return false; if (m[yy * cw + xx] === 1) return true; } return false; };
        for (let y = 0; y < ch; y++) for (let x = 0; x < cw; x++) {
          const i = y * cw + x; if (m[i]) continue;
          const gi = (bb.y0 + y) * w + bb.x0 + x; if (!okPix(gi)) continue;
          const L = near(x, y, -1, 0), R = near(x, y, 1, 0), U = near(x, y, 0, -1), D = near(x, y, 0, 1);
          if ((L && R) || (U && D) || ((L || R) && (U || D))) { m[i] = 2; grew = true; }
        }
        for (let i = 0; i < m.length; i++) if (m[i] === 2) m[i] = 1;
        if (!grew) break;
      }
    }
    // тонкие линии (ограждения балконов, козырьки) рядом с маской — до 5 px, чтобы контур дошёл до линии
    for (let pass = 0; pass < 5; pass++) {
      let grew = false;
      for (let y = 1; y < ch - 1; y++) for (let x = 1; x < cw - 1; x++) {
        const i = y * cw + x; if (m[i]) continue;
        const gi = (bb.y0 + y) * w + bb.x0 + x;
        if (thick[gi] || !walls0[gi] || !(m[i - 1] === 1 || m[i + 1] === 1 || m[i - cw] === 1 || m[i + cw] === 1)) continue;
        m[i] = 2; grew = true;
      }
      for (let i = 0; i < m.length; i++) if (m[i] === 2) m[i] = 1;
      if (!grew) break;
    }
    fillHoles(m, cw, ch);
    if (dbg) o.debugMask?.(ru.u.uid, bb, m);
    const outline = traceOutline(m, cw, ch);
    if (outline.length < 8) return null;
    const straight = fitStraight(outline.map(([x, y]) => [x + 0.5, y + 0.5] as Pt), Math.max(2, wallPx * 0.5), wallPx, 0.6 * pxPerM * pxPerM);
    const poly: Pt[] = straight.map(([x, y]) => [(bb.x0 + x) / w, (bb.y0 + y) / h]);
    if (poly.length < 4) return null;
    return { poly, px: polyAreaPx(toPx(poly)), cnt };
  };

  // Спорный угловой столб на стыке квартиры, коридора и соседа: толстый кусок стены (часто с шахтами), который делёж
  // по расстоянию отдал соседу, но который лежит в ВОГНУТОМ углу этой квартиры. Геометрически обе квартиры «окружают»
  // его с двух сторон, поэтому решаем по результату: строим контуры обеих с куском у квартиры и без — отдаём, если её
  // контур упрощается (выемка исчезает), а у соседа вершин не прибавляется. У куска один хозяин — пересечений нет.
  {
    const rcJ = Math.max(2, Math.round(0.6 * pxPerM)), maxPiece = Math.round(1.5 * pxPerM * pxPerM), minPiece = Math.round(0.02 * pxPerM * pxPerM);
    const seedOfU = new Int32Array(rough.length).fill(0); for (let l = 1; l <= nComp; l++) if (compUnit[l] >= 0 && !seedOfU[compUnit[l]]) seedOfU[compUnit[l]] = l;
    const ownAt = (i: number) => { if (tiny[i]) return shaftOwner[i]; const l = floodW[i]; return l ? compUnit[l] : -1; };
    const nearOwn = (x: number, y: number, dx: number, dy: number, u: number) => { for (let k = 1; k <= rcJ; k++) { const xx = x + dx * k, yy = y + dy * k; if (xx < 0 || yy < 0 || xx >= w || yy >= h) return false; if (ownAt(yy * w + xx) === u) return true; } return false; };
    const vcache = new Map<number, number>();
    const verts = (u: number) => { if (!vcache.has(u)) { const r = buildUnit(u); vcache.set(u, r ? r.poly.length : -1); } return vcache.get(u)!; };
    let moved = 0;
    rough.forEach((ru, ui) => {
      if (skip[ui] || !seedOfU[ui]) return;
      const cand = new Uint8Array(w * h);
      for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
        const i = y * w + x;
        if (!walls0[i] || (ext && ext[i])) continue;
        const u = ownAt(i); if (u < 0 || u === ui) continue; // ничьё закрытие возьмёт само
        if ((nearOwn(x, y, 0, -1, ui) || nearOwn(x, y, 0, 1, ui)) && (nearOwn(x, y, -1, 0, ui) || nearOwn(x, y, 1, 0, ui))) cand[i] = 1;
      }
      const cl = label4(cand, w, h);
      const pts: number[][] = [];
      for (let i = 0; i < cl.labels.length; i++) { const l = cl.labels[i]; if (l) (pts[l] ??= []).push(i); }
      for (let l = 1; l < cl.area.length; l++) {
        const P = pts[l]; if (!P || P.length > maxPiece || P.length < minPiece || cl.border[l]) continue;
        const owners = new Set<number>(); for (const i of P) { const u = ownAt(i); if (u >= 0 && u !== ui) owners.add(u); }
        const before = verts(ui); if (before < 0) continue;
        const bBefore = [...owners].map((u) => [u, verts(u)] as const);
        const saved = P.map((i) => [floodW[i], shaftOwner[i]] as const);
        for (const i of P) { floodW[i] = seedOfU[ui]; if (tiny[i]) shaftOwner[i] = ui; }
        const after = buildUnit(ui); const afterV = after ? after.poly.length : -1;
        let ok = afterV >= 4 && afterV < before;
        const bAfter: [number, number][] = [];
        if (ok) for (const [u, v0] of bBefore) { const r = buildUnit(u); const v = r ? r.poly.length : -1; bAfter.push([u, v]); if (v < 4 || (v0 >= 0 && v > v0)) { ok = false; break; } }
        if (!ok) { P.forEach((i, k) => { floodW[i] = saved[k][0]; shaftOwner[i] = saved[k][1]; }); continue; }
        vcache.set(ui, afterV); bAfter.forEach(([u, v]) => vcache.set(u, v)); moved++;
        o.debug?.(`unit ${ru.u.uid}: corner piece ${(P.length / (pxPerM * pxPerM)).toFixed(2)}м² @${Math.round(P.reduce((a, i) => a + (i % w), 0) / P.length)},${Math.round(P.reduce((a, i) => a + Math.floor(i / w), 0) / P.length)} taken from ${[...owners].map((u) => rough[u].u.uid).join(",")}: ${before}→${afterV} pts`);
      }
    });
    if (moved && o.debug) o.debug(`corner pieces moved: ${moved}`);
  }

  rough.forEach((ru, ui) => {
    if (skip[ui]) return;
    let comps = 0; for (let l = 1; l <= nComp; l++) if (compUnit[l] === ui) comps++;
    if (!comps) { o.debug?.(`unit ${ru.u.uid}: no cores`); return; }
    if (o.debug) { const mine: string[] = []; for (let l = 1; l <= nComp; l++) if (compUnit[l] === ui) mine.push(`#${l}@${Math.round(cx[l])},${Math.round(cy[l])}`); o.debug(`unit ${ru.u.uid} cores: ${mine.join(" ")}`); }
    const r = buildUnit(ui, true);
    if (!r) return;
    const { poly, px, cnt } = r;
    areasPx.set(ru.u.uid, px);
    const ratio = ru.u.area ? px / (ru.u.area * pxPerM * pxPerM) : 1;
    o.debug?.(`unit ${ru.u.uid}: cores ${comps}, px ${cnt}, pts ${poly.length}, ratio ${ratio.toFixed(2)}`);
    fitted.push({ uid: ru.u.uid, poly: poly.map(([x, y]) => [+Math.min(1, Math.max(0, x)).toFixed(4), +Math.min(1, Math.max(0, y)).toFixed(4)]), ratio, comps, areaM2: px / (pxPerM * pxPerM) });
  });
  return { fitted, areasPx, r };
}

/** Подогнать грубые контуры квартир по стенам. Квартиры без уверенного результата в `fitted` не попадают. */
export function fitUnitsToWalls(g: Gray, units: WallFitUnit[], opts: WallFitOpts = {}): WallFitResult {
  const o: Opts = { darkT: opts.darkT ?? 24, doorM: opts.doorM ?? 1.2, coreM: opts.coreM ?? 0.55, marginM: opts.marginM ?? 0.6, minFrac: opts.minFrac ?? 0.5, debug: opts.debug, debugMask: opts.debugMask, probe: opts.probe };
  const { walls: wallsOnly, thick, wallPx, hatched } = wallMask(g, o.darkT, o.debug);
  // на штриховом чертеже закрытие штрихов укорачивает торцы стен у проёмов на ~R с каждой стороны: дверной проём выходит
  // шире — предел ширины двери больше
  const toPx = (poly: Pt[]): Pt[] => poly.map(([x, y]) => [x * g.w, y * g.h]);
  // цветной план (полы текстурные) → белый фон снаружи здания считаем препятствием; штриховой чертёж (полы белые) — нет
  const inside = new Uint8Array(g.w * g.h);
  units.forEach((u) => rasterPoly(toPx(u.poly), g.w, g.h, inside));
  let nIn = 0, nWhite = 0;
  for (let i = 0; i < inside.length; i++) if (inside[i]) { nIn++; if (g.data[i] >= 240) nWhite++; }
  const rendered = nIn > 0 && nWhite / nIn < 0.45;
  if (hatched && !rendered) { o.doorM = Math.max(o.doorM, 1.6); o.hatched = true; }
  const walls = new Uint8Array(wallsOnly);
  const scales = units.filter((u) => (u.area ?? 0) > 0).map((u) => Math.sqrt(polyAreaPx(toPx(u.poly)) / u.area!) * 0.9);
  // вторая оценка — по толщине стены (на чертежах наружная стена обычно ≈ 25 см); если оценки расходятся сильно
  // (грубые контуры очень неточные или площади «не той» структуры), доверяем стене
  const sWall = wallPx / 0.25;
  const sArea = median(scales);
  // площади согласованы между собой (разброс ≤15 % при ≥2 квартирах) — верим им, какой бы ни была стена (20 или 30 см);
  // иначе при расхождении со стеной >30 % верим стене (площади перепутаны)
  const spread = scales.length >= 2 ? median(scales.map((v) => Math.abs(v / sArea - 1))) : 1;
  let pxPerM = !sArea ? sWall : spread <= 0.15 ? sArea : Math.abs(sArea / sWall - 1) > 0.3 ? sWall : sArea;
  let ext: Uint8Array | null = null;
  if (rendered || hatched) {
    // ч/б чертёж: улица — всё, куда можно дойти от края по светлым пикселям, минуя стены, тонкие линии окон и
    // закрытые дверные проёмы (иначе улица «входит» в дом через входную дверь)
    ext = rendered ? exteriorMask(g, 240, o.debug) : lineExterior(g, closeWindows(closeDoorsDirect(wallsOnly, g.w, g.h, Math.round(o.doorM * pxPerM), wallPx), g, Math.round(3.0 * pxPerM), wallPx));
    // щель между улицей и стеной (серая обводка стены в 1–2 px — не белая и не чёрная) — тоже улица: иначе по ней, как по
    // каналу вдоль стены, комната вытекает через окно на белое поле и дальше в соседний балкон
    const dE = edt(ext, g.w, g.h), dW = edt(wallsOnly, g.w, g.h);
    for (let i = 0; i < ext.length; i++) if (!ext[i] && !wallsOnly[i] && dE[i] <= 2 && dW[i] <= 2) ext[i] = 1;
    for (let i = 0; i < walls.length; i++) if (ext[i]) walls[i] = 1;
    o.debug?.(`exterior: ${rendered ? "white field (rendered plan)" : "line flood (hatched drawing)"}`);
  }
  const tiny = new Uint8Array(g.w * g.h);
  // мелкие замкнутые полости в толще стен (вентшахты, ниши, окна-«квадратики») считаем стеной: контур квартиры должен идти
  // по стене ровно, не огибая их
  {
    // щели в 1–2 px (сглаживание) не должны «открывать» шахту в соседнюю комнату: стены для этой проверки утолщаем на 1 px
    const dW1 = edt(walls, g.w, g.h);
    const free = new Uint8Array(g.w * g.h); for (let i = 0; i < free.length; i++) free[i] = dW1[i] > 1 ? 1 : 0;
    const fl = label4(free, g.w, g.h);
    const maxTiny = Math.round(0.7 * (wallPx / 0.25) * (wallPx / 0.25)); // ≈ 0,7 м² при стене 25 см
    let added = 0;
    // полость у наружного контура (клин под козырьком балкона, ниша фасада) — не шахта: её не трогаем
    const dExt = ext ? edt(ext, g.w, g.h) : null;
    const nearExt = new Uint8Array(fl.area.length);
    if (dExt) for (let i = 0; i < free.length; i++) { const l = fl.labels[i]; if (l && dExt[i] <= 2 * wallPx) nearExt[l] = 1; }
    // у наружной стены полость считаем шахтой только если она прямоугольная (клин под козырьком балкона — треугольный)
    const bx0: number[] = [], by0: number[] = [], bx1: number[] = [], by1: number[] = [];
    for (let i = 0; i < free.length; i++) { const l = fl.labels[i]; if (!l) continue; const x = i % g.w, y = (i - x) / g.w; if (bx0[l] === undefined) { bx0[l] = bx1[l] = x; by0[l] = by1[l] = y; } else { if (x < bx0[l]) bx0[l] = x; if (x > bx1[l]) bx1[l] = x; if (y < by0[l]) by0[l] = y; if (y > by1[l]) by1[l] = y; } }
    const rect = (l: number) => fl.area[l] / ((bx1[l] - bx0[l] + 1) * (by1[l] - by0[l] + 1)) >= 0.75;
    // …и ограничена в основном толстыми стенами (не ограждением балкона/козырьком — тонкими линиями)
    const thickAdj = new Int32Array(fl.area.length), anyAdj = new Int32Array(fl.area.length);
    for (let y = 1; y < g.h - 1; y++) for (let x = 1; x < g.w - 1; x++) { const i = y * g.w + x, l = fl.labels[i]; if (!l) continue; for (const j of [i - 1, i + 1, i - g.w, i + g.w]) { if (fl.labels[j] === l) continue; anyAdj[l]++; if (thick[j]) thickAdj[l]++; } }
    const shaft = (l: number) => rect(l) && anyAdj[l] > 0 && thickAdj[l] / anyAdj[l] >= 0.8;
    for (let i = 0; i < free.length; i++) { const l = fl.labels[i]; if (l && !fl.border[l] && (!nearExt[l] || shaft(l)) && fl.area[l] <= maxTiny) { walls[i] = 1; tiny[i] = 1; added++; } }
    o.debug?.(`tiny cavities → walls: ${added}px`);
  }
  o.debug?.(`rendered plan: ${rendered} (white inside ${(100 * nWhite / Math.max(1, nIn)).toFixed(0)}%), wall ${wallPx}px`);
  // масштаб: px/м из площадей квартир по грубым контурам (они больше квартиры — поправка 0.9), иначе по толщине стены ≈ 15 см
  o.debug?.(`scale: by areas ${sArea.toFixed(1)}, by wall ${sWall.toFixed(1)} → ${pxPerM.toFixed(1)}`);
  // годный контур: площадь сопоставима с паспортной; без паспортной — хотя бы 12 м² (квартира, а не кладовка)
  const good = (f: WallFitOut, u: WallFitUnit | undefined) => ((u?.area ?? 0) > 0 ? f.ratio > 0.72 && f.ratio < 1.5 : f.areaM2 >= 12); // контур с полстенами и балконами ≈ 1,0–1,35 от паспорта; ниже — не хватает комнат
  const byUid = new Map(units.map((u) => [u.uid, u]));
  const score = (p: Pass) => { const ok = p.fitted.filter((f) => good(f, byUid.get(f.uid))); const dev = ok.length ? ok.reduce((a, f) => a + Math.abs(f.ratio - 1), 0) / ok.length : 9; return { ok, dev }; };
  let pass = fitPass(g, walls, thick, ext, tiny, wallPx, units, pxPerM, o);
  let best = { pass, pxPerM, ...score(pass) };
  // уточнение масштаба по полученным контурам (контур включает полстены и балконы → поправка 0.97) и повтор — только если
  // первый проход в целом правдоподобен (иначе уточнение «по мусору» уводит масштаб); в итоге берём лучший проход
  for (let it = 0; it < 2; it++) {
    const s2 = units.filter((u) => (u.area ?? 0) > 0 && pass.areasPx.has(u.uid)).map((u) => Math.sqrt(pass.areasPx.get(u.uid)! / u.area!) * 0.97);
    const next = median(s2);
    const ratios = pass.fitted.filter((f) => (byUid.get(f.uid)?.area ?? 0) > 0).map((f) => f.ratio);
    const medR = median(ratios);
    if (s2.length < Math.max(2, Math.ceil(units.length * 0.4)) || !next || medR < 0.7 || medR > 1.6 || Math.abs(next - pxPerM) / pxPerM < 0.06 || next < pxPerM * 0.6 || next > pxPerM * 1.6 || Math.abs(next / sWall - 1) > 0.35) break;
    pxPerM = next;
    pass = fitPass(g, walls, thick, ext, tiny, wallPx, units, pxPerM, o);
    const sc = score(pass);
    if (sc.ok.length > best.ok.length || (sc.ok.length === best.ok.length && sc.dev < best.dev)) best = { pass, pxPerM, ...sc };
  }
  return { fitted: best.ok, pxPerM: best.pxPerM, r: best.pass.r, wallPx };
}

/**
 * «Потерянные» квартиры: куски этажа, не накрытые ни одним готовым контуром. Комнаты (области между стенами и дверными
 * заплатками) связываются через двери в графы; общий коридор (двери в комнаты ≥2 разных готовых квартир, либо ≥60 м², либо
 * у края листа) из графа вырезается; оставшиеся компоненты ≥12 м² — кандидаты в квартиры. Возвращает их прямоугольные
 * огибающие (как грубый контур для `fitUnitsToWalls`) и площадь в м². Используется, когда ИИ не нашёл квартиру из прайса
 * или поставил её мимо (лист без номеров, квартиры одной площади).
 */
export function findFreeApartments(g: Gray, fitted: Pt[][], pxPerM: number, debug?: (m: string) => void): { poly: Pt[]; areaM2: number }[] {
  const { w, h } = g;
  const { walls: walls0, wallPx, hatched } = wallMask(g, 24);
  const toPx = (poly: Pt[]): Pt[] => poly.map(([x, y]) => [x * w, y * h]);
  const fitLab = new Int32Array(w * h);
  { const tmp = new Uint8Array(w * h); fitted.forEach((poly, k) => { tmp.fill(0); rasterPoly(toPx(poly), w, h, tmp); for (let i = 0; i < tmp.length; i++) if (tmp[i]) fitLab[i] = k + 1; }); }
  let nWhite = 0, nIn = 0, nWhiteAll = 0; for (let i = 0; i < fitLab.length; i++) { if (g.data[i] >= 240) nWhiteAll++; if (fitLab[i]) { nIn++; if (g.data[i] >= 240) nWhite++; } }
  // без готовых контуров судим по всему листу: цветной план — белого меньше 60 %
  const rendered = nIn > 0 ? nWhite / nIn < 0.45 : nWhiteAll / (w * h) < 0.6;
  const walls = new Uint8Array(walls0);
  if (rendered || hatched) {
    const ext = rendered ? exteriorMask(g) : lineExterior(g, closeWindows(closeDoorsDirect(walls0, w, h, Math.round(1.6 * pxPerM), wallPx), g, Math.round(3.0 * pxPerM), wallPx));
    const dE = edt(ext, w, h), dW = edt(walls0, w, h);
    for (let i = 0; i < ext.length; i++) if (!ext[i] && !walls0[i] && dE[i] <= 2 && dW[i] <= 2) ext[i] = 1;
    for (let i = 0; i < walls.length; i++) if (ext[i]) walls[i] = 1;
  }
  let closed = closeDoorsDirect(walls, w, h, Math.round((hatched ? 1.6 : 1.2) * pxPerM), wallPx);
  if (hatched && !rendered) closed = closeWindows(closed, g, Math.round(3.0 * pxPerM), wallPx);
  const free = new Uint8Array(w * h); for (let i = 0; i < free.length; i++) if (!closed[i]) free[i] = 1;
  const rm = label4(free, w, h);
  const nR = rm.area.length;
  // хозяин комнаты — готовый контур, накрывающий ≥50 % её пикселей
  const own = new Int32Array(nR).fill(-1);
  { const cnt = new Map<number, number>(); for (let i = 0; i < rm.labels.length; i++) { const r = rm.labels[i], f = fitLab[i]; if (!r || !f) continue; const k = r * (fitted.length + 1) + f; cnt.set(k, (cnt.get(k) ?? 0) + 1); } cnt.forEach((n, k) => { const r = Math.floor(k / (fitted.length + 1)), f = k % (fitted.length + 1); if (n >= 0.5 * rm.area[r]) own[r] = f - 1; }); }
  // двери: заплатка → комнаты по сторонам
  const patch = new Uint8Array(w * h); for (let i = 0; i < patch.length; i++) if (closed[i] && !walls[i]) patch[i] = 1;
  const pl = label4(patch, w, h);
  const pRooms: number[][] = [];
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) { const i = y * w + x, l = pl.labels[i]; if (!l) continue; for (const j of [i - 1, i + 1, i - w, i + w]) { const r = rm.labels[j]; if (!r) continue; const a = (pRooms[l] ??= []); if (!a.includes(r)) a.push(r); } }
  const adj: Set<number>[] = Array.from({ length: nR }, () => new Set<number>());
  for (let l = 1; l < pl.area.length; l++) { const rs = pRooms[l]; if (!rs || rs.length < 2) continue; for (const a of rs) for (const b of rs) if (a !== b) adj[a].add(b); }
  const m2 = (px: number) => px / (pxPerM * pxPerM);
  const corridor = new Uint8Array(nR);
  for (let r = 1; r < nR; r++) { if (own[r] >= 0) continue; const units = new Set<number>(); adj[r].forEach((b) => { if (own[b] >= 0) units.add(own[b]); }); if (units.size >= 2 || m2(rm.area[r]) >= 60 || rm.border[r]) corridor[r] = 1; }
  // общий коридор без готовых соседей (лист без номеров, ничего ещё не обведено): «узел» — комната, без которой граф
  // свободных комнат распадается на ≥3 куска по ≥12 м² (в коридор выходят двери нескольких квартир); лестничная клетка
  // и лифт, примыкающие к нему, уходят вместе с ним. Повторяем, пока узлы находятся.
  // Сначала самый «узловой» (у коридора кусков столько, сколько квартир; у прихожей квартиры — 2–3, и после удаления
  // коридора её «кусок со стороны коридора» исчезает). Повторяем, пока есть узел с ≥3 кусками.
  for (let guard = 0; guard < 6; guard++) {
    let foundHub = -1, bestBig = 0;
    const freeRoom = (r: number) => own[r] < 0 && !corridor[r];
    for (let r = 1; r < nR; r++) {
      if (!freeRoom(r) || adj[r].size < 3) continue;
      // компоненты, в которые попадают СОСЕДИ комнаты r после её удаления (то, что соединялось только через r)
      const seen = new Uint8Array(nR); seen[r] = 1; let big = 0;
      for (const s0 of adj[r]) {
        if (seen[s0] || !freeRoom(s0)) continue;
        let px = 0; const stack = [s0]; seen[s0] = 1;
        while (stack.length) { const a = stack.pop()!; px += rm.area[a]; adj[a].forEach((b) => { if (!seen[b] && freeRoom(b)) { seen[b] = 1; stack.push(b); } }); }
        if (m2(px) >= 25) big++; // куски — целые квартиры (≥25 м²), а не комнаты одной квартиры за её прихожей
      }
      if (big >= 3 && big > bestBig) { bestBig = big; foundHub = r; }
    }
    if (foundHub < 0) break;
    corridor[foundHub] = 1;
    debug?.(`corridor hub: room ${m2(rm.area[foundHub]).toFixed(1)}м² (${adj[foundHub].size} doors, ${bestBig} parts)`);
  }
  if (debug) { const rows: string[] = []; const cxr = new Float64Array(nR), cyr = new Float64Array(nR); for (let i = 0; i < rm.labels.length; i++) { const r = rm.labels[i]; if (r) { cxr[r] += i % w; cyr[r] += Math.floor(i / w); } } for (let r = 1; r < nR; r++) if (m2(rm.area[r]) >= 4) rows.push(`${m2(rm.area[r]).toFixed(0)}м²@${Math.round(cxr[r] / rm.area[r])},${Math.round(cyr[r] / rm.area[r])} d${adj[r].size}${own[r] >= 0 ? " own" + own[r] : ""}${corridor[r] ? " CORR" : ""}${rm.border[r] ? " border" : ""}`); debug(`rooms: ${rows.join(" | ")}`); }
  // компоненты свободных комнат
  const comp = new Int32Array(nR).fill(0); let nc = 0;
  const comps: number[][] = [];
  for (let r = 1; r < nR; r++) {
    if (comp[r] || own[r] >= 0 || corridor[r]) continue;
    nc++; const stack = [r]; comp[r] = nc; const list: number[] = [];
    while (stack.length) { const a = stack.pop()!; list.push(a); adj[a].forEach((b) => { if (!comp[b] && own[b] < 0 && !corridor[b]) { comp[b] = nc; stack.push(b); } }); }
    comps[nc] = list;
  }
  const out: { poly: Pt[]; areaM2: number }[] = [];
  const bx0 = new Int32Array(nR).fill(w), bx1 = new Int32Array(nR).fill(-1), by0 = new Int32Array(nR).fill(h), by1 = new Int32Array(nR).fill(-1);
  for (let i = 0; i < rm.labels.length; i++) { const r = rm.labels[i]; if (!r) continue; const x = i % w, y = (i - x) / w; if (x < bx0[r]) bx0[r] = x; if (x > bx1[r]) bx1[r] = x; if (y < by0[r]) by0[r] = y; if (y > by1[r]) by1[r] = y; }
  for (let c = 1; c <= nc; c++) {
    const list = comps[c]; let px = 0, x0 = w, x1 = -1, y0 = h, y1 = -1;
    for (const r of list) { px += rm.area[r]; x0 = Math.min(x0, bx0[r]); x1 = Math.max(x1, bx1[r]); y0 = Math.min(y0, by0[r]); y1 = Math.max(y1, by1[r]); }
    const a = m2(px); if (a < 12) continue;
    out.push({ poly: [[x0 / w, y0 / h], [(x1 + 1) / w, y0 / h], [(x1 + 1) / w, (y1 + 1) / h], [x0 / w, (y1 + 1) / h]], areaM2: +a.toFixed(1) });
  }
  debug?.(`free apartments: ${out.map((o) => `${o.areaM2}м²@${(o.poly[0][0] * w).toFixed(0)},${(o.poly[0][1] * h).toFixed(0)}`).join(" ")}`);
  return out.sort((a, b) => b.areaM2 - a.areaM2);
}

/** Масштаб листа по толщине стен (стена ≈ 25 см): грубая оценка, когда площадей ещё нет. */
export function wallScale(g: Gray): number { return wallMask(g, 24).wallPx / 0.25; }
