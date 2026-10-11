"use client";

// Full-screen vertical photo stack on ≤760px — prototype `nbo.mgOpen` (lines 1321–1331) and `uMgOpen` (1308–1319).
import { IconX } from "@tabler/icons-react";

export function MobileStack({ title, photos, z = 700, onClose }: { title: string; photos: string[]; z?: number; onClose: () => void }) {
  return (
    <div className="fixed inset-0 overflow-y-auto bg-[#0a101c] [overscroll-behavior:contain]" style={{ zIndex: z }}>
      <div className="sticky top-0 flex items-center justify-between gap-[10px] bg-[linear-gradient(rgba(10,16,28,.85),rgba(10,16,28,0))] px-[14px] py-3" style={{ zIndex: z + 1 }}>
        <span className="truncate text-[13px] font-semibold text-white">{title}</span>
        <button type="button" onClick={onClose} className="flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,.16)] text-white"><IconX size={21} /></button>
      </div>
      <div className="flex flex-col gap-[6px] pb-10">
        {photos.map((src, i) => (
          <div key={i} className="relative aspect-[3/2] bg-cover bg-center" style={{ backgroundImage: `url('${src}')` }}>
            <span className="absolute bottom-[10px] right-3 rounded-[9px] bg-[rgba(10,16,28,.6)] px-[9px] py-1 text-[11px] font-semibold text-white">{i + 1} / {photos.length}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
