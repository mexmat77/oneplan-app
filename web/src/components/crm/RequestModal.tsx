"use client";

// Заявка клиента (0017, ТЗ docs/crm-spec.md §3): форма строится по реестру lib/crm/requestFields.ts — тип заявки задаёт набор
// полей и групп; закрытые поля (минимальная цена) — отдельным блоком с замком. `ReqFieldInput` переиспользуется в форме
// клиента для «первой заявки» (быстрые поля).
import { useEffect, useState } from "react";
import { IconChevronDown, IconLock, IconMapPin } from "@tabler/icons-react";
import { listClients, saveRequest } from "@/app/crm/actions";
import { GeoPicker } from "@/components/GeoPicker";
import { DateField } from "@/components/ui/DateRange";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useI18n } from "@/i18n/provider";
import { useMahalleLoaded } from "@/lib/geo";
import type { Briefs } from "./ObjCard";
import { mergeBriefs, ObjectPicker } from "./ObjectPicker";
import { GROUP_ORDER, OPTS, REQUEST_FIELDS, REQUEST_KINDS, type ReqField } from "@/lib/crm/requestFields";
import type { ObjRef, CrmRequest, Priority, RequestInput, RequestKind, RequestStatus } from "@/lib/crm/types";
import { ROOMS_ALL } from "@/lib/types";
import { crmError, btnP, btnS, inp, lbl, useCrm, wantGeoLabel } from "./crmUi";

type Dict = ReturnType<typeof useI18n>["t"];
type Vals = Record<string, unknown>;

/** Одно поле заявки по типу из реестра. */
/** Объект клиента-продавца/арендодателя (0024): объявление из базы или свободно (хранится id; свободный текст — в поле `objectText`). */
function ListingField({ value, onChange }: { value: string; onChange: (id: string) => void }) {
  const [briefs, setBriefs] = useState<Briefs>({ objs: {}, units: {} });
  const refs: ObjRef[] = value ? [value.startsWith("free:") ? { kind: "free", text: value.slice(5) } : { kind: "listing", id: value }] : [];
  return <ObjectPicker mode="single" value={refs} onChange={(v) => { const r = v[0]; onChange(!r ? "" : r.kind === "listing" ? r.id : r.kind === "free" ? `free:${r.url ? `${r.text} · ${r.url}` : r.text}` : ""); }} briefs={briefs} onBriefs={(add) => setBriefs((b) => mergeBriefs(b, add))} />;
}

