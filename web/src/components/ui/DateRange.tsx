"use client";

// Выбор дат (12.10.2026, правило пользователя «не в 5 кликов, а в 1»): всплывающий календарь на ДВА месяца, диапазон
// «от – до» двумя кликами с подсветкой при наведении, быстрые кнопки (сегодня, вчера, 7/30 дней, этот/прошлый месяц,
// квартал, год). `DateField` — одиночная дата тем же календарём (один месяц + «сегодня/завтра/через неделю»).
// Значения — строки YYYY-MM-DD; показ — дд.мм.гггг. Без системного <input type="date"> (разная высота, нет пресетов).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconCalendar, IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { useEscape } from "@/hooks/useScrollLock";
import { useI18n } from "@/i18n/provider";

const LOC: Record<string, string> = { RU: "ru-RU", EN: "en-GB", TR: "tr-TR" };
const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const parse = (s: string | null | undefined): Date | null => { if (!s) return null; const [y, m, d] = s.split("-").map(Number); return y && m && d ? new Date(y, m - 1, d) : null; };
export const fmtD = (s: string | null | undefined): string => { const d = parse(s); return d ? `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}` : ""; };
const addDays = (d: Date, n: number) => { const x = new Date(d); x.setDate(x.getDate() + n); return x; };
const today = () => { const d = new Date(); d.setHours(0, 0, 0, 0); return d; };

type Range = { from: string; to: string };
function presets(): { key: string; r: Range }[] {
  const t = today(); const y = t.getFullYear(), m = t.getMonth();
  const q = Math.floor(m / 3) * 3;
  return [
    { key: "today", r: { from: iso(t), to: iso(t) } },
    { key: "yesterday", r: { from: iso(addDays(t, -1)), to: iso(addDays(t, -1)) } },
    { key: "d7", r: { from: iso(addDays(t, -6)), to: iso(t) } },
    { key: "d30", r: { from: iso(addDays(t, -29)), to: iso(t) } },
    { key: "thisMonth", r: { from: iso(new Date(y, m, 1)), to: iso(new Date(y, m + 1, 0)) } },
    { key: "lastMonth", r: { from: iso(new Date(y, m - 1, 1)), to: iso(new Date(y, m, 0)) } },
    { key: "quarter", r: { from: iso(new Date(y, q, 1)), to: iso(new Date(y, q + 3, 0)) } },
    { key: "year", r: { from: iso(new Date(y, 0, 1)), to: iso(new Date(y, 11, 31)) } },
  ];
}
function singlePresets(): { key: string; v: string }[] {
  const t = today();
  return [{ key: "today", v: iso(t) }, { key: "tomorrow", v: iso(addDays(t, 1)) }, { key: "d7", v: iso(addDays(t, 7)) }, { key: "d30", v: iso(addDays(t, 30)) }];
}

