// Геолокация объекта застройщика: разбор ссылок на карты (Google / Яндекс / Apple / 2GIS / «lat, lng» / DMS)
// и обратное геокодирование через Nominatim (1 запрос/с, кэш). Сиды хранят адрес в стиле «İl, İlçe, Mahalle»
// («Анталья, Аксу, Алтынташ») — `reverseGeocode().text` собирается в том же формате.

import { googleReverse } from "@/app/geo-actions";

export type LatLng = { lat: number; lng: number };
export type GeoLang = "tr" | "ru" | "en";
export type GeoResult = { il: string; ilce: string; mahalle: string; text: string };

const NUM = "(-?\\d{1,3}(?:\\.\\d+)?)";
const okLat = (v: number) => Number.isFinite(v) && Math.abs(v) <= 90;
const okLng = (v: number) => Number.isFinite(v) && Math.abs(v) <= 180;
const mk = (lat: number, lng: number): LatLng | null => (okLat(lat) && okLng(lng) ? { lat, lng } : null);
/** Пара «a,b» — по умолчанию lat,lng; если первая не может быть широтой, а вторая может — меняем местами. */
const pair = (a: number, b: number, lngFirst = false): LatLng | null => {
  if (lngFirst) return mk(b, a) ?? mk(a, b);
  return mk(a, b) ?? mk(b, a);
};
const rx = (s: string, re: RegExp): [number, number] | null => {
  const m = s.match(re);
  return m ? [parseFloat(m[1]), parseFloat(m[2])] : null;
};

/** Строка похожа на ссылку (а не на адрес). */
export function isMapLink(s: string): boolean {
  const v = String(s || "").trim();
  return /^(https?:\/\/|www\.|maps\.|yandex\.|2gis\.|goo\.gl|maps\.app\.goo\.gl)/i.test(v);
}

