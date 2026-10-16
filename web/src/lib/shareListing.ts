// Текст объявления для отправки (16.10.2026, «в мессенджеры — чтобы ссылка и описание были сразу, и в чат тоже»).
// Одна точка правды: кнопка «Поделиться» на странице объекта (система / WhatsApp / Telegram / чат OnePlan / копировать),
// кнопки связи с риэлтором-владельцем (WhatsApp/Telegram/чат — готовое приветствие с номером и ссылкой на объект).
import type { Dict, Lang } from "@/i18n";
import { geoAddr, listingNo, priceLabel } from "@/lib/detail";
import type { Listing } from "@/lib/types";

export const SITE = "https://one-plan.pro";
export const listingUrl = (id: string) => `${typeof window !== "undefined" && /^https?:/.test(window.location.origin) ? window.location.origin : SITE}/obj/${id}`;

/** Для клиента/коллеги: заголовок · цена · адрес, ссылка отдельной строкой (превью ссылки рисует OG-обложка). */
export function listingShareText(o: Listing, lang: Lang, t: Dict): string {
  return `${o.t[lang]} · ${priceLabel(o, t)} · ${geoAddr(o, lang)}\n${listingUrl(o.id)}`;
}
/** Владельцу объекта: приветствие с номером, названием и ссылкой — он сразу понимает, о чём речь. */
export function listingContactText(o: Listing, lang: Lang, t: Dict): string {
  return t.obj.contactMsg.replace("{no}", listingNo(o)).replace("{title}", o.t[lang]).replace("{url}", listingUrl(o.id));
}
const enc = encodeURIComponent;
export const waTo = (digits: string, text?: string) => `https://wa.me/${digits}${text ? `?text=${enc(text)}` : ""}`;
export const tgTo = (target: string, text?: string) => `https://t.me/${target}${text ? `?text=${enc(text)}` : ""}`;
export const waShare = (text: string) => `https://wa.me/?text=${enc(text)}`;
export const tgShare = (url: string, text: string) => `https://t.me/share/url?url=${enc(url)}&text=${enc(text.replace(url, "").trim())}`;
export const chatShareHref = (text: string, withId?: string) => `/chat?${withId ? `with=${withId}&` : ""}text=${enc(text)}`;
/** Ссылки в тексте сообщения чата — кликабельные. */
export function linkify(text: string): (string | { url: string })[] {
  const re = /https?:\/\/[^\s<>"']+/g; const out: (string | { url: string })[] = []; let i = 0;
  for (const m of text.matchAll(re)) { if (m.index! > i) out.push(text.slice(i, m.index)); out.push({ url: m[0] }); i = m.index! + m[0].length; }
  if (i < text.length) out.push(text.slice(i)); return out;
}
