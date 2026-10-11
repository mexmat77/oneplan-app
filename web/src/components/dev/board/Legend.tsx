"use client";

// Легенда шахматки (712–714, данные 3145–3151): «Всего» + статусы со счётчиками по сегменту; клик = фильтр по статусу.
//   <Legend units={segUnits} fSt={filters.fSt} onChange={(st) => setF({ ...f, fSt: st })} />
// `units` — юниты, прошедшие сегментный фильтр (`segPassOf(seg)`); `sticky` (default true) — липнет снизу (`bottom:10px; z-index:16`);
// `stickyTop` — липнет сверху с указанным отступом (публичная страница: под шапкой 60px и якорями — решение пользователя 23.09.2026,
// в прототипе легенда была снизу). Чипы не уходят за экран: `max-w-full` + горизонтальный скролл внутри самой легенды.
import { STORDER } from "@/lib/dev/data";
import type { Unit, UnitStatus } from "@/lib/dev/types";
import { useDevT } from "@/i18n/dev";
import { useDev } from "@/store/dev";
import { textOn } from "./shared";

export function Legend({ units, fSt, onChange, sticky = true, stickyTop, className = "" }: { units: Unit[]; fSt: "" | UnitStatus; onChange: (st: "" | UnitStatus) => void; sticky?: boolean; stickyTop?: number; className?: string }) {
  const { t } = useDevT();
  const { colors } = useDev();
  const cnt = Object.fromEntries(STORDER.map((k) => [k, 0])) as Record<UnitStatus, number>;
  units.forEach((u) => { if (cnt[u.status] != null) cnt[u.status]++; });
  const items: { key: "" | UnitStatus; label: string; count: number; bg: string; tx: string }[] = [
    { key: "", label: t.legend_total, count: units.length, bg: "#14243f", tx: "#fff" },
    ...STORDER.map((k) => ({ key: k, label: t.status[k], count: cnt[k], bg: colors[k], tx: textOn(k) })),
  ];
  return (
    <div data-legend="1" style={stickyTop != null ? { top: stickyTop } : undefined} className={`flex w-fit max-w-full flex-nowrap items-center gap-[22px] overflow-x-auto rounded-[14px] border border-line bg-surface px-5 py-[14px] shadow-[0_6px_24px_rgba(20,36,63,.14)] max-md:gap-[14px] max-md:px-[14px] max-md:py-[10px] ${stickyTop != null ? "sticky z-[16]" : sticky ? "sticky bottom-[10px] z-[16]" : ""} ${className}`}>
      {items.map((l) => {
        const act = !!l.key && fSt === l.key;
        return (
          <span key={l.key || "all"} onClick={() => onChange(l.key ? (fSt === l.key ? "" : l.key) : "")} className="flex flex-none cursor-pointer items-center gap-2 whitespace-nowrap rounded-[9px] px-[9px] py-1 text-[13.5px]" style={act ? { background: "#eef3ff", boxShadow: "inset 0 0 0 1.5px #4d7cfe" } : undefined}>
            <span className="flex h-6 min-w-[28px] items-center justify-center rounded-[7px] px-[7px] text-[13px] font-bold" style={{ color: l.tx, background: l.bg }}>{l.count}</span> {l.label}
          </span>
        );
      })}
    </div>
  );
}
