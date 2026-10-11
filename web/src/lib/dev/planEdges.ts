// Прилипание контура к стенам чертежа. Карта «стен» строится из картинки плана в offscreen canvas:
// темнота пикселя (стены экспликаций — тёмные линии) + модуль градиента (Sobel по ч/б), нормализовано в 0..1.
// Вершины полигона подтягиваются к ближайшему сильному пикселю в радиусе. Если картинка с чужого домена без CORS —
// canvas «tainted», getImageData бросает SecurityError → карты нет, работаем без прилипания.
import { mergeClose, normPt, orthoSnap, simplifyPoly, type Pt } from "./floorplan";

export type EdgeMap = { w: number; h: number; data: Float32Array };

/** Карта стен по загруженной картинке (масштабируется до `maxSide` по большей стороне). null — canvas недоступен/tainted. */
export function buildEdgeMap(img: HTMLImageElement, maxSide = 1400): EdgeMap | null {
  const nw = img.naturalWidth, nh = img.naturalHeight;
  if (!nw || !nh) return null;
  const k = Math.min(1, maxSide / Math.max(nw, nh));
  const w = Math.max(2, Math.round(nw * k)), h = Math.max(2, Math.round(nh * k));
  let px: Uint8ClampedArray;
  try {
    const cv = document.createElement("canvas");
    cv.width = w; cv.height = h;
    const ctx = cv.getContext("2d", { willReadFrequently: true });
    if (!ctx) return null;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, 0, 0, w, h);
    px = ctx.getImageData(0, 0, w, h).data;
  } catch { return null; }
  // ч/б яркость
  const g = new Float32Array(w * h);
  let sum = 0;
  for (let i = 0, j = 0; i < g.length; i++, j += 4) { const v = (px[j] * 0.299 + px[j + 1] * 0.587 + px[j + 2] * 0.114) / 255; g[i] = v; sum += v; }
  // тёмный фон (инвертированный чертёж) — стены светлые, инвертируем
  const invert = sum / g.length < 0.45;
  const data = new Float32Array(w * h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = y * w + x;
      const dark = invert ? g[i] : 1 - g[i];
      let grad = 0;
      if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
        const tl = g[i - w - 1], tc = g[i - w], tr = g[i - w + 1], ml = g[i - 1], mr = g[i + 1], bl = g[i + w - 1], bc = g[i + w], br = g[i + w + 1];
        const gx = -tl - 2 * ml - bl + tr + 2 * mr + br;
        const gy = -tl - 2 * tc - tr + bl + 2 * bc + br;
        grad = Math.min(1, Math.hypot(gx, gy) / 2.5); // резкая чёрно-белая граница даёт ≈4 → насыщение
      }
      // тонкие серые линии почти не темнее фона — их вытягивает градиент; жирные стены — темнота
      const d = dark < 0.12 ? 0 : (dark - 0.12) / 0.88;
      data[i] = Math.max(d, grad);
    }
  }
  return { w, h, data };
}

/** Лучший пиксель стены в радиусе r (px карты) от точки: max `edge · (1 − dist/r)`. */
function bestNear(map: EdgeMap, cx: number, cy: number, r: number): { x: number; y: number; score: number } {
  const x0 = Math.max(0, Math.floor(cx - r)), x1 = Math.min(map.w - 1, Math.ceil(cx + r));
  const y0 = Math.max(0, Math.floor(cy - r)), y1 = Math.min(map.h - 1, Math.ceil(cy + r));
  let bx = cx, by = cy, best = 0;
  for (let y = y0; y <= y1; y++) {
    for (let x = x0; x <= x1; x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d > r) continue;
      const s = map.data[y * map.w + x] * (1 - d / r);
      if (s > best) { best = s; bx = x; by = y; }
    }
  }
  return { x: bx, y: by, score: best };
}

/** Перенести точку (норм. 0..1) к ближайшей стене в радиусе `radiusNorm` (доля большей стороны); ниже порога — не трогать. */
export function snapPointToEdges(pt: Pt, map: EdgeMap, radiusNorm = 0.012, threshold = 0.25): Pt {
  const r = Math.max(1, radiusNorm * Math.max(map.w, map.h));
  const b = bestNear(map, pt[0] * map.w, pt[1] * map.h, r);
  return b.score >= threshold ? normPt([b.x / map.w, b.y / map.h]) : pt;
}

/** То же для всех вершин полигона. */
export function snapToEdges(poly: Pt[], map: EdgeMap, radiusNorm = 0.012, threshold = 0.25): Pt[] {
  return poly.map((p) => snapPointToEdges(p, map, radiusNorm, threshold));
}

/** Полная цепочка выравнивания: склейка → упрощение → ортогонализация → прилипание к стенам → ортогонализация. */
export function tidyPoly(poly: Pt[], aspect: number, map: EdgeMap | null): Pt[] {
  let p = mergeClose(poly, 0.008, aspect);
  p = simplifyPoly(p, 0.004, aspect);
  p = orthoSnap(p, aspect);
  if (map) { p = snapToEdges(p, map); p = orthoSnap(p, aspect); }
  p = simplifyPoly(p, 0.002, aspect); // после выравнивания промежуточные точки на прямой больше не нужны
  return p.map(normPt);
}

// ───── Кэш карт по URL картинки (карта 1400² ≈ 8 МБ — держим немного) ─────
const cache = new Map<string, Promise<EdgeMap | null>>();
const CACHE_MAX = 4;

/** Загрузить картинку (с CORS) и построить карту; результат кэшируется по src. null — недоступно (CORS/ошибка). */
export function loadEdgeMap(src: string): Promise<EdgeMap | null> {
  if (typeof window === "undefined" || !src) return Promise.resolve(null);
  const hit = cache.get(src);
  if (hit) return hit;
  const p = new Promise<EdgeMap | null>((resolve) => {
    const img = new Image();
    if (!/^(blob|data):/.test(src)) img.crossOrigin = "anonymous";
    img.onload = () => resolve(buildEdgeMap(img));
    img.onerror = () => {
      // CORS-заголовков нет — картинка не загрузится с crossOrigin; без него canvas будет tainted → buildEdgeMap вернёт null
      if (img.crossOrigin) { const plain = new Image(); plain.onload = () => resolve(buildEdgeMap(plain)); plain.onerror = () => resolve(null); plain.src = src; }
      else resolve(null);
    };
    img.src = src;
  });
  if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value as string);
  cache.set(src, p);
  return p;
}
