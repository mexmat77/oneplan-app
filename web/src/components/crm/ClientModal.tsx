"use client";

import { kbAutoFocus } from "@/lib/touch";
// Форма клиента (0017, ТЗ docs/crm-spec.md §2, §7): минимум при создании — имя, контакт, тип первой заявки, источник,
// ответственный, район/бюджет, следующее действие, KVKK-уведомление; остальное — секции ниже. Один клиент — несколько заявок
// (RequestModal), здесь только первая. Дубли по телефону/e-mail проверяются перед сохранением.
import { useEffect, useState } from "react";
import { IconPlus, IconStar, IconStarFilled, IconTrash } from "@tabler/icons-react";
import { findDups, listClients, listReferrers, saveClient } from "@/app/crm/actions";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Lang } from "@/i18n";
import { COUNTRIES } from "@/lib/crm/countries";
import { REQUEST_KINDS, ROLE_OF_KIND } from "@/lib/crm/requestFields";
import type { Channel, Client, ClientInput, ClientRole, ClientStage, ContactKind, DupHit, Priority, RefKind, TaskKind } from "@/lib/crm/types";
import { useMahalleLoaded } from "@/lib/geo";
import { DuePicker } from "./DuePicker";
import { ReqFieldGroups } from "./RequestModal";
import { crmError, PRIO_COLOR, btnP, btnS, countryName, inp, lbl, sourceName, stageName, taskKindName, useCrm, contactLabelOptions } from "./crmUi";

type CForm = { id?: string; kind: ContactKind; value: string; label: string; isMain: boolean };
const KINDS: ContactKind[] = ["phone", "whatsapp", "email", "telegram", "other"];
const ROLES: ClientRole[] = ["buyer", "seller", "landlord", "tenant"];
const PRIOS: Priority[] = ["hot", "warm", "cold"];
const CHANNELS: Channel[] = ["call", "whatsapp", "telegram", "email"];

function fromClient(c: Client | null, lang: Lang, meId: string, branchId: string | null): ClientInput {
  if (!c) return { name: "", lang, sourceId: null, ownerId: meId, kind: "person", company: "", roles: [], stage: "new", priority: null, country: "", citizenship: "", channel: null, contactTime: "", campaign: "",
    refKind: "none", refProfileId: null, refAgencyId: null, refClientId: null, refText: "", branchId, kvkk: {}, notes: "", tags: [], contacts: [{ kind: "phone", value: "", label: "", isMain: true }], firstRequest: { kind: "buy", fields: { cur: "TRY" } }, firstTask: null };
  return { name: c.name, lang: c.lang, sourceId: c.sourceId, ownerId: c.ownerId, kind: c.kind, company: c.company ?? "", roles: c.roles, stage: c.stage, priority: c.priority, country: c.country ?? "", citizenship: c.citizenship ?? "", channel: c.channel, contactTime: c.contactTime ?? "", campaign: c.campaign ?? "",
    refKind: c.refKind, refProfileId: c.refProfileId, refAgencyId: c.refAgencyId, refClientId: c.refClientId, refText: c.refText ?? "", branchId: c.branchId, kvkk: c.kvkk ?? {}, notes: c.notes, tags: c.tags, contacts: c.contacts.map((x) => ({ id: x.id, kind: x.kind, value: x.value, label: x.label ?? "", isMain: x.isMain })) };
}

type Props = { open: boolean; client: Client | null; onClose: () => void; onSaved: (id: string) => void; onOpenDup?: (id: string) => void };
/** Окно монтируется только открытым: форма (`ClientForm`) берёт начальное состояние из props при монтировании. */
export function ClientModal(props: Props) {
  return <Modal open={props.open} onClose={props.onClose} width={720} sheet="tall">{props.open && <ClientForm key={props.client?.id ?? "new"} {...props} />}</Modal>;
}

const sec = "mt-5 border-t border-line pt-3 text-[12px] font-semibold uppercase tracking-[.05em] text-muted";
const chipCls = (on: boolean) => `h-7 cursor-pointer rounded-full border px-3 text-[12px] font-medium ${on ? "border-transparent text-white" : "border-line bg-surface text-text hover:bg-bg-3"}`;

