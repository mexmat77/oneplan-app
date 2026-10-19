"use client";

// CRM v2 — задачи: быстрый ввод в одну строку, виды (открытые · сегодня · просрочено · выполненные · все), фильтры по типу,
// ответственному, привязке и сроку (FilterKit, 19.10.2026), поиск из шапки; режимы «Список · Неделя · Месяц».
// Месяц — календарная сетка как у Pipedrive Activities / Google Calendar: до трёх задач в клетке цветными полосками по типу,
// «ещё N» и клик по дню открывают список дня, перетаскивание задачи на другой день переносит срок (время сохраняется).
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconCalendarMonth, IconCalendarWeek, IconChevronLeft, IconChevronRight, IconList, IconPlus } from "@tabler/icons-react";
import { Segmented } from "@/components/ui/Segmented";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { showToast } from "@/components/ui/toast";
import { deleteTask, doneTask, listClients, listTasks, saveTask } from "@/app/crm/actions";
import { confirmDialog } from "@/components/ui/confirm";
import { useI18n } from "@/i18n/provider";
import type { Task } from "@/lib/crm/types";
import { TaskModal } from "./CrmModals";
import { TaskRow } from "./TaskRow";
import { crmError, cacheGet, cacheSet, btnP, card, fill, fmtDT, fmtDate, inp, setPref, TASK_COLOR, taskKindName, useCrm, useNow, usePref } from "./crmUi";
import { activeCount, emptyOf, FilterPanel, FiltersButton, loadFlt, PanelField, PanelGroup, PillBar, sel, storeFlt, str, ViewTabs, type FDef, type GFlt } from "./FilterKit";

type TView = "open" | "today" | "overdue" | "done" | "all";
type Mode = "list" | "week" | "month";
const KINDS = ["call", "show", "meeting", "message", "other"] as const;
const dayKey = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
const LOC: Record<string, string> = { RU: "ru-RU", EN: "en-GB", TR: "tr-TR" };

