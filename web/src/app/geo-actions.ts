"use server";

// Разворачивание коротких ссылок на карты (maps.app.goo.gl, goo.gl/maps, yandex.ru/maps/-/…, go.2gis.com, maps.apple.com/p/…):
// браузер не может прочитать редирект чужого домена, поэтому идём по цепочке Location на сервере и достаём координаты
// из полной ссылки (`parseMapLink`) или, в крайнем случае, из HTML конечной страницы (`@lat,lng`).
// Используется формой объекта риэлтора (`AddForm.geoFind`) и кабинетом застройщика (`useMapLink`).
import { parseMapLink, type LatLng } from "@/lib/dev/geo";
import { getCurrentUser } from "@/lib/auth";

// Только вошедшие и только известные картографические хосты (аудит 23.10.2026: SSRF — сервер ходил по любому URL, в т. ч. внутренним).
const HOST_OK = /(^|\.)(goo\.gl|google\.[a-z.]+|yandex\.[a-z.]+|ya\.ru|2gis\.[a-z.]+|apple\.com|maps\.app\.goo\.gl|openstreetmap\.org|osm\.org)$/i;
const hostOk = (u: string) => { try { return HOST_OK.test(new URL(u).hostname); } catch { return false; } };
const signedIn = async () => !process.env.NEXT_PUBLIC_SUPABASE_URL || !!(await getCurrentUser());

// Важно: НЕ представляться браузером — с Chrome-UA Google отдаёт для maps.app.goo.gl HTML-заглушку (200) вместо 302 на карту;
// с нейтральным UA сразу приходит Location с координатами (проверено с сервера 07.10.2026).
const UA = "OnePlan-LinkResolver/1.0 (+https://one-plan.pro)";

export async function expandMapLink(url: string): Promise<LatLng | null> {
  let cur = String(url || "").trim().slice(0, 2000);
  if (!/^https?:\/\//i.test(cur)) cur = "https://" + cur;
  if (!(await signedIn())) return null;
  try {
    for (let hop = 0; hop < 6; hop++) {
      const direct = parseMapLink(cur);
      if (direct) return direct;
      if (!hostOk(cur)) return null;
      const r = await fetch(cur, { redirect: "manual", headers: { "user-agent": UA }, signal: AbortSignal.timeout(8000) });
      const loc = r.headers.get("location");
      if (loc) { cur = new URL(loc, cur).toString(); continue; }
      // Конечная страница без координат в адресе: ищем центр карты в HTML (Google кладёт `@lat,lng` в canonical/og-ссылки).
      const html = (await r.text()).slice(0, 400_000);
      const u = html.match(/https:\/\/(?:www\.)?google\.[a-z.]+\/maps\/[^"'<>\\\s]+/) ?? html.match(/https:\/\/yandex\.[a-z.]+\/maps\/[^"'<>\\\s]+/);
      if (u) { const fromUrl = parseMapLink(u[0].replace(/\\u0026|&amp;/g, "&")); if (fromUrl) return fromUrl; }
      const m = html.match(/@(-?\d{1,3}\.\d{3,}),(-?\d{1,3}\.\d{3,})/) ?? html.match(/center=(-?\d{1,3}\.\d{3,})%2C(-?\d{1,3}\.\d{3,})/i);
      if (m) return { lat: +m[1], lng: +m[2] };
      return null;
    }
  } catch (e) {
    console.warn("[geo] expandMapLink:", (e as Error).message);
  }
  return null;
}

// Обратное геокодирование Google (точка → адрес, İl/İlçe/Mahalle) — только с серверным ключом `GOOGLE_MAPS_SERVER_KEY`
// (ограничение по IP сервера; ключ сайта с ограничением по referrer веб-сервис Geocoding отклоняет). Без ключа → null,
// клиент тогда идёт в Nominatim.
export async function googleReverse(lat: number, lng: number, lang: string): Promise<{ addr: string; il: string; ilce: string; semt: string } | null> {
  const key = process.env.GOOGLE_MAPS_SERVER_KEY;
  if (!key || !(await signedIn())) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  try {
    const lc = lang.toLowerCase() === "tr" ? "tr" : lang.toLowerCase() === "en" ? "en" : "ru";
    const r = await fetch(`https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lng}&language=${lc}&key=${key}`, { cache: "no-store" });
    if (!r.ok) return null;
    const j = (await r.json()) as { status: string; results?: { formatted_address: string; address_components: { long_name: string; types: string[] }[] }[] };
    const res = j.results?.[0];
    if (j.status !== "OK" || !res) { if (j.status !== "ZERO_RESULTS") console.warn("[geo] google reverse:", j.status); return null; }
    const strip = (x: string) => x.replace(/\s+(Mahallesi|Mah\.?|Mahalle|Köyü|Beldesi)$/i, "").trim();
    const get = (...types: string[]) => { for (const t of types) { const c = res.address_components.find((x) => x.types.includes(t)); if (c) return strip(c.long_name); } return ""; };
    return { addr: res.formatted_address, il: get("administrative_area_level_1"), ilce: get("administrative_area_level_2"), semt: get("administrative_area_level_4", "sublocality_level_1", "sublocality", "neighborhood", "administrative_area_level_3") };
  } catch (e) { console.warn("[geo] google reverse:", (e as Error).message); return null; }
}
