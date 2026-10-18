"use client";

import { kbAutoFocus } from "@/lib/touch";
// Режим обводки поэтажного плана: клик ставит точки контура; Enter / двойной клик / клик по первой точке замыкает;
// Esc отменяет; Backspace убирает последнюю точку. После замыкания — выбор квартиры (поиск по номеру) либо
// автопривязка к `traceUid` (кнопка «Обвести» в списке неотмеченных). Клик по контуру выбирает его: вершины
// перетаскиваются, «+» на середине ребра вставляет вершину (и сразу тянет её), контур можно удалить (кнопка / Delete).
// «Автовыравнивание» (localStorage `opl-fp-autotidy`): точки прилипают к стенам чертежа (карта стен — `lib/dev/planEdges`),
// после замыкания контур проходит цепочку mergeClose → simplify → orthoSnap → snapToEdges → orthoSnap; Shift при клике —
// без прилипания. У выбранного контура: «Выровнять», «Сгладить» (Чайкин ×2 + лёгкое прилипание), «Отменить» (1 шаг).
// Координаты нормализованы 0..1 от getBoundingClientRect.
// Каждое изменение контура ставит отложенную (1.5 с) вырезку квартиры с плана в её тип планировки (`lib/dev/planCrop`);
// удаление контура снимает картинку «с плана». Пока режется — спиннер у подписи контура.
import { IconArrowBackUp, IconCheck, IconLoader2, IconPencil, IconSearch, IconTrash, IconVectorSpline, IconWand, IconX } from "@tabler/icons-react";
import { useEffect, useRef, useState, useSyncExternalStore, type PointerEvent as RPointerEvent } from "react";
import { showToast } from "@/components/ui/toast";
import { useDevT } from "@/i18n/dev";
import { numLabel, typeLabel } from "@/lib/dev/data";
import { centroid, chaikin, normPt, polyPoints, type Pt } from "@/lib/dev/floorplan";
import { dropUnitCrop, scheduleUnitCrop, useCropBusy } from "@/lib/dev/planCrop";
import { loadEdgeMap, snapPointToEdges, snapToEdges, tidyPoly, type EdgeMap } from "@/lib/dev/planEdges";
import type { Cur, FloorPlan, StatusColors, Unit } from "@/lib/dev/types";
import { setPlanAreas } from "@/store/dev";
import { PlanCanvas, UnitLabel, UnitPoly } from "./FloorPlanView";

const CLOSE_PX = 14; // радиус «клика по первой точке», px экрана
type Drag = { uid: number; idx: number; poly: Pt[] };
type Undo = { uid: number; poly: Pt[] };

// ───── тумблер «Автовыравнивание» — localStorage `opl-fp-autotidy` через useSyncExternalStore (SSR → включён) ─────
const AT_KEY = "opl-fp-autotidy";
const atListeners = new Set<() => void>();
const readAutotidy = () => { try { return localStorage.getItem(AT_KEY) !== "0"; } catch { return true; } };
const writeAutotidy = (v: boolean) => { try { localStorage.setItem(AT_KEY, v ? "1" : "0"); } catch { /* приватный режим */ } atListeners.forEach((l) => l()); };
const subAutotidy = (l: () => void) => { atListeners.add(l); return () => { atListeners.delete(l); }; };
const useAutotidy = () => useSyncExternalStore(subAutotidy, readAutotidy, () => true);

