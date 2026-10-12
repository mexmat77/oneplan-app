"use client";

// «Моё агентство» для свободного агента (12.10.2026): объяснение, как попасть в агентство.
import { IconBuilding } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";

export function TeamSolo() {
  const { t } = useI18n();
  const o = t.org.team;
  return (
    <div>
      <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{o.title}</h1>
      <p className="mb-4 mt-[5px] max-w-[640px] text-[14px] text-text-2">{o.sub}</p>
      <div className="flex items-start gap-3 rounded-[16px] border border-line bg-surface p-5">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-blue-tint text-blue-2"><IconBuilding size={20} /></span>
        <p className="text-[13.5px] leading-[1.55] text-text">{o.solo}</p>
      </div>
    </div>
  );
}
