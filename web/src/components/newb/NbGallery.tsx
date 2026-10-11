"use client";

// New-build project gallery — prototype lines 1086–1106 (grid + thumbs), 1234–1242 (lightbox), 1321–1331 (mobile stack),
// logic 3995–4007 / 4013–4015. Photos change with the category chips: the parent re-keys this component by category.
import { useEffect, useState, type ReactNode } from "react";
import { IconChevronLeft, IconChevronRight, IconPhoto, IconX } from "@tabler/icons-react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { MobileStack } from "./MobileStack";
import { useSwipe } from "./swipe";

type Props = { photos: string[]; title: string; badge: ReactNode; watch: ReactNode };

export function NbGallery({ photos, title, badge, watch }: Props) {
  const n = photos.length;
  const [gal, setGal] = useState(0);
  const [lb, setLb] = useState(-1);
  const [mg, setMg] = useState(false);
  const i = Math.min(gal, n - 1);
  const cur = Math.min(Math.max(lb, 0), n - 1);
  const step = (d: number) => setGal((i + d + n) % n);
  const swipe = useSwipe((d) => step(d));
  // Prototype `openLb`: ≤760 opens the stack, otherwise the lightbox at the given index.
  const open = (idx: number) => { if (window.innerWidth <= 760) setMg(true); else setLb(idx); };
  useScrollLock(lb >= 0 || mg);

  // Prototype `_onKey` (2560–2572): Esc closes the stack, then the lightbox; ←/→ page the lightbox.
  useEffect(() => {
    if (lb < 0 && !mg) return;
    const h = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      if (tg && /INPUT|TEXTAREA|SELECT/.test(tg.tagName)) return;
      if (e.key === "Escape") { if (mg) setMg(false); else setLb(-1); return; }
      if (lb >= 0 && e.key === "ArrowRight") setLb((v) => (v + 1) % n);
      if (lb >= 0 && e.key === "ArrowLeft") setLb((v) => (v - 1 + n) % n);
    };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [lb, mg, n]);

  const arrow = "absolute top-1/2 flex h-[42px] w-[42px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,.95)] text-ink shadow-[0_4px_14px_rgba(20,36,63,.18)] hover:bg-surface";
  const lbBtn = "absolute z-[2] flex cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,.14)] text-white";

  return (
    <>
      <div data-gal="1" className="grid h-[clamp(300px,40vw,500px)] grid-rows-[1fr_1fr] gap-2" style={{ gridTemplateColumns: n >= 3 ? "2.2fr 1fr" : "1fr" }}>
        <div onClick={() => open(i)} {...swipe} className="relative row-span-2 cursor-zoom-in overflow-hidden rounded-[20px] bg-line-2 [touch-action:pan-y] hover:brightness-[.96]">
          <div data-strip="1" className="absolute inset-0 flex transition-transform duration-[350ms] ease-[cubic-bezier(.22,.61,.36,1)]" style={{ transform: `translateX(-${i * 100}%)` }}>
            {photos.map((src, k) => <div key={k} className="h-full w-full flex-none bg-cover bg-center" style={{ backgroundImage: `url('${src}')` }} />)}
          </div>
          {badge}
          <span data-gal-arr="1" onClick={(e) => { e.stopPropagation(); step(-1); }} className={`${arrow} left-[14px]`}><IconChevronLeft size={18} /></span>
          <span data-gal-arr="1" onClick={(e) => { e.stopPropagation(); step(1); }} className={`${arrow} right-[14px]`}><IconChevronRight size={18} /></span>
          <span className="absolute bottom-[14px] left-[14px] inline-flex items-center gap-[6px] rounded-[10px] bg-[rgba(10,16,28,.65)] px-3 py-[6px] text-[12px] font-semibold text-white backdrop-blur-[4px]"><IconPhoto size={14} /> {i + 1} / {n}</span>
          {watch}
        </div>
        {n > 2 && (
          <>
            <div data-gal-side="1" onClick={() => open((i + 1) % n)} className="cursor-pointer overflow-hidden rounded-[16px] bg-cover bg-center hover:brightness-[.96]" style={{ backgroundImage: `url('${photos[(i + 1) % n]}')` }} />
            <div data-gal-side="1" onClick={() => open((i + 2) % n)} className="relative cursor-pointer overflow-hidden rounded-[16px] bg-cover bg-center hover:brightness-[.96]" style={{ backgroundImage: `url('${photos[(i + 2) % n]}')` }}>
              {n > 3 && <div className="absolute inset-0 flex items-center justify-center bg-[rgba(10,16,28,.45)] text-[17px] font-extrabold text-white">+{n - 3}</div>}
            </div>
          </>
        )}
      </div>
      <div data-gal-thumbs="1" className="mt-[10px] flex gap-2 overflow-x-auto pb-1">
        {photos.map((src, k) => (
          <div key={k} onClick={() => setGal(k)} className={`h-[56px] w-[76px] flex-none cursor-pointer rounded-[9px] bg-cover bg-center hover:brightness-[.96] ${k === i ? "outline outline-[2.5px] -outline-offset-[2.5px] outline-blue" : "opacity-75"}`} style={{ backgroundImage: `url('${src}')` }} />
        ))}
      </div>

      {lb >= 0 && !mg && (
        <div className="fixed inset-0 z-700 flex items-center justify-center bg-[rgba(10,16,28,.94)]">
          <span onClick={() => setLb(-1)} className={`${lbBtn} right-[18px] top-4 h-11 w-11`}><IconX size={22} /></span>
          <span onClick={() => setLb((cur - 1 + n) % n)} className={`${lbBtn} left-[14px] top-1/2 h-[46px] w-[46px] -translate-y-1/2`}><IconChevronLeft size={22} /></span>
          <span onClick={() => setLb((cur + 1) % n)} className={`${lbBtn} right-[14px] top-1/2 h-[46px] w-[46px] -translate-y-1/2`}><IconChevronRight size={22} /></span>
          <div className="h-[min(760px,84vh)] w-[min(1200px,92vw)] bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url('${photos[cur]}')` }} />
          <span className="absolute bottom-[18px] left-1/2 -translate-x-1/2 rounded-[10px] bg-[rgba(255,255,255,.12)] px-[13px] py-[6px] text-[13px] font-semibold text-white">{cur + 1} / {n}</span>
        </div>
      )}
      {mg && <MobileStack title={title} photos={photos} z={700} onClose={() => setMg(false)} />}
    </>
  );
}
