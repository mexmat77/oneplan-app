// Зеркальные планировки по контурам с поэтажных планов (Tip A-L / Tip A-R).
//   shapeSignature(poly)  — нормализация контура: центроид в (0,0), масштаб по большей стороне bbox (пропорции сохраняются),
//                           ресэмплинг в SIG_N равномерных по периметру точек (внутри — с запасом ×OVERSAMPLE для фазового сдвига).
//   shapeDist(a, b)       — RMS-расстояние между сигнатурами: минимум по циклическим сдвигам (с точностью до 1/OVERSAMPLE шага)
//                           и обоим направлениям обхода. 0 — одинаковые контуры (с точностью до сдвига/масштаба).
//   isMirror(a, b)        — сравнивает dD = dist(a, b) и dM = dist(a, flipX(b)); оба — минимум по поворотам 0/90/180/270°
//                           (поворот не меняет «руку» планировки, отражение — меняет). Зеркальные, если dM заметно меньше dD
//                           (dM < MIRROR_RATIO·dD, отрыв ≥ MIN_GAP) и сам dM мал (< MIRROR_MAX). Симметричные формы
//                           (прямоугольник: dD ≈ dM ≈ 0) — не зеркальные. Повёрнутый на 180° контур считается тем же (прямым) вариантом.
//   splitMirrorGroups(units, polys) — { L, R } по референсу (первый юнит с полигоном): L — совпадают напрямую (или не
//                           определились), R — совпадают через отражение; null, если полигонов < 2 или все в одном классе.
// Ограничения: без контуров зеркальность не определяется; симметричные формы (прямоугольник, квадрат) не различаются.
import { centroid, type Pt, deskewAngle, rotatePts } from "./floorplan";
import type { Unit } from "./types";

/** Число точек сигнатуры (сравниваются). */
export const SIG_N = 64;
/** Внутренняя плотность ресэмплинга: сдвиги перебираются с шагом 1/OVERSAMPLE точки сигнатуры. */
const OVERSAMPLE = 4;
/** dM должен быть меньше dD хотя бы во столько раз. */
export const MIRROR_RATIO = 0.6;
/** Максимальное расстояние к отражённой форме, чтобы считать её той же планировкой. */
export const MIRROR_MAX = 0.08;
/** Максимальное расстояние к прямой форме, чтобы считать её той же планировкой. */
export const SAME_MAX = 0.08;
/** Минимальный абсолютный отрыв dD − dM: у симметричных форм оба ≈ 0 (с плавающей точкой — 1e-17), это не зеркальность. */
export const MIN_GAP = 0.02;

export type Signature = Pt[]; // SIG_N × OVERSAMPLE точек, центроид (0,0), большая сторона bbox = 1

/** Нормализованный ресэмплированный контур (null — меньше 3 точек или вырожденный). */
export function shapeSignature(poly: Pt[], n = SIG_N): Signature | null {
  if (!poly || poly.length < 3) return null;
  // выпрямляем контур: в доме «дугой» одинаковые квартиры повёрнуты под разными углами, без этого они не совпадут
  const da = deskewAngle(poly);
  if (Math.abs(da) > 0.02) poly = rotatePts(poly, da, centroid(poly));
  const [cx, cy] = centroid(poly);
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  poly.forEach(([x, y]) => { if (x < x0) x0 = x; if (y < y0) y0 = y; if (x > x1) x1 = x; if (y > y1) y1 = y; });
  const side = Math.max(x1 - x0, y1 - y0);
  if (!(side > 0)) return null;
  const pts: Pt[] = poly.map(([x, y]) => [(x - cx) / side, (y - cy) / side]);
  // длины рёбер (замкнутый контур)
  const m = pts.length;
  const seg: number[] = [];
  let per = 0;
  for (let i = 0; i < m; i++) { const a = pts[i], b = pts[(i + 1) % m]; const d = Math.hypot(b[0] - a[0], b[1] - a[1]); seg.push(d); per += d; }
  if (!(per > 0)) return null;
  const total = n * OVERSAMPLE, step = per / total;
  const out: Signature = [];
  let i = 0, acc = 0; // acc — расстояние от начала ребра i до текущей позиции
  for (let k = 0; k < total; k++) {
    const target = k * step;
    // сдвигаемся по рёбрам, пока цель не окажется внутри текущего ребра
    while (i < m - 1 && acc + seg[i] < target) { acc += seg[i]; i++; }
    const a = pts[i], b = pts[(i + 1) % m];
    const t = seg[i] > 0 ? Math.min(1, (target - acc) / seg[i]) : 0;
    out.push([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t]);
  }
  return out;
}

