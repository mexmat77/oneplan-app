"use client";

// Touch swipe over a `[data-strip]` slider — port of the prototype's `_swS/_swM/_swE` (lines 2607–2618):
// the strip follows the finger, snaps back, and `onDir(±1)` fires when the drag exceeds max(40px, 16% width).
import { useRef, type TouchEvent } from "react";

export function useSwipe(onDir: (d: 1 | -1) => void) {
  const s = useRef({ tx: 0, ty: 0, drag: false, el: null as HTMLElement | null, w: 1, i: 0 });
  const onTouchStart = (e: TouchEvent<HTMLElement>) => {
    const t = e.touches[0];
    const el = e.currentTarget.querySelector<HTMLElement>("[data-strip]");
    let i = 0;
    if (el) { const m = /translateX\(-?([\d.]+)%\)/.exec(el.style.transform || ""); i = m ? Math.round(+m[1] / 100) : 0; }
    s.current = { tx: t.clientX, ty: t.clientY, drag: false, el, w: e.currentTarget.clientWidth || 1, i };
  };
  const onTouchMove = (e: TouchEvent<HTMLElement>) => {
    const t = e.touches[0], c = s.current;
    const dx = t.clientX - c.tx, dy = t.clientY - c.ty;
    if (!c.drag && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) c.drag = true;
    if (c.drag && c.el) { c.el.style.transition = "none"; c.el.style.transform = `translateX(calc(-${c.i * 100}% + ${dx}px))`; }
  };
  const onTouchEnd = (e: TouchEvent<HTMLElement>) => {
    const c = s.current, el = c.el, t = e.changedTouches[0];
    const dx = t.clientX - c.tx, dy = t.clientY - c.ty;
    if (el) el.style.transition = "transform .35s cubic-bezier(.22,.61,.36,1)";
    if (c.drag && Math.abs(dx) > Math.max(40, c.w * 0.16) && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (el) el.style.transform = `translateX(-${c.i * 100}%)`;
      onDir(dx < 0 ? 1 : -1);
    } else if (el) el.style.transform = `translateX(-${c.i * 100}%)`;
  };
  return { onTouchStart, onTouchMove, onTouchEnd };
}