export function FloorPlanEditor({ objId, planKey, plan, units, colors, cur, traceUid, onTraceDone , floor, zoom = 1 }: { floor?: number;
  objId: number; planKey: string; plan: FloorPlan; units: Unit[]; colors: StatusColors; cur: Cur;
  traceUid: number | null; onTraceDone: () => void;
  /** масштаб плана (контейнер шире окна в zoom раз): панель инструментов прилипает к видимой области */
  zoom?: number;
}) {
  const { t } = useDevT();
  const ref = useRef<HTMLDivElement | null>(null);
  const [draft, setDraft] = useState<Pt[]>([]);
  const [mouse, setMouse] = useState<Pt | null>(null);
  const [pick, setPick] = useState<Pt[] | null>(null);
  const [q, setQ] = useState("");
  const [selected, setSelected] = useState<number | null>(null);
  const [drag, setDrag] = useState<Drag | null>(null);
  const [dead, setDead] = useState(false);
  const [undo, setUndo] = useState<Undo | null>(null);
  const autotidy = useAutotidy();
  const cropBusy = useCropBusy();
  const w = plan.w || 1000, h = plan.h || 700;
  const aspect = w / h;
  const byUid = new Map(units.map((u) => [u.uid, u]));
  const areas = plan.areas.filter((a) => byUid.has(a.uid));
  const traceUnit = traceUid != null ? byUid.get(traceUid) : undefined;
  const drawing = draft.length > 0;

  // карта стен чертежа: строится асинхронно по URL картинки; читается только в обработчиках → ref
  const mapRef = useRef<{ src: string; map: EdgeMap | null; ready: boolean }>({ src: "", map: null, ready: false });
  const noMapToasted = useRef(false);
  useEffect(() => {
    let alive = true;
    mapRef.current = { src: plan.img, map: null, ready: false };
    loadEdgeMap(plan.img).then((map) => { if (alive && mapRef.current.src === plan.img) mapRef.current = { src: plan.img, map, ready: true }; });
    return () => { alive = false; };
  }, [plan.img]);
  /** Карта стен или null; при первом отсутствии карты (после загрузки) — тост один раз. */
  const edgeMap = (): EdgeMap | null => {
    const m = mapRef.current;
    if (m.ready && !m.map && !noMapToasted.current) { noMapToasted.current = true; showToast(t.fp.tidy_nomap, 4000); }
    return m.map;
  };

  const toNorm = (e: { clientX: number; clientY: number }): Pt | null => {
    const el = ref.current; if (!el) return null;
    const r = el.getBoundingClientRect(); if (!r.width || !r.height) return null;
    return normPt([(e.clientX - r.left) / r.width, (e.clientY - r.top) / r.height]);
  };
  const pxDist = (a: Pt, b: Pt) => {
    const r = ref.current?.getBoundingClientRect(); if (!r) return Infinity;
    return Math.hypot((a[0] - b[0]) * r.width, (a[1] - b[1]) * r.height);
  };
  /** Отложенная вырезка квартиры с плана в её тип планировки (после любого изменения контура). */
  const cropLater = (uid: number) => scheduleUnitCrop(objId, planKey, uid, (e) => showToast(`${t.fp.crop_err}${e.message ? ": " + e.message : ""}`, 4000));
  const assign = (uid: number, poly: Pt[]) => {
    setPlanAreas(objId, planKey, (list) => [...list.filter((a) => a.uid !== uid), { uid, poly }]);
    setSelected(uid); setUndo(null);
    cropLater(uid);
    showToast(t.fp.saved);
  };
  const closeDraft = (pts: Pt[]) => {
    const clean: Pt[] = [];
    pts.forEach((p) => { if (!clean.length || pxDist(clean[clean.length - 1], p) > 3) clean.push(p); });
    if (clean.length > 1 && pxDist(clean[0], clean[clean.length - 1]) <= 3) clean.pop();
    if (clean.length < 3) return;
    const poly = autotidy ? tidyPoly(clean, aspect, edgeMap()) : clean;
    setDraft([]); setMouse(null);
    if (traceUnit) { assign(traceUnit.uid, poly); onTraceDone(); }
    else { setPick(poly); setQ(""); }
  };
  const removeArea = (uid: number) => { setPlanAreas(objId, planKey, (list) => list.filter((a) => a.uid !== uid)); dropUnitCrop(objId, uid, planKey); setSelected(null); setUndo(null); };
  const select = (uid: number | null) => { setSelected(uid); if (uid == null || undo?.uid !== uid) setUndo(null); };

  /** Заменить контур выбранной квартиры с сохранением одного шага отмены. */
  const replacePoly = (uid: number, from: Pt[], to: Pt[]) => {
    setUndo({ uid, poly: from });
    setPlanAreas(objId, planKey, (list) => list.map((a) => (a.uid === uid ? { ...a, poly: to } : a)));
    cropLater(uid);
  };
  const doTidy = (uid: number, poly: Pt[]) => replacePoly(uid, poly, tidyPoly(poly, aspect, edgeMap()));
  const doSmooth = (uid: number, poly: Pt[]) => {
    const map = edgeMap();
    const sm = chaikin(poly, 2);
    replacePoly(uid, poly, (map ? snapToEdges(sm, map, 0.004) : sm).map(normPt));
  };
  const doUndo = () => {
    if (!undo) return;
    setPlanAreas(objId, planKey, (list) => list.map((a) => (a.uid === undo.uid ? { ...a, poly: undo.poly } : a)));
    cropLater(undo.uid);
    setUndo(null);
  };

  // клавиатура: Enter — замкнуть, Esc — отменить/снять выделение, Backspace — убрать точку, Delete — удалить выбранный контур
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tg = e.target as HTMLElement | null;
      if (tg && (tg.tagName === "INPUT" || tg.tagName === "TEXTAREA" || tg.isContentEditable)) { if (e.key === "Escape" && pick) setPick(null); return; }
      if (e.key === "Escape") { e.preventDefault(); if (pick) setPick(null); else if (draft.length) { setDraft([]); setMouse(null); } else select(null); }
      else if (e.key === "Enter" && draft.length >= 3) { e.preventDefault(); closeDraft(draft); }
      else if (e.key === "Backspace" && draft.length) { e.preventDefault(); setDraft(draft.slice(0, -1)); }
      else if (e.key === "Delete" && selected != null && !draft.length && !pick) { e.preventDefault(); removeArea(selected); }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "z" && undo && !draft.length && !pick) { e.preventDefault(); doUndo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // closeDraft/removeArea — замыкания текущего рендера; переподписываемся при смене состояния
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, pick, selected, traceUid, undo, autotidy]);

  const dragged = useRef(false);
  const onClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (dragged.current) { dragged.current = false; return; }
    if (pick || drag || dead) return;
    let p = toNorm(e); if (!p) return;
    if (draft.length >= 3 && pxDist(draft[0], p) <= CLOSE_PX) { closeDraft(draft); return; }
    if (autotidy && !e.shiftKey) { const map = edgeMap(); if (map) p = snapPointToEdges(p, map); }
    select(null);
    setDraft((d) => [...d, p]);
  };
  const onDouble = (e: React.MouseEvent<HTMLDivElement>) => { e.preventDefault(); if (draft.length >= 3) closeDraft(draft); };
  const onMove = (e: RPointerEvent<HTMLDivElement>) => {
    const p = toNorm(e); if (!p) return;
    if (drag) { setDrag({ ...drag, poly: drag.poly.map((pt, i) => (i === drag.idx ? p : pt)) }); return; }
    if (drawing) setMouse(p);
  };
  const endDrag = () => {
    if (!drag) return;
    dragged.current = true;
    setPlanAreas(objId, planKey, (list) => list.map((a) => (a.uid === drag.uid ? { ...a, poly: drag.poly } : a)));
    cropLater(drag.uid);
    setDrag(null);
  };
  const startDrag = (uid: number, idx: number, poly: Pt[]) => (e: RPointerEvent<HTMLDivElement>) => { e.stopPropagation(); e.preventDefault(); setDrag({ uid, idx, poly }); };
  /** «+» на середине ребра i: вставить вершину после i и сразу начать её тянуть (чтобы выгнуть сторону). */
  const insertAt = (uid: number, i: number, poly: Pt[]) => (e: RPointerEvent<HTMLDivElement>) => {
    e.stopPropagation(); e.preventDefault();
    const a = poly[i], b = poly[(i + 1) % poly.length];
    const m = normPt([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]);
    const next = [...poly.slice(0, i + 1), m, ...poly.slice(i + 1)];
    replacePoly(uid, poly, next);
    setDrag({ uid, idx: i + 1, poly: next });
  };

  const selArea = selected != null ? areas.find((a) => a.uid === selected) : undefined;
  const selPoly = drag && selArea && drag.uid === selArea.uid ? drag.poly : selArea?.poly;
  const qn = q.trim().toLowerCase().replace(/\*/g, "");
  const pickList = units.filter((u) => !qn || String(u.num).toLowerCase().replace(/\*/g, "").includes(qn));
  const mapped = new Set(areas.map((a) => a.uid));
  const cursor = pick ? "default" : drag ? "grabbing" : "crosshair";
  const previewPts = mouse && drawing ? [...draft, mouse] : draft;
  const showSel = !!selArea && !drawing && !pick;
  const canUndo = !!undo && !!selArea && undo.uid === selArea.uid;
  const toolBtn = "inline-flex cursor-pointer items-center gap-1 rounded-[7px] border border-line bg-surface px-2 py-1 text-[12px] font-semibold text-ink hover:border-blue hover:text-blue disabled:cursor-default disabled:opacity-40 disabled:hover:border-line disabled:hover:text-ink";

  return (
    <div className="relative">
      {/* панель липкая: при масштабе 150–400 % план прокручивается, а кнопки контура остаются на экране (правило пользователя 09.10.2026) */}
      <div className="sticky left-0 top-0 z-10 mb-2 flex flex-wrap items-center gap-2 bg-[#fbfcfe] pb-1" style={zoom > 1 ? { width: `${100 / zoom}%` } : undefined}>
        {showSel && selArea && (
          <div className="inline-flex flex-wrap items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink ">
            <span>{t.apt}{String(byUid.get(selArea.uid)?.num ?? "").replace(/\*/g, "")}</span>
            <button type="button" onClick={() => doTidy(selArea.uid, selArea.poly)} className={toolBtn} title={t.fp.tidy}><IconWand size={13} /> {t.fp.tidy}</button>
            <button type="button" onClick={() => doSmooth(selArea.uid, selArea.poly)} className={toolBtn} title={t.fp.smooth}><IconVectorSpline size={13} /> {t.fp.smooth}</button>
            <button type="button" onClick={doUndo} disabled={!canUndo} className={toolBtn} title={`${t.fp.undo} · ⌘Z`}><IconArrowBackUp size={13} /> {t.fp.undo}</button>
            <button type="button" onClick={() => removeArea(selArea.uid)} className="inline-flex cursor-pointer items-center gap-1 rounded-[7px] border border-[#f3c1c1] bg-[#fff2f2] px-2 py-1 text-[12px] font-semibold text-red"><IconTrash size={13} /> {t.fp.del_poly}</button>
            <button type="button" onClick={() => select(null)} className="inline-flex cursor-pointer items-center rounded-[7px] border border-line bg-surface p-1 text-text-2"><IconX size={13} /></button>
          </div>
        )}
        {traceUnit && !pick && (
          <div className="inline-flex items-center gap-2 rounded-[10px] border border-blue bg-blue-tint px-3 py-2 text-[12px] font-semibold text-blue ">
            <IconPencil size={13} /> {t.fp.trace_btn}: {t.apt}{String(traceUnit.num).replace(/\*/g, "")}
            <button type="button" onClick={() => { setDraft([]); setMouse(null); onTraceDone(); }} className="inline-flex cursor-pointer items-center rounded-[7px] border border-blue/40 bg-surface p-1 text-blue"><IconX size={13} /></button>
          </div>
        )}
        <label className="ml-auto inline-flex cursor-pointer select-none items-center gap-2 rounded-[10px] border border-line bg-surface px-3 py-2 text-[12px] font-semibold text-ink" title={t.fp.autotidy_hint}>
          <span className="relative inline-block h-[16px] w-[28px] flex-none rounded-full transition-colors" style={{ background: autotidy ? "#2f5fe0" : "#cdd5e2" }}>
            <span className="absolute top-[2px] h-[12px] w-[12px] rounded-full bg-white shadow-[0_1px_2px_rgba(20,36,63,.3)] transition-[left]" style={{ left: autotidy ? 14 : 2 }} />
          </span>
          <input type="checkbox" className="sr-only" checked={autotidy} onChange={(e) => writeAutotidy(e.target.checked)} />
          {t.fp.autotidy}
        </label>
      </div>
      <PlanCanvas
        plan={plan}
        canvasRef={ref}
        cursor={cursor}
        dead={dead}
        deadText={t.fp.img_dead}
        onImgError={() => setDead(true)}
        onImgLoad={() => setDead(false)}
        onClick={onClick}
        onPointerMove={onMove}
        onPointerUp={endDrag}
        onLeave={() => { endDrag(); setMouse(null); }}
        onDoubleClick={onDouble}
        svg={
          <>
            <g style={{ pointerEvents: drawing || pick ? "none" : undefined }}>
              {areas.map((a) => {
                const u = byUid.get(a.uid)!;
                const poly = drag && drag.uid === a.uid ? drag.poly : a.poly;
                return <UnitPoly key={a.uid} poly={poly} w={w} h={h} color={colors[u.status] || "#9aa1ac"} active={selected === a.uid} dim={!!pick} pointer onClick={(e) => { e.stopPropagation(); select(a.uid); }} />;
              })}
            </g>
            {pick && <polygon points={polyPoints(pick, w, h)} fill="#4d7cfe" fillOpacity={0.35} stroke="#2f5fe0" strokeWidth={2.5} strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ pointerEvents: "none" }} />}
            {drawing && (
              <g style={{ pointerEvents: "none" }}>
                <polyline points={polyPoints(previewPts, w, h)} fill="#4d7cfe" fillOpacity={previewPts.length >= 3 ? 0.18 : 0} stroke="#2f5fe0" strokeWidth={2} strokeDasharray="6 4" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
                {draft.length >= 3 && mouse && <line x1={mouse[0] * w} y1={mouse[1] * h} x2={draft[0][0] * w} y2={draft[0][1] * h} stroke="#2f5fe0" strokeOpacity={0.35} strokeWidth={1.5} strokeDasharray="3 4" vectorEffect="non-scaling-stroke" />}
              </g>
            )}
          </>
        }
        overlay={
          <>
            {areas.map((a) => { const u = byUid.get(a.uid)!; const poly = drag && drag.uid === a.uid ? drag.poly : a.poly; return <UnitLabel floor={floor} key={a.uid} poly={poly} u={u} color={colors[u.status] || "#9aa1ac"} cur={cur} small={areas.length > 24} />; })}
            {areas.filter((a) => cropBusy.includes(a.uid)).map((a) => {
              const [cx, cy] = centroid(drag && drag.uid === a.uid ? drag.poly : a.poly);
              return <div key={`c${a.uid}`} title={t.fp.crop_busy} className="pointer-events-none absolute z-[2] flex h-[18px] w-[18px] items-center justify-center rounded-full border border-line bg-white text-blue shadow-[0_1px_4px_rgba(20,36,63,.25)]" style={{ left: `${cx * 100}%`, top: `${cy * 100}%`, transform: "translate(-50%,-50%) translate(0,-22px)" }}><IconLoader2 size={12} className="animate-spin" /></div>;
            })}
            {draft.map((p, i) => (
              <div key={i} className="pointer-events-none absolute h-[12px] w-[12px] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-[0_1px_4px_rgba(20,36,63,.35)]" style={{ left: `${p[0] * 100}%`, top: `${p[1] * 100}%`, background: i === 0 ? "#1b2942" : "#2f5fe0", zIndex: 2, transform: i === 0 && draft.length >= 3 ? "translate(-50%,-50%) scale(1.35)" : undefined }} />
            ))}
            {showSel && selArea && selPoly && !drag && selPoly.map((p, i) => {
              const b = selPoly[(i + 1) % selPoly.length];
              if (Math.hypot((p[0] - b[0]) * aspect, p[1] - b[1]) < 0.03) return null; // короткое ребро — маркер «+» не влезает
              return (
                <div key={`m${i}`} onPointerDown={insertAt(selArea.uid, i, selPoly)} onClick={(e) => e.stopPropagation()} title="+" className="absolute flex h-[12px] w-[12px] -translate-x-1/2 -translate-y-1/2 cursor-copy items-center justify-center rounded-full border border-[#1b2942] bg-white/90 text-[11px] font-bold leading-none text-[#1b2942] opacity-70 hover:opacity-100 hover:scale-125" style={{ left: `${((p[0] + b[0]) / 2) * 100}%`, top: `${((p[1] + b[1]) / 2) * 100}%`, zIndex: 3 }}>+</div>
              );
            })}
            {showSel && selArea && selPoly && selPoly.map((p, i) => (
              <div key={i} onPointerDown={startDrag(selArea.uid, i, selPoly)} onClick={(e) => e.stopPropagation()} className="absolute h-[14px] w-[14px] -translate-x-1/2 -translate-y-1/2 cursor-grab rounded-full border-2 border-[#1b2942] bg-white shadow-[0_1px_4px_rgba(20,36,63,.35)] active:cursor-grabbing" style={{ left: `${p[0] * 100}%`, top: `${p[1] * 100}%`, zIndex: 3 }} />
            ))}
            {pick && (
              <div onClick={(e) => e.stopPropagation()} onDoubleClick={(e) => e.stopPropagation()} className="absolute right-3 top-3 z-[4] w-[240px] rounded-[12px] border border-line bg-surface p-3 shadow-[0_10px_30px_rgba(20,36,63,.16)]">
                <div className="mb-2 text-[14px] font-extrabold text-ink">{t.fp.pick_title}</div>
                <div className="relative mb-2">
                  <IconSearch size={14} className="absolute left-[9px] top-1/2 -translate-y-1/2 text-muted" />
                  <input autoFocus={kbAutoFocus()} value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.fp.pick_search} onKeyDown={(e) => { if (e.key === "Enter" && pickList.length === 1) { assign(pickList[0].uid, pick); setPick(null); } }} className="w-full rounded-[9px] border border-line bg-surface py-[7px] pl-[28px] pr-2 text-[13px] outline-none focus:border-blue" />
                </div>
                <div className="flex max-h-[220px] flex-col gap-[3px] overflow-auto">
                  {!pickList.length && <div className="p-2 text-center text-[12px] text-muted">{t.fp.pick_none}</div>}
                  {pickList.map((u) => (
                    <button key={u.uid} type="button" onClick={() => { assign(u.uid, pick); setPick(null); }} className="flex cursor-pointer items-center justify-between gap-2 rounded-[8px] border border-line bg-surface px-[10px] py-[6px] text-left text-[12.5px] hover:border-blue hover:bg-blue-tint">
                      <span className="font-bold text-ink">{numLabel(String(u.num).replace(/\*/g, ""))} <span className="font-medium text-text-2">· {typeLabel(u.type, t)} · {u.area} м²</span></span>
                      {mapped.has(u.uid) ? <span className="whitespace-nowrap text-[10.5px] font-semibold text-muted">{t.fp.pick_mapped}</span> : <span className="h-[8px] w-[8px] flex-none rounded-[2px]" style={{ background: colors[u.status] }} />}
                    </button>
                  ))}
                </div>
                <button type="button" onClick={() => setPick(null)} className="mt-2 flex w-full cursor-pointer items-center justify-center gap-1 rounded-[8px] border border-line bg-surface py-[7px] text-[12px] font-semibold text-text-2"><IconX size={13} /> {t.fp.cancel}</button>
              </div>
            )}
            {drawing && draft.length >= 3 && (
              <button type="button" onClick={(e) => { e.stopPropagation(); closeDraft(draft); }} className="absolute bottom-3 right-3 z-[3] inline-flex cursor-pointer items-center gap-1 rounded-[9px] border border-ink bg-ink px-3 py-[7px] text-[12px] font-semibold text-white shadow-[0_6px_18px_rgba(20,36,63,.2)]"><IconCheck size={14} /> {t.fp.trace_done} · Enter</button>
            )}
          </>
        }
      />
    </div>
  );
}
