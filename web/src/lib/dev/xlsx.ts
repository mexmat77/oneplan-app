// Экспорт / импорт помещений — прототип `OnePlan v2.dc.html` 3032–3083, 4004; спецификация §5.1.
// Excel через SheetJS (`xlsx`), CSV — свой парсер с автоопределением разделителя, PDF — скрытый iframe + print().
import * as XLSX from "xlsx";
import ru from "@/i18n/dev/ru.json";
import en from "@/i18n/dev/en.json";
import tr from "@/i18n/dev/tr.json";
import { STORDER, fLbl, specialTypeOf, typeLabel } from "./data";
import type { Cur, Project, Unit, UnitStatus } from "./types";

/** Подмножество словаря, которое нужно экспорту (заголовки берутся из i18n текущего языка). */
export type ExportDict = {
  f_block: string; scheme_floor: string; f_rooms: string; f_price: string; f_status: string; plans_title: string;
  villa_word: string; rooms_commercial: string; type_sosyal: string; type_otopark: string; type_teknik: string; status: Record<string, string>;
};

export type ExportRow = { id: number; blok: string; floor: string; num: string | number; type: string; area: number | string; price: number | string; status: string };

/** Строки экспорта (`exportExcel`, 4004): сортировка этаж desc, pos asc; `1*`/спец-типы → подписи; цена пуста для sold/na и без цены. */
export function buildExportRows(units: Unit[], obj: Project, L: ExportDict): ExportRow[] {
  return units
    .slice()
    .sort((a, b) => (b.floor - a.floor) || ((+a.pos || 0) - (+b.pos || 0)))
    .map((u) => ({
      id: u.uid,
      blok: (u.wing || u.blok) ? String(u.wing || u.blok) : "",
      floor: (obj.villas || u.vl) ? L.villa_word : fLbl(u.floor, obj.fScheme || "tr"),
      num: u.num,
      type: typeLabel(u.type, L),
      area: u.area || "",
      price: (u.status === "sold" || u.status === "na" || !u.price) ? "" : u.price,
      status: L.status[u.status] || u.status || "",
    }));
}

/** `downloadXls` (3053–3062): лист = plans_title (≤28 симв.), файл = имя объекта с заменой не-алфавитных на `_`. */
export function downloadXls(rows: ExportRow[], obj: Project, L: ExportDict, cur: Cur) {
  const heads = ["ID", L.f_block, L.scheme_floor, "№", L.f_rooms, "м²", `${L.f_price} (${cur})`, L.f_status];
  const aoa: (string | number)[][] = [heads, ...rows.map((r) => [r.id, r.blok, r.floor, r.num, r.type, r.area, r.price, r.status])];
  const fname = String(obj.name || "planirovki").replace(/[^0-9A-Za-zЀ-ӿ]+/g, "_");
  try {
    const ws = XLSX.utils.aoa_to_sheet(aoa);
    ws["!cols"] = [{ wch: 7 }, { wch: 9 }, { wch: 9 }, { wch: 8 }, { wch: 13 }, { wch: 8 }, { wch: 17 }, { wch: 14 }];
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, (L.plans_title || "Units").slice(0, 28));
    XLSX.writeFile(wb, `${fname}.xlsx`);
    return;
  } catch {}
  // Фоллбэк без SheetJS — CSV с `;`, BOM, кавычки по RFC.
  const esc = (v: unknown) => { const s = v == null ? "" : String(v); return /[",;\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; };
  const csv = aoa.map((r) => r.map(esc).join(";")).join("\n");
  const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = `${fname}.csv`;
  document.body.appendChild(a); a.click();
  setTimeout(() => { a.remove(); URL.revokeObjectURL(url); }, 1200);
}

/** `parseCsv` (3063): разделитель `;` или `,` по первой строке, кавычки с удвоением. */
export function parseCsv(txt: string): string[][] {
  const text = String(txt).replace(/^﻿/, "");
  const lines = text.split(/\r?\n/).filter((l) => l.trim() !== "");
  if (!lines.length) return [];
  const d = lines[0].split(";").length >= lines[0].split(",").length ? ";" : ",";
  return lines.map((line) => {
    const out: string[] = [];
    let cur = "", q = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (q) {
        if (c === '"') { if (line[i + 1] === '"') { cur += '"'; i++; } else q = false; } else cur += c;
      } else if (c === '"') q = true;
      else if (c === d) { out.push(cur); cur = ""; }
      else cur += c;
    }
    out.push(cur);
    return out.map((x) => String(x).trim());
  });
}

