// Мастер «Объект из файлов»: разбор прайса по блокам и раскладка листов планов по этажам (чистая логика, без React).
//   priceFromAoa(aoa)   — таблица из Excel/CSV → блоки с помещениями (`mkParse` по каждому блоку; колонка «Блок/Blok/Корпус» по заголовку)
//   priceFromText(text) — вставленный текст → один блок
//   resolveFloors(...)  — «типовой этаж» → все этажи блока, не занятые другими листами; цоколь → 0; подвал → −1
import { mkParse, specialStatus, splitTypeTag, type MkRow } from "./grid";

export type PriceBlock = { wing: string; rows: MkRow[] };
export type Price = { blocks: PriceBlock[]; total: number };

const BLOCK_HDR = /^(blok|block|блок|корпус|bina|building|секция)\.?$/i;
const fixTag = (r: MkRow): MkRow => { if (r.tag || !r.type) return r; const tt = splitTypeTag(r.type); return tt.tag ? { ...r, type: tt.type, tag: tt.tag } : r; };
/** «A Blok», «Блок B», «b» → «A» / «B»; пусто → ''. */
export function normBlock(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s) return "";
  const m = s.match(/(?:blok|block|блок|корпус|bina)?\s*[-:]?\s*([A-Za-zА-Яа-я0-9]{1,3})\s*[-.]?\s*(?:blok|block|блок)?$/i);
  return (m ? m[1] : s).toUpperCase();
}
const cell = (v: unknown) => String(v ?? "").replace(/[\t\n\r]+/g, " ").trim();

