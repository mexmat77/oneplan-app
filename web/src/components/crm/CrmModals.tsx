"use client";

import { kbAutoFocus } from "@/lib/touch";
// Модалки сделки и задачи.
import { useState, useEffect } from "react";
import { saveDeal, saveTask, listClients } from "@/app/crm/actions";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { getCompanies, type CompanyProfile } from "@/app/crm/doc-actions";
import { dealRef, type Briefs } from "./ObjCard";
import { mergeBriefs, ObjectPicker } from "./ObjectPicker";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Deal, DealInput, ObjRef, Task, TaskInput, TaskKind } from "@/lib/crm/types";
import { crmError, btnP, btnS, fromLocalInput, inp, lbl, stageName, taskKindName, toLocalInput, useCrm } from "./crmUi";
import { DuePicker } from "./DuePicker";
import { DateField } from "@/components/ui/DateRange";

type ClientOpt = { id: string; name: string; roles?: string[] };
// в сделке клиент — тот, кто покупает или снимает; продавцы и арендодатели — вторая сторона (13.10.2026, решение пользователя).
// Клиент без ролей попадает в оба списка (роль не заполнена — не прятать).
const isBuyer = (x: ClientOpt) => !x.roles?.length || x.roles.some((r) => r === "buyer" || r === "tenant");
const isSeller = (x: ClientOpt) => !x.roles?.length || x.roles.some((r) => r === "seller" || r === "landlord");