const nm = (x: unknown) => String(x == null ? "" : x).toLowerCase().replace(/[^0-9a-zа-яё]/gi, "");

/** `statusReverse` (3065): все метки статусов RU/EN/TR и сами ключи → ключ статуса. */
export function statusReverse(): Record<string, UnitStatus> {
  const map: Record<string, UnitStatus> = {};
  for (const dict of [ru, en, tr] as { status?: Record<string, string> }[]) {
    const st = dict.status || {};
    for (const k of Object.keys(st)) map[nm(st[k])] = k as UnitStatus;
  }
  for (const k of STORDER) map[nm(k)] = k;
  return map;
}

export type ImportChange = { f: "price" | "status" | "area" | "type"; from: number | string; to: number | string };
export type ImportRow = { uid: number; num: string | number; ch: ImportChange[] };

/** Чтение файла импорта (`impPick`, 3066): xlsx/xls через SheetJS (первый лист, header:1), иначе CSV. `null` — не прочитан. */
export function readImportFile(file: File): Promise<unknown[][] | null> {
  const isX = /\.xlsx?$/i.test(file.name);
  return new Promise((resolve) => {
    const rd = new FileReader();
    rd.onerror = () => resolve(null);
    rd.onload = () => {
      try {
        if (isX) {
          const wb = XLSX.read(rd.result as ArrayBuffer, { type: "array" });
          const ws = wb.Sheets[wb.SheetNames[0]];
          resolve(XLSX.utils.sheet_to_json(ws, { header: 1, raw: true, blankrows: false }) as unknown[][]);
        } else resolve(parseCsv(String(rd.result)));
      } catch { resolve(null); }
    };
    if (isX) rd.readAsArrayBuffer(file); else rd.readAsText(file, "utf-8");
  });
}

/**
 * `impBuild` (3067–3082): колонки по нормализованным заголовкам (дефолты num=2, area=4, price=5, status=7),
 * сопоставление по `ID` → `uid`, затем по `num`; изменения price / status / area (>0.049).
 * Возвращает `null`, если строк меньше двух (ошибка чтения).
 */
/** «2 + 1» → «2+1»; «Коммерция»/«commercial»/«ticari»/«дюккан» → «1*»; «Соц. зона»/«Otopark»/«Техническое» → спец-тип. */
export function normType(v: string): string {
  const t = String(v || "").trim();
  if (!t) return "";
  const sp = specialTypeOf(t); if (sp) return sp;
  const m = t.replace(/\s+/g, "").match(/^(\d+(?:[.,]5)?)\+(\d+)$/);
  return m ? `${m[1].replace(",", ".")}+${m[2]}` : "";
}
export function impBuild(aoa: unknown[][] | null, units: Unit[]): ImportRow[] | null {
  if (!aoa || aoa.length < 2) return null;
  const head = (aoa[0] || []).map(nm);
  const find = (c: string[]) => { for (let i = 0; i < head.length; i++) if (c.some((k) => k && head[i].indexOf(k) > -1)) return i; return -1; };
  let cId = -1;
  for (let i = 0; i < head.length; i++) if (head[i] === "id") { cId = i; break; }
  let cNum = find(["num", "номер", "daireno"]);
  if (cNum < 0) { const j = (aoa[0] || []).findIndex((x) => String(x).trim() === "№" || /^no\.?$/i.test(String(x).trim())); if (j > -1) cNum = j; }
  let cPrice = find(["цена", "price", "fiyat", "стоим", "maliyet"]);
  let cStat = find(["статус", "status", "durum"]);
  let cArea = find(["area", "alan", "m2", "площад"]);
  let cType = find(["комнат", "rooms", "oda", "тип", "type", "daire tipi", "планиров"]);
  if (cArea < 0) for (let i = 0; i < head.length; i++) if (head[i] === "м" || head[i] === "м2") { cArea = i; break; }
  // defaults follow our own export layout: ID · Корпус · Этаж · № · Комнаты · м² · Цена · Статус
  if (cNum < 0) cNum = 3; if (cType < 0) cType = 4; if (cArea < 0) cArea = 5; if (cPrice < 0) cPrice = 6; if (cStat < 0) cStat = 7;
  const rev = statusReverse();
  const rows: ImportRow[] = [];
  const cell = (row: unknown[], i: number) => String(row[i] != null ? row[i] : "").trim();
  for (let r = 1; r < aoa.length; r++) {
    const row = aoa[r];
    if (!row) continue;
    let u: Unit | undefined;
    if (cId > -1) { const idv = cell(row, cId); if (idv) u = units.find((x) => String(x.uid) === idv); }
    if (!u) { const num = cell(row, cNum); if (num) u = units.find((x) => String(x.num).trim() === num); }
    if (!u) continue;
    const ch: ImportChange[] = [];
    const pv = cell(row, cPrice).replace(/[^0-9.,-]/g, "").replace(/\s/g, "").replace(",", ".");
    if (pv !== "") { const np = Math.round(+pv); if (!isNaN(np) && np !== (u.price || 0)) ch.push({ f: "price", from: u.price || 0, to: np }); }
    const sr = cell(row, cStat);
    if (sr) { const sk = rev[nm(sr)]; if (sk && sk !== u.status) ch.push({ f: "status", from: u.status, to: sk }); }
    const av = cell(row, cArea).replace(/[^0-9.,-]/g, "").replace(",", ".");
    if (av !== "") { const na = parseFloat(av); if (!isNaN(na) && na > 0 && Math.abs(na - (u.area || 0)) > 0.049) ch.push({ f: "area", from: u.area || 0, to: na }); }
    const tv = normType(cell(row, cType));
    if (tv && tv !== (u.type || "")) ch.push({ f: "type", from: u.type || "", to: tv });
    if (ch.length) rows.push({ uid: u.uid, num: u.num, ch });
  }
  return rows;
}

