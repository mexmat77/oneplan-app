"use client";

// Общий набор фильтров CRM (19.10.2026, «в сделках и задачах нет фильтров — нужны, как в мировых CRM»): пилюли «Поле: значение ×»
// + «+ Фильтр» → поле → значение, мультивыбор «любое из» с цветными точками, числовые диапазоны «от–до», даты «с–по» (DateRange),
// панель «Все фильтры» справа. На телефоне каждый поповер — шторка снизу (`data-sheet="fit"`, портал в body, «назад» закрывает).
// Сделки (DealsBoard) и задачи (TasksView) — на этом наборе; список клиентов (ClientsTable) пока на своей более ранней копии.
import { kbAutoFocus } from "@/lib/touch";
import { createPortal } from "react-dom";
import React, { useEffect, useRef, useState } from "react";
import { IconAdjustmentsHorizontal, IconCheck, IconChevronDown, IconPlus, IconX } from "@tabler/icons-react";
import { DateRange, fmtD } from "@/components/ui/DateRange";
import { useBackClose, useEscape } from "@/hooks/useScrollLock";
import { useI18n } from "@/i18n/provider";
import { menuPos } from "./ChipMenu";
import { btnP, getPref, inp, setPref } from "./crmUi";

export type FOpt = { value: string; label: string; color?: string };
/** Поле фильтра: select — массив значений («любое из»); range — числа «от/до»; dates — даты «с/по». `range` — ключи в состоянии. */
export type FDef = { key: string; label: string; kind: "select" | "range" | "dates"; opts?: FOpt[]; range?: { from: string; to: string }; ph?: [string, string] };
export type GFlt = Record<string, string[] | string>;

export const sel = (flt: GFlt, k: string): string[] => { const v = flt[k]; return Array.isArray(v) ? v : []; };
export const str = (flt: GFlt, k: string): string => { const v = flt[k]; return typeof v === "string" ? v : ""; };
export const emptyOf = (defs: FDef[]): GFlt => { const o: GFlt = {}; for (const d of defs) { if (d.kind === "select") o[d.key] = []; else if (d.range) { o[d.range.from] = ""; o[d.range.to] = ""; } } return o; };
export const activeCount = (flt: GFlt, defs: FDef[]): number => defs.filter((d) => (d.kind === "select" ? sel(flt, d.key).length > 0 : !!d.range && !!(str(flt, d.range.from) || str(flt, d.range.to)))).length;
export const clearDef = (d: FDef): GFlt => (d.kind === "select" ? { [d.key]: [] } : d.range ? { [d.range.from]: "", [d.range.to]: "" } : {});
/** Состояние из localStorage/старого формата → по текущим полям (лишнее отбрасывается, типы приводятся). */
export function normFlt(p: unknown, defs: FDef[]): GFlt {
  const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>;
  const out = emptyOf(defs);
  for (const k of Object.keys(out)) { const v = o[k]; out[k] = Array.isArray(out[k]) ? (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x) : typeof v === "string" && v ? [v] : []) : typeof v === "string" ? v : ""; }
  return out;
}
/** Память последнего состояния фильтров раздела (как `opl-crm-last` у клиентов). */
export function loadFlt(key: string, defs: FDef[]): GFlt { try { return normFlt(JSON.parse(getPref(key) || "{}"), defs); } catch { return emptyOf(defs); } }
export function storeFlt(key: string, flt: GFlt) { setPref(key, JSON.stringify(flt)); }

