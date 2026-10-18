"use client";

import { kbAutoFocus } from "@/lib/touch";
// Выпадающий список в стиле сайта вместо системного <select> (решение пользователя 07.10.2026: единый вид во всех формах).
// Кнопка-триггер выглядит как поле ввода, список рендерится порталом в body (не обрезается модалками), позиция от триггера,
// при нехватке места снизу — открывается вверх. Клавиатура: Enter/Space/↓ — открыть, ↑/↓ — выбор, Enter — применить, Esc — закрыть.
//   <Select value={v} onChange={setV} options={[{ value: "", label: "Все" }, ...]} className="w-full" />
import { useBackClose } from "@/hooks/useScrollLock";
import { IconCheck, IconChevronDown, IconSearch } from "@tabler/icons-react";
import { useEffect, useId, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type SelectOption = { value: string; label: ReactNode; disabled?: boolean; /** цветная точка слева (статусы, этапы, приоритеты, ответственные) */ color?: string };
type Props = {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Классы триггера (ширина, отступы, размер шрифта). По умолчанию — вид обычного поля формы. */
  className?: string;
  /** Стили триггера (для редких случаев: цвет статуса и т. п.). */
  style?: CSSProperties;
  placeholder?: ReactNode;
  disabled?: boolean;
  /** Не всплывать кликом (строки таблиц с собственным onClick). */
  stopPropagation?: boolean;
  /** Ширина панели: по триггеру (по умолчанию) или по содержимому. */
  menuWidth?: "trigger" | "auto";
  /** Иконка слева в триггере. */
  icon?: ReactNode;
  /** Компактная панель (мелкие элементы управления). */
  size?: "md" | "sm";
  title?: string;
  "aria-label"?: string;
  /** Поиск по пунктам: по умолчанию включается, когда вариантов больше 7 (справочники агентств/застройщиков растут). */
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyText?: string;
};

const TRIGGER = "inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-[11px] text-left text-[14px] text-ink outline-none transition-[border-color,box-shadow] focus-visible:border-blue disabled:cursor-default disabled:opacity-60 data-[open=true]:border-blue";

export function Select({ value, onChange, options, className = "w-full", style, placeholder, disabled, stopPropagation, menuWidth = "trigger", icon, size = "md", title, "aria-label": ariaLabel, searchable, searchPlaceholder = "Поиск…", emptyText = "Ничего не найдено" }: Props) {
  const [open, setOpen] = useState(false);
  useBackClose(open, () => setOpen(false));
  const [active, setActive] = useState(-1);
  const [pos, setPos] = useState<{ top: number; left: number; width: number; up: boolean } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const id = useId();
  const cur = options.find((o) => o.value === value);
  const [q, setQ] = useState("");
  const withSearch = searchable ?? options.length > 7;
  const norm = (v: string) => v.toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const text = (o: SelectOption) => (typeof o.label === "string" ? o.label : String(o.value));
  const shown = withSearch && q.trim() ? options.filter((o) => norm(text(o)).includes(norm(q.trim()))) : options;

  const place = () => {
    const el = btn.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const h = Math.min(300, options.length * (size === "sm" ? 32 : 38) + 10);
    const up = r.bottom + h + 8 > window.innerHeight && r.top > h + 8;
    setPos({ top: up ? r.top - 4 : r.bottom + 4, left: r.left, width: r.width, up });
  };
  useLayoutEffect(() => { if (open) place(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => { const t = e.target as Node; if (btn.current?.contains(t) || list.current?.contains(t)) return; setOpen(false); };
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") { e.stopPropagation(); setOpen(false); btn.current?.focus(); } };
    document.addEventListener("mousedown", close, true);
    document.addEventListener("keydown", onKey, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => { document.removeEventListener("mousedown", close, true); document.removeEventListener("keydown", onKey, true); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  useEffect(() => { if (open && active >= 0) list.current?.querySelectorAll<HTMLElement>("[data-opt]")[active]?.scrollIntoView({ block: "nearest" }); }, [open, active]);

  const toggle = () => { if (disabled) return; setQ(""); setActive(Math.max(0, options.findIndex((o) => o.value === value))); setOpen((v) => !v); };
  const pick = (o: SelectOption) => { if (o.disabled) return; onChange(o.value); setOpen(false); btn.current?.focus(); };
  const move = (d: number) => {
    let i = active;
    for (let k = 0; k < shown.length; k++) { i = (i + d + shown.length) % shown.length; if (!shown[i].disabled) break; }
    setActive(i);
  };
  useEffect(() => { if (open && withSearch && kbAutoFocus()) setTimeout(() => search.current?.focus(), 0); }, [open, withSearch]); // на телефоне клавиатура — только по тапу в поле
  const onKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (!open) { if (["Enter", " ", "ArrowDown", "ArrowUp"].includes(e.key)) { e.preventDefault(); toggle(); } return; }
    if (e.key === "ArrowDown") { e.preventDefault(); move(1); }
    else if (e.key === "ArrowUp") { e.preventDefault(); move(-1); }
    else if (e.key === "Enter" || (e.key === " " && !withSearch)) { e.preventDefault(); if (shown[active]) pick(shown[active]); }
    else if (e.key === "Tab") setOpen(false);
  };

  return (
    <>
      <button ref={btn} type="button" title={title} aria-label={ariaLabel} aria-haspopup="listbox" aria-expanded={open} aria-controls={id} disabled={disabled} data-open={open}
        onClick={(e) => { if (stopPropagation) e.stopPropagation(); toggle(); }} onKeyDown={onKeyDown} className={`${TRIGGER} ${className}`} style={style}>
        {icon}
        {cur?.color && <span className="h-2 w-2 flex-none rounded-full" style={{ background: cur.color }} />}
        <span className={`min-w-0 flex-1 truncate ${cur ? "" : "text-muted-2"}`}>{cur ? cur.label : placeholder ?? "—"}</span>
        <IconChevronDown size={size === "sm" ? 13 : 15} className={`flex-none text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <><div className="fixed inset-0 bg-[rgba(10,16,28,.35)] md:hidden" style={{ zIndex: 649 }} onMouseDown={(e) => { e.stopPropagation(); setOpen(false); }} />{/* на телефоне список — шторка снизу (data-sheet), как во всех меню (18.10.2026) */}
        <div ref={list} id={id} role="listbox" data-sheet="fit" onClick={(e) => e.stopPropagation()} onMouseDown={(e) => e.stopPropagation()}
          className="fixed z-[600] flex max-h-[340px] flex-col overflow-hidden rounded-[12px] border border-line bg-surface p-1 shadow-[0_18px_44px_rgba(20,36,63,.16)] max-md:p-0"
          style={{ top: pos.up ? undefined : pos.top, bottom: pos.up ? window.innerHeight - pos.top : undefined, left: pos.left, minWidth: pos.width, width: menuWidth === "trigger" ? pos.width : undefined, animation: "opl-bg .12s ease", zIndex: 650 }}>
          {withSearch && (
            <div className="mb-1 flex-none bg-surface p-1 max-md:mb-0 max-md:border-b max-md:border-[#f2f4f8] max-md:px-[18px] max-md:py-[10px]">{/* поиск вне прокрутки: раньше строки списка просвечивали над sticky-полем */}
              <div className="relative"><IconSearch size={14} className="pointer-events-none absolute left-[9px] top-1/2 -translate-y-1/2 text-muted-2 max-md:left-[11px]" />
                <input ref={search} value={q} onChange={(e) => { setQ(e.target.value); setActive(0); }} onKeyDown={onKeyDown} placeholder={searchPlaceholder} className="w-full rounded-[9px] border border-line bg-bg-5 py-[8px] pl-[28px] pr-2 text-[13px] text-ink outline-none focus:border-blue max-md:rounded-[10px] max-md:bg-surface max-md:pl-8" /></div>
            </div>
          )}
          {/* на телефоне строки как в окне «Расположение» (единый стиль списков, 18.10.2026): разделители, 14px, отступы 18px */}
          <div className="min-h-0 flex-1 overflow-y-auto max-md:pb-[env(safe-area-inset-bottom)]">
          {shown.map((o, i) => {
            const on = o.value === value;
            return (
              <div key={o.value} data-opt role="option" aria-selected={on} aria-disabled={o.disabled} onMouseEnter={() => setActive(i)} onClick={() => pick(o)}
                className={`flex cursor-pointer items-center gap-2 rounded-[9px] px-3 max-md:gap-[11px] max-md:rounded-none max-md:border-b max-md:border-[#f5f7fb] max-md:px-[18px] max-md:py-[14px] max-md:text-[14px] ${size === "sm" ? "py-[6px] text-[13px]" : "py-[9px] text-[13.5px]"} ${o.disabled ? "cursor-default text-muted-2" : on ? "bg-blue-tint font-semibold text-blue-2" : i === active ? "bg-bg-3 text-ink" : "text-ink"}`}>
                {o.color && <span className="h-2 w-2 flex-none rounded-full" style={{ background: o.color }} />}
                <span className="min-w-0 flex-1 truncate">{o.label}</span>
                {on && <IconCheck size={15} className="flex-none text-blue-2" />}
              </div>
            );
          })}
          {shown.length === 0 && <div className="px-3 py-[9px] text-[13px] text-muted max-md:px-[18px] max-md:py-[14px] max-md:text-[14px]">{options.length ? emptyText : "—"}</div>}
          </div>
        </div></>,
        document.body,
      )}
    </>
  );
}
