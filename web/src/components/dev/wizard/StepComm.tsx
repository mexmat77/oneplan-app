"use client";

// Step 4 «Коммерция» — prototype lines 1877–1887: yes / no cards (`setCommYes` / `setCommNo`), count field when yes.
import { IconBuildingStore, IconHome } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import type { WzStepProps } from "./wizardState";

export function StepComm({ s, set }: WzStepProps) {
  const { t } = useDevT();
  const card = (on: boolean) => ({ flex: 1, minWidth: 180, border: `2px solid ${on ? "#4d7cfe" : "#e6e9f0"}`, background: on ? "#eef3ff" : "#fff", borderRadius: 14, padding: 18, cursor: "pointer", display: "flex", alignItems: "center", gap: 12 } as const);
  return (
    <>
      <p className="mb-5 text-[14px] text-text-2">{t.wz.comm_hint}</p>
      <div className="mb-3 text-[15px] font-semibold text-ink">{t.wz.comm_q}</div>
      <div className="mb-5 flex flex-wrap gap-[14px]">
        <div onClick={() => set({ comm: true })} style={card(s.comm)}>
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-[#fdf3e6] text-[20px] text-[#b45309]"><IconBuildingStore size={20} /></div>
          <span className="text-[15px] font-semibold text-ink">{t.wz.comm_yes}</span>
        </div>
        <div onClick={() => set({ comm: false })} style={card(!s.comm)}>
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-bg-2 text-[20px] text-muted"><IconHome size={20} /></div>
          <span className="text-[15px] font-semibold text-ink">{t.wz.comm_no}</span>
        </div>
      </div>
      {s.comm && (
        <div className="max-w-[340px] rounded-[14px] border border-line bg-surface p-5">
          <label className="mb-[7px] block text-[13px] text-text-2">{t.wz.comm_count}</label>
          <input type="number" value={s.commCount} onChange={(e) => set({ commCount: e.target.value })} placeholder={t.dx.wz_ph_count} className="w-full rounded-[11px] border border-line bg-[#fbfcfe] px-[14px] py-3 text-[15px] outline-none focus:border-blue" />
        </div>
      )}
    </>
  );
}
