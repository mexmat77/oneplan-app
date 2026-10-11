"use client";

// Карточка клиента (создание/правка): имя, язык, контакты (несколько), источник, ответственный, «кто привёл»
// (застройщик), бюджет, что ищет, теги, заметки, согласие. Перед сохранением — проверка дублей по телефону/e-mail.
import { useEffect, useState } from "react";
import { IconPlus, IconStar, IconStarFilled, IconTrash } from "@tabler/icons-react";
import { findDups, listReferrers, saveClient } from "@/app/crm/actions";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Lang } from "@/i18n";
import type { Client, ClientInput, ContactKind, DupHit, RefKind } from "@/lib/crm/types";
import { GEO } from "@/lib/seed";
import { ROOMS_ALL } from "@/lib/types";
import { btnP, btnS, inp, lbl, sourceName, useCrm } from "./crmUi";

type CForm = { id?: string; kind: ContactKind; value: string; label: string; isMain: boolean };
const KINDS: ContactKind[] = ["phone", "whatsapp", "email", "telegram", "other"];

function fromClient(c: Client | null, lang: Lang, meId: string): ClientInput {
  if (!c) return { name: "", lang, sourceId: null, ownerId: meId, refKind: "none", refProfileId: null, refAgencyId: null, refText: "", budgetMin: null, budgetMax: null, cur: "TRY", want: {}, notes: "", tags: [], consent: false, contacts: [{ kind: "phone", value: "", label: "", isMain: true }] };
  return { name: c.name, lang: c.lang, sourceId: c.sourceId, ownerId: c.ownerId, refKind: c.refKind, refProfileId: c.refProfileId, refAgencyId: c.refAgencyId, refText: c.refText ?? "", budgetMin: c.budgetMin, budgetMax: c.budgetMax, cur: c.cur, want: c.want ?? {}, notes: c.notes, tags: c.tags, consent: c.consent, contacts: c.contacts.map((x) => ({ id: x.id, kind: x.kind, value: x.value, label: x.label ?? "", isMain: x.isMain })) };
}

type Props = { open: boolean; client: Client | null; onClose: () => void; onSaved: (id: string) => void; onOpenDup?: (id: string) => void };
/** Окно монтируется только открытым: форма (`ClientForm`) берёт начальное состояние из props при монтировании. */
export function ClientModal(props: Props) {
  return <Modal open={props.open} onClose={props.onClose} width={620} sheet="tall">{props.open && <ClientForm key={props.client?.id ?? "new"} {...props} />}</Modal>;
}

