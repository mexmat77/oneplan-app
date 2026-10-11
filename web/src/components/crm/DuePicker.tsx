"use client";

// Быстрый выбор срока (правило пользователя 12.10.2026 — «не в 5 кликов, а в 1»): пресеты сегодня / завтра / +3 дня / неделя
// + время одним кликом, точная дата — обычным полем. Значение — ISO.
import { useI18n } from "@/i18n/provider";
import { fromLocalInput, inp, toLocalInput } from "./crmUi";

const at = (daysAhead: number, hour: number) => { const d = new Date(); d.setDate(d.getDate() + daysAhead); d.setHours(hour, 0, 0, 0); return d.toISOString(); };
const sameDay = (a: string, daysAhead: number) => { const d = new Date(); d.setDate(d.getDate() + daysAhead); return new Date(a).toDateString() === d.toDateString(); };

export function DuePicker({ value, onChange, allowEmpty }: { value: string; onChange: (iso: string) => void; allowEmpty?: boolean }) {
  const { t } = useI18n();
  const d = t.crm.due;
  const presets: [string, number][] = [[d.today, 0], [d.tomorrow, 1], [d.in3, 3], [d.week, 7]];
  const hours = [10, 12, 15, 18];
  const chip = (on: boolean) => `h-7 cursor-pointer rounded-full border px-3 text-[12px] font-medium ${on ? "border-ink bg-ink text-white" : "border-line bg-surface text-text hover:bg-bg-3"}`;
  const hour = value ? new Date(value).getHours() : null;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center gap-[6px]">
        {presets.map(([l, n]) => <button key={n} type="button" onClick={() => onChange(at(n, hour ?? 10))} className={chip(!!value && sameDay(value, n))}>{l}</button>)}
        {allowEmpty && <button type="button" onClick={() => onChange("")} className={chip(!value)}>{d.none}</button>}
        <span className="mx-1 h-4 w-px bg-line" />
        {hours.map((h) => <button key={h} type="button" onClick={() => { const b = value ? new Date(value) : new Date(); b.setHours(h, 0, 0, 0); onChange(b.toISOString()); }} className={chip(!!value && hour === h)}>{h}:00</button>)}
      </div>
      <input type="datetime-local" value={value ? toLocalInput(value) : ""} onChange={(e) => onChange(e.target.value ? fromLocalInput(e.target.value) : "")} className={`${inp} w-[220px]`} />
    </div>
  );
}
