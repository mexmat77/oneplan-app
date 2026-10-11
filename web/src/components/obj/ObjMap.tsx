"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { createMap, makeResizable } from "@/lib/mapBase";
import "leaflet/dist/leaflet.css";

// OSM standard tiles need no API key (the prototype's CARTO Voyager tiles do) — accepted deviation.

// Single-listing map with the price pin — prototype `_syncObjMap` (lines 2587–2606):
// zoom 14, pin `Math.round(price/100000)/10+'M ₺'`, plain `.opl-pin` (no status classes).
// `label`/`status` stay accepted for other callers (newb page) — status classes are not applied here.
export default function ObjMap({ ll, price, label, status: _status }: { ll: [number, number]; price?: number; label?: string; status?: string }) {
  void _status;
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const map = createMap(el, { center: ll, zoom: 14, scrollWheelZoom: false });
    const unsize = makeResizable(el, map);
    const pin = price !== undefined ? `${Math.round(price / 100000) / 10}M ₺` : label || "";
    L.marker(ll, { icon: L.divIcon({ className: "", html: `<div class="opl-pin">${pin}</div>`, iconSize: undefined }) }).addTo(map);
    map.setView(ll, 14);
    const tm = setTimeout(() => map.invalidateSize(), 60);
    return () => { clearTimeout(tm); unsize(); map.remove(); };
  }, [ll, price, label]);

  return <div ref={ref} id="obj-map" className="h-[320px] bg-line-2" />;
}
