"use client";

// CRM v2 — задачи: быстрый ввод в одну строку, список по группам (просрочено / сегодня / позже / выполнено) и недельная сетка.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconCheck, IconPlus } from "@tabler/icons-react";
import { deleteTask, doneTask, listClients, listTasks, saveTask } from "@/app/crm/actions";
import { confirmDialog } from "@/components/ui/confirm";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Task } from "@/lib/crm/types";
import { TaskModal } from "./CrmModals";
import { btnP, card, fmtDT, inp, taskKindName, useCrm } from "./crmUi";

export function TasksView() {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const ro = crm.me.access !== "full";
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [view, setView] = useState<"list" | "week">("list");
  const [quick, setQuick] = useState("");
  const [modal, setModal] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const load = useCallback(() => { listTasks(!showDone).then(setTasks).catch(() => setTasks([])); listClients({}).then((l) => setClients(l.map((x) => ({ id: x.id, name: x.name })))).catch(() => {}); }, [showDone]);
  useEffect(() => { load(); }, [load]);
  const err = (e: unknown) => showToast((e as Error).message === "readonly" ? c.errReadonly : c.errSave);
  async function toggle(x: Task) { try { await doneTask(x.id, !x.doneAt); load(); } catch (e) { err(e); } }
  async function del(x: Task) { if (!(await confirmDialog({ text: c.task.delete + "?", danger: true }))) return; await deleteTask(x.id); load(); }
  async function quickAdd() {
    const title = quick.trim(); if (!title) return;
    const due = new Date(); due.setHours(due.getHours() + 1, 0, 0, 0);
    try { await saveTask({ clientId: null, dealId: null, ownerId: crm.me.meId, kind: "other", title, dueAt: due.toISOString() }); setQuick(""); load(); } catch (e) { err(e); }
  }
  const groups = useMemo(() => {
    const now = new Date(); const end = new Date(now); end.setHours(23, 59, 59, 999);
    const g: Record<"overdue" | "today" | "later" | "done", Task[]> = { overdue: [], today: [], later: [], done: [] };
    (tasks ?? []).forEach((x) => { if (x.doneAt) g.done.push(x); else if (new Date(x.dueAt) < now) g.overdue.push(x); else if (new Date(x.dueAt) <= end) g.today.push(x); else g.later.push(x); });
    return g;
  }, [tasks]);
  const week = useMemo(() => {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); const dow = (d0.getDay() + 6) % 7; d0.setDate(d0.getDate() - dow);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(d0); d.setDate(d0.getDate() + i); return d; });
  }, []);
  const row = (x: Task, over?: boolean) => (
    <div className="flex items-center gap-3 rounded-[12px] border border-line bg-surface px-3 py-[9px]">
      <button type="button" onClick={() => toggle(x)} disabled={ro} className={`flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-full border-2 ${x.doneAt ? "border-green bg-green text-white" : "border-line hover:border-blue"}`}>{x.doneAt && <IconCheck size={14} />}</button>
      <button type="button" onClick={() => setModal({ open: true, task: x })} className="min-w-0 flex-1 cursor-pointer text-left"><div className={`truncate text-[13.5px] font-semibold ${x.doneAt ? "text-muted line-through" : "text-ink"}`}>{x.title}</div><div className="text-[12px] text-muted">{taskKindName(x.kind, t)} · <span className={over ? "font-semibold text-red" : ""}>{fmtDT(x.dueAt, lang)}</span>{x.clientName ? <> · <Link href={`${crm.base}/c/${x.clientId}`} className="text-blue-2 hover:underline">{x.clientName}</Link></> : null}</div></button>
      <button type="button" onClick={() => del(x)} disabled={ro} className="cursor-pointer text-[12px] text-muted hover:text-red">✕</button>
    </div>
  );
  const sec = (title: string, list: Task[], over?: boolean) => list.length ? <div className="mb-4"><div className={`mb-2 text-[12px] font-extrabold uppercase tracking-[.04em] ${over ? "text-red" : "text-muted"}`}>{title} · {list.length}</div><div className="flex flex-col gap-2">{list.map((x) => <div key={x.id}>{row(x, over)}</div>)}</div></div> : null;
  const dayNames = [c.tk.mon, c.tk.tue, c.tk.wed, c.tk.thu, c.tk.fri, c.tk.sat, c.tk.sun];
  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-[20px] font-extrabold tracking-[-0.02em] text-ink">{c.nav.tasks}</h1>
        <div className="inline-flex gap-[3px] rounded-[10px] bg-bg-2 p-[3px]">{(["list", "week"] as const).map((v) => <button key={v} type="button" onClick={() => setView(v)} className={`h-8 cursor-pointer rounded-[8px] px-3 text-[12.5px] font-bold ${view === v ? "bg-surface text-ink shadow-[0_1px_3px_rgba(20,36,63,.12)]" : "text-muted"}`}>{v === "list" ? c.tk.list : c.tk.week}</button>)}</div>
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> {c.task.showDone}</label>
        <div className="flex-1" />
        <button type="button" onClick={() => setModal({ open: true, task: null })} disabled={ro} className={btnP}><IconPlus size={15} /> {c.task.add}</button>
      </div>
      <div className="mb-4 flex gap-2"><input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") quickAdd(); }} placeholder={c.tk.add} disabled={ro} className={inp} /><button type="button" onClick={quickAdd} disabled={ro || !quick.trim()} className={btnP}><IconPlus size={15} /></button></div>
      {tasks === null ? <div className="py-12 text-center text-[13px] text-muted">…</div>
        : view === "list" ? (tasks.length === 0 ? <div className={`${card} text-center text-[13.5px] text-muted`}>{c.task.none}</div> : <>{sec(c.task.overdue, groups.overdue, true)}{sec(c.task.today, groups.today)}{sec(c.task.later, groups.later)}{sec(c.task.done, groups.done)}</>)
        : (
          <div className="grid grid-cols-7 gap-2 max-md:grid-cols-1">
            {week.map((d, i) => { const key = d.toDateString(); const list = (tasks ?? []).filter((x) => new Date(x.dueAt).toDateString() === key); const today = new Date().toDateString() === key; return (
              <div key={i} className={`min-h-[160px] rounded-[12px] border p-2 ${today ? "border-sel-line bg-blue-tint/40" : "border-line bg-surface"}`}>
                <div className={`mb-2 text-[11.5px] font-extrabold uppercase ${today ? "text-sel-ink" : "text-muted"}`}>{dayNames[i]} {d.getDate()}</div>
                <div className="flex flex-col gap-1">{list.length === 0 ? <div className="text-[11.5px] text-muted">{c.tk.noTasks}</div> : list.map((x) => <button key={x.id} type="button" onClick={() => setModal({ open: true, task: x })} className={`cursor-pointer rounded-[8px] px-2 py-[5px] text-left text-[12px] ${x.doneAt ? "bg-bg-2 text-muted line-through" : new Date(x.dueAt) < new Date() ? "bg-red-tint text-red" : "bg-bg-2 text-ink"}`}><div className="truncate font-semibold">{x.title}</div><div className="text-[10.5px] opacity-80">{fmtDT(x.dueAt, lang).split(",").pop()?.trim()}{x.clientName ? ` · ${x.clientName}` : ""}</div></button>)}</div>
              </div>); })}
          </div>
        )}
      <TaskModal open={modal.open} task={modal.task} clients={clients} onClose={() => setModal({ open: false, task: null })} onSaved={() => { setModal({ open: false, task: null }); load(); }} />
    </>
  );
}
