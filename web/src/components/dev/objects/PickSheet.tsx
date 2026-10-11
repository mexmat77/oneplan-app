"use client";

// Universal single-value picker — prototype `sheetOpen` (lines 1613–1623, styles 4051–4056):
// desktop = centred 440px card, ≤760px = bottom sheet with a grabber; current value gets a blue check.
import { IconCheck } from "@tabler/icons-react";
import { useEscape, useScrollLock } from "@/hooks/useScrollLock";

export type SheetOpt = [string, string];

export function PickSheet({ title, value, opts, onPick, onClose }: { title: string; value: string; opts: SheetOpt[]; onPick: (v: string) => void; onClose: () => void }) {
  useScrollLock(true);
  useEscape(true, onClose);
  return (
    <div onClick={onClose} className="fixed inset-0 z-[150] flex items-center justify-center bg-[rgba(8,14,26,.45)] max-md:items-end" style={{ animation: "opl-bg .15s ease" }}>
      <div onClick={(e) => e.stopPropagation()} className="w-full max-w-[440px] overflow-y-auto rounded-[18px] bg-surface px-[14px] py-4 shadow-[0_24px_64px_rgba(8,14,26,.35)] max-h-[80vh] max-md:max-h-[70vh] max-md:max-w-[560px] max-md:rounded-b-none max-md:px-3 max-md:pb-[18px] max-md:pt-2 max-md:shadow-[0_-12px_40px_rgba(0,0,0,.25)]">
        <div className="mx-auto mb-3 mt-[6px] hidden h-1 w-[42px] rounded-[2px] bg-[#d5dae2] max-md:block" />
        <div className="mx-[6px] mb-2 text-[15px] font-extrabold text-ink">{title}</div>
        {opts.map(([v, label]) => {
          const on = (value || "") === v;
          return (
            <div key={v} onClick={() => onPick(v)} className="flex cursor-pointer items-center justify-between gap-[10px] rounded-[11px] px-[14px] py-[13px] text-[15px] font-semibold text-ink" style={{ background: on ? "#eef3ff" : "transparent" }}>
              <span>{label}</span>
              {on && <IconCheck size={18} className="text-blue" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
