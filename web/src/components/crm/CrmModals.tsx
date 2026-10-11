"use client";

// Модалки сделки и задачи.
import { useState } from "react";
import { saveDeal, saveTask } from "@/app/crm/actions";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Deal, DealInput, Task, TaskInput, TaskKind } from "@/lib/crm/types";
import { btnP, btnS, fromLocalInput, inp, lbl, sourceName, stageName, taskKindName, toLocalInput, useCrm } from "./crmUi";
import { DuePicker } from "./DuePicker";

type ClientOpt = { id: string; name: string };

type DealProps = { open: boolean; deal: Deal | null; clients: ClientOpt[]; clientId?: string | null; requests?: { id: string; label: string }[]; onClose: () => void; onSaved: () => void };
export function DealModal(props: DealProps) {
  return <Modal open={props.open} onClose={props.onClose} width={520}>{props.open && <DealForm key={props.deal?.id ?? "new"} {...props} />}</Modal>;
}
function DealForm({ deal, clients, clientId, requests, onClose, onSaved }: DealProps) {
  const { t, lang } = useI18n();
  const crm = useCrm();
  const c = t.crm;
  const [f, setF] = useState<DealInput>(() => deal
    ? { clientId: deal.clientId, title: deal.title, deal: deal.deal, amount: deal.amount, cur: deal.cur, stageId: deal.stageId, ownerId: deal.ownerId, listingId: deal.listingId, projectId: deal.projectId, unitUid: deal.unitUid, selectionId: deal.selectionId, sourceId: deal.sourceId, requestId: deal.requestId, commission: deal.commission, commissionKind: deal.commissionKind, deposit: deal.deposit, depositAt: deal.depositAt }
    : { clientId: clientId ?? clients[0]?.id ?? "", title: "", deal: "sale", amount: null, cur: "TRY", stageId: crm.stages.find((s) => s.kind === "open")?.id ?? null, ownerId: crm.me.meId, listingId: null, projectId: null, unitUid: null, selectionId: null, sourceId: null, requestId: requests?.[0]?.id ?? null, commission: null, commissionKind: "pct", deposit: null, depositAt: null });
  const [obj, setObj] = useState(() => (deal ? deal.listingId ?? (deal.projectId ? `${deal.projectId}${deal.unitUid != null ? `#${deal.unitUid}` : ""}` : "") : ""));
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<DealInput>) => setF((v) => ({ ...v, ...p }));

  async function submit() {
    if (!f.title.trim()) { showToast(c.needTitle); return; }
    if (!f.clientId) { showToast(c.deal.pickClient); return; }
    setBusy(true);
    try {
      // объект: у риэлтора — ссылка/id объявления, у застройщика — "<проект>#<квартира>"
      const o = obj.trim();
      const m = o.match(/\/obj\/([^/?#]+)/);
      const listingId = crm.me.ws.kind === "realtor" ? (m ? m[1] : o || null) : null;
      let projectId: string | null = null, unitUid: number | null = null;
      if (crm.me.ws.kind === "developer" && o) { const [p, u] = o.split("#"); projectId = p || null; unitUid = u ? +u || null : null; }
      await saveDeal({ ...f, listingId, projectId, unitUid }, deal?.id ?? null);
      onSaved();
    } catch (e) { showToast((e as Error).message === "readonly" ? c.errReadonly : c.errSave); }
    finally { setBusy(false); }
  }
  return (
    <div data-crm-form="1">
      <div className="mb-4 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{deal ? deal.title || c.deal.add : c.deal.add}</div><ModalClose onClick={onClose} /></div>
      <label className={lbl}>{c.deal.client}</label>
      <Select value={f.clientId} onChange={(v) => set({ clientId: v })} placeholder={c.deal.pickClient} searchable options={clients.map((x) => ({ value: x.id, label: x.name }))} disabled={!!deal} />
      <label className={`${lbl} mt-3`}>{c.deal.title}</label>
      <input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder={c.deal.titlePh} className={inp} autoFocus />
      <div className="mt-3 grid grid-cols-[1fr_1fr] gap-2">
        <div><label className={lbl}>{t.cat.dealT}</label><Select value={f.deal} onChange={(v) => set({ deal: v })} options={(["sale", "rent", "daily"] as const).map((d) => ({ value: d, label: t.deal[d] }))} /></div>
        <div><label className={lbl}>{c.deal.stage}</label><Select value={f.stageId ?? ""} onChange={(v) => set({ stageId: v || null })} options={crm.stages.map((s) => ({ value: s.id, label: stageName(s, t, lang) }))} /></div>
      </div>
      <label className={`${lbl} mt-3`}>{c.deal.amount}</label>
      <div className="grid grid-cols-[1fr_110px] gap-2">
        <input inputMode="numeric" value={f.amount ?? ""} onChange={(e) => set({ amount: e.target.value ? +e.target.value.replace(/\D/g, "") : null })} className={inp} />
        <Select value={f.cur} onChange={(v) => set({ cur: v })} options={["TRY", "EUR", "USD"].map((x) => ({ value: x, label: x }))} />
      </div>
      <label className={`${lbl} mt-3`}>{c.deal.object}</label>
      <input value={obj} onChange={(e) => setObj(e.target.value)} placeholder={c.deal.objectPh} className={inp} />
      {requests && requests.length > 0 && <><label className={`${lbl} mt-3`}>{c.deal.request}</label><Select value={f.requestId ?? ""} onChange={(v) => set({ requestId: v || null })} options={[{ value: "", label: c.deal.noRequest }, ...requests.map((r) => ({ value: r.id, label: r.label }))]} /></>}
      {/* комиссия и задаток (0017) */}
      <div className="mt-3 grid grid-cols-[1fr_110px_1fr_1fr] gap-2 max-md:grid-cols-2">
        <div><label className={lbl}>{c.deal.commission}</label><input inputMode="decimal" value={f.commission ?? ""} onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, "").replace(",", "."); set({ commission: v ? Number(v) : null }); }} className={inp} /></div>
        <div><label className={lbl}>&nbsp;</label><Select value={f.commissionKind ?? "pct"} onChange={(v) => set({ commissionKind: v as "pct" | "sum" })} options={[{ value: "pct", label: c.deal.commissionPct }, { value: "sum", label: c.deal.commissionSum }]} /></div>
        <div><label className={lbl}>{c.deal.deposit}</label><input inputMode="numeric" value={f.deposit ?? ""} onChange={(e) => set({ deposit: e.target.value ? +e.target.value.replace(/\D/g, "") : null })} className={inp} /></div>
        <div><label className={lbl}>{c.deal.depositAt}</label><input type="date" value={f.depositAt ?? ""} onChange={(e) => set({ depositAt: e.target.value || null })} className={inp} /></div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <div><label className={lbl}>{c.source}</label><Select value={f.sourceId ?? ""} onChange={(v) => set({ sourceId: v || null })} options={[{ value: "", label: c.noSource }, ...crm.sources.filter((s) => s.active).map((s) => ({ value: s.id, label: sourceName(s, t) }))]} /></div>
        {crm.me.members.length > 1 && <div><label className={lbl}>{c.owner}</label><Select value={f.ownerId ?? ""} onChange={(v) => set({ ownerId: v || null })} options={crm.me.members.map((m) => ({ value: m.id, label: m.name }))} /></div>}
      </div>
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className={btnS}>{c.cancel}</button><button type="button" onClick={submit} disabled={busy} className={btnP}>{deal ? c.save : c.create}</button></div>
    </div>
  );
}

type TaskProps = { open: boolean; task: Task | null; clients: ClientOpt[]; clientId?: string | null; dealId?: string | null; onClose: () => void; onSaved: () => void };
export function TaskModal(props: TaskProps) {
  return <Modal open={props.open} onClose={props.onClose} width={480}>{props.open && <TaskForm key={props.task?.id ?? "new"} {...props} />}</Modal>;
}
function TaskForm({ task, clients, clientId, dealId, onClose, onSaved }: TaskProps) {
  const { t } = useI18n();
  const crm = useCrm();
  const c = t.crm;
  const [f, setF] = useState<TaskInput>(() => task
    ? { clientId: task.clientId, dealId: task.dealId, ownerId: task.ownerId, kind: task.kind, title: task.title, dueAt: task.dueAt }
    : { clientId: clientId ?? null, dealId: dealId ?? null, ownerId: crm.me.meId, kind: "call", title: "", dueAt: fromLocalInput(toLocalInput(null)) });
  const [due, setDue] = useState(() => task?.dueAt ?? fromLocalInput(toLocalInput(null)));
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<TaskInput>) => setF((v) => ({ ...v, ...p }));
  async function submit() {
    if (!f.title.trim()) { showToast(c.needTitle); return; }
    setBusy(true);
    try { await saveTask({ ...f, dueAt: due || new Date().toISOString() }, task?.id ?? null); onSaved(); }
    catch (e) { showToast((e as Error).message === "readonly" ? c.errReadonly : c.errSave); }
    finally { setBusy(false); }
  }
  const kinds: TaskKind[] = ["call", "show", "meeting", "message", "other"];
  return (
    <div data-crm-form="1">
      <div className="mb-4 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{c.task.add}</div><ModalClose onClick={onClose} /></div>
      <label className={lbl}>{c.task.title}</label>
      <input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder={c.task.titlePh} className={inp} autoFocus />
      <label className={`${lbl} mt-3`}>{c.task.kind}</label>
      <div className="flex flex-wrap gap-[6px]">{kinds.map((k) => <button key={k} type="button" onClick={() => set({ kind: k })} className={`h-7 cursor-pointer rounded-full border px-3 text-[12px] font-medium ${f.kind === k ? "border-ink bg-ink text-white" : "border-line bg-surface text-text hover:bg-bg-3"}`}>{taskKindName(k, t)}</button>)}</div>
      <label className={`${lbl} mt-3`}>{c.task.due}</label>
      <DuePicker value={due} onChange={setDue} />
      {!clientId && <><label className={`${lbl} mt-3`}>{c.deal.client}</label><Select value={f.clientId ?? ""} onChange={(v) => set({ clientId: v || null })} searchable options={[{ value: "", label: "—" }, ...clients.map((x) => ({ value: x.id, label: x.name }))]} /></>}
      {crm.me.members.length > 1 && <><label className={`${lbl} mt-3`}>{c.owner}</label><Select value={f.ownerId ?? ""} onChange={(v) => set({ ownerId: v || null })} options={crm.me.members.map((m) => ({ value: m.id, label: m.name }))} /></>}
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className={btnS}>{c.cancel}</button><button type="button" onClick={submit} disabled={busy} className={btnP}>{task ? c.save : c.create}</button></div>
    </div>
  );
}
