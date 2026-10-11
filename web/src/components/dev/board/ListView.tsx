"use client";

// Схема «Список» (732–776): таблица с сортировкой (asc → desc → сброс, sticky-шапка) или карточки `minmax(240px,1fr)`.
//   const list = sortUnits(units, pass, sortKey, sortDir);
//   <ListView objId={id} units={list} variant="table" sortKey={k} sortDir={d} onSort={setSort} onOpenUnit={open} />
// `stickyTop` — отступ липкой шапки таблицы (50 в кабинете, 60 на публичной странице).
// `header` — лента над списком (легенда статусов): липнет на `stickyTop` на фоне страницы, шапка таблицы встаёт под неё.
// `editOn` — режим редактирования как в таблицах (Airtable/Notion): цена и статус правятся прямо в строке (Enter/blur — сохранить,
//   Esc — отменить; запись в журнал), в конце строки карандаш → полная карточка; строки подсвечены, чтобы режим был заметен.
import { IconPencil } from "@tabler/icons-react";
import { Select } from "@/components/ui/Select";
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { fLbl, money, numLabel, typeLabel } from "@/lib/dev/data";
import { CUR_INFO, STORDER } from "@/lib/dev/data";
import type { Unit, UnitStatus } from "@/lib/dev/types";
import { useDevT } from "@/i18n/dev";
import { addLog, mutUnit } from "@/store/dev";
import { perM2, statusChipStyle, useObj } from "./shared";

export type SortKey = "" | "num" | "blok" | "floor" | "type" | "area" | "price" | "pm2" | "status";
const sVal = (u: Unit, k: SortKey): number | string => {
  switch (k) {
    case "num": { const n = parseFloat(String(u.num)); return isNaN(n) ? 1e9 : n; }
    case "blok": return String(u.wing || u.blok || "");
    case "floor": return u.floor;
    case "type": return String(u.type);
    case "area": return u.area || 0;
    case "price": return u.price || 0;
    case "pm2": return u.area ? (u.price || 0) / u.area : 0;
    case "status": return STORDER.indexOf(u.status);
    default: return 0;
  }
};
/** `listU2` (3642): фильтр + сортировка (по умолчанию этаж desc, pos asc). */
export function sortUnits(units: Unit[], pass: (u: Unit) => boolean, sortKey: SortKey, sortDir: 1 | -1): Unit[] {
  return units.filter(pass).sort((a, b) => {
    if (sortKey) { const va = sVal(a, sortKey), vb = sVal(b, sortKey); const c = va > vb ? 1 : va < vb ? -1 : 0; if (c) return c * sortDir; }
    return b.floor - a.floor || a.pos - b.pos;
  });
}
/** Следующее состояние сортировки по клику на колонку (3182). */
export const nextSort = (cur: { key: SortKey; dir: 1 | -1 }, k: SortKey): { key: SortKey; dir: 1 | -1 } =>
  cur.key !== k ? { key: k, dir: 1 } : cur.dir === 1 ? { key: k, dir: -1 } : { key: "", dir: 1 };

export type ListViewProps = { objId: number; units: Unit[]; variant: "table" | "cards"; sortKey: SortKey; sortDir: 1 | -1; onSort: (k: SortKey) => void; onOpenUnit: (uid: number) => void; showPerM2?: boolean; stickyTop?: number; header?: ReactNode; editOn?: boolean };

// Правка из строки списка: запись в журнал + стор (вне компонента — обработчики событий, не рендер).
function commitPrice(objId: number, u: Unit, n: number) { addLog(objId, { ts: Date.now(), uid: u.uid, num: u.num, f: "price", from: u.price, to: n }); mutUnit(objId, u.uid, { price: n }); }
function commitStatus(objId: number, u: Unit, st: UnitStatus) { if (st === u.status) return; addLog(objId, { ts: Date.now(), uid: u.uid, num: u.num, f: "status", from: u.status, to: st }); mutUnit(objId, u.uid, { status: st }); }

