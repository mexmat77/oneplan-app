"use server";

// Разворачивание коротких ссылок на карты (maps.app.goo.gl, goo.gl/maps, yandex.ru/maps/-/…, go.2gis.com, maps.apple.com/p/…):
// браузер не может прочитать редирект чужого домена, поэтому идём по цепочке Location на сервере и достаём координаты
// из полной ссылки (`parseMapLink`) или, в крайнем случае, из HTML конечной страницы (`@lat,lng`).
// Используется формой объекта риэлтора (`AddForm.geoFind`) и кабинетом застройщика (`useMapLink`).
import { parseMapLink, type LatLng } from "@/lib/dev/geo";

// Важно: НЕ представляться браузером — с Chrome-UA Google отдаёт для maps.app.goo.gl HTML-заглушку (200) вместо 302 на карту;
// с нейтральным UA сразу приходит Location с координатами (проверено с сервера 07.10.2026).
const UA = "OnePlan-LinkResolver/1.0 (+https://one-plan.pro)";

export async function expandMapLink(url: string): Promise<LatLng | null> {
  let cur = String(url || "").trim();
  if (!/^https?:\/\//i.test(cur)) cur = "https://" + cur;
  try {
    for (let hop = 0; hop < 6; hop++) {
      const direct = parseMapLink(cur);
      if (direct) return direct;
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
  if (!key) return null;
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
