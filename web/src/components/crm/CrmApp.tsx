"use client";

// CRM — главный экран (общий для кабинета риэлтора `/crm` и застройщика `/dev/crm`): вкладки клиенты / сделки / задачи /
// настройки. Данные приходят из серверных экшенов уже расшифрованными (только разрешённые RLS записи).
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconAddressBook, IconCalendarEvent, IconCheck, IconLayoutKanban, IconList, IconLock, IconPlus, IconSearch, IconUser } from "@tabler/icons-react";
import { crmBootstrap, deleteTask, doneTask, listClients, listDeals, listTasks, moveDeal } from "@/app/crm/actions";
import { confirmDialog } from "@/components/ui/confirm";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Client, CrmMe, Deal, Source, Stage, Task } from "@/lib/crm/types";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { ClientModal } from "./ClientModal";
import { DealModal, TaskModal } from "./CrmModals";
import { CrmSettings } from "./CrmSettings";
import { CrmCtx, btnP, btnS, card, chip, fill, fmtDT, fmtDate, initials, inp, sourceName, stageName, taskKindName, useCrm } from "./crmUi";

type Tab = "clients" | "deals" | "tasks" | "settings";

export function CrmApp({ base }: { base: string }) {
  const { t, lang } = useI18n();
  const c = t.crm;
  const sp = useSearchParams();
  const router = useRouter();
  const tab = (sp.get("tab") as Tab) || "clients";
  const [boot, setBoot] = useState<{ me: CrmMe; stages: Stage[]; sources: Source[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const load = useCallback(() => { crmBootstrap().then(setBoot).catch((e: Error) => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  const setTab = (x: Tab) => router.replace(`${base}?tab=${x}`);

  if (err) return <div className={card}>{err === "no-company" ? "—" : err}</div>;
  if (!boot) return <div className="py-10 text-center text-[13px] text-muted">…</div>;
  const ctx = { me: boot.me, stages: boot.stages, sources: boot.sources, base, refresh: load, setStages: (s: Stage[]) => setBoot((b) => (b ? { ...b, stages: s } : b)), setSources: (s: Source[]) => setBoot((b) => (b ? { ...b, sources: s } : b)) };
  const tabs: [Tab, string][] = [["clients", c.tabs.clients], ["deals", c.tabs.deals], ["tasks", c.tabs.tasks], ["settings", c.tabs.settings]];
  return (
    <CrmCtx.Provider value={ctx}>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{c.title}</h1>
          <p className="mt-[5px] max-w-[640px] text-[14px] text-text-2 [text-wrap:pretty]">{c.sub}</p>
        </div>
        <div className="flex items-center gap-2 text-[12px] text-muted"><IconLock size={14} /> {c.secure}</div>
      </div>
      {boot.me.access === "readonly"
        ? <div className="mb-4 rounded-[12px] border border-[#f3b8bb] bg-red-tint px-4 py-3 text-[13px] font-semibold text-red">{c.readonly}</div>
        : boot.me.paidTo
          ? <div className="mb-4 text-[12.5px] text-muted">{fill(c.paidTo, { date: fmtDate(boot.me.paidTo, lang) })}</div>
          : boot.me.trialUntil && <div className="mb-4 text-[12.5px] text-muted">{fill(c.trial, { date: fmtDate(boot.me.trialUntil, lang) })}</div>}
      <div className="mb-5 inline-flex gap-[3px] rounded-[12px] bg-bg-2 p-[3px]">
        {tabs.map(([k, l]) => <button key={k} type="button" onClick={() => setTab(k)} className={`cursor-pointer rounded-[9px] px-4 py-[8px] text-[13px] font-bold ${tab === k ? "bg-surface text-ink shadow-[0_1px_3px_rgba(20,36,63,.12)]" : "text-muted hover:text-ink"}`}>{l}</button>)}
      </div>
      {tab === "clients" && <ClientsTab />}
      {tab === "deals" && <DealsTab />}
      {tab === "tasks" && <TasksTab />}
      {tab === "settings" && <CrmSettings />}
    </CrmCtx.Provider>
  );
}

// ---------- клиенты ----------
function ClientsTab() {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [owner, setOwner] = useState<string>("");
  const [list, setList] = useState<Client[] | null>(null);
  const [modal, setModal] = useState(false);
  const ro = crm.me.access !== "full";
  const load = useCallback(() => { listClients({ q, status, ownerId: owner || null }).then(setList).catch(() => setList([])); }, [q, status, owner]);
  useEffect(() => { const h = setTimeout(load, q ? 250 : 0); return () => clearTimeout(h); }, [load, q]);
  const srcOf = (id: string | null) => sourceName(crm.sources.find((s) => s.id === id), t);
  const memberOf = (id: string | null) => crm.me.members.find((m) => m.id === id);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1 max-w-[420px]"><IconSearch size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.search} className={`${inp} pl-9`} /></div>
        <Select value={status} onChange={(v) => setStatus(v as "active" | "archived")} options={[{ value: "active", label: c.active }, { value: "archived", label: c.archived }]} className="w-[150px]" size="sm" />
        {crm.me.members.length > 1 && <Select value={owner} onChange={setOwner} options={[{ value: "", label: c.all }, ...crm.me.members.map((m) => ({ value: m.id, label: m.name }))]} className="w-[200px]" size="sm" />}
        <div className="flex-1" />
        <button type="button" onClick={() => setModal(true)} disabled={ro} className={btnP}><IconPlus size={16} /> {c.addClient}</button>
      </div>
      {list === null ? <div className="py-10 text-center text-[13px] text-muted">…</div>
        : list.length === 0 ? <div className={`${card} text-center text-[13.5px] text-muted`}>{q ? c.notFound : c.noClients}</div>
        : (
          <div className="flex flex-col gap-2">
            {list.map((cl) => {
              const main = cl.contacts.find((x) => x.isMain) ?? cl.contacts[0];
              const m = memberOf(cl.ownerId);
              return (
                <Link key={cl.id} href={`${crm.base}/${cl.id}`} className="grid cursor-pointer grid-cols-[40px_1.4fr_1fr_1fr_1fr_auto] items-center gap-3 rounded-[14px] border border-line bg-surface px-4 py-3 shadow-[0_1px_3px_rgba(20,36,63,.05)] hover:shadow-[0_8px_24px_rgba(20,36,63,.1)] max-md:grid-cols-[40px_1fr_auto]">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-tint text-[13px] font-extrabold text-sel-ink">{initials(cl.name)}</span>
                  <div className="min-w-0"><div className="truncate text-[14.5px] font-bold text-ink">{cl.name}</div><div className="mt-[2px] flex flex-wrap gap-1">{cl.tags.slice(0, 3).map((x) => <span key={x} className={chip}>{x}</span>)}<span className="text-[11.5px] text-muted">{cl.lang}</span></div></div>
                  <div className="truncate text-[13px] text-text max-md:hidden">{main ? main.value : <span className="text-muted">{c.client.noContacts}</span>}</div>
                  <div className="truncate text-[12.5px] text-muted max-md:hidden">{srcOf(cl.sourceId)}{m && crm.me.members.length > 1 ? ` · ${m.name}` : ""}</div>
                  <div className="truncate text-[12.5px] text-muted max-md:hidden">{cl.nextTask ? <span className={new Date(cl.nextTask.dueAt) < new Date() ? "font-semibold text-red" : ""}><IconCalendarEvent size={13} className="mr-1 inline" />{fmtDT(cl.nextTask.dueAt, lang)} · {cl.nextTask.title}</span> : cl.openDealsN ? `${c.client.deals}: ${cl.openDealsN}` : ""}</div>
                  <div className="text-[11.5px] text-muted">{fmtDate(cl.updatedAt, lang)}</div>
                </Link>
              );
            })}
          </div>
        )}
      <ClientModal open={modal} client={null} onClose={() => setModal(false)} onSaved={(id) => { setModal(false); router.push(`${crm.base}/${id}`); }} onOpenDup={(id) => router.push(`${crm.base}/${id}`)} />
    </>
  );
}

// ---------- сделки ----------
function DealsTab() {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [view, setView] = useState<"board" | "list">("board");
  const [modal, setModal] = useState<{ open: boolean; deal: Deal | null }>({ open: false, deal: null });
  const ro = crm.me.access !== "full";
  const load = useCallback(() => { listDeals().then(setDeals).catch(() => setDeals([])); listClients({}).then((l) => setClients(l.map((x) => ({ id: x.id, name: x.name })))).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  async function move(d: Deal, stageId: string) {
    const st = crm.stages.find((s) => s.id === stageId);
    let reason: string | undefined;
    if (st?.kind === "lost") { reason = window.prompt(c.deal.lostPh) ?? undefined; }
    try { await moveDeal(d.id, stageId, reason); load(); } catch (e) { showToast((e as Error).message === "readonly" ? c.errReadonly : c.errSave); }
  }
  const byStage = useMemo(() => { const m = new Map<string, Deal[]>(); (deals ?? []).forEach((d) => { const k = d.stageId ?? ""; m.set(k, [...(m.get(k) ?? []), d]); }); return m; }, [deals]);
  const sum = (list: Deal[]) => { const by: Record<string, number> = {}; list.forEach((d) => { if (d.amount) by[d.cur] = (by[d.cur] ?? 0) + d.amount; }); return Object.entries(by).map(([cur, v]) => fmt(v, cur as Currency)).join(" · "); };
  const dealCard = (d: Deal) => (
    <div className="rounded-[12px] border border-line bg-surface p-3 shadow-[0_1px_3px_rgba(20,36,63,.05)]">
      <button type="button" onClick={() => setModal({ open: true, deal: d })} className="block w-full cursor-pointer text-left"><div className="text-[13.5px] font-bold text-ink">{d.title || "—"}</div>
        <Link href={`${crm.base}/${d.clientId}`} onClick={(e) => e.stopPropagation()} className="mt-[2px] inline-flex items-center gap-1 text-[12.5px] text-blue-2 hover:underline"><IconUser size={12} /> {d.clientName}</Link>
        {d.amount != null && <div className="mt-1 text-[13px] font-extrabold text-ink">{fmt(d.amount, d.cur as Currency)}</div>}
      </button>
      <div className="mt-2"><Select value={d.stageId ?? ""} onChange={(v) => move(d, v)} options={crm.stages.map((s) => ({ value: s.id, label: stageName(s, t, lang) }))} size="sm" disabled={ro} /></div>
    </div>
  );
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="inline-flex gap-[3px] rounded-[10px] bg-bg-2 p-[3px]">
          {(["board", "list"] as const).map((v) => <button key={v} type="button" onClick={() => setView(v)} className={`flex h-8 cursor-pointer items-center gap-1 rounded-[8px] px-3 text-[12.5px] font-bold ${view === v ? "bg-surface text-ink shadow-[0_1px_3px_rgba(20,36,63,.12)]" : "text-muted"}`}>{v === "board" ? <IconLayoutKanban size={15} /> : <IconList size={15} />} {v === "board" ? c.deal.board : c.deal.list}</button>)}
        </div>
        <div className="flex-1" />
        <button type="button" onClick={() => setModal({ open: true, deal: null })} disabled={ro || !clients.length} className={btnP}><IconPlus size={16} /> {c.deal.add}</button>
      </div>
      {deals === null ? <div className="py-10 text-center text-[13px] text-muted">…</div>
        : deals.length === 0 ? <div className={`${card} text-center text-[13.5px] text-muted`}>{c.deal.none}</div>
        : view === "board" ? (
          <div className="flex gap-3 overflow-x-auto pb-3">
            {crm.stages.map((st) => { const list = byStage.get(st.id) ?? []; return (
              <div key={st.id} className="w-[260px] flex-none rounded-[14px] bg-bg-2 p-2">
                <div className="mb-2 flex items-center justify-between px-1"><span className="flex items-center gap-2 text-[12.5px] font-extrabold text-ink"><span className="h-[9px] w-[9px] rounded-full" style={{ background: st.color ?? "#8a93a2" }} />{stageName(st, t, lang)} <span className="text-muted">{list.length}</span></span><span className="text-[11px] text-muted">{sum(list)}</span></div>
                <div className="flex flex-col gap-2">{list.map((d) => <div key={d.id}>{dealCard(d)}</div>)}</div>
              </div>); })}
            {(byStage.get("") ?? []).length > 0 && <div className="w-[260px] flex-none rounded-[14px] bg-bg-2 p-2"><div className="mb-2 px-1 text-[12.5px] font-extrabold text-muted">{c.deal.noStage}</div><div className="flex flex-col gap-2">{(byStage.get("") ?? []).map((d) => <div key={d.id}>{dealCard(d)}</div>)}</div></div>}
          </div>
        ) : (
          <div className={`${card} overflow-x-auto p-0`}>
            <table className="w-full text-[13px]"><thead><tr className="text-left text-[11px] uppercase tracking-[.04em] text-muted">{[c.deal.title, c.deal.client, c.deal.stage, c.deal.amount, c.owner, c.client.updated].map((h) => <th key={h} className="px-4 py-3 font-bold">{h}</th>)}</tr></thead>
              <tbody>{deals.map((d) => <tr key={d.id} className="border-t border-line hover:bg-bg-3"><td className="px-4 py-3"><button type="button" onClick={() => setModal({ open: true, deal: d })} className="cursor-pointer font-bold text-ink hover:text-blue-2">{d.title || "—"}</button></td><td className="px-4 py-3"><Link href={`${crm.base}/${d.clientId}`} className="text-blue-2 hover:underline">{d.clientName}</Link></td><td className="px-4 py-3"><Select value={d.stageId ?? ""} onChange={(v) => move(d, v)} options={crm.stages.map((s) => ({ value: s.id, label: stageName(s, t, lang) }))} size="sm" className="w-[170px]" disabled={ro} /></td><td className="px-4 py-3 font-semibold">{d.amount != null ? fmt(d.amount, d.cur as Currency) : ""}</td><td className="px-4 py-3 text-muted">{crm.me.members.find((m) => m.id === d.ownerId)?.name ?? ""}</td><td className="px-4 py-3 text-muted">{fmtDate(d.updatedAt, lang)}</td></tr>)}</tbody></table>
          </div>
        )}
      <DealModal open={modal.open} deal={modal.deal} clients={clients} onClose={() => setModal({ open: false, deal: null })} onSaved={() => { setModal({ open: false, deal: null }); load(); }} />
    </>
  );
}

// ---------- задачи ----------
function TasksTab() {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [showDone, setShowDone] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const ro = crm.me.access !== "full";
  const load = useCallback(() => { listTasks(!showDone).then(setTasks).catch(() => setTasks([])); listClients({}).then((l) => setClients(l.map((x) => ({ id: x.id, name: x.name })))).catch(() => {}); }, [showDone]);
  useEffect(() => { load(); }, [load]);
  const groups = useMemo(() => {
    const now = new Date(); const end = new Date(now); end.setHours(23, 59, 59, 999);
    const g: Record<"overdue" | "today" | "later" | "done", Task[]> = { overdue: [], today: [], later: [], done: [] };
    (tasks ?? []).forEach((x) => { if (x.doneAt) g.done.push(x); else if (new Date(x.dueAt) < now) g.overdue.push(x); else if (new Date(x.dueAt) <= end) g.today.push(x); else g.later.push(x); });
    return g;
  }, [tasks]);
  async function toggle(x: Task) { try { await doneTask(x.id, !x.doneAt); load(); } catch (e) { showToast((e as Error).message === "readonly" ? c.errReadonly : c.errSave); } }
  async function del(x: Task) { if (!(await confirmDialog({ text: c.task.delete + "?", danger: true }))) return; await deleteTask(x.id); load(); }
  const row = (x: Task, over?: boolean) => (
    <div className="flex items-center gap-3 rounded-[12px] border border-line bg-surface px-3 py-[10px]">
      <button type="button" onClick={() => toggle(x)} disabled={ro} className={`flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-full border-2 ${x.doneAt ? "border-green bg-green text-white" : "border-line hover:border-blue"}`}>{x.doneAt && <IconCheck size={14} />}</button>
      <button type="button" onClick={() => setModal({ open: true, task: x })} className="min-w-0 flex-1 cursor-pointer text-left"><div className={`truncate text-[13.5px] font-semibold ${x.doneAt ? "text-muted line-through" : "text-ink"}`}>{x.title}</div><div className="text-[12px] text-muted">{taskKindName(x.kind, t)} · <span className={over ? "font-semibold text-red" : ""}>{fmtDT(x.dueAt, lang)}</span>{x.clientName ? <> · <Link href={`${crm.base}/${x.clientId}`} className="text-blue-2 hover:underline">{x.clientName}</Link></> : null}</div></button>
      <button type="button" onClick={() => del(x)} disabled={ro} className="cursor-pointer text-[12px] text-muted hover:text-red">✕</button>
    </div>
  );
  const sec = (title: string, list: Task[], over?: boolean) => list.length ? <div className="mb-4"><div className={`mb-2 text-[12px] font-extrabold uppercase tracking-[.04em] ${over ? "text-red" : "text-muted"}`}>{title} · {list.length}</div><div className="flex flex-col gap-2">{list.map((x) => <div key={x.id}>{row(x, over)}</div>)}</div></div> : null;
  return (
    <>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <label className="flex cursor-pointer items-center gap-2 text-[13px] text-text"><input type="checkbox" checked={showDone} onChange={(e) => setShowDone(e.target.checked)} /> {c.task.showDone}</label>
        <div className="flex-1" />
        <button type="button" onClick={() => setModal({ open: true, task: null })} disabled={ro} className={btnP}><IconPlus size={16} /> {c.task.add}</button>
      </div>
      {tasks === null ? <div className="py-10 text-center text-[13px] text-muted">…</div>
        : tasks.length === 0 ? <div className={`${card} text-center text-[13.5px] text-muted`}>{c.task.none}</div>
        : <>{sec(c.task.overdue, groups.overdue, true)}{sec(c.task.today, groups.today)}{sec(c.task.later, groups.later)}{sec(c.task.done, groups.done)}</>}
      <TaskModal open={modal.open} task={modal.task} clients={clients} onClose={() => setModal({ open: false, task: null })} onSaved={() => { setModal({ open: false, task: null }); load(); }} />
    </>
  );
}

export const CrmEmptyIcon = IconAddressBook;
export const crmBtnS = btnS;
