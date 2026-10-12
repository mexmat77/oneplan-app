"use client";

// Global toast — the prototype's `showToast` (line 2527) and markup (lines 2177–2179):
// fixed bottom 88px, dark pill, 2400 ms, a new toast replaces the pending timer.
import { useSyncExternalStore } from "react";

let msg = "";
let action: { label: string; onClick: () => void } | null = null;
let timer: ReturnType<typeof setTimeout> | undefined;
const listeners = new Set<() => void>();
const emit = () => { snap++; listeners.forEach((l) => l()); };

export function showToast(m: string, ms = 2400, act?: { label: string; onClick: () => void }) {
  msg = m; action = act ?? null;
  emit();
  clearTimeout(timer);
  timer = setTimeout(() => { msg = ""; action = null; emit(); }, ms);
}
/** Тост с «Отменить» (12.10.2026, стандарт вместо подтверждений для обратимых действий): 5 с на отмену. */
export function showUndo(m: string, onUndo: () => void, label = "Отменить") { showToast(m, 5000, { label, onClick: () => { clearTimeout(timer); msg = ""; action = null; emit(); onUndo(); } }); }
let snap = 0;
const getSnap = () => snap;

const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function ToastHost() {
  useSyncExternalStore(subscribe, getSnap, () => 0);
  const m = msg, a = action;
  if (!m) return null;
  return (
    <div className="fixed bottom-[88px] left-1/2 z-[500] max-w-[90vw] -translate-x-1/2 rounded-[12px] bg-ink px-5 py-3 text-[13.5px] text-white shadow-[0_12px_34px_rgba(20,36,63,.35)]" style={{ animation: "opl-card .2s ease" }}>
      {m}{a && <button type="button" onClick={a.onClick} className="ml-4 cursor-pointer rounded-[6px] bg-white/15 px-3 py-1 text-[13px] font-semibold text-white hover:bg-white/25">{a.label}</button>}
    </div>
  );
}
