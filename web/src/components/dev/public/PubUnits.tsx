"use client";

// «Выбор квартиры» on the public page — prototype `OnePlan v2.dc.html` lines 1364–1479, data 4174–4196, spec §1.19.
// View buttons (board/list), segment buttons, zoom (board, non-villa), filters (rooms / area / price / status),
// board = shared `Board` with `editOn={false}` (+ `Legend`), villas = chips / plan / cards, list = `ListView` table.
import { useState, type CSSProperties } from "react";
import { Select } from "@/components/ui/Select";
import { IconChevronDown, IconLayoutGrid, IconList, IconStack2, IconZoomOut } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { STORDER, typeLabel } from "@/lib/dev/data";
import { fpHasAny } from "@/lib/dev/floorplan";
import { EMPTY_FILTERS, hasCommercial, makePass, segPassOf, type BoardFilters, type Seg } from "@/lib/dev/grid";
import type { Project, Unit, UnitStatus } from "@/lib/dev/types";
import { setBoardZoom, useDev } from "@/store/dev";
import { Board } from "@/components/dev/board/Board";
import { FloorPlan } from "@/components/dev/board/FloorPlan";
import { Legend } from "@/components/dev/board/Legend";
import { ListView, nextSort, sortUnits, type SortKey } from "@/components/dev/board/ListView";
import { VillaCards, VillaChips, VillaPlan } from "@/components/dev/board/VillaPlan";
import { UnitModal } from "@/components/dev/board/UnitModal";

const skin = (on: boolean): CSSProperties => (on ? { background: "rgba(77,124,254,0.1)", border: "1px solid rgba(77,124,254,0.45)", color: "#2f5fe0", fontWeight: 500 } : { background: "#fff", border: "1px solid #e6e9f0", color: "#1b2942" });
const numInp = "rounded-[9px] border border-line bg-surface p-[9px] text-[13px] outline-none";
const dark = (on: boolean) => (on ? "border-ink bg-ink text-white" : "border-line bg-surface text-text-2");