/** Цена в строке: черновик живёт только пока поле в фокусе; Enter/blur — сохранить, Esc — отменить. */
function PriceCell({ value, sym, onCommit }: { value: number; sym: string; onCommit: (n: number) => void }) {
  const [draft, setDraft] = useState<string | null>(null);
  const commit = () => { if (draft == null) return; const n = Math.max(0, Math.round(+draft.replace(/[^0-9.]/g, "") || 0)); setDraft(null); if (n !== value) onCommit(n); };
  return (
    <span className="inline-flex items-center gap-[5px]" onClick={(e) => e.stopPropagation()}>
      <input
        inputMode="numeric" data-plain="1"
        value={draft ?? (value ? String(value) : "")}
        placeholder="—"
        onFocus={(e) => { setDraft(value ? String(value) : ""); e.currentTarget.select(); }}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === "Enter") e.currentTarget.blur(); else if (e.key === "Escape") { setDraft(null); requestAnimationFrame(() => (e.target as HTMLInputElement).blur()); } }}
        className="w-[120px] rounded-[8px] border border-[#c9d6f5] bg-surface px-[9px] py-[6px] text-[14px] font-bold text-ink outline-none focus:border-blue focus:shadow-[0_0_0_3px_rgba(77,124,254,.18)]"
      />
      <span className="text-[13px] text-text-2">{sym}</span>
    </span>
  );
}