const num = (v: string) => Number(v).toLocaleString("ru-RU");
export function pillsOf(flt: GFlt, defs: FDef[], hide: string[] = []): { key: string; label: string; value: string }[] {
  const out: { key: string; label: string; value: string }[] = [];
  for (const d of defs) {
    if (hide.includes(d.key)) continue;
    if (d.kind === "select") { const v = sel(flt, d.key); if (!v.length) continue; const names = v.map((x) => d.opts?.find((o) => o.value === x)?.label ?? x); out.push({ key: d.key, label: d.label, value: names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2}` : "") }); }
    else if (d.range) { const a = str(flt, d.range.from), b = str(flt, d.range.to); if (!a && !b) continue; out.push({ key: d.key, label: d.label, value: d.kind === "range" ? `${a ? `≥ ${num(a)}` : ""}${a && b ? " " : ""}${b ? `≤ ${num(b)}` : ""}` : `${fmtD(a) || "…"} – ${fmtD(b) || "…"}` }); }
  }
  return out;
}

/** Строка значения мультивыбора: чекбокс, цветная точка, подпись — одна и та же в «+ Фильтр», в пилюле и в панели. */
function OptRow({ on, color, label, onClick }: { on: boolean; color?: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex h-8 w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 text-left text-[13px] max-md:h-11 max-md:text-[14px] ${on ? "bg-blue-tint text-sel-ink" : "text-ink hover:bg-bg-3"}`}>
      <span className={`flex h-[15px] w-[15px] flex-none items-center justify-center rounded-[4px] border ${on ? "border-blue-2 bg-blue-2 text-white" : "border-line bg-surface"}`}>{on && <IconCheck size={11} stroke={3} />}</span>
      {color && <span className="h-2 w-2 flex-none rounded-full" style={{ background: color }} />}
      <span className="truncate">{label}</span>
    </button>
  );
}
/** Список значений поля-мультивыбора с поиском (при >8 вариантах), «Сбросить» и «Готово»; применяется сразу при каждом клике. */
export function MultiList({ def, flt, setF, onDone }: { def: FDef; flt: GFlt; setF: (p: GFlt) => void; onDone: () => void }) {
  const { t } = useI18n(); const c = t.crm;
  const [q, setQ] = useState("");
  const cur = sel(flt, def.key);
  const opts = (def.opts ?? []).filter((o) => !q.trim() || o.label.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (v: string) => setF({ [def.key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] });
  return (
    <>
      <div className="flex items-center justify-between px-2 pb-1 pt-1"><span className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{def.label}</span>{cur.length > 0 && <button type="button" onClick={() => setF({ [def.key]: [] })} className="cursor-pointer text-[11px] font-medium text-muted hover:text-red">{c.tbl.clear}</button>}</div>
      {(def.opts?.length ?? 0) > 8 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.tbl.findField} autoFocus={kbAutoFocus()} className="mb-1 h-8 w-full rounded-[5px] border border-line px-2 text-[13px] outline-none focus:border-blue" />}
      <div className="max-h-[280px] overflow-y-auto max-md:max-h-[60dvh]">{opts.map((o) => <OptRow key={o.value} on={cur.includes(o.value)} color={o.color} label={o.label} onClick={() => toggle(o.value)} />)}{opts.length === 0 && <div className="px-2 py-2 text-[12.5px] text-muted">—</div>}</div>
      <div className="mt-1 border-t border-line pt-1"><button type="button" onClick={onDone} className="flex h-8 w-full cursor-pointer items-center justify-center rounded-[5px] text-[13px] font-semibold text-blue-2 hover:bg-bg-3">{c.tbl.done}</button></div>
    </>
  );
}
/** Поле-мультивыбор в панели «Все фильтры»: триггер как у Select (подпись поля, выбранные значения с точками), список — fixed-меню / шторка. */
export function MultiField({ def, flt, setF }: { def: FDef; flt: GFlt; setF: (p: GFlt) => void }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; bottom: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h, true); return () => document.removeEventListener("mousedown", h, true); }, [open]);
  useEscape(open, () => setOpen(false));
  useBackClose(open, () => setOpen(false));
  const cur = sel(flt, def.key);
  const selected = cur.map((v) => def.opts?.find((o) => o.value === v)).filter((o): o is FOpt => !!o);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={(e) => { const b = (e.currentTarget as HTMLElement).getBoundingClientRect(); setRect({ left: b.left, top: b.top, bottom: b.bottom }); setOpen((v) => !v); }} className={`flex h-9 w-full cursor-pointer items-center gap-2 rounded-[6px] border bg-surface px-3 text-left text-[13px] ${open ? "border-blue" : "border-line hover:border-blue/60"}`}>
        {selected.length === 0 ? <span className="flex-1 truncate text-muted">{def.label}</span> : (
          <span className="flex min-w-0 flex-1 items-center gap-2"><span className="flex-none text-[11px] uppercase tracking-[.04em] text-muted">{def.label}</span><span className="flex min-w-0 flex-1 items-center gap-[6px] truncate">{selected.slice(0, 3).map((o) => <span key={o.value} className="inline-flex items-center gap-1 whitespace-nowrap">{o.color && <span className="h-2 w-2 flex-none rounded-full" style={{ background: o.color }} />}{o.label}</span>)}{selected.length > 3 && <span className="text-muted">+{selected.length - 3}</span>}</span></span>
        )}
        {selected.length > 0 && <span className="flex-none rounded-full bg-blue-tint px-[6px] text-[11px] font-semibold text-sel-ink">{selected.length}</span>}
        <IconChevronDown size={14} className="flex-none text-muted" />
      </button>
      {open && <div className="fixed inset-0 z-[311] bg-[rgba(10,16,28,.35)] md:hidden" onClick={() => setOpen(false)} />}
      {open && <div data-sheet="fit" style={menuPos(rect, 300, 48 + Math.min(def.opts?.length ?? 0, 8) * 32 + 40)} className="w-[300px] rounded-[8px] border border-line bg-surface p-1 shadow-[0_12px_40px_rgba(20,36,63,.16)] max-md:p-3 max-md:pb-[max(12px,env(safe-area-inset-bottom))]"><MultiList def={def} flt={flt} setF={setF} onDone={() => setOpen(false)} /></div>}
    </div>
  );
}
/** Числовой диапазон «от — до» для панели. */
export function RangeField({ def, flt, setF }: { def: FDef; flt: GFlt; setF: (p: GFlt) => void }) {
  if (!def.range) return null;
  const { from, to } = def.range;
  return (
    <div>
      <div className="mb-[6px] text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{def.label}</div>
      <div className="flex items-center gap-2"><input inputMode="numeric" value={str(flt, from)} onChange={(e) => setF({ [from]: e.target.value.replace(/\D/g, "") })} placeholder={def.ph?.[0]} className={inp} /><span className="text-muted">—</span><input inputMode="numeric" value={str(flt, to)} onChange={(e) => setF({ [to]: e.target.value.replace(/\D/g, "") })} placeholder={def.ph?.[1]} className={inp} /></div>
    </div>
  );
}
/** Даты «с — по» для панели. */
export function DatesField({ def, flt, setF }: { def: FDef; flt: GFlt; setF: (p: GFlt) => void }) {
  if (!def.range) return null;
  const { from, to } = def.range;
  return <DateRange from={str(flt, from)} to={str(flt, to)} onChange={(a, b) => setF({ [from]: a, [to]: b })} placeholder={def.label} />;
}

