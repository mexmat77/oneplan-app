// Единый движок шахматки (прототип OnePlan v2, §4 спецификации): геометрия, фильтры,
// построение блоков (`bBlocks` 3550–3641) и все мутации структуры (2820–2960). Только чистые функции —
// компоненты (`@/components/dev/board/*`) рисуют результат, стор хранит юниты.
import { isSpecialType, specialTypeOf } from "./data";
import type { Band, Unit, UnitStatus } from "./types";
export type { Band };

// ---- геометрия (§4.1) ----
export const CELL_W = 132;
export const CELL_GAP = 7;
export const CELL_H = 92;
export const CELL_STEP = CELL_W + CELL_GAP; // 139 — шаг «дощёлкивания» ресайза
/** Ширина плитки на `n` клеток: `n*132 + (n-1)*7`. */
export const widthPx = (n: number) => n * CELL_W + (n - 1) * CELL_GAP;
/** `unit.w` — ширина в клетках (undefined = 1). */
export const uWd = (u: Unit) => (u.w && u.w > 1 ? u.w : 1);
/** Соцзона / паркинг / техпомещение не продаются: статус «не продаётся», что бы ни пришло из прайса. */
export const specialStatus = (type: string, status: UnitStatus): UnitStatus => (type && type !== "1*" && isSpecialType(type) ? "na" : status);
export const posOf = (u: Unit) => +u.pos || 0;
export const wingOf = (u: Unit) => u.wing || "";
export const bandOf = (u: Unit): Band => u.band || "out";

// ---- фильтры (`pass`, 3133; `segPass` 3130) ----
export type Seg = "" | "res" | "com" | "vil";
export type BoardFilters = {
  seg: Seg;
  qNum: string;
  fVType: string;
  fWing: string;
  fRoom: string;
  fSt: "" | UnitStatus;
  aMin: string;
  aMax: string;
  pMin: string;
  pMax: string;
};
export const EMPTY_FILTERS: BoardFilters = { seg: "", qNum: "", fVType: "", fWing: "", fRoom: "", fSt: "", aMin: "", aMax: "", pMin: "", pMax: "" };

export const isComU = (u: Unit) => u.wing === "T" || u.type === "1*" || u.tag === "ofis";
/** «Квартиры» = не коммерция, не вилла и не служебное помещение (соц. зона / паркинг / техническое); «Все» включает всё. */
export const segPassOf = (seg: Seg) => (u: Unit) => !seg || (seg === "com" ? isComU(u) : seg === "vil" ? !!u.vl : !isComU(u) && !u.vl && !isSpecialType(u.type));
/** Полный предикат фильтров: сегмент + номер + тип виллы + корпус + комнаты + статус + площадь + цена (проданные проходят цену всегда). */
export function makePass(f: BoardFilters): (u: Unit) => boolean {
  const seg = segPassOf(f.seg);
  const amin = +f.aMin || 0, amax = +f.aMax || 1e9, pmin = +f.pMin || 0, pmax = +f.pMax || 1e12;
  const qq = (f.qNum || "").trim().toLowerCase();
  return (u) =>
    seg(u) &&
    (!qq || String(u.num).toLowerCase().indexOf(qq) > -1) &&
    (!f.fVType || String(u.vt) === String(f.fVType)) &&
    (!f.fWing || wingOf(u) === f.fWing) &&
    (!f.fRoom || u.type === f.fRoom) &&
    (!f.fSt || u.status === f.fSt) &&
    u.area >= amin && u.area <= amax &&
    (u.status === "sold" || u.status === "na" || (u.price >= pmin && u.price <= pmax));
}
export const hasCommercial = (units: Unit[]) => units.some(isComU);

// ---- модель доски (§4.3) ----
export type ExpandInfo = { a: number; b: number; lines: number[]; bf: number };
export type BoardCell =
  | { kind: "unit"; u: Unit; sw: number; maxW: number; expand?: ExpandInfo }
  | { kind: "twin"; u: Unit; sw: number }
  | { kind: "cover" }
  | { kind: "hole" }
  | { kind: "slot"; f: number; p: number; wg: string; bd: Band | null };
export type BoardBand = { bd: Band; cells: BoardCell[] };
export type BoardFloor = { f: number; bands: BoardBand[]; hasSides: boolean; ghost: boolean };
export type BoardBlock = { wg: string; floors: BoardFloor[] };

/** Этажи, которые визуально занимает юнит (дуплекс/триплекс тянутся на 2–3 ряда). */
export function spanOf(u: Unit): number[] {
  if (u.tag === "duplex") return [u.floor, u.floor + 1];
  if (u.tag === "tduplex") return [u.floor - 1, u.floor];
  if (u.tag === "triplex") { const lo = u.floor - (+(u.td || 0)); return [lo, lo + 1, lo + 2]; }
  return [u.floor];
}

