"use client";

// Body scroll-lock exactly like the prototype (lines 2582–2586): while any modal is open the body is
// `position:fixed; top:-scrollY` and the scroll position is restored on unlock. Several modals may be
// open at once, so locks are counted.
import { useEffect, useRef } from "react";

let locks = 0;
let lockY = 0;

function lock() {
  if (locks++ > 0) return;
  lockY = window.scrollY;
  const b = document.body.style;
  b.position = "fixed"; b.top = `${-lockY}px`; b.left = "0"; b.right = "0"; b.width = "100%"; b.overflow = "hidden";
}
function unlock() {
  if (--locks > 0) return;
  locks = 0;
  const b = document.body.style;
  b.position = ""; b.top = ""; b.left = ""; b.right = ""; b.width = ""; b.overflow = "";
  window.scrollTo(0, lockY || 0);
}

/** Locks body scroll while `active` is true. `mobileOnly` limits the lock to ≤760px (filter panels, chat). */
export function useScrollLock(active: boolean, mobileOnly = false) {
  useEffect(() => {
    if (!active) return;
    if (mobileOnly && window.innerWidth > 760) return;
    lock();
    return unlock;
  }, [active, mobileOnly]);
}

/** Global Esc — ignored while typing in a field (prototype `_onKey`, line 2560). */
export function useEscape(active: boolean, onEsc: () => void) {
  useEffect(() => {
    if (!active) return;
    const h = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      const tg = e.target as HTMLElement | null;
      if (tg && /INPUT|TEXTAREA|SELECT/.test(tg.tagName)) return;
      onEsc();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [active, onEsc]);
}

/** «Назад» браузера (кнопка / свайп на телефоне) закрывает открытый оверлей, а не уходит со страницы (16.10.2026,
 *  правило пользователя: галерея фото закрывается как крестиком). Пока `open`, в историю добавляется запись с меткой;
 *  popstate → `onClose`; закрытие крестиком/Esc снимает нашу запись через `history.back()`, чтобы история не засорялась.
 *  Запись копирует состояние Next (`__NA`), иначе роутер при возврате перезагружал бы страницу. */
export function useBackClose(open: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  useEffect(() => { ref.current = onClose; });
  useEffect(() => {
    if (!open) return;
    const tag = `ovl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let popped = false;
    try { window.history.pushState({ ...(window.history.state ?? {}), oplOverlay: tag }, "", window.location.href); } catch { return; }
    const onPop = () => { popped = true; ref.current(); };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!popped && (window.history.state as { oplOverlay?: string } | null)?.oplOverlay === tag) window.history.back();
    };
  }, [open]);
}
