"use client";

import { useState } from "react";
import { IconChevronLeft, IconChevronRight, IconPhoto, IconX } from "@tabler/icons-react";
import { useEscape, useScrollLock } from "@/hooks/useScrollLock";

// Client-view gallery of one listing — prototype lines 1998–2011 (grid + thumbs), 2087–2101 (lightbox `cliLb`),
// 1963–1975 (mobile stack `cliMg`), handlers 3523–3531, 4316–4319. Independent from the cabinet's Gallery.
export function CliGallery({ photos, title }: { photos: string[]; title: string }) {
  const [gi, setGi] = useState(0);
  const [lb, setLb] = useState(false);
  const [mg, setMg] = useState(false);
  const n = photos.length || 1;
  const i = ((gi % n) + n) % n;
  const img = photos[i] ?? "";
  const galN = `${i + 1} / ${n}`;
  const hasSides = n >= 3;
  useScrollLock(lb || mg);
  useEscape(lb || mg, () => { setLb(false); setMg(false); });

  const prev = (e?: React.MouseEvent) => { e?.stopPropagation(); setGi(i - 1); };
  const next = (e?: React.MouseEvent) => { e?.stopPropagation(); setGi(i + 1); };
  // cliLbShow: on ≤760 the vertical stack, otherwise the lightbox.
  const show = () => { if (window.innerWidth <= 760) setMg(true); else setLb(true); };
  const lbAt = (k: number) => { setGi(k % n); setLb(true); };

  const arrow = "absolute top-1/2 flex h-[38px] w-[38px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,.94)] text-ink shadow-[0_2px_8px_rgba(10,16,28,.18)] hover:brightness-95";
  const thumb = (k: number) => `h-[56px] w-[76px] flex-none cursor-pointer rounded-[9px] border-2 bg-cover bg-center ${k === i ? "border-blue" : "border-transparent"}`;
  const lbArrow = "absolute top-1/2 flex h-12 w-12 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,.14)] text-white hover:bg-[rgba(255,255,255,.28)]";

  return (
    <>
      <div data-gal="1" className="grid grid-rows-[1fr_1fr] gap-2" style={{ gridTemplateColumns: hasSides ? "2.2fr 1fr" : "1fr", height: "clamp(280px,36vw,440px)" }}>
        <div onClick={show} className="relative row-span-2 cursor-zoom-in overflow-hidden rounded-[20px] bg-cover bg-center hover:brightness-95" style={{ backgroundImage: `url('${img}')` }}>
          <span onClick={prev} className={`${arrow} left-3`}><IconChevronLeft size={17} /></span>
          <span onClick={next} className={`${arrow} right-3`}><IconChevronRight size={17} /></span>
          <span className="absolute bottom-[10px] right-3 inline-flex items-center gap-1 rounded-[8px] bg-[rgba(10,16,28,.6)] px-[9px] py-1 text-[11px] font-semibold text-white"><IconPhoto size={12} /> {galN}</span>
        </div>
        {hasSides && (
          <>
            <div data-gal-side="1" onClick={() => lbAt(i + 1)} className="cursor-zoom-in overflow-hidden rounded-[16px] bg-cover bg-center hover:brightness-95" style={{ backgroundImage: `url('${photos[1] ?? ""}')` }} />
            <div data-gal-side="1" onClick={() => lbAt(i + 2)} className="relative cursor-zoom-in overflow-hidden rounded-[16px] bg-cover bg-center hover:brightness-95" style={{ backgroundImage: `url('${photos[2] ?? ""}')` }}>
              {n > 3 && <div className="absolute inset-0 flex items-center justify-center bg-[rgba(10,16,28,.45)] text-[19px] font-extrabold text-white">+{n - 3}</div>}
            </div>
          </>
        )}
      </div>
      <div data-gal-thumbs="1" className="mt-[10px] flex gap-2 overflow-x-auto pb-1">
        {photos.map((p, k) => <span key={k} onClick={() => setGi(k)} className={`${thumb(k)} hover:bg-line-2`} style={{ backgroundImage: `url(${p})` }} />)}
      </div>

      {lb && !mg && (
        <div className="fixed inset-0 z-[420] flex flex-col bg-[rgba(8,12,22,.94)]" style={{ animation: "opl-bg .15s ease" }}>
          <div className="flex flex-none items-center px-5 py-[14px] text-white">
            <div className="truncate text-[14px] font-bold">{title}</div>
            <div className="flex-1" />
            <span className="mr-4 flex-none text-[13px] text-dark-muted">{galN}</span>
            <span onClick={() => setLb(false)} className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-[12px] bg-[rgba(255,255,255,.12)] text-white hover:bg-[rgba(255,255,255,.24)]"><IconX size={22} /></span>
          </div>
          <div onClick={() => setLb(false)} className="relative flex min-h-0 flex-1 items-center justify-center px-[clamp(56px,8vw,90px)]">
            <div onClick={(e) => e.stopPropagation()} className="h-full w-full rounded-[12px] bg-contain bg-center bg-no-repeat" style={{ backgroundImage: `url('${img.replace("w=600&h=380", "w=1600&h=1000")}')` }} />
            <span onClick={prev} className={`${lbArrow} left-[18px]`}><IconChevronLeft size={21} /></span>
            <span onClick={next} className={`${lbArrow} right-[18px]`}><IconChevronRight size={21} /></span>
          </div>
          <div className="flex flex-none justify-center gap-2 overflow-x-auto px-5 py-4">
            {photos.map((p, k) => <div key={k} onClick={() => setGi(k)} className={`${thumb(k)} hover:brightness-95`} style={{ backgroundImage: `url(${p})` }} />)}
          </div>
        </div>
      )}

      {mg && (
        <div className="fixed inset-0 z-[700] overflow-y-auto bg-[#0a101c] [overscroll-behavior:contain]">
          <div className="sticky top-0 z-[710] flex items-center justify-between gap-[10px] bg-[linear-gradient(rgba(10,16,28,.85),rgba(10,16,28,0))] px-[14px] py-3">
            <span className="truncate text-[13px] font-semibold text-white">{title}</span>
            <span onClick={() => setMg(false)} className="flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,.16)] text-white hover:brightness-95"><IconX size={21} /></span>
          </div>
          <div className="flex flex-col gap-[6px] pb-10">
            {photos.map((p, k) => (
              <div key={k} className="relative aspect-[3/2] bg-cover bg-center" style={{ backgroundImage: `url('${p}')` }}>
                <span className="absolute bottom-[10px] right-3 rounded-[9px] bg-[rgba(10,16,28,.6)] px-[9px] py-1 text-[11px] font-semibold text-white">{k + 1} / {n}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </>
  );
}