/** Порт `bBlocks` (3550–3641) + `b1Row` (2882–2897). `segPass` — сегментный фильтр (Все/Квартиры/Коммерция). */
export function buildBlocks(units: Unit[], editOn: boolean, segPass: (u: Unit) => boolean = () => true): BoardBlock[] {
  const gAll = units.filter((u) => !u.vl);
  let minP = Infinity, maxP = -Infinity;
  gAll.forEach((u) => { const p = posOf(u); if (p < minP) minP = p; if (p > maxP) maxP = p; });
  if (!isFinite(minP)) { minP = 0; maxP = -1; }
  const extra = editOn ? 1 : 0;
  const wingList = [...new Set(gAll.map(wingOf))].sort();
  if (!gAll.length && !editOn) return [];
  return (wingList.length ? wingList : [""]).map((wg) => {
    const uw = units.filter((u) => !u.vl && wingOf(u) === wg && segPass(u));
    // ширина корпуса — по его обычным помещениям (служебное на всю ширину само её не задаёт)
    const wingMaxP = Math.max(minP, ...uw.filter((u) => u.type === "1*" || !isSpecialType(u.type)).map((u) => posOf(u) + uWd(u) - 1));
    const need = new Set(uw.map((u) => u.floor));
    uw.forEach((u) => {
      if (u.tag === "duplex") need.add(u.floor + 1);
      else if (u.tag === "tduplex") need.add(u.floor - 1);
      else if (u.tag === "triplex") { const lo = u.floor - (+(u.td || 0)); need.add(lo); need.add(lo + 1); need.add(lo + 2); }
    });
    const shown = [...need].sort((a, b) => b - a);
    const fHasIns: Record<number, boolean> = {};
    shown.forEach((f) => { fHasIns[f] = uw.some((x) => x.floor === f && x.band === "ins"); });
    const rowKeys: string[] = [];
    shown.forEach((f) => { rowKeys.push(f + "|out"); if (fHasIns[f]) rowKeys.push(f + "|ins"); });
    const RI = (f: number, bd: string) => rowKeys.indexOf(f + "|" + bd);
    const homeAt = (f: number, bd: string, p: number, self: Unit) =>
      uw.some((x) => { if (x === self) return false; const xb = fHasIns[f] ? bandOf(x) : "out"; return x.floor === f && xb === bd && posOf(x) <= p && p < posOf(x) + uWd(x); });
    const cover: Record<string, number> = {};
    const twin: Record<string, Unit> = {};
    const expandMode: Record<number, ExpandInfo> = {};
    uw.forEach((u) => {
      if (u.tag !== "duplex" && u.tag !== "tduplex" && u.tag !== "triplex") return;
      const p = posOf(u), w = uWd(u), f = u.floor;
      const bd = fHasIns[f] ? bandOf(u) : "out";
      const bAt = (f2: number) => (fHasIns[f2] ? bd : "out");
      const rowFree = (f2: number, bd2: string) => { for (let q = p; q < p + w; q++) if (homeAt(f2, bd2, q, u) || cover[f2 + "|" + bd2 + "|" + q] || twin[f2 + "|" + bd2 + "|" + q]) return false; return true; };
      const cand: number[][] = u.tag === "duplex" ? [[f + 1]] : u.tag === "tduplex" ? [[f - 1]] : (() => {
        const mk = (x: number) => (x === 0 ? [f + 1, f + 2] : x === 1 ? [f + 1, f - 1] : [f - 1, f - 2]);
        return [...new Set([+(u.td || 0), 0, 1, 2])].map(mk);
      })();
      for (const tf of cand) {
        if (!tf.every((f2) => shown.indexOf(f2) >= 0 && RI(f2, bAt(f2)) >= 0)) continue;
        if (!tf.every((f2) => rowFree(f2, bAt(f2)))) continue;
        const rHome = RI(f, bd);
        const allR = [rHome, ...tf.map((f2) => RI(f2, bAt(f2)))];
        const rTop = Math.min(...allR), rBot = Math.max(...allR);
        let okA = true;
        for (let k = rTop; k <= rBot && okA; k++) { if (k === rHome) continue; const pr = rowKeys[k].split("|"); if (!rowFree(+pr[0], pr[1])) okA = false; }
        if (okA) {
          for (let k = rTop; k <= rBot; k++) { if (k === rHome) continue; const pr = rowKeys[k].split("|"); for (let q = p; q < p + w; q++) cover[pr[0] + "|" + pr[1] + "|" + q] = u.uid; }
          const lines: number[] = [];
          for (let k = rTop + 1; k <= rBot; k++) { if (rowKeys[k].split("|")[0] !== rowKeys[k - 1].split("|")[0]) lines.push(k - rTop); }
          expandMode[u.uid] = { a: rHome - rTop, b: rBot - rHome, lines, bf: Math.min(f, ...tf) };
        } else {
          tf.forEach((f2) => { for (let q = p; q < p + w; q++) twin[f2 + "|" + bAt(f2) + "|" + q] = u; });
        }
        break;
      }
    });
    const availOf = (u: Unit, fuB: Unit[], fi: string, pmax: number) => {
      const p = posOf(u); let avail = 0;
      for (let q = p + 1; q <= pmax; q++) { if (fuB.find((x) => posOf(x) === q)) break; const cv = cover[fi + "|" + q]; if (cv && cv !== u.uid) break; avail++; }
      return 1 + avail;
    };
    const floors: BoardFloor[] = shown.map((f) => {
      const fu2 = units.filter((u) => u.floor === f && !u.vl && wingOf(u) === wg && segPass(u)).sort((a, b) => a.pos - b.pos);
      const floorHasIns = fu2.some((x) => x.band === "ins");
      const mkCells = (bd: Band): BoardCell[] => {
        const cells: BoardCell[] = [];
        let skip = 0;
        const bdK = floorHasIns ? bd : "out";
        const fuB = floorHasIns ? fu2.filter((x) => bandOf(x) === bd) : fu2;
        for (let p = minP; p <= maxP + extra; p++) {
          if (skip > 0) { skip--; continue; }
          const u = fu2.find((x) => posOf(x) === p && (!floorHasIns || bandOf(x) === bd));
          if (u) {
            const maxW = availOf(u, fuB, f + "|" + bdK, maxP + extra);
            // единственное служебное помещение на этаже (соцзона, паркинг) — на всю ширину этажа
            const full = fu2.length === 1 && !u.w && u.type !== "1*" && isSpecialType(u.type);
            const sw = full ? Math.max(1, wingMaxP + extra - posOf(u) + 1) : Math.min(uWd(u), maxW); // на ширину своего корпуса
            skip = sw - 1;
            const emx = expandMode[u.uid];
            cells.push({ kind: "unit", u, sw, maxW, expand: emx && (emx.a || emx.b) ? emx : undefined });
          } else if (twin[f + "|" + bdK + "|" + p]) {
            const tu = twin[f + "|" + bdK + "|" + p];
            const sw = Math.min(uWd(tu), availOf(tu, fuB, f + "|" + bdK, maxP + extra));
            skip = sw - 1;
            cells.push({ kind: "twin", u: tu, sw });
          } else if (cover[f + "|" + bdK + "|" + p]) cells.push({ kind: "cover" });
          else if (editOn) cells.push({ kind: "slot", f, p, wg, bd: floorHasIns ? bd : null });
          else cells.push({ kind: "hole" });
        }
        if (!editOn) { while (cells.length && cells[cells.length - 1].kind === "hole") cells.pop(); }
        return cells;
      };
      const bands: BoardBand[] = floorHasIns ? (["out", "ins"] as Band[]).map((bd) => ({ bd, cells: mkCells(bd) })) : [{ bd: "out", cells: mkCells("out") }];
      return { f, bands, hasSides: floorHasIns, ghost: false };
    });
    // b1Row: пустые пунктирные ряды B1/B2 под нижним этажом, если ters-дуплекс/триплекс уходит ниже
    const pool = units.filter((u) => !u.vl && wingOf(u) === wg);
    if (shown.length) {
      const low = shown[shown.length - 1];
      let depth = 0;
      pool.forEach((u) => {
        let reach: number | null = null;
        if (u.tag === "tduplex") reach = u.floor - 1;
        else if (u.tag === "triplex" && u.td) reach = u.floor - (+(u.td || 0));
        if (reach != null && reach < low) depth = Math.max(depth, low - reach);
      });
      for (let d = 1; d <= depth; d++) floors.push({ f: low - d, bands: [{ bd: "out", cells: [] }], hasSides: false, ghost: true });
    }
    return { wg, floors };
  });
}