export function ReqFieldInput({ f, value, onChange, t, clients }: { f: ReqField; value: unknown; onChange: (v: unknown) => void; t: Dict; clients?: { id: string; name: string }[] }) {
  const rq = t.crm.rq;
  const [geo, setGeo] = useState(false);
  const label = <label className={lbl}>{rq.f[f.key as keyof typeof rq.f] ?? f.key}{f.closed && <IconLock size={11} className="ml-1 inline text-muted" />}</label>;
  const optLabel = (o: string) => (f.opts ? (rq.o as Record<string, Record<string, string>>)[f.opts]?.[o] ?? o : o);
  const num = (e: React.ChangeEvent<HTMLInputElement>) => { const v = e.target.value.replace(/[^\d.,-]/g, "").replace(",", "."); onChange(v === "" ? undefined : Number(v)); };
  switch (f.type) {
    case "text": return <div>{label}<input value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={inp} /></div>;
    case "textarea": return <div className="col-span-2 max-md:col-span-1">{label}<textarea value={(value as string) ?? ""} onChange={(e) => onChange(e.target.value)} className={`${inp} min-h-[64px] resize-y py-2`} /></div>;
    case "number": return <div>{label}<input inputMode="decimal" value={value == null ? "" : String(value)} onChange={num} className={inp} /></div>;
    case "money": return <div>{label}<input inputMode="numeric" value={typeof value === "number" ? value.toLocaleString("ru-RU") : ""} onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); onChange(v ? Number(v) : undefined); }} className={inp} /></div>;
    case "cur": return <div>{label}<Select value={(value as string) || "TRY"} onChange={(v) => onChange(v)} options={OPTS.cur.map((x) => ({ value: x, label: x }))} /></div>;
    case "date": return <div>{label}<DateField value={(value as string) ?? ""} onChange={(v) => onChange(v || undefined)} /></div>;
    case "bool": return <label className="flex h-9 cursor-pointer items-center gap-2 self-end text-[13px] text-text"><input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked || undefined)} /> {rq.f[f.key as keyof typeof rq.f] ?? f.key}</label>;
    case "select": return <div>{label}<Select value={(value as string) ?? ""} onChange={(v) => onChange(v || undefined)} options={[{ value: "", label: rq.empty }, ...(f.opts ? OPTS[f.opts] : []).map((o) => ({ value: o, label: optLabel(o) }))]} /></div>;
    case "multi": { const cur = (value as string[]) ?? []; return <div className="col-span-2 max-md:col-span-1">{label}<div className="flex flex-wrap gap-[6px]">{(f.opts ? OPTS[f.opts] : []).map((o) => { const on = cur.includes(o); return <button key={o} type="button" onClick={() => onChange(on ? cur.filter((x) => x !== o) : [...cur, o])} className={`h-7 cursor-pointer rounded-full border px-3 text-[12px] font-medium ${on ? "border-sel-line bg-blue-tint text-sel-ink" : "border-line bg-surface text-text hover:bg-bg-3"}`}>{optLabel(o)}</button>; })}</div></div>; }
    case "rooms": { const cur = (value as string[]) ?? []; return <div className="col-span-2 max-md:col-span-1">{label}<div className="flex flex-wrap gap-[6px]">{ROOMS_ALL.map((r) => { const on = cur.includes(r); return <button key={r} type="button" onClick={() => onChange(on ? cur.filter((x) => x !== r) : [...cur, r])} className={`h-7 cursor-pointer rounded-full border px-[10px] text-[12px] font-semibold ${on ? "border-sel-line bg-blue-tint text-sel-ink" : "border-line bg-surface text-text hover:bg-bg-3"}`}>{r}</button>; })}</div></div>; }
    case "geo": { const g = (value as { il?: string; ilces?: string[]; semts?: string[] }) ?? {}; return (
      <div>{label}
        <button type="button" onClick={() => setGeo(true)} className="relative h-9 w-full cursor-pointer truncate rounded-[6px] border border-line bg-surface pl-8 pr-7 text-left text-[13px] text-ink hover:border-blue">
          <IconMapPin size={14} className="absolute left-[9px] top-1/2 -translate-y-1/2 text-muted" />{wantGeoLabel(g, rq.empty)}<IconChevronDown size={13} className="absolute right-[9px] top-1/2 -translate-y-1/2 text-muted" />
        </button>
        {geo && <GeoPicker mode="filter" showAll z={500} applyLabel={t.crm.want.applyGeo} value={{ il: g.il ?? "", ilces: g.ilces ?? [], semts: g.semts ?? [] }} onApply={(v) => { onChange(v.il ? { il: v.il, ilces: v.ilces, semts: v.semts } : undefined); setGeo(false); }} onClose={() => setGeo(false)} />}
      </div>); }
    case "listing": return <div className="col-span-2 max-md:col-span-1">{label}<ListingField value={(value as string) ?? ""} onChange={(v) => onChange(v || undefined)} /></div>;
    case "clients": { const cur = (value as string[]) ?? []; return (
      <div className="col-span-2 max-md:col-span-1">{label}
        <div className="flex flex-wrap items-center gap-[6px]">
          {cur.map((id) => <span key={id} className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-bg-2 pl-3 pr-1 text-[12px]">{clients?.find((x) => x.id === id)?.name ?? id.slice(0, 8)}<button type="button" onClick={() => onChange(cur.filter((x) => x !== id))} className="h-5 w-5 cursor-pointer rounded-full text-muted hover:text-red">×</button></span>)}
          <Select value="" onChange={(v) => { if (v && !cur.includes(v)) onChange([...cur, v]); }} searchable placeholder="+" options={(clients ?? []).map((x) => ({ value: x.id, label: x.name }))} className="w-[220px]" size="sm" />
        </div>
      </div>); }
    default: return null;
  }
}

