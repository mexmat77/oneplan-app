"use client";

// Единый переключатель видов/режимов для всего сайта (12.10.2026, правило пользователя «один стандарт везде»):
// иконка + подпись, высота 32, активный — синий. Список/Канбан, Компакт/Развёрнуто, Список/Неделя — только через него.
import type { ReactNode } from "react";

export type SegOption<T extends string> = { value: T; label: string; icon?: ReactNode };

export function Segmented<T extends string>({ value, onChange, options, className = "", size = "md" }: { value: T; onChange: (v: T) => void; options: SegOption<T>[]; className?: string; size?: "md" | "sm" }) {
  return (
    <div role="tablist" className={`inline-flex ${size === "sm" ? "h-7" : "h-8"} items-stretch rounded-[6px] border border-line bg-surface p-[2px] ${className}`}>
      {options.map((o) => (
        <button key={o.value} type="button" role="tab" aria-selected={value === o.value} onClick={() => onChange(o.value)} title={o.label}
          className={`inline-flex cursor-pointer items-center gap-[6px] rounded-[4px] px-3 text-[12.5px] font-medium transition-colors ${value === o.value ? "bg-blue-2 text-white" : "text-muted hover:text-ink"}`}>
          {o.icon}<span>{o.label}</span>
        </button>
      ))}
    </div>
  );
}