// ---- мутации структуры (§4.7). Все функции возвращают НОВЫЙ массив (юниты — новые объекты при изменении). ----
const maxUid = (units: Unit[]) => (units.length ? Math.max(...units.map((u) => u.uid)) + 1 : 1);
const maxNum = (units: Unit[]) => (units.length ? Math.max(...units.map((u) => +u.num || 0)) + 1 : 1);
const blank = (uid: number, num: number, f: number, pos: number, band: Band, wg: string): Unit =>
  ({ uid, num, floor: f, pos, band, wing: wg || undefined, gen: true, type: "", area: 0, price: 0, status: "free", tag: null, feats: [] });

/** Перенумерация (2824): только `gen`-юниты (или все не-виллы при `genGrid`), сквозная 1..n по корпусам, внутри — floor asc, pos asc. */
/** Renumbering options: `genGrid` (prototype flag) plus per-block start numbers (`Project.numStart`). */
export type RenumOpts = boolean | { genGrid: boolean; starts?: Record<string, number> };
const optsOf = (o: RenumOpts) => (typeof o === "boolean" ? { genGrid: o, starts: undefined } : o);
/**
 * Перенумерация (2824–2834), доработано: каждый корпус нумеруется отдельно с `numStart[wing]` (по умолчанию 1),
 * порядок floor asc → pos asc; квартиры с номером, введённым вручную (`numManual`), не трогаются.
 */
