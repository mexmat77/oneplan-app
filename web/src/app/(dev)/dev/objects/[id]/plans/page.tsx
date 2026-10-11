"use client";

// Вкладка «Планировки» (§1.8, прототип 585–815): схемы Шахматка / Список / Поэтажный план, фильтры, панель управления
// (редактирование сетки, мастер планировок, зум, сегменты), виллы, легенда, модалки квартиры и мастера.
// Query: `?u=<uid>` — открыть модалку квартиры (переход из журнала), `?scheme=board|list|floor` — стартовая схема.
import { IconBuildingStore, IconCheck, IconChevronDown, IconFileSpreadsheet, IconLayoutGrid, IconLayoutGridAdd, IconList, IconPencil, IconPrinter, IconSearch, IconStack2, IconWand, IconZoomOut } from "@tabler/icons-react";
import { useParams, useSearchParams } from "next/navigation";
import { Suspense, useMemo, useState, type CSSProperties } from "react";
import { Board } from "@/components/dev/board/Board";
import { FilterSheet, type SheetOpt } from "@/components/dev/board/FilterSheet";
import { FloorPlan } from "@/components/dev/board/FloorPlan";
import { Legend } from "@/components/dev/board/Legend";
import { ListView, nextSort, sortUnits, type SortKey } from "@/components/dev/board/ListView";
import { MkModal } from "@/components/dev/board/MkModal";
import { UnitModal } from "@/components/dev/board/UnitModal";
import { VillaCards, VillaChips, VillaPlan } from "@/components/dev/board/VillaPlan";
import { useEnsureUnits, useObj } from "@/components/dev/board/shared";
import { useDevT } from "@/i18n/dev";
import { STORDER, typeLabel } from "@/lib/dev/data";
import { EMPTY_FILTERS, gNormPos, hasCommercial, makePass, needsNormPos, segPassOf, type BoardFilters, type Seg } from "@/lib/dev/grid";
import { legacyKindOf } from "@/lib/dev/rows";
import { buildExportRows, downloadXls, exportPdf } from "@/lib/dev/xlsx";
import type { UnitStatus } from "@/lib/dev/types";
import { mutUnits, setBoardZoom } from "@/store/dev";

type Scheme = "board" | "list" | "floor";
const SCHEMES: Scheme[] = ["board", "list", "floor"];

export default function Page() {
  return <Suspense><PlansPage /></Suspense>;
}

const numInp = "rounded-[10px] border border-line bg-surface p-[10px] text-[14px] outline-none focus:border-blue";
const fltLbl = "mb-[6px] block text-[13px] text-text-2";
const PLND = (mw: number, on: boolean): CSSProperties => ({ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, minWidth: mw, padding: "10px 12px", borderRadius: 10, fontSize: 14, cursor: "pointer", whiteSpace: "nowrap", ...(on ? { background: "rgba(77,124,254,0.1)", border: "1px solid rgba(77,124,254,0.45)", color: "#2f5fe0", fontWeight: 500 } : { background: "#fff", border: "1px solid #e6e9f0", color: "#1b2942" }) });
const btnTool = "inline-flex cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[10px] border px-[14px] py-[9px] text-[13px] font-bold";
const smallBtn = (on: boolean) => `cursor-pointer whitespace-nowrap rounded-[8px] border px-[11px] py-[7px] text-[12px] font-bold ${on ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-text-2"}`;
const segBtn = (on: boolean) => `cursor-pointer whitespace-nowrap rounded-[8px] border px-3 py-[7px] text-[12px] font-bold ${on ? "border-ink bg-ink text-white" : "border-line bg-surface text-text-2"}`;

