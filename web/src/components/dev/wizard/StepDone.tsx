"use client";

// Step 5 «Проверка» — prototype lines 1889–1898: «Почти готово» card with 5 checked items (`reviewItems`).
import { IconChecks, IconCircleCheckFilled, IconFolder } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { WZ_KEYS, wzFolder, wzLabel } from "./wizardState";

export function StepDone() {
  const { t } = useDevT();
  return (
    <>
      <p className="mb-5 text-[14px] text-text-2">{t.wz.review_sub}</p>
      <div className="rounded-[16px] border border-line bg-surface p-[22px]">
        <div className="mb-4 flex items-center gap-[10px]">
          <div className="flex h-10 w-10 items-center justify-center rounded-[11px] bg-green-tint text-[22px] text-green"><IconChecks size={22} /></div>
          <div className="text-[18px] font-extrabold text-ink">{t.wz.review_title}</div>
        </div>
        <div className="grid gap-[10px]" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          {WZ_KEYS.slice(0, 5).map((k) => (
            <div key={k} className="flex items-center gap-[11px] rounded-[12px] border border-line px-[14px] py-3">
              <IconCircleCheckFilled size={20} className="text-green" />
              <div>
                <div className="text-[14px] font-semibold text-ink">{wzLabel(t, k)}</div>
                <div className="flex items-center gap-1 text-[11px] text-muted-2"><IconFolder size={11} /> {wzFolder(t, k)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
