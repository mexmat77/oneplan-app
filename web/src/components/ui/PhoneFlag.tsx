"use client";

// Флаг страны рядом с номером (20.10.2026): страна по коду номера (libphonenumber), при наведении — название страны.
// Для чужих/неразобранных номеров — глобус. Используется там, где показывается телефон: контакты карточки, список, сделка.
import { useI18n } from "@/i18n/provider";
import { countryName, countryOf, flagOf } from "@/lib/phoneIntl";

export function PhoneFlag({ value, className = "" }: { value: string | null | undefined; className?: string }) {
  const { lang } = useI18n();
  if (!value) return null;
  const cc = countryOf(value);
  const title = cc ? `${countryName(cc, lang)} · ${cc}` : "";
  return <span title={title} aria-label={title} className={`inline-block select-none align-[-2px] text-[15px] leading-none ${className}`} style={{ fontFamily: '"Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif' }}>{flagOf(cc)}</span>;
}
