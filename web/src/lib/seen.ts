// «Когда был(а)» — единый формат активности (22.10.2026): онлайн (<5 мин), относительное время через Intl.RelativeTimeFormat
// («5 мин назад», «2 ч назад», «вчера», «3 дн назад»), старше недели — дата. Для админки, команды и чата.
import type { Lang } from "@/i18n";

export const ONLINE_MS = 5 * 60e3;
const LOC: Record<Lang, string> = { RU: "ru", EN: "en", TR: "tr" };

export type SeenInfo = { online: boolean; ms: number | null; label: string };

export function seenInfo(iso: string | null | undefined, lang: Lang, now = Date.now(), dict: { online: string; never: string }): SeenInfo {
  if (!iso) return { online: false, ms: null, label: dict.never };
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return { online: false, ms: null, label: dict.never };
  const ms = Math.max(0, now - t);
  if (ms < ONLINE_MS) return { online: true, ms, label: dict.online };
  const loc = LOC[lang] ?? "ru";
  const rtf = new Intl.RelativeTimeFormat(loc, { numeric: "auto" });
  const min = Math.round(ms / 60e3), h = Math.round(ms / 3600e3), d = Math.round(ms / 86400e3);
  let label: string;
  if (min < 60) label = rtf.format(-min, "minute");
  else if (h < 24) label = rtf.format(-h, "hour");
  else if (d < 7) label = rtf.format(-d, "day");
  else label = new Date(t).toLocaleDateString(loc === "en" ? "en-GB" : loc, { day: "2-digit", month: "2-digit", year: "numeric" });
  return { online: false, ms, label };
}

/** Точная дата-время для подсказки. */
export function seenExact(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return "";
  const loc = LOC[lang] ?? "ru";
  return new Date(iso).toLocaleString(loc === "en" ? "en-GB" : loc, { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}