export function TasksView() {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const ro = crm.me.access !== "full";
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  // кэш раздела: пока свежий ответ не пришёл, показываем сохранённый список (без setState в эффекте)
  const tasksKey = `${crm.base}:tasks:all`;
  const [loaded, setLoaded] = useState<{ key: string; tasks: Task[] } | null>(null);
  const tasks: Task[] | null = loaded?.key === tasksKey ? loaded.tasks : cacheGet<Task[]>(tasksKey) ?? null;
  const modePref = usePref("opl-crm-tasks-view");
  const mode: Mode = modePref === "week" || modePref === "month" ? modePref : "list";
  const setMode = (v: Mode) => setPref("opl-crm-tasks-view", v);
  const vwPref = usePref(`opl-crm-tasks-vw:${crm.base}`);
  const vw: TView = (["open", "today", "overdue", "done", "all"] as TView[]).includes(vwPref as TView) ? (vwPref as TView) : "open";
  const setVw = (v: TView) => setPref(`opl-crm-tasks-vw:${crm.base}`, v);
  const [quick, setQuick] = useState("");
  const [modal, setModal] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [panel, setPanel] = useState(false);
  const [weekOff, setWeekOff] = useState(0);
  const [month, setMonth] = useState(() => { const d = new Date(); return { y: d.getFullYear(), m: d.getMonth() }; });
  const [day, setDay] = useState<string | null>(null); // открытый день месяца (список задач дня)
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const load = useCallback(() => { listTasks(false).then((v) => setLoaded({ key: tasksKey, tasks: cacheSet(tasksKey, v) })).catch(() => setLoaded({ key: tasksKey, tasks: [] })); listClients({}).then((l) => setClients(l.map((x) => ({ id: x.id, name: x.name })))).catch(() => {}); }, [tasksKey]);
  useEffect(() => { load(); }, [load]);
  const err = (e: unknown) => crmError(e, c.errSave, c.errReadonly);
  async function toggle(x: Task) { try { await doneTask(x.id, !x.doneAt); load(); } catch (e) { err(e); } }
  async function del(x: Task) { if (!(await confirmDialog({ text: c.task.delete + "?", danger: true }))) return; await deleteTask(x.id); load(); }
  async function quickAdd() {
    const title = quick.trim(); if (!title) return;
    const due = new Date(); due.setHours(due.getHours() + 1, 0, 0, 0);
    try { await saveTask({ clientId: null, dealId: null, ownerId: crm.me.meId, kind: "other", title, dueAt: due.toISOString() }); setQuick(""); load(); } catch (e) { err(e); }
  }
  /** перенос срока на другой день (перетаскивание в календаре): время сохраняется, локально сразу, сервер фоном */
  async function moveTo(x: Task, key: string) {
    const d = new Date(x.dueAt); const [y, m, dd] = key.split("-").map(Number); d.setFullYear(y, m - 1, dd);
    const iso = d.toISOString(); if (iso === x.dueAt) return;
    setLoaded((l) => (l ? { ...l, tasks: l.tasks.map((k) => (k.id === x.id ? { ...k, dueAt: iso } : k)) } : l));
    try { await saveTask({ clientId: x.clientId, dealId: x.dealId, ownerId: x.ownerId, kind: x.kind, title: x.title, dueAt: iso }, x.id); showToast(c.tflt.moved); load(); } catch (e) { err(e); load(); }
  }

  // ---- фильтры
  const fltKey = `opl-crm-tasks-flt:${crm.base}`;
  const [fltRaw, setFltRaw] = useState<GFlt>(() => loadFlt(fltKey, []));
  const defs = useMemo<FDef[]>(() => [
    { key: "kind", label: c.task.kind, kind: "select", opts: KINDS.map((k) => ({ value: k, label: taskKindName(k, t), color: TASK_COLOR[k] })) },
    ...(crm.me.members.length > 1 ? [{ key: "owner", label: c.owner, kind: "select" as const, opts: crm.me.members.map((m) => ({ value: m.id, label: m.name, color: m.color })) }] : []),
    { key: "link", label: c.tflt.link, kind: "select", opts: [{ value: "client", label: c.tflt.linkClient }, { value: "deal", label: c.tflt.linkDeal }, { value: "none", label: c.tflt.linkNone }] },
    { key: "due", label: c.tflt.due, kind: "dates", range: { from: "dueFrom", to: "dueTo" } },
  ], [c, t, crm.me.members]);
  const flt = useMemo(() => ({ ...emptyOf(defs), ...fltRaw }), [defs, fltRaw]);
  const setF = (p: GFlt) => setFltRaw((prev) => { const n = { ...prev, ...p }; storeFlt(fltKey, n); return n; });
  const resetF = () => { setFltRaw({}); storeFlt(fltKey, {}); };
  const active = activeCount(flt, defs);
  const nowMs0 = useNow();
  const q = crm.q.trim().toLowerCase();
  const linkOf = (x: Task) => (x.dealId ? "deal" : x.clientId ? "client" : "none");
  const filtered = useMemo(() => (tasks ?? []).filter((x) =>
    (!q || x.title.toLowerCase().includes(q) || (x.clientName ?? "").toLowerCase().includes(q))
    && (!sel(flt, "kind").length || sel(flt, "kind").includes(x.kind))
    && (!sel(flt, "owner").length || sel(flt, "owner").includes(x.ownerId ?? ""))
    && (!sel(flt, "link").length || sel(flt, "link").includes(linkOf(x)))
    && (!str(flt, "dueFrom") || x.dueAt >= str(flt, "dueFrom")) && (!str(flt, "dueTo") || x.dueAt <= str(flt, "dueTo") + "T23:59:59"),
  ), [tasks, q, flt]);
  const todayKey = dayKey(new Date(nowMs0));
  const viewOk = useCallback((x: Task, v: TView) => {
    const now = nowMs0; const due = new Date(x.dueAt);
    switch (v) { case "all": return true; case "done": return !!x.doneAt; case "overdue": return !x.doneAt && due.getTime() < now; case "today": return !x.doneAt && dayKey(due) === todayKey; default: return !x.doneAt; }
  }, [todayKey, nowMs0]);
  const counts = useMemo(() => Object.fromEntries((["open", "today", "overdue", "done", "all"] as TView[]).map((v) => [v, filtered.filter((x) => viewOk(x, v)).length])) as Record<TView, number>, [filtered, viewOk]);
  const shown = useMemo(() => filtered.filter((x) => viewOk(x, vw)), [filtered, vw, viewOk]);

  const groups = useMemo(() => {
    const now = new Date(); const end = new Date(now); end.setHours(23, 59, 59, 999);
    const g: Record<"overdue" | "today" | "later" | "done", Task[]> = { overdue: [], today: [], later: [], done: [] };
    shown.forEach((x) => { if (x.doneAt) g.done.push(x); else if (new Date(x.dueAt) < now) g.overdue.push(x); else if (new Date(x.dueAt) <= end) g.today.push(x); else g.later.push(x); });
    return g;
  }, [shown]);
  const week = useMemo(() => {
    const d0 = new Date(); d0.setHours(0, 0, 0, 0); const dow = (d0.getDay() + 6) % 7; d0.setDate(d0.getDate() - dow + weekOff * 7);
    return Array.from({ length: 7 }, (_, i) => { const d = new Date(d0); d.setDate(d0.getDate() + i); return d; });
  }, [weekOff]);
  // сетка месяца: с понедельника той недели, где 1-е число, 6 строк
  const grid = useMemo(() => {
    const first = new Date(month.y, month.m, 1); const dow = (first.getDay() + 6) % 7; const start = new Date(first); start.setDate(1 - dow);
    return Array.from({ length: 42 }, (_, i) => { const d = new Date(start); d.setDate(start.getDate() + i); return d; });
  }, [month]);
  const byDay = useMemo(() => { const m = new Map<string, Task[]>(); shown.forEach((x) => { const k = dayKey(new Date(x.dueAt)); m.set(k, [...(m.get(k) ?? []), x]); }); return m; }, [shown]);
  const monthTitle = new Date(month.y, month.m, 1).toLocaleDateString(LOC[lang] ?? "ru-RU", { month: "long", year: "numeric" });
  const shiftMonth = (n: number) => setMonth(({ y, m }) => { const d = new Date(y, m + n, 1); return { y: d.getFullYear(), m: d.getMonth() }; });

  const row = (x: Task) => <TaskRow task={x} onToggle={() => toggle(x)} onOpen={() => setModal({ open: true, task: x })} onDelete={() => del(x)} disabled={ro} />;
  const sec = (title: string, list: Task[], overdue?: boolean) => list.length ? <div className="mb-4"><div className={`mb-2 text-[11px] font-semibold uppercase tracking-[.05em] ${overdue ? "text-red" : "text-muted"}`}>{title} · {list.length}</div><div className="flex flex-col gap-2">{list.map((x) => <div key={x.id}>{row(x)}</div>)}</div></div> : null;
  const dayNames = [c.tk.mon, c.tk.tue, c.tk.wed, c.tk.thu, c.tk.fri, c.tk.sat, c.tk.sun];
  const nowMs = useNow(); // «сейчас» через хук (правило React-компилятора)
  /** полоска задачи в календаре: цвет типа, просроченная — красная, выполненная — серая зачёркнутая; тянется мышью */
  const bar = (x: Task, compact = false) => (
    <button key={x.id} type="button" draggable={!ro && !x.doneAt} onDragStart={(e) => { setDragId(x.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", x.id); }} onDragEnd={() => { setDragId(null); setOver(null); }}
      onClick={(e) => { e.stopPropagation(); setModal({ open: true, task: x }); }} title={`${x.title} · ${fmtDT(x.dueAt, lang)}${x.clientName ? ` · ${x.clientName}` : ""}`}
      className={`flex w-full cursor-pointer items-center gap-[5px] truncate rounded-[4px] px-[6px] text-left text-[11.5px] leading-[20px] ${x.doneAt ? "bg-bg-2 text-muted line-through" : new Date(x.dueAt).getTime() < nowMs ? "bg-red-tint text-red" : "bg-bg-2 text-ink"} ${dragId === x.id ? "opacity-40" : ""} ${compact ? "h-[20px]" : ""}`}>
      <span className="h-[6px] w-[6px] flex-none rounded-full" style={{ background: TASK_COLOR[x.kind] }} /><span className="flex-none text-[10.5px] text-muted">{new Date(x.dueAt).toLocaleTimeString(LOC[lang] ?? "ru-RU", { hour: "2-digit", minute: "2-digit" })}</span><span className="truncate">{x.title}</span>
    </button>
  );
  const dropProps = (key: string) => ({
    onDragOver: (e: React.DragEvent) => { if (!dragId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== key) setOver(key); },
    onDragLeave: (e: React.DragEvent) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setOver((v) => (v === key ? null : v)); },
    onDrop: (e: React.DragEvent) => { e.preventDefault(); const id = dragId ?? e.dataTransfer.getData("text/plain"); const x = (tasks ?? []).find((k) => k.id === id); setOver(null); setDragId(null); if (x) moveTo(x, key); },
  });
  const dayList = day ? byDay.get(day) ?? [] : [];

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        {mode !== "list" && (
          <div className="flex items-center gap-1">
            <button type="button" onClick={() => (mode === "week" ? setWeekOff((v) => v - 1) : shiftMonth(-1))} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[6px] border border-line bg-surface text-ink hover:bg-bg-3"><IconChevronLeft size={15} /></button>
            <button type="button" onClick={() => (mode === "week" ? setWeekOff(0) : setMonth({ y: new Date().getFullYear(), m: new Date().getMonth() }))} className="h-8 cursor-pointer rounded-[6px] border border-line bg-surface px-3 text-[13px] font-medium text-ink hover:bg-bg-3">{c.tflt.today}</button>
            <button type="button" onClick={() => (mode === "week" ? setWeekOff((v) => v + 1) : shiftMonth(1))} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[6px] border border-line bg-surface text-ink hover:bg-bg-3"><IconChevronRight size={15} /></button>
            <span className="ml-2 text-[14px] font-semibold capitalize text-ink">{mode === "month" ? monthTitle : `${fmtDate(week[0].toISOString(), lang)} – ${fmtDate(week[6].toISOString(), lang)}`}</span>
          </div>
        )}
        <div className="ml-auto flex items-center gap-2 max-md:w-full">{/* на телефоне — своей строкой: режим слева, фильтры справа (19.10.2026) */}
          <Segmented value={mode} onChange={setMode} options={[{ value: "list", label: c.tk.list, icon: <IconList size={15} /> }, { value: "week", label: c.tk.week, icon: <IconCalendarWeek size={15} /> }, { value: "month", label: c.tflt.month, icon: <IconCalendarMonth size={15} /> }]} />
          <FiltersButton n={active} onClick={() => setPanel(true)} className="ml-auto" />
        </div>
      </div>
      <ViewTabs value={vw} onChange={setVw} items={(["open", "today", "overdue", "done", "all"] as TView[]).map((v) => ({ key: v, label: c.tflt.views[v], n: counts[v], red: v === "overdue" }))} />
      <PillBar flt={flt} setF={setF} reset={resetF} defs={defs} />
      <div className="mb-4 flex gap-2"><input value={quick} onChange={(e) => setQuick(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") quickAdd(); }} placeholder={c.tk.add} disabled={ro} className={inp} /><button type="button" onClick={quickAdd} disabled={ro || !quick.trim()} className={btnP}><IconPlus size={15} /></button></div>
      {tasks === null ? <div className="py-12 text-center text-[13px] text-muted">…</div>
        : mode === "list" ? (shown.length === 0 ? <div className={`${card} text-center text-[13.5px] text-muted`}>{c.task.none}</div> : <>{sec(c.task.overdue, groups.overdue, true)}{sec(c.task.today, groups.today)}{sec(c.task.later, groups.later)}{sec(c.task.done, groups.done)}</>)
        : mode === "week" ? (
          <div className="grid grid-cols-7 gap-2 max-md:grid-cols-1">
            {week.map((d, i) => { const key = dayKey(d); const list = byDay.get(key) ?? []; const today = key === todayKey; return (
              <div key={i} {...dropProps(key)} className={`min-h-[160px] rounded-[6px] border p-2 transition ${over === key ? "border-blue-2 bg-blue-tint/60" : today ? "border-sel-line bg-blue-tint/40" : "border-line bg-surface"}`}>
                <div className={`mb-2 text-[11.5px] font-extrabold uppercase ${today ? "text-sel-ink" : "text-muted"}`}>{dayNames[i]} {d.getDate()}</div>
                <div className="flex flex-col gap-1">{list.length === 0 ? <div className="text-[11.5px] text-muted">{c.tk.noTasks}</div> : list.map((x) => bar(x))}</div>
              </div>); })}
          </div>
        ) : (
          <div className={`${card} overflow-hidden p-0`}>
            <div className="grid grid-cols-7 border-b border-line bg-[#f7f8fa] text-center text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{dayNames.map((n) => <div key={n} className="py-[6px]">{n}</div>)}</div>
            <div className="grid grid-cols-7">
              {grid.map((d, i) => { const key = dayKey(d); const list = byDay.get(key) ?? []; const cur = d.getMonth() === month.m; const today = key === todayKey; const extra = list.length - 3; return (
                <div key={i} {...dropProps(key)} onClick={() => list.length && setDay(key)} className={`min-h-[104px] border-b border-r border-line p-1 transition max-md:min-h-[56px] ${(i + 1) % 7 === 0 ? "border-r-0" : ""} ${over === key ? "bg-blue-tint/60" : today ? "bg-blue-tint/30" : cur ? "bg-surface" : "bg-[#fafbfc]"} ${list.length ? "cursor-pointer" : ""}`}>
                  <div className={`mb-1 flex h-[22px] w-[22px] items-center justify-center rounded-full text-[12px] ${today ? "bg-blue-2 font-bold text-white" : cur ? "font-semibold text-ink" : "text-muted"}`}>{d.getDate()}</div>
                  <div className="flex flex-col gap-[2px] max-md:hidden">{list.slice(0, 3).map((x) => bar(x, true))}{extra > 0 && <button type="button" onClick={(e) => { e.stopPropagation(); setDay(key); }} className="cursor-pointer px-[6px] text-left text-[11px] font-semibold text-blue-2 hover:underline">{fill(c.tflt.more, { n: extra })}</button>}</div>
                  {list.length > 0 && <div className="hidden flex-wrap gap-[3px] max-md:flex">{list.slice(0, 6).map((x) => <span key={x.id} className="h-[6px] w-[6px] rounded-full" style={{ background: x.doneAt ? "#c9d0dc" : new Date(x.dueAt).getTime() < nowMs ? "#e5484d" : TASK_COLOR[x.kind] }} />)}{list.length > 6 && <span className="text-[10px] text-muted">+{list.length - 6}</span>}</div>}
                </div>); })}
            </div>
          </div>
        )}
      <FilterPanel open={panel} onClose={() => setPanel(false)} active={active} count={shown.length} reset={resetF}>
        <PanelGroup label={c.tflt.group}>{defs.filter((d) => d.kind === "select").map((d) => <PanelField key={d.key} def={d} flt={flt} setF={setF} />)}</PanelGroup>
        <PanelGroup label={c.tbl.flt.dates}>{defs.filter((d) => d.kind === "dates").map((d) => <PanelField key={d.key} def={d} flt={flt} setF={setF} />)}</PanelGroup>
      </FilterPanel>
      {/* список задач дня (клик по дню или «ещё N» в месяце) */}
      <Modal open={!!day} onClose={() => setDay(null)} width={560}>
        <div data-modal-head="1" className="mb-3 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{day ? fill(c.tflt.day, { d: fmtDate(new Date(day + "T12:00:00").toISOString(), lang) }) : ""}</div><ModalClose onClick={() => setDay(null)} /></div>
        <div className="flex flex-col gap-2">{dayList.map((x) => <div key={x.id}>{row(x)}</div>)}{dayList.length === 0 && <div className="py-4 text-center text-[13px] text-muted">{c.tk.noTasks}</div>}</div>
      </Modal>
      <TaskModal open={modal.open} task={modal.task} clients={clients} onClose={() => setModal({ open: false, task: null })} onSaved={() => { setModal({ open: false, task: null }); load(); }} />
    </>
  );
}
