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
 *  правило пользователя: галерея фото закрывается как крестиком). Пока `open`, в историю добавлена запись с меткой;
 *  popstate → `onClose`. Запись копирует состояние Next (`__NA`), иначе роутер при возврате перезагружал бы страницу.
 *  18.10.2026 («в мобильном меню ни один раздел не кликабелен»): закрытие крестиком/выбором пункта раньше делало
 *  `history.back()` сразу — и отменяло переход, который начинался тем же тапом. Теперь при закрытии из интерфейса запись
 *  только помечается «мёртвой» (`dead`), а глобальный обработчик popstate пропускает такие записи: уход с мёртвой записи
 *  или приземление на неё даёт ещё один `history.back()` — одно нажатие «назад» ведёт туда, куда и должно. */
const dead = new Set<string>();
let topTag: string | null = null;
let skipping = false;
let installed = false;
function installBackSkipper() {
  if (installed || typeof window === "undefined") return; installed = true;
  const tagOf = (st: unknown) => ((st as { oplOverlay?: string } | null)?.oplOverlay ?? null);
  for (const name of ["pushState", "replaceState"] as const) {
    const orig = window.history[name];
    window.history[name] = function (this: History, data: unknown, unused: string, url?: string | URL | null) {
      // Роутер Next на popstate делает replaceState на НОВОЙ записи раньше нашего обработчика; в этот момент `topTag` ещё
      // описывает запись, с которой ушли, — replaceState без метки сбрасывает её только если текущая запись реально несла метку.
      const prevTag = tagOf(window.history.state);
      const r = orig.call(this, data, unused, url);
      const t = tagOf(data);
      if (name === "pushState") topTag = t;
      else if (t) topTag = t;
      else if (prevTag && prevTag === topTag) { topTag = null; dead.delete(prevTag); }
      return r;
    } as History["pushState"];
  }
  // capture: наш обработчик идёт раньше роутера Next, который на popstate делает replaceState и стирал бы метку «откуда ушли»
  window.addEventListener("popstate", (e) => {
    const leaving = topTag, landing = tagOf(e.state); topTag = landing;
    if (skipping) { if (landing && dead.has(landing)) { window.history.back(); return; } skipping = false; return; }
    if ((leaving && dead.has(leaving)) || (landing && dead.has(landing))) { skipping = true; window.history.back(); }
  }, { capture: true });
}
export function useBackClose(open: boolean, onClose: () => void) {
  const ref = useRef(onClose);
  useEffect(() => { ref.current = onClose; });
  useEffect(() => {
    if (!open) return;
    installBackSkipper();
    const tag = `ovl-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    let popped = false;
    try { window.history.pushState({ ...(window.history.state ?? {}), oplOverlay: tag }, "", window.location.href); } catch { return; }
    const onPop = () => { popped = true; ref.current(); };
    window.addEventListener("popstate", onPop);
    return () => {
      window.removeEventListener("popstate", onPop);
      if (!popped) dead.add(tag); // закрыто из интерфейса — запись мёртвая, «назад» её пропустит
    };
  }, [open]);
}