/** Поповер фильтра: на компьютере — под якорем, на телефоне — шторка снизу с затемнением; порталом в body (маска строки пилюль
 *  режет fixed-потомков). Клики внутри помечены `data-fpop` — родительские «клик вне» их не считают. */
export function PopBox({ className, close, children, anchor, w = 260 }: { className: string; close: () => void; children: React.ReactNode; anchor?: HTMLElement | null; w?: number }) {
  const rect = anchor?.getBoundingClientRect() ?? null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[310] bg-[rgba(10,16,28,.35)] md:hidden" onClick={close} />
      <div data-fpop="1" data-sheet="fit" style={menuPos(rect, w, 340)} className={className}>{children}</div>
    </>,
    document.body,
  );
}
const POP = "w-[260px] rounded-[8px] border border-line bg-surface p-1 shadow-[0_12px_40px_rgba(20,36,63,.16)] max-md:p-3 max-md:pb-[max(12px,env(safe-area-inset-bottom))]";
function ValuePop({ def, flt, setF, apply, close, anchor }: { def: FDef; flt: GFlt; setF: (p: GFlt) => void; apply: (p: GFlt) => void; close: () => void; anchor?: HTMLElement | null }) {
  const { t } = useI18n(); const c = t.crm;
  const [a, setA] = useState(def.range ? str(flt, def.range.from) : "");
  const [b, setB] = useState(def.range ? str(flt, def.range.to) : "");
  if (def.kind === "select") return <PopBox className={POP} close={close} anchor={anchor}><MultiList def={def} flt={flt} setF={setF} onDone={close} /></PopBox>;
  if (!def.range) return null;
  const { from, to } = def.range;
  if (def.kind === "range") return (
    <PopBox className={`${POP} p-3`} close={close} anchor={anchor}>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{def.label}</div>
      <div className="grid grid-cols-2 gap-2"><input inputMode="numeric" value={a} onChange={(e) => setA(e.target.value.replace(/\D/g, ""))} placeholder={def.ph?.[0]} autoFocus={kbAutoFocus()} className={inp} /><input inputMode="numeric" value={b} onChange={(e) => setB(e.target.value.replace(/\D/g, ""))} placeholder={def.ph?.[1]} className={inp} onKeyDown={(e) => { if (e.key === "Enter") apply({ [from]: a, [to]: b }); }} /></div>
      <button type="button" onClick={() => apply({ [from]: a, [to]: b })} className={`${btnP} mt-2 w-full justify-center`}>{c.tbl.apply}</button>
    </PopBox>
  );
  return (
    <PopBox className={`${POP} w-[300px] p-3`} close={close} anchor={anchor} w={300}>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{def.label}</div>
      <DateRange from={str(flt, from)} to={str(flt, to)} onChange={(x, y) => apply({ [from]: x, [to]: y })} />
    </PopBox>
  );
}

