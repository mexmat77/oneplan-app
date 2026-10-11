"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { createMap, makeResizable } from "@/lib/mapBase";
import "leaflet/dist/leaflet.css";
import { geoKeysOf } from "@/lib/seed";
import { geoUrl } from "@/lib/geo";
import { googleReverse } from "@/app/geo-actions";

const PIN = L.divIcon({
  className: "",
  html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#3b5fd6;border:3px solid #fff;box-shadow:0 3px 10px rgba(10,16,28,.35)"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

export type GeoNames = { il: string; ilce: string; semt: string };

// Метка поставлена кликом/перетаскиванием: масштаб пользователя не трогаем (замечание 09.10.2026 — «карта резко
// уменьшается, пугает»). Метка пришла извне (подсказка адреса, ссылка, координаты): карта приближается к ней (не мельче 15),
// иначе точка на обзорной карте провинции неразличима.
const show = (m: L.Map, ll: [number, number], own: boolean) => {
  if (own) { if (!m.getBounds().contains(ll)) m.panTo(ll); return; }
  m.setView(ll, Math.max(m.getZoom(), 15));
};

// Pin picker for the listing form — prototype `_syncAddMap` / `_flyAddArea` (lines 2696–2724):
// click to place, drag to adjust; when İl/İlçe/Semt change the map fits the area from Nominatim
// (maxZoom 15 / 13 / 10). OSM tiles instead of CARTO — accepted deviation.
export default function AddMap({ ll, geo, onPick }: { ll: [number, number] | null; geo: GeoNames; onPick: (ll: [number, number]) => void }) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const cb = useRef(onPick);
  const geoSig = useRef<string | undefined>(undefined);
  const own = useRef(false); // метка поставлена на самой карте (клик/перетаскивание), а не из адреса/ссылки
  useEffect(() => { cb.current = onPick; }, [onPick]);

  useEffect(() => {
    const el = ref.current;
    if (!el || map.current) return;
    const m = createMap(el, { scrollWheelZoom: false }).setView([36.89, 30.71], 10);
    const unsize = makeResizable(el, m);
    m.on("click", (e) => { own.current = true; cb.current([e.latlng.lat, e.latlng.lng]); });
    map.current = m;
    if (process.env.NODE_ENV !== "production") (window as unknown as { __oplAddMap?: L.Map }).__oplAddMap = m; // отладка
    setTimeout(() => { if (map.current === m) m.invalidateSize(); }, 60);
    return () => { unsize(); m.remove(); map.current = null; pin.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (ll && !pin.current) {
      const p = L.marker(ll, { draggable: true, icon: PIN }).addTo(m);
      p.on("dragend", () => { own.current = true; const q = p.getLatLng(); cb.current([q.lat, q.lng]); });
      pin.current = p;
      show(m, ll, own.current); own.current = false;
    } else if (ll && pin.current) {
      pin.current.setLatLng(ll);
      show(m, ll, own.current); own.current = false;
    } else if (!ll && pin.current) {
      m.removeLayer(pin.current);
      pin.current = null;
    }
  }, [ll]);

  // `_flyAddArea`: при смене İl/İlçe/Semt (из окна выбора) карта кадрируется по ГРАНИЦЕ зоны из нашей базы (`/api/geo`,
  // те же полигоны, что в каталоге), Nominatim — только запасной вариант для провинции. Если метка уже стоит, вид НЕ
  // меняется: выбранный пользователем масштаб сохраняется (замечание пользователя 09.10.2026 — «карта резко уменьшается»).
  useEffect(() => {
    const sig = `${geo.il}|${geo.ilce}|${geo.semt}`;
    if (sig === geoSig.current) return;
    const first = geoSig.current === undefined;
    geoSig.current = sig;
    if (first && ll) return;
    if (!geo.il) return;
    // ответ применяется, пока выбор не сменился (не флаг «живости»: в dev React запускает эффект дважды, и первый ответ терялся)
    const apply = (b: L.LatLngBounds) => {
      const m = map.current;
      if (geoSig.current !== sig || !m || !b.isValid()) return;
      if (pin.current) return; // метка стоит (район/махалле пришли от неё же) — вид не меняем
      m.fitBounds(b, { padding: [20, 20], maxZoom: geo.semt ? 15 : geo.ilce ? 13 : 10 });
    };
    (async () => {
      const k = geoKeysOf(geo.il, geo.ilce, geo.semt);
      try {
        const url = k.semt ? geoUrl(`level=mahalle&k=${encodeURIComponent(k.semt)}`) : k.ilce ? geoUrl(`level=ilce&il=${encodeURIComponent(k.il)}`) : "";
        if (url) {
          const r = await fetch(url);
          if (r.ok) {
            const j = (await r.json()) as { features?: { properties: { k: string }; geometry: GeoJSON.Geometry }[] };
            const ft = (j.features ?? []).find((f) => f.properties.k === (k.semt || k.ilce)) ?? (k.semt ? j.features?.[0] : undefined);
            if (ft?.geometry) { apply(L.geoJSON(ft.geometry).getBounds()); return; }
          }
        }
      } catch {}
      // запасной вариант — Nominatim (провинция или зона без полигона)
      const q = [geo.semt, geo.ilce, geo.il, "Türkiye"].filter(Boolean).join(", ");
      try {
        const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`);
        const j = r.ok ? await r.json() : null;
        if (j && j[0]) { const b = (j[0].boundingbox as string[]).map(Number); apply(L.latLngBounds([b[0], b[2]], [b[1], b[3]])); }
      } catch {}
    })();
  }, [geo.il, geo.ilce, geo.semt, ll]);

  return <div ref={ref} id="add-map" className="relative z-0 h-[300px] overflow-hidden rounded-[12px] bg-line-2 [isolation:isolate]" />;
}

// Reverse-geocode a pin into İl / İlçe / Mahalle names: Google Geocoding через сервер (если задан `GOOGLE_MAPS_SERVER_KEY`),
// иначе Nominatim с турецкими названиями.
export async function reverseGeocode(ll: [number, number]): Promise<{ addr: string; il: string; ilce: string; semt: string } | null> {
  try { const g = await googleReverse(ll[0], ll[1], "tr"); if (g) return g; } catch {}
  try {
    const r = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&accept-language=tr&lat=${ll[0]}&lon=${ll[1]}`);
    if (!r.ok) return null;
    const j = await r.json();
    const a = j.address || {};
    const strip = (x: string) => String(x || "").replace(/\s+(Mahallesi|Mah\.?|Mahalle|Köyü|Beldesi)$/i, "").trim(); // «Selçuk Mahallesi» → «Selçuk», иначе ключ не находится
    return {
      addr: j.display_name || "",
      il: strip(a.province || a.state || ""),
      ilce: strip(a.county || a.town || a.district || ""),
      semt: strip(a.suburb || a.neighbourhood || a.quarter || a.village || ""),
    };
  } catch {
    return null;
  }
}
