"use client";

// Left step navigation of the wizard (`#aw-nav`, prototype lines 1804–1812, `addSteps` 3451–3460):
// 250px column on desktop, horizontal scroll strip on ≤760px; the active step is scrolled into view.
import { IconBuildingStore, IconCheck, IconCircleCheck, IconFiles, IconFolder, IconInfoCircle, IconPhoto, IconStack2 } from "@tabler/icons-react";
import { useEffect, useRef } from "react";
import { useDevT } from "@/i18n/dev";
import { WZ_KEYS, wzFolder, wzLabel, type WzStepKey } from "./wizardState";

const ICON: Record<WzStepKey, typeof IconInfoCircle> = { info: IconInfoCircle, media: IconPhoto, plans: IconStack2, docs: IconFiles, comm: IconBuildingStore, done: IconCircleCheck };

export function WizardNav({ step, onStep }: { step: number; onStep: (i: number) => void }) {
  const { t } = useDevT();
  const nav = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const id = setTimeout(() => {
      const n = nav.current;
      if (!n) return;
      const a = n.querySelector<HTMLElement>('[data-awact="1"]');
      if (a && n.scrollWidth > n.clientWidth) n.scrollTo({ left: Math.max(0, a.offsetLeft - 40), behavior: "smooth" });
    }, 150);
    return () => clearTimeout(id);
  }, [step]);
  return (
    <div ref={nav} id="aw-nav" className="w-[250px] min-w-[210px] flex-none max-md:flex max-md:w-full max-md:min-w-0 max-md:flex-row max-md:gap-1 max-md:overflow-x-auto max-md:pb-[6px]">
      {WZ_KEYS.map((k, i) => {
        const active = i === step, done = i < step;
        const Icon = done ? IconCheck : ICON[k];
        const folder = wzFolder(t, k);
        return (
          <div key={k} onClick={() => onStep(i)} data-awact={active ? "1" : ""} className={`flex flex-none cursor-pointer items-start gap-3 whitespace-nowrap rounded-[12px] px-3 py-[11px] max-md:items-center max-md:gap-2 max-md:px-[10px] max-md:py-[7px] ${active ? "bg-blue-tint" : "bg-transparent"}`}>
            <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] text-[17px]" style={{ background: active ? "#4d7cfe" : done ? "#e4f6ee" : "#eef0f4", color: active ? "#fff" : done ? "#0f9d6b" : "#8a93a2" }}><Icon size={17} /></div>
            <div>
              <div className={`text-[14px] ${active ? "font-bold text-ink" : "font-semibold text-[#5c6675]"}`}>{wzLabel(t, k)}</div>
              {folder && <div className="mt-[2px] flex items-center gap-1 text-[11px] text-muted-2 max-md:hidden"><IconFolder size={11} /> {folder}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