/** Группы полей (для формы заявки и для «подробно» в карточке). */
export function ReqFieldGroups({ kind, vals, closed, onField, onClosed, t, clients, quickOnly }: { kind: RequestKind; vals: Vals; closed: Vals; onField: (k: string, v: unknown) => void; onClosed: (k: string, v: unknown) => void; t: Dict; clients?: { id: string; name: string }[]; quickOnly?: boolean }) {
  const rq = t.crm.rq;
  const all = REQUEST_FIELDS[kind].filter((f) => !quickOnly || f.quick);
  const open = all.filter((f) => !f.closed), locked = all.filter((f) => f.closed);
  return (
    <>
      {GROUP_ORDER.map((g) => { const list = open.filter((f) => f.group === g); if (!list.length) return null; return (
        <div key={g} className="mt-4">
          {!quickOnly && <div className="mb-2 border-b border-line pb-1 text-[12px] font-semibold text-ink">{rq.g[g]}</div>}
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 max-md:grid-cols-1">{list.map((f) => <ReqFieldInput key={f.key} f={f} value={vals[f.key]} onChange={(v) => onField(f.key, v)} t={t} clients={clients} />)}</div>
        </div>); })}
      {locked.length > 0 && (
        <div className="mt-4 rounded-[6px] border border-dashed border-line bg-[#fafbfc] p-3">
          <div className="mb-2 flex items-center gap-2 text-[12px] font-semibold text-ink"><IconLock size={13} /> {rq.closed} <span className="font-normal text-muted">· {rq.closedHint}</span></div>
          <div className="grid grid-cols-2 gap-x-3 gap-y-3 max-md:grid-cols-1">{locked.map((f) => <ReqFieldInput key={f.key} f={f} value={closed[f.key]} onChange={(v) => onClosed(f.key, v)} t={t} clients={clients} />)}</div>
        </div>
      )}
    </>
  );
}

type Props = { briefs?: Briefs; open: boolean; clientId: string; request: CrmRequest | null; kind?: RequestKind; onClose: () => void; onSaved: () => void };
export function RequestModal(props: Props) {
  return <Modal open={props.open} onClose={props.onClose} width={720} sheet="tall">{props.open && <RequestForm key={props.request?.id ?? "new"} {...props} />}</Modal>;
}