export function gRenum(units: Unit[], opts: RenumOpts): Unit[] {
  const { genGrid, starts } = optsOf(opts);
  // Basement floors (< 0) are technical/parking: their tiles keep manual numbers («B1-1») and never shift the sequence.
  const pool = units.filter((u) => !u.vl && !u.numManual && u.floor >= 0 && (genGrid || u.gen));
  if (!pool.length) return units;
  const wings = [...new Set(pool.map(wingOf))].sort();
  const numOf = new Map<number, string>();
  wings.forEach((w) => {
    let n = Math.max(1, Math.floor(starts?.[w] ?? 1));
    pool.filter((u) => wingOf(u) === w).sort((a, b) => a.floor - b.floor || a.pos - b.pos).forEach((u) => { numOf.set(u.uid, String(n++)); });
  });
  return units.map((u) => (numOf.has(u.uid) && String(u.num) !== numOf.get(u.uid) ? { ...u, num: numOf.get(u.uid)! } : u));
}
/** + Квартира в ряд (2820): `pos = max+1` в ряду, `num = max+1`. */
export function gAddUnit(units: Unit[], f: number, band: Band, wg: string, genGrid: RenumOpts): Unit[] {
  const fp = units.filter((u) => u.floor === f && bandOf(u) === band && wingOf(u) === wg);
  const pos = fp.length ? Math.max(...fp.map(posOf)) + 1 : 1;
  const b = blank(maxUid(units), maxNum(units), f, pos, band, wg);
  const nb = f < 0 ? { ...b, num: `B${-f}-${units.filter((u) => u.floor === f && wingOf(u) === wg).length + 1}`, numManual: true } : b;
  return gRenum([...units, nb], genGrid);
}
/** + Этаж в корпусе (2823): `floor = max+1` внутри корпуса, одна пустая плитка `pos:1`. */
export function gAddFloorW(units: Unit[], wg: string, genGrid: RenumOpts): Unit[] {
  const wu = units.filter((u) => !u.vl && wingOf(u) === wg);
  const f = wu.length ? Math.max(...wu.map((u) => u.floor)) + 1 : 0;
  return gRenum([...units, blank(maxUid(units), maxNum(units), f, 1, "out", wg)], genGrid);
}
/**
 * Этаж снизу (B1, B2 …): новый этаж = min − 1 с одной плиткой. Её номер задаётся вручную («B1-1»), чтобы
 * автонумерация остальных квартир не сдвинулась.
 */