/**
 * `exportPdf` (3032–3052): собирает `[data-board="1"]` (или `[data-print-list="1"]` / `[data-print-fp="1"]`)
 * + легенду `[data-legend="1"]` в скрытый iframe, A3 landscape, масштаб min(1, 1440/width), print().
 * Вызывается с вкладки «Планировки» (там живёт DOM шахматки).
 */
export function exportPdf(obj: Project, scheme: "board" | "list" | "floor" = "board") {
  let boards = Array.from(document.querySelectorAll<HTMLElement>('[data-board="1"]'));
  const listN = document.querySelector<HTMLElement>('[data-print-list="1"]');
  const fpN = document.querySelector<HTMLElement>('[data-print-fp="1"]');
  if (scheme === "list" && listN) boards = [listN];
  else if (scheme === "floor" && fpN) boards = [fpN];
  if (!boards.length && listN) boards = [listN];
  if (!boards.length && fpN) boards = [fpN];
  if (!boards.length) return;
  const w = Math.max(...boards.map((n) => n.scrollWidth), 600);
  const scale = Math.min(1, 1440 / w);
  const blocks = boards.map((n) => n.outerHTML).join("");
  const lg = document.querySelector<HTMLElement>('[data-legend="1"]');
  const f = document.createElement("iframe");
  f.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0";
  document.body.appendChild(f);
  const d = f.contentDocument;
  if (!d) return;
  d.open();
  d.write(
    `<!DOCTYPE html><html><head><title>${obj.name || "OnePlan"}</title>${Array.from(document.querySelectorAll('link[rel="stylesheet"],style')).map((n) => n.outerHTML).join("")}<style>@page{size:A3 landscape;margin:10mm}body{font-family:-apple-system,system-ui,sans-serif;color:#1b2942;margin:0;padding:4px}*{box-sizing:border-box}i{display:none!important}[data-board],[data-legend]{overflow:visible!important;position:static!important;max-width:none!important;box-shadow:none!important}</style></head><body><div style="font-size:20px;font-weight:800">${obj.name || ""}</div><div style="font-size:11px;color:#6b7688;margin:2px 0 10px">${obj.loc || ""} · ${new Date().toLocaleDateString()} · OnePlan</div><div style="transform:scale(${scale});transform-origin:top left;width:${w}px">${lg ? lg.outerHTML + '<div style="height:14px"></div>' : ""}${blocks}</div></body></html>`,
  );
  d.close();
  setTimeout(() => { try { f.contentWindow?.focus(); f.contentWindow?.print(); } catch {} setTimeout(() => f.remove(), 3000); }, 400);
}