type DealProps = { open: boolean; deal: Deal | null; clients: ClientOpt[]; clientId?: string | null; requests?: { id: string; label: string }[]; briefs?: Briefs; onClose: () => void; onSaved: () => void };
export function DealModal(props: DealProps) {
  return <Modal open={props.open} onClose={props.onClose} width={520}>{props.open && <DealForm key={props.deal?.id ?? "new"} {...props} />}</Modal>;
}
function DealForm({ deal, clients, clientId, requests, briefs: briefs0, onClose, onSaved }: DealProps) {
  const { t, lang } = useI18n();
  const crm = useCrm();
  const c = t.crm;
  const dev = crm.me.ws.kind === "developer";
  // стороны (0027): юрлицо из настроек (реквизиты), продавец — клиент CRM с анкетой (у застройщика продавец — сама компания)
  const [companies, setCompanies] = useState<CompanyProfile[] | null>(null);
  const [sellers, setSellers] = useState<ClientOpt[]>([]);
  useEffect(() => { let on = true; getCompanies().then((l) => { if (on) setCompanies(l); }).catch(() => { if (on) setCompanies([]); }); if (!dev) listClients({}).then((l) => { if (on) setSellers(l.map((x) => ({ id: x.id, name: x.name, roles: x.roles }))); }).catch(() => {}); return () => { on = false; }; }, [dev]);
  const [f, setF] = useState<DealInput>(() => deal
    ? { clientId: deal.clientId, title: deal.title, deal: deal.deal, amount: deal.amount, cur: deal.cur, stageId: deal.stageId, ownerId: deal.ownerId, listingId: deal.listingId, projectId: deal.projectId, unitUid: deal.unitUid, selectionId: deal.selectionId, sourceId: deal.sourceId, requestId: deal.requestId, companyProfileId: deal.companyProfileId, sellerClientId: deal.sellerClientId, commission: deal.commission, commissionKind: deal.commissionKind, deposit: deal.deposit, depositAt: deal.depositAt }
    : { clientId: clientId ?? clients[0]?.id ?? "", title: "", deal: "sale", amount: null, cur: "TRY", stageId: crm.stages.find((s) => s.kind === "open")?.id ?? null, ownerId: crm.me.meId, listingId: null, projectId: null, unitUid: null, selectionId: null, sourceId: null, requestId: requests?.[0]?.id ?? null, companyProfileId: null, sellerClientId: null, commission: null, commissionKind: "pct", deposit: null, depositAt: null });
  // объект (0024): из базы / квартира / свободно — один на сделку
  const [refs, setRefs] = useState<ObjRef[]>(() => { const r = deal ? dealRef(deal) : null; return r ? [r] : []; });
  const [briefs, setBriefs] = useState<Briefs>(briefs0 ?? { objs: {}, units: {} });
  const [busy, setBusy] = useState(false);
  const set = (p: Partial<DealInput>) => setF((v) => ({ ...v, ...p }));

  async function submit() {
    if (!f.title.trim()) { showToast(c.needTitle); return; }
    if (!f.clientId) { showToast(c.deal.pickClient); return; }
    setBusy(true);
    try {
      const r = refs[0] ?? null;
      const listingId = r?.kind === "listing" ? r.id : null;
      const projectId = r?.kind === "unit" ? String(r.projectId) : null;
      const unitUid = r?.kind === "unit" ? r.unitUid : null;
      const objectText = r?.kind === "free" ? (r.url ? `${r.text} · ${r.url}` : r.text) : null;
      const companyProfileId = f.companyProfileId ?? (companies?.find((x) => x.isDefault) ?? companies?.[0])?.id ?? null;
      await saveDeal({ ...f, companyProfileId, listingId, projectId, unitUid, objectText }, deal?.id ?? null);
      onSaved();
    } catch (e) { crmError(e, c.errSave, c.errReadonly); }
    finally { setBusy(false); }
  }
  return (
    <div data-crm-form="1">
      <div className="mb-4 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{deal ? deal.title || c.deal.add : c.deal.add}</div><ModalClose onClick={onClose} /></div>
      <label className={lbl}>{c.deal.company}</label>
      <Select value={f.companyProfileId ?? (companies?.find((x) => x.isDefault) ?? companies?.[0])?.id ?? ""} onChange={(v) => set({ companyProfileId: v || null })} placeholder={companies === null ? "…" : c.deal.noCompany} options={(companies ?? []).map((x) => ({ value: x.id, label: x.label || x.fields.name || "—" }))} disabled={companies === null} />
      {companies && companies.length === 0 && <div className="mt-1 text-[11.5px] text-[#a16207]">{c.deal.noCompanyHint}</div>}
      <div className={`mt-3 grid gap-2 ${dev ? "grid-cols-1" : "grid-cols-2 max-md:grid-cols-1"}`}>
        <div><label className={lbl}>{c.deal.buyer}</label><Select value={f.clientId} onChange={(v) => set({ clientId: v })} placeholder={c.deal.pickClient} searchable options={clients.filter((x) => x.id === f.clientId || isBuyer(x)).map((x) => ({ value: x.id, label: x.name }))} disabled={!!deal} /></div>
        {!dev && <div><label className={lbl}>{c.deal.seller}</label><Select value={f.sellerClientId ?? ""} onChange={(v) => set({ sellerClientId: v || null })} searchable placeholder={c.deal.noSeller} options={[{ value: "", label: c.deal.noSeller }, ...sellers.filter((x) => x.id !== f.clientId && (x.id === f.sellerClientId || isSeller(x))).map((x) => ({ value: x.id, label: x.name }))]} /></div>}
      </div>
      <p className="mt-1 text-[11.5px] text-muted">{dev ? c.deal.partiesDev : c.deal.partiesHint}</p>
      <label className={`${lbl} mt-3`}>{c.deal.title}</label>
      <input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder={c.deal.titlePh} className={inp} autoFocus={kbAutoFocus()} />
      <div className="mt-3 grid grid-cols-[1fr_1fr] gap-2">
        <div><label className={lbl}>{t.cat.dealT}</label><Select value={f.deal} onChange={(v) => set({ deal: v })} options={(["sale", "rent", "daily"] as const).map((d) => ({ value: d, label: t.deal[d] }))} /></div>
        <div><label className={lbl}>{c.deal.stage}</label><Select value={f.stageId ?? ""} onChange={(v) => set({ stageId: v || null })} options={crm.stages.map((s) => ({ value: s.id, label: stageName(s, t, lang), color: s.color ?? undefined }))} /></div>
      </div>
      <label className={`${lbl} mt-3`}>{c.deal.amount}</label>
      <div className="grid grid-cols-[1fr_110px] gap-2">
        <input inputMode="numeric" value={f.amount ?? ""} onChange={(e) => set({ amount: e.target.value ? +e.target.value.replace(/\D/g, "") : null })} className={inp} />
        <Select value={f.cur} onChange={(v) => set({ cur: v })} options={["TRY", "EUR", "USD"].map((x) => ({ value: x, label: x }))} />
      </div>
      <label className={`${lbl} mt-3`}>{c.deal.object}</label>
      <ObjectPicker mode="single" value={refs} onChange={setRefs} briefs={briefs} onBriefs={(add) => setBriefs((b) => mergeBriefs(b, add))} />
      {/* комиссия и задаток (0017) */}
      <div className="mt-3 grid grid-cols-[1fr_110px_1fr_1fr] gap-2 max-md:grid-cols-2">
        <div><label className={lbl}>{c.deal.commission}</label><input inputMode="decimal" value={f.commission ?? ""} onChange={(e) => { const v = e.target.value.replace(/[^\d.,]/g, "").replace(",", "."); set({ commission: v ? Number(v) : null }); }} className={inp} /></div>
        <div><label className={lbl}>&nbsp;</label><Select value={f.commissionKind ?? "pct"} onChange={(v) => set({ commissionKind: v as "pct" | "sum" })} options={[{ value: "pct", label: c.deal.commissionPct }, { value: "sum", label: c.deal.commissionSum }]} /></div>
        <div><label className={lbl}>{c.deal.deposit}</label><input inputMode="numeric" value={f.deposit ?? ""} onChange={(e) => set({ deposit: e.target.value ? +e.target.value.replace(/\D/g, "") : null })} className={inp} /></div>
        <div><label className={lbl}>{c.deal.depositAt}</label><DateField value={f.depositAt ?? ""} onChange={(v) => set({ depositAt: v || null })} /></div>
      </div>
      {crm.me.members.length > 1 && <div className="mt-3 grid grid-cols-2 gap-2">
        <div><label className={lbl}>{c.owner}</label><Select value={f.ownerId ?? ""} onChange={(v) => set({ ownerId: v || null })} options={crm.me.members.map((m) => ({ value: m.id, label: m.name, color: m.color }))} /></div>
      </div>}
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
    catch (e) { crmError(e, c.errSave, c.errReadonly); }
    finally { setBusy(false); }
  }
  const kinds: TaskKind[] = ["call", "show", "meeting", "message", "other"];
  return (
    <div data-crm-form="1">
      <div className="mb-4 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{c.task.add}</div><ModalClose onClick={onClose} /></div>
      <label className={lbl}>{c.task.title}</label>
      <input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder={c.task.titlePh} className={inp} autoFocus={kbAutoFocus()} />
      <label className={`${lbl} mt-3`}>{c.task.kind}</label>
      <div className="flex flex-wrap gap-[6px]">{kinds.map((k) => <button key={k} type="button" onClick={() => set({ kind: k })} className={`h-7 cursor-pointer rounded-full border px-3 text-[12px] font-medium ${f.kind === k ? "border-ink bg-ink text-white" : "border-line bg-surface text-text hover:bg-bg-3"}`}>{taskKindName(k, t)}</button>)}</div>
      <label className={`${lbl} mt-3`}>{c.task.due}</label>
      <DuePicker value={due} onChange={setDue} />
      {!clientId && <><label className={`${lbl} mt-3`}>{c.deal.client}</label><Select value={f.clientId ?? ""} onChange={(v) => set({ clientId: v || null })} searchable options={[{ value: "", label: "—" }, ...clients.map((x) => ({ value: x.id, label: x.name }))]} /></>}
      {crm.me.members.length > 1 && <><label className={`${lbl} mt-3`}>{c.owner}</label><Select value={f.ownerId ?? ""} onChange={(v) => set({ ownerId: v || null })} options={crm.me.members.map((m) => ({ value: m.id, label: m.name, color: m.color }))} /></>}
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className={btnS}>{c.cancel}</button><button type="button" onClick={submit} disabled={busy} className={btnP}>{task ? c.save : c.create}</button></div>
    </div>
  );
}
