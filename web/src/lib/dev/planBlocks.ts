// Блок-схемы этажей («KAT DAĞILIM ŞEMASI», схемы «NOLU MESKEN»): квартира — залитый цветом многоугольник с подписью,
// стен и дверей нет. Контур берём по границе цветной области; номер, тип и площадь читает модель из подписи.
//
// Сегментация: «заливка» — насыщенные пиксели (не серый/белый/чёрный); тонкие линии-разделители между блоками (темнее или
// светлее соседей, шириной до 5 px) вырезаются из заливки; текстура (трава, узор) даёт плотное облако таких «линий» — её
// не трогаем (плотность гребней в окне 11×11 > 22 %). Области растут только по пикселям близкого цвета (жёлтая полоса
// коридора не склеивает квартиры), осколки одного блока (текст подписи режет блок) сливаются по прямому соседству.
import { edt, fillHoles, traceOutline } from "./planWalls";
import type { Pt } from "./floorplan";

export type Rgb = { w: number; h: number; data: Uint8ClampedArray | Uint8Array; ch: 3 | 4 };
export type Block = { poly: Pt[]; areaFrac: number; cx: number; cy: number; color: [number, number, number] };

/** Цветная копия картинки плана, длинная сторона ≤ maxSide (как `grayFromImage`). */
export function rgbFromImage(img: HTMLImageElement, maxSide = 2000): Rgb | null {
  const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.max(1, Math.round(img.naturalWidth * k)), h = Math.max(1, Math.round(img.naturalHeight * k));
  const c = document.createElement("canvas"); c.width = w; c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: true }); if (!ctx) return null;
  ctx.drawImage(img, 0, 0, w, h);
  return { w, h, data: ctx.getImageData(0, 0, w, h).data, ch: 4 };
}

/** Простое упрощение ломаной (Рамер–Дуглас–Пекер). */
function rdp(pts: Pt[], eps: number): Pt[] {
  if (pts.length < 4) return pts;
  const dseg = (p: Pt, a: Pt, b: Pt) => { const dx = b[0] - a[0], dy = b[1] - a[1]; const L2 = dx * dx + dy * dy || 1; const t = Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / L2)); return Math.hypot(p[0] - a[0] - t * dx, p[1] - a[1] - t * dy); };
  const keep = new Uint8Array(pts.length); keep[0] = 1; keep[pts.length - 1] = 1;
  const rec = (a: number, b: number) => { let im = -1, dm = eps; for (let i = a + 1; i < b; i++) { const d = dseg(pts[i], pts[a], pts[b]); if (d > dm) { dm = d; im = i; } } if (im >= 0) { keep[im] = 1; rec(a, im); rec(im, b); } };
  rec(0, pts.length - 1);
  return pts.filter((_, i) => keep[i]);
}

