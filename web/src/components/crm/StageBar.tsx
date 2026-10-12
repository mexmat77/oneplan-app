"use client";

// Полоса этапов под шапкой карточки (13.10.2026, «статусы в разных местах — хаотично»): как в Pipedrive/HubSpot — одна
// горизонтальная полоса, открытые этапы слева направо (пройденные и текущий залиты цветом текущего этапа, будущие — серые),
// закрывающие (сделка / отказ / нецелевой) — кнопки справа. Клик по этапу переводит на него; этап «Приедет» (`dateKey`)
// сначала спрашивает дату приезда и создаёт задачу-напоминание.
import { useState } from "react";
import { IconCheck, IconX } from "@tabler/icons-react";
import type { Dict } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import type { Lang } from "@/i18n";
import type { Stage } from "@/lib/crm/types";
import { DuePicker } from "./DuePicker";
import { btnP, btnS, stageName } from "./crmUi";

type Props = {
  stages: Stage[]; value: string | null; by?: "key" | "id"; disabled?: boolean;
  onChange: (v: string) => void;
  /** этап с датой («Приедет»): перед сменой — дата, затем `onDate(iso)` (родитель создаёт задачу) */
  dateKey?: string; onDate?: (iso: string) => Promise<void> | void; dateLabel?: string;
};

export function StageBar({ stages, value, by = "key", disabled, onChange, dateKey, onDate, dateLabel }: Props) {
  const { t, lang } = useI18n();
  const [pick, setPick] = useState<null | { v: string; due: string }>(null);
  const idOf = (s: Stage) => (by === "key" ? s.key : s.id);
  const open = stages.filter((s) => s.kind === "open");
  const closed = stages.filter((s) => s.kind !== "open");
  const cur = stages.find((s) => idOf(s) === value) ?? null;
  const curIdx = cur ? open.findIndex((s) => idOf(s) === idOf(cur)) : -1;
  const col = cur?.color ?? "#8a93a2";
  const name = (s: Stage) => stageName(s, t as Dict, lang as Lang);
  const go = (s: Stage) => {
    if (disabled || idOf(s) === value) return;
    if (dateKey && s.key === dateKey && onDate) { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); setPick({ v: idOf(s), due: d.toISOString() }); return; }
    onChange(idOf(s));
  };
  return (
    <div className="mb-4">
      <div className="flex items-stretch gap-2 max-md:flex-col">
        <div className="flex min-w-0 flex-1 overflow-x-auto">
          {open.map((s, i) => {
            const done = curIdx >= 0 && i < curIdx, now = i === curIdx;
            const bg = now ? col : done ? col + "55" : "#eef0f3";
            const fg = now ? "#fff" : done ? "#1b2a4a" : "#5a6472";
            return (
              <button key={s.id} type="button" disabled={disabled} onClick={() => go(s)} title={name(s)}
                className={`relative h-8 min-w-[118px] flex-1 cursor-pointer truncate px-4 text-[12px] font-medium transition first:rounded-l-[6px] last:rounded-r-[6px] hover:brightness-95 disabled:cursor-default ${i > 0 ? "-ml-[10px] pl-6" : ""}`}
                style={{ background: bg, color: fg, clipPath: i === 0 ? "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%)" : i === open.length - 1 ? "polygon(0 0, 100% 0, 100% 100%, 0 100%, 10px 50%)" : "polygon(0 0, calc(100% - 10px) 0, 100% 50%, calc(100% - 10px) 100%, 0 100%, 10px 50%)" }}>
                {name(s)}
              </button>
            );
          })}
        </div>
        {closed.length > 0 && (
          <div className="flex flex-none gap-1">
            {closed.map((s) => { const on = idOf(s) === value; const c2 = s.color ?? (s.kind === "won" ? "#0f9d6b" : "#e5484d"); return (
              <button key={s.id} type="button" disabled={disabled} onClick={() => go(s)} className={`inline-flex h-8 cursor-pointer items-center gap-1 rounded-[6px] border px-3 text-[12px] font-medium transition disabled:cursor-default ${on ? "text-white" : "bg-surface text-text hover:bg-bg-3"}`} style={on ? { background: c2, borderColor: c2 } : { borderColor: c2 + "66", color: c2 }}>
                {s.kind === "won" ? <IconCheck size={13} /> : <IconX size={13} />}{name(s)}
              </button>); })}
          </div>
        )}
      </div>
      {pick && (
        <div data-crm-form="1" className="mt-2 flex flex-wrap items-center gap-2 rounded-[6px] border border-sel-line bg-blue-tint/40 p-2">
          <span className="text-[12.5px] font-medium text-ink">{dateLabel}</span>
          <DuePicker value={pick.due} onChange={(iso) => setPick({ ...pick, due: iso })} />
          <button type="button" onClick={async () => { const p = pick; setPick(null); onChange(p.v); await onDate?.(p.due); }} className={btnP}><IconCheck size={14} /> OK</button>
          <button type="button" onClick={() => setPick(null)} className={btnS}>{t.common.cancel}</button>
        </div>
      )}
    </div>
  );
}
