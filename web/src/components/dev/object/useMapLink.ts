"use client";

// Общая логика поля «Ссылка на карту» (секция «Локация» и шаг «Основное» мастера):
// ссылка → `parseMapLink` → координаты (`apply`) → `reverseGeocode` → адрес (если он пуст или сам был ссылкой).
import { useCallback, useEffect, useRef, useState } from "react";
import { fmtCoord, geoLang, isMapLink, isShortMapLink, parseMapLink, reverseGeocode } from "@/lib/dev/geo";
import { expandMapLink } from "@/app/geo-actions";

export type LinkStatus =
  | { kind: "idle" }
  | { kind: "short" }
  | { kind: "expanding" }
  | { kind: "bad" }
  | { kind: "geocoding"; lat: number; lng: number }
  | { kind: "ok"; lat: number; lng: number; addr: string }
  | { kind: "geo_fail"; lat: number; lng: number };

export type MapLinkApply = (p: { lat: string; lng: string; addr?: string }) => void;

export function useMapLink({ lang, apply, canSetAddr, initialLink = "" }: { lang: string; apply: MapLinkApply; canSetAddr: () => boolean; initialLink?: string }) {
  const [link, setLink] = useState(initialLink);
  // Стартовый статус: ссылка из `loc` проекта, которую нельзя разобрать, сразу показывает подсказку.
  const [status, setStatus] = useState<LinkStatus>(() => {
    const v = initialLink.trim();
    if (!v || parseMapLink(v)) return { kind: "idle" };
    return { kind: isShortMapLink(v) ? "short" : "bad" };
  });
  const seq = useRef(0);
  const applyRef = useRef(apply);
  const canRef = useRef(canSetAddr);
  useEffect(() => { applyRef.current = apply; canRef.current = canSetAddr; }, [apply, canSetAddr]);

  /** Геокодирует точку; `force` — писать адрес даже если он уже заполнен (кнопка «Определить адрес по точке»). */
  const geocode = useCallback((lat: number, lng: number, force: boolean) => {
    const my = ++seq.current;
    setStatus({ kind: "geocoding", lat, lng });
    reverseGeocode(lat, lng, geoLang(lang)).then((g) => {
      if (my !== seq.current) return;
      if (!g || !g.text) { setStatus({ kind: "geo_fail", lat, lng }); return; }
      if (force || canRef.current()) applyRef.current({ lat: fmtCoord(lat), lng: fmtCoord(lng), addr: g.text });
      setStatus({ kind: "ok", lat, lng, addr: g.text });
    });
  }, [lang]);

  /** Ввод/вставка ссылки. */
  const onLink = useCallback((value: string) => {
    setLink(value);
    const v = value.trim();
    if (!v) { seq.current++; setStatus({ kind: "idle" }); return; }
    const p = parseMapLink(v);
    if (p) { applyRef.current({ lat: fmtCoord(p.lat), lng: fmtCoord(p.lng) }); geocode(p.lat, p.lng, false); return; }
    if (!isMapLink(v)) { seq.current++; setStatus({ kind: "bad" }); return; }
    // Короткая/неразборная ссылка — просим сервер пройти по редиректу и достать координаты.
    const my = ++seq.current;
    setStatus({ kind: "expanding" });
    void expandMapLink(v).then((r) => {
      if (my !== seq.current) return;
      if (!r) { setStatus({ kind: isShortMapLink(v) ? "short" : "bad" }); return; }
      applyRef.current({ lat: fmtCoord(r.lat), lng: fmtCoord(r.lng) });
      geocode(r.lat, r.lng, false);
    });
  }, [geocode]);

  return { link, setLink, status, onLink, geocode };
}
