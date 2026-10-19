"use client";

// Строка задачи — одна во всех местах (19.10.2026, «в карточке клиента тоже как в списке задач»): кружок-чекбокс как у
// Todoist/Things (рамка, при наведении зелёная подсветка и «галочка-призрак», подсказка), точка типа, текст · тип · срок ·
// клиент, при наведении на строку справа «✓ Выполнить» (десктоп), ✕ — если передан onDelete. Список задач, карточки клиента и сделки.
import Link from "next/link";
import { IconCheck } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import type { Task } from "@/lib/crm/types";
import { fmtDT, TASK_COLOR, taskKindName, useCrm, useNow } from "./crmUi";

export function TaskRow({ task: x, onToggle, onOpen, onDelete, disabled, showClient = true, compact = false }: {
  task: Task; onToggle: () => void; onOpen: () => void; onDelete?: () => void; disabled?: boolean;
  /** показывать имя клиента (в карточке клиента не нужно) */ showClient?: boolean;
  /** компактнее — для блоков в карточках */ compact?: boolean;
}) {
  const { t, lang } = useI18n(); const c = t.crm; const crm = useCrm();
  const now = useNow();
  const overdue = !x.doneAt && new Date(x.dueAt).getTime() < now;
  const title = x.doneAt ? c.task.reopen : c.task.markDone;
  return (
    <div className={`group/row flex items-center gap-3 rounded-[6px] border border-line bg-surface ${compact ? "px-2 py-[5px]" : "px-3 py-[6px]"}`}>
      <button type="button" onClick={onToggle} disabled={disabled} title={title} aria-label={title} className={`group/chk flex flex-none cursor-pointer items-center justify-center rounded-full border-2 transition max-md:h-7 max-md:w-7 ${compact ? "h-5 w-5" : "h-[22px] w-[22px]"} ${x.doneAt ? "border-green bg-green text-white" : "border-[#aeb7c6] bg-surface text-[#c3cad6] hover:border-green hover:bg-green/10 hover:text-green"}`}><IconCheck size={compact ? 12 : 14} stroke={3} className={x.doneAt ? "" : "opacity-0 transition group-hover/chk:opacity-100"} /></button>
      <span className="h-2 w-2 flex-none rounded-full" style={{ background: TASK_COLOR[x.kind] }} />
      <button type="button" onClick={onOpen} className="min-w-0 flex-1 cursor-pointer text-left">
        <div className={`truncate ${compact ? "text-[12.5px] font-medium" : "text-[13.5px] font-semibold"} ${x.doneAt ? "text-muted line-through" : "text-ink"}`}>{x.title}</div>
        <div className={`${compact ? "text-[11px]" : "text-[12px]"} text-muted`}>{taskKindName(x.kind, t)} · <span className={overdue ? "font-semibold text-red" : ""}>{fmtDT(x.dueAt, lang)}</span>{showClient && x.clientName && x.clientId && <> · <Link href={`${crm.base}/c/${x.clientId}`} onClick={(e) => e.stopPropagation()} className="text-blue-2 hover:underline">{x.clientName}</Link></>}</div>
      </button>
      {!x.doneAt && !disabled && <button type="button" onClick={onToggle} className="hidden flex-none cursor-pointer items-center gap-1 rounded-[6px] border border-line px-2 py-[3px] text-[12px] font-semibold text-ink opacity-0 transition hover:border-green hover:text-green group-hover/row:opacity-100 md:inline-flex"><IconCheck size={13} /> {c.task.markDone}</button>}
      {onDelete && <button type="button" onClick={onDelete} disabled={disabled} className="cursor-pointer text-[12px] text-muted hover:text-red">✕</button>}
    </div>
  );
}
