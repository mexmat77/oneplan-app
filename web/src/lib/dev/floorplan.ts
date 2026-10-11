// Геометрия поэтажных планов: ключ плана, центроид, точка-в-полигоне, нормализация координат и номеров.
import type { FloorPlan, FloorPlanArea, Project, Unit } from "./types";

export type Pt = [number, number];

/** Ключ плана в `Project.floorPlans`: `${wing}|${floor}` (`wing` = '' для объекта без корпусов). */
export const fpKey = (wing: string, floor: number) => `${wing || ""}|${floor}`;

export const clamp01 = (v: number) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const normPt = (p: Pt): Pt => [+clamp01(p[0]).toFixed(4), +clamp01(p[1]).toFixed(4)];

/** Центроид полигона (формула площади Гаусса); для вырожденных — среднее вершин. */
export function centroid(poly: Pt[]): Pt {
  const n = poly.length;
  if (!n) return [0, 0];
  if (n < 3) return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  let a = 0, cx = 0, cy = 0;
  for (let i = 0; i < n; i++) {
    const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % n];
    const f = x0 * y1 - x1 * y0;
    a += f; cx += (x0 + x1) * f; cy += (y0 + y1) * f;
  }
  if (Math.abs(a) < 1e-9) return [poly.reduce((s, p) => s + p[0], 0) / n, poly.reduce((s, p) => s + p[1], 0) / n];
  a *= 0.5;
  return [cx / (6 * a), cy / (6 * a)];
}

/** Точка внутри полигона (even-odd). */
export function pointInPoly(p: Pt, poly: Pt[]): boolean {
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i], [xj, yj] = poly[j];
    if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

/**
 * Угол (рад), на который надо повернуть контур, чтобы его стены стали строго горизонтальными/вертикальными.
 * Берётся направление стен, взвешенное по длине рёбер (угол по модулю 90°), результат в (−45°, 45°].
 * Нужен для домов «дугой»: каждая квартира на плане повёрнута по-своему. Точки — в пикселях (изотропные координаты).
 */
export function deskewAngle(poly: Pt[]): number {
  let sx = 0, sy = 0;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0], dy = b[1] - a[1], len = Math.hypot(dx, dy);
    if (len <= 0) continue;
    const t = Math.atan2(dy, dx) * 4; // период 90°
    sx += Math.cos(t) * len; sy += Math.sin(t) * len;
  }
  if (!sx && !sy) return 0;
  return -Math.atan2(sy, sx) / 4;
}
/** Повернуть точки вокруг центра `c` на угол `a`. */
export const rotatePts = (poly: Pt[], a: number, c: Pt): Pt[] => { const cs = Math.cos(a), sn = Math.sin(a); return poly.map(([x, y]) => [c[0] + (x - c[0]) * cs - (y - c[1]) * sn, c[1] + (x - c[0]) * sn + (y - c[1]) * cs]); };

/** Ориентированная площадь (>0 — по часовой в экранных координатах, где ось Y вниз). */
export function signedArea(poly: Pt[]): number {
  let a = 0;
  for (let i = 0; i < poly.length; i++) { const [x0, y0] = poly[i], [x1, y1] = poly[(i + 1) % poly.length]; a += x0 * y1 - x1 * y0; }
  return a / 2;
}

/** Точки полигона для SVG `points` в координатах viewBox (w × h). */
export const polyPoints = (poly: Pt[], w: number, h: number) => poly.map((p) => `${(p[0] * w).toFixed(1)},${(p[1] * h).toFixed(1)}`).join(" ");

/** Номер квартиры для сопоставления: без `*`, пробелов и регистра (`"A-12 "` → `a12`). */
export const normNum = (n: string | number | null | undefined) => String(n ?? "").replace(/\*/g, "").toLowerCase().replace(/[^a-z0-9а-яё]/g, "");

/** Полигон из ответа ИИ → массив нормализованных точек (или null, если не похоже на полигон). */
export function parsePoly(raw: unknown): Pt[] | null {
  if (!Array.isArray(raw) || raw.length < 3) return null;
  const out: Pt[] = [];
  for (const p of raw) {
    let x: number, y: number;
    if (Array.isArray(p) && p.length >= 2) { x = Number(p[0]); y = Number(p[1]); }
    else if (p && typeof p === "object" && "x" in p && "y" in p) { x = Number((p as { x: unknown }).x); y = Number((p as { y: unknown }).y); }
    else return null;
    if (!Number.isFinite(x) || !Number.isFinite(y)) return null;
    // модель могла ответить в процентах или пикселях 0..1000 — приводим к 0..1
    if (x > 1 || y > 1) { const s = x > 100 || y > 100 ? 1000 : 100; x /= s; y /= s; }
    out.push(normPt([x, y]));
  }
  return out.length >= 3 ? out : null;
}

