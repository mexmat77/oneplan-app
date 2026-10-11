"use client";

// Google Places API (New) из браузера: подсказки адреса и детали места. Ключ `NEXT_PUBLIC_GOOGLE_MAPS_KEY` ограничен
// сайтом (HTTP referrer), поэтому им можно пользоваться только из браузера; обратное геокодирование (точка → адрес) —
// серверный экшен `googleReverse` с отдельным ключом `GOOGLE_MAPS_SERVER_KEY` (ограничение по IP), иначе Nominatim.
// Сессия подсказок (`sessionToken`) — Google считает подсказки + детали одной сессией, это дешевле.
export type GPlace = { lat: number; lng: number; addr: string; il: string; ilce: string; semt: string };
export type GSuggest = { id: string; main: string; secondary: string };

const KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY || "";
export const hasGoogle = () => !!KEY;
const langCode = (lang: string) => (lang.toLowerCase() === "tr" ? "tr" : lang.toLowerCase() === "en" ? "en" : "ru");
export const newSession = () => (typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : String(Date.now()) + Math.random());

export const stripMah = (s: string) => s.replace(/\s+(Mahallesi|Mah\.?|Mahalle|Köyü|Beldesi)$/i, "").replace(/\s+(махаллеси|махалле)$/i, "").trim();

type Comp = { longText?: string; long_name?: string; types: string[] };
/** İl / İlçe / Mahalle из компонентов адреса Google (Турция: level_1 = il, level_2 = ilçe, level_4 или sublocality = mahalle). */
export function pickGoogleGeo(comps: Comp[]): { il: string; ilce: string; semt: string } {
  const get = (...types: string[]) => { for (const t of types) { const c = comps.find((x) => x.types.includes(t)); if (c) return stripMah(c.longText ?? c.long_name ?? ""); } return ""; };
  return { il: get("administrative_area_level_1"), ilce: get("administrative_area_level_2"), semt: get("administrative_area_level_4", "sublocality_level_1", "sublocality", "neighborhood", "administrative_area_level_3") };
}

export async function placesAutocomplete(input: string, session: string, lang: string, bias?: [number, number] | null): Promise<GSuggest[]> {
  if (!KEY || input.trim().length < 3) return [];
  try {
    // только адреса/улицы/районы/здания (geocode), без заведений — как у площадок недвижимости
    const body: Record<string, unknown> = { input, sessionToken: session, languageCode: langCode(lang), includedRegionCodes: ["tr"], includedPrimaryTypes: ["geocode"] };
    if (bias) body.locationBias = { circle: { center: { latitude: bias[0], longitude: bias[1] }, radius: 50000 } };
    const r = await fetch("https://places.googleapis.com/v1/places:autocomplete", { method: "POST", headers: { "Content-Type": "application/json", "X-Goog-Api-Key": KEY }, body: JSON.stringify(body) });
    if (!r.ok) { console.warn("[google] autocomplete", r.status, await r.text()); return []; }
    const j = (await r.json()) as { suggestions?: { placePrediction?: { placeId: string; text?: { text: string }; structuredFormat?: { mainText?: { text: string }; secondaryText?: { text: string } } } }[] };
    return (j.suggestions ?? []).map((s) => s.placePrediction).filter(Boolean).map((p) => ({ id: p!.placeId, main: p!.structuredFormat?.mainText?.text ?? p!.text?.text ?? "", secondary: p!.structuredFormat?.secondaryText?.text ?? "" }));
  } catch (e) { console.warn("[google] autocomplete", (e as Error).message); return []; }
}

export async function placeDetails(id: string, session: string, lang: string): Promise<GPlace | null> {
  if (!KEY) return null;
  try {
    const r = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=${langCode(lang)}&sessionToken=${encodeURIComponent(session)}`, { headers: { "X-Goog-Api-Key": KEY, "X-Goog-FieldMask": "location,formattedAddress,addressComponents" } });
    if (!r.ok) { console.warn("[google] details", r.status, await r.text()); return null; }
    const j = (await r.json()) as { location?: { latitude: number; longitude: number }; formattedAddress?: string; addressComponents?: Comp[] };
    if (!j.location) return null;
    return { lat: j.location.latitude, lng: j.location.longitude, addr: j.formattedAddress ?? "", ...pickGoogleGeo(j.addressComponents ?? []) };
  } catch (e) { console.warn("[google] details", (e as Error).message); return null; }
}
