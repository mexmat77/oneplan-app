"use client";

// «Требует внимания»: список того, что мешает объекту быть готовым (`lib/dev/issues.ts`), с переходом к каждой проблеме.
// Показывается на странице объекта (сворачиваемая плашка) и на последнем шаге мастера «Объект из файлов».
//   <ObjectIssues objId={id} />            — плашка; ничего не рисует, если замечаний нет
//   <ObjectIssues objId={id} showOk />     — рисует и «замечаний нет»
import { IconAlertTriangle, IconChevronDown, IconChevronRight, IconCircleCheckFilled } from "@tabler/icons-react";
import Link from "next/link";
import { useState } from "react";
import { useDevT } from "@/i18n/dev";
import { fLbl, numLabel } from "@/lib/dev/data";
import { buildIssues, type IssueKind } from "@/lib/dev/issues";
import { useObj } from "@/components/dev/board/shared";

export function ObjectIssues({ objId, showOk = false, defaultOpen = false }: { objId: number; showOk?: boolean; defaultOpen?: boolean }) {
  const { t } = useDevT();
  const { obj, units, planTypes } = useObj(objId);
  const [open, setOpen] = useState(defaultOpen);
  const [more, setMore] = useState<IssueKind | null>(null);
  if (!obj || !units.length) return null;
  const L = t.imp;
  const { list, total, ready, all } = buildIssues(obj, units, planTypes);
  if (!total) {
    return showOk ? <div className="flex items-center gap-[10px] rounded-[14px] border border-[#cdeedd] bg-[#eefaf3] px-[18px] py-[14px] text-[14px] font-semibold text-green"><IconCircleCheckFilled size={20} /> {L.k_ok}</div> : null;
  }
  const multiWing = new Set(units.map((u) => u.wing || "")).size > 1;
  const title: Record<IssueKind, string> = { noType: L.i_noType, noArea: L.i_noArea, noPrice: L.i_noPrice, notTraced: L.i_notTraced, floorNoPlan: L.i_floorNoPlan, typeNoImage: L.i_typeNoImage };
  const hint: Record<IssueKind, string> = { noType: L.i_h_noType, noArea: L.i_h_noArea, noPrice: L.i_h_noPrice, notTraced: L.i_h_notTraced, floorNoPlan: L.i_h_floorNoPlan, typeNoImage: L.i_h_typeNoImage };
  const chip = "whitespace-nowrap rounded-[7px] border border-[#ecd9a8] bg-surface px-[7px] py-[3px] text-[12px] font-semibold text-ink-2 hover:border-blue hover:text-blue";
  return (
    <div className="rounded-[14px] border border-[#f3d9a4] bg-[#fffaf0]">
      <button type="button" onClick={() => setOpen((v) => !v)} className="flex w-full cursor-pointer items-center gap-[10px] border-none bg-transparent px-[18px] py-[13px] text-left">
        <IconAlertTriangle size={20} className="flex-none text-[#b45309]" />
        <span className="flex-1 text-[14px] font-bold text-ink">{L.i_title}: {total}<span className="ml-[10px] font-medium text-text-2">{L.k_ready.replace("{a}", String(ready)).replace("{b}", String(all))}</span></span>
        {open ? <IconChevronDown size={17} className="text-muted" /> : <IconChevronRight size={17} className="text-muted" />}
      </button>
      {open && (
        <div className="flex flex-col gap-[12px] border-t border-dashed border-[#f3d9a4] px-[18px] py-[14px]">
          {list.map((is) => {
            const n = is.units.length + is.floors.length + is.types.length;
            const full = more === is.kind, cap = 14;
            return (
              <div key={is.kind}>
                <div className="text-[13.5px] font-bold text-ink">{title[is.kind]} · {n}</div>
                <div className="mb-[6px] text-[12px] text-text-2">{hint[is.kind]}</div>
                <div className="flex flex-wrap items-center gap-[5px]">
                  {(full ? is.units : is.units.slice(0, cap)).map((u) => (
                    <Link key={u.uid} href={`/dev/objects/${objId}/plans?u=${u.uid}${is.kind === "notTraced" ? "&scheme=floor" : ""}`} className={chip}>{multiWing && u.wing ? `${u.wing} · ` : ""}{numLabel(String(u.num).replace(/\*/g, ""))}</Link>
                  ))}
                  {is.floors.map((f) => <Link key={`${f.wing}|${f.floor}`} href={`/dev/objects/${objId}/plans?scheme=floor`} className={chip}>{f.wing ? `${t.block} ${f.wing} · ` : ""}{L.i_floor.replace("{f}", fLbl(f.floor, obj.fScheme || "tr"))}</Link>)}
                  {is.types.map((pt) => <Link key={pt.id} href={`/dev/objects/${objId}/set`} className={chip}>{pt.rooms} · {pt.name}</Link>)}
                  {is.units.length > cap && <button type="button" onClick={() => setMore(full ? null : is.kind)} className="cursor-pointer border-none bg-transparent px-[4px] text-[12px] font-semibold text-blue">{full ? L.i_less : L.i_more.replace("{n}", String(is.units.length - cap))}</button>}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
