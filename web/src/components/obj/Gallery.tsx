"use client";

// Object gallery — prototype lines 1558–1589 (grid, thumbs, mobile stack `mgOpen`),
// 2104–2121 (lightbox `lbOpen`), 2559–2577 (keyboard), 2607–2620 (swipe with drag),
// 3441–3448 / 4308–4313 (shared `galIdx`, side photos, 1600×1000 lightbox URL).
import { useEffect, useRef, useState, type ReactNode } from "react";
import { IconChevronLeft, IconChevronRight, IconPhoto, IconX } from "@tabler/icons-react";
import { useScrollLock } from "@/hooks/useScrollLock";

const ARROW = "absolute top-1/2 flex h-[42px] w-[42px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,.95)] text-[18px] text-ink shadow-[0_4px_14px_rgba(20,36,63,.18)] hover:bg-white";
const LB_ARROW = "absolute top-1/2 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,.14)] text-[21px] text-white hover:bg-[rgba(255,255,255,.28)]";

export function Gallery({ photos, title, overlay }: { photos: string[]; title: string; overlay?: ReactNode }) {
  const n = photos.length;
  // Unbounded like the prototype's `galIdx`; `galI` is the wrapped index.
  const [galIdx, setGalIdx] = useState(0);
  const [lb, setLb] = useState(false);
  const [mg, setMg] = useState(false);
  const galI = n ? ((galIdx % n) + n) % n : 0;
  const hasSides = n >= 3;
  const stripRef = useRef<HTMLDivElement>(null);
  const sw = useRef({ x: 0, y: 0, drag: false, w: 1, i: 0 });

  useScrollLock(lb || mg);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      if (tg && /INPUT|TEXTAREA|SELECT/.test(tg.tagName)) return;
      if (e.key === "Escape") { if (mg) setMg(false); else if (lb) setLb(false); return; }
      if (e.key === "ArrowRight") setGalIdx((v) => v + 1);
      if (e.key === "ArrowLeft") setGalIdx((v) => v - 1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [mg, lb]);

  const prev = (e?: React.MouseEvent) => { e?.stopPropagation(); setGalIdx((v) => v - 1); };
  const next = (e?: React.MouseEvent) => { e?.stopPropagation(); setGalIdx((v) => v + 1); };
  const openLb = () => { if (window.innerWidth <= 760) setMg(true); else setLb(true); };

  // Swipe with the strip following the finger (prototype `_swS/_swM/_swE`).
  const onTS = (e: React.TouchEvent<HTMLDivElement>) => {
    const t = e.touches[0];
    sw.current = { x: t.clientX, y: t.clientY, drag: false, w: e.currentTarget.clientWidth || 1, i: galI };
  };
  const onTM = (e: React.TouchEvent) => {
    const s = sw.current, t = e.touches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (!s.drag && Math.abs(dx) > 8 && Math.abs(dx) > Math.abs(dy)) s.drag = true;
    const el = stripRef.current;
    if (s.drag && el) { el.style.transition = "none"; el.style.transform = `translateX(calc(-${s.i * 100}% + ${dx}px))`; }
  };
  const onTE = (e: React.TouchEvent) => {
    const s = sw.current, el = stripRef.current, t = e.changedTouches[0];
    const dx = t.clientX - s.x, dy = t.clientY - s.y;
    if (el) el.style.transition = "transform .35s cubic-bezier(.22,.61,.36,1)";
    if (s.drag && Math.abs(dx) > Math.max(40, s.w * 0.16) && Math.abs(dx) > Math.abs(dy) * 1.2) {
      if (e.cancelable) e.preventDefault();
      if (el) el.style.transform = `translateX(-${s.i * 100}%)`;
      const d = dx < 0 ? 1 : -1;
      setGalIdx((v) => Math.max(0, v + d));
    } else if (el && s.drag) el.style.transform = `translateX(-${s.i * 100}%)`;
    s.drag = false;
  };

  const thumb = (p: string, i: number, k: string) => (
    <div
      key={k}
      onClick={(e) => { e.stopPropagation(); setGalIdx(i); }}
      className="h-[62px] w-[88px] flex-none cursor-pointer rounded-[10px] bg-cover bg-center hover:brightness-[.96]"
      style={{ backgroundImage: `url('${p}')`, opacity: i === galI ? 1 : 0.7, border: `2px solid ${i === galI ? "#4d7cfe" : "transparent"}` }}
    />
  );
  const counter = n ? `${galI + 1} / ${n}` : "";

  return (
    <>
      <div data-gal="1" className="grid gap-2" style={{ gridTemplateColumns: hasSides ? "2.2fr 1fr" : "1fr", gridTemplateRows: "1fr 1fr", height: "clamp(300px,40vw,500px)" }}>
        <div
          onClick={openLb}
          onTouchStart={onTS}
          onTouchMove={onTM}
          onTouchEnd={onTE}
          className="relative row-span-2 cursor-zoom-in overflow-hidden rounded-[20px] bg-line-2 [touch-action:pan-y] hover:brightness-[.96]"
        >
          <div ref={stripRef} data-strip="1" className="absolute inset-0 flex" style={{ transition: "transform .35s cubic-bezier(.22,.61,.36,1)", transform: `translateX(-${galI * 100}%)` }}>
            {photos.map((p, k) => <div key={k} className="h-full w-full flex-none bg-cover bg-center" style={{ backgroundImage: `url('${p}')` }} />)}
          </div>
          {overlay}
          <span data-gal-arr="1" onClick={prev} className={`${ARROW} left-[14px]`} aria-label="prev"><IconChevronLeft size={18} /></span>
          <span data-gal-arr="1" onClick={next} className={`${ARROW} right-[14px]`} aria-label="next"><IconChevronRight size={18} /></span>
          <span className="absolute bottom-[14px] left-[14px] inline-flex items-center gap-[6px] rounded-[10px] bg-[rgba(10,16,28,.65)] px-3 py-[6px] text-[12px] font-semibold text-white backdrop-blur-[4px]">
            <IconPhoto size={14} /> {counter}
          </span>
        </div>
        {hasSides && (
          <>
            <div data-gal-side="1" onClick={(e) => { e.stopPropagation(); setGalIdx(1); }} className="cursor-pointer overflow-hidden rounded-[16px] bg-cover bg-center hover:brightness-[.96]" style={{ backgroundImage: `url('${photos[1]}')` }} />
            <div data-gal-side="1" onClick={(e) => { e.stopPropagation(); if (n > 3) setMg(true); else setGalIdx(2); }} className="relative cursor-pointer overflow-hidden rounded-[16px] bg-cover bg-center hover:brightness-[.96]" style={{ backgroundImage: `url('${photos[2]}')` }}>
              {n > 3 && <div className="absolute inset-0 flex items-center justify-center bg-[rgba(10,16,28,.45)] text-[17px] font-extrabold text-white">+{n - 3}</div>}
            </div>
          </>
        )}
      </div>
      <div data-gal-thumbs="1" className="mt-[10px] flex gap-2 overflow-x-auto pb-1">
        {photos.map((p, i) => thumb(p, i, `t${i}`))}
      </div>

      {mg && (
        <div className="fixed inset-0 z-[600] overflow-y-auto bg-[#0a101c]">
          <div className="sticky top-0 z-[610] flex items-center justify-between gap-[10px] px-[14px] py-3" style={{ background: "linear-gradient(rgba(10,16,28,.85),rgba(10,16,28,0))" }}>
            <span className="truncate text-[13px] font-semibold text-white">{title}</span>
            <span onClick={() => setMg(false)} className="flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,.16)] text-[21px] text-white hover:brightness-[.96]" aria-label="close"><IconX size={21} /></span>
          </div>
          <div className="flex flex-col gap-[6px] pb-10">
            {photos.map((p, i) => (
              <div key={i} className="relative aspect-[3/2] bg-cover bg-center" style={{ backgroundImage: `url('${p}')` }}>
                <span className="absolute bottom-[10px] right-3 rounded-[9px] bg-[rgba(10,16,28,.6)] px-[9px] py-1 text-[11px] font-semibold text-white">{i + 1} / {n}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {lb && (
        <div className="animate-bg fixed inset-0 z-[600] flex flex-col bg-[rgba(8,12,22,.94)]">
          <div className="flex flex-none items-center px-5 py-[14px] text-white">
            <div className="truncate text-[14px] font-bold">{title}</div>
            <div className="flex-1" />
            <span className="mr-4 flex-none text-[13px] text-[#8fa0bd]">{counter}</span>
            <span onClick={() => setLb(false)} className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-[12px] bg-[rgba(255,255,255,.12)] text-[22px] text-white hover:bg-[rgba(255,255,255,.24)]" aria-label="close"><IconX size={22} /></span>
          </div>
          <div onClick={() => setLb(false)} className="relative flex min-h-0 flex-1 items-center justify-center" style={{ padding: "0 clamp(56px,8vw,90px)" }}>
            <div onClick={(e) => e.stopPropagation()} className="h-full w-full rounded-[12px] bg-contain bg-center bg-no-repeat" style={{ backgroundImage: n ? `url('${photos[galI].replace("w=600&h=380", "w=1600&h=1000")}')` : "none" }} />
            <span onClick={prev} className={`${LB_ARROW} left-[18px]`} aria-label="prev"><IconChevronLeft size={21} /></span>
            <span onClick={next} className={`${LB_ARROW} right-[18px]`} aria-label="next"><IconChevronRight size={21} /></span>
          </div>
          <div className="flex flex-none justify-center gap-2 overflow-x-auto px-5 py-4">
            {photos.map((p, i) => thumb(p, i, `l${i}`))}
          </div>
        </div>
      )}
    </>
  );
}
