"use client";

// Global toast — the prototype's `showToast` (line 2527) and markup (lines 2177–2179):
// fixed bottom 88px, dark pill, 2400 ms, a new toast replaces the pending timer.
import { useSyncExternalStore } from "react";

let msg = "";
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());

export function showToast(m: string, ms = 2400) {
  msg = m;
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => { msg = ""; emit(); }, ms);
}

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function ToastHost() {
  const m = useSyncExternalStore(subscribe, () => msg, () => "");
  if (!m) return null;
  return (
    <div className="pointer-events-none fixed bottom-[88px] left-1/2 z-[500] max-w-[90vw] -translate-x-1/2 rounded-[12px] bg-ink px-5 py-3 text-[13.5px] text-white shadow-[0_12px_34px_rgba(20,36,63,.35)]" style={{ animation: "opl-card .2s ease" }}>
      {m}
    </div>
  );
}