/** Строка фильтров как у Attio/Linear: пилюли условий + «+ Фильтр» → список полей → значение. `hide` — поля, показанные иначе (чипы видов). */
export function PillBar({ flt, setF, reset, defs, hide = [], extra }: { flt: GFlt; setF: (p: GFlt) => void; reset: () => void; defs: FDef[]; hide?: string[]; extra?: React.ReactNode }) {
  const { t } = useI18n(); const c = t.crm;
  const pills = pillsOf(flt, defs, hide);
  const [open, setOpen] = useState<{ mode: "pick" | "value"; key?: string; anchor?: string; el?: HTMLElement | null } | null>(null);
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { const el = e.target as Element; if (ref.current && !ref.current.contains(el) && !el.closest?.("[data-fpop], [data-overlay]")) setOpen(null); }; document.addEventListener("mousedown", h, true); return () => document.removeEventListener("mousedown", h, true); }, [open]);
  useEscape(!!open, () => setOpen(null));
  useBackClose(!!open, () => setOpen(null));
  const def = open?.key ? defs.find((d) => d.key === open.key) : undefined;
  const fields = defs.filter((d) => !hide.includes(d.key) && (!q.trim() || d.label.toLowerCase().includes(q.trim().toLowerCase())));
  const item = "flex h-8 w-full cursor-pointer items-center rounded-[5px] px-2 text-left text-[13px] text-ink hover:bg-bg-3";
  const apply = (p: GFlt) => { setF(p); setOpen(null); };
  return (
    <div ref={ref} className="mb-3 flex flex-wrap items-center gap-[6px] max-md:flex-nowrap max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[mask-image:linear-gradient(to_right,#000_calc(100%-36px),transparent)] max-md:[&>*]:flex-none">
      {pills.map((p) => (
        <span key={p.key} className="relative inline-flex h-7 items-center rounded-full border border-sel-line bg-blue-tint pl-3 pr-1 text-[12.5px] text-sel-ink">
          <button type="button" onClick={(e) => setOpen(open?.key === p.key ? null : { mode: "value", key: p.key, anchor: p.key, el: e.currentTarget.parentElement })} className="cursor-pointer"><span className="text-sel-ink/70">{p.label}:</span> <span className="font-semibold">{p.value}</span></button>
          <button type="button" onClick={() => { const d = defs.find((x) => x.key === p.key); if (d) setF(clearDef(d)); }} className="ml-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full hover:bg-white/60"><IconX size={12} /></button>
          {open?.mode === "value" && open.anchor === p.key && def && <ValuePop key={def.key} def={def} flt={flt} setF={setF} apply={apply} close={() => setOpen(null)} anchor={open.el} />}
        </span>
      ))}
      <span className="relative">
        <button type="button" onClick={(e) => { setOpen(open ? null : { mode: "pick", anchor: "+", el: e.currentTarget }); setQ(""); }} className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-dashed border-line px-3 text-[12.5px] font-medium text-text hover:border-blue hover:text-ink"><IconPlus size={13} /> {c.tbl.addFilter}</button>
        {open?.mode === "pick" && (
          <PopBox className={POP} close={() => setOpen(null)} anchor={open.el}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.tbl.findField} autoFocus={kbAutoFocus()} className="mb-1 h-8 w-full rounded-[5px] border border-line px-2 text-[13px] outline-none focus:border-blue" />
            <div className="max-h-[280px] overflow-y-auto">{fields.map((d) => <button key={d.key} type="button" onClick={() => { setQ(""); setOpen({ mode: "value", key: d.key, anchor: "+", el: open.el }); }} className={item}>{d.label}</button>)}</div>
          </PopBox>
        )}
        {open?.mode === "value" && open.anchor === "+" && def && <ValuePop key={def.key} def={def} flt={flt} setF={setF} apply={apply} close={() => setOpen(null)} anchor={open.el} />}
      </span>
      {pills.length > 0 && <button type="button" onClick={reset} className="ml-1 cursor-pointer text-[12.5px] font-semibold text-muted hover:text-red">{c.tbl.clear}</button>}
      {extra}
    </div>
  );
}

