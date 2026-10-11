"use client";

// Левая навигация редактора `epNav` (481–490; данные 3693–3696, 4261): 212px sticky top 126 на десктопе,
// горизонтальная лента на мобайле; галочки готовности; клик — плавный скролл к `#sec-*` (−128px).
import type { ReactNode } from "react";
import { IconAlignLeft, IconCircle, IconCircleCheckFilled, IconClipboardText, IconCrane, IconFiles, IconMapPin, IconPhoto } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import type { EditObj } from "./shared";

export type Checks = { basic: boolean; media: boolean; desc: boolean; loc: boolean; prog: boolean; docs: boolean };

/** `checks` (3693): basic = имя+назначение; media ≥4; desc RU/EN/TR >10 симв.; loc адрес+lng+lat; prog ≥2; docs ≥2 «Получен». */
export function objChecks(o: EditObj): Checks {
  return {
    basic: !!o.name.trim() && o.tags.length > 0,
    media: o.photos.length >= 4,
    desc: (["RU", "EN", "TR"] as const).every((l) => (o.descs[l] || "").trim().length > 10),
    loc: !!o.loc.trim() && !!o.lng && !!o.lat,
    prog: o.prog.length >= 2,
    docs: Object.values(o.docs).filter((v) => v === "ok").length >= 2,
  };
}
export const objPct = (c: Checks) => Math.round(Object.values(c).filter(Boolean).length / 6 * 100);

const ITEMS: [keyof Checks, ReactNode][] = [
  ["basic", <IconClipboardText key="b" size={16} />], ["media", <IconPhoto key="m" size={16} />], ["desc", <IconAlignLeft key="d" size={16} />],
  ["loc", <IconMapPin key="l" size={16} />], ["prog", <IconCrane key="p" size={16} />], ["docs", <IconFiles key="f" size={16} />],
];

export function ObjectNav({ checks }: { checks: Checks }) {
  const { t } = useDevT();
  const nav = t.edp as unknown as Record<string, string>;
  const go = (k: string) => { const el = document.getElementById(`sec-${k}`); if (el) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 128, behavior: "smooth" }); };
  return (
    <div className="sticky top-[126px] flex w-[212px] flex-none flex-col gap-[2px] rounded-[14px] border border-line bg-surface p-2 max-md:static max-md:w-full max-md:flex-row max-md:overflow-x-auto max-md:p-[6px] max-md:[-webkit-overflow-scrolling:touch]">
      {ITEMS.map(([k, icon]) => (
        <div key={k} onClick={() => go(k)} className="flex flex-none cursor-pointer items-center gap-[9px] rounded-[10px] px-[11px] py-[9px] hover:bg-bg-3">
          <span className="flex flex-none text-muted">{icon}</span>
          <span className="flex-1 whitespace-nowrap text-[13px] font-semibold text-[#3c4759]">{nav[`nav_${k}`]}</span>
          {checks[k] ? <IconCircleCheckFilled size={15} className="flex-none text-green-3" /> : <IconCircle size={15} className="flex-none text-[#d5dae2]" />}
        </div>
      ))}
    </div>
  );
}