/** Корпуса объекта (без вилл), отсортированные; `''` — без корпуса. */
export function fpWings(units: Unit[]): string[] {
  return [...new Set(units.filter((u) => !u.vl).map((u) => u.wing || ""))].sort();
}
/** Этажи корпуса по убыванию. */
/** Этажи, которые занимает квартира: дуплекс — f и f+1, терс-дуплекс — f-1 и f, триплекс — lo..lo+2 (lo = f − td). */
export function unitFloors(u: Unit): number[] {
  if (u.tag === "duplex") return [u.floor, u.floor + 1];
  if (u.tag === "tduplex") return [u.floor - 1, u.floor];
  if (u.tag === "triplex") { const lo = u.floor - (u.td || 0); return [lo, lo + 1, lo + 2]; }
  return [u.floor];
}
/** Уровень многоэтажной квартиры на этаже F: lower / middle / upper (null — обычная квартира). */
export function levelOf(u: Unit, floor: number): "lower" | "middle" | "upper" | null {
  const fs = unitFloors(u);
  if (fs.length < 2) return null;
  const i = fs.indexOf(floor);
  return i <= 0 ? "lower" : i === fs.length - 1 ? "upper" : "middle";
}
export function fpFloors(units: Unit[], wing: string): number[] {
  return [...new Set(units.filter((u) => !u.vl && (u.wing || "") === wing).flatMap(unitFloors))].sort((a, b) => b - a);
}
/** Пустая плитка сгенерированной сетки (ни комнатности, ни площади) — как `blank` в `Tile.tsx`; квартира без комнатности, но с площадью — не пустая. */
/** Пустая плитка — без комнатности, площади, цены и в статусе «свободно»; проданная квартира без типа/площади (так бывает в прайсах
 *  по уже проданным) — настоящая квартира, она есть на плане и подлежит разметке. */
export const isBlankUnit = (u: Pick<Unit, "type" | "area"> & Partial<Pick<Unit, "status" | "price">>) => !u.type && !u.area && !(u.price ?? 0) && (u.status === undefined || u.status === "free");
/** Юниты, занимающие этаж корпуса (в т.ч. верхние уровни дуплексов/триплексов; без пустых плиток), по позиции. */
export function fpUnits(units: Unit[], wing: string, floor: number): Unit[] {
  return units.filter((u) => !u.vl && (u.wing || "") === wing && !isBlankUnit(u) && unitFloors(u).includes(floor)).sort((a, b) => a.pos - b.pos);
}
export const fpHasAny = (obj: Project | undefined) => !!obj?.floorPlans && Object.values(obj.floorPlans).some((p) => !!p?.img);
export const areaOf = (plan: FloorPlan | undefined, uid: number): FloorPlanArea | undefined => plan?.areas.find((a) => a.uid === uid);

/** Обрезать «мёртвые» blob-полигоны: юниты, которых больше нет в объекте. */
export function pruneAreas(plan: FloorPlan, units: Unit[]): FloorPlan {
  const ids = new Set(units.map((u) => u.uid));
  const areas = plan.areas.filter((a) => ids.has(a.uid));
  return areas.length === plan.areas.length ? plan : { ...plan, areas };
}

// ───── Подравнивание контура (чистая геометрия; прилипание к чертежу — в `planEdges.ts`) ─────
// Все функции работают в нормализованных координатах 0..1; `aspect` = w/h картинки переводит X в изотропные единицы
// (доли высоты), чтобы допуски и углы не зависели от формата картинки.

const iso = (p: Pt, aspect: number): Pt => [p[0] * aspect, p[1]];
const unIso = (p: Pt, aspect: number): Pt => [p[0] / aspect, p[1]];

