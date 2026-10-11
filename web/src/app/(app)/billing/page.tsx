"use client";

import { useState } from "react";
import { IconCircleCheck, IconCreditCard, IconFileDownload, IconLock } from "@tabler/icons-react";
import { useT } from "@/i18n/provider";
import { showToast } from "@/components/ui/toast";

// Packs from the prototype: [months, total ₺, ₺/month, saving]
const PACKS: [number, number, number, string][] = [[3, 4500, 1500, ""], [6, 7650, 1275, "−15%"], [12, 12600, 1050, "−30%"]];
const HISTORY = [{ d: "24.05.2026", p: "6", a: "7 650 ₺" }, { d: "24.11.2025", p: "6", a: "7 650 ₺" }];
const n = (v: number) => v.toLocaleString("ru-RU").replace(/,/g, " ").replace(/ /g, " ");

export default function BillingPage() {
  const t = useT();
  const [pick, setPick] = useState(6);
  return (
    <div className="mx-auto max-w-[820px]">
      <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.bil.title}</h1>
      <p className="mb-[18px] mt-[5px] max-w-[640px] text-[14px] text-text-2 [text-wrap:pretty]">{t.bil.sub}</p>
      {/* TODO: paid_to / plan from profiles */}
      <div className="mb-[18px] flex flex-wrap items-center gap-3 rounded-[16px] border border-[#bfe8d4] bg-green-tint px-[18px] py-[15px]">
        <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-green text-white"><IconCircleCheck size={18} /></span>
        <span className="min-w-[180px] flex-1">
          <span className="block text-[14.5px] font-extrabold text-[#0b6b4a]">{t.bil.activeTo} 24.11.2026</span>
          <span className="text-[12.5px] text-[#2e7d5b]">{t.bil.plan}: 6 {t.bil.mo}</span>
        </span>
      </div>
      <div className="mb-[14px] flex flex-wrap gap-3">
        {PACKS.map(([m, tot, pm, save]) => (
          <button key={m} type="button" onClick={() => setPick(m)} className={`relative min-w-[150px] flex-1 cursor-pointer rounded-[16px] border-2 bg-surface px-[18px] py-4 text-left hover:brightness-95 ${pick === m ? "border-blue-2" : "border-line"}`}>
            {save && <span className="absolute -top-[9px] right-3 rounded-[9px] bg-green px-[9px] py-[3px] text-[10.5px] font-extrabold text-white">{save} {t.bil.save}</span>}
            <div className="text-[14px] font-extrabold text-ink">{m} {t.bil.mo}</div>
            <div className="mt-[6px] text-[19px] font-extrabold text-blue-2">{n(pm)} {t.bil.perMo}</div>
            <div className="mt-[3px] text-[11.5px] text-muted">{n(tot)} ₺ {t.bil.total}</div>
          </button>
        ))}
      </div>
      <button type="button" onClick={() => showToast(t.bil.payT)} className="inline-flex cursor-pointer items-center gap-2 rounded-[12px] bg-blue-2 px-[26px] py-[13px] text-[14px] font-bold text-white hover:bg-blue-3"><IconCreditCard size={18} /> {t.bil.pay}</button>
      <div className="mt-4 flex items-start gap-[9px] rounded-[12px] border border-[#f3e2ae] bg-[#fdf5df] px-[14px] py-3 text-[12.5px] leading-[1.5] text-[#8a6400]"><IconLock size={15} className="mt-[1px] flex-none" /><span>{t.bil.lock}</span></div>
      <div className="mt-[18px] rounded-[16px] border border-line bg-surface px-5 py-[18px]">
        <div className="mb-[10px] text-[14.5px] font-extrabold text-ink">{t.bil.histT}</div>
        {HISTORY.map((h) => (
          <div key={h.d} className="flex flex-wrap items-center gap-3 border-t border-[#f2f4f8] py-[10px] text-[13px]">
            <span className="w-[90px] flex-none text-text-2">{h.d}</span>
            <span className="flex-1 font-bold text-ink">{h.p} {t.bil.mo}</span>
            <span className="font-extrabold text-ink">{h.a}</span>
            <span className="rounded-[10px] bg-green-tint px-[9px] py-[3px] text-[11px] font-bold text-green">{t.bil.paid}</span>
            <button type="button" title={t.bil.inv} className="cursor-pointer text-muted hover:text-blue"><IconFileDownload size={16} /></button>
          </div>
        ))}
      </div>
    </div>
  );
}