export function gAddFloorBelowW(units: Unit[], wg: string, genGrid: RenumOpts, label: (f: number) => string): Unit[] {
  const wu = units.filter((u) => !u.vl && wingOf(u) === wg);
  const f = wu.length ? Math.min(...wu.map((u) => u.floor)) - 1 : -1;
  const b = blank(maxUid(units), maxNum(units), f, 1, "out", wg);
  return gRenum([...units, { ...b, num: `${label(f)}-1`, numManual: true }], genGrid);
}
/** Удалить этаж только в своём корпусе (прототип удалял этаж во всех блоках сразу). */
export function gDelFloor(units: Unit[], f: number, wg: string, genGrid: RenumOpts): Unit[] { return gRenum(units.filter((u) => !(u.floor === f && wingOf(u) === wg)), genGrid); }
export function gDelUnit(units: Unit[], uid: number, genGrid: RenumOpts): Unit[] { return gRenum(units.filter((u) => u.uid !== uid), genGrid); }
/** Обмен местами («пятнашки», 2835): floor/pos/band/wing. */
export function gSwapUnits(units: Unit[], uid: number, tuid: number, genGrid: RenumOpts): Unit[] {
  const a = units.find((u) => u.uid === uid), b = units.find((u) => u.uid === tuid);
  if (!a || !b) return units;
  const next = units.map((u) => (u.uid === uid ? { ...u, floor: b.floor, pos: b.pos, band: b.band, wing: b.wing } : u.uid === tuid ? { ...u, floor: a.floor, pos: a.pos, band: a.band, wing: a.wing } : u));
  return gRenum(next, genGrid);
}
/** Перенос на слот (2901–2920): смещение `df/dp` ко всем выделенным (если тянут выделенную) или к одной. `null` — ход невозможен. */
export function gGroupMove(units: Unit[], uid: number, sel: number[], tf: number, tp: number, wg: string, bd: Band | null, genGrid: RenumOpts): Unit[] | null {
  const selIds = sel.includes(uid) && sel.length > 1 ? sel.slice() : [uid];
  const src = units.find((u) => u.uid === uid);
  if (!src) return null;
  const df = tf - src.floor, dp = tp - posOf(src);
  const selSet = new Set(selIds);
  const floors = new Set(units.filter((u) => !u.vl).map((u) => u.floor));
  const insFloors = new Set<string>();
  units.forEach((u) => { if (!selSet.has(u.uid) && !u.vl && u.band === "ins") insFloors.add(wingOf(u) + "|" + u.floor); });
  const nb = (u: Unit, nf: number): Band => (insFloors.has((wg || "") + "|" + nf) ? (selIds.length === 1 ? bd || bandOf(u) : bandOf(u)) : "out");
  const occ = new Set<string>();
  units.forEach((u) => { if (!selSet.has(u.uid) && !u.vl) occ.add(wingOf(u) + "|" + u.floor + "|" + bandOf(u) + "|" + posOf(u)); });
  for (const u of units.filter((x) => selSet.has(x.uid))) {
    const nf = u.floor + df, np = posOf(u) + dp;
    if (np < 0 || !floors.has(nf) || occ.has((wg || "") + "|" + nf + "|" + nb(u, nf) + "|" + np)) return null;
  }
  return gRenum(units.map((u) => (selSet.has(u.uid) ? { ...u, floor: u.floor + df, pos: posOf(u) + dp, band: nb(u, u.floor + df), wing: wg || undefined } : u)), genGrid);
}
/** Выравнивание ряда (2921–2960): left / right / center («Пирамида»); колонки многоэтажных зарезервированы. */
export function gAlign(units: Unit[], mode: "left" | "center" | "right", wg: string | null, genGrid: RenumOpts): Unit[] {
  let pool = units.filter((u) => !u.vl);
  if (wg != null) pool = pool.filter((u) => wingOf(u) === wg);
  if (!pool.length) return units;
  const newPos = new Map<number, number>();
  [...new Set(pool.map(wingOf))].forEach((w) => {
    const wu = pool.filter((u) => wingOf(u) === w);
    const bkey = (u: Unit) => u.floor + "|" + bandOf(u);
    const floors = [...new Set(wu.map(bkey))];
    const maxN = Math.max(...floors.map((f) => wu.filter((u) => bkey(u) === f).length));
    const res: Record<string, Set<number>> = {};
    wu.filter((u) => spanOf(u).length > 1).forEach((u) => { spanOf(u).forEach((f) => { const k = f + "|" + bandOf(u); (res[k] = res[k] || new Set()).add(posOf(u)); }); });
    floors.forEach((f) => {
      const fu = wu.filter((u) => bkey(u) === f && spanOf(u).length === 1).sort((a, b) => a.pos - b.pos);
      const n = fu.length; if (!n) return;
      const taken = res[f] || new Set<number>();
      const width = Math.max(maxN, n + taken.size);
      const free: number[] = [];
      for (let pp = 1; pp <= width; pp++) if (!taken.has(pp)) free.push(pp);
      let nxt = width + 1;
      while (free.length < n) { if (!taken.has(nxt)) free.push(nxt); nxt++; }
      let chosen: number[];
      if (mode === "left") chosen = free.slice(0, n);
      else if (mode === "right") chosen = free.slice(free.length - n);
      else { const off = Math.floor((free.length - n) / 2); chosen = free.slice(off, off + n); }
      fu.forEach((u, i) => newPos.set(u.uid, chosen[i]));
    });
  });
  return gRenum(units.map((u) => (newPos.has(u.uid) && newPos.get(u.uid) !== u.pos ? { ...u, pos: newPos.get(u.uid)! } : u)), genGrid);
}
/** Нормализация позиций (2846): `pos` → 1..n внутри `wing|floor|band` (tie-break по `lx`). */
export function gNormPos(units: Unit[]): Unit[] {
  const gp: Record<string, Unit[]> = {};
  units.filter((u) => !u.vl).forEach((u) => { const k = wingOf(u) + "|" + u.floor + "|" + bandOf(u); (gp[k] = gp[k] || []).push(u); });
  const np = new Map<number, number>();
  Object.values(gp).forEach((list) => { list.slice().sort((a, b) => posOf(a) - posOf(b) || (+(a.lx || 0)) - (+(b.lx || 0))).forEach((u, i) => np.set(u.uid, i + 1)); });
  return units.map((u) => (np.has(u.uid) && np.get(u.uid) !== u.pos ? { ...u, pos: np.get(u.uid)! } : u));
}
/** Нужна ли нормализация (2853): разброс `pos` > 40 — легаси px-координаты. */
export function needsNormPos(units: Unit[]): boolean {
  const g = units.filter((u) => !u.vl);
  if (!g.length) return false;
  let mn = Infinity, mx = -Infinity;
  g.forEach((u) => { const q = posOf(u); if (q < mn) mn = q; if (q > mx) mx = q; });
  return isFinite(mn) && mx - mn > 40;
}
/** + Вилла (2898): номер = max числовой номер вилл + 1. */
export function gAddVilla(units: Unit[]): Unit[] {
  let mx = 0;
  units.forEach((u) => { const m = String(u.num).match(/\d+/); if (u.vl && m) mx = Math.max(mx, +m[0]); });
  return [...units, { uid: maxUid(units), num: String(mx + 1), vl: true, floor: 0, pos: units.length + 1, band: "out", type: "", area: 0, la: 0, price: 0, status: "free", tag: null, feats: [] }];
}
/** Переименование корпуса (3566): `wing` у всех юнитов корпуса. */
export function gRenameWing(units: Unit[], from: string, to: string): Unit[] {
  return units.map((u) => (wingOf(u) === from ? { ...u, wing: to } : u));
}

