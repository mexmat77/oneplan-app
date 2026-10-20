"use client";

// Поле телефона с международной маской (20.10.2026): форматирует по мере ввода по правилам страны (libphonenumber), набор
// без «+» приводит к международному (5xx → +90 5xx, 05xx → +90 5xx, 90… → +90…, 8 9xx → +7), слева — флаг определённой
// страны (подсказка с названием при наведении), невалидный номер — красная рамка после ухода с поля. Значение наружу —
// «+90 505 123 45 67» (международный вид с пробелами), как хранилось и раньше.
import { useState, type CSSProperties } from "react";
import { useI18n } from "@/i18n/provider";
import { countryName, flagOf, formatAsYouType, phoneInfo } from "@/lib/phoneIntl";

export function PhoneInput({ value, onChange, className = "", placeholder = "+90 5xx xxx xx xx", disabled, autoFocus, onKeyDown, style, id }: {
  value: string; onChange: (v: string) => void; className?: string; placeholder?: string; disabled?: boolean; autoFocus?: boolean;
  onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void; style?: CSSProperties; id?: string;
}) {
  const { lang } = useI18n();
  const [touched, setTouched] = useState(false);
  const info = phoneInfo(value);
  const bad = touched && !!value.trim() && !info.valid;
  const title = info.country ? `${countryName(info.country, lang)} · ${info.country}` : "";
  return (
    <span className="relative block">
      <span title={title} aria-label={title} className="pointer-events-auto absolute left-[10px] top-1/2 -translate-y-1/2 select-none text-[18px] leading-none" style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}>{flagOf(info.country)}</span>
      <input id={id} value={value} onChange={(e) => onChange(formatAsYouType(e.target.value))} onBlur={() => { setTouched(true); if (value.trim()) onChange(info.intl); }} onKeyDown={onKeyDown}
        inputMode="tel" autoComplete="tel" placeholder={placeholder} disabled={disabled} autoFocus={autoFocus} title={title}
        className={`${className} !pl-[38px] [font-variant-numeric:tabular-nums] ${bad ? "!border-red" : ""}`} style={style} />
    </span>
  );
}
