"use client";

// Шахматка — единый движок (§4). Питает кабинет (`editOn`), публичную страницу (`editOn={false}`) и печать PDF (DOM с `data-board`).
//
//   <Board objId={8} editOn={editGrid} filters={filters} onOpenUnit={(uid) => setModalUid(uid)} />
//
// Пропсы:
//   objId       — id объекта (юниты/цвета/схема этажей читаются из стора `useDev`)
//   editOn      — режим «Редактировать сетку»: слоты, drag&drop, рамка выделения, ресайз, «+ Квартира»/«+ Этаж», переименование корпуса
//   filters     — `BoardFilters` из `@/lib/dev/grid` (сегмент/номер/корпус/комнаты/статус/площадь/цена); непрошедшие плитки — opacity .26
//   onOpenUnit  — клик по плитке (uid)
//   zoom        — CSS `zoom` контейнера (по умолчанию `boardZoom` из стора: 1 / .75 / .5)
//   showPerM2   — показывать цену за м² на плитке (по умолчанию true)
// Megapolis/Akropolis подгружают `rows.json` сами (`useEnsureUnits`).
import { IconArrowBarToLeft, IconArrowBarToRight, IconPencil, IconPlus, IconTrash, IconTriangle } from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useRef, useState, type DragEvent, type MouseEvent, type PointerEvent } from "react";
import { fLbl, money, moneyShort } from "@/lib/dev/data";
import { buildBlocks, CELL_STEP, EMPTY_FILTERS, gAddFloorBelowW, gAddFloorW, gAddUnit, gAlign, gDelFloor, gDelUnit, gGroupMove, gRenameWing, gRenum, gSwapUnits, makePass, segPassOf, widthPx, type Band, type BoardCell, type BoardFilters, type BoardFloor } from "@/lib/dev/grid";
import type { Unit } from "@/lib/dev/types";
import { useDevT } from "@/i18n/dev";
import { mutUnits, updateProject } from "@/store/dev";
import { perM2, useEnsureUnits, useObj } from "./shared";
import { Tile } from "./Tile";

export type BoardProps = {
  objId: number;
  editOn: boolean;
  filters?: BoardFilters;
  onOpenUnit: (uid: number) => void;
  zoom?: number;
  showPerM2?: boolean;
};

const SLOT_BORDER = "#cdd5e2";
const EMPTY_SEL: number[] = [];
const addBtnCls = "flex cursor-pointer items-center justify-center gap-[7px] rounded-[11px] border-2 border-dashed border-[#cdd5e2] text-[13px] font-bold text-blue hover:border-blue hover:bg-[#f5f8ff]";

