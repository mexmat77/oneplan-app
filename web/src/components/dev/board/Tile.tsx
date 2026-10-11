"use client";

// Плитка шахматки — порт `cellV` (3470–3518) + надстройки `mkCells` (3612–3634): ширина `w`, растяжка дуплексов/триплексов
// (`expand`), «близнец» (`twin`), бейджи, крестик удаления, ручка ресайза, состояние выделения.
import { IconDoorEnter, IconX } from "@tabler/icons-react";
import type { CSSProperties, DragEvent, MouseEvent, PointerEvent } from "react";
import { fLbl, isSpecialType, numLabel, typeLabel as typeLabelOf } from "@/lib/dev/data";
import { CELL_GAP, CELL_H, widthPx, type ExpandInfo } from "@/lib/dev/grid";
import type { FScheme, StatusColors, Unit } from "@/lib/dev/types";
import type { DevDict } from "@/i18n/dev";
import { TAG_META, textOn } from "./shared";

export type TileProps = {
  u: Unit;
  sw: number;                 // ширина в клетках после `applyW`
  ok: boolean;                // прошла фильтр (иначе opacity .26)
  sold?: boolean;
  colors: StatusColors;
  editOn: boolean;
  compact: boolean;           // >120 юнитов — padding 7/9
  selected: boolean;
  twin?: boolean;
  expand?: ExpandInfo;
  fScheme: FScheme;
  priceLabel: string;         // компактно («18,7 млн ₺»), полная сумма — `priceFull` в title
  priceFull?: string;
  perM2: string;
  showPerM2: boolean;
  t: DevDict;
  widthCap: string;
  onOpen: (e: MouseEvent<HTMLDivElement>) => void;
  onDragStart: (e: DragEvent<HTMLDivElement>) => void;
  onDelQuick?: (e: MouseEvent) => void;
  onResizeStart?: (e: PointerEvent<HTMLSpanElement>) => void;
};

const bgSt = (cl: string): CSSProperties => ({ alignSelf: "flex-start", marginBottom: 2, fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 20, background: "rgba(255,255,255,.92)", color: cl });

