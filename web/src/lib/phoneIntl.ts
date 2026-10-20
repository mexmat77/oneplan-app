// Международные телефоны (20.10.2026, «маска, чтобы не ошибались; турецкие всегда +90 5…; флаг страны и подсказка»):
// база номеров libphonenumber (та же, что у Google/WhatsApp) — коды и форматы всех стран, определение страны по номеру.
// Храним и показываем номер в международном виде с пробелами («+90 505 123 45 67»); для дублей/ссылок — цифры (`normPh`).
// Полные метаданные (`/max`, +70 КБ): нужны типы номеров (мобильный / городской) и их длины — «лишние цифры не вводятся»,
// как в WhatsApp (20.10.2026, вопрос пользователя «WhatsApp знает длины номеров в разных странах — собрать, чтобы лишнее не
// записывали»): у турецкого мобильного 10 цифр, у украинского 9, у немецкого 10–11, у США ровно 10.
import { AsYouType, getCountries, getCountryCallingCode, parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js/max";
import { getExampleNumber, Metadata } from "libphonenumber-js/core";
import metadataMax from "libphonenumber-js/metadata.max.json";
import examples from "libphonenumber-js/examples.mobile.json";
import type { Lang } from "@/i18n";

export const DEFAULT_COUNTRY: CountryCode = "TR";

/** Набор без «+» приводим к международному: 00… → +…; 0 5xx / 5xx → +90 5xx; 90… → +90…; 8 9xx (11 цифр) → +7 …; иначе «+» + цифры. */
export function toIntlDigits(raw: string, def: CountryCode = DEFAULT_COUNTRY): string {
  const s = String(raw ?? "").trim();
  if (!s) return "";
  const plus = s.startsWith("+");
  let d = s.replace(/\D/g, "");
  if (!d) return plus ? "+" : "";
  if (plus) return "+" + d;
  if (d.startsWith("00")) return "+" + d.slice(2);
  if (def === "TR") {
    if (d.startsWith("90") && d.length >= 4) return "+" + d;
    if (d.startsWith("0")) d = d.slice(1);
    if (d.startsWith("5")) return "+90" + d;
  }
  if (d.startsWith("8") && d.length === 11) return "+7" + d.slice(1); // российская привычка «8 9xx»
  if (d.startsWith("7") && d.length === 11) return "+" + d;
  return "+" + d;
}

/** Страна по коду, когда сам номер невалиден и библиотека страну не называет (+44 → GB, +1 → US — первая страна кода). */
const MAIN_OF_CODE: Record<string, CountryCode> = { "1": "US", "7": "RU", "44": "GB", "61": "AU", "39": "IT", "47": "NO", "212": "MA", "262": "RE", "358": "FI", "590": "GP", "599": "CW" }; // главная страна общего кода
function countryByCode(code: string): CountryCode | null {
  if (MAIN_OF_CODE[code]) return MAIN_OF_CODE[code];
  try { return getCountries().find((c) => getCountryCallingCode(c) === code) ?? null; } catch { return null; }
}
export type PhoneInfo = { e164: string; intl: string; country: CountryCode | null; valid: boolean };

/** Разбор любого ввода: международный формат, страна, валидность. Пустой/невалидный набор — intl как есть. */
export function phoneInfo(raw: string, def: CountryCode = DEFAULT_COUNTRY): PhoneInfo {
  const intl = toIntlDigits(raw, def);
  if (!intl || intl === "+") return { e164: "", intl, country: null, valid: false };
  const p = parsePhoneNumberFromString(intl, def);
  if (!p) return { e164: intl, intl: new AsYouType(def).input(intl), country: null, valid: false };
  return { e164: p.number, intl: p.formatInternational(), country: p.country ?? countryByCode(p.countryCallingCode), valid: p.isValid() };
}

/** Форматирование по мере ввода (пробелы по группам страны), курсор в конце. */
export function formatAsYouType(raw: string, def: CountryCode = DEFAULT_COUNTRY): string {
  const intl = toIntlDigits(raw, def);
  if (!intl) return "";
  return new AsYouType(def).input(intl);
}

/** Страна по уже сохранённому номеру (для флага рядом с номером). */
export function countryOf(raw: string, def: CountryCode = DEFAULT_COUNTRY): CountryCode | null {
  const p = parsePhoneNumberFromString(toIntlDigits(raw, def), def);
  return p ? p.country ?? countryByCode(p.countryCallingCode) : null;
}

/** Флаг — эмодзи из кода страны (без картинок, рисует система). */
export function flagOf(cc: CountryCode | null | undefined): string {
  if (!cc || cc.length !== 2) return "🌐";
  return String.fromCodePoint(...cc.toUpperCase().split("").map((ch) => 0x1f1e6 + ch.charCodeAt(0) - 65));
}

type TypedMeta = Metadata & { type(t: string): { possibleLengths(): number[] } | undefined };
let metaCache: TypedMeta | null = null;
function meta(cc: CountryCode): TypedMeta | null {
  try { metaCache ??= new Metadata(metadataMax as unknown as ConstructorParameters<typeof Metadata>[0]) as TypedMeta; metaCache.selectNumberingPlan(cc); return metaCache; } catch { return null; }
}
const max = (a: number[] | undefined) => (a && a.length ? Math.max(...a) : 0);

/** Сколько цифр национального номера может быть у страны вообще (TR 13, US 10, DE 15). 0 — неизвестно. */
export function maxNationalLength(cc: CountryCode): number {
  const m = meta(cc);
  return m?.numberingPlan ? max(m.numberingPlan.possibleLengths()) : 0;
}

/** Обрезает лишние цифры национального номера, как WhatsApp: 1) не длиннее максимума страны; 2) как только набранный
 *  префикс стал полным валидным номером своего типа (мобильный TR — 10 цифр) и тип длиннее не бывает — дальше не принимаем
 *  (в Германии мобильные 10–11 цифр, городские до 15 — там продолжаем). Невалидный, но возможный по длине набор не режем. */
export function fitNationalDigits(cc: CountryCode, digits: string): string {
  let d = digits.replace(/\D/g, "");
  const m = meta(cc);
  if (!m?.numberingPlan) return d;
  const cap = max(m.numberingPlan.possibleLengths());
  if (cap && d.length > cap) d = d.slice(0, cap);
  const code = "+" + getCountryCallingCode(cc);
  for (let k = 1; k < d.length; k++) {
    const p = parsePhoneNumberFromString(code + d.slice(0, k), cc);
    if (!p || p.country !== cc || !p.isValid()) continue;
    const t = p.getType();
    const lens = t === "FIXED_LINE_OR_MOBILE" ? [...(m.type("FIXED_LINE")?.possibleLengths() ?? []), ...(m.type("MOBILE")?.possibleLengths() ?? [])]
      : t ? m.type(t)?.possibleLengths() : m.numberingPlan.possibleLengths();
    const tmax = max(lens);
    if (tmax && k >= tmax) return d.slice(0, k);
  }
  return d;
}

/** То же для международной строки «+90505…»: страна — по коду, лишние цифры отбрасываются. */
export function fitIntlDigits(intl: string, def: CountryCode = DEFAULT_COUNTRY): string {
  const s = toIntlDigits(intl, def);
  const p = s.length > 2 ? parsePhoneNumberFromString(s, def) : undefined;
  if (!p) return s;
  const cc = p.country ?? countryByCode(p.countryCallingCode);
  if (!cc) return s;
  return "+" + p.countryCallingCode + fitNationalDigits(cc, p.nationalNumber);
}

/** Пример мобильного номера страны без кода («501 234 56 78») — подсказка в пустом поле. */
export function exampleNational(cc: CountryCode): string {
  try {
    const ex = getExampleNumber(cc, examples as unknown as Parameters<typeof getExampleNumber>[1], metadataMax as unknown as Parameters<typeof getExampleNumber>[2]);
    if (!ex) return "";
    const code = "+" + ex.countryCallingCode;
    const f = ex.formatInternational();
    return f.startsWith(code) ? f.slice(code.length).trim() : f;
  } catch { return ""; }
}

const LOC: Record<Lang, string> = { RU: "ru", EN: "en", TR: "tr" };
/** Название страны на языке интерфейса (Intl.DisplayNames; запасной вариант — код). */
export function countryName(cc: CountryCode | null | undefined, lang: Lang): string {
  if (!cc) return "";
  try { return new Intl.DisplayNames([LOC[lang] ?? "ru"], { type: "region" }).of(cc) ?? cc; } catch { return cc; }
}