export function PubUnits({ obj, units }: { obj: Project; units: Unit[] }) {
  const { t } = useDevT();
  const s = useDev();
  const [view, setView] = useState<"board" | "list" | "floor">("board");
  const hasFloorPlans = fpHasAny(obj); // вкладка «Поэтажный план» — только если загружен хотя бы один план
  const [f, setF] = useState<BoardFilters>(EMPTY_FILTERS);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "", dir: 1 });
  const [openUid, setOpenUid] = useState<number | null>(null);
  const status = t.status as Record<string, string>;

  const pass = makePass(f);
  const isVillas = obj.villas === true;
  const mixed = obj.mixed === true;
  const hasComV = hasCommercial(units);
  const showSeg = hasComV || mixed;
  const showVillas = mixed && !isVillas && units.some((u) => u.vl && pass(u));
  const hasVillaPlan = isVillas && units.some((u) => u.px != null);
  const listCount = units.filter(pass).length;
  const segBtns: [Seg, string][] = [["", t.opt_all], ["res", t.seg_res], ...(hasComV ? [["com", t.seg_com] as [Seg, string]] : []), ...(mixed ? [["vil", t.seg_vil] as [Seg, string]] : [])];
  const set = (patch: Partial<BoardFilters>) => setF((v) => ({ ...v, ...patch }));

  return (
    <>
      <div className="mb-[14px] text-[13px] text-text-2">{obj.name} · {listCount} {t.units_count}</div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {([["board", t.scheme_board, <IconLayoutGrid key="b" size={15} />], ["list", t.scheme_list, <IconList key="l" size={15} />], ...(hasFloorPlans ? [["floor", t.fp.pub_tab, <IconStack2 key="f" size={15} />] as const] : [])] as const).map(([k, label, icon]) => (
          <button key={k} type="button" onClick={() => setView(k)} className={`inline-flex cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[9px] border px-[14px] py-2 text-[13px] font-semibold ${dark(view === k)}`}>{icon} {label}</button>
        ))}
        {showSeg && (
          <span className="ml-[6px] inline-flex items-center gap-1">
            {segBtns.map(([k, label]) => <button key={k} type="button" onClick={() => set({ seg: k })} className={`cursor-pointer whitespace-nowrap rounded-[8px] border px-3 py-[7px] text-[12px] font-bold ${dark(f.seg === k)}`}>{label}</button>)}
          </span>
        )}
        {view === "board" && !isVillas && (
          <span className="ml-auto inline-flex items-center gap-1">
            <IconZoomOut size={16} className="text-muted" />
            {([[1, "100%"], [0.75, "75%"], [0.5, "50%"]] as const).map(([z, label]) => <button key={z} type="button" onClick={() => setBoardZoom(z)} className={`cursor-pointer whitespace-nowrap rounded-[8px] border px-[11px] py-[7px] text-[12px] font-bold ${s.boardZoom === z ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-text-2"}`}>{label}</button>)}
          </span>
        )}
      </div>
      <div className="mb-4 flex flex-wrap items-end gap-3">
        <div>
          <label className="mb-[5px] block text-[12px] text-text-2">{t.f_rooms}</label>
          <Select value={f.fRoom} onChange={(v) => set({ fRoom: v })} size="sm" className="w-full rounded-[9px] py-[9px] text-[13px]" style={skin(!!f.fRoom)} options={[{ value: "", label: t.opt_all }, { value: "1+1", label: "1+1" }, { value: "2+1", label: "2+1" }, { value: "3+1", label: "3+1" }, { value: "1*", label: typeLabel("1*", t) }]} />
        </div>
        <div>
          <label className="mb-[5px] block text-[12px] text-text-2">{t.f_area}</label>
          <div className="flex items-center gap-[5px]"><input type="number" placeholder="45" value={f.aMin} onChange={(e) => set({ aMin: e.target.value })} className={`w-[68px] ${numInp}`} /><span>–</span><input type="number" placeholder="221" value={f.aMax} onChange={(e) => set({ aMax: e.target.value })} className={`w-[68px] ${numInp}`} /></div>
        </div>
        <div>
          <label className="mb-[5px] block text-[12px] text-text-2">{t.f_price}</label>
          <div className="flex items-center gap-[5px]"><input type="number" placeholder="0" value={f.pMin} onChange={(e) => set({ pMin: e.target.value })} className={`w-[84px] ${numInp}`} /><span>–</span><input type="number" placeholder="800000" value={f.pMax} onChange={(e) => set({ pMax: e.target.value })} className={`w-[84px] ${numInp}`} /></div>
        </div>
        <div>
          <label className="mb-[5px] block text-[12px] text-text-2">{t.f_status}</label>
          <Select value={f.fSt} onChange={(v) => set({ fSt: v as "" | UnitStatus })} size="sm" className="w-full rounded-[9px] py-[9px] text-[13px]" style={skin(!!f.fSt)} options={[{ value: "", label: t.opt_all }, ...STORDER.map((k) => ({ value: k, label: status[k] }))]} />
        </div>
      </div>

      {view === "floor" && <FloorPlan objId={obj.id} readOnly onOpenUnit={setOpenUid} legendTop={114} />}
      {view === "board" && (
        <>
          {isVillas && (
            <>
              <div className="mb-[14px] flex flex-wrap items-center gap-2"><VillaChips objId={obj.id} filters={f} onChange={setF} /></div>
              {hasVillaPlan && <VillaPlan objId={obj.id} filters={f} onOpenUnit={setOpenUid} />}
              <VillaCards objId={obj.id} filters={f} editOn={false} onOpenUnit={setOpenUid} />
            </>
          )}
          {/* легенда над шахматкой, липнет под шапкой (60px) и панелью якорей (низ ≈106px) при прокрутке */}
          {!isVillas && <Legend units={units.filter(segPassOf(f.seg))} fSt={f.fSt} onChange={(st) => set({ fSt: st })} stickyTop={114} className="mb-[12px]" />}
          {!isVillas && <Board objId={obj.id} editOn={false} filters={f} onOpenUnit={setOpenUid} />}
          {isVillas && <Legend units={units.filter(segPassOf(f.seg))} fSt={f.fSt} onChange={(st) => set({ fSt: st })} />}
          {showVillas && (
            <>
              <div className="mb-3 mt-[22px] inline-block rounded-[8px] bg-ink px-3 py-[6px] text-[15px] font-extrabold tracking-[.04em] text-white">{t.px.villalar}</div>
              <VillaCards objId={obj.id} filters={f} editOn={false} onOpenUnit={setOpenUid} mixed />
            </>
          )}
        </>
      )}
      {view === "list" && (
        <ListView objId={obj.id} units={sortUnits(units, pass, sort.key, sort.dir)} variant="table" sortKey={sort.key} sortDir={sort.dir} onSort={(k) => setSort(nextSort(sort, k))} onOpenUnit={setOpenUid} stickyTop={106} header={<Legend units={units.filter(segPassOf(f.seg))} fSt={f.fSt} onChange={(st) => set({ fSt: st })} sticky={false} />} />
      )}
      {openUid != null && <UnitModal objId={obj.id} uid={openUid} isPublicModal onClose={() => setOpenUid(null)} />}
    </>
  );
}
