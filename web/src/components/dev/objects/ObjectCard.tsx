"use client";

// Object card — prototype `OnePlan v2.dc.html` lines 424–451 (`projectsView` item), spec §1.6.
import { IconEye, IconEyeOff, IconMapPin } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useDevT } from "@/i18n/dev";
import { STAGECOLOR, TAGCOLOR, slugOf } from "@/lib/dev/data";
import { displayLoc } from "@/lib/dev/geo";
import { OCC_CHIP, SALES_CHIP, type ProjectView } from "./projectView";

const chip = (bg: string, fg: string) => ({ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap" as const, background: bg, color: fg });

export function ObjectCard({ p, onLive }: { p: ProjectView; onLive: (p: ProjectView) => void }) {
  const { t } = useDevT();
  const router = useRouter();
  const sales = t.sales as Record<string, string>;
  const tags = t.tags as Record<string, string>;
  const salesKey = p.salesSt || "open";
  const occKey = p.occSt || "none";
  return (
    <div onClick={() => router.push(`/dev/objects/${p.id}`)} className="relative flex cursor-pointer flex-col overflow-hidden rounded-[16px] border border-line bg-surface transition-[box-shadow,transform] hover:-translate-y-[2px] hover:shadow-[0_12px_30px_rgba(20,36,63,.12)]">
      {p.cabHidden && (
        <div className="absolute inset-0 z-[5] flex flex-col items-center justify-center gap-[9px] rounded-[16px] bg-[rgba(238,242,248,.26)] backdrop-blur-[0.8px]">
          <IconEyeOff size={26} className="text-[#4a5878]" />
          <div className="flex flex-col items-center gap-1">
            <span className="inline-flex items-center rounded-[20px] bg-surface px-[15px] py-[5px] text-[13px] font-extrabold text-ink shadow-[0_2px_10px_rgba(0,0,0,.1)]"><IconEyeOff size={14} className="mr-1" />{t.co.hidden_badge}</span>
            {p.hiddenReason && <span className="rounded-[14px] bg-[rgba(255,255,255,.88)] px-[11px] py-[3px] text-[11.5px] font-bold text-[#4a5878] shadow-[0_1px_6px_rgba(0,0,0,.08)]">{p.hiddenReason}</span>}
          </div>
        </div>
      )}
      <div className="relative h-[150px] bg-[#e7eaf0]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        {p.coverUrl && <img src={p.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
        <span className="absolute left-[10px] top-[10px] whitespace-nowrap rounded-[20px] px-[10px] py-1 text-[11px] font-bold text-white" style={{ background: STAGECOLOR[p.stage] || "#14243f" }}>{p.stageLabel}</span>
        {p.hasIskan && <span className="absolute bottom-[10px] left-[10px] whitespace-nowrap rounded-[20px] bg-[rgba(15,157,107,.95)] px-[10px] py-1 text-[11px] font-bold text-white">{t.dx.iskan_ok}</span>}
        {p.isHidden && <span className="absolute bottom-[10px] right-[10px] inline-flex items-center gap-[5px] whitespace-nowrap rounded-[20px] bg-[rgba(20,36,63,.85)] px-[10px] py-1 text-[11px] font-bold text-[#c9d2e0]"><IconEyeOff size={12} /> {t.hub.vis_off}</span>}
        <div className="absolute right-[10px] top-[10px] flex items-center gap-[6px]">
          {p.hasLive && (
            <span onClick={(e) => { e.stopPropagation(); onLive(p); }} className="inline-flex cursor-pointer items-center gap-[5px] rounded-[20px] bg-red px-[9px] py-[5px] text-[10px] font-extrabold text-white shadow-[0_3px_10px_rgba(229,72,77,.45)]">
              <span className="h-[6px] w-[6px] rounded-full bg-white" style={{ animation: "oplPulse 1.6s infinite" }} />{t.dx.live}
            </span>
          )}
          <span onClick={(e) => { e.stopPropagation(); router.push(`/p/${slugOf(p.name)}`); }} title={t.co.as_client} className="inline-flex h-[26px] w-[30px] cursor-pointer items-center justify-center rounded-[20px] bg-[rgba(255,255,255,.94)] text-ink shadow-[0_2px_8px_rgba(20,36,63,.14)] hover:bg-surface hover:text-blue"><IconEye size={17} /></span>
        </div>
      </div>
      <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-[14px]">
        <div className="text-[16px] font-extrabold leading-[1.2] text-ink">{p.name}</div>
        <div className="flex items-center gap-[5px] text-[13px] text-text-2"><IconMapPin size={14} /> {displayLoc(p.loc, t.geo.no_addr)}</div>
        <div className="flex flex-wrap gap-1">
          <span style={chip(SALES_CHIP[salesKey][0], SALES_CHIP[salesKey][1])}>{sales[salesKey]}</span>
          {p.hasOcc && <span style={chip(OCC_CHIP[occKey][0], OCC_CHIP[occKey][1])}>{p.occSt === "full" ? t.occ.chip_full : t.occ.chip_started}</span>}
          {p.tags.map((k) => <span key={k} className="mr-1 whitespace-nowrap rounded-[6px] px-2 py-[3px] text-[11px] font-semibold" style={{ background: TAGCOLOR[k][1], color: TAGCOLOR[k][0] }}>{tags[k]}</span>)}
        </div>
        <div className="mt-auto flex flex-col gap-2 pt-[6px]">
          <div>
            <div className="mb-1 flex justify-between gap-2 text-[12px] text-text-2"><span className="whitespace-nowrap">{t.status.sold} · {p.pct}%</span><span className="whitespace-nowrap">{p.free} {t.pub.free_now}</span></div>
            <div className="h-[6px] rounded-[4px] bg-[#eef0f4]"><div className="h-full rounded-[4px] bg-blue" style={{ width: `${p.pct}%` }} /></div>
          </div>
          <div>
            <div className="mb-1 flex justify-between gap-2 text-[12px] text-text-2"><span className="whitespace-nowrap">{t.dev.ready}</span><span className="whitespace-nowrap font-bold text-green">{p.ready}%</span></div>
            <div className="h-[6px] rounded-[4px] bg-[#eef0f4]"><div className="h-full rounded-[4px] bg-green" style={{ width: `${p.ready}%` }} /></div>
          </div>
        </div>
        <div className="mt-[2px] flex justify-between gap-2 border-t border-dashed border-line pt-[9px] text-[12px] text-muted"><span className="overflow-hidden text-ellipsis whitespace-nowrap">{p.client}</span><span className="flex-none whitespace-nowrap">{p.total} {t.hub.units_total}</span></div>
      </div>
    </div>
  );
}
