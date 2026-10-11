"use client";

// CRM v2 — сделки: канбан с перетаскиванием (HTML5 drag & drop, на тач — выбор этапа в карточке), сумма и счётчик колонки,
// «дней на этапе», фильтр по ответственному; список таблицей как второй режим.
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconCalendarEvent, IconLayoutKanban, IconList, IconPlus, IconUser } from "@tabler/icons-react";
import { deleteDeal, listClients, listDeals, listTasks, moveDeal } from "@/app/crm/actions";
import { confirmDialog } from "@/components/ui/confirm";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Deal, Task } from "@/lib/crm/types";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { DealModal } from "./CrmModals";
import { btnP, card, fill, fmtDT, fmtDate, initials, setPref, stageName, useCrm, useNow, usePref } from "./crmUi";

const LS = "opl-crm-deals-view";

export function DealsBoard() {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const ro = crm.me.access !== "full";
  const [deals, setDeals] = useState<Deal[] | null>(null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const viewPref = usePref(LS);
  const view: "board" | "list" = viewPref === "list" ? "list" : "board";
  const setView = (v: "board" | "list") => setPref(LS, v);
  const now = useNow();
  const [owner, setOwner] = useState("");
  const [modal, setModal] = useState<{ open: boolean; deal: Deal | null }>({ open: false, deal: null });
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  const load = useCallback(() => {
    listDeals().then(setDeals).catch(() => setDeals([]));
    listTasks(true).then(setTasks).catch(() => {});
    listClients({}).then((l) => setClients(l.map((x) => ({ id: x.id, name: x.name })))).catch(() => {});
  }, []);
  useEffect(() => { load(); }, [load]);
  const err = (e: unknown) => showToast((e as Error).message === "readonly" ? c.errReadonly : c.errSave);
  async function move(d: Deal, stageId: string) {
    if (d.stageId === stageId) return;
    const st = crm.stages.find((s) => s.id === stageId);
    const reason = st?.kind === "lost" ? window.prompt(c.deal.lostPh) ?? undefined : undefined;
    setDeals((v) => (v ?? []).map((x) => (x.id === d.id ? { ...x, stageId } : x))); // оптимистично
    try { await moveDeal(d.id, stageId, reason); load(); } catch (e) { err(e); load(); }
  }
  async function del(d: Deal) { if (!(await confirmDialog({ text: c.deal.delQ, danger: true }))) return; try { await deleteDeal(d.id); load(); } catch (e) { err(e); } }
  const shown = useMemo(() => (deals ?? []).filter((d) => !owner || d.ownerId === owner), [deals, owner]);
  const byStage = useMemo(() => { const m = new Map<string, Deal[]>(); shown.forEach((d) => { const k = d.stageId ?? ""; m.set(k, [...(m.get(k) ?? []), d]); }); return m; }, [shown]);
  const sum = (list: Deal[]) => { const by: Record<string, number> = {}; list.forEach((d) => { if (d.amount) by[d.cur] = (by[d.cur] ?? 0) + d.amount; }); return Object.entries(by).map(([cur, v]) => fmt(v, cur as Currency)).join(" · "); };
  const taskOf = (d: Deal) => tasks.find((x) => x.dealId === d.id) ?? tasks.find((x) => x.clientId === d.clientId);
  const days = (d: Deal) => (now ? Math.max(0, Math.round((now - new Date(d.updatedAt).getTime()) / 864e5)) : 0);

  const DealCard = (d: Deal) => {
    const tk = taskOf(d); const m = crm.me.members.find((x) => x.id === d.ownerId);
    return (
      <div draggable={!ro} onDragStart={(e) => { setDragId(d.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", d.id); }} onDragEnd={() => { setDragId(null); setOver(null); }}
        className={`cursor-grab rounded-[12px] border border-line bg-surface p-3 shadow-[0_1px_3px_rgba(20,36,63,.05)] transition hover:shadow-[0_8px_24px_rgba(20,36,63,.1)] active:cursor-grabbing ${dragId === d.id ? "opacity-40" : ""}`}>
        <button type="button" onClick={() => setModal({ open: true, deal: d })} className="block w-full cursor-pointer text-left">
          <div className="text-[13.5px] font-bold leading-[1.3] text-ink">{d.title || "—"}</div>
          <Link href={`${crm.base}/c/${d.clientId}`} onClick={(e) => e.stopPropagation()} className="mt-[3px] inline-flex items-center gap-1 text-[12px] text-blue-2 hover:underline"><IconUser size={11} /> {d.clientName}</Link>
          {d.amount != null && <div className="mt-[6px] text-[14px] font-extrabold text-ink">{fmt(d.amount, d.cur as Currency)}</div>}
        </button>
        <div className="mt-2 flex items-center gap-2 text-[11px] text-muted">
          {m && <span title={m.name} className="flex h-6 w-6 items-center justify-center rounded-full text-[9.5px] font-extrabold text-white" style={{ background: m.color }}>{initials(m.name)}</span>}
          <span>{fill(c.kb.days, { n: days(d) })}</span>
          <span className="flex-1" />
          {tk && <span className={`inline-flex items-center gap-1 ${new Date(tk.dueAt).getTime() < now ? "font-bold text-red" : ""}`}><IconCalendarEvent size={12} />{fmtDate(tk.dueAt, lang)}</span>}
        </div>
        <div className="mt-2 md:hidden"><Select value={d.stageId ?? ""} onChange={(v) => move(d, v)} options={crm.stages.map((s) => ({ value: s.id, label: stageName(s, t, lang) }))} size="sm" disabled={ro} /></div>
      </div>
    );
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="mr-2 text-[20px] font-extrabold tracking-[-0.02em] text-ink">{c.nav.deals} <span className="text-[14px] font-semibold text-muted">{shown.length}</span></h1>
        <div className="inline-flex gap-[3px] rounded-[10px] bg-bg-2 p-[3px]">
          {(["board", "list"] as const).map((v) => <button key={v} type="button" onClick={() => setView(v)} className={`flex h-8 cursor-pointer items-center gap-1 rounded-[8px] px-3 text-[12.5px] font-bold ${view === v ? "bg-surface text-ink shadow-[0_1px_3px_rgba(20,36,63,.12)]" : "text-muted"}`}>{v === "board" ? <IconLayoutKanban size={15} /> : <IconList size={15} />} {v === "board" ? c.deal.board : c.deal.list}</button>)}
        </div>
        {crm.me.members.length > 1 && <Select value={owner} onChange={setOwner} options={[{ value: "", label: c.kb.all }, { value: crm.me.meId, label: c.kb.mine }, ...crm.me.members.filter((m) => m.id !== crm.me.meId).map((m) => ({ value: m.id, label: m.name }))]} className="w-[180px]" size="sm" />}
        <div className="flex-1" />
        <button type="button" onClick={() => setModal({ open: true, deal: null })} disabled={ro || !clients.length} className={btnP}><IconPlus size={15} /> {c.deal.add}</button>
      </div>
      {deals === null ? <div className="py-12 text-center text-[13px] text-muted">…</div> : view === "board" ? (
        <div data-crm-kanban="1" className="flex gap-3 overflow-x-auto pb-3" style={{ minHeight: "calc(100vh - 220px)" }}>
          {crm.stages.map((st) => { const list = byStage.get(st.id) ?? []; return (
            <div key={st.id} onDragOver={(e) => { if (!dragId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== st.id) setOver(st.id); }} onDragLeave={() => setOver((o) => (o === st.id ? null : o))} onDrop={(e) => { e.preventDefault(); const id = dragId ?? e.dataTransfer.getData("text/plain"); const d = (deals ?? []).find((x) => x.id === id); setOver(null); setDragId(null); if (d) move(d, st.id); }}
              className={`flex w-[272px] flex-none flex-col rounded-[14px] bg-bg-2 p-2 transition ${over === st.id ? "crm-drag-over" : ""}`}>
              <div className="mb-2 flex items-center justify-between px-1">
                <span className="flex items-center gap-2 text-[12.5px] font-extrabold text-ink"><span className="h-[9px] w-[9px] rounded-full" style={{ background: st.color ?? "#8a93a2" }} />{stageName(st, t, lang)} <span className="rounded-[7px] bg-surface px-[6px] text-[11px] text-muted">{list.length}</span></span>
                <span className="text-[11px] font-semibold text-muted">{sum(list)}</span>
              </div>
              <div className="flex min-h-[80px] flex-1 flex-col gap-2">{list.map((d) => <div key={d.id}>{DealCard(d)}</div>)}{list.length === 0 && <div className="flex flex-1 items-center justify-center rounded-[10px] border border-dashed border-line-4 text-[11.5px] text-muted">{c.kb.empty}</div>}</div>
            </div>); })}
          {(byStage.get("") ?? []).length > 0 && <div className="flex w-[272px] flex-none flex-col rounded-[14px] bg-bg-2 p-2"><div className="mb-2 px-1 text-[12.5px] font-extrabold text-muted">{c.deal.noStage}</div><div className="flex flex-col gap-2">{(byStage.get("") ?? []).map((d) => <div key={d.id}>{DealCard(d)}</div>)}</div></div>}
        </div>
      ) : (
        <div className={`${card} overflow-x-auto p-0`}>
          {shown.length === 0 ? <div className="py-12 text-center text-[13.5px] text-muted">{c.deal.none}</div> : (
            <table data-crm-table="1" className="w-full min-w-[720px] text-[13px]"><thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-[.04em] text-muted">{[c.deal.title, c.deal.client, c.deal.stage, c.deal.amount, c.owner, c.tbl.task, c.client.updated, ""].map((h, i) => <th key={i} className="px-3 py-[10px] font-bold">{h}</th>)}</tr></thead>
              <tbody>{shown.map((d) => { const tk = taskOf(d); return <tr key={d.id} className="border-b border-line last:border-b-0 hover:bg-bg-3"><td className="px-3 py-[9px]"><button type="button" onClick={() => setModal({ open: true, deal: d })} className="cursor-pointer font-bold text-ink hover:text-blue-2">{d.title || "—"}</button></td><td className="px-3 py-[9px]"><Link href={`${crm.base}/c/${d.clientId}`} className="text-blue-2 hover:underline">{d.clientName}</Link></td><td className="px-3 py-[9px]"><Select value={d.stageId ?? ""} onChange={(v) => move(d, v)} options={crm.stages.map((s) => ({ value: s.id, label: stageName(s, t, lang) }))} size="sm" className="w-[170px]" disabled={ro} /></td><td className="px-3 py-[9px] font-semibold">{d.amount != null ? fmt(d.amount, d.cur as Currency) : ""}</td><td className="px-3 py-[9px] text-muted">{crm.me.members.find((m) => m.id === d.ownerId)?.name ?? ""}</td><td className="px-3 py-[9px] text-muted">{tk ? `${fmtDT(tk.dueAt, lang)} · ${tk.title}` : "—"}</td><td className="px-3 py-[9px] text-muted">{fmtDate(d.updatedAt, lang)}</td><td className="px-3 py-[9px] text-right"><button type="button" onClick={() => del(d)} disabled={ro} className="cursor-pointer text-[12px] text-muted hover:text-red">✕</button></td></tr>; })}</tbody></table>
          )}
        </div>
      )}
      <DealModal open={modal.open} deal={modal.deal} clients={clients} onClose={() => setModal({ open: false, deal: null })} onSaved={() => { setModal({ open: false, deal: null }); load(); }} />
    </>
  );
}