export function Tile(p: TileProps) {
  const { u, sw, ok, colors, editOn, compact, selected, twin, expand, t } = p;
  // «Продано» и «Не продаётся» рисуются одинаково: центрированная колонка «№ · тип · м²» + подпись статуса, без цены.
  const sold = u.status === "sold" || u.status === "na";
  const bg = colors[u.status] || "#9aa1ac";
  const tx = textOn(u.status);
  const tm = u.tag && u.tag !== "terrace" ? TAG_META[u.tag] : null;
  const fts = (u.ft || []).concat(u.tag === "terrace" ? ["terrace"] : []);
  let badges: { label: string; style: CSSProperties; icon?: boolean }[] = (tm ? [{ label: t[tm[0] as "badge_duplex"], style: bgSt(tm[1]) }] : []).concat(
    fts.map((kk) => ({ label: kk === "terrace" ? t.badge_terrace : t.badge_garden, style: bgSt(kk === "terrace" ? "#0284c7" : "#15803d") })),
  );
  const hb = CELL_H;
  const wpx = widthPx(sw);
  const style: CSSProperties = {
    background: bg, opacity: ok ? 1 : 0.26, borderRadius: 11, color: tx, cursor: "pointer", minHeight: hb, alignSelf: "stretch",
    flex: "none", width: wpx, minWidth: wpx, maxWidth: wpx,
    position: editOn || expand || twin ? "relative" : undefined,
  };
  if (selected) { style.outline = "3px solid #4d7cfe"; style.outlineOffset = 2; }
  // Sold tiles keep the same inner padding (badges sit inside it), content is centred.
  if (sold) Object.assign(style, { padding: compact ? (editOn ? "7px 26px 7px 9px" : "7px 9px") : (editOn ? "10px 26px 10px 12px" : "10px 12px"), display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 3, fontWeight: 700 });
  // One full `padding` string: a shorthand plus `paddingRight: undefined` made React drop the right padding when leaving edit mode.
  else Object.assign(style, { padding: compact ? (editOn ? "7px 26px 7px 9px" : "7px 9px") : (editOn ? "10px 26px 10px 12px" : "10px 12px"), display: "flex", flexDirection: "column", gap: 4, justifyContent: "space-between" });
  const priceStyle: CSSProperties = { fontWeight: 800, fontSize: 17 };
  const splits: CSSProperties[] = [];
  if (expand) {
    const r = 1 + expand.a + expand.b;
    Object.assign(style, { height: hb * r + CELL_GAP * (r - 1), marginTop: expand.a ? -(expand.a * (hb + CELL_GAP)) : undefined, marginBottom: expand.b ? -(expand.b * (hb + CELL_GAP)) : undefined, position: "relative", zIndex: 2, justifyContent: "flex-start" });
    priceStyle.marginTop = "auto";
    expand.lines.forEach((rk) => splits.push({ position: "absolute", left: 10, right: 10, top: Math.round(rk * (hb + CELL_GAP) - 4), height: 2, borderRadius: 1, background: "rgba(255,255,255,.55)" }));
    if (u.tag === "triplex") (u.entry && u.entry.length ? u.entry : []).forEach((lv) => badges.push({ label: `${t.badge_entry} · ${fLbl(expand.bf + lv, p.fScheme)}`, style: { alignSelf: "flex-start", marginBottom: 2, fontSize: 9.5, fontWeight: 800, padding: "2px 8px", borderRadius: 20, background: "#0f766e", color: "#fff" }, icon: true }));
  }
  if (twin) {
    Object.assign(style, { outline: "2px dashed rgba(255,255,255,.8)", outlineOffset: -5, height: hb, maxHeight: hb, overflow: "hidden" });
    badges = [{ label: "⧉ " + (badges[0]?.label || ""), style: { alignSelf: "flex-start", marginBottom: 2, fontSize: 9, fontWeight: 800, padding: "2px 7px", borderRadius: 20, background: "rgba(15,23,42,.35)", color: "#fff", whiteSpace: "nowrap", maxWidth: "100%", overflow: "hidden", textOverflow: "ellipsis" } }];
  }
  const canDel = editOn && !twin;
  const hasResize = editOn && !twin && !!p.onResizeStart;
  // Спец-тип (соц. зона / паркинг / техническое) — только подпись типа, без «— м²»; пустой тип и площадь 0 — строку не показываем.
  const special = isSpecialType(u.type);
  const blank = !u.type && !u.area;
  const typeLabel = typeLabelOf(u.type, t, blank ? "" : "—");
  const area = u.area || "—";
  const infoLine = special ? typeLabel : blank ? null : `${typeLabel} · ${area} м²`;
  const showArea = !special && !blank;
  const common = (
    <>
      {hasResize && (
        <span onPointerDown={p.onResizeStart} title={p.widthCap} style={{ position: "absolute", top: 0, right: 0, width: 12, height: "100%", cursor: "ew-resize", zIndex: 6, display: "flex", alignItems: "center", justifyContent: "center", touchAction: "none" }}>
          <span style={{ width: 3, height: 20, borderRadius: 2, background: "rgba(255,255,255,.75)" }} />
        </span>
      )}
      {canDel && (
        <span onClick={p.onDelQuick} title={t.ed.del_unit} style={{ position: "absolute", top: 3, right: 3, width: 18, height: 18, borderRadius: 6, background: "rgba(255,255,255,.92)", color: "#e5484d", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", fontSize: 11, zIndex: 3 }}>
          <IconX size={11} stroke={2.5} />
        </span>
      )}
      {badges.map((b, i) => <span key={i} style={b.style}>{b.icon && <IconDoorEnter size={10} style={{ display: "inline", verticalAlign: -1, marginRight: 3 }} />}{b.label}</span>)}
      {splits.map((s, i) => <span key={"s" + i} style={s} />)}
    </>
  );
  return (
    <div
      onClick={p.onOpen}
      draggable={editOn}
      data-opluid={u.uid}
      onDragStart={p.onDragStart}
      style={style}
      className={sold ? "transition-shadow hover:shadow-[0_6px_16px_rgba(20,36,63,.3)]" : "transition-[transform,box-shadow] hover:-translate-y-[2px] hover:shadow-[0_8px_20px_rgba(20,36,63,.16)]"}
    >
      {common}
      {sold ? (
        <>
          <span style={{ fontSize: 13 }}>{numLabel(u.num)}</span>
          {infoLine && <span style={{ fontSize: 11, opacity: 0.85 }}>{infoLine}</span>}
          <span style={{ fontSize: 12, fontWeight: 700 }}>{u.status === "na" ? t.status.na : t.sold_word}</span>
        </>
      ) : (
        <>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 4, fontWeight: 600, fontSize: 13, paddingRight: editOn ? 16 : undefined }}><span className="whitespace-nowrap">{typeLabel}</span><span className="whitespace-nowrap">{numLabel(u.num)}</span></div>
          <div style={priceStyle} className="whitespace-nowrap" title={p.priceFull && p.priceFull !== p.priceLabel ? p.priceFull : undefined}>{p.priceLabel}</div>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 6, opacity: 0.9, overflow: "hidden", fontSize: 11 }}>{showArea && <span className="whitespace-nowrap">{area} м²</span>}{p.showPerM2 && showArea && <span className="whitespace-nowrap">{p.perM2}</span>}</div>
        </>
      )}
    </div>
  );
}