export function Board({ objId, editOn, filters = EMPTY_FILTERS, onOpenUnit, zoom, showPerM2 = true }: BoardProps) {
  const { t } = useDevT();
  const { obj, units, colors, cur, boardZoom, genGrid } = useObj(objId);
  const loading = useEnsureUnits(objId, obj, units);
  const fScheme = obj?.fScheme || "tr";
  const renumOpts = { genGrid, starts: obj?.numStart };
  const pass = useMemo(() => makePass(filters), [filters]);
  const segPass = useMemo(() => segPassOf(filters.seg), [filters.seg]);
  const blocks = useMemo(() => buildBlocks(units, editOn, segPass), [units, editOn, segPass]);
  const compact = units.length > 120;
  const [gSelRaw, setGSel] = useState<number[]>([]);
  // сброс выделения при выходе из режима редактирования (паттерн «state от prop» без эффекта)
  const [prevEdit, setPrevEdit] = useState(editOn);
  if (prevEdit !== editOn) { setPrevEdit(editOn); if (!editOn && gSelRaw.length) setGSel([]); }
  const gSel = editOn ? gSelRaw : EMPTY_SEL;
  const dragUid = useRef<number | null>(null);
  const dragEl = useRef<HTMLElement | null>(null);
  const grpDim = useRef<HTMLElement[]>([]);
  const resizeSuppress = useRef(0);
  const lpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const selRef = useRef(gSel);
  useEffect(() => { selRef.current = gSel; }, [gSel]);
  const mut = useCallback((fn: (u: Unit[]) => Unit[]) => mutUnits(objId, fn), [objId]);
  const setNumStart = (wg: string, n: number) => { if (!obj) return; const numStart = { ...(obj.numStart || {}), [wg]: Math.max(1, n || 1) }; updateProject(obj.id, { numStart }); mut((us) => gRenum(us, { genGrid, starts: numStart })); };
  const selTgl = useCallback((uid: number) => setGSel((s) => (s.includes(uid) ? s.filter((x) => x !== uid) : [...s, uid])), []);

  // документные обработчики (2732–2791): рамка выделения, drop на плитку = обмен, long-press, очистка
  useEffect(() => {
    if (!editOn) return;
    const grpEnd = () => { grpDim.current.forEach((el) => { el.style.opacity = ""; el.style.outline = ""; el.style.outlineOffset = ""; }); grpDim.current = []; if (dragEl.current) { dragEl.current.style.pointerEvents = ""; dragEl.current = null; } };
    const dragOver = (e: Event) => e.preventDefault();
    const drop = (e: globalThis.DragEvent) => {
      const tg = e.target as HTMLElement | null;
      if (!tg || !tg.closest) { e.preventDefault(); return; }
      if (dragUid.current != null && !tg.closest("[data-oplslot]")) {
        const tile = tg.closest("[data-opluid]");
        if (tile) { const tuid = +(tile.getAttribute("data-opluid") || 0); const duid = dragUid.current; dragUid.current = null; e.preventDefault(); if (tuid && tuid !== duid) { mut((us) => gSwapUnits(us, duid, tuid, renumOpts)); setGSel([]); } return; }
      }
      e.preventDefault();
    };
    const dragEnd = () => { dragUid.current = null; document.querySelectorAll<HTMLElement>("[data-oplslot]").forEach((el) => { el.style.borderColor = SLOT_BORDER; el.style.background = ""; }); grpEnd(); };
    const mqDown = (e: globalThis.MouseEvent) => {
      if (e.button !== 0) return;
      const tg = e.target as HTMLElement | null;
      const board = tg && tg.closest ? tg.closest("[data-oplboard]") : null;
      if (!board) return;
      if (tg!.closest("[data-opluid]")) return;
      e.preventDefault();
      const x0 = e.clientX, y0 = e.clientY;
      const box = document.createElement("div");
      box.style.cssText = `position:fixed;z-index:200;border:1.5px solid #4d7cfe;background:rgba(77,124,254,.12);border-radius:6px;pointer-events:none;left:${x0}px;top:${y0}px;width:0;height:0`;
      document.body.appendChild(box);
      const mm = (ev: globalThis.MouseEvent) => { const x = Math.min(x0, ev.clientX), y = Math.min(y0, ev.clientY); box.style.left = x + "px"; box.style.top = y + "px"; box.style.width = Math.abs(ev.clientX - x0) + "px"; box.style.height = Math.abs(ev.clientY - y0) + "px"; };
      const mu = () => {
        document.removeEventListener("mousemove", mm); document.removeEventListener("mouseup", mu);
        const r = box.getBoundingClientRect(); box.remove();
        if (r.width < 8 && r.height < 8) { setGSel([]); return; }
        const ids: number[] = [];
        board.querySelectorAll("[data-opluid]").forEach((tl) => { const b = tl.getBoundingClientRect(); if (b.left < r.right && b.right > r.left && b.top < r.bottom && b.bottom > r.top) { const id = +(tl.getAttribute("data-opluid") || 0); if (id) ids.push(id); } });
        setGSel(ids);
      };
      document.addEventListener("mousemove", mm); document.addEventListener("mouseup", mu);
    };
    const lpStart = (e: TouchEvent) => {
      const tg = e.target as HTMLElement | null;
      const tl = tg && tg.closest ? tg.closest("[data-opluid]") : null;
      if (!tl) return;
      const id = +(tl.getAttribute("data-opluid") || 0); if (!id) return;
      lpTimer.current = setTimeout(() => selTgl(id), 550);
    };
    const lpCancel = () => clearTimeout(lpTimer.current);
    document.addEventListener("mousedown", mqDown);
    document.addEventListener("dragover", dragOver);
    document.addEventListener("drop", drop);
    document.addEventListener("dragend", dragEnd);
    document.addEventListener("touchstart", lpStart, { passive: true });
    document.addEventListener("touchmove", lpCancel, { passive: true });
    document.addEventListener("touchend", lpCancel, { passive: true });
    return () => {
      document.removeEventListener("mousedown", mqDown); document.removeEventListener("dragover", dragOver); document.removeEventListener("drop", drop); document.removeEventListener("dragend", dragEnd);
      document.removeEventListener("touchstart", lpStart); document.removeEventListener("touchmove", lpCancel); document.removeEventListener("touchend", lpCancel);
    };
  }, [editOn, mut, genGrid, selTgl]);

  // ---- обработчики плитки ----
  const openTile = (u: Unit) => (e: MouseEvent<HTMLDivElement>) => {
    if (editOn && (e.ctrlKey || e.metaKey)) { e.stopPropagation(); selTgl(u.uid); return; }
    if (resizeSuppress.current && Date.now() - resizeSuppress.current < 400) return;
    onOpenUnit(u.uid);
  };
  const dragStart = (u: Unit) => (e: DragEvent<HTMLDivElement>) => {
    if (!editOn) { e.preventDefault(); return; }
    dragUid.current = u.uid;
    if (e.dataTransfer) e.dataTransfer.effectAllowed = "move";
    const el0 = e.currentTarget;
    dragEl.current = el0;
    setTimeout(() => { el0.style.pointerEvents = "none"; }, 0);
    const sel = selRef.current;
    if (sel.length > 1 && sel.includes(u.uid)) {
      grpDim.current = [];
      const tiles: HTMLElement[] = [];
      document.querySelectorAll<HTMLElement>("[data-opluid]").forEach((tl) => { const id = +(tl.getAttribute("data-opluid") || 0); if (sel.includes(id)) { tl.style.opacity = ".45"; tl.style.outline = "2px dashed #4d7cfe"; tl.style.outlineOffset = "2px"; grpDim.current.push(tl); tiles.push(tl); } });
      if (e.dataTransfer && e.dataTransfer.setDragImage && tiles.length) {
        const rects = tiles.map((tl) => tl.getBoundingClientRect());
        const minL = Math.min(...rects.map((r) => r.left)), minT = Math.min(...rects.map((r) => r.top));
        const bbW = Math.max(...rects.map((r) => r.right)) - minL, bbH = Math.max(...rects.map((r) => r.bottom)) - minT;
        const k = Math.min(0.62, 320 / bbW, 260 / bbH);
        const gh = document.createElement("div");
        gh.style.cssText = `position:fixed;top:-3000px;left:-3000px;width:${bbW * k + 12}px;height:${bbH * k + 12}px;padding:6px;background:rgba(255,255,255,.9);border:1.5px solid #4d7cfe;border-radius:12px;box-shadow:0 14px 34px rgba(20,36,63,.35);overflow:hidden`;
        const inner = document.createElement("div");
        inner.style.cssText = `position:relative;width:${bbW}px;height:${bbH}px;transform:scale(${k});transform-origin:0 0`;
        tiles.slice(0, 24).forEach((tl, i) => { const r = rects[i]; const cl = tl.cloneNode(true) as HTMLElement; cl.style.cssText = tl.style.cssText; cl.style.position = "absolute"; cl.style.left = r.left - minL + "px"; cl.style.top = r.top - minT + "px"; cl.style.width = r.width + "px"; cl.style.minWidth = r.width + "px"; cl.style.height = r.height + "px"; cl.style.minHeight = r.height + "px"; cl.style.margin = "0"; cl.style.opacity = "1"; cl.style.outline = "none"; cl.style.overflow = "hidden"; inner.appendChild(cl); });
        gh.appendChild(inner);
        document.body.appendChild(gh);
        const cr = el0.getBoundingClientRect();
        e.dataTransfer.setDragImage(gh, (cr.left - minL + cr.width / 2) * k, (cr.top - minT + cr.height / 2) * k);
        setTimeout(() => gh.remove(), 0);
      }
    }
  };
  const delQuick = (u: Unit) => (e: MouseEvent) => { e.stopPropagation(); mut((us) => gDelUnit(us, u.uid, renumOpts)); };
  /** Ресайз за правый край (`applyW.resizeStart` 3525): плитка следует за курсором, при отпускании дощёлкивает к 139px. */
  const resizeStart = (u: Unit, startW: number, mx: number) => (e: PointerEvent<HTMLSpanElement>) => {
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX;
    const tile = e.currentTarget.parentNode as HTMLElement | null;
    const orig = tile ? tile.style.cssText : "";
    const px = widthPx;
    const clampPx = (dx: number) => Math.min(px(mx), Math.max(px(1), px(startW) + dx));
    const mv = (ev: globalThis.PointerEvent) => { const wp = clampPx(ev.clientX - startX); if (tile) { tile.style.transition = "none"; tile.style.width = wp + "px"; tile.style.minWidth = wp + "px"; tile.style.maxWidth = wp + "px"; } };
    const up = (ev: globalThis.PointerEvent) => {
      document.removeEventListener("pointermove", mv); document.removeEventListener("pointerup", up);
      const nw = Math.min(mx, Math.max(1, Math.round((clampPx(ev.clientX - startX) + 7) / CELL_STEP)));
      resizeSuppress.current = Date.now();
      const commit = () => { resizeSuppress.current = Date.now(); mut((us) => us.map((x) => (x.uid === u.uid ? { ...x, w: nw > 1 ? (nw as 2 | 3) : undefined } : x))); };
      if (tile) { tile.style.transition = "width .15s,min-width .15s,max-width .15s"; const wp = px(nw); tile.style.width = wp + "px"; tile.style.minWidth = wp + "px"; tile.style.maxWidth = wp + "px"; setTimeout(() => { tile.style.cssText = orig; commit(); }, 160); }
      else commit();
    };
    document.addEventListener("pointermove", mv); document.addEventListener("pointerup", up);
  };
  // слот (`mkSlot` 3558–3562)
  const slotOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); if (e.dataTransfer) e.dataTransfer.dropEffect = "move"; e.currentTarget.style.borderColor = "#4d7cfe"; e.currentTarget.style.background = "#eef3ff"; };
  const slotLeave = (e: DragEvent<HTMLDivElement>) => { e.currentTarget.style.borderColor = SLOT_BORDER; e.currentTarget.style.background = ""; };
  const slotDrop = (f: number, p: number, wg: string, bd: Band | null) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); e.currentTarget.style.borderColor = SLOT_BORDER; e.currentTarget.style.background = "";
    const uid = dragUid.current; dragUid.current = null;
    if (uid == null) return;
    const sel = selRef.current;
    mut((us) => gGroupMove(us, uid, sel, f, p, wg, bd, renumOpts) ?? us);
    setGSel([]);
  };

  const widthCap = t.board.width_cap;
  const renderCell = (c: BoardCell, i: number) => {
    if (c.kind === "hole") return <div key={i} style={{ flex: "none", width: 132 }} />;
    if (c.kind === "cover") return <div key={i} style={{ flex: "none", width: 132, minHeight: 92 }} />;
    if (c.kind === "slot") return <div key={i} data-oplslot="1" onDragOver={slotOver} onDragLeave={slotLeave} onDrop={slotDrop(c.f, c.p, c.wg, c.bd)} style={{ flex: "none", width: 132, minHeight: 0, alignSelf: "stretch", border: `2px dashed ${SLOT_BORDER}`, borderRadius: 11 }} />;
    const u = c.u;
    const sold = u.status === "sold";
    const priceLabel = !sold && u.price ? moneyShort(u.price, cur, t.mln) : "";
    const priceFull = !sold && u.price ? money(u.price, cur) : "";
    const twin = c.kind === "twin";
    return (
      <Tile
        key={twin ? `tw${u.uid}-${i}` : u.uid}
        u={u} sw={c.sw} ok={pass(u)} colors={colors} editOn={editOn} compact={compact} selected={!twin && gSel.includes(u.uid)} twin={twin}
        expand={c.kind === "unit" ? c.expand : undefined} fScheme={fScheme}
        priceLabel={priceLabel} priceFull={priceFull} perM2={perM2(u.price || 0, u.area || 1, cur)}
        showPerM2={showPerM2 && !sold && u.price > 0 && !(u.tag === "duplex" || u.tag === "tduplex" || u.tag === "triplex")}
        t={t} widthCap={widthCap}
        onOpen={openTile(u)} onDragStart={dragStart(u)} onDelQuick={delQuick(u)}
        onResizeStart={editOn && c.kind === "unit" ? resizeStart(u, c.sw, c.maxW) : undefined}
      />
    );
  };
  const renderFloor = (fl: BoardFloor, wg: string) => (
    <div key={fl.f} className="flex items-stretch gap-[10px]">
      <div className="sticky left-0 z-[6] flex w-[52px] flex-none flex-col items-center justify-center rounded-[9px] bg-[#eef0f4] p-1 shadow-[2px_0_6px_rgba(20,36,63,.08)]">
        {fl.hasSides && <span className="mb-[3px] text-center text-[8px] font-bold uppercase leading-[1.15] tracking-[.02em] text-muted-2">{t.win_out}</span>}
        <span className="text-[17px] font-extrabold text-ink">{fLbl(fl.f, fScheme)}</span>
        <span className="text-[10px] text-muted">{fl.ghost ? "" : fl.f === 0 ? t.ground : t.floor_short}</span>
        {editOn && !fl.ghost && <span onClick={() => mut((us) => gDelFloor(us, fl.f, wg, renumOpts))} title={t.ed.del_floor} className="mt-[3px] cursor-pointer text-[13px] text-red"><IconTrash size={13} /></span>}
        {fl.hasSides && <span className="mt-1 text-center text-[8px] font-bold uppercase leading-[1.15] tracking-[.02em] text-muted-2">{t.win_in}</span>}
      </div>
      <div className="flex flex-1 flex-col gap-[7px]">
        {fl.bands.map((band) => (
          <div key={band.bd} style={fl.ghost ? { display: "flex", gap: 7, alignItems: "stretch", minHeight: 92, border: "2px dashed #e2e6ee", borderRadius: 11, opacity: 0.6 } : { display: "flex", gap: 7, alignItems: "flex-start" }}>
            {band.cells.map(renderCell)}
            {editOn && !fl.ghost && (
              <div onClick={() => mut((us) => gAddUnit(us, fl.f, band.bd, wg, renumOpts))} className={`${addBtnCls} w-[110px] flex-none flex-col gap-[3px] self-stretch text-[12px] font-semibold`} style={{ minHeight: 0 }}>
                <IconPlus size={18} /> {t.ed.add_unit}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
  const alignBtn = (mode: "left" | "center" | "right", wg: string, Icon: typeof IconTriangle, label: string) => (
    <button key={mode} type="button" onClick={() => mut((us) => gAlign(us, mode, wg, renumOpts))} className="inline-flex cursor-pointer items-center gap-[5px] whitespace-nowrap rounded-[8px] border border-line bg-surface px-[10px] py-[6px] text-[12px] font-semibold text-[#3c4759] hover:border-blue hover:text-blue"><Icon size={13} /> {label}</button>
  );
  const z = zoom ?? boardZoom;

  return (
    <>
      {loading && <div className="mb-[18px] rounded-[14px] border border-dashed border-[#cdd5e2] bg-[#fbfcfe] px-6 py-8 text-center text-[13.5px] text-text-2">{t.board.legacy_loading}</div>}
      {blocks.map((bl) => (
        <div key={bl.wg} data-board="1" className="mb-[22px]">
          {!!bl.wg && !editOn && <div className="mb-[10px] inline-block rounded-[8px] bg-ink px-3 py-[6px] text-[15px] font-extrabold tracking-[.04em] text-white">{bl.wg === "T" ? t.board.ticari : `${t.block} ${bl.wg}`}</div>}
          {editOn && !!bl.wg && (
            <div className="mb-[10px] inline-flex items-center gap-[7px] rounded-[8px] bg-ink py-[5px] pl-3 pr-2">
              <span className="text-[14px] font-extrabold tracking-[.04em] text-white">{t.block}</span>
              <input data-plain="1" defaultValue={bl.wg} onBlur={(e) => { const v = (e.target.value || "").trim(); if (!v || v === bl.wg) return; mut((us) => gRenameWing(us, bl.wg, v)); }} className="w-[64px] rounded-[6px] border-none bg-white/[.16] px-2 py-1 text-center text-[14px] font-extrabold text-white outline-none" />
              <IconPencil size={14} style={{ color: "rgba(255,255,255,.55)" }} />
              <span className="ml-2 text-[11.5px] font-semibold text-[#c7d0e0]">{t.ed.num_from}</span>
              <input data-plain="1" type="number" min={1} key={`${bl.wg}-${obj?.numStart?.[bl.wg] ?? 1}`} defaultValue={obj?.numStart?.[bl.wg] ?? 1} title={t.ed.num_from_hint} onBlur={(e) => { const n = parseInt(e.target.value, 10); if (n && n !== (obj?.numStart?.[bl.wg] ?? 1)) setNumStart(bl.wg, n); }} onKeyDown={(e) => { if (e.key === "Enter") (e.target as HTMLInputElement).blur(); }} className="w-[64px] rounded-[6px] border-none bg-white/[.16] px-2 py-1 text-center text-[13px] font-bold text-white outline-none" />
            </div>
          )}
          {editOn && (
            <div className="mb-[10px] ml-[10px] inline-flex flex-wrap gap-[6px] align-middle">
              {alignBtn("left", bl.wg, IconArrowBarToLeft, t.ed.al_left)}{alignBtn("center", bl.wg, IconTriangle, t.ed.al_center)}{alignBtn("right", bl.wg, IconArrowBarToRight, t.ed.al_right)}
            </div>
          )}
          <div className="overflow-x-auto pb-[6px]">
            <div data-oplboard="1" style={{ minWidth: 900, display: "flex", flexDirection: "column", gap: 7, zoom: z }}>
              {bl.floors.map((fl) => renderFloor(fl, bl.wg))}
              {editOn && (
                <div className="mt-[2px] flex flex-wrap gap-2">
                  <div onClick={() => mut((us) => gAddFloorW(us, bl.wg, renumOpts))} className={`${addBtnCls} w-fit min-w-[220px] p-3`}><IconPlus size={15} /> {t.ed.add_floor}</div>
                  <div onClick={() => mut((us) => gAddFloorBelowW(us, bl.wg, renumOpts, (f) => fLbl(f, fScheme)))} title={t.ed.add_floor_below_hint} className={`${addBtnCls} w-fit p-3`}><IconPlus size={15} /> {t.ed.add_floor_below}</div>
                </div>
              )}
            </div>
          </div>
        </div>
      ))}
    </>
  );
}