function RequestForm({ clientId, request, kind: kind0, briefs: briefs0, onClose, onSaved }: Props) {
  const { t } = useI18n();
  const c = t.crm; const rq = c.rq;
  const crm = useCrm();
  useMahalleLoaded();
  const [f, setF] = useState<RequestInput>(() => request
    ? { clientId, kind: request.kind, status: request.status, ownerId: request.ownerId, branchId: request.branchId, listingId: request.listingId, variants: request.variants ?? [], priority: request.priority, deadline: request.deadline, fields: { ...request.fields }, closed: { ...request.closed } }
    : { clientId, kind: kind0 ?? "buy", status: "active", ownerId: crm.me.meId, branchId: crm.me.branchId, listingId: null, priority: null, deadline: null, fields: { cur: "TRY" }, closed: {} });
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [briefs, setBriefs] = useState<Briefs>(briefs0 ?? { objs: {}, units: {} }); // карточки подобранных вариантов (0024)
  const wantsVariants = f.kind === "buy" || f.kind === "rent_in";
  const needsClients = REQUEST_FIELDS[f.kind].some((x) => x.type === "clients");
  useEffect(() => { if (needsClients && !clients.length) listClients({}).then((l) => setClients(l.filter((x) => x.id !== clientId).map((x) => ({ id: x.id, name: x.name })))).catch(() => {}); }, [needsClients, clients.length, clientId]);
  const set = (p: Partial<RequestInput>) => setF((v) => ({ ...v, ...p }));
  async function submit() {
    setBusy(true);
    try { const lid = (f.fields.listing as string) ?? ""; await saveRequest({ ...f, listingId: lid && !lid.startsWith("free:") ? lid : null, variants: wantsVariants ? f.variants ?? [] : [] }, request?.id ?? null); onSaved(); }
    catch (e) { crmError(e, c.errSave, c.errReadonly); }
    finally { setBusy(false); }
  }
  return (
    <div data-crm-form="1">
      <div className="mb-4 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{request ? `${rq.edit} · ${rq.kinds[request.kind]}` : rq.add}</div><ModalClose onClick={onClose} /></div>
      <div className="max-h-[70vh] overflow-y-auto pr-1 max-md:max-h-none">
        <div className="grid grid-cols-4 gap-2 max-md:grid-cols-2">
          <div><label className={lbl}>{rq.kind}</label><Select value={f.kind} onChange={(v) => set({ kind: v as RequestKind, fields: { cur: f.fields.cur ?? "TRY" }, closed: {} })} options={REQUEST_KINDS.map((k) => ({ value: k, label: rq.kinds[k] }))} disabled={!!request} /></div>
          <div><label className={lbl}>{rq.status}</label><Select value={f.status} onChange={(v) => set({ status: v as RequestStatus })} options={(Object.keys(rq.st) as RequestStatus[]).map((k) => ({ value: k, label: rq.st[k] }))} /></div>
          <div><label className={lbl}>{c.client.priority}</label><Select value={f.priority ?? ""} onChange={(v) => set({ priority: (v || null) as Priority | null })} options={[{ value: "", label: c.prio.none }, ...(["hot", "warm", "cold"] as Priority[]).map((k) => ({ value: k, label: c.prio[k] }))]} /></div>
          <div><label className={lbl}>{rq.deadline}</label><Select value={f.deadline ?? ""} onChange={(v) => set({ deadline: (v || null) as RequestInput["deadline"] })} options={[{ value: "", label: rq.dl.none }, ...(["asap", "1m", "3m", "later"] as const).map((k) => ({ value: k, label: rq.dl[k] }))]} /></div>
        </div>
        {crm.me.members.length > 1 && <div className="mt-3 grid grid-cols-2 gap-2"><div><label className={lbl}>{c.owner}</label><Select value={f.ownerId ?? ""} onChange={(v) => set({ ownerId: v || null })} options={crm.me.members.map((m) => ({ value: m.id, label: m.name }))} /></div>{crm.me.branches.length > 0 && <div><label className={lbl}>{c.client.branch}</label><Select value={f.branchId ?? ""} onChange={(v) => set({ branchId: v || null })} options={[{ value: "", label: c.client.noBranch }, ...crm.me.branches.map((b) => ({ value: b.id, label: b.name }))]} /></div>}</div>}
        <ReqFieldGroups kind={f.kind} vals={f.fields} closed={f.closed} onField={(k, v) => set({ fields: { ...f.fields, [k]: v } })} onClosed={(k, v) => set({ closed: { ...f.closed, [k]: v } })} t={t} clients={clients} />
        {wantsVariants && <div className="mt-4"><div className="mb-2 text-[12px] font-semibold uppercase tracking-[.05em] text-muted">{c.obj.variants}</div><ObjectPicker mode="multi" value={f.variants ?? []} onChange={(v) => set({ variants: v })} briefs={briefs} onBriefs={(add) => setBriefs((b) => mergeBriefs(b, add))} /></div>}
      </div>
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className={btnS}>{c.cancel}</button><button type="button" onClick={submit} disabled={busy} className={btnP}>{request ? c.save : c.create}</button></div>
    </div>
  );
}
