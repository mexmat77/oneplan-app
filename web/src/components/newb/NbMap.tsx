"use client";

import { useEffect, useRef } from "react";
import L from "leaflet";
import { createMap, makeResizable } from "@/lib/mapBase";
import "leaflet/dist/leaflet.css";

// Project location map `#nb-map` — prototype `_syncNbMap` (lines 2653–2666): zoom 14, no wheel zoom, pin with the complex name.
// OSM tiles instead of CARTO (accepted deviation: CARTO needs a key).
export default function NbMap({ ll, label }: { ll: [number, number]; label: string }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const map = createMap(el, { center: ll, zoom: 14, scrollWheelZoom: false });
    const unsize = makeResizable(el, map);
    L.marker(ll, { icon: L.divIcon({ className: "", html: `<div class="opl-pin">${label}</div>`, iconSize: undefined }) }).addTo(map);
    setTimeout(() => map.invalidateSize(), 60);
    return () => { unsize(); map.remove(); };
  }, [ll, label]);
  return <div ref={ref} id="nb-map" className="relative z-0 h-[280px] overflow-hidden rounded-[12px] bg-line-2 [isolation:isolate]" />;
}
