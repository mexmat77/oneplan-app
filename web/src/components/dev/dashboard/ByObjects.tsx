"use client";

// «По объектам» — prototype lines 311–348 (search from >6 objects, limit 6, «Показать ещё (N)» / «Свернуть»).
import { displayLoc } from "@/lib/dev/geo";
import { IconChevronDown, IconSearch, IconSearchOff } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDevT } from "@/i18n/dev";
import { STAGECOLOR } from "@/lib/dev/data";
import type { ProjectView } from "@/components/dev/objects/projectView";
import type { ByObj } from "./dashModel";

const D_LIM = 6;

export function ByObjects({ dvis, byObj }: { dvis: ProjectView[]; byObj: ByObj[] }) {
  const { t } = useDevT();
  const L = t.dash;
  const router = useRouter();
  const [q, setQ] = useState("");
  const [exp, setExp] = useState(false);
  const qq = q.trim().toLowerCase();
  const filtered = qq ? byObj.filter((o) => { const p = dvis.find((x) => x.id === o.id); return `${o.name} ${o.loc} ${p?.companyName ?? ""}`.toLowerCase().includes(qq); }) : byObj;
  const show = exp ? filtered : filtered.slice(0, D_LIM);
  const hasMore = filtered.length > D_LIM;
  const moreLabel = exp ? L.collapse : `${L.more} (${filtered.length - Math.min(D_LIM, filtered.length)})`;

  return (
    <div className="rounded-[20px] border border-[#edeff4] bg-surface px-6 py-[22px] shadow-[0_1px_2px_rgba(20,36,63,.04)]">
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <span className="flex-none text-[15px] font-extrabold text-ink">{L.by_obj}</span>
        <span className="text-[12px] text-[#98a1af] [font-variant-numeric:tabular-nums]">{show.length} / {filtered.length} {L.shown}</span>
        <span className="flex-1" />
        {dvis.length > D_LIM && (
          <div className="relative min-w-[170px] max-w-[260px] flex-1">
            <IconSearch size={14} className="pointer-events-none absolute left-[11px] top-1/2 -translate-y-1/2 text-[#98a1af]" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={L.by_obj_q} className="w-full rounded-[10px] border border-line bg-[#fbfcfe] py-2 pl-8 pr-[11px] text-[13px] text-ink-2 outline-none focus:border-blue focus:bg-surface" />
          </div>
        )}
      </div>
      {filtered.length === 0 && <div className="rounded-[12px] border border-dashed border-[#dbe1ea] p-6 text-center text-[13px] text-[#98a1af]"><IconSearchOff size={20} className="mx-auto mb-[6px] block" />{L.nores}</div>}
      <div className="flex flex-col gap-[11px]">
        {show.map((o) => (
          <div key={o.id} onClick={() => router.push(`/dev/objects/${o.id}`)} className="cursor-pointer rounded-[14px] border border-line-2 px-[15px] py-[14px] hover:border-[#c9d6ef] hover:bg-[#fafbff]">
            <div className="mb-3 flex items-center gap-[10px]">
              <div className="min-w-0 flex-1">
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-extrabold text-ink">{o.name}</div>
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-[#98a1af]">{displayLoc(o.loc, t.geo.no_addr)}</div>
              </div>
              <span className="flex-none whitespace-nowrap rounded-[20px] px-[9px] py-[3px] text-[10.5px] font-bold text-white" style={{ background: STAGECOLOR[o.stage] || "#14243f" }}>{o.stageLabel}</span>
            </div>
            <div className="mb-[7px] flex items-center gap-[10px]">
              <span className="w-[74px] flex-none text-[11px] text-muted">{L.by_obj_sold}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-[5px] bg-line-2"><div className="h-full rounded-[5px] bg-blue" style={{ width: `${o.pct}%` }} /></div>
              <span className="w-[64px] text-right text-[12px] font-extrabold text-blue [font-variant-numeric:tabular-nums]">{o.soldLabel}</span>
            </div>
            <div className="flex items-center gap-[10px]">
              <span className="w-[74px] flex-none text-[11px] text-muted">{L.by_obj_ready}</span>
              <div className="h-2 flex-1 overflow-hidden rounded-[5px] bg-line-2"><div className="h-full rounded-[5px] bg-green" style={{ width: `${o.ready}%` }} /></div>
              <span className="w-[64px] text-right text-[12px] font-extrabold text-green [font-variant-numeric:tabular-nums]">{o.ready}%</span>
            </div>
          </div>
        ))}
      </div>
      {hasMore && (
        <div onClick={() => setExp((v) => !v)} className="mt-3 flex cursor-pointer select-none items-center justify-center gap-1 rounded-[11px] border border-line p-[10px] text-center text-[13px] font-bold text-blue hover:border-[#c9d6ef] hover:bg-[#fafbff]"><IconChevronDown size={15} className={exp ? "rotate-180" : ""} /> {moreLabel}</div>
      )}
    </div>
  );
}
