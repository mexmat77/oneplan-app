"use client";

// Лайтбокс галереи (прототип `lbOpen` 1625–1643, `openLb`/`lbMove` 2859–2881, клавиши 2726–2728).
// Принятое отклонение (решение пользователя 23.09.2026): лента горизонтальная — стрелки ← → по краям, свайп/скролл
// по горизонтали, клавиши ←/→ (↑/↓ тоже работают); в прототипе была вертикальная лента со стрелками ↑/↓ справа.
//   <Lightbox list={urls} idx={0} onClose={…} />
// Один компонент для шахматки, страницы объекта и публичной страницы (`object/Lightbox`, `public/Lightbox` реэкспортируют).
import { IconChevronLeft, IconChevronRight, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState } from "react";
import { useScrollLock } from "@/hooks/useScrollLock";

export function Lightbox({ list, idx, onClose }: { list: string[]; idx: number; onClose: () => void }) {
  const feed = useRef<HTMLDivElement>(null);
  const start = Math.max(0, Math.min(idx, list.length - 1));
  const [cur, setCur] = useState(start);
  const curRef = useRef(start); // текущий кадр для обработчиков (без чтения state в замыканиях)
  useScrollLock(true);

  // Прокрутка к стартовому кадру + слежение за scroll (debounce 80 мс), как в `openLb`.
  useEffect(() => {
    const el = feed.current;
    if (!el) return;
    el.scrollLeft = curRef.current * el.clientWidth;
    let t: ReturnType<typeof setTimeout> | undefined;
    const onScroll = () => { clearTimeout(t); t = setTimeout(() => { const n = Math.round(el.scrollLeft / el.clientWidth); if (n !== curRef.current) { curRef.current = n; setCur(n); } }, 80); };
    el.addEventListener("scroll", onScroll);
    return () => { clearTimeout(t); el.removeEventListener("scroll", onScroll); };
  }, []);

  const move = (d: number) => {
    const el = feed.current;
    const i = Math.max(0, Math.min(list.length - 1, curRef.current + d));
    curRef.current = i;
    setCur(i);
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: "smooth" });
  };

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); move(-1); }
      else if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); move(1); }
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onClose, list.length]);

  const btn = "flex cursor-pointer items-center justify-center rounded-full border-none bg-[rgba(255,255,255,.14)] text-white hover:bg-[rgba(255,255,255,.28)]";
  return (
    <div className="fixed inset-0 z-[140] bg-[rgba(5,10,20,.94)]" style={{ animation: "opl-bg .15s ease" }}>
      <div id="opl-lb-feed" ref={feed} onClick={onClose} className="absolute inset-0 flex overflow-x-auto overflow-y-hidden [overscroll-behavior:contain] [scroll-snap-type:x_mandatory]">
        {list.map((src, i) => (
          <div key={i} className="flex h-full w-full flex-none items-center justify-center p-[18px] [scroll-snap-align:start] [scroll-snap-stop:always]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} loading="lazy" alt="" className="max-h-[88vh] max-w-[94vw] rounded-[10px] object-contain shadow-[0_20px_80px_rgba(0,0,0,.6)]" />
          </div>
        ))}
      </div>
      <button type="button" onClick={onClose} className={`absolute right-4 top-4 h-[42px] w-[42px] text-[19px] ${btn}`}><IconX size={19} /></button>
      {list.length > 1 && (
        <>
          <button type="button" disabled={cur <= 0} onClick={(e) => { e.stopPropagation(); move(-1); }} className={`absolute left-[14px] top-1/2 h-[46px] w-[46px] -translate-y-1/2 text-[20px] disabled:cursor-default disabled:opacity-30 max-md:left-[8px] ${btn}`}><IconChevronLeft size={22} /></button>
          <button type="button" disabled={cur >= list.length - 1} onClick={(e) => { e.stopPropagation(); move(1); }} className={`absolute right-[14px] top-1/2 h-[46px] w-[46px] -translate-y-1/2 text-[20px] disabled:cursor-default disabled:opacity-30 max-md:right-[8px] ${btn}`}><IconChevronRight size={22} /></button>
          <div className="pointer-events-none absolute bottom-[18px] left-1/2 -translate-x-1/2 rounded-[20px] bg-[rgba(255,255,255,.12)] px-[14px] py-[5px] text-[13px] font-semibold text-white">{cur + 1} / {list.length}</div>
        </>
      )}
    </div>
  );
}
