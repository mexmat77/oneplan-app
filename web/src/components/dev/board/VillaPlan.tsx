"use client";

// Виллы (604–633, 715–729; данные 4163–4185):
//   <VillaChips objId filters onChange />           — чипы по типу виллы («Тип N») или комнатности 3+1/4+1/4+2
//   <VillaPlan objId filters onOpenUnit />           — план посёлка Avocado (`web-plan.jpg`) с маркерами `px/py` в %
//   <VillaCards objId filters editOn onOpenUnit mixed /> — карточки вилл (фото 118px, чип статуса, «Вилла N», мета, цена),
//                                                    в edit-режиме крестик удаления и карточка «+ Вилла»; `mixed` — вариант Allure (градиент 92px)
import { IconHome, IconMap2, IconPlus, IconX } from "@tabler/icons-react";
import { useMemo } from "react";
import { asset, money } from "@/lib/dev/data";
import { gAddVilla, makePass, type BoardFilters } from "@/lib/dev/grid";
import { villaPhoto } from "@/lib/dev/planTypes";
import type { Unit } from "@/lib/dev/types";
import { useDevT } from "@/i18n/dev";
import { mutUnits } from "@/store/dev";
import { textOn, useObj } from "./shared";

export function VillaChips({ objId, filters, onChange }: { objId: number; filters: BoardFilters; onChange: (f: BoardFilters) => void }) {
  const { t } = useDevT();
  const { units } = useObj(objId);
  const vts = useMemo(() => [...new Set(units.filter((u) => u.vl !== false && u.vt != null && u.vt !== "").map((u) => String(u.vt)))].sort((a, b) => ((+a || 99) - (+b || 99)) || a.localeCompare(b)), [units]);
  const chips = vts.length
    ? vts.map((n) => ({ label: `${t.vt_short} ${n}`, on: filters.fVType === n, click: () => onChange({ ...filters, fVType: filters.fVType === n ? "" : n }) }))
    : ["3+1", "4+1", "4+2"].map((tp) => ({ label: tp, on: filters.fRoom === tp, click: () => onChange({ ...filters, fRoom: filters.fRoom === tp ? "" : tp }) }));
  return (
    <>
      {chips.map((c) => (
        <span key={c.label} onClick={c.click} className={`cursor-pointer whitespace-nowrap rounded-[20px] border-[1.5px] px-[13px] py-[7px] text-[12px] font-bold ${c.on ? "border-green bg-green-tint text-green" : "border-line bg-surface text-text-2"}`}>{c.label}</span>
      ))}
    </>
  );
}