function ClientForm({ client, onClose, onSaved, onOpenDup }: Props) {
  const { t, lang } = useI18n();
  const crm = useCrm();
  const c = t.crm;
  const [f, setF] = useState<ClientInput>(() => fromClient(client, lang, crm.me.meId));
  const [tags, setTags] = useState(client?.tags.join(", ") ?? "");
  const [busy, setBusy] = useState(false);
  const [dups, setDups] = useState<DupHit[] | null>(null);
  const [refs, setRefs] = useState<{ realtors: { id: string; name: string; agency: string }[]; agencies: { id: string; name: string }[] } | null>(null);
  const set = (p: Partial<ClientInput>) => setF((v) => ({ ...v, ...p }));
  const isDev = crm.me.ws.kind === "developer";

  useEffect(() => { if (isDev) listReferrers().then(setRefs).catch(() => setRefs({ realtors: [], agencies: [] })); }, [isDev]);

  const setC = (i: number, p: Partial<CForm>) => set({ contacts: f.contacts.map((x, j) => (j === i ? { ...x, ...p } : x)) });
  const addC = () => set({ contacts: [...f.contacts, { kind: "phone", value: "", label: "", isMain: false }] });
  const delC = (i: number) => set({ contacts: f.contacts.filter((_, j) => j !== i) });
  const mainC = (i: number) => set({ contacts: f.contacts.map((x, j) => ({ ...x, isMain: j === i })) });

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
      const id = await saveClient({ ...f, tags: tags.split(",").map((s) => s.trim()).filter(Boolean) }, client?.id ?? null);
      onSaved(id);
    } catch (e) { showToast((e as Error).message === "readonly" ? c.errReadonly : c.errSave); }
    finally { setBusy(false); }
  }

  const ilOpts = [{ value: "", label: c.want.any }, ...GEO.map((g) => ({ value: g.k, label: g.n }))];
  return (
    <div data-crm-form="1">
      <div className="mb-4 flex items-center justify-between">
        <div className="text-[18px] font-semibold text-ink">{client ? c.client.edit : c.addClient}</div>
        <ModalClose onClick={onClose} />
      </div>
      <div className="max-h-[70vh] overflow-y-auto pr-1 max-md:max-h-none">
        <div className="grid grid-cols-[1fr_140px] gap-3 max-md:grid-cols-1">
          <div><label className={lbl}>{c.client.name}</label><input value={f.name} onChange={(e) => set({ name: e.target.value })} className={inp} autoFocus /></div>
          <div><label className={lbl}>{c.client.lang}</label><Select value={f.lang} onChange={(v) => set({ lang: v as Lang })} options={["RU", "EN", "TR"].map((l) => ({ value: l, label: l }))} /></div>
        </div>

        <label className={`${lbl} mt-4`}>{c.client.contacts}</label>
        <div className="flex flex-col gap-2">
          {f.contacts.map((x, i) => (
            <div key={i} className="grid grid-cols-[120px_1fr_120px_auto_auto] items-center gap-2 max-md:grid-cols-[100px_1fr_auto_auto]">
              <Select value={x.kind} onChange={(v) => setC(i, { kind: v as ContactKind })} options={KINDS.map((k) => ({ value: k, label: c.kinds[k] }))} size="sm" />
              <input value={x.value} onChange={(e) => setC(i, { value: e.target.value })} placeholder={x.kind === "email" ? "name@mail.com" : x.kind === "telegram" ? "@login" : "+90 5xx xxx xx xx"} className={inp} />
              <input value={x.label} onChange={(e) => setC(i, { label: e.target.value })} placeholder={c.client.label} className={`${inp} max-md:hidden`} />
              <button type="button" title={c.client.main} onClick={() => mainC(i)} className={`flex h-9 w-9 cursor-pointer items-center justify-center rounded-[9px] ${x.isMain ? "text-[#f5a623]" : "text-muted hover:bg-bg-3"}`}>{x.isMain ? <IconStarFilled size={16} /> : <IconStar size={16} />}</button>
              <button type="button" onClick={() => delC(i)} disabled={f.contacts.length === 1} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[9px] text-muted hover:bg-red-tint hover:text-red disabled:opacity-30"><IconTrash size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={addC} className="inline-flex w-fit cursor-pointer items-center gap-1 text-[13px] font-bold text-blue-2 hover:brightness-95"><IconPlus size={14} /> {c.client.addContact}</button>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <div><label className={lbl}>{c.source}</label><Select value={f.sourceId ?? ""} onChange={(v) => set({ sourceId: v || null })} options={[{ value: "", label: c.noSource }, ...crm.sources.filter((s) => s.active).map((s) => ({ value: s.id, label: sourceName(s, t) }))]} /></div>
          {crm.me.members.length > 1 && <div><label className={lbl}>{c.owner}</label><Select value={f.ownerId ?? ""} onChange={(v) => set({ ownerId: v || null })} options={crm.me.members.map((m) => ({ value: m.id, label: m.name }))} /></div>}
        </div>

        {isDev && (
          <div className="mt-4">
            <label className={lbl}>{c.client.ref}</label>
            <div className="grid grid-cols-[200px_1fr] gap-2 max-md:grid-cols-1">
              <Select value={f.refKind} onChange={(v) => set({ refKind: v as RefKind })} options={[["none", c.client.refNone], ["realtor", c.client.refRealtor], ["agency", c.client.refAgency], ["text", c.client.refText]].map(([v, l]) => ({ value: v, label: l }))} />
              {f.refKind === "realtor" && <Select value={f.refProfileId ?? ""} onChange={(v) => set({ refProfileId: v || null })} placeholder={c.client.refPick} searchable options={(refs?.realtors ?? []).map((r) => ({ value: r.id, label: r.agency ? `${r.name} · ${r.agency}` : r.name }))} />}
              {f.refKind === "agency" && <Select value={f.refAgencyId ?? ""} onChange={(v) => set({ refAgencyId: v || null })} placeholder={c.client.refPick} searchable options={(refs?.agencies ?? []).map((a) => ({ value: a.id, label: a.name }))} />}
              {f.refKind === "text" && <input value={f.refText} onChange={(e) => set({ refText: e.target.value })} placeholder={c.client.refTextPh} className={inp} />}
            </div>
          </div>
        )}

        <label className={`${lbl} mt-4`}>{c.client.budget}</label>
        <div className="grid grid-cols-[1fr_1fr_110px] gap-2">
          <input inputMode="numeric" value={f.budgetMin ?? ""} onChange={(e) => set({ budgetMin: e.target.value ? +e.target.value.replace(/\D/g, "") : null })} placeholder={c.client.from} className={inp} />
          <input inputMode="numeric" value={f.budgetMax ?? ""} onChange={(e) => set({ budgetMax: e.target.value ? +e.target.value.replace(/\D/g, "") : null })} placeholder={c.client.to} className={inp} />
          <Select value={f.cur} onChange={(v) => set({ cur: v })} options={["TRY", "EUR", "USD"].map((x) => ({ value: x, label: x }))} />
        </div>

        <label className={`${lbl} mt-4`}>{c.client.want}</label>
        <div className="grid grid-cols-3 gap-2 max-md:grid-cols-1">
          <Select value={f.want.deal ?? ""} onChange={(v) => set({ want: { ...f.want, deal: v || undefined } })} options={[{ value: "", label: `${c.want.deal}: ${c.want.any}` }, ...(["sale", "rent", "daily"] as const).map((d) => ({ value: d, label: t.deal[d] }))]} />
          <Select value={f.want.type ?? ""} onChange={(v) => set({ want: { ...f.want, type: v || undefined } })} options={[{ value: "", label: `${c.want.type}: ${c.want.any}` }, ...(["flat", "house", "comm", "land"] as const).map((d) => ({ value: d, label: t.typ[d] }))]} />
          <Select value={f.want.il ?? ""} onChange={(v) => set({ want: { ...f.want, il: v || undefined } })} options={ilOpts} searchable />
        </div>
        <div className="mt-2 flex flex-wrap gap-[6px]">
          {ROOMS_ALL.map((r) => { const on = f.want.rooms?.includes(r); return <button key={r} type="button" onClick={() => set({ want: { ...f.want, rooms: on ? (f.want.rooms ?? []).filter((x) => x !== r) : [...(f.want.rooms ?? []), r] } })} className={`cursor-pointer rounded-[14px] border px-[11px] py-[5px] text-[12px] font-semibold ${on ? "border-sel-line bg-blue-tint text-sel-ink" : "border-line text-text-2 hover:bg-bg-3"}`}>{r}</button>; })}
        </div>

        <label className={`${lbl} mt-4`}>{c.client.tags}</label>
        <input value={tags} onChange={(e) => setTags(e.target.value)} className={inp} />
        <label className={`${lbl} mt-4`}>{c.client.notes}</label>
        <textarea value={f.notes} onChange={(e) => set({ notes: e.target.value })} className={`${inp} min-h-[84px] resize-y`} />
        <label className="mt-4 flex cursor-pointer items-start gap-2 text-[13px] text-text">
          <input type="checkbox" checked={f.consent} onChange={(e) => set({ consent: e.target.checked })} className="mt-[3px]" /> {c.client.consent}
        </label>

        {dups && dups.length > 0 && (
          <div className="mt-4 rounded-[12px] border border-[#f5d58a] bg-[#fff8e6] p-3 text-[13px] text-ink">
            <div className="mb-2 font-bold">{dups.length > 1 ? c.client.dupMany : c.client.dup}:</div>
            <ul className="mb-2 flex flex-col gap-1">
              {dups.map((d) => <li key={d.clientId} className="flex items-center justify-between gap-2"><span>{d.name} <span className="text-muted">· {c.kinds[d.kind]}</span></span>{onOpenDup && <button type="button" onClick={() => onOpenDup(d.clientId)} className="cursor-pointer font-bold text-blue-2">{c.client.dupOpen}</button>}</li>)}
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
