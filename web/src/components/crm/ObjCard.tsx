"use client";

// Карточка объекта в CRM (0024): объявление риэлтора, квартира застройщика или свободный текст — один вид везде
// (сделка, заявка, варианты, выбор). Данные для кратких карточек приходят из getClient (`objs`, `units`).
import Link from "next/link";
import { IconExternalLink, IconHome, IconX } from "@tabler/icons-react";
import type { ListingBrief } from "@/app/crm/actions";
import { ilName, ilceName } from "@/lib/seed";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { unitKey, type ObjRef, type UnitBrief } from "@/lib/crm/types";
import { useI18n } from "@/i18n/provider";

export type Briefs = { objs: Record<string, ListingBrief>; units: Record<string, UnitBrief> };
const ST_UNIT: Record<string, string> = { free: "#0f9d6b", booked: "#c98d00", process: "#4d7cfe", sold: "#e5484d", reserve: "#7b4fd0", na: "#8a94a6" };
const ST_LISTING: Record<string, string> = { active: "#0f9d6b", reserved: "#c98d00", sold: "#e5484d", off: "#8a94a6" };

export function ObjCard({ r, briefs, onRemove, compact, selected, onClick }: { r: ObjRef; briefs: Briefs; onRemove?: () => void; compact?: boolean; selected?: boolean; onClick?: () => void }) {
  const { t } = useI18n();
  const c = t.crm;
  const box = `flex items-center gap-3 rounded-[6px] border p-2 ${selected ? "border-blue-2 bg-blue-tint/40" : "border-line bg-[#fafbfc]"} ${onClick ? "cursor-pointer hover:border-blue-2" : ""}`;
  const del = onRemove && <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} title={c.obj.unlink} className="flex h-7 w-7 flex-none cursor-pointer items-center justify-center rounded-[4px] text-muted hover:bg-red-tint hover:text-red"><IconX size={14} /></button>;
  if (r.kind === "free") {
    return (
      <div className={box} onClick={onClick}>
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[4px] bg-bg-2 text-muted"><IconHome size={16} /></span>
        <div className="min-w-0 flex-1"><div className="truncate text-[13px] font-semibold text-ink">{r.text}</div><div className="truncate text-[12px] text-muted">{c.obj.freeLabel}{r.url ? ` · ${r.url}` : ""}</div></div>
        {r.url && <a href={r.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="flex h-7 w-7 items-center justify-center rounded-[4px] text-muted hover:bg-bg-2 hover:text-ink"><IconExternalLink size={15} /></a>}
        {del}
      </div>
    );
  }
  if (r.kind === "unit") {
    const u = briefs.units[unitKey(r.projectId, r.unitUid)];
    if (!u) return <div className={box} onClick={onClick}><div className="text-[12px] text-muted">{c.obj.unit} #{r.unitUid}</div>{del}</div>;
    const st = (c.obj.unitSt as Record<string, string>)[u.status] ?? u.status;
    return (
      <div className={box} onClick={onClick}>
        <span className="flex h-9 min-w-9 flex-none items-center justify-center rounded-[4px] bg-bg-2 px-1 text-[12px] font-bold text-ink">{u.num || "—"}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-semibold text-ink">{u.projectName}{u.wing ? ` · ${c.obj.wing} ${u.wing}` : ""} · {c.obj.floor} {u.floor}</div>
          {!compact && <div className="truncate text-[12px] text-muted">{[u.type, u.area ? `${u.area} m²` : null].filter(Boolean).join(" · ")}</div>}
        </div>
        <span className="rounded-[4px] px-[6px] py-[1px] text-[10.5px] font-bold text-white" style={{ background: ST_UNIT[u.status] ?? "#8a94a6" }}>{st}</span>
        <div className="text-[13px] font-semibold text-ink">{u.price ? fmt(u.price, u.cur as Currency) : "—"}</div>
        {del}
      </div>
    );
  }
  const o = briefs.objs[r.id];
  if (!o) return <div className={box} onClick={onClick}><div className="text-[12px] text-muted">{c.obj.title}: {r.id.slice(0, 8)}</div>{del}</div>;
  const loc = [o.il ? ilName(o.il) : null, o.ilce ? ilceName(o.ilce) : null].filter(Boolean).join(" › ");
  const st = (c.obj.listingSt as Record<string, string>)[o.status] ?? o.status;
  return (
    <div className={box} onClick={onClick}>
      <div className="h-12 w-16 flex-none overflow-hidden rounded-[4px] bg-bg-2">{o.cover ? <img src={o.cover} alt="" className="h-full w-full object-cover" /> : null}</div>{/* eslint-disable-line @next/next/no-img-element */}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-semibold text-ink">{o.no != null && <span className="mr-1 text-muted">OP-{o.no}</span>}{o.title || "—"}</div>
        {!compact && <div className="truncate text-[12px] text-muted">{[t.deal[o.deal as keyof typeof t.deal], t.typ[o.type as keyof typeof t.typ], o.rooms, o.area ? `${o.area} m²` : null, o.floor || null, loc || null].filter(Boolean).join(" · ")}</div>}
      </div>
      {o.status !== "active" && <span className="rounded-[4px] px-[6px] py-[1px] text-[10.5px] font-bold text-white" style={{ background: ST_LISTING[o.status] ?? "#8a94a6" }}>{st}</span>}
      <div className="text-[13px] font-semibold text-ink">{fmt(o.price, "TRY")}</div>
      <Link href={`/obj/${o.id}`} target="_blank" title={c.obj.open} onClick={(e) => e.stopPropagation()} className="flex h-7 w-7 items-center justify-center rounded-[4px] text-muted hover:bg-bg-2 hover:text-ink"><IconExternalLink size={15} /></Link>
      {del}
    </div>
  );
}

/** Ссылка на объект из полей сделки (listing_id / project_id+unit_uid / object_text). */
export function dealRef(d: { listingId: string | null; projectId: string | null; unitUid: number | null; objectText?: string | null }): ObjRef | null {
  if (d.listingId) return { kind: "listing", id: d.listingId };
  if (d.projectId && d.unitUid != null) return { kind: "unit", projectId: Number(d.projectId), unitUid: d.unitUid };
  if (d.objectText) return { kind: "free", text: d.objectText };
  return null;
}