export const flipX = (sig: Signature): Signature => sig.map(([x, y]) => [-x, y]);
const rot = (sig: Signature, q: 1 | 2 | 3): Signature => sig.map(([x, y]) => (q === 1 ? [-y, x] : q === 2 ? [-x, -y] : [y, -x]));

/** RMS между сигнатурами при циклическом сдвиге `shift` (в точках oversample) и направлении обхода. */
function rms(a: Signature, b: Signature, shift: number, reverse: boolean): number {
  const total = a.length;
  let s = 0;
  for (let k = 0; k < total; k += OVERSAMPLE) {
    const j = reverse ? (total * 2 - k - shift) % total : (k + shift) % total;
    const p = a[k], q = b[j];
    const dx = p[0] - q[0], dy = p[1] - q[1];
    s += dx * dx + dy * dy;
  }
  return Math.sqrt(s / (total / OVERSAMPLE));
}

/** Минимальное RMS-расстояние между двумя сигнатурами по всем сдвигам и обоим направлениям обхода. */
export function shapeDist(a: Signature, b: Signature): number {
  if (a.length !== b.length) throw new Error("signature size mismatch");
  let best = Infinity;
  for (let shift = 0; shift < a.length; shift++) {
    const d1 = rms(a, b, shift, false); if (d1 < best) best = d1;
    const d2 = rms(a, b, shift, true); if (d2 < best) best = d2;
  }
  return best;
}

/** Расстояние с точностью до поворота на 0/90/180/270° (поворот сохраняет «руку» планировки). */
export function shapeDistRot(a: Signature, b: Signature): number {
  return Math.min(shapeDist(a, b), shapeDist(a, rot(b, 1)), shapeDist(a, rot(b, 2)), shapeDist(a, rot(b, 3)));
}

export type MirrorResult = { mirror: boolean; same: boolean; confidence: number; dD: number; dM: number };

/** Зеркальны ли контуры `a` и `b` (сигнатуры). `same` — совпадают напрямую. `confidence` — насколько уверенно различаются гипотезы (0 у симметричных форм). */
export function isMirror(a: Signature, b: Signature): MirrorResult {
  const dD = shapeDistRot(a, b);
  const dM = shapeDistRot(a, flipX(b));
  const lo = Math.min(dD, dM), hi = Math.max(dD, dM);
  const confidence = Math.max(0, Math.min(1, (hi - lo) / Math.max(hi, MIN_GAP)));
  const mirror = dM < MIRROR_RATIO * dD && dM < MIRROR_MAX && dD - dM > MIN_GAP;
  const same = !mirror && dD <= dM && dD < SAME_MAX;
  return { mirror, same, confidence, dD, dM };
}

/** Удобная обёртка над полигонами (а не сигнатурами). */
export function isMirrorPoly(a: Pt[], b: Pt[]): MirrorResult | null {
  const sa = shapeSignature(a), sb = shapeSignature(b);
  return sa && sb ? isMirror(sa, sb) : null;
}

/**
 * Разбить юниты одного типа на прямые (L) и зеркальные (R) по контурам. Референс — первый юнит с полигоном.
 * Юниты без полигона и не определившиеся остаются в L. null — если полигонов меньше двух или все в одном классе.
 */
export function splitMirrorGroups(units: Pick<Unit, "uid">[], polys: Record<number, Pt[] | undefined>): { L: number[]; R: number[] } | null {
  const sigs: { uid: number; sig: Signature }[] = [];
  units.forEach((u) => { const p = polys[u.uid]; const s = p ? shapeSignature(p) : null; if (s) sigs.push({ uid: u.uid, sig: s }); });
  if (sigs.length < 2) return null;
  const ref = sigs[0];
  const L: number[] = [ref.uid], R: number[] = [];
  for (let i = 1; i < sigs.length; i++) { (isMirror(ref.sig, sigs[i].sig).mirror ? R : L).push(sigs[i].uid); }
  if (!R.length) return null;
  return { L, R };
}
