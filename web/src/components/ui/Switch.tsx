"use client";

// Общий тумблер (16.10.2026): role=switch, 36×20, синий во включённом состоянии, подпись справа. Использовать вместо
// «чипов-статусов», по которым непонятно, что это кнопка (замечание пользователя: «не могу собрать свой комплект шаблонов»).
export function Switch({ checked, onChange, disabled = false, label, title, size = "md" }: { checked: boolean; onChange: (v: boolean) => void; disabled?: boolean; label?: string; title?: string; size?: "sm" | "md" }) {
  const w = size === "sm" ? 30 : 36, h = size === "sm" ? 17 : 20, k = h - 4;
  return (
    <button type="button" role="switch" aria-checked={checked} disabled={disabled} title={title} onClick={() => onChange(!checked)}
      className={`inline-flex items-center gap-[8px] text-[12.5px] font-semibold ${disabled ? "cursor-default opacity-50" : "cursor-pointer"} ${checked ? "text-ink" : "text-muted"}`}>
      <span className="relative flex-none rounded-full transition-[background] duration-150" style={{ width: w, height: h, background: checked ? "var(--blue-2, #2f5fe0)" : "#d5dce6" }}>
        <span className="absolute top-[2px] rounded-full bg-white shadow-[0_1px_2px_rgba(20,36,63,.25)] transition-[left] duration-150" style={{ width: k, height: k, left: checked ? w - k - 2 : 2 }} />
      </span>
      {label && <span>{label}</span>}
    </button>
  );
}