/** Сегментация цветных блоков. `minFrac` — минимальная доля площади листа у блока. */
export function segmentBlocks(rgb: Rgb, opts: { tol?: number; minFrac?: number; ridgeT?: number } = {}): Block[] {
  const { w, h, data, ch } = rgb; const TOL = opts.tol ?? 60, RT = opts.ridgeT ?? 12, minN = (opts.minFrac ?? 0.00008) * w * h;
  const fill = new Uint8Array(w * h); const lum = new Float32Array(w * h);
  for (let i = 0; i < w * h; i++) { const r = data[i * ch], g = data[i * ch + 1], b = data[i * ch + 2]; lum[i] = 0.299 * r + 0.587 * g + 0.114 * b; const mx = Math.max(r, g, b), mn = Math.min(r, g, b); if (mx - mn > 45 && mx > 90 && mn > 40) fill[i] = 1; }
  // гребни/впадины яркости — кандидаты в линии
  const ridge = new Uint8Array(w * h);
  for (let y = 1; y < h - 1; y++) for (let x = 1; x < w - 1; x++) {
    const i = y * w + x; if (!fill[i]) continue; const v = lum[i];
    const line = (a: number, b: number) => (v < a - RT && v < b - RT) || (v > a + RT && v > b + RT);
    let hit = false; for (let k = 1; k <= 5 && !hit; k++) { if (x - k < 0 || x + k >= w || y - k < 0 || y + k >= h) break; hit = line(lum[i - k], lum[i + k]) || line(lum[i - k * w], lum[i + k * w]); }
    if (hit) ridge[i] = 1;
  }
  // плотность гребней в окне 11×11: редкие — линии (вырезаем), плотные — текстура (оставляем)
  { const R = 5, W1 = w + 1; const S = new Int32Array(W1 * (h + 1));
    for (let y = 1; y <= h; y++) { let r = 0; for (let x = 1; x <= w; x++) { r += ridge[(y - 1) * w + x - 1]; S[y * W1 + x] = S[(y - 1) * W1 + x] + r; } }
    for (let y = R; y < h - R; y++) for (let x = R; x < w - R; x++) { const i = y * w + x; if (!ridge[i]) continue; const a = (y - R) * W1 + (x - R), b = (y - R) * W1 + (x + R + 1), c = (y + R + 1) * W1 + (x - R), d = (y + R + 1) * W1 + (x + R + 1); if (S[d] - S[b] - S[c] + S[a] <= 0.22 * (2 * R + 1) * (2 * R + 1)) fill[i] = 0; } }
  const col = (i: number): [number, number, number] => [data[i * ch], data[i * ch + 1], data[i * ch + 2]];
  const dist = (a: [number, number, number], b: [number, number, number]) => Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]);
  // ядра: компоненты заливки по близости цвета к цвету затравки
  const seedCol = new Map<number, [number, number, number]>();
  const { lab, area } = (() => { const lab = new Int32Array(w * h); const area: number[] = [0]; const st = new Int32Array(w * h);
    for (let i = 0; i < fill.length; i++) { if (!fill[i] || lab[i]) continue; const id = area.length; area.push(0); const c0 = col(i); seedCol.set(id, c0); let top = 0; st[top++] = i; lab[i] = id;
      while (top) { const j = st[--top]; area[id]++; const x = j % w; for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j - w, j + w]) { if (k < 0 || k >= w * h || lab[k] || !fill[k] || dist(col(k), c0) > TOL) continue; lab[k] = id; st[top++] = k; } } }
    return { lab, area }; })();
  // мелкие компоненты — не блоки (текст, обрезки); их пиксели достаются ближайшему блоку близкого цвета
  const mean = new Map<number, [number, number, number]>();
  { const sum = new Map<number, [number, number, number]>(); for (let i = 0; i < lab.length; i++) { const l = lab[i]; if (!l || area[l] < minN) continue; const c = col(i); const s = sum.get(l) ?? [0, 0, 0]; s[0] += c[0]; s[1] += c[1]; s[2] += c[2]; sum.set(l, s); } sum.forEach((s, l) => mean.set(l, [s[0] / area[l], s[1] / area[l], s[2] / area[l]])); }
  for (let i = 0; i < lab.length; i++) if (lab[i] && !mean.has(lab[i])) lab[i] = 0;
  { const q = new Int32Array(w * h); let head = 0, tail = 0; for (let i = 0; i < lab.length; i++) if (lab[i]) q[tail++] = i;
    while (head < tail) { const j = q[head++]; const x = j % w; const m = mean.get(lab[j])!; for (const k of [x > 0 ? j - 1 : -1, x < w - 1 ? j + 1 : -1, j - w, j + w]) { if (k < 0 || k >= w * h || lab[k] || !fill[k] || dist(col(k), m) > TOL) continue; lab[k] = lab[j]; q[tail++] = k; } } }
  // слияние соприкасающихся осколков близкого цвета (разные квартиры разделены линией и не соприкасаются)
  { const parent = new Map<number, number>(); const find = (a: number) => { while (parent.has(a) && parent.get(a) !== a) a = parent.get(a)!; return a; };
    for (let y = 0; y < h - 1; y++) for (let x = 0; x < w - 1; x++) { const i = y * w + x, a = lab[i]; if (!a) continue; for (const j of [i + 1, i + w]) { const b = lab[j]; if (!b || b === a) continue; if (dist(mean.get(a)!, mean.get(b)!) <= TOL) { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(ra, rb); } } }
    for (let i = 0; i < lab.length; i++) if (lab[i]) lab[i] = find(lab[i]); }
  // контуры
  const px = new Map<number, number>(); const bx0 = new Map<number, number>(), by0 = new Map<number, number>(), bx1 = new Map<number, number>(), by1 = new Map<number, number>();
  for (let i = 0; i < lab.length; i++) { const l = lab[i]; if (!l) continue; px.set(l, (px.get(l) ?? 0) + 1); const x = i % w, y = (i - x) / w; bx0.set(l, Math.min(bx0.get(l) ?? x, x)); bx1.set(l, Math.max(bx1.get(l) ?? x, x)); by0.set(l, Math.min(by0.get(l) ?? y, y)); by1.set(l, Math.max(by1.get(l) ?? y, y)); }
  const out: Block[] = [];
  px.forEach((n, l) => {
    if (n < minN) return;
    const x0 = bx0.get(l)! - 1, y0 = by0.get(l)! - 1, cw = bx1.get(l)! - x0 + 2, chh = by1.get(l)! - y0 + 2;
    const m = new Uint8Array(cw * chh);
    for (let y = 0; y < chh; y++) for (let x = 0; x < cw; x++) { const X = x0 + x, Y = y0 + y; if (X >= 0 && Y >= 0 && X < w && Y < h && lab[Y * w + X] === l) m[y * cw + x] = 1; }
    // закрытие на 4 px: подпись у края блока вырезана из заливки и «открывает» дыру наружу — контур обходил бы буквы
    { const R = 4; const d1 = edt(m, cw, chh); const dil = new Uint8Array(cw * chh); for (let i = 0; i < dil.length; i++) if (d1[i] <= R) dil[i] = 1; const inv = new Uint8Array(cw * chh); for (let i = 0; i < inv.length; i++) inv[i] = dil[i] ? 0 : 1; const d2 = edt(inv, cw, chh); for (let i = 0; i < m.length; i++) m[i] = d2[i] > R ? 1 : 0; }
    fillHoles(m, cw, chh);
    const outline = traceOutline(m, cw, chh); if (outline.length < 4) return;
    const simp = rdp(outline.map(([x, y]) => [x + 0.5, y + 0.5] as Pt), 3.5);
    if (simp.length < 3) return;
    let sx = 0, sy = 0; simp.forEach(([x, y]) => { sx += x; sy += y; });
    const c = mean.get(l) ?? seedCol.get(l) ?? [0, 0, 0];
    out.push({ poly: simp.map(([x, y]) => [+((x0 + x) / w).toFixed(4), +((y0 + y) / h).toFixed(4)]), areaFrac: n / (w * h), cx: (x0 + sx / simp.length) / w, cy: (y0 + sy / simp.length) / h, color: [Math.round(c[0]), Math.round(c[1]), Math.round(c[2])] });
  });
  out.sort((a, b) => b.areaFrac - a.areaFrac);
  // осколки подписей (обводка букв цветом блока) мельче 30 % медианного блока — не квартиры
  if (out.length >= 3) { const med = out[Math.floor(out.length / 2)].areaFrac; return out.filter((b) => b.areaFrac >= 0.3 * med); }
  return out;
}

/** Лист — блок-схема: цветная заливка занимает заметную часть листа, а толстых тёмных стен почти нет. */
export function isSchemeSheet(rgb: Rgb, blocks: Block[]): boolean {
  const { w, h, data, ch } = rgb; let dark = 0;
  for (let i = 0; i < w * h; i += 4) { const r = data[i * ch], g = data[i * ch + 1], b = data[i * ch + 2]; if (r < 50 && g < 50 && b < 50) dark++; }
  const darkFrac = (dark * 4) / (w * h);
  const fillFrac = blocks.reduce((s, b) => s + b.areaFrac, 0);
  return blocks.length >= 3 && fillFrac >= 0.04 && darkFrac < 0.04;
}

/** Блок, содержащий точку (нормализованные координаты): проверка «точка в многоугольнике». */
export function blockAt(blocks: Block[], p: Pt): Block | undefined {
  const inside = (poly: Pt[]) => { let c = false; for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) { const [xi, yi] = poly[i], [xj, yj] = poly[j]; if (yi > p[1] !== yj > p[1] && p[0] < ((xj - xi) * (p[1] - yi)) / (yj - yi) + xi) c = !c; } return c; };
  return blocks.find((b) => inside(b.poly));
}
