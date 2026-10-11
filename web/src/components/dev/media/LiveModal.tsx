"use client";

// LIVE overlay — prototype `OnePlan v2.dc.html` lines 1531–1545 (`liveOpen`): full-screen dark backdrop
// (z 200), pulsing «LIVE» badge, object name, 16/9 iframe up to 1000px, «open in new tab» link, Esc closes.
import { IconExternalLink, IconX } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { useEscape, useScrollLock } from "@/hooks/useScrollLock";
import { embedUrl } from "@/lib/dev/data";

export function LiveModal({ url, title, onClose }: { url: string; title?: string; onClose: () => void }) {
  const { t } = useDevT();
  useScrollLock(true);
  useEscape(true, onClose);
  const src = embedUrl(url);
  return (
    <div onClick={onClose} className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[rgba(8,14,26,.86)] p-[clamp(12px,4vw,40px)] backdrop-blur-[6px]" style={{ animation: "opl-bg .18s ease" }}>
      <div className="mb-3 flex w-full max-w-[1000px] items-center justify-between gap-[10px]">
        <div className="flex min-w-0 items-center gap-[10px]">
          <span className="inline-flex flex-none items-center gap-[6px] rounded-[20px] bg-red px-3 py-[5px] text-[12px] font-extrabold text-white"><span className="h-[7px] w-[7px] rounded-full bg-white" style={{ animation: "oplPulse 1.6s infinite" }} />{t.dx.live}</span>
          <div className="min-w-0">
            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-extrabold text-white">{title}</div>
            <div className="text-[12px] text-[#9fb0cc]">{t.pub.live_now}</div>
          </div>
        </div>
        <span onClick={onClose} className="flex h-[38px] w-[38px] flex-none cursor-pointer items-center justify-center rounded-[11px] bg-[rgba(255,255,255,.12)] text-[18px] text-white hover:bg-[rgba(255,255,255,.22)]"><IconX size={18} /></span>
      </div>
      <div onClick={(e) => e.stopPropagation()} className="relative aspect-video w-full max-w-[1000px] overflow-hidden rounded-[16px] bg-black shadow-[0_30px_80px_rgba(0,0,0,.6)]">
        <iframe src={src} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className="block h-full w-full border-0" />
      </div>
      <a href={url} target="_blank" rel="noopener" onClick={(e) => e.stopPropagation()} className="mt-3 inline-flex items-center gap-[6px] text-[13px] text-[#9fb0cc] no-underline hover:text-white"><IconExternalLink size={15} /> {t.pub.live_newtab}</a>
    </div>
  );
}