const LEFT = [65, 66, 67, 68, 69, 70, 71, 72, 73, 74];
export function VillaPlan({ objId, filters, onOpenUnit }: { objId: number; filters: BoardFilters; onOpenUnit: (uid: number) => void }) {
  const { t } = useDevT();
  const { units, colors, cur } = useObj(objId);
  const pass = useMemo(() => makePass(filters), [filters]);
  const markers = units.filter((u) => u.px != null);
  if (!markers.length) return null;
  return (
    <div className="mb-[18px] rounded-[16px] border border-line bg-surface p-3">
      <div className="mx-1 mb-[10px] mt-[2px] flex items-center gap-1 text-[14px] font-bold text-ink"><IconMap2 size={15} /> {t.villa_plan}</div>
      <div className="relative">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={asset("avocado-photos/web-plan.jpg")} loading="lazy" alt="" className="block w-full rounded-[12px]" />
        {markers.map((u) => {
          const ok = pass(u), free = u.status === "free";
          const col = free ? colors.free || "#22c15e" : "#8a93a2";
          const left = LEFT.indexOf(+u.num) > -1;
          const w = left ? 4.8 : 3.2, h = left ? 7.5 : 10.5, rot = left ? -40 : -2;
          const title = free ? `${t.villa_word} ${u.num} · ${u.type} · ${t.villa_house} ${u.area} м² · ${t.villa_land} ${u.la || 330} м²${u.price ? " · " + money(u.price, cur) : ""}` : `${t.villa_word} ${u.num} · ${t.status.sold}`;
          return (
            <div key={u.uid} onClick={() => onOpenUnit(u.uid)} title={title} className="group absolute flex cursor-pointer items-center justify-center rounded-[7px] hover:z-[5]"
              style={{ left: `${u.px}%`, top: `${u.py}%`, width: `${w}%`, height: `${h}%`, transform: `translate(-50%,-50%) rotate(${rot}deg)`, background: col + "4d", border: `2px solid ${col}`, opacity: ok ? 1 : 0.22 }}
              onMouseEnter={(e) => { e.currentTarget.style.background = col + "99"; }} onMouseLeave={(e) => { e.currentTarget.style.background = col + "4d"; }}>
              <span className="whitespace-nowrap rounded-[12px] px-[7px] py-[1px] text-[10.5px] font-extrabold text-white shadow-[0_1px_4px_rgba(0,0,0,.35)]" style={{ background: col, transform: `rotate(${-rot}deg)` }}>{u.num}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function VillaCards({ objId, filters, editOn, onOpenUnit, mixed = false }: { objId: number; filters: BoardFilters; editOn: boolean; onOpenUnit: (uid: number) => void; mixed?: boolean }) {
  const { t } = useDevT();
  const { obj, units, colors, cur } = useObj(objId);
  const pass = useMemo(() => makePass(filters), [filters]);
  if (!obj) return null;
  const isVillas = obj.villas === true;
  const list = (isVillas ? units : units.filter((u) => u.vl)).filter(pass);
  const card = (u: Unit) => {
    const col = colors[u.status] || "#9aa1ac";
    const photo = villaPhoto(obj, u);
    const meta = (u.vt ? `${t.vt_short} ${u.vt} · ` : "") + `${t.villa_house} ${u.area} м²` + (u.la ? ` · ${t.villa_land} ${u.la} м²` : u.blok ? ` · ${u.blok} BLOK` : "");
    return (
      <div key={u.uid} onClick={() => onOpenUnit(u.uid)} className="relative flex cursor-pointer flex-col overflow-hidden rounded-[16px] border border-line bg-surface transition-[transform,box-shadow] hover:-translate-y-[2px] hover:shadow-[0_10px_26px_rgba(20,36,63,.12)]">
        {editOn && !mixed && (
          <span onClick={(e) => { e.stopPropagation(); mutUnits(objId, (us) => us.filter((x) => x.uid !== u.uid)); }} title={t.ed.del_unit} className="absolute right-2 top-2 z-[4] flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-[7px] text-[13px] text-red shadow-[0_1px_4px_rgba(0,0,0,.2)]" style={{ background: "rgba(255,255,255,.94)" }}><IconX size={13} /></span>
        )}
        {mixed ? (
          <div className="relative h-[92px]" style={{ background: "linear-gradient(135deg,#e8eef7,#dde6f2)" }}>
            <div className="flex h-full w-full items-center justify-center text-[28px] text-[#8fa3c4]"><IconHome size={28} /></div>
            <span className="absolute left-2 top-2 whitespace-nowrap rounded-[20px] px-[10px] py-[3px] text-[11px] font-bold" style={{ color: textOn(u.status), background: col }}>{t.status[u.status]}</span>
          </div>
        ) : (
          <div className="relative h-[118px] bg-[#e7eaf0]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            {photo ? <img src={photo} loading="lazy" alt="" className="h-full w-full object-cover" /> : <div className="flex h-full w-full items-center justify-center text-[30px] text-muted-2"><IconHome size={30} /></div>}
            <span className="absolute left-2 top-2 whitespace-nowrap rounded-[20px] px-[10px] py-[3px] text-[11px] font-bold" style={{ color: textOn(u.status), background: col }}>{t.status[u.status]}</span>
          </div>
        )}
        <div className="flex flex-col gap-[5px] px-[13px] pb-[13px] pt-[11px]">
          <div className="flex items-center justify-between gap-[6px]"><span className="whitespace-nowrap text-[15px] font-extrabold text-ink">{t.villa_word} {u.num}</span><span className="whitespace-nowrap text-[12.5px] font-bold text-blue">{u.type}</span></div>
          <div className="text-[12px] text-text-2">{meta}</div>
          <div className="text-[16px] font-extrabold text-ink">{u.price ? money(u.price, cur) : ""}</div>
        </div>
      </div>
    );
  };
  return (
    <div className={`grid gap-[14px] ${mixed ? "" : "mb-[18px]"}`} style={{ gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))" }}>
      {list.map(card)}
      {!mixed && (isVillas || obj.mixed === true) && editOn && (
        <div onClick={() => mutUnits(objId, gAddVilla)} className="flex min-h-[180px] cursor-pointer flex-col items-center justify-center gap-2 rounded-[16px] border-2 border-dashed border-[#cdd5e2] bg-[#fbfcfe] text-[13px] font-bold text-blue hover:border-blue hover:bg-[#f5f8ff]"><IconPlus size={24} /> {t.villa_word}</div>
      )}
    </div>
  );
}
