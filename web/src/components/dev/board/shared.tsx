"use client";

// Общие хуки/хелперы компонентов шахматки: данные объекта из стора, мобильный порог 760px (`mobV`),
// цена за м² (`perM2`), палитра бейджей `tagMeta2` (3467) и стили чипов прототипа.
import { useEffect, useMemo, useSyncExternalStore } from "react";
import { CUR_INFO, nf, BOOKED_TEXT, NA_TEXT } from "@/lib/dev/data";
import { buildAutoTypes } from "@/lib/dev/planTypes";
import { legacyKindOf, loadLegacyUnits } from "@/lib/dev/rows";
import type { Cur, PlanType, Project, Unit, UnitStatus } from "@/lib/dev/types";
import { getDev, setUnits, useDev } from "@/store/dev";

/** `window.innerWidth < 760` как внешний стор (прототип пересчитывал на resize). */
const mq = () => (typeof window === "undefined" ? null : window.matchMedia("(max-width: 759px)"));
const subMq = (cb: () => void) => { const m = mq(); if (!m) return () => {}; m.addEventListener("change", cb); return () => m.removeEventListener("change", cb); };
export function useIsMobile(): boolean { return useSyncExternalStore(subMq, () => !!mq()?.matches, () => false); }

/** Проект + юниты + цвета + типы планировок (автосписок, если в сторе ещё нет). */
export function useObj(objId: number) {
  const s = useDev();
  const obj = useMemo(() => s.projects.find((p) => p.id === objId), [s.projects, objId]);
  const units = useMemo(() => s.units[objId] ?? [], [s.units, objId]);
  const stored = s.planTypes[objId];
  const planTypes = useMemo(() => stored ?? buildAutoTypes(units), [stored, units]);
  return { obj, units, colors: s.colors, features: s.features, planTypes, cur: (obj?.cur || "EUR") as Cur, boardZoom: s.boardZoom, genGrid: !!obj?.genGrid };
}

const loaded = new Set<number>();
/** Megapolis (8) / Akropolis (10): грузим `rows.json` один раз при открытии и кладём в стор через `setUnits`. */
export function useEnsureUnits(objId: number, obj: Project | undefined, units: Unit[]) {
  const kind = legacyKindOf(obj);
  const empty = units.length === 0;
  useEffect(() => {
    if (!kind || !empty || loaded.has(objId)) return;
    // во время гидрации `useDev` отдаёт серверный DEFAULT (пустые юниты) — сверяемся с реальным снимком стора,
    // чтобы не затереть сохранённую в localStorage сетку (в т.ч. созданные мастером блоки)
    const live = () => (getDev().units[objId] ?? []).length > 0;
    if (live()) return;
    loaded.add(objId);
    loadLegacyUnits(kind).then((list) => { if (list.length && !live()) setUnits(objId, list); });
  }, [kind, empty, objId]);
  return !!kind && empty;
}

export const perM2 = (price: number, area: number, cur: Cur) => `${nf(Math.round(price / (area || 1)))} ${CUR_INFO[cur].sym}/м²`;
export const textOn = (st: UnitStatus) => (st === "booked" ? BOOKED_TEXT : st === "na" ? NA_TEXT : "#fff");
export const TAG_META: Record<string, [string, string]> = { terrace: ["badge_terrace", "#0284c7"], duplex: ["badge_duplex", "#b45309"], tduplex: ["badge_tduplex", "#9a3412"], triplex: ["badge_triplex", "#0f766e"], kapici: ["badge_kapici", "#6b7688"], ofis: ["badge_ofis", "#7b4fd0"] };

/** Чип статуса (список/карточки вилл): `font-size:12px;…;border-radius:20px`. */
export const statusChipStyle = (bg: string, st: UnitStatus): React.CSSProperties => ({ fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 20, color: textOn(st), whiteSpace: "nowrap", background: bg });
/** Кнопка-переключатель в стиле прототипа (тёмная активная): schemeView / segBtns / listVariant. */
export const darkToggle = (on: boolean) => (on ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2");
export const blueToggle = (on: boolean) => (on ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-text-2");
export type PlanTypeList = PlanType[];