function PlansPage() {
  const { t } = useDevT();
  const params = useParams<{ id: string }>();
  const sp = useSearchParams();
  const objId = +params.id;
  const { obj, units, boardZoom } = useObj(objId);
  useEnsureUnits(objId, obj, units);
  const isVillas = obj?.villas === true;
  const isMixed = obj?.mixed === true;
  const [scheme, setScheme] = useState<Scheme>(() => { const q = sp.get("scheme") as Scheme | null; return q && SCHEMES.includes(q) ? q : "board"; });
  const [listVariant, setListVariant] = useState<"table" | "cards">("table");
  const [f, setF] = useState<BoardFilters>(EMPTY_FILTERS);
  const [editGrid, setEditGrid] = useState(false);
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "", dir: 1 });
  const [modalUid, setModalUid] = useState<number | null>(() => { const q = sp.get("u"); return q && +q ? +q : null; });
  const [mkOpen, setMkOpen] = useState(false);
  const [sheet, setSheet] = useState<{ title: string; key: "fRoom" | "fSt" | "fWing"; opts: SheetOpt[] } | null>(null);
  const pass = useMemo(() => makePass(f), [f]);
  const segUnits = useMemo(() => units.filter(segPassOf(f.seg)), [units, f.seg]);
  const listUnits = useMemo(() => sortUnits(units, pass, sort.key, sort.dir), [units, pass, sort]);
  if (!obj) return null;

  const eff: Scheme = isVillas && scheme === "floor" ? "board" : scheme;
  const isBoard = eff === "board", isList = eff === "list", isFloor = eff === "floor";
  const showFilters = (scheme !== "floor" || isVillas) && !editGrid;
  const hasCom = hasCommercial(units);
  const showSeg = hasCom || isMixed;
  const loadingLegacy = !!legacyKindOf(obj) && units.length === 0;
  const hasNoUnits = units.length === 0 && !isVillas && !loadingLegacy;
  const wings = [...new Set(units.filter((u) => !u.vl && u.wing).map((u) => u.wing as string))].sort();
  const showVillas = isMixed && !isVillas && units.some((u) => u.vl && pass(u));
  const hasVillaPlan = isVillas && units.some((u) => u.px != null);
  const mkBtnShow = !editGrid;

  const toggleEdit = () => {
    if (!editGrid && needsNormPos(units)) mutUnits(objId, gNormPos);
    setEditGrid((v) => !v);
    if (scheme === "floor") setScheme("board");
  };
  const onCreated = (editAfter: boolean, newIds: number[]) => {
    setScheme("board"); setF((s) => ({ ...s, seg: "", fSt: "", fRoom: "" })); setEditGrid(editAfter);
    const scrollToNew = (tries: number) => {
      const els = newIds.map((id) => document.querySelector(`[data-opluid="${id}"]`)).filter(Boolean) as Element[];
      if (!els.length) { if (tries > 0) setTimeout(() => scrollToNew(tries - 1), 250); return; }
      let top = Infinity; els.forEach((el) => { const tp = el.getBoundingClientRect().top; if (tp < top) top = tp; });
      window.scrollTo({ top: Math.max(0, top + window.pageYOffset - 170), behavior: "smooth" });
    };
    setTimeout(() => scrollToNew(6), 550);
  };
  const exportExcel = () => downloadXls(buildExportRows(units.filter(pass), obj, t), obj, t, obj.cur || "EUR");
  const schemeBtns: [Scheme, string, React.ReactNode][] = [["board", t.scheme_board, <IconLayoutGrid key="b" size={16} />], ["list", t.scheme_list, <IconList key="l" size={16} />], ...(isVillas ? [] : [["floor", t.scheme_floor, <IconStack2 key="f" size={16} />] as [Scheme, string, React.ReactNode]])];
  const segs: [Seg, string][] = [["", t.opt_all], ["res", t.seg_res], ...(hasCom ? [["com", t.seg_com] as [Seg, string]] : []), ...(isMixed ? [["vil", t.seg_vil] as [Seg, string]] : [])];
  const editBtn = <button type="button" onClick={toggleEdit} className={`${btnTool} ${editGrid ? "border-green bg-green text-white" : "border-ink bg-ink text-white"}`}>{editGrid ? <IconCheck size={15} /> : <IconPencil size={15} />} {editGrid ? t.ed.done : t.ed.edit}</button>;
  const mkBtn = (blue: boolean) => mkBtnShow && <button type="button" onClick={() => setMkOpen(true)} className={`${btnTool} ${blue ? "border-blue bg-blue-tint text-[#3a63d4] hover:bg-[#e2ebff]" : "border-line bg-surface text-ink-2 hover:border-blue hover:text-blue"}`}><IconWand size={15} /> {t.mk.btn}</button>;
  const segBtns = showSeg && (
    <span className="inline-flex items-center gap-1"><IconBuildingStore size={16} className="text-muted" />{segs.map(([k, label]) => <button key={k} type="button" onClick={() => setF({ ...f, seg: k })} className={segBtn(f.seg === k)}>{label}</button>)}</span>
  );
  // Шахматка: легенда над сеткой, липнет под вкладками объекта (sticky 50px) при прокрутке — как на публичной странице
  const legendTop = <Legend units={segUnits} fSt={f.fSt} onChange={(st) => setF({ ...f, fSt: st })} stickyTop={58} className="mb-[12px]" />;

  return (
    <>
      <div className="mb-[6px] text-[13px] text-text-2">{obj.name} / {t.plans_title}</div>
      <div className="mb-[18px] flex flex-wrap items-end justify-between gap-4">
        <h1 className="m-0 text-[28px] font-extrabold tracking-[-.02em] text-ink">{t.plans_title}</h1>
        <div className="flex flex-wrap gap-2">
          {schemeBtns.map(([k, label, icon]) => <button key={k} type="button" onClick={() => setScheme(k)} className={`inline-flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[10px] border px-4 py-[9px] text-[14px] font-semibold ${eff === k ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2"}`}>{icon} {label}</button>)}
          <button type="button" onClick={exportExcel} className="inline-flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[10px] border border-line bg-surface px-4 py-[9px] text-[14px] font-semibold text-ink-2 hover:border-[#137a4d] hover:text-[#137a4d]"><IconFileSpreadsheet size={16} /> Excel</button>
          <button type="button" onClick={() => exportPdf(obj, eff)} className="inline-flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[10px] border border-line bg-surface px-4 py-[9px] text-[14px] font-semibold text-ink-2 hover:border-ink"><IconPrinter size={16} /> PDF</button>
        </div>
      </div>

      {showFilters && (
        <div className="mb-[18px] flex flex-nowrap items-end gap-[14px] overflow-x-auto pb-1">
          <div><label className={fltLbl}>{t.f_num}</label><div className="relative"><IconSearch size={16} className="absolute left-[10px] top-1/2 -translate-y-1/2 text-muted" /><input value={f.qNum} onChange={(e) => setF({ ...f, qNum: e.target.value })} placeholder="45" className={`${numInp} w-[110px] pl-[30px]`} /></div></div>
          {wings.length > 1 && (
            <div><label className={fltLbl}>{t.f_block}</label><div onClick={() => setSheet({ title: t.f_block, key: "fWing", opts: [["", t.opt_all], ...wings.map((w) => [w, `${t.block} ${w}`] as SheetOpt)] })} style={PLND(120, !!f.fWing)}>{f.fWing ? `${t.block} ${f.fWing}` : t.opt_all} <IconChevronDown size={16} className="text-muted" /></div></div>
          )}
          <div><label className={fltLbl}>{t.f_rooms}</label><div onClick={() => setSheet({ title: t.f_rooms, key: "fRoom", opts: [["", t.opt_all], ["1+1", "1+1"], ["2+1", "2+1"], ["3+1", "3+1"], ["1*", typeLabel("1*", t)]] })} style={PLND(110, !!f.fRoom)}>{f.fRoom ? typeLabel(f.fRoom, t) : t.opt_all} <IconChevronDown size={16} className="text-muted" /></div></div>
          <div><label className={fltLbl}>{t.f_area}</label><div className="flex items-center gap-[6px]"><input type="number" placeholder="45" value={f.aMin} onChange={(e) => setF({ ...f, aMin: e.target.value })} className={`${numInp} w-[76px]`} /><span>–</span><input type="number" placeholder="221" value={f.aMax} onChange={(e) => setF({ ...f, aMax: e.target.value })} className={`${numInp} w-[76px]`} /></div></div>
          <div><label className={fltLbl}>{t.f_price}</label><div className="flex items-center gap-[6px]"><input type="number" placeholder="0" value={f.pMin} onChange={(e) => setF({ ...f, pMin: e.target.value })} className={`${numInp} w-[90px]`} /><span>–</span><input type="number" placeholder="600000" value={f.pMax} onChange={(e) => setF({ ...f, pMax: e.target.value })} className={`${numInp} w-[90px]`} /></div></div>
          <div><label className={fltLbl}>{t.f_status}</label><div onClick={() => setSheet({ title: t.f_status, key: "fSt", opts: [["", t.opt_all], ...STORDER.map((k) => [k, t.status[k]] as SheetOpt)] })} style={PLND(120, !!f.fSt)}>{f.fSt ? t.status[f.fSt] : t.opt_all} <IconChevronDown size={16} className="text-muted" /></div></div>
        </div>
      )}

      {isBoard && (
        <>
          {isVillas && (
            <>
              <div className="mb-[14px] flex flex-wrap items-center gap-2"><VillaChips objId={objId} filters={f} onChange={setF} /></div>
              {hasVillaPlan && <VillaPlan objId={objId} filters={f} onOpenUnit={setModalUid} />}
              <div className="mb-[14px] flex flex-wrap items-center gap-[10px]">{editBtn}{mkBtn(false)}</div>
              <VillaCards objId={objId} filters={f} editOn={editGrid} onOpenUnit={setModalUid} />
            </>
          )}
          {!isVillas && (
            <div className="mb-[14px] flex flex-wrap items-center gap-[10px]">
              {editBtn}{mkBtn(true)}
              <span className="inline-flex items-center gap-1"><IconZoomOut size={16} className="text-muted" />{([[1, "100%"], [0.75, "75%"], [0.5, "50%"]] as [number, string][]).map(([z, label]) => <button key={z} type="button" onClick={() => setBoardZoom(z)} className={smallBtn(boardZoom === z)}>{label}</button>)}</span>
              {segBtns}
              {editGrid && <span className="min-w-[220px] flex-1 text-[12px] text-text-2">{t.ed.hint}</span>}
            </div>
          )}
          {hasNoUnits && (
            <div className="mb-[18px] rounded-[18px] border-2 border-dashed border-[#cdd5e2] bg-[#fbfcfe] px-6 py-11 text-center">
              <div className="mx-auto mb-[14px] flex h-[58px] w-[58px] items-center justify-center rounded-[16px] bg-blue-tint text-[26px] text-blue"><IconLayoutGridAdd size={26} /></div>
              <div className="text-[18px] font-extrabold text-ink">{t.mk.empty_title}</div>
              <div className="mx-auto mb-[18px] mt-[6px] max-w-[440px] text-[13.5px] text-text-2">{t.mk.empty_sub}</div>
              {mkBtnShow && <button type="button" onClick={() => setMkOpen(true)} className="inline-flex cursor-pointer items-center gap-2 rounded-[11px] border-none bg-blue px-5 py-3 text-[14px] font-bold text-white hover:bg-blue-2"><IconWand size={16} /> {t.mk.btn}</button>}
            </div>
          )}
          {!hasNoUnits && legendTop}
          <Board objId={objId} editOn={editGrid} filters={f} onOpenUnit={setModalUid} />
          {showVillas && (
            <>
              <div className="mb-3 mt-[22px] inline-block rounded-[8px] bg-ink px-3 py-[6px] text-[15px] font-extrabold tracking-[.04em] text-white">{t.board.villalar}</div>
              <VillaCards objId={objId} filters={f} editOn={editGrid} onOpenUnit={setModalUid} mixed />
            </>
          )}
        </>
      )}

      {isList && (
        <>
          <div className="mb-[14px] flex flex-wrap items-center gap-[10px]">{editBtn}{mkBtn(false)}</div>
          <div className="mb-4 flex flex-wrap items-center gap-[10px]">
            {([["table", t.lv_table, <IconLayoutGrid key="t" size={15} />], ["cards", t.lv_cards, <IconLayoutGrid key="c" size={15} />]] as const).map(([k, label, icon]) => (
              <button key={k} type="button" onClick={() => setListVariant(k)} className={`inline-flex cursor-pointer items-center gap-[6px] rounded-[9px] border px-[14px] py-2 text-[13px] font-semibold ${listVariant === k ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-text-2"}`}>{k === "table" ? <IconList size={15} /> : icon} {label}</button>
            ))}
            {isVillas && <span className="ml-[6px] inline-flex flex-wrap items-center gap-[5px]"><VillaChips objId={objId} filters={f} onChange={setF} /></span>}
            {showSeg && <span className="ml-[6px]">{segBtns}</span>}
            <div className="flex-1" />
            <span className="text-[13px] text-text-2">{listUnits.length} {t.units_count}</span>
          </div>
          {editGrid && (
            <div className="mb-[12px] flex items-center gap-[9px] rounded-[11px] border border-[#c9d6f5] bg-blue-tint px-[14px] py-[10px] text-[13px] font-semibold text-[#3a63d4]">
              <IconPencil size={16} className="flex-none" /> {listVariant === "table" ? t.lv_edit_hint : t.lv_edit_hint_cards}
            </div>
          )}
          <ListView objId={objId} units={listUnits} variant={listVariant} sortKey={sort.key} sortDir={sort.dir} onSort={(k) => setSort(nextSort(sort, k))} onOpenUnit={setModalUid} editOn={editGrid}
            header={<Legend units={segUnits} fSt={f.fSt} onChange={(st) => setF({ ...f, fSt: st })} sticky={false} />} />
        </>
      )}

      {isFloor && <FloorPlan objId={objId} onOpenUnit={setModalUid} legendTop={58} />}

      <FilterSheet open={!!sheet} title={sheet?.title || ""} opts={sheet?.opts || []} value={sheet ? f[sheet.key] : ""} onPick={(v) => { if (sheet) setF({ ...f, [sheet.key]: v as UnitStatus | "" }); }} onClose={() => setSheet(null)} />
      <UnitModal objId={objId} uid={modalUid} onClose={() => setModalUid(null)} editOn={editGrid || isFloor} />
      <MkModal objId={objId} open={mkOpen} onClose={() => setMkOpen(false)} onCreated={onCreated} />
    </>
  );
}
