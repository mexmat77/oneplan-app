"use client";

// Выбор значения фильтра — «sheet» прототипа (1613–1623, стили 4051–4056): на десктопе центрированная карточка 440px,
// на мобайле bottom-sheet с грабером. Универсальный: `opts` = [[value, label]], `value` — текущее.
//   <FilterSheet open={!!sheet} title={sheet.title} opts={sheet.opts} value={cur} onPick={(v) => …} onClose={…} />
import { IconCheck } from "@tabler/icons-react";
import { useEscape, useScrollLock } from "@/hooks/useScrollLock";
import { useIsMobile } from "./shared";

export type SheetOpt = [string, string];
export function FilterSheet({ open, title, opts, value, onPick, onClose }: { open: boolean; title: string; opts: SheetOpt[]; value: string; onPick: (v: string) => void; onClose: () => void }) {
  const mob = useIsMobile();
  useScrollLock(open);
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div onClick={onClose} className={`fixed inset-0 z-[150] flex justify-center ${mob ? "items-end" : "items-center"}`} style={{ background: "rgba(8,14,26,.45)", animation: "opl-bg .15s ease" }}>
      <div onClick={(e) => e.stopPropagation()} className={mob ? "w-full max-w-[560px] overflow-y-auto rounded-t-[18px] bg-surface px-3 pb-[18px] pt-2 shadow-[0_-12px_40px_rgba(0,0,0,.25)]" : "w-full max-w-[440px] overflow-y-auto rounded-[18px] bg-surface px-[14px] py-4 shadow-[0_24px_64px_rgba(8,14,26,.35)]"} style={{ maxHeight: mob ? "70vh" : "80vh" }}>
        {mob && <div className="mx-auto mb-3 mt-[6px] h-1 w-[42px] rounded-[2px] bg-[#d5dae2]" />}
        <div className="mx-[6px] mb-2 text-[15px] font-extrabold text-ink">{title}</div>
        {opts.map(([v, label]) => {
          const on = (value || "") === v;
          return (
            <div key={v || "__all"} onClick={() => { onPick(v); onClose(); }} className="flex cursor-pointer items-center justify-between gap-[10px] rounded-[11px] px-[14px] py-[13px] text-[15px] font-semibold text-ink" style={{ background: on ? "#eef3ff" : "transparent" }}>
              <span>{label}</span>{on && <IconCheck size={18} className="text-blue" />}
            </div>
          );
        })}
      </div>
    </div>
  );
}
