"use client";

// «Доступ оплачен до» date picker — prototype `calOpen` (markup 1829–1841, logic 3926–3932):
// 330px window (z 430, dim .45), month title, 7 weekday headers, 6×7 grid, prev/next month.
import { useState } from "react";
import { IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { Modal } from "@/components/ui/Modal";
import type { Lang } from "@/i18n";

const LOCALE: Record<Lang, string> = { RU: "ru-RU", TR: "tr-TR", EN: "en-GB" };
const pad = (n: number) => `0${n}`.slice(-2);

type Props = { value: string; lang: Lang; onPick: (v: string) => void; onClose: () => void };

/** Mounted only while open, so the visible month is initialised from `value` (or Aug 2026 like the prototype). */
export function Calendar({ value, lang, onPick, onClose }: Props) {
  const [ym, setYm] = useState(() => {
    const m3 = String(value || "").split(".");
    const d0 = m3.length === 3 ? new Date(+m3[2], +m3[1] - 1, 1) : new Date(2026, 7, 1);
    return { y: d0.getFullYear(), m: d0.getMonth() };
  });
  const loc = LOCALE[lang];
  const title = (() => { const s = new Date(ym.y, ym.m, 1).toLocaleDateString(loc, { month: "long", year: "numeric" }); return s.charAt(0).toUpperCase() + s.slice(1); })();
  const wd = Array.from({ length: 7 }, (_, i) => new Date(2026, 7, 17 + i).toLocaleDateString(loc, { weekday: "short" }));
  const start = (new Date(ym.y, ym.m, 1).getDay() + 6) % 7;
  const cells = Array.from({ length: 42 }, (_, i) => {
    const d = new Date(ym.y, ym.m, 1 - start + i);
    const val = `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
    return { val, label: d.getDate(), inM: d.getMonth() === ym.m, on: val === value };
  });
  const nav = "flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-[10px] border border-line text-ink hover:border-blue hover:text-blue";
  return (
    <Modal open onClose={onClose} width={330} z={430} overlay={0.45} padding="18px 18px 20px">
      <div className="mb-3 flex items-center gap-2">
        <button type="button" onClick={() => setYm((s) => (s.m <= 0 ? { m: 11, y: s.y - 1 } : { ...s, m: s.m - 1 }))} className={nav}><IconChevronLeft size={16} /></button>
        <span className="flex-1 text-center text-[14.5px] font-extrabold text-ink">{title}</span>
        <button type="button" onClick={() => setYm((s) => (s.m >= 11 ? { m: 0, y: s.y + 1 } : { ...s, m: s.m + 1 }))} className={nav}><IconChevronRight size={16} /></button>
      </div>
      <div className="mb-1 grid grid-cols-7 gap-[2px]">
        {wd.map((w) => <span key={w} className="text-center text-[10.5px] font-bold uppercase text-muted">{w}</span>)}
      </div>
      <div className="grid grid-cols-7 gap-[2px]">
        {cells.map((c) => (
          <button key={c.val} type="button" onClick={() => onPick(c.val)} className={`cursor-pointer rounded-[9px] py-2 text-center text-[13px] font-semibold hover:bg-blue-tint ${c.on ? "bg-blue-2 text-white" : c.inM ? "text-ink" : "text-[#c9cfda]"}`}>{c.label}</button>
        ))}
      </div>
    </Modal>
  );
}
