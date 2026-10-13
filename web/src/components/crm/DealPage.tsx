"use client";

// Карточка сделки (13.10.2026, «почему сделки не выглядят как клиенты»): та же схема, что у клиента — шапка (название · D-номер,
// клиент, этап, сумма, ответственный, Редактировать/Удалить), слева данные сделки, объект, документы, задачи, справа лента
// активности с комментарием. Открывается во вкладке из канбана/списка сделок и из карточки клиента; редактирование — модалкой.
import Link from "next/link";
import { DealStageChip } from "./ChipMenu";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IconPencil, IconPlus, IconTrash } from "@tabler/icons-react";
import { addNote, deleteDeal, doneTask, getDeal, moveDeal, patchDealOwner } from "@/app/crm/actions";
import { confirmDialog } from "@/components/ui/confirm";
import { Select } from "@/components/ui/Select";
import { showUndo } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { clientNo, dealNo, type CrmEvent, type Deal, type Task, type UnitBrief } from "@/lib/crm/types";
import type { ListingBrief } from "@/app/crm/actions";
import { Timeline } from "./ClientPage";
import { offerCloseObject } from "./closeObject";
import { DealModal, TaskModal } from "./CrmModals";
import { DocsPanel } from "./DocsPanel";
import { getCompanies, type CompanyProfile } from "@/app/crm/doc-actions";
import { dealRef, ObjCard, type Briefs } from "./ObjCard";
import { crmError, btnP, btnS, cacheGet, cacheSet, card, chip, fill, fmtDT, fmtDate, inp, stageName, taskKindName, useCrm } from "./crmUi";

type DealData = { deal: Deal; client: { id: string; no: number; name: string; phone: string | null; lang: string }; events: CrmEvent[]; tasks: Task[]; objs: Record<string, ListingBrief>; units: Record<string, UnitBrief>; requests: { id: string; label: string }[] };