// ---- мастер «Создать планировки» (§5.6; 2615–2685) ----
export type MkKind = "apt" | "com" | "villa";
/** `band` — ряд на этаже (наружу / двор), если в прайсе этаж разбит на OUTSIDE / INSIDE; по умолчанию «наружу». */
export type MkRow = { num: string; floor: number; type: string; area: number; price: number; status: UnitStatus; band?: Band; tag?: "duplex" | "tduplex" | "triplex" };
/** «3+1duplex», «2+1 Dubleks», «4+1 триплекс» → чистая комнатность + тег многоуровневой квартиры. */
export function splitTypeTag(raw: string): { type: string; tag?: MkRow["tag"] } {
  const t = String(raw || "").trim();
  const tag = /tr[iı]pleks|triplex|триплекс/i.test(t) ? "triplex" as const : /ters\s*dubleks|reverse\s*duplex|терс/i.test(t) ? "tduplex" as const : /dubleks|dublex|duplex|дуплекс|двухуров/i.test(t) ? "duplex" as const : undefined;
  if (!tag) return { type: t };
  const m = t.match(/\d+(?:[.,]5)?\s*\+\s*\d+/);
  return { type: m ? m[0].replace(/\s/g, "").replace(",", ".") : t.replace(/ters\s*dubleks|reverse\s*duplex|tr[iı]pleks|triplex|dubleks|dublex|duplex|триплекс|дуплекс|терс[а-я-]*|двухуров[а-я]*/gi, "").replace(/[\s()/-]+$/g, "").trim(), tag };
}
/**
 * Разбор вставленного прайса (`mkParse` 2615), доработано: колонки распознаются по всей таблице —
 * по заголовку (№ / Этаж / Комнат / м² / Цена / Статус на RU/EN/TR) или по содержимому (этаж = повторяющиеся
 * маленькие целые, № = уникальные значения, площадь = 20…600, цена > 5000). Номер может быть текстом («Sosyal Alan»).
 */