/** Кнопка «Все фильтры · N» для тулбара раздела (справа, рядом с видом). */
export function FiltersButton({ n, onClick, className = "" }: { n: number; onClick: () => void; className?: string }) {
  const { t } = useI18n(); const c = t.crm;
  // Одно место во всех разделах (19.10.2026, «фильтр то справа, то слева»): на компьютере «Все фильтры · N», на телефоне —
  // иконка 40×40 со значком числа в углу, ширина кнопки не зависит от числа, кнопка всегда правая в своей строке (ml-auto).
  return (
    <button type="button" onClick={onClick} title={c.tbl.allFilters} className={`relative inline-flex h-8 cursor-pointer items-center gap-[6px] rounded-[6px] border px-3 text-[13px] font-semibold max-md:w-10 max-md:flex-none max-md:justify-center max-md:px-0 ${n ? "border-sel-line bg-blue-tint text-sel-ink" : "border-line bg-surface text-ink hover:bg-bg-3"} ${className}`}>
      <IconAdjustmentsHorizontal size={15} className="max-md:h-[18px] max-md:w-[18px]" /><span className="max-md:hidden">{c.tbl.allFilters}{n ? ` · ${n}` : ""}</span>
      {n > 0 && <span className="absolute -right-[6px] -top-[6px] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-blue-2 px-1 text-[10.5px] font-bold text-white md:hidden">{n}</span>}
    </button>
  );
}

/** Панель «Все фильтры» справа: шапка с крестиком, группы, внизу «Сбросить» и «Показать N». Таблица/доска остаётся на месте. */
export function FilterPanel({ open, onClose, active, count, reset, children }: { open: boolean; onClose: () => void; active: number; count: number; reset: () => void; children: React.ReactNode }) {
  const { t } = useI18n(); const c = t.crm;
  useEscape(open, onClose);
  useBackClose(open, onClose);
  if (!open) return null;
  return (
    <>
      <div className="fixed inset-0 z-[300] bg-ink/20" onClick={onClose} />
      <aside data-crm-form="1" className="fixed right-0 top-0 z-[310] flex h-dvh w-[460px] max-w-full flex-col border-l border-line bg-surface shadow-[-10px_0_40px_rgba(20,36,63,.15)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-3"><div className="text-[15px] font-semibold text-ink">{c.tbl.filters}{active ? <span className="ml-2 rounded-full bg-blue-tint px-2 py-[1px] text-[11px] text-sel-ink">{active}</span> : null}</div><button type="button" onClick={onClose} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-bg-3 hover:text-ink"><IconX size={16} /></button></div>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-4">{children}</div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={reset} disabled={!active} className={`flex-none cursor-pointer rounded-[10px] px-[14px] py-[10px] text-[13px] font-bold ${active ? "bg-red-tint text-red" : "text-muted"} disabled:cursor-default`}>{t.cat.resetBtn}</button>
          <button type="button" onClick={onClose} className="flex-none cursor-pointer rounded-[10px] bg-blue-2 px-5 py-[10px] text-[13px] font-bold text-white hover:bg-blue-3">{t.geo.show} {count}</button>
        </div>
      </aside>
    </>
  );
}
/** Группа полей в панели. */
export const PanelGroup = ({ label, children }: { label: string; children: React.ReactNode }) => <section className="flex flex-col gap-2"><div className="mb-1 text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{label}</div>{children}</section>;
/** Поле панели по определению: мультивыбор / диапазон / даты. */
export const PanelField = ({ def, flt, setF }: { def: FDef; flt: GFlt; setF: (p: GFlt) => void }) => (def.kind === "select" ? (def.opts?.length ? <MultiField def={def} flt={flt} setF={setF} /> : null) : def.kind === "range" ? <RangeField def={def} flt={flt} setF={setF} /> : <DatesField def={def} flt={flt} setF={setF} />);
/** Строка видов «Все · Мои · …» с числами — как у списка клиентов; на телефоне одной строкой с прокруткой. */
export function ViewTabs<T extends string>({ value, onChange, items }: { value: T; onChange: (v: T) => void; items: { key: T; label: string; n: number; red?: boolean }[] }) {
  return (
    <div className="mb-3 flex items-end gap-1 border-b border-line max-md:flex-nowrap max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[mask-image:linear-gradient(to_right,#000_calc(100%-36px),transparent)] max-md:[&>*]:flex-none">
      {items.map((v) => <button key={v.key} type="button" onClick={() => onChange(v.key)} className={`-mb-px flex cursor-pointer items-center gap-[6px] border-b-2 px-3 pb-2 pt-1 text-[13px] ${value === v.key ? "border-blue-2 font-semibold text-ink" : "border-transparent text-text hover:text-ink"}`}>{v.label}<span className={`rounded-full px-[6px] text-[11px] ${v.red && v.n ? "bg-red-tint text-red" : "bg-bg-2 text-muted"}`}>{v.n}</span></button>)}
    </div>
  );
}