function ClientForm({ client, onClose, onSaved, onOpenDup }: Props) {
  const { t, lang } = useI18n();
  const crm = useCrm();
  useMahalleLoaded();
  const c = t.crm;
  const [f, setF] = useState<ClientInput>(() => fromClient(client, lang, crm.me.meId, crm.me.branchId));
  const [tags, setTags] = useState(client?.tags.join(", ") ?? "");
  const [busy, setBusy] = useState(false);
  const [dups, setDups] = useState<DupHit[] | null>(null);
  const [more, setMore] = useState(!!client);
  const [refs, setRefs] = useState<{ realtors: { id: string; name: string; agency: string }[]; agencies: { id: string; name: string }[] } | null>(null);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const set = (p: Partial<ClientInput>) => setF((v) => ({ ...v, ...p }));
  const isDev = crm.me.ws.kind === "developer";
  const isNew = !client;

  useEffect(() => { if (isDev) listReferrers().then(setRefs).catch(() => setRefs({ realtors: [], agencies: [] })); }, [isDev]);
  useEffect(() => { if (f.refKind === "client" && !clients.length) listClients({}).then((l) => setClients(l.filter((x) => x.id !== client?.id).map((x) => ({ id: x.id, name: x.name })))).catch(() => {}); }, [f.refKind, clients.length, client?.id]);

  const setC = (i: number, p: Partial<CForm>) => set({ contacts: f.contacts.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const addC = () => set({ contacts: [...f.contacts, { kind: "phone", value: "", label: "", isMain: false }] });
  const delC = (i: number) => set({ contacts: f.contacts.filter((_, j) => j !== i) });
  const mainC = (i: number) => set({ contacts: f.contacts.map((x, j) => ({ ...x, isMain: j === i })) });
  const toggleRole = (r: ClientRole) => set({ roles: f.roles.includes(r) ? f.roles.filter((x) => x !== r) : [...f.roles, r] });
  const kv = f.kvkk; const consent = kv.consent ?? {}; const info = kv.info ?? {};
  const setConsent = (p: Partial<NonNullable<ClientInput["kvkk"]["consent"]>>) => set({ kvkk: { ...kv, consent: { ...consent, ...p } } });
  const setInfo = (p: Partial<NonNullable<ClientInput["kvkk"]["info"]>>) => set({ kvkk: { ...kv, info: { ...info, ...p } } });
  const countryOpts = [{ value: "", label: c.client.anyCountry }, ...COUNTRIES.map((k) => ({ value: k, label: countryName(k, lang) }))];

  async function submit(force = false) {
    if (!f.name.trim()) { showToast(c.needName); return; }
    if (!f.contacts.some((x) => x.value.trim())) { showToast(c.needContact); return; }
    if (busy) return;
    setBusy(true);
    try {
      if (!force) {
        const hits = await findDups(f.contacts.map((x) => ({ kind: x.kind, value: x.value })), client?.id ?? null);
        if (hits.length) { setDups(hits); setBusy(false); return; }
      }
      const id = await saveClient({ ...f, tags: tags.split(",").map((s) => s.trim()).filter(Boolean), firstRequest: isNew ? f.firstRequest : null, firstTask: isNew && f.firstTask?.dueAt ? { ...f.firstTask, title: f.firstTask.title.trim() || taskKindName(f.firstTask.kind, t) } : null }, client?.id ?? null);
      onSaved(id);
    } catch (e) { crmError(e, c.errSave, c.errReadonly); }
    finally { setBusy(false); }
  }

  const fr = f.firstRequest;
  return (
    <div data-crm-form="1">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[18px] font-semibold text-ink">{client ? c.client.edit : c.addClient}</div>
        <ModalClose onClick={onClose} />
      </div>
      <div className="max-h-[72vh] overflow-y-auto pr-1 max-md:max-h-none">
        {/* ---- основное ---- */}
        <div className="grid grid-cols-[auto_1fr_120px] gap-3 max-md:grid-cols-1">
          <div><label className={lbl}>&nbsp;</label><div className="inline-flex h-9 rounded-[6px] border border-line bg-surface p-[2px]">{(["person", "company"] as const).map((k) => <button key={k} type="button" onClick={() => set({ kind: k })} className={`cursor-pointer rounded-[4px] px-3 text-[12.5px] font-medium ${f.kind === k ? "bg-ink text-white" : "text-muted hover:text-ink"}`}>{k === "person" ? c.client.kindPerson : c.client.kindCompany}</button>)}</div></div>
          <div><label className={lbl}>{c.client.name}</label><input value={f.name} onChange={(e) => set({ name: e.target.value })} className={inp} autoFocus={kbAutoFocus()} /></div>
          <div><label className={lbl}>{c.client.lang}</label><Select value={f.lang} onChange={(v) => set({ lang: v as Lang })} options={["RU", "EN", "TR"].map((l) => ({ value: l, label: l }))} /></div>
        </div>
        {f.kind === "company" && <div className="mt-3"><label className={lbl}>{c.client.company}</label><input value={f.company} onChange={(e) => set({ company: e.target.value })} className={inp} /></div>}

        <label className={`${lbl} mt-4`}>{c.client.contacts}</label>
        <div className="flex flex-col gap-2">
          {f.contacts.map((x, i) => (
            <div key={i} className="grid grid-cols-[130px_1fr_150px_auto_auto] items-center gap-2 max-md:grid-cols-[100px_1fr_auto_auto]">
              <Select value={x.kind} onChange={(v) => setC(i, { kind: v as ContactKind })} options={KINDS.map((k) => ({ value: k, label: c.kinds[k] }))} size="sm" />
              <input value={x.value} onChange={(e) => setC(i, { value: e.target.value })} inputMode={x.kind === "email" ? "email" : x.kind === "phone" || x.kind === "whatsapp" ? "tel" : undefined} autoComplete={x.kind === "email" ? "email" : x.kind === "phone" || x.kind === "whatsapp" ? "tel" : "off"} placeholder={x.kind === "email" ? "name@mail.com" : x.kind === "telegram" ? "@login" : "+90 5xx xxx xx xx"} className={inp} />
              <Select value={x.label} onChange={(v) => setC(i, { label: v })} options={contactLabelOptions(x.label, c.client.labels, c.client.label)} size="sm" menuWidth="auto" className="max-md:hidden" />
              <button type="button" title={c.client.main} onClick={() => mainC(i)} className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-[6px] ${x.isMain ? "text-[#f5a623]" : "text-muted hover:bg-bg-3"}`}>{x.isMain ? <IconStarFilled size={16} /> : <IconStar size={16} />}</button>
              <button type="button" onClick={() => delC(i)} disabled={f.contacts.length === 1} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-red-tint hover:text-red disabled:opacity-30"><IconTrash size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={addC} className="inline-flex w-fit cursor-pointer items-center gap-1 text-[13px] font-semibold text-blue-2 hover:brightness-95"><IconPlus size={14} /> {c.client.addContact}</button>
        </div>

        {/* ---- классификация: роли, статус, приоритет, источник, ответственный ---- */}
        <div className={sec}>{c.client.section.classify}</div>
        <div className="mt-2 flex flex-wrap items-center gap-[6px]">
          <span className="mr-1 text-[12px] text-muted">{c.client.roles}:</span>
          {ROLES.map((r) => <button key={r} type="button" onClick={() => toggleRole(r)} className={chipCls(f.roles.includes(r))} style={f.roles.includes(r) ? { background: "#14243f" } : undefined}>{c.roles[r]}</button>)}
          <span className="mx-1 h-4 w-px bg-line" />
          <span className="mr-1 text-[12px] text-muted">{c.client.priority}:</span>
          {PRIOS.map((p) => <button key={p} type="button" onClick={() => set({ priority: f.priority === p ? null : p })} className={chipCls(f.priority === p)} style={f.priority === p ? { background: PRIO_COLOR[p] } : undefined}>{c.prio[p]}</button>)}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 max-md:grid-cols-1">
          <div><label className={lbl}>{c.client.stage}</label><Select value={f.stage} onChange={(v) => set({ stage: v as ClientStage })} options={crm.cstages.map((st) => ({ value: st.key, label: stageName(st, t, lang), color: st.color ?? undefined }))} /></div>
          <div><label className={lbl}>{c.source}</label><Select value={f.sourceId ?? ""} onChange={(v) => set({ sourceId: v || null })} options={[{ value: "", label: c.noSource }, ...crm.sources.filter((s) => s.active).map((s) => ({ value: s.id, label: sourceName(s, t) }))]} /></div>
          <div><label className={lbl}>{c.client.campaign}</label><input value={f.campaign} onChange={(e) => set({ campaign: e.target.value })} placeholder={c.client.campaignPh} className={inp} /></div>
          {crm.me.members.length > 1 && <div><label className={lbl}>{c.owner}</label><Select value={f.ownerId ?? ""} onChange={(v) => set({ ownerId: v || null })} options={crm.me.members.map((m) => ({ value: m.id, label: m.name, color: m.color }))} /></div>}
          {crm.me.branches.length > 0 && <div><label className={lbl}>{c.client.branch}</label><Select value={f.branchId ?? ""} onChange={(v) => set({ branchId: v || null })} options={[{ value: "", label: c.client.noBranch }, ...crm.me.branches.map((b) => ({ value: b.id, label: b.name }))]} /></div>}
        </div>
        <div className="mt-3">
          <label className={lbl}>{c.client.ref}</label>
          <div className="grid grid-cols-[200px_1fr] gap-2 max-md:grid-cols-1">
            <Select value={f.refKind} onChange={(v) => set({ refKind: v as RefKind })} options={([["none", c.client.refNone], ["client", c.client.refClient], ...(isDev ? [["realtor", c.client.refRealtor], ["agency", c.client.refAgency]] : []), ["text", c.client.refText]] as [string, string][]).map(([v, l]) => ({ value: v, label: l }))} />
            {f.refKind === "client" && <Select value={f.refClientId ?? ""} onChange={(v) => set({ refClientId: v || null })} placeholder={c.client.refPick} searchable options={clients.map((x) => ({ value: x.id, label: x.name }))} />}
            {f.refKind === "realtor" && <Select value={f.refProfileId ?? ""} onChange={(v) => set({ refProfileId: v || null })} placeholder={c.client.refPick} searchable options={(refs?.realtors ?? []).map((r) => ({ value: r.id, label: r.agency ? `${r.name} · ${r.agency}` : r.name }))} />}
            {f.refKind === "agency" && <Select value={f.refAgencyId ?? ""} onChange={(v) => set({ refAgencyId: v || null })} placeholder={c.client.refPick} searchable options={(refs?.agencies ?? []).map((a) => ({ value: a.id, label: a.name }))} />}
            {f.refKind === "text" && <input value={f.refText} onChange={(e) => set({ refText: e.target.value })} placeholder={c.client.refTextPh} className={inp} />}
          </div>
        </div>

        {/* ---- первая заявка (только при создании): тип + быстрые поля ---- */}
        {isNew && (
          <>
            <div className={sec}>{c.client.section.first}</div>
            <div className="mt-2 flex flex-wrap gap-[6px]">
              <button type="button" onClick={() => set({ firstRequest: null })} className={chipCls(!fr)} style={!fr ? { background: "#14243f" } : undefined}>{c.client.noFirst}</button>
              {REQUEST_KINDS.map((k) => <button key={k} type="button" onClick={() => set({ firstRequest: { kind: k, fields: { cur: fr?.fields.cur ?? "TRY" } }, roles: f.roles.includes(ROLE_OF_KIND[k]) ? f.roles : [...f.roles, ROLE_OF_KIND[k]] })} className={chipCls(fr?.kind === k)} style={fr?.kind === k ? { background: "#4d7cfe" } : undefined}>{c.rq.kinds[k]}</button>)}
            </div>
            {fr && <><ReqFieldGroups kind={fr.kind} vals={fr.fields} closed={{}} onField={(k, v) => set({ firstRequest: { kind: fr.kind, fields: { ...fr.fields, [k]: v } } })} onClosed={() => {}} t={t} quickOnly /><div className="mt-1 text-[11.5px] text-muted">{c.rq.quickHint}</div></>}

            <div className={sec}>{c.client.section.next}</div>
            <div className="mt-2 grid grid-cols-[150px_1fr] gap-2 max-md:grid-cols-1">
              <Select value={f.firstTask?.kind ?? "call"} onChange={(v) => set({ firstTask: { kind: v as TaskKind, dueAt: f.firstTask?.dueAt ?? "", title: f.firstTask?.title ?? "" } })} options={(["call", "show", "meeting", "message", "other"] as TaskKind[]).map((k) => ({ value: k, label: taskKindName(k, t) }))} />
              <input value={f.firstTask?.title ?? ""} onChange={(e) => set({ firstTask: { kind: f.firstTask?.kind ?? "call", dueAt: f.firstTask?.dueAt ?? "", title: e.target.value } })} placeholder={c.client.nextTitlePh} className={inp} />
            </div>
            <div className="mt-2"><DuePicker value={f.firstTask?.dueAt ?? ""} onChange={(iso) => set({ firstTask: { kind: f.firstTask?.kind ?? "call", dueAt: iso, title: f.firstTask?.title ?? "" } })} allowEmpty /></div>
          </>
        )}

        {/* ---- KVKK ---- */}
        <div className={sec}>{c.client.section.kvkk}</div>
        <div className="mt-2 grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <div className="rounded-[6px] border border-line p-3">
            <div className="text-[12.5px] font-semibold text-ink">{c.kvkk.info}</div>
            <div className="mb-2 text-[11.5px] text-muted">{c.kvkk.infoHint}</div>
            <div className="grid grid-cols-[1fr_90px] gap-2">
              <Select value={info.method ?? ""} onChange={(v) => setInfo({ method: (v || undefined) as typeof info.method })} options={[{ value: "", label: c.kvkk.notInformed }, ...(Object.keys(c.kvkk.methods) as (keyof typeof c.kvkk.methods)[]).map((k) => ({ value: k, label: c.kvkk.methods[k] }))]} />
              <input value={info.version ?? ""} onChange={(e) => setInfo({ version: e.target.value || undefined })} placeholder="v1" className={inp} title={c.kvkk.infoVersion} />
            </div>
          </div>
          <div className="rounded-[6px] border border-line p-3">
            <div className="text-[12.5px] font-semibold text-ink">{c.kvkk.consent}</div>
            <div className="mb-2 text-[11.5px] text-muted">{c.kvkk.consentHint}</div>
            <div className="flex flex-wrap gap-[6px]">
              {(["call", "sms", "whatsapp", "email"] as const).map((k) => <button key={k} type="button" onClick={() => setConsent({ [k]: !consent[k] || undefined })} className={chipCls(!!consent[k])} style={consent[k] ? { background: "#22c15e" } : undefined}>{c.kvkk.ch[k]}</button>)}
            </div>
            <div className="mt-2 grid grid-cols-[1fr_110px] gap-2">
              <Select value={consent.basis ?? ""} onChange={(v) => setConsent({ basis: (v || undefined) as typeof consent.basis })} options={[{ value: "", label: c.kvkk.basis }, ...(Object.keys(c.kvkk.bases) as (keyof typeof c.kvkk.bases)[]).map((k) => ({ value: k, label: c.kvkk.bases[k] }))]} size="sm" />
              <input inputMode="numeric" value={consent.retainMonths ?? ""} onChange={(e) => setConsent({ retainMonths: e.target.value ? +e.target.value.replace(/\D/g, "") : undefined })} placeholder={c.kvkk.retain} className={inp} />
            </div>
          </div>
        </div>

        {/* ---- дополнительно: связь, теги, заметки ---- */}
        <button type="button" onClick={() => setMore((v) => !v)} className={`${sec} flex w-full cursor-pointer items-center justify-between hover:text-ink`}><span>{c.client.section.more}</span><span>{more ? "▴" : "▾"}</span></button>
        {more && (
          <>
            <div className="mt-2 grid grid-cols-2 gap-2 max-md:grid-cols-1">
              <div><label className={lbl}>{c.client.country}</label><Select value={f.country} onChange={(v) => set({ country: v })} searchable options={countryOpts} /></div>
              <div><label className={lbl}>{c.client.citizenship}</label><Select value={f.citizenship} onChange={(v) => set({ citizenship: v })} searchable options={countryOpts} /></div>
              <div><label className={lbl}>{c.client.channel}</label><Select value={f.channel ?? ""} onChange={(v) => set({ channel: (v || null) as Channel | null })} options={[{ value: "", label: c.rq.empty }, ...CHANNELS.map((k) => ({ value: k, label: c.channel[k] }))]} /></div>
              <div><label className={lbl}>{c.client.contactTime}</label><input value={f.contactTime} onChange={(e) => set({ contactTime: e.target.value })} placeholder={c.client.contactTimePh} className={inp} /></div>
            </div>
            <label className={`${lbl} mt-3`}>{c.client.tags}</label>
            <input value={tags} onChange={(e) => setTags(e.target.value)} className={inp} />
            <label className={`${lbl} mt-3`}>{c.client.notes}</label>
            <textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} className={`${inp} min-h-[84px] resize-y py-2`} />
          </>
        )}

        {dups && dups.length > 0 && (
          <div className="mt-4 rounded-[6px] border border-[#f5d58a] bg-[#fff8e6] p-3 text-[13px] text-ink">
            <div className="mb-2 font-semibold">{dups.length > 1 ? c.client.dupMany : c.client.dup}:</div>
            <ul className="mb-2 flex flex-col gap-1">
              {dups.map((d) => <li key={d.clientId} className="flex items-center justify-between gap-2"><span>{d.name} <span className="text-muted">· {c.kinds[d.kind]}</span></span>{onOpenDup && <button type="button" onClick={() => onOpenDup(d.clientId)} className="cursor-pointer font-semibold text-blue-2">{c.client.dupOpen}</button>}</li>)}
            </ul>
            <button type="button" onClick={() => submit(true)} className={btnS}>{c.client.dupAnyway}</button>
          </div>
        )}
      </div>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className={btnS}>{c.cancel}</button>
        <button type="button" onClick={() => submit(false)} disabled={busy} className={btnP}>{client ? c.save : c.create}</button>
      </div>
    </div>
  );
}
