"use client";

// Цветной чип со списком значений (13.10.2026, замечание пользователя «этапы сделки — разными цветами, как у заявки»):
// один компонент для этапа сделки (шапка карточки сделки, блок сделок в карточке клиента, список сделок) и статуса
// заявки — тот же вид, что чип статуса клиента (`StageMenu`). Меню — fixed, чтобы его не резал overflow.
import { useBackClose } from "@/hooks/useScrollLock";
import { useEffect, useRef, useState } from "react";
import { IconChevronDown } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import type { Deal, RequestStatus } from "@/lib/crm/types";
import { stageName, useCrm } from "./crmUi";

export type ChipOption = { value: string; label: string; color: string };

/** Позиция fixed-меню под триггером: не вылезать за правый край, при нехватке места снизу — открыть вверх. */
export function menuPos(rect: { left: number; top: number; bottom: number } | null, w: number, h: number): React.CSSProperties {
  if (!rect) return { position: "fixed", zIndex: 600 };
  const vw = window.innerWidth || document.documentElement.clientWidth || 1600, vh = window.innerHeight || document.documentElement.clientHeight || 1000;
  const left = Math.max(8, Math.min(rect.left, vw - w - 8));
  const up = rect.bottom + h > vh && rect.top - h > 0;
  return up ? { position: "fixed", zIndex: 600, left, bottom: vh - rect.top + 4 } : { position: "fixed", zIndex: 600, left, top: rect.bottom + 4 };
}

export function ChipMenu({ value, options, onChange, disabled, title, size = "sm" }: { value: string; options: ChipOption[]; onChange: (v: string) => void; disabled?: boolean; title?: string; size?: "sm" | "md" }) {
  const [open, setOpen] = useState(false);
  useBackClose(open, () => setOpen(false));
  const [rect, setRect] = useState<{ left: number; top: number; bottom: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); }; document.addEventListener("mousedown", h, true); document.addEventListener("keydown", k, true); return () => { document.removeEventListener("mousedown", h, true); document.removeEventListener("keydown", k, true); }; }, [open]);
  const cur = options.find((o) => o.value === value);
  const col = cur?.color ?? "#8a93a2";
  return (
    <span ref={ref} className="relative inline-block">
      <button type="button" disabled={disabled} onClick={(e) => { e.stopPropagation(); const b = (e.currentTarget as HTMLElement).getBoundingClientRect(); setRect({ left: b.left, top: b.top, bottom: b.bottom }); setOpen((v) => !v); }} className={`inline-flex ${size === "md" ? "h-8 text-[13px]" : "h-7 text-[12px]"} cursor-pointer items-center gap-1 whitespace-nowrap rounded-[5px] px-2 font-medium hover:brightness-95 disabled:cursor-default`} style={{ background: col + "1f", color: col }}>{cur?.label ?? "—"}{!disabled && <IconChevronDown size={12} className="opacity-70" />}</button>
      {open && (
        <>{/* на телефоне — шторка снизу (data-sheet), единый стандарт меню CRM (18.10.2026) */}
        <div className="fixed inset-0 z-[310] bg-[rgba(10,16,28,.35)] md:hidden" onClick={() => setOpen(false)} />
        <div data-sheet="fit" style={menuPos(rect, 232, 40 + options.length * 32)} className="w-[220px] rounded-[8px] border border-line bg-surface p-1 shadow-[0_12px_40px_rgba(20,36,63,.16)] max-md:p-3 max-md:pb-[max(12px,env(safe-area-inset-bottom))]" onClick={(e) => e.stopPropagation()}>
          {title && <div className="px-2 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[.05em] text-muted">{title}</div>}
          {options.map((o) => <button key={o.value} type="button" onClick={() => { setOpen(false); if (o.value !== value) onChange(o.value); }} className={`flex h-8 w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 text-left text-[13px] ${o.value === value ? "bg-blue-tint font-semibold text-sel-ink" : "text-ink hover:bg-bg-3"}`}><span className="h-2 w-2 flex-none rounded-full" style={{ background: o.color }} />{o.label}</button>)}
        </div></>
      )}
    </span>
  );
}

/** Этап сделки — цветной чип по цвету этапа воронки сделок (закрытые: won — зелёный, lost — красный из настроек воронки). */
export function DealStageChip({ deal, onChange, disabled, size }: { deal: Pick<Deal, "stageId">; onChange: (stageId: string) => void; disabled?: boolean; size?: "sm" | "md" }) {
  const { t, lang } = useI18n(); const crm = useCrm();
  return <ChipMenu value={deal.stageId ?? ""} onChange={onChange} disabled={disabled} size={size} title={t.crm.deal.stage} options={crm.stages.map((s) => ({ value: s.id, label: stageName(s, t, lang), color: s.color ?? "#8a93a2" }))} />;
}

/** Цвета статусов заявки — как у этапов воронки (активная синяя, подбор оранжевый, показы фиолетовые, бронь сиреневая,
 *  переговоры бирюзовые, пауза серая, закрыта зелёная). */
export const REQ_ST_COLOR: Record<RequestStatus, string> = { active: "#4d7cfe", matching: "#f5a623", showing: "#7b4fd0", booked: "#a855f7", negotiation: "#0ea5a4", paused: "#8a93a2", closed: "#22c15e" };

export function ReqStatusChip({ value, onChange, disabled }: { value: RequestStatus; onChange: (v: RequestStatus) => void; disabled?: boolean }) {
  const { t } = useI18n(); const c = t.crm;
  return <ChipMenu value={value} onChange={(v) => onChange(v as RequestStatus)} disabled={disabled} title={c.rq.status} options={(Object.keys(c.rq.st) as RequestStatus[]).map((k) => ({ value: k, label: c.rq.st[k], color: REQ_ST_COLOR[k] }))} />;
}
