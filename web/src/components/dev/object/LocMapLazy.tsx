"use client";

// Ленивая обёртка над `LocMap` (Leaflet не рендерится на сервере). Используется в секции «Локация»,
// мастере нового объекта и на публичной странице объекта.
import dynamic from "next/dynamic";
import type { LocMapProps } from "./LocMap";

export const LocMapLazy = dynamic<LocMapProps>(() => import("./LocMap"), {
  ssr: false,
  loading: () => <div className="w-full rounded-[12px] bg-line-2" style={{ height: 280 }} />,
});