export function priceFromAoa(aoa: unknown[][] | null): Price {
  const rows = (aoa || []).map((r) => (r || []).map(cell)).filter((r) => r.some(Boolean));
  if (!rows.length) return { blocks: [], total: 0 };
  // строка заголовка — первая из первых пяти, где есть колонка блока
  let hi = -1, bi = -1;
  for (let i = 0; i < Math.min(5, rows.length) && hi < 0; i++) { const j = rows[i].findIndex((c) => BLOCK_HDR.test(c)); if (j >= 0) { hi = i; bi = j; } }
  const toText = (list: string[][]) => list.map((r) => r.join("\t")).join("\n");
  if (bi < 0) { const parsed = mkParse(toText(rows)); return { blocks: parsed.length ? [{ wing: "", rows: parsed }] : [], total: parsed.length }; }
  const head = rows[hi].filter((_, j) => j !== bi);
  const groups = new Map<string, string[][]>();
  let last = "";
  rows.slice(hi + 1).forEach((r) => {
    const w = normBlock(r[bi]) || last; // объединённые ячейки блока: значение только в первой строке
    last = w;
    const rest = r.filter((_, j) => j !== bi);
    if (!rest.some(Boolean)) return;
    groups.set(w, [...(groups.get(w) ?? []), rest]);
  });
  const blocks: PriceBlock[] = [];
  [...groups.keys()].sort().forEach((w) => { const parsed = mkParse(toText([head, ...groups.get(w)!])); if (parsed.length) blocks.push({ wing: w, rows: parsed }); });
  blocks.forEach((b) => { b.rows = b.rows.map(fixTag); });
  // один блок без названия — «без блоков»; несколько, и один пустой — называем его «A»
  if (blocks.length > 1) blocks.forEach((b) => { if (!b.wing) b.wing = "A"; });
  return { blocks, total: blocks.reduce((s, b) => s + b.rows.length, 0) };
}
export function priceFromText(text: string): Price {
  const parsed = mkParse(text);
  return { blocks: parsed.length ? [{ wing: "", rows: parsed }] : [], total: parsed.length };
}
/** Строки, извлечённые ИИ (`extractPrice`), → блоки прайса. */
export function priceFromAi(rows: { block: string; num: string; floor: number; type: string; area: number; price: number; status: MkRow["status"]; band?: MkRow["band"] }[]): Price {
  const groups = new Map<string, MkRow[]>();
  rows.forEach((r) => {
    const w = normBlock(r.block);
    const tt = splitTypeTag(r.type === "commercial" ? "1*" : r.type); // «3+1duplex» → «3+1» + дуплекс
    groups.set(w, [...(groups.get(w) ?? []), { num: r.num, floor: r.floor, type: tt.type, area: r.area, price: r.price, status: specialStatus(tt.type, r.status), ...(r.band ? { band: r.band } : {}), ...(tt.tag ? { tag: tt.tag } : {}) }]);
  });
  const blocks: PriceBlock[] = [...groups.keys()].sort().map((w) => ({ wing: w, rows: groups.get(w)! }));
  if (blocks.length > 1) blocks.forEach((b) => { if (!b.wing) b.wing = "A"; });
  return { blocks, total: rows.length };
}
/** Насколько хорошо разобран прайс локально: доля строк с комнатностью и площадью (спец-помещения не считаем). < 0.6 — лучше отдать ИИ. */
export function priceQuality(p: Price): number {
  const rows = p.blocks.flatMap((b) => b.rows);
  if (rows.length < 2) return 0;
  return rows.filter((r) => !!r.type && (r.area > 0 || /^(sosyal|otopark|teknik)$/.test(r.type))).length / rows.length;
}
/** Блоки, где есть этаж 0 (Z), но нет 1-го — частая ошибка распознавания: первый этаж принят за цокольный. */
/** Буква блока из имени файла прайса: «Oba Forest A blok 24.02.26.pdf» → "A", «Blok B.xlsx» → "B", «Блок В» → "В». */
export function wingFromFileName(name: string): string {
  const base = name.replace(/\.[a-z0-9]+$/i, "");
  const m = base.match(/(?:^|[\s_\-.(])([A-ZА-ЯЁ]|\d{1,2})\s*[-_ ]?\s*(?:blok|block|блок|bl)(?![a-zа-яё])/i)
    ?? base.match(/(?:^|[\s_\-.(])(?:blok|block|блок|bl)\s*[-_ ]?\s*([A-ZА-ЯЁ]|\d{1,2})(?![A-ZА-ЯЁ0-9a-zа-яё])/i);
  return m ? m[1].toUpperCase() : "";
}

export type PricePart = { price: Price; hint: string; name: string };
/** Склейка прайсов из нескольких файлов (обычно файл на блок). Блок без имени получает `hint` — букву из имени файла,
 *  без неё — следующую свободную. Если два файла дали одинаковую букву, а подсказки разные, второй переименовывается по
 *  подсказке; одинаковые блоки (один блок в двух файлах) сливаются. `renamed` — что взято из имён файлов, для подсказки. */
export function mergePrices(parts: PricePart[]): { price: Price; renamed: { from: string; to: string; name: string }[] } {
  if (parts.length === 1) return { price: parts[0].price, renamed: [] };
  const out: PriceBlock[] = []; const renamed: { from: string; to: string; name: string }[] = [];
  const owner = new Map<string, number>();
  const free = () => [..."ABCDEFGHIJKLMNOPQRSTUVWXYZ"].find((c) => !owner.has(c)) ?? String(owner.size + 1);
  parts.forEach(({ price, hint, name }, pi) => {
    price.blocks.forEach((b) => {
      let w = b.wing;
      if (!w) { w = hint && !(owner.has(hint) && owner.get(hint) === pi) ? hint : free(); renamed.push({ from: "", to: w, name }); }
      else if (owner.has(w) && owner.get(w) !== pi && hint && hint !== w && !owner.has(hint)) { renamed.push({ from: w, to: hint, name }); w = hint; }
      const ex = out.find((x) => x.wing === w);
      if (ex) ex.rows = [...ex.rows, ...b.rows]; else { out.push({ wing: w, rows: [...b.rows] }); owner.set(w, pi); }
    });
  });
  out.sort((a, b) => a.wing.localeCompare(b.wing, undefined, { numeric: true }));
  return { price: { blocks: out, total: out.reduce((n, b) => n + b.rows.length, 0) }, renamed };
}

export const groundGapBlocks = (p: Price): string[] => p.blocks.filter((b) => { const fs = new Set(b.rows.map((r) => r.floor)); return fs.has(0) && !fs.has(1) && [...fs].some((f) => f >= 2); }).map((b) => b.wing);
/** Считать этаж Z первым этажом в таких блоках (0 → 1). */
export function groundToFirst(p: Price): Price {
  const gap = new Set(groundGapBlocks(p));
  return { ...p, blocks: p.blocks.map((b) => (gap.has(b.wing) ? { ...b, rows: b.rows.map((r) => (r.floor === 0 ? { ...r, floor: 1 } : r)) } : b)) };
}
export const blockFloors = (b: PriceBlock): number[] => [...new Set(b.rows.map((r) => r.floor))].sort((x, y) => y - x);

/** Что изображено на листе плана (ответ ИИ `classifyPlanPage` или выбор пользователя). */
export type PageKind = "typical" | "ground" | "basement" | "floor" | "attic" | "other";
/** `cuts` — если на листе несколько блоков: границы между ними по X (доли ширины, слева направо, `wings.length − 1` штук);
 * при сборке лист режется на части, и каждый блок получает свою часть — крупнее и без чужих квартир. Пусто — блоки делят весь лист. */
export type PageContent = "apartments" | "parking" | "social" | "technical" | "other";
export type PlanPage = { id: string; name: string; file: File; thumb: string; w: number; h: number; wings: string[]; kind: PageKind; floors: number[]; title: string; busy: boolean; use: boolean; cuts: number[]; /** что нарисовано (от классификатора): паркинг/соцзона кладутся на этаж своей строки прайса */ content?: PageContent };
/** Этаж подвального листа по его заголовку («2. BODRUM» → −2), без заголовка — −1. */
export const basementFloor = (p: Pick<PlanPage, "floors">): number => p.floors.find((f) => f < 0) ?? -1;
/** Границы по умолчанию — поровну. */
export const evenCuts = (n: number): number[] => Array.from({ length: Math.max(0, n - 1) }, (_, i) => (i + 1) / n);
/** Область блока `i` на листе (доли ширины): [x0, x1]. */
export const wingSpan = (p: Pick<PlanPage, "wings" | "cuts">, i: number): [number, number] => {
  const cuts = p.cuts.length === p.wings.length - 1 ? p.cuts : evenCuts(p.wings.length);
  return [i === 0 ? 0 : cuts[i - 1], i === p.wings.length - 1 ? 1 : cuts[i]];
};
/** Куда ляжет лист: по каждому его блоку — список этажей (лист может показывать несколько блоков сразу). */
export type PagePlace = { wing: string; floors: number[] };

/**
 * Этажи каждого листа по каждому его блоку: явные (`floor`) — как указаны; цоколь → 0; подвал → отрицательные этажи блока;
 * «типовой» → этажи блока ≥ 1, не занятые другими листами этого блока. Остальное (мансарда, генплан) — без этажей.
 */
export function resolveFloors(pages: PlanPage[], price: Price): Record<string, PagePlace[]> {
  const out: Record<string, PagePlace[]> = {};
  const floorsOf = (wing: string) => { const b = price.blocks.find((x) => x.wing === wing); return b ? blockFloors(b) : []; };
  const used: Record<string, Set<number>> = {};
  const claim = (p: PlanPage, pick: (wing: string) => number[]) => {
    out[p.id] = p.wings.map((w) => { const fl = pick(w); (used[w] ||= new Set()); fl.forEach((f) => used[w].add(f)); return { wing: w, floors: fl }; }).filter((x) => x.floors.length > 0);
  };
  const act = pages.filter((p) => p.use);
  act.filter((p) => p.kind === "floor").forEach((p) => claim(p, (w) => p.floors.filter((f) => floorsOf(w).includes(f))));
  act.filter((p) => p.kind === "ground").forEach((p) => claim(p, (w) => (floorsOf(w).includes(0) && !(used[w]?.has(0)) ? [0] : [])));
  // подвал — по содержимому листа: соцзона ложится на этаж строки «sosyal» прайса (часто Z, хотя лист подписан «BODRUM»),
  // паркинг — на этаж строки «otopark» или этаж из заголовка («2. BODRUM» → −2); иначе — первый свободный этаж < 0
  const rowFloors = (wing: string, type: string) => { const b = price.blocks.find((x) => x.wing === wing); return b ? [...new Set(b.rows.filter((r) => r.type === type).map((r) => r.floor))] : []; };
  const order = (p: PlanPage) => (p.content === "social" ? 0 : p.content === "parking" ? 1 : 2);
  [...act.filter((p) => p.kind === "basement")].sort((a, b) => order(a) - order(b)).forEach((p) => claim(p, (w) => {
    const free = (fs: number[]) => fs.filter((f) => floorsOf(w).includes(f) && !(used[w]?.has(f)));
    const title = p.floors.filter((f) => f < 0);
    const pick = p.content === "social" ? free(rowFloors(w, "sosyal")) : p.content === "parking" ? free([...title, ...rowFloors(w, "otopark")]) : [];
    if (pick.length) return [pick[0]];
    const fb = free([...title, ...floorsOf(w).filter((f) => f < 0)]);
    return fb.length ? [fb[0]] : [];
  }));
  act.filter((p) => p.kind === "typical").forEach((p) => claim(p, (w) => floorsOf(w).filter((f) => f >= 1 && !(used[w]?.has(f)))));
  // мансарда / верх дуплексов: этаж над дуплексами прайса (тег duplex на этаже F → лист на F+1), если такого этажа нет в прайсе
  const dupUpper = (wing: string) => { const b = price.blocks.find((x) => x.wing === wing); return b ? [...new Set(b.rows.filter((r) => r.tag === "duplex").map((r) => r.floor + 1))].filter((f) => !floorsOf(wing).includes(f)) : []; };
  act.filter((p) => p.kind === "attic").forEach((p) => claim(p, (w) => dupUpper(w).filter((f) => !(used[w]?.has(f)))));
  pages.forEach((p) => { if (!out[p.id]) out[p.id] = []; });
  return out;
}