/** Короткая ссылка-редирект: без запроса координаты не достать. */
export function isShortMapLink(s: string): boolean {
  const v = String(s || "").trim();
  return /(^|\/\/)(maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/|yandex\.[a-z.]+\/maps\/-\/|ya\.ru\/maps\/-\/|go\.2gis\.com|2gis\.[a-z.]+\/geo\/[^/?#]+$|maps\.apple\.com\/p\/|maps\.apple\/p\/)/i.test(v);
}

/** Градусы-минуты-секунды: 36°33'06.4"N 32°03'58.3"E (Google пишет их в имени места). */
function parseDms(s: string): LatLng | null {
  const re = /(\d{1,3})°\s*(\d{1,2})['′]\s*(\d{1,2}(?:\.\d+)?)?["″]?\s*([NSEW])/gi;
  const out: { v: number; h: string }[] = [];
  let m: RegExpExecArray | null;
  while ((m = re.exec(s))) {
    const v = parseInt(m[1], 10) + parseInt(m[2], 10) / 60 + (m[3] ? parseFloat(m[3]) : 0) / 3600;
    const h = m[4].toUpperCase();
    out.push({ v: h === "S" || h === "W" ? -v : v, h });
  }
  const lat = out.find((x) => x.h === "N" || x.h === "S"), lng = out.find((x) => x.h === "E" || x.h === "W");
  return lat && lng ? mk(lat.v, lng.v) : null;
}

/**
 * Координаты из ссылки на карту. `null` — не ссылка/не разобрать (в т.ч. короткие `maps.app.goo.gl`).
 * Google: `!3dlat!4dlng` (точка места — приоритет), `@lat,lng`, `q=`, `query=`, `ll=`, `destination=`, `place/lat,lng`;
 * Яндекс: `pt=lng,lat`, `ll=lng,lat`, `text=lat,lng`; Apple: `ll=lat,lng`; 2GIS: `/lng,lat`, `m=lng,lat`; просто «lat, lng».
 */
export function parseMapLink(input: string): LatLng | null {
  const raw = String(input || "").trim();
  if (!raw) return null;
  let s = raw;
  try { s = decodeURIComponent(raw); } catch { /* оставляем как есть */ }
  s = s.replace(/\s+/g, " ");
  const lower = s.toLowerCase();
  const yandex = /(^|\/\/|\.)(yandex\.[a-z]+|ya\.ru|maps\.yandex)/.test(lower);
  const gis = /(^|\/\/|\.)2gis\./.test(lower);

  let p: [number, number] | null;
  if (yandex) {
    // Яндекс: точка `pt` важнее центра `ll`; `text=lat,lng` — поиск по координатам.
    if ((p = rx(s, new RegExp(`[?&]pt=${NUM},${NUM}`)))) return pair(p[0], p[1], true);
    if ((p = rx(s, new RegExp(`[?&]text=${NUM},\\s?${NUM}`)))) return pair(p[0], p[1]);
    if ((p = rx(s, new RegExp(`[?&]whatshere\\[point\\]=${NUM},${NUM}`)))) return pair(p[0], p[1], true);
    if ((p = rx(s, new RegExp(`[?&]ll=${NUM},${NUM}`)))) return pair(p[0], p[1], true);
    return null;
  }
  if (gis) {
    if ((p = rx(s, new RegExp(`[?&]m=${NUM},${NUM}`)))) return pair(p[0], p[1], true);
    if ((p = rx(s, new RegExp(`\\/${NUM},${NUM}(?:[/?#]|$)`)))) return pair(p[0], p[1], true);
    return null;
  }
  // Google / Apple / прочие: везде lat,lng.
  if ((p = rx(s, new RegExp(`!3d${NUM}!4d${NUM}`)))) return pair(p[0], p[1]);
  if ((p = rx(s, new RegExp(`[?&](?:q|query|ll|sll|destination|daddr|saddr|center)=${NUM},\\s?${NUM}`)))) return pair(p[0], p[1]);
  if ((p = rx(s, new RegExp(`\\/place\\/${NUM},${NUM}`)))) return pair(p[0], p[1]);
  if ((p = rx(s, new RegExp(`\\/search\\/${NUM},\\s?${NUM}`)))) return pair(p[0], p[1]);
  if ((p = rx(s, new RegExp(`@${NUM},${NUM}`)))) return pair(p[0], p[1]);
  const dms = parseDms(s);
  if (dms) return dms;
  if (!/^https?:\/\//i.test(s) && (p = rx(s, new RegExp(`^${NUM}[,;\\s]\\s*${NUM}$`)))) return pair(p[0], p[1]);
  return null;
}

/** Адрес для показа: ссылка или пустая строка → `fallback` («Адрес не указан»). */
export function displayLoc(loc: string | undefined, fallback: string): string {
  const v = String(loc || "").trim();
  return !v || isMapLink(v) ? fallback : v;
}

/** Строка координат для инпутов (6 знаков, как в ссылках). */
export const fmtCoord = (v: number) => (Math.round(v * 1e6) / 1e6).toString();
/** Координаты из строковых полей проекта (`lng`/`lat`) → `[lat, lng]` или `null`. */
export function llOf(lng?: string, lat?: string): [number, number] | null {
  const a = parseFloat(String(lat ?? "").replace(",", ".")), b = parseFloat(String(lng ?? "").replace(",", "."));
  return okLat(a) && okLng(b) && String(lat ?? "").trim() !== "" && String(lng ?? "").trim() !== "" ? [a, b] : null;
}

// ---- Nominatim reverse: 1 запрос/с, кэш по точке+языку ----
const cache = new Map<string, GeoResult | null>();
let lastReq = 0;
let chain: Promise<unknown> = Promise.resolve();
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const stripMah = (s: string) => s.replace(/\s+(Mahallesi|Mah\.?|Mahalle|Köyü|Beldesi)$/i, "").replace(/\s+(махаллеси|махалле)$/i, "").trim();

type NomAddr = Record<string, string | undefined>;
export function pickGeo(a: NomAddr): Omit<GeoResult, "text"> {
  const il = a.province || a.state || a.region || "";
  const ilce = a.county || a.town || a.district || a.city_district || a.municipality || a.city || "";
  const mahalle = a.suburb || a.neighbourhood || a.quarter || a.village || a.hamlet || "";
  return { il: stripMah(il), ilce: stripMah(ilce), mahalle: stripMah(mahalle) };
}

/**
 * Обратное геокодирование точки → `{ il, ilce, mahalle, text }`, `text` = «İl, İlçe, Mahalle».
 * `lang: "tr"` — турецкие названия; `"ru"` — русские, если есть в OSM, иначе Nominatim сам отдаёт местные.
 */
export function reverseGeocode(lat: number, lng: number, lang: GeoLang = "tr"): Promise<GeoResult | null> {
  const key = `${lat.toFixed(5)},${lng.toFixed(5)},${lang}`;
  if (cache.has(key)) return Promise.resolve(cache.get(key) ?? null);
  const run = async (): Promise<GeoResult | null> => {
    // Google Geocoding через сервер (ключ `GOOGLE_MAPS_SERVER_KEY`), иначе Nominatim
    try { const g = await googleReverse(lat, lng, lang); if (g) { const res: GeoResult = { il: g.il, ilce: g.ilce, mahalle: g.semt, text: g.addr }; cache.set(key, res); return res; } } catch {}
    const wait = 1000 - (Date.now() - lastReq);
    if (wait > 0) await sleep(wait);
    lastReq = Date.now();
    try {
      const accept = lang === "tr" ? "tr" : lang === "ru" ? "ru,tr" : "en,tr";
      const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=16&accept-language=${accept}`, { headers: { Accept: "application/json" } });
      if (!r.ok) return null;
      const j = (await r.json()) as { address?: NomAddr; error?: string };
      if (!j || j.error || !j.address) { cache.set(key, null); return null; }
      const g = pickGeo(j.address);
      const parts = [g.il, g.ilce, g.mahalle].filter((x, i, arr) => x && arr.indexOf(x) === i);
      const res: GeoResult = { ...g, text: parts.join(", ") };
      cache.set(key, res);
      return res;
    } catch {
      return null;
    }
  };
  const p = chain.then(run, run);
  chain = p.catch(() => undefined);
  return p;
}

/** Язык кабинета → язык геокодера. */
export const geoLang = (lang: string): GeoLang => (lang === "TR" ? "tr" : lang === "EN" ? "en" : "ru");