const STATUS_OF = (t: string): UnitStatus | null => {
  const tl = t.toLowerCase();
  if (/не прода|not for sale|satışta değil|satista degil|служеб|^na$/.test(tl)) return "na";
  if (/прода|sold|satıl|satil/.test(tl)) return "sold";
  if (/брон|book|rezerv|reserv/.test(tl)) return "booked";
  if (/оформ|process|işlem|islem/.test(tl)) return "process";
  if (/резерв|reserve$/.test(tl)) return "reserve";
  if (/свобод|free|müsait|musait|avail/.test(tl)) return "free";
  return null;
};
const isType = (t: string) => /^\d+(\.5)?\+\d+$/.test(t) || t === "1*" || /^\d+\s*\+\s*\d+$/.test(t);
/** Тип из ячейки: «2 + 1» → «2+1», «Sosyal Alan»/«Otopark»/«Teknik»/«Ticari» → спец-тип, иначе `null`. */
const mkType = (t: string): string | null => (isType(t) ? t.replace(/\s/g, "") : specialTypeOf(t));
const numOf = (t: string) => { const n = parseFloat(t.replace(/\s/g, "").replace(/[^\d.,-]/g, "").replace(",", ".")); return isNaN(n) ? null : n; };
/** Floor label → number: Z/Zemin/G/Цоколь → 0, B1/-1/Bodrum → −1, «3. Kat» → 3. */
export function floorOf(t: string): number | null {
  const x = String(t || "").trim();
  if (!x) return null;
  if (/^(z|zemin(\s*kat[ıi]?)?|g|ground(\s*floor)?|цоколь(ный)?(\s*этаж)?|ц|0|0\.\s*kat)$/i.test(x)) return 0;
  const pre = x.match(/^(?:kat|floor|этаж)\s*[-:]?\s*(\d{1,2})$/i); if (pre) return parseInt(pre[1], 10); // «Floor 3», «Kat 3»
  const b = x.match(/^(?:b|bodrum\s*|-)(\d*)$/i); if (b) return -(parseInt(b[1] || "1", 10));
  const k = x.match(/^(\d{1,2})\s*(?:\.|-?(?:st|nd|rd|th|й|ый|ий|ой))?\s*(kat[ıi]?|эт\.?|этаж|fl\.?|floor)?$/i); if (k) return parseInt(k[1], 10); // «1 Floor», «2nd floor», «3-й этаж»
  return null;
}
const HEADER: [RegExp, keyof MkRow][] = [
  [/^(№|no\.?|номер|daire|daire ?no|unit|apt|кв\.?|квартира)$/i, "num"],
  [/^(этаж|floor|kat|эт\.?)$/i, "floor"],
  [/^(тип|type|комнат[а-я]*|rooms?|oda|планировка)$/i, "type"],
  [/^(площадь.*|area|alan|m2|м2|м²|m²|brüt|brut|net)$/i, "area"],
  [/^(цена.*|price|fiyat|стоимость.*|€|eur|usd|\$)$/i, "price"],
  [/^(статус|status|durum)$/i, "status"],
];
export function mkParse(text: string): MkRow[] {
  const lines = (text || "").split(/\n+/).map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return [];
  const tabs = lines.filter((l) => l.includes("\t")).length > lines.length / 2;
  const split = (ln: string) => {
    if (tabs) { const tk = ln.split("\t").map((t) => t.trim()); while (tk.length && !tk[tk.length - 1]) tk.pop(); return tk; }
    let tk = ln.split(/[;]+|\s{2,}/).map((t) => t.trim()).filter(Boolean); if (tk.length < 3) tk = ln.split(/\s+/); return tk;
  };
  let rows = lines.map(split).filter((r) => r.some(Boolean));
  // 1) header row → explicit mapping
  let map: Partial<Record<keyof MkRow, number>> | null = null;
  const hdr = rows[0].map((t) => HEADER.find(([re]) => re.test(t.trim()))?.[1] ?? null);
  if (hdr.filter(Boolean).length >= 2) {
    map = {};
    hdr.forEach((k, i) => { if (k && map![k] === undefined) map![k] = i; });
    rows = rows.slice(1);
  }
  // 2) no header → classify columns by content of the "typical" rows (most common token count)
  const width = rows.map((r) => r.length).sort((a, b) => rows.filter((x) => x.length === a).length - rows.filter((x) => x.length === b).length).pop() ?? 0;
  const typical = rows.filter((r) => r.length === width);
  if (!map && typical.length >= 2 && width >= 3) {
    map = {};
    const col = (i: number) => typical.map((r) => r[i]);
    const share = (i: number, f: (t: string) => boolean) => col(i).filter(f).length / typical.length;
    const free = new Set<number>(Array.from({ length: width }, (_, i) => i));
    const take = (k: keyof MkRow, i: number | undefined) => { if (i !== undefined) { map![k] = i; free.delete(i); } };
    const best = (f: (i: number) => number, min = 0.6) => { let bi: number | undefined, bv = min; free.forEach((i) => { const v = f(i); if (v > bv) { bv = v; bi = i; } }); return bi; };
    take("type", best((i) => share(i, (t) => mkType(t) !== null)));
    take("status", best((i) => share(i, (t) => STATUS_OF(t) !== null)));
    take("price", best((i) => share(i, (t) => (numOf(t) ?? 0) > 5000)));
    const numeric = (i: number) => share(i, (t) => numOf(t) !== null);
    const uniq = (i: number) => new Set(col(i)).size / typical.length;
    const maxv = (i: number) => Math.max(...col(i).map((t) => numOf(t) ?? 0));
    const ints = (i: number) => share(i, (t) => { const n = numOf(t); return n !== null && Number.isInteger(n); });
    // floor: numeric, small integers, repeating
    const floors = (i: number) => share(i, (t) => floorOf(t) !== null);
    const distinct = (i: number) => new Set(col(i)).size;
    // floor: small integers (labels like Z/B1 allowed), the column with the fewest distinct values / smallest max
    take("floor", best((i) => (floors(i) > 0.9 && ints(i) > 0.8 && maxv(i) <= 60 ? 1 + (typical.length - distinct(i)) / typical.length + (60 - maxv(i)) / 1000 : 0), 1.0));
    // number: the most unique remaining column (text allowed)
    take("num", best((i) => (uniq(i) >= 0.8 ? uniq(i) + numeric(i) / 10 : 0), 0.5));
    // area: remaining numeric column in 20…600
    take("area", best((i) => share(i, (t) => { const n = numOf(t); return n !== null && n >= 20 && n <= 600; }), 0.5));
  }
  const out: MkRow[] = [];
  rows.forEach((tk) => {
    let num: string | null = null, floor: number | null = null, type: string | null = null, area: number | null = null, price: number | null = null;
    let status: UnitStatus | null = null;
    const used = new Set<number>();
    if (map && (tk.length === width || (tabs && tk.length <= width && tk.length > Math.max(map.num ?? 0, map.floor ?? 0)))) {
      const g = (k: keyof MkRow) => { const i = map![k]; if (i === undefined || tk[i] === undefined) return null; used.add(i); return tk[i]; };
      const tN = g("num"); if (tN) num = tN;
      const tF = g("floor"); const nF = tF ? floorOf(tF) : null; if (nF !== null) floor = nF;
      const tT = g("type"); const nT = tT ? mkType(tT) : null; if (nT) type = nT;
      const tA = g("area"); const nA = tA ? numOf(tA) : null; if (nA !== null) area = nA;
      const tP = g("price"); const nP = tP ? numOf(tP) : null; if (nP !== null) price = Math.round(nP);
      const tS = g("status"); if (tS) status = STATUS_OF(tS);
    }
    // per-token fallback (prototype heuristics) for the rest of the row / rows of another shape
    const floorFirst = map ? (map.floor ?? 99) < (map.num ?? 99) : false;
    tk.forEach((t, i) => {
      if (used.has(i)) return;
      if (type === null && isType(t)) { type = t.replace(/\s/g, ""); return; }
      const st = STATUS_OF(t); if (st) { status = status ?? st; return; }
      if (floorFirst && floor === null && floorOf(t) !== null) { floor = floorOf(t)!; return; }
      const n = numOf(t);
      if (n === null) { if (num === null && /[A-Za-zА-Яа-яİıŞşĞğÜüÖöÇç]/.test(t)) num = t; else if (type === null) type = specialTypeOf(t); return; }
      if (num === null) { num = t.replace(/[^\d*A-Za-z-]/g, "") || String(n); return; }
      if (n > 5000) { price = Math.round(n); return; }
      if (floor === null && Number.isInteger(n) && n < 60) { floor = n; return; }
      if (area === null && n >= 20 && n <= 600) { area = n; return; }
    });
    if (num !== null) out.push({ num, floor: floor == null ? 1 : floor, type: type || "", area: area || 0, price: price || 0, status: status ?? (type && isSpecialType(type) ? "na" : "free") });
  });
  return out;
}
export type MkGenOpts = { kind: MkKind; floors: number | string; per: number | string; perFloor: Record<number, string | number>; villas: number | string };
/** Генерация пустой сетки (`mkGen` 2639). */
export function mkGen(o: MkGenOpts): MkRow[] {
  if (o.kind === "villa") {
    const N = Math.max(1, Math.min(200, +o.villas || 1));
    const out: MkRow[] = [];
    for (let n = 1; n <= N; n++) out.push({ num: "V" + n, floor: 0, type: "", area: 0, price: 0, status: "free" });
    return out;
  }
  const F = Math.max(1, Math.min(40, +o.floors || 1)), P = Math.max(1, Math.min(20, +o.per || 1));
  const out: MkRow[] = [];
  let n = 1;
  for (let f = 0; f < F; f++) {
    const ov = o.perFloor ? o.perFloor[f] : null;
    const pf = Math.max(0, Math.min(20, ov != null && ov !== "" ? +ov : P));
    for (let i = 0; i < pf; i++) out.push({ num: String(n++), floor: f, type: "", area: 0, price: 0, status: "free" });
  }
  return out;
}
/** Следующая свободная буква корпуса (2655): нет корпусов — «B» (существующие получат «A»). */
export function nextBlockWing(units: Unit[]): string {
  const apt = units.filter((u) => !u.vl);
  if (!apt.length) return "";
  const used = new Set(apt.map((u) => (u.wing || "").toUpperCase()).filter(Boolean));
  if (used.size === 0) return "B";
  for (const ch of "ABCDEFGHIJKLMNOPQRSTUVWXYZ") if (!used.has(ch)) return ch;
  return "";
}
export type MkProjectFlags = { mega?: boolean; akro?: boolean; diamond?: boolean; rich?: boolean; villas?: boolean; mixed?: boolean; genGrid?: boolean };
/** Применение мастера (`mkApply` 2656–2685): новые юниты + патч флагов объекта + id новых плиток. */
export function mkApply(units: Unit[], proj: MkProjectFlags, list: MkRow[], kind: MkKind, wingRaw: string, replace: boolean, editAfter: boolean): { units: Unit[]; patch: MkProjectFlags; newIds: number[] } | null {
  if (!list.length) return null;
  const wing = (wingRaw || "").trim();
  // Rows whose № matches an existing unit of the SAME block update that unit — type / m² / price / status — and keep
  // its structure (floor, position, row, width, duplex/triplex tags, features). A new/empty block gets fresh units.
  const key = (n: string | number) => String(n ?? "").trim().toLowerCase();
  const pool = kind === "villa" ? [] : units.filter((u) => !u.vl && (wing ? wingOf(u) === wing : !u.wing));
  const byNum = new Map<string, Unit>();
  pool.forEach((u) => { const k = key(u.num); if (k && !byNum.has(k)) byNum.set(k, u); });
  const updated = new Map<number, Unit>();
  const fresh: MkRow[] = [];
  list.forEach((r) => {
    const m = kind === "villa" ? undefined : byNum.get(key(r.num));
    if (!m || updated.has(m.uid)) { fresh.push(r); return; }
    updated.set(m.uid, { ...m, type: r.type || m.type, area: r.area || m.area, price: r.price > 0 ? r.price : m.price, status: specialStatus(r.type || m.type, r.status) });
  });
  let old = replace ? units.filter((u) => updated.has(u.uid)) : units.slice();
  old = old.map((u) => updated.get(u.uid) ?? u);
  if (wing && !replace && kind !== "villa") { const anyW = old.some((u) => !u.vl && u.wing); if (!anyW) old = old.map((u) => (u.vl ? u : { ...u, wing: "A" })); }
  const patch: MkProjectFlags = {};
  if (replace && !updated.size) { patch.mega = undefined; patch.akro = undefined; patch.diamond = undefined; patch.rich = undefined; patch.villas = undefined; patch.mixed = undefined; patch.genGrid = !!editAfter; }
  if (kind === "villa") { if (proj.villas === true && !replace) { /* чисто вилловый остаётся вилловым */ } else if (old.some((u) => !u.vl)) patch.mixed = true; else if (replace || !old.length) patch.villas = true; }
  else if (old.some((u) => u.vl)) patch.mixed = true;
  let uid = old.reduce((m, u) => Math.max(m, +u.uid || 0), 20000) + 1;
  const posc: Record<string, number> = {};
  old.forEach((u) => { const k = wingOf(u) + "|" + u.floor; posc[k] = Math.max(posc[k] || 0, posOf(u)); });
  const added: Unit[] = fresh.map((u) => {
    const f = +u.floor || 0, k = (wing || "") + "|" + f + (u.band === "ins" ? "|ins" : ""); // у внутреннего ряда своя нумерация позиций
    posc[k] = (posc[k] || 0) + 1;
    return { uid: uid++, num: u.num, numManual: /^\d+$/.test(String(u.num)) ? undefined : true, floor: f, pos: posc[k], band: (u.band ?? "out") as Band, wing: wing || undefined, vl: kind === "villa" || undefined, gen: kind !== "villa" || undefined, type: kind === "com" ? "1*" : u.type, area: u.area, price: u.price, status: specialStatus(kind === "com" ? "1*" : u.type, u.status), tag: u.tag ?? null, feats: [] };
  });
  return { units: old.concat(added), patch, newIds: added.length ? added.map((u) => u.uid) : Array.from(updated.keys()) };
}
