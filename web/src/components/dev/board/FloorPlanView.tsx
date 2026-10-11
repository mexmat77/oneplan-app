"use client";

// Просмотр поэтажного плана: картинка + SVG-оверлей с полигонами квартир (заливка цветом статуса),
// HTML-подписи в центроидах, подсветка «прожектором» + подсказка рядом с контуром при наведении, клик → карточка квартиры.
// Примитивы (`PlanCanvas`, `UnitPoly`, `UnitLabel`, `HoverCard`) переиспользует редактор обводки.
import { useState, type CSSProperties, type PointerEvent as RPointerEvent, type ReactNode, type RefObject } from "react";
import { isNumericNum, money, numLabel, typeLabel } from "@/lib/dev/data";
import { centroid, levelOf, polyPoints, type Pt } from "@/lib/dev/floorplan";
import type { Cur, FloorPlan, StatusColors, Unit } from "@/lib/dev/types";
import { useDevT } from "@/i18n/dev";

/** Картинка плана с наложенным SVG (`viewBox` = размеры картинки) и слоем HTML-оверлеев. */
export function PlanCanvas({ plan, canvasRef, svg, overlay, cursor, onClick, onPointerDown, onPointerMove, onPointerUp, onDoubleClick, onLeave, onImgError, onImgLoad, dead, deadText }: {
  plan: FloorPlan;
  canvasRef?: RefObject<HTMLDivElement | null>;
  svg?: ReactNode;
  overlay?: ReactNode;
  cursor?: string;
  onClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onPointerDown?: (e: RPointerEvent<HTMLDivElement>) => void;
  onPointerMove?: (e: RPointerEvent<HTMLDivElement>) => void;
  onPointerUp?: (e: RPointerEvent<HTMLDivElement>) => void;
  onDoubleClick?: (e: React.MouseEvent<HTMLDivElement>) => void;
  onLeave?: () => void;
  onImgError?: () => void;
  onImgLoad?: () => void;
  dead?: boolean;
  deadText?: string;
}) {
  const w = plan.w || 1000, h = plan.h || 700;
  return (
    <div ref={canvasRef} onClick={onClick} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onDoubleClick={onDoubleClick} onPointerLeave={onLeave} className="relative select-none" style={{ cursor, aspectRatio: `${w} / ${h}`, touchAction: "none" }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={plan.img} alt="" draggable={false} onError={onImgError} onLoad={onImgLoad} ref={(el) => { if (el && el.complete && el.naturalWidth === 0 && !dead) onImgError?.(); }} className="block h-full w-full rounded-[10px] object-contain" style={{ background: "#fff" }} />
      {dead && <div className="absolute inset-0 flex items-center justify-center rounded-[10px] border-2 border-dashed border-[#cdd5e2] bg-[#fbfcfe] p-6 text-center text-[13px] text-text-2">{deadText}</div>}
      <svg viewBox={`0 0 ${w} ${h}`} preserveAspectRatio="none" className="absolute inset-0 h-full w-full overflow-visible">{svg}</svg>
      {overlay}
    </div>
  );
}

/** Полигон квартиры: заливка цветом статуса (≈.45), обводка 2px (не масштабируется).
 * `hot` — квартира под курсором в просмотре: плотнее заливка + двойной контур (белый ореол 7px и тёмная линия 3px),
 * `mute` — остальные квартиры в этот момент приглушаются (эффект «прожектора», как в интерактивных планах застройщиков).
 * Фильтр ленты статусов: `off` — квартира не подходит: закрашивается светло-серой «вуалью» (как серые плитки шахматки),
 * `on` — подходит: плотная заливка цветом статуса и жирный контур. */
export function UnitPoly({ poly, w, h, color, active, dim, hot, mute, off, on, pointer, onClick, onEnter, onLeave }: {
  poly: Pt[]; w: number; h: number; color: string; active?: boolean; dim?: boolean; hot?: boolean; mute?: boolean; off?: boolean; on?: boolean; pointer?: boolean;
  onClick?: (e: React.MouseEvent<SVGPolygonElement>) => void; onEnter?: () => void; onLeave?: () => void;
}) {
  const pts = polyPoints(poly, w, h);
  return (
    <>
      {hot && <polygon points={pts} fill="none" stroke="#fff" strokeWidth={7} strokeLinejoin="round" vectorEffect="non-scaling-stroke" style={{ pointerEvents: "none", filter: "drop-shadow(0 2px 6px rgba(20,36,63,.45))" }} />}
      <polygon
        points={pts}
        fill={off && !hot ? "#eef1f6" : color}
        fillOpacity={hot ? 0.58 : off ? 0.82 : on ? 0.6 : mute ? 0.16 : dim ? 0.18 : active ? 0.62 : 0.45}
        stroke={hot || active ? "#14243f" : off ? "#c3cad6" : color}
        strokeOpacity={off ? 1 : mute ? 0.45 : 1}
        strokeWidth={hot ? 3 : on ? 3.5 : active ? 2.5 : off ? 1.5 : 2}
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        style={{ cursor: pointer ? "pointer" : undefined, transition: "fill-opacity .15s, stroke-opacity .15s" }}
        onClick={onClick}
        onPointerEnter={onEnter}
        onPointerLeave={onLeave}
      />
    </>
  );
}

/** Подпись в центроиде: «№ · тип · м²» (+ цена, если есть и не продано). */
export function UnitLabel({ poly, u, color, cur, small, floor, hot, mute, off }: { poly: Pt[]; u: Unit; color: string; cur: Cur; small?: boolean; floor?: number; hot?: boolean; mute?: boolean; off?: boolean }) {
  const { t } = useDevT();
  const lvl = floor === undefined ? null : levelOf(u, floor);
  const lvlText = lvl === "lower" ? t.fp.lvl_lower : lvl === "upper" ? t.fp.lvl_upper : lvl === "middle" ? t.fp.lvl_middle : "";
  const [cx, cy] = centroid(poly);
  const type = typeLabel(u.type, t);
  const showPrice = u.price > 0 && u.status !== "sold" && u.status !== "na";
  const st: CSSProperties = hot
    ? { left: `${cx * 100}%`, top: `${cy * 100}%`, transform: "translate(-50%,-50%) scale(1.08)", color: "#fff", background: "#14243f", boxShadow: "0 4px 14px rgba(20,36,63,.4)", zIndex: 2, transition: "transform .12s, opacity .15s" }
    : off
      ? { left: `${cx * 100}%`, top: `${cy * 100}%`, transform: "translate(-50%,-50%)", color: "#9aa1ac", background: "transparent", opacity: 0.9, transition: "transform .12s, opacity .15s" }
      : { left: `${cx * 100}%`, top: `${cy * 100}%`, transform: "translate(-50%,-50%)", color, background: "rgba(255,255,255,.94)", boxShadow: "0 1px 4px rgba(20,36,63,.18)", opacity: mute ? 0.55 : 1, transition: "transform .12s, opacity .15s" };
  return (
    <div className={`pointer-events-none absolute whitespace-nowrap rounded-[10px] px-[7px] py-[2px] text-center font-bold leading-[1.25] ${small ? "text-[9px]" : "text-[10.5px]"}`} style={st}>
      {/* длинный номер, набранный вручную («27 + Ayri Mutfak»), обрезается многоточием — полностью он виден в подсказке и карточке */}
      <div className="flex justify-center"><span className={`overflow-hidden text-ellipsis ${small ? "max-w-[48px]" : "max-w-[64px]"}`}>{numLabel(String(u.num).replace(/\*/g, ""))}</span><span>&nbsp;· {type} · {u.area} м²</span></div>
      {lvlText && <div className="text-[9px] font-semibold opacity-80">{lvlText}</div>}
      {showPrice && !(off && !hot) && <div className={`font-semibold ${hot ? "text-white" : "text-ink"}`}>{money(u.price, cur)}</div>}
    </div>
  );
}

/**
 * Подсказка при наведении (прототип `fpCard`, 802–811 — там карточка в углу с кнопкой). Принятое отклонение (30.09.2026):
 * подсказка стоит вплотную к контуру квартиры (справа/слева от него, по центру по вертикали), чтобы взгляд не уходил в угол;
 * она чисто информационная (`pointer-events: none`, без кнопки) — карточку открывает клик по самой квартире, о чём говорит строка внизу.
 * Выдуманной «старой цены» (×1.12 в прототипе) нет — только реальная цена.
 */
export function HoverCard({ u, colors, cur, poly, floor }: { u: Unit; colors: StatusColors; cur: Cur; poly: Pt[]; floor?: number }) {
  const { t } = useDevT();
  const col = colors[u.status];
  let x0 = 1, x1 = 0, y0 = 1, y1 = 0;
  poly.forEach(([x, y]) => { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; });
  const cy = (y0 + y1) / 2;
  const roomR = 1 - x1, roomL = x0;
  // сбоку от контура — с той стороны, где больше места; если квартира во всю ширину плана — внутри у её верхнего края
  const pos: CSSProperties = Math.max(roomR, roomL) < 0.2
    ? { left: `${((x0 + x1) / 2) * 100}%`, top: `calc(${y0 * 100}% + 10px)`, transform: "translateX(-50%)" }
    : roomR >= roomL
      // `min(…, 100% - 220px)` — подсказка (240px) не вылезает за край плана, даже если места сбоку меньше её ширины
      ? { left: `min(calc(${x1 * 100}% + 12px), calc(100% - 248px))`, top: `clamp(8px, calc(${cy * 100}% - 70px), calc(100% - 150px))` }
      : { right: `min(calc(${(1 - x0) * 100}% + 12px), calc(100% - 248px))`, top: `clamp(8px, calc(${cy * 100}% - 70px), calc(100% - 150px))` };
  const lvl = floor === undefined ? null : levelOf(u, floor);
  const lvlText = lvl === "lower" ? t.fp.lvl_lower : lvl === "upper" ? t.fp.lvl_upper : lvl === "middle" ? t.fp.lvl_middle : "";
  const showPrice = u.price > 0 && u.status !== "sold" && u.status !== "na";
  return (
    <div className="pointer-events-none absolute z-[4] w-[240px] rounded-[12px] border border-line bg-surface px-[14px] py-3 shadow-[0_12px_34px_rgba(20,36,63,.22)] max-md:hidden" style={{ ...pos, animation: "opl-bg .12s ease" }}>
      <div className="flex flex-wrap items-center justify-between gap-x-2 gap-y-1">
        <span className="min-w-0 text-[16px] font-extrabold leading-[1.2] text-ink [overflow-wrap:anywhere]">{isNumericNum(u.num) ? t.apt : ""}{String(u.num).replace(/\*/g, "")}</span>
        <span className="inline-flex flex-none items-center gap-[5px] rounded-[7px] px-[7px] py-[2px] text-[11px] font-bold" style={{ color: col, background: `${col}1f` }}><span className="h-[7px] w-[7px] rounded-full" style={{ background: col }} />{t.status[u.status]}</span>
      </div>
      <div className="mt-[2px] text-[12.5px] text-text-2">{typeLabel(u.type, t, "—")} · {u.area} м² · {t.word_floor} {u.floor}{lvlText ? ` · ${lvlText}` : ""}</div>
      {showPrice && <div className="mt-[8px] whitespace-nowrap text-[19px] font-extrabold text-ink">{money(u.price, cur)}</div>}
      {showPrice && u.area > 0 && <div className="text-[11.5px] text-text-2">{money(Math.round(u.price / u.area), cur)}/м²</div>}
      <div className="mt-[9px] border-t border-dashed border-line pt-[7px] text-[11.5px] font-semibold text-blue">{t.fp.click_hint}</div>
    </div>
  );
}

/** Просмотр (только чтение): кабинет в режиме просмотра и публичная страница. */
export function FloorPlanView({ plan, units, colors, cur, onOpenUnit, onDead, readOnly, floor, filterSt }: { floor?: number; filterSt?: "" | Unit["status"];
  plan: FloorPlan; units: Unit[]; colors: StatusColors; cur: Cur; onOpenUnit: (uid: number) => void; onDead?: () => void; readOnly?: boolean;
}) {
  const { t } = useDevT();
  const [hover, setHover] = useState<number | null>(null);
  const [dead, setDead] = useState(false);
  const w = plan.w || 1000, h = plan.h || 700;
  const byUid = new Map(units.map((u) => [u.uid, u]));
  const areas = plan.areas.filter((a) => byUid.has(a.uid));
  const hu = hover != null ? byUid.get(hover) : undefined;
  // При включённом фильтре статуса наведение не сбрасывает его картину: подходящие остаются яркими, неподходящие — под «вуалью»;
  // квартира под курсором (любая, в т.ч. неподходящая) получает ореол и подсказку — фильтр подсвечивает, а не блокирует.
  // порядок отрисовки: «вуаль» → подходящие под фильтр → квартира под курсором (её контур всегда сверху)
  const rank = (uid: number) => (uid === hover ? 2 : filterSt && byUid.get(uid)?.status === filterSt ? 1 : 0);
  const hoverArea = hover != null ? areas.find((a) => a.uid === hover) : undefined;
  return (
    <PlanCanvas
      plan={plan}
      dead={dead}
      deadText={readOnly ? t.fp.img_dead_pub : t.fp.img_dead}
      onImgError={() => { setDead(true); onDead?.(); }}
      onImgLoad={() => setDead(false)}
      onLeave={() => setHover(null)}
      // квартира под курсором рисуется последней — её контур не перекрывается соседями
      svg={[...areas].sort((a, b) => rank(a.uid) - rank(b.uid)).map((a) => {
        const u = byUid.get(a.uid)!;
        return <UnitPoly key={a.uid} poly={a.poly} w={w} h={h} color={colors[u.status] || "#9aa1ac"} hot={hover === a.uid} mute={!filterSt && hover != null && hover !== a.uid} off={!!filterSt && u.status !== filterSt} on={!!filterSt && u.status === filterSt} pointer onClick={() => onOpenUnit(a.uid)} onEnter={() => setHover(a.uid)} onLeave={() => setHover((c) => (c === a.uid ? null : c))} />;
      })}
      overlay={
        <>
          {areas.map((a) => { const u = byUid.get(a.uid)!; return <UnitLabel floor={floor} key={a.uid} poly={a.poly} u={u} color={colors[u.status] || "#9aa1ac"} cur={cur} small={areas.length > 24} hot={hover === a.uid} mute={!filterSt && hover != null && hover !== a.uid} off={!!filterSt && u.status !== filterSt} />; })}
          {hu && hoverArea && <HoverCard u={hu} colors={colors} cur={cur} poly={hoverArea.poly} floor={floor} />}
        </>
      }
    />
  );
}
