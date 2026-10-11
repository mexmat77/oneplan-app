"use client";

// Prototype `isMobW = window.innerWidth < 760` (line 3448), re-evaluated on resize — here via matchMedia.
import { useSyncExternalStore } from "react";

const QUERY = "(max-width: 759px)";
function subscribe(cb: () => void) {
  const mq = window.matchMedia(QUERY);
  mq.addEventListener("change", cb);
  return () => mq.removeEventListener("change", cb);
}
export function useMobile(): boolean {
  return useSyncExternalStore(subscribe, () => window.matchMedia(QUERY).matches, () => false);
}
