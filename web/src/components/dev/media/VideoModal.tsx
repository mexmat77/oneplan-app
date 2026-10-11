"use client";

// Promo-video overlay — prototype `OnePlan v2.dc.html` lines 1598–1611 (`vidOpen`): dark backdrop (z 200),
// red YouTube badge, object name + «Видео о проекте», 16/9 iframe (`embedUrl`), Esc closes.
import { IconBrandYoutube, IconX } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { useEscape, useScrollLock } from "@/hooks/useScrollLock";
import { embedUrl } from "@/lib/dev/data";

export function VideoModal({ url, title, onClose }: { url: string; title?: string; onClose: () => void }) {
  const { t } = useDevT();
  useScrollLock(true);
  useEscape(true, onClose);
  return (
    <div onClick={onClose} className="fixed inset-0 z-[200] flex flex-col items-center justify-center bg-[rgba(8,14,26,.88)] p-[clamp(12px,4vw,40px)] backdrop-blur-[6px]" style={{ animation: "opl-bg .18s ease" }}>
      <div className="mb-3 flex w-full max-w-[1000px] items-center justify-between gap-[10px]">
        <div className="flex min-w-0 items-center gap-[10px]">
          <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-red text-[16px] text-white"><IconBrandYoutube size={18} /></span>
          <div className="min-w-0">
            <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-extrabold text-white">{title}</div>
            <div className="text-[12px] text-[#9fb0cc]">{t.pub.promo}</div>
          </div>
        </div>
        <span onClick={onClose} className="flex h-[38px] w-[38px] flex-none cursor-pointer items-center justify-center rounded-[11px] bg-[rgba(255,255,255,.12)] text-[18px] text-white hover:bg-[rgba(255,255,255,.22)]"><IconX size={18} /></span>
      </div>
      <div onClick={(e) => e.stopPropagation()} className="aspect-video w-full max-w-[1000px] overflow-hidden rounded-[16px] bg-black shadow-[0_30px_80px_rgba(0,0,0,.6)]">
        <iframe src={embedUrl(url)} allow="autoplay; fullscreen; picture-in-picture" allowFullScreen className="block h-full w-full border-0" />
      </div>
    </div>
  );
}
