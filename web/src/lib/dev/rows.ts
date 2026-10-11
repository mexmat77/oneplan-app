// Легаси-сетки прототипа из `rows.json` (Megapolis id 8, Akropolis id 10) → юниты (порт `rowsToUnits`/`megaUnits`/`akroUnits`,
// прототип 2510–2600). Формат строки: `{b:'A', f:'7'|'GO'|'GI', cells:[[num, lx, lw, type, area, price, free(0/1), tags('T','D','K')]]}`;
// `f:'GI'` → `band:'ins'`, `floor:0`; `lx` кластеризуется в `pos` с порогом 55px внутри корпуса.
import { asset } from "./data";
import type { Project, Unit, UnitTag } from "./types";

export type RowsCell = [string | number, number, number, string, number, number, number, string?];
export type RowsJson = { b: string; f: string; cells: RowsCell[] }[];

export function rowsToUnits(rows: RowsJson, base: number): Unit[] {
  const out: Unit[] = [];
  let i = 0;
  rows.forEach((r) => {
    r.cells.forEach((c) => {
      const [num, lx, lw, type, area, price, free] = c;
      const tg = c[7] || "";
      const tag: UnitTag = tg.indexOf("D") > -1 ? "duplex" : tg.indexOf("T") > -1 ? "terrace" : tg.indexOf("K") > -1 ? "kapici" : null;
      out.push({ uid: base + i++, num, floor: /^\d+$/.test(r.f) ? +r.f : 0, pos: lx, band: r.f === "GI" ? "ins" : "out", wing: r.b, lx, lw, type, area, price, status: free ? "free" : "sold", tag, feats: [] });
    });
  });
  // единый механизм: кластеризуем lx в индексы колонок (pos) по каждому крылу
  [...new Set(out.map((u) => u.wing))].forEach((w) => {
    const wu = out.filter((u) => u.wing === w);
    const colsX: number[] = [];
    [...wu].sort((a, b) => (a.lx || 0) - (b.lx || 0)).forEach((u) => { if (!colsX.some((x) => Math.abs(x - (u.lx || 0)) < 55)) colsX.push(u.lx || 0); });
    wu.forEach((u) => { let bi = 0, bd = 1e9; colsX.forEach((x, ci) => { const d = Math.abs(x - (u.lx || 0)); if (d < bd) { bd = d; bi = ci; } }); u.pos = bi; });
  });
  return out;
}

/** MEGAPOLIS: сетка A/B из rows.json + 12 дюкканов (TİCARİ, корпус `T`) из отдельного прайса (2589). */
export function megaUnits(rows: RowsJson): Unit[] {
  const TC: [number, number, "TC1" | "TC2", number][] = [[1, 485, "TC1", 0], [2, 451, "TC1", 0], [3, 434, "TC1", 0], [4, 421, "TC1", 0], [5, 413, "TC1", 1280300], [6, 419, "TC1", 1298900], [7, 308, "TC2", 954800], [8, 300, "TC2", 930000], [9, 300, "TC2", 0], [10, 300, "TC2", 0], [11, 300, "TC2", 0], [12, 307, "TC2", 0]];
  const out = rowsToUnits(rows, 3000);
  let t1 = 0, t2 = 0;
  TC.forEach((c) => {
    const inRow = c[2] === "TC1" ? t1++ : t2++;
    const pos = c[2] === "TC1" ? inRow : 6 + inRow;
    out.push({ uid: 3900 + c[0], num: c[0], floor: 0, pos, band: "out", wing: "T", lx: pos * 235, lw: 225, type: "1*", area: c[1], price: c[3], status: c[3] ? "free" : "sold", tag: null, feats: [] });
  });
  return out;
}
export const akroUnits = (rows: RowsJson): Unit[] => rowsToUnits(rows, 5000);

export type LegacyKind = "mega" | "akro";
export const legacyKindOf = (p: Project | undefined): LegacyKind | null => (p?.mega ? "mega" : p?.akro ? "akro" : null);
const URLS: Record<LegacyKind, string> = { mega: asset("megapolis-data/rows.json"), akro: asset("akropolis-data/rows.json") };
const cache: Partial<Record<LegacyKind, Promise<Unit[]>>> = {};
/** Загружает rows.json один раз за сессию и строит юниты. */
export function loadLegacyUnits(kind: LegacyKind): Promise<Unit[]> {
  if (!cache[kind]) {
    cache[kind] = fetch(URLS[kind]).then((r) => r.json()).then((rows: RowsJson) => (kind === "mega" ? megaUnits(rows) : akroUnits(rows))).catch((e) => { console.error("rows.json", kind, e); delete cache[kind]; return []; });
  }
  return cache[kind]!;
}