/** Расстояние от точки до отрезка a–b. */
function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dy = b[1] - a[1];
  const l2 = dx * dx + dy * dy;
  let t = l2 ? ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / l2 : 0;
  t = t < 0 ? 0 : t > 1 ? 1 : t;
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function rdp(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 3) return pts;
  const a = pts[0], b = pts[pts.length - 1];
  let idx = -1, max = 0;
  for (let i = 1; i < pts.length - 1; i++) { const d = segDist(pts[i], a, b); if (d > max) { max = d; idx = i; } }
  if (max <= eps || idx < 0) return [a, b];
  const left = rdp(pts.slice(0, idx + 1), eps), right = rdp(pts.slice(idx), eps);
  return [...left.slice(0, -1), ...right];
}

/** Рамер–Дуглас–Пекер для замкнутого контура: убирает точки, лежащие на прямой между соседями (eps — доля высоты картинки). */
export function simplifyPoly(poly: Pt[], epsNorm = 0.004, aspect = 1): Pt[] {
  if (poly.length < 4) return poly;
  const pts = poly.map((p) => iso(p, aspect));
  // замкнутый контур режем на две цепочки по самой дальней от первой вершины точке
  let far = 0, max = -1;
  for (let i = 1; i < pts.length; i++) { const d = Math.hypot(pts[i][0] - pts[0][0], pts[i][1] - pts[0][1]); if (d > max) { max = d; far = i; } }
  const c1 = rdp(pts.slice(0, far + 1), epsNorm), c2 = rdp([...pts.slice(far), pts[0]], epsNorm);
  const out = [...c1.slice(0, -1), ...c2.slice(0, -1)];
  return out.length >= 3 ? out.map((p) => unIso(p, aspect)) : poly;
}

/** Рёбра, близкие к горизонтали/вертикали (± angleTolDeg), делаются строго осевыми (координата концов усредняется);
 *  косые рёбра и дуги не трогаются. Несколько проходов, чтобы соседние рёбра «договорились». */
export function orthoSnap(poly: Pt[], aspect = 1, angleTolDeg = 8, passes = 3): Pt[] {
  if (poly.length < 3) return poly;
  const pts = poly.map((p) => iso(p, aspect));
  const tol = (angleTolDeg * Math.PI) / 180;
  const n = pts.length;
  for (let pass = 0; pass < passes; pass++) {
    for (let i = 0; i < n; i++) {
      const a = pts[i], b = pts[(i + 1) % n];
      const dx = b[0] - a[0], dy = b[1] - a[1];
      if (Math.hypot(dx, dy) < 1e-6) continue;
      const ang = Math.atan2(Math.abs(dy), Math.abs(dx)); // 0 — горизонталь, π/2 — вертикаль
      if (ang <= tol) { const y = (a[1] + b[1]) / 2; a[1] = y; b[1] = y; }
      else if (Math.PI / 2 - ang <= tol) { const x = (a[0] + b[0]) / 2; a[0] = x; b[0] = x; }
    }
  }
  return pts.map((p) => unIso(p, aspect));
}

/** Сглаживание Чайкина (замкнутый контур): каждое ребро → две точки на 1/4 и 3/4; число точек удваивается за итерацию. */
export function chaikin(poly: Pt[], iterations = 2): Pt[] {
  let pts = poly;
  for (let k = 0; k < iterations; k++) {
    if (pts.length < 3) return pts;
    const out: Pt[] = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[(i + 1) % pts.length];
      out.push([0.75 * a[0] + 0.25 * b[0], 0.75 * a[1] + 0.25 * b[1]], [0.25 * a[0] + 0.75 * b[0], 0.25 * a[1] + 0.75 * b[1]]);
    }
    pts = out;
  }
  return pts;
}

/** Склейка соседних вершин ближе `minDistNorm` (доля высоты картинки) в их середину; замыкающее ребро тоже проверяется. */
export function mergeClose(poly: Pt[], minDistNorm = 0.008, aspect = 1): Pt[] {
  if (poly.length < 4) return poly;
  let pts = poly.map((p) => iso(p, aspect));
  let changed = true;
  while (changed && pts.length > 3) {
    changed = false;
    const out: Pt[] = [];
    let merged = 0;
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i], b = pts[i + 1];
      if (b && pts.length - merged > 3 && Math.hypot(a[0] - b[0], a[1] - b[1]) < minDistNorm) {
        out.push([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]); i++; merged++; changed = true;
      } else out.push(a);
    }
    pts = out;
    if (pts.length > 3) {
      const a = pts[pts.length - 1], b = pts[0];
      if (Math.hypot(a[0] - b[0], a[1] - b[1]) < minDistNorm) { pts[0] = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; pts.pop(); changed = true; }
    }
  }
  return pts.map((p) => unIso(p, aspect));
}