export function ListView({ objId, units, variant, sortKey, sortDir, onSort, onOpenUnit, showPerM2 = true, stickyTop = 50, header, editOn = false }: ListViewProps) {
  const { t } = useDevT();
  const { obj, colors, cur } = useObj(objId);
  const fScheme = obj?.fScheme || "tr";
  // высота липкой ленты (легенда) → отступ шапки таблицы
  const headRef = useRef<HTMLDivElement>(null);
  const [headH, setHeadH] = useState(0);
  useLayoutEffect(() => {
    const el = headRef.current;
    if (!el) return;
    const measure = () => setHeadH(el.offsetHeight);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [!!header]); // eslint-disable-line react-hooks/exhaustive-deps
  const bar = header ? <div ref={headRef} className="sticky z-[5] bg-bg pb-[10px] pt-[8px]" style={{ top: stickyTop }}>{header}</div> : null;
  const theadTop = stickyTop + (header ? headH : 0);
  const statusSel = (u: Unit) => (
    <Select value={u.status} stopPropagation size="sm" menuWidth="auto" onChange={(v) => commitStatus(objId, u, v as UnitStatus)} className="w-auto rounded-[8px] border-[#c9d6f5] py-[6px] pl-[9px] pr-[6px] text-[13px] font-semibold" style={{ color: u.status === "booked" || u.status === "na" ? "#14243f" : colors[u.status] }}
      options={STORDER.map((k) => ({ value: k, label: <span style={{ color: k === "booked" || k === "na" ? undefined : colors[k] }}>{t.status[k]}</span> }))} />
  );
  const row = (u: Unit) => ({
    floor: obj?.villas || u.vl ? t.villa_word : fLbl(u.floor, fScheme),
    blok: u.wing || u.blok ? String(u.wing || u.blok) : "—",
    type: typeLabel(u.type, t),
    price: u.status === "sold" || u.status === "na" || !u.price ? "—" : money(u.price, cur),
    pm2: u.status === "sold" || u.status === "na" || !u.price || !u.area ? "—" : perM2(u.price, u.area, cur),
    chip: <span style={statusChipStyle(colors[u.status], u.status)}>{t.status[u.status]}</span>,
  });
  if (variant === "cards") {
    return (
      <>
      {bar}
      <div data-print-list="1" className="grid gap-[14px]" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(240px,1fr))" }}>
        {units.map((u) => { const r = row(u); return (
          <div key={u.uid} onClick={() => onOpenUnit(u.uid)} className={`relative cursor-pointer rounded-[14px] border bg-surface p-4 hover:shadow-[0_8px_22px_rgba(20,36,63,.1)] ${editOn ? "border-dashed border-[#9db6f7] hover:border-blue" : "border-line"}`}>
            {editOn && <span className="absolute -right-[7px] -top-[7px] flex h-[24px] w-[24px] items-center justify-center rounded-full bg-blue text-white shadow-[0_2px_6px_rgba(77,124,254,.45)]"><IconPencil size={13} /></span>}
            <div className="mb-2 flex items-center justify-between"><span className="text-[17px] font-extrabold text-ink">{numLabel(u.num, " ")}</span>{r.chip}</div>
            <div className="mb-3 text-[13px] text-text-2">{r.blok} · {r.type} · {t.word_floor} {r.floor}</div>
            <div className="text-[21px] font-extrabold text-ink">{r.price}</div>
            <div className="mt-[6px] flex justify-between text-[12px] text-text-2"><span>{u.area} м²</span>{showPerM2 && <span>{r.pm2}</span>}</div>
          </div>
        ); })}
      </div>
      </>
    );
  }
  const heads: [SortKey, string][] = [["num", t.th_num], ["blok", t.f_block], ["floor", t.th_floor], ["type", t.th_type], ["area", t.th_areaShort], ["price", t.th_price], ["pm2", t.th_pricem2], ["status", t.f_status]];
  const td = "border-b border-line px-[15px] py-[13px] text-[14px]";
  return (
    <>
    {bar}
    <div data-print-list="1" className={`rounded-[14px] border bg-surface ${editOn ? "border-[#9db6f7] shadow-[0_0_0_3px_rgba(77,124,254,.12)]" : "border-line"}`}>
      <table className="w-full min-w-[680px] border-separate border-spacing-0">
        <thead><tr>
          {heads.map(([k, label]) => (
            <th key={k} onClick={() => onSort(k)} className="sticky z-[3] cursor-pointer select-none whitespace-nowrap border-b border-line bg-[#fafbfd] px-[15px] py-[13px] text-left text-[13px] font-semibold" style={{ top: theadTop, color: sortKey === k ? "#4d7cfe" : "#6b7688" }}>{label}{sortKey === k ? (sortDir > 0 ? " ▲" : " ▼") : ""}</th>
          ))}
          {editOn && <th className="sticky z-[3] w-[44px] border-b border-line bg-[#fafbfd] px-[10px] py-[13px] text-center text-blue" style={{ top: theadTop }}><IconPencil size={15} className="inline-block" /></th>}
        </tr></thead>
        <tbody>
          {units.map((u) => { const r = row(u); return (
            <tr key={u.uid} onClick={() => onOpenUnit(u.uid)} className={`group cursor-pointer ${editOn ? "hover:bg-[#eef3ff]" : "hover:bg-[#f8faff]"}`}>
              <td className={`${td} font-bold text-ink`}>{u.num}</td><td className={`${td} whitespace-nowrap`}>{r.blok}</td>
              <td className={td}>{r.floor}</td><td className={td}>{r.type}</td>
              <td className={`${td} whitespace-nowrap`}>{u.area} м²</td>
              <td className={`${td} whitespace-nowrap font-bold ${editOn ? "!py-[7px]" : ""}`}>{editOn ? <PriceCell value={u.price || 0} sym={CUR_INFO[cur].sym} onCommit={(n) => commitPrice(objId, u, n)} /> : r.price}</td>
              <td className={`${td} whitespace-nowrap text-text-2`}>{showPerM2 && r.pm2}</td>
              <td className={`${td} ${editOn ? "!py-[7px]" : ""}`}>{editOn ? statusSel(u) : r.chip}</td>
              {editOn && <td className={`${td} !px-[10px] text-center`}><span title={t.open_card} className="inline-flex h-[30px] w-[30px] items-center justify-center rounded-[8px] border border-line bg-surface text-muted group-hover:border-blue group-hover:bg-blue group-hover:text-white"><IconPencil size={15} /></span></td>}
            </tr>
          ); })}
        </tbody>
      </table>
    </div>
    </>
  );
}
