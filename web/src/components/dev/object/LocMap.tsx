"use client";

// Карта локации объекта (Leaflet + OSM-тайлы; вместо заглушки-градиента прототипа, §1.7 `#sec-loc`).
// Импортировать только через `LocMapLazy` (next/dynamic, ssr:false) — Leaflet трогает `window` при импорте.
// Редактирование: клик ставит точку, маркер перетаскивается → `onPick(lat, lng)`; `readOnly` — только просмотр.
// Переключение на Яндекс.Карты (нужен API-ключ): заменить `L.tileLayer` на плагин Yandex-тайлов или
// отдельный компонент на `ymaps3` с теми же пропсами `ll / onPick / readOnly`.
import { useEffect, useRef } from "react";
import L from "leaflet";
import { createMap, makeResizable } from "@/lib/mapBase";
import "leaflet/dist/leaflet.css";

const PIN = L.divIcon({
  className: "",
  html: '<div style="width:26px;height:26px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);background:#4d7cfe;border:3px solid #fff;box-shadow:0 3px 10px rgba(20,36,63,.35)"></div>',
  iconSize: [26, 26],
  iconAnchor: [13, 26],
});

export const DEFAULT_CENTER: [number, number] = [36.9, 30.7]; // Анталья
export const DEFAULT_ZOOM = 10;
const PIN_ZOOM = 15;

export type LocMapProps = {
  /** `[lat, lng]` или `null` (точка не задана — центр по умолчанию). */
  ll: [number, number] | null;
  onPick?: (lat: number, lng: number) => void;
  readOnly?: boolean;
  height?: number;
  className?: string;
};

export default function LocMap({ ll, onPick, readOnly = false, height = 280, className = "" }: LocMapProps) {
  const ref = useRef<HTMLDivElement>(null);
  const map = useRef<L.Map | null>(null);
  const pin = useRef<L.Marker | null>(null);
  const cb = useRef(onPick);
  const ro = useRef(readOnly);
  useEffect(() => { cb.current = onPick; ro.current = readOnly; }, [onPick, readOnly]);

  useEffect(() => {
    const el = ref.current;
    if (!el || map.current) return;
    const m = createMap(el, { scrollWheelZoom: false }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    const unsize = makeResizable(el, m);
    m.on("click", (e) => { if (!ro.current) cb.current?.(e.latlng.lat, e.latlng.lng); });
    map.current = m;
    const t = setTimeout(() => m.invalidateSize(), 60);
    return () => { clearTimeout(t); unsize(); m.remove(); map.current = null; pin.current = null; };
  }, []);

  useEffect(() => {
    const m = map.current;
    if (!m) return;
    if (ll && !pin.current) {
      const p = L.marker(ll, { draggable: !readOnly, icon: PIN }).addTo(m);
      p.on("dragend", () => { const q = p.getLatLng(); cb.current?.(q.lat, q.lng); });
      pin.current = p;
      m.setView(ll, Math.max(m.getZoom(), PIN_ZOOM));
    } else if (ll && pin.current) {
      const cur = pin.current.getLatLng();
      if (Math.abs(cur.lat - ll[0]) > 1e-9 || Math.abs(cur.lng - ll[1]) > 1e-9) {
        pin.current.setLatLng(ll);
        m.setView(ll, Math.max(m.getZoom(), PIN_ZOOM));
      }
      if (readOnly) pin.current.dragging?.disable(); else pin.current.dragging?.enable();
    } else if (!ll && pin.current) {
      m.removeLayer(pin.current);
      pin.current = null;
      m.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
    }
  }, [ll, readOnly]);

  return <div ref={ref} className={`relative z-0 w-full overflow-hidden rounded-[12px] bg-line-2 [isolation:isolate] ${className}`} style={{ height }} />;
}
