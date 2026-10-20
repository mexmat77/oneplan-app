"use client";

// Поле телефона как в WhatsApp (20.10.2026, «в WhatsApp крутая маска — сделаем так же»): слева кнопка страны «🇹🇷 +90 ▾»
// (список всех стран с флагом, названием на языке интерфейса и кодом, поиск по названию и коду; на телефоне — шторка снизу),
// справа сам номер без кода, форматируется по правилам страны по мере ввода («505 123 45 67»). Набор «+…» или «00…» в поле
// номера переключает страну автоматически; «0505…» / «905…» для Турции тоже понимаются. Значение наружу — международный вид
// с пробелами («+90 505 123 45 67»), как хранилось. Невалидный номер после ухода с поля — красная рамка.
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type CSSProperties } from "react";
import { IconCheck, IconChevronDown, IconSearch } from "@tabler/icons-react";
import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";
import { useBackClose, useEscape } from "@/hooks/useScrollLock";
import { useI18n } from "@/i18n/provider";
import { kbAutoFocus } from "@/lib/touch";
import { countryName, DEFAULT_COUNTRY, flagOf, phoneInfo, toIntlDigits } from "@/lib/phoneIntl";

const EMOJI: CSSProperties = { fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' };
const POPULAR: CountryCode[] = ["TR", "RU", "UA", "KZ", "BY", "AZ", "UZ", "DE", "GB", "US", "KG", "IR", "IQ", "SA", "AE", "NL", "FR", "IT", "PL"];

/** Международная строка → часть после кода страны, отформатированная («+90 505 123 45 67» → «505 123 45 67»). */
function nationalPart(intl: string, cc: CountryCode): string {
  if (!intl) return "";
  const code = "+" + getCountryCallingCode(cc);
  const f = new AsYouType().input(intl);
  return f.startsWith(code) ? f.slice(code.length).trim() : f.replace(/^\+\d+\s?/, "");
}

export function PhoneInput({ value, onChange, className = "", placeholder, disabled, autoFocus, onKeyDown, style, id }: {
  value: string; onChange: (v: string) => void; className?: string; placeholder?: string; disabled?: boolean; autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void; style?: CSSProperties; id?: string;
}) {
  const { lang } = useI18n();
  const [touched, setTouched] = useState(false);
  const [open, setOpen] = useState(false);
  const [picked, setPicked] = useState<CountryCode | null>(null); // страна, выбранная руками (пока номер пуст)
  const info = phoneInfo(value);
  const cc: CountryCode = info.country ?? picked ?? DEFAULT_COUNTRY;
  const code = "+" + getCountryCallingCode(cc);
  const shown = value ? nationalPart(info.intl, cc) : "";
  const bad = touched && !!value.trim() && !info.valid;
  const title = `${countryName(cc, lang)} · ${code}`;
  const btn = useRef<HTMLButtonElement>(null);
  const [rect, setRect] = useState<{ left: number; top: number; bottom: number } | null>(null);

  // ввод в поле номера: «+…»/«00…» — международный набор (страна сменится сама), иначе — национальная часть выбранной страны
  const onInput = (raw: string) => {
    const t = raw.trim();
    if (!t) { onChange(""); return; }
    if (t.startsWith("+") || t.startsWith("00")) { onChange(new AsYouType().input(toIntlDigits(t))); return; }
    let d = t.replace(/\D/g, "");
    if (cc === "TR") { if (d.startsWith("90") && d.length > 10) d = d.slice(2); if (d.startsWith("0")) d = d.slice(1); }
    else if (cc === "RU" && d.startsWith("8") && d.length === 11) d = d.slice(1);
    const p = parsePhoneNumberFromString(code + d);
    onChange(p ? new AsYouType().input(p.number) : code + " " + d);
  };
  const pickCountry = (c: CountryCode) => {
    setPicked(c); setOpen(false);
    const d = value.replace(/\D/g, "").replace(new RegExp("^" + getCountryCallingCode(cc)), "");
    if (d) { const p = parsePhoneNumberFromString("+" + getCountryCallingCode(c) + d); onChange(p ? new AsYouType().input(p.number) : "+" + getCountryCallingCode(c) + " " + d); }
  };
  const openList = () => { const b = btn.current?.getBoundingClientRect(); setRect(b ? { left: b.left, top: b.top, bottom: b.bottom } : null); setOpen(true); };
  return (
    <span className="relative block">
      <button ref={btn} type="button" disabled={disabled} onClick={openList} title={title} aria-label={title} className="absolute left-[6px] top-1/2 flex h-[calc(100%-8px)] -translate-y-1/2 cursor-pointer items-center gap-[3px] rounded-[6px] pl-[5px] pr-[3px] text-[13px] font-medium text-ink hover:bg-bg-2 disabled:cursor-default">
        <span className="text-[18px] leading-none" style={EMOJI}>{flagOf(cc)}</span><span className="[font-variant-numeric:tabular-nums]">{code}</span><IconChevronDown size={12} className="text-muted" />
      </button>
      <input id={id} value={shown} onChange={(e) => onInput(e.target.value)} onBlur={() => { setTouched(true); if (value.trim() && info.valid) onChange(info.intl); }} onKeyDown={onKeyDown}
        inputMode="tel" autoComplete="tel" placeholder={placeholder ?? (cc === "TR" ? "5xx xxx xx xx" : "")} disabled={disabled} autoFocus={autoFocus} title={value ? info.intl : undefined}
        className={`${className} [font-variant-numeric:tabular-nums] ${bad ? "!border-red" : ""}`} style={{ ...style, paddingLeft: 24 + 8 * code.length + 44 }} />
      {open && <CountryList current={cc} rect={rect} anchor={btn} onPick={pickCountry} onClose={() => setOpen(false)} />}
    </span>
  );
}

/** Список стран: флаг · название · код, поиск по названию и коду; популярные сверху, остальные по алфавиту. */
function CountryList({ current, rect, anchor, onPick, onClose }: { current: CountryCode; rect: { left: number; top: number; bottom: number } | null; anchor: React.RefObject<HTMLButtonElement | null>; onPick: (c: CountryCode) => void; onClose: () => void }) {
  const { lang, t } = useI18n();
  const [q, setQ] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  useEscape(true, onClose);
  useBackClose(true, onClose);
  useEffect(() => { const h = (e: MouseEvent) => { const el = e.target as Node; if (!ref.current?.contains(el) && !anchor.current?.contains(el)) onClose(); }; document.addEventListener("mousedown", h, true); return () => document.removeEventListener("mousedown", h, true); }, [anchor, onClose]);
  const all = useMemo(() => {
    const rows = getCountries().map((c) => ({ c, name: countryName(c, lang), code: "+" + getCountryCallingCode(c) }));
    const pop = POPULAR.map((c) => rows.find((r) => r.c === c)).filter((r): r is NonNullable<typeof r> => !!r);
    const rest = rows.filter((r) => !POPULAR.includes(r.c)).sort((a, b) => a.name.localeCompare(b.name, lang.toLowerCase()));
    return [...pop, ...rest];
  }, [lang]);
  const norm = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "");
  const qq = norm(q.trim()).replace(/^\+/, "");
  const list = qq ? all.filter((r) => norm(r.name).includes(qq) || r.code.slice(1).startsWith(qq) || r.c.toLowerCase() === qq) : all;
  const vw = typeof window !== "undefined" ? window.innerWidth : 1600, vh = typeof window !== "undefined" ? window.innerHeight : 1000;
  const left = rect ? Math.max(8, Math.min(rect.left, vw - 320 - 8)) : 8;
  const up = !!rect && rect.bottom + 360 > vh && rect.top - 360 > 0;
  const pos: CSSProperties = rect ? (up ? { position: "fixed", left, bottom: vh - rect.top + 4, zIndex: 650 } : { position: "fixed", left, top: rect.bottom + 4, zIndex: 650 }) : { position: "fixed", zIndex: 650 };
  return createPortal(
    <div data-overlay="1">
      <div className="fixed inset-0 bg-[rgba(10,16,28,.35)] md:hidden" style={{ zIndex: 649 }} onMouseDown={(e) => { e.stopPropagation(); onClose(); }} />
      <div ref={ref} data-sheet="fit" role="listbox" style={pos} className="flex max-h-[360px] w-[320px] flex-col overflow-hidden rounded-[12px] border border-line bg-surface p-1 shadow-[0_18px_44px_rgba(20,36,63,.16)] max-md:p-0" onMouseDown={(e) => e.stopPropagation()}>
        <div className="flex-none p-1 max-md:border-b max-md:border-[#f2f4f8] max-md:px-[18px] max-md:py-[10px]">
          <div className="relative"><IconSearch size={14} className="pointer-events-none absolute left-[9px] top-1/2 -translate-y-1/2 text-muted-2 max-md:left-[11px]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.common.search} autoFocus={kbAutoFocus()} className="w-full rounded-[9px] border border-line bg-bg-5 py-[8px] pl-[28px] pr-2 text-[13px] text-ink outline-none focus:border-blue max-md:rounded-[10px] max-md:bg-surface max-md:pl-8" /></div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto max-md:pb-[env(safe-area-inset-bottom)]">
          {list.map((r) => { const on = r.c === current; return (
            <button key={r.c} type="button" role="option" aria-selected={on} onClick={() => onPick(r.c)} className={`flex w-full cursor-pointer items-center gap-[10px] rounded-[9px] px-3 py-[7px] text-left text-[13.5px] max-md:rounded-none max-md:border-b max-md:border-[#f5f7fb] max-md:px-[18px] max-md:py-[12px] max-md:text-[14px] ${on ? "bg-blue-tint font-semibold text-blue-2" : "text-ink hover:bg-bg-3"}`}>
              <span className="text-[18px] leading-none" style={EMOJI}>{flagOf(r.c)}</span><span className="min-w-0 flex-1 truncate">{r.name}</span><span className="flex-none text-muted [font-variant-numeric:tabular-nums]">{r.code}</span>{on && <IconCheck size={15} className="flex-none text-blue-2" />}
            </button>); })}
          {list.length === 0 && <div className="px-3 py-[9px] text-[13px] text-muted">—</div>}
        </div>
      </div>
    </div>,
    document.body,
  );
}