export function DealPage({ id }: { id: string }) {
  const { t, lang } = useI18n();
  const c = t.crm; const dc = c.dealCard;
  const crm = useCrm();
  const router = useRouter();
  const ro = crm.me.access !== "full";
  const key = `${crm.base}:deal:${id}`;
  const [data, setData] = useState<DealData | null | undefined>(() => cacheGet<DealData>(key));
  const [edit, setEdit] = useState(false);
  const [taskM, setTaskM] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [note, setNote] = useState("");
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  useEffect(() => { let on = true; getCompanies().then((l) => { if (on) setCompanies(l); }).catch(() => {}); return () => { on = false; }; }, []);
  const load = useCallback(() => {
    getDeal(id).then((d) => { setData(d); if (d) { cacheSet(key, d); crm.openTab?.(`d:${d.deal.id}`, d.deal.title || dealNo(d.deal)); } else crm.closeTab?.(`d:${id}`); }).catch(() => { setData(null); crm.closeTab?.(`d:${id}`); });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, key]);
  useEffect(() => { load(); }, [load]);
  const err = (e: unknown) => crmError(e, c.errSave, c.errReadonly);

  if (data === undefined) return <div className="py-10 text-center text-[13px] text-muted">…</div>;
  if (data === null) return <div className={card}>{c.notFound} · <Link href={`${crm.base}/deals`} className="text-blue-2">{c.nav.deals}</Link></div>;
  const { deal: d, client: cl, events, tasks, requests } = data;
  const briefs: Briefs = { objs: data.objs, units: data.units };
  const st = crm.stages.find((s) => s.id === d.stageId);
  const owner = crm.me.members.find((m) => m.id === d.ownerId);
  const ref = dealRef(d);
  const openTasks = tasks.filter((x) => !x.doneAt);
  const stCol = d.closedAt ? (st?.kind === "won" ? "#0f9d6b" : "#e5484d") : st?.color ?? "#8a93a2";

  async function move(stageId: string) {
    const s2 = crm.stages.find((s) => s.id === stageId);
    const reason = s2?.kind === "lost" ? window.prompt(crm.me.lostReasons.length ? `${c.deal.lostPh}\n${crm.me.lostReasons.map((x, i) => `${i + 1}. ${x}`).join("\n")}` : c.deal.lostPh) ?? undefined : undefined;
    const picked = reason && /^\d+$/.test(reason.trim()) ? crm.me.lostReasons[+reason.trim() - 1] ?? reason : reason;
    const prev = d.stageId;
    setData((x) => (x ? { ...x, deal: { ...x.deal, stageId, closedAt: s2?.kind === "open" ? null : x.deal.closedAt ?? new Date().toISOString() } } : x));
    try {
      await moveDeal(d.id, stageId, picked); load();
      if (prev && s2?.kind === "open") showUndo(fill(c.undo.moved, { stage: stageName(s2, t, lang) }), async () => { await moveDeal(d.id, prev); load(); }, c.undo.undo);
      if (s2?.kind === "won") await offerCloseObject(d, crm.me.ws.kind, t);
    } catch (e) { err(e); load(); }
  }
  async function del() {
    if (!(await confirmDialog({ text: c.deal.delQ, danger: true }))) return;
    try { await deleteDeal(d.id); crm.closeTab?.(`d:${d.id}`); router.push(`${crm.base}/deals`); } catch (e) { err(e); }
  }
  async function sendNote() { if (!note.trim()) return; try { await addNote(cl.id, d.id, "note", note); setNote(""); load(); } catch (e) { err(e); } }
  const field = (l: string, v?: string | null) => v ? <div key={l} className="min-w-0"><div className="text-[11px] font-medium text-muted">{l}</div><div className="truncate text-[13px] text-ink">{v}</div></div> : null;
  const money = (n: number | null | undefined) => (n != null ? fmt(n, d.cur as Currency) : null);

  return (
    <>
      <div className="-mx-4 -mt-4 mb-4 flex flex-wrap items-center gap-4 border-b border-line bg-surface px-5 py-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: stCol }}>{initialsOf(d.title || dealNo(d))}</span>
        <div className="min-w-[220px] flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-[17px] font-semibold text-ink">{d.title || "—"}</h1><span className="text-[14px] text-muted" title={d.id}>· {dealNo(d)}</span><span className={chip}>{t.deal[d.deal as keyof typeof t.deal]}</span></div>
          <div className="mt-[2px] truncate text-[13px] text-text"><Link href={`${crm.base}/c/${cl.id}`} className="font-medium text-blue-2 hover:underline">{cl.name}</Link> · {clientNo(cl)}{cl.phone ? ` · ${cl.phone}` : ""}{owner ? ` · ${owner.name}` : ""}</div>
        </div>
        <span className="inline-flex items-center gap-[6px]"><span className="text-[11.5px] font-semibold uppercase tracking-[.04em] text-muted">{c.deal.stage}</span><DealStageChip deal={d} onChange={move} disabled={ro} size="md" /></span>
        {crm.me.members.length > 1 && <span className="inline-flex items-center gap-[6px]"><span className="text-[11.5px] font-semibold uppercase tracking-[.04em] text-muted">{c.owner}</span><Select value={d.ownerId ?? ""} onChange={async (v) => { setData((x) => (x ? { ...x, deal: { ...x.deal, ownerId: v || null } } : x)); try { await patchDealOwner(d.id, v || null); } catch (e) { err(e); load(); } }} options={crm.me.members.map((m) => ({ value: m.id, label: m.name }))} size="sm" menuWidth="auto" className="w-[170px]" disabled={ro} /></span>}
        <div className="text-[18px] font-semibold text-ink">{money(d.amount) ?? "—"}</div>
        <button type="button" onClick={() => setEdit(true)} disabled={ro} className={btnS}><IconPencil size={14} /> {c.client.edit}</button>
        <button type="button" onClick={del} disabled={ro} title={c.deal.delete} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-red-tint hover:text-red"><IconTrash size={15} /></button>
      </div>

      <div className="grid grid-cols-[1fr_460px] gap-4 max-[1100px]:grid-cols-1">
        <div className="flex min-w-0 flex-col gap-4">
          <div className={card}>
            <div className="mb-3 text-[13px] font-semibold text-ink">{c.card.info}</div>
            <div className="grid grid-cols-4 gap-x-4 gap-y-3 max-md:grid-cols-2">
              {field(c.deal.company, companies.find((x) => x.id === d.companyProfileId)?.label ?? companies.find((x) => x.id === d.companyProfileId)?.fields.name ?? null)}
              {field(c.deal.buyer, cl.name)}{field(c.deal.seller, d.sellerName ?? (crm.me.ws.kind === "developer" ? c.deal.sellerDev : null))}
              {field(dc.type, t.deal[d.deal as keyof typeof t.deal])}{field(c.deal.amount, money(d.amount))}
              {field(c.deal.commission, d.commission != null ? (d.commissionKind === "pct" ? `${d.commission} %` : money(d.commission)) : null)}
              {field(c.deal.deposit, money(d.deposit))}{field(c.deal.depositAt, d.depositAt ? fmtDate(d.depositAt, lang) : null)}
              {field(c.client.created, fmtDate(d.createdAt, lang))}{field(dc.closed, d.closedAt ? fmtDate(d.closedAt, lang) : null)}{field(c.deal.lost, d.lostReason)}
            </div>
          </div>
          <div className={card}>
            <div className="mb-2 text-[13px] font-semibold text-ink">{c.obj.title}</div>
            {ref ? <ObjCard r={ref} briefs={briefs} /> : <button type="button" onClick={() => setEdit(true)} disabled={ro} className="cursor-pointer text-left text-[12.5px] text-muted hover:text-ink">{c.obj.none} · {c.client.edit}</button>}
            <DocsPanel dealId={d.id} dealKind={d.deal} onChange={load} />
          </div>
          <div className={card}>
            <div className="mb-2 flex items-center justify-between"><div className="text-[13px] font-semibold text-ink">{c.client.tasks} · {openTasks.length}</div><button type="button" onClick={() => setTaskM({ open: true, task: null })} disabled={ro} className={btnS}><IconPlus size={14} /> {c.task.add}</button></div>
            {openTasks.length === 0 ? <div className="text-[12.5px] text-muted">{c.task.none}</div> : <div className="flex flex-col gap-1">{openTasks.map((x) => <div key={x.id} className="flex items-center gap-2 rounded-[6px] border border-line px-2 py-[6px]"><button type="button" onClick={async () => { try { await doneTask(x.id, true); load(); } catch (e) { err(e); } }} disabled={ro} className="h-5 w-5 flex-none cursor-pointer rounded-full border-2 border-line hover:border-blue" /><button type="button" onClick={() => setTaskM({ open: true, task: x })} className="min-w-0 flex-1 cursor-pointer text-left"><div className="truncate text-[12.5px] font-medium text-ink">{x.title}</div><div className={`text-[11px] ${new Date(x.dueAt) < new Date() ? "font-semibold text-red" : "text-muted"}`}>{taskKindName(x.kind, t)} · {fmtDT(x.dueAt, lang)}</div></button></div>)}</div>}
          </div>
        </div>
        <div className={`${card} self-start min-[1101px]:sticky min-[1101px]:top-[160px]`}>
          <div className="mb-2 flex items-center justify-between"><span className="text-[13px] font-semibold text-ink">{c.card.activity}</span><button type="button" onClick={() => setTaskM({ open: true, task: null })} disabled={ro} className={`${btnS} h-7 px-2 text-[12px]`}><IconPlus size={13} /> {c.card.task}</button></div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") sendNote(); }} placeholder={c.ev.addPh} disabled={ro} className={`${inp} h-auto min-h-[84px] w-full resize-y py-2`} />
          <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[11px] text-muted">⌘/Ctrl + Enter</span><button type="button" onClick={sendNote} disabled={ro || !note.trim()} className={btnP}>{c.ev.add}</button></div>
          <div className="mt-4"><Timeline events={events} /></div>
        </div>
      </div>

      <DealModal open={edit} deal={d} clients={[{ id: cl.id, name: cl.name }]} clientId={cl.id} briefs={briefs} requests={requests} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); load(); }} />
      <TaskModal open={taskM.open} task={taskM.task} clients={[{ id: cl.id, name: cl.name }]} clientId={cl.id} dealId={d.id} onClose={() => setTaskM({ open: false, task: null })} onSaved={() => { setTaskM({ open: false, task: null }); load(); }} />
    </>
  );
}
const initialsOf = (s: string) => s.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "D";