/** Сетка одного месяца. */
function Month({ year, month, lang, from, to, hover, onPick, onHover }: { year: number; month: number; lang: string; from: Date | null; to: Date | null; hover: Date | null; onPick: (d: Date) => void; onHover: (d: Date | null) => void }) {
  const loc = LOC[lang] ?? "ru-RU";
  const first = new Date(year, month, 1);
  const startDow = (first.getDay() + 6) % 7; // понедельник = 0
  const days = new Date(year, month + 1, 0).getDate();
  const cells: (Date | null)[] = [...Array(startDow).fill(null), ...Array.from({ length: days }, (_, i) => new Date(year, month, i + 1))];
  while (cells.length % 7) cells.push(null);
  const dows = Array.from({ length: 7 }, (_, i) => new Date(2024, 0, i + 1).toLocaleDateString(loc, { weekday: "short" }).replace(".", "").slice(0, 2));
  const tt = today().getTime();
  const a = from?.getTime() ?? null, b = (to ?? (from && hover && hover.getTime() >= from.getTime() ? hover : null))?.getTime() ?? null;
  return (
    <div className="w-[238px]">
      <div className="mb-2 text-center text-[13px] font-semibold capitalize text-ink">{first.toLocaleDateString(loc, { month: "long", year: "numeric" })}</div>
      <div className="grid grid-cols-7 text-center text-[10.5px] font-semibold uppercase text-muted">{dows.map((d, i) => <div key={i} className="h-6 leading-6">{d}</div>)}</div>
      <div className="grid grid-cols-7">
        {cells.map((d, i) => {
          if (!d) return <div key={i} className="h-8" />;
          const x = d.getTime();
          const isFrom = a === x, isTo = b === x, inR = a !== null && b !== null && x > a && x < b;
          return (
            <button key={i} type="button" onMouseEnter={() => onHover(d)} onMouseLeave={() => onHover(null)} onClick={() => onPick(d)}
              className={`h-8 cursor-pointer text-[12.5px] ${isFrom || isTo ? "rounded-[6px] bg-blue-2 font-semibold text-white" : inR ? "bg-blue-tint text-sel-ink" : "rounded-[6px] text-ink hover:bg-bg-3"} ${inR && (i % 7 === 0) ? "rounded-l-[6px]" : ""} ${inR && (i % 7 === 6) ? "rounded-r-[6px]" : ""} ${x === tt && !isFrom && !isTo ? "font-bold text-blue-2" : ""}`}>
              {d.getDate()}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/** Всплывающая панель с позиционированием под триггером. */
type Rect = { left: number; right: number; top: number; bottom: number };
function Pop({ rect, anchor, width, onClose, children }: { rect: Rect | null; anchor: React.RefObject<HTMLButtonElement | null>; width: number; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  useEscape(true, onClose);
  useEffect(() => {
    const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node) && !anchor.current?.contains(e.target as Node)) onClose(); };
    document.addEventListener("mousedown", h, true); return () => document.removeEventListener("mousedown", h, true);
  }, [anchor, onClose]);
  const r = rect;
  // не вылезать за экран: сначала по левому краю триггера, иначе по правому, иначе прижать к краю окна (ширина панели известна)
  let left = r ? r.left : 0;
  if (r && left + width > window.innerWidth - 8) left = Math.max(8, Math.min(r.right - width, window.innerWidth - width - 8));
  const top = r ? (r.bottom + 340 > window.innerHeight ? Math.max(8, r.top - 8 - 330) : r.bottom + 6) : 0;
  return <div ref={ref} style={{ position: "fixed", left, top, zIndex: 600 }} className="rounded-[8px] border border-line bg-surface p-3 shadow-[0_12px_40px_rgba(20,36,63,.18)]">{children}</div>;
}

const trig = "inline-flex h-9 w-full cursor-pointer items-center gap-2 rounded-[6px] border border-line bg-surface px-[10px] text-left text-[13px] text-ink hover:border-blue data-[open=true]:border-blue";

/** Диапазон дат: триггер «01.10.2026 – 12.10.2026», календарь на два месяца, пресеты слева. */
export function DateRange({ from, to, onChange, placeholder, className = "" }: { from: string; to: string; onChange: (from: string, to: string) => void; placeholder?: string; className?: string }) {
  const { t, lang } = useI18n();
  const d = t.dr;
  const [open, setOpen] = useState(false);
  const [hover, setHover] = useState<Date | null>(null);
  const [draft, setDraft] = useState<{ from: Date | null; to: Date | null }>({ from: parse(from), to: parse(to) });
  const base = parse(from) ?? today();
  const [view, setView] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const btn = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const openIt = () => { const f = parse(from) ?? today(); setDraft({ from: parse(from), to: parse(to) }); setView({ y: f.getFullYear(), m: f.getMonth() }); const b = btn.current?.getBoundingClientRect(); setRect(b ? { left: b.left, right: b.right, top: b.top, bottom: b.bottom } : null); setOpen(true); };
  const pick = (x: Date) => {
    if (!draft.from || draft.to) { setDraft({ from: x, to: null }); return; }
    const a = draft.from.getTime() <= x.getTime() ? draft.from : x, b = draft.from.getTime() <= x.getTime() ? x : draft.from;
    setDraft({ from: a, to: b }); onChange(iso(a), iso(b)); setOpen(false);
  };
  const apply = (r: Range) => { onChange(r.from, r.to); setOpen(false); };
  const shift = (n: number) => setView((v) => { const dt = new Date(v.y, v.m + n, 1); return { y: dt.getFullYear(), m: dt.getMonth() }; });
  const label = from || to ? `${fmtD(from) || "…"} – ${fmtD(to) || "…"}` : "";
  const pl = presets(); const cur = pl.find((p) => p.r.from === from && p.r.to === to)?.key;
  return (
    <div className={`relative ${className}`}>
      <button ref={btn} type="button" data-open={open} onClick={() => (open ? setOpen(false) : openIt())} className={trig}>
        <IconCalendar size={15} className="flex-none text-muted" />
        <span className={`min-w-0 flex-1 truncate ${label ? "" : "text-muted-2"}`}>{cur ? (d.p as Record<string, string>)[cur] : label || placeholder || d.period}</span>
        {label ? <span role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onChange("", ""); }} className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-bg-3 hover:text-ink"><IconX size={13} /></span> : null}
      </button>
      {open && (
        <Pop rect={rect} anchor={btn} width={700} onClose={() => setOpen(false)}>
          <div className="flex gap-3">
            <div className="flex w-[150px] flex-col gap-[2px] border-r border-line pr-3">
              {pl.map((p) => <button key={p.key} type="button" onClick={() => apply(p.r)} className={`h-7 cursor-pointer rounded-[5px] px-2 text-left text-[12.5px] ${cur === p.key ? "bg-blue-tint font-semibold text-sel-ink" : "text-text hover:bg-bg-3"}`}>{(d.p as Record<string, string>)[p.key]}</button>)}
            </div>
            <div>
              <div className="relative flex gap-5">
                <button type="button" onClick={() => shift(-1)} className="absolute -left-1 top-0 flex h-6 w-6 cursor-pointer items-center justify-center rounded-[5px] text-muted hover:bg-bg-3 hover:text-ink"><IconChevronLeft size={16} /></button>
                <button type="button" onClick={() => shift(1)} className="absolute -right-1 top-0 flex h-6 w-6 cursor-pointer items-center justify-center rounded-[5px] text-muted hover:bg-bg-3 hover:text-ink"><IconChevronRight size={16} /></button>
                <Month year={view.y} month={view.m} lang={lang} from={draft.from} to={draft.to} hover={hover} onPick={pick} onHover={setHover} />
                <Month year={new Date(view.y, view.m + 1, 1).getFullYear()} month={new Date(view.y, view.m + 1, 1).getMonth()} lang={lang} from={draft.from} to={draft.to} hover={hover} onPick={pick} onHover={setHover} />
              </div>
              <div className="mt-2 flex items-center justify-between border-t border-line pt-2 text-[12px] text-muted">
                <span>{draft.from ? `${fmtD(iso(draft.from))} – ${draft.to ? fmtD(iso(draft.to)) : d.pickTo}` : d.pickFrom}</span>
                <button type="button" onClick={() => { onChange("", ""); setOpen(false); }} className="cursor-pointer font-semibold text-red hover:underline">{d.clear}</button>
              </div>
            </div>
          </div>
        </Pop>
      )}
    </div>
  );
}

/** Одна дата: тот же календарь (один месяц) + пресеты сегодня / завтра / через неделю / через месяц. */
export function DateField({ value, onChange, placeholder, className = "", clearable = true }: { value: string; onChange: (v: string) => void; placeholder?: string; className?: string; clearable?: boolean }) {
  const { t, lang } = useI18n();
  const d = t.dr;
  const [open, setOpen] = useState(false);
  const base = parse(value) ?? today();
  const [view, setView] = useState({ y: base.getFullYear(), m: base.getMonth() });
  const btn = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<Rect | null>(null);
  const openIt = () => { const f = parse(value) ?? today(); setView({ y: f.getFullYear(), m: f.getMonth() }); const b = btn.current?.getBoundingClientRect(); setRect(b ? { left: b.left, right: b.right, top: b.top, bottom: b.bottom } : null); setOpen(true); };
  const shift = (n: number) => setView((v) => { const dt = new Date(v.y, v.m + n, 1); return { y: dt.getFullYear(), m: dt.getMonth() }; });
  const sel = parse(value);
  return (
    <div className={`relative ${className}`}>
      <button ref={btn} type="button" data-open={open} onClick={() => (open ? setOpen(false) : openIt())} className={trig}>
        <IconCalendar size={15} className="flex-none text-muted" />
        <span className={`min-w-0 flex-1 truncate ${value ? "" : "text-muted-2"}`}>{fmtD(value) || placeholder || d.pickDate}</span>
        {value && clearable ? <span role="button" tabIndex={-1} onClick={(e) => { e.stopPropagation(); onChange(""); }} className="flex h-5 w-5 items-center justify-center rounded-full text-muted hover:bg-bg-3 hover:text-ink"><IconX size={13} /></span> : null}
      </button>
      {open && (
        <Pop rect={rect} anchor={btn} width={420} onClose={() => setOpen(false)}>
          <div className="flex gap-3">
            <div className="flex w-[130px] flex-col gap-[2px] border-r border-line pr-3">
              {singlePresets().map((p) => <button key={p.key} type="button" onClick={() => { onChange(p.v); setOpen(false); }} className={`h-7 cursor-pointer rounded-[5px] px-2 text-left text-[12.5px] ${value === p.v ? "bg-blue-tint font-semibold text-sel-ink" : "text-text hover:bg-bg-3"}`}>{(d.s as Record<string, string>)[p.key]}</button>)}
            </div>
            <div className="relative">
              <button type="button" onClick={() => shift(-1)} className="absolute -left-1 top-0 flex h-6 w-6 cursor-pointer items-center justify-center rounded-[5px] text-muted hover:bg-bg-3 hover:text-ink"><IconChevronLeft size={16} /></button>
              <button type="button" onClick={() => shift(1)} className="absolute -right-1 top-0 flex h-6 w-6 cursor-pointer items-center justify-center rounded-[5px] text-muted hover:bg-bg-3 hover:text-ink"><IconChevronRight size={16} /></button>
              <Month year={view.y} month={view.m} lang={lang} from={sel} to={sel} hover={null} onPick={(x) => { onChange(iso(x)); setOpen(false); }} onHover={() => {}} />
            </div>
          </div>
        </Pop>
      )}
    </div>
  );
}
