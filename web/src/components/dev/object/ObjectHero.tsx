"use client";

// Hero карточки объекта (прототип 457–479; данные 4236–4240, 4206–4214, 4235): обложка с градиентом,
// «← Объекты», epSave, «Как видит клиент», кольцо готовности, редактируемое название, чипы, полоса ссылки.
import Link from "next/link";
import { useState } from "react";
import { IconArrowLeft, IconCopy, IconEye, IconEyeCheck, IconEyeOff, IconWorld } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { STAGECOLOR, slugOf } from "@/lib/dev/data";
import { LiveModal } from "@/components/dev/media/LiveModal";
import { SaveChip, eSet, heroCover, type EditObj } from "./shared";

export function ObjectHero({ obj, pct }: { obj: EditObj; pct: number }) {
  const { t } = useDevT();
  const [copied, setCopied] = useState(false);
  const [liveOpen, setLiveOpen] = useState(false);
  const pubUrl = `oneplan.pro/${slugOf(obj.name)}`;
  const live = (obj.live || "").trim();
  const copyLink = () => {
    try { navigator.clipboard.writeText(`https://${pubUrl}`); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };
  const chip = "whitespace-nowrap rounded-[20px] px-[11px] py-1 text-[11px] font-bold";
  return (
    <div className="relative mb-5 overflow-hidden rounded-[18px] bg-ink">
      <div className="absolute inset-0 bg-cover bg-center opacity-50" style={{ backgroundImage: `url('${heroCover(obj)}')` }} />
      <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,18,34,.3),rgba(10,18,34,.9))]" />
      <div className="relative flex min-h-[216px] flex-col gap-4 px-5 pb-[18px] pt-4">
        <div className="flex flex-wrap items-center gap-[10px]">
          <div className="whitespace-nowrap text-[12.5px] text-[#c9d6ee]"><Link href="/dev/objects" className="inline-flex cursor-pointer items-center gap-[5px]"><IconArrowLeft size={13} /> {t.obj_title}</Link></div>
          <div className="flex-1" />
          <SaveChip />
          <Link href={`/p/${slugOf(obj.name)}`} className="inline-flex cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[10px] border border-[rgba(255,255,255,.35)] bg-[rgba(255,255,255,.1)] px-[13px] py-2 text-[13px] font-semibold text-white hover:bg-[rgba(255,255,255,.2)]"><IconEye size={15} /> {t.edp.view}</Link>
          <div title={`${pct}% ${t.edp.complete}`} className="flex h-[46px] w-[46px] flex-none items-center justify-center rounded-full" style={{ background: `conic-gradient(#4d7cfe ${pct * 3.6}deg,#e6e9f0 0)` }}>
            <div className="flex h-[35px] w-[35px] items-center justify-center rounded-full bg-ink text-[11px] font-extrabold text-white">{pct}%</div>
          </div>
        </div>
        <div className="mt-auto">
          <input data-plain="1" value={obj.name} onChange={(e) => eSet(obj.id, { name: e.target.value })} placeholder={t.edp.name_ph} className="mx-[-10px] mb-[6px] w-[calc(100%+20px)] rounded-[10px] border-none bg-transparent px-[10px] py-1 font-[inherit] text-[clamp(24px,3.4vw,36px)] font-extrabold tracking-[-.02em] text-white outline-none focus:bg-[rgba(255,255,255,.14)]" />
          <div className="flex flex-wrap gap-[6px]">
            {live && <span onClick={() => setLiveOpen(true)} className={`${chip} cursor-pointer bg-red font-extrabold text-white`}>● LIVE</span>}
            <span className={`${chip} text-white`} style={{ background: STAGECOLOR[obj.stage] || "#4d7cfe" }}>{t.stages[obj.stage]}</span>
            <span className={chip} style={obj.iskan ? { background: "rgba(15,157,107,.9)", color: "#fff" } : { background: "rgba(255,255,255,.16)", color: "#cfd9ea" }}>{obj.iskan ? "İskan ✓" : "İskan —"}</span>
            <span className={`${chip} bg-[rgba(255,255,255,.16)] text-white`}>{t.sales[obj.salesSt]}</span>
            <span className={`${chip} bg-[rgba(255,255,255,.16)] text-[#8ff0c8]`}>{obj.ready}%</span>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 rounded-[13px] border border-[rgba(255,255,255,.14)] bg-[rgba(255,255,255,.08)] px-3 py-[9px] backdrop-blur-[4px]">
          <IconWorld size={17} className="text-[#8fb0e8]" />
          <span className="min-w-[180px] flex-1 break-all font-mono text-[13px] text-[#cfe0ff]">{pubUrl}</span>
          <button type="button" onClick={copyLink} className="inline-flex cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[9px] border border-[rgba(255,255,255,.35)] bg-transparent px-3 py-2 text-[13px] font-semibold text-white"><IconCopy size={15} /> {copied ? t.hub.copied : t.hub.copy}</button>
          <button type="button" onClick={() => eSet(obj.id, { pubHidden: !obj.pubHidden })} className={`inline-flex cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[9px] border border-[rgba(255,255,255,.35)] px-[13px] py-[9px] text-[13px] font-semibold ${obj.pubHidden ? "bg-[rgba(229,72,77,.25)] text-[#ffb3b6]" : "bg-[rgba(255,255,255,.1)] text-[#d9f2e5]"}`}>
            {obj.pubHidden ? <IconEyeOff size={15} /> : <IconEyeCheck size={15} />} {obj.pubHidden ? t.hub.vis_off : t.hub.vis_on}
          </button>
        </div>
      </div>
      {liveOpen && <LiveModal url={live} title={obj.name} onClose={() => setLiveOpen(false)} />}
    </div>
  );
}
