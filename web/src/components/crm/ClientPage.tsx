"use client";

// Карточка клиента: контакты, что ищет, сделки, задачи, история с заметками (перевод по кнопке того, кто смотрит).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IconArchive, IconBrandTelegram, IconBrandWhatsapp, IconChevronDown, IconChevronUp, IconCopy, IconId, IconLanguage, IconMail, IconPencil, IconPhone, IconPlus, IconTrash, IconUserShare, IconX } from "@tabler/icons-react";
import { addContact, addNote, crmBootstrap, deleteClient, removeContact, deleteDeal, deleteRequest, doneTask, getClient, mergeClients, transferClient, moveDeal, patchClient, setClientStatus, setRequestStatus, translateNote, type ListingBrief } from "@/app/crm/actions";
import { confirmDialog } from "@/components/ui/confirm";
import { Select } from "@/components/ui/Select";
import { showToast, showUndo } from "@/components/ui/toast";
import type { Lang } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import type { UnitBrief, Client, ClientStage, Contact, ContactKind, CrmEvent, CrmMe, CrmRequest, Deal, DupHit, Priority, RequestKind, RequestStatus, Source, Stage, Task } from "@/lib/crm/types";
import { clientNo, dealNo } from "@/lib/crm/types";
import { GROUP_ORDER, REQUEST_FIELDS, REQUEST_KINDS } from "@/lib/crm/requestFields";
import { RequestModal } from "./RequestModal";
import { StageMenu } from "./ClientsTable";
import { TransferModal } from "@/components/ui/TransferModal";
import { dealRef, ObjCard, type Briefs } from "./ObjCard";
import { offerCloseObject } from "./closeObject";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { ClientModal } from "./ClientModal";
import { DossierModal } from "./DossierModal";
import { DealModal, TaskModal } from "./CrmModals";
import { DocsPanel } from "./DocsPanel";
import { cacheGet, cacheSet, crmError, CrmCtx, PRIO_COLOR, REQ_COLOR, btnD, btnP, btnS, card, chip, countryName, fill, fmtDT, fmtDate, initials, inp, reqSummary, sourceName, stageName, taskKindName, useCrm, wantGeoLabel, contactLabelOptions } from "./crmUi";

/** `embedded` — внутри CrmShell (контекст уже есть); иначе страница сама грузит bootstrap. */
export function ClientPage({ base, id, embedded }: { base: string; id: string; embedded?: boolean }) {
  const [boot, setBoot] = useState<{ me: CrmMe; stages: Stage[]; cstages: Stage[]; sources: Source[] } | null>(null);
  const load = useCallback(() => { if (!embedded) crmBootstrap().then(setBoot).catch(() => {}); }, [embedded]);
  useEffect(() => { load(); }, [load]);
  if (embedded) return <Inner id={id} />;
  if (!boot) return <div className="py-10 text-center text-[13px] text-muted">…</div>;
  const ctx = { me: boot.me, stages: boot.stages, cstages: boot.cstages, sources: boot.sources, base, refresh: load, setStages: (s: Stage[]) => setBoot((b) => (b ? { ...b, stages: s } : b)), setCstages: (s: Stage[]) => setBoot((b) => (b ? { ...b, cstages: s } : b)), setSources: (s: Source[]) => setBoot((b) => (b ? { ...b, sources: s } : b)), q: "", setQ: () => {}, setCounts: undefined };
  return <CrmCtx.Provider value={ctx}><Inner id={id} /></CrmCtx.Provider>;
}

type CardData = { client: Client; deals: Deal[]; tasks: Task[]; events: CrmEvent[]; requests: CrmRequest[]; dups: DupHit[]; objs: Record<string, ListingBrief>; units: Record<string, UnitBrief> };
function Inner({ id }: { id: string }) {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const router = useRouter();
  // кэш карточки на сессию (12.10.2026, «моргает при переключении вкладок»): вкладка открывается из памяти, свежие данные — фоном
  const cardKey = `${crm.base}:client:${id}`;
  const [data, setData] = useState<CardData | null | undefined>(() => cacheGet<CardData>(cardKey));
  const [reqM, setReqM] = useState<{ open: boolean; req: CrmRequest | null; kind?: RequestKind }>({ open: false, req: null });
  const [transfer, setTransfer] = useState(false);
  const [dossier, setDossier] = useState(false);
  const [trBusy, setTrBusy] = useState(false);
  const [edit, setEdit] = useState(false);
  const [dealM, setDealM] = useState<{ open: boolean; deal: Deal | null }>({ open: false, deal: null });
  const [taskM, setTaskM] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [note, setNote] = useState("");
  const [objs, setObjs] = useState<Record<string, ListingBrief>>(() => cacheGet<CardData>(cardKey)?.objs ?? {});
  const [units, setUnits] = useState<Record<string, UnitBrief>>(() => cacheGet<CardData>(cardKey)?.units ?? {});
  const briefs: Briefs = { objs, units };
  const [openReq, setOpenReq] = useState<Record<string, boolean>>({});
  const [dups, setDups] = useState<DupHit[]>(() => cacheGet<CardData>(cardKey)?.dups ?? []);
  const ro = crm.me.access !== "full";
  // оптимистично (стандарт 2026): интерфейс меняется сразу, сервер — фоном, при ошибке данные перечитываются
  const patchLocal = (p: Partial<Client>) => setData((d) => (d ? { ...d, client: { ...d.client, ...p } } : d));
  const load = useCallback(() => { getClient(id).then((d) => { setData(d); if (d) { cacheSet(cardKey, d); crm.openTab?.(d.client.id, d.client.name); setObjs(d.objs); setUnits(d.units); setDups(d.dups); } else crm.closeTab?.(id); }).catch(() => { setData(null); crm.closeTab?.(id); });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, cardKey]);
  useEffect(() => { load(); }, [load]);

  if (data === undefined) return <div className="py-10 text-center text-[13px] text-muted">…</div>;
  if (data === null) return <div className={card}>{c.notFound} · <Link href={`${crm.base}/clients`} className="text-blue-2">{c.nav.clients}</Link></div>;
  const { client: cl, deals, tasks, events, requests } = data;
  const err = (e: unknown) => { const m = (e as Error)?.message; if (m === "not-member") return showToast(c.team.notMember); if (m === "forbidden") return showToast(c.team.forbiddenT); crmError(e, c.errSave, c.errReadonly); };
  const src = crm.sources.find((s) => s.id === cl.sourceId);
  const owner = crm.me.members.find((m) => m.id === cl.ownerId);
  const waOf = (v: string) => `https://wa.me/${v.replace(/\D/g, "").replace(/^0/, "90")}`;
  const copy = (v: string) => { navigator.clipboard?.writeText(v).then(() => showToast(c.client.copied)); };

  async function sendNote() {
    if (!note.trim()) return;
    try { await addNote(cl.id, null, "note", note); setNote(""); load(); } catch (e) { err(e); }
  }
  async function archive() {
    const was = cl.status;
    try { await setClientStatus(cl.id, was === "active" ? "archived" : "active"); load(); showUndo(was === "active" ? c.undo.archivedOne : c.undo.restoredOne, async () => { await setClientStatus(cl.id, was); load(); }, c.undo.undo); } catch (e) { err(e); }
  }
  async function del() {
    if (!(await confirmDialog({ title: c.client.delT, text: c.client.delQ, danger: true }))) return;
    try { await deleteClient(cl.id); crm.closeTab?.(cl.id); router.push(`${crm.base}/clients`); } catch (e) { err(e); }
  }
  async function merge(d: DupHit) {
    if (!(await confirmDialog({ title: c.client.mergeT, text: c.client.mergeQ }))) return;
    try { await mergeClients(cl.id, d.clientId); load(); } catch (e) { err(e); }
  }
  async function move(d: Deal, stageId: string) {
    const st = crm.stages.find((s) => s.id === stageId);
    const reason = st?.kind === "lost" ? window.prompt(crm.me.lostReasons.length ? `${c.deal.lostPh}\n${crm.me.lostReasons.map((x, i) => `${i + 1}. ${x}`).join("\n")}` : c.deal.lostPh) ?? undefined : undefined;
    const picked = reason && /^\d+$/.test(reason.trim()) ? crm.me.lostReasons[+reason.trim() - 1] ?? reason : reason;
    const prev = d.stageId;
    setData((x) => (x ? { ...x, deals: x.deals.map((q) => (q.id === d.id ? { ...q, stageId, closedAt: st?.kind === "open" ? null : q.closedAt ?? new Date().toISOString() } : q)) } : x));
    try {
      await moveDeal(d.id, stageId, picked); load();
      if (prev && st?.kind === "open") showUndo(fill(c.undo.moved, { stage: stageName(st, t, lang) }), async () => { await moveDeal(d.id, prev); load(); }, c.undo.undo);
      if (st?.kind === "won") await offerCloseObject(d, crm.me.ws.kind, t);
    } catch (e) { err(e); load(); }
  }
  async function delDeal(d: Deal) { if (!(await confirmDialog({ text: c.deal.delQ, danger: true }))) return; try { await deleteDeal(d.id); load(); } catch (e) { err(e); } }

  const refLabel = cl.refKind === "none" ? null : cl.refKind === "text" ? cl.refText : cl.refKind === "realtor" ? c.client.refRealtor : c.client.refAgency;
  const mainPhone = cl.contacts.find((x) => x.kind === "phone" || x.kind === "whatsapp");
  const openDeal = deals.find((d) => !d.closedAt);
  const openTasks = tasks.filter((x) => !x.doneAt);
  const field = (l: string, v?: string | null) => v ? <div key={l} className="min-w-0"><div className="text-[11px] font-medium text-muted">{l}</div><div className="truncate text-[13px] text-ink">{v}</div></div> : null;
  return (
    <>
      {/* шапка (13.10.2026, «колхозно и сумбурно, при ресайзе ужас»): строка 1 — кто это (имя не переносится по словам,
          обрезается с подсказкой) и действия справа; строка 2 — статусы одной полосой: статус клиента, приоритет (сам чип —
          выбор, без дублирующего списка), язык, роли, этап открытой сделки. Группы не рвутся при сужении. */}
      <div className="-mx-4 -mt-4 mb-4 border-b border-line bg-surface px-5 py-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-blue-tint text-[14px] font-semibold text-sel-ink">{initials(cl.name)}</span>
          <div className="min-w-[240px] flex-[1_1_320px]">
            <div className="flex items-center gap-2 whitespace-nowrap"><h1 className="truncate text-[17px] font-semibold text-ink" title={cl.name}>{cl.name}</h1><span className="flex-none text-[14px] text-muted" title={cl.id}>· {clientNo(cl)}</span></div>
            <div className="mt-[2px] truncate text-[13px] text-text">{[mainPhone?.value, sourceName(src, t), owner?.name].filter(Boolean).join(" · ")}</div>
          </div>
          <div className="ml-auto flex flex-none flex-wrap items-center gap-2">
            <button type="button" onClick={() => setEdit(true)} disabled={ro} className={btnS}><IconPencil size={14} /> {c.client.edit}</button>
            <button type="button" onClick={() => setDossier(true)} disabled={ro} title={c.client.dossierS} className={btnS}><IconId size={14} /> {c.client.dossier}{Object.keys(cl.dossier).length ? ` · ${Object.keys(cl.dossier).length}` : ""}</button>
            <button type="button" onClick={() => setTransfer(true)} disabled={ro} title={c.client.transfer} className={btnS}><IconUserShare size={14} /> {c.client.transfer}</button>
          </div>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <StageMenu value={cl.stage} clientId={cl.id} ownerId={cl.ownerId} onChange={async (v) => { patchLocal({ stage: v as ClientStage }); try { await patchClient(cl.id, { stage: v as ClientStage }); load(); } catch (e) { err(e); load(); } }} disabled={ro} />
          <PriorityChip value={cl.priority} disabled={ro} onChange={async (pr) => { patchLocal({ priority: pr }); try { await patchClient(cl.id, { priority: pr }); } catch (e) { err(e); load(); } }} />
          <span className={chip}>{cl.lang}</span>
          {cl.kind === "company" && cl.company && <span className={chip}>{cl.company}</span>}
          {cl.roles.map((r) => <span key={r} className={chip}>{c.roles[r]}</span>)}
          {openDeal && <span className="ml-auto inline-flex items-center gap-[6px]"><span className="text-[11.5px] font-semibold uppercase tracking-[.04em] text-muted">{c.deal.stage} · {dealNo(openDeal)}</span><Select value={openDeal.stageId ?? ""} onChange={(v) => move(openDeal, v)} options={crm.stages.map((s) => ({ value: s.id, label: stageName(s, t, lang) }))} size="sm" menuWidth="auto" className="w-[170px]" disabled={ro} /></span>}
        </div>
      </div>

      <div className="grid grid-cols-[1fr_460px] gap-4 max-[1100px]:grid-cols-1">
        {/* ---- основная колонка: данные, сделки, задачи ---- */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className={card}>
            <div className="mb-3 text-[13px] font-semibold text-ink">{c.card.info}</div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-x-4 gap-y-3">
              {field(c.source, sourceName(src, t))}{crm.me.members.length > 1 && !ro ? <div key="owner" className="min-w-0"><div className="text-[11px] font-medium text-muted">{c.owner}</div><Select value={cl.ownerId ?? ""} onChange={async (v) => { const prev = cl.ownerId; patchLocal({ ownerId: v || null }); try { await patchClient(cl.id, { ownerId: v || null }); load(); } catch (e) { patchLocal({ ownerId: prev }); err(e); } }} options={[{ value: "", label: c.tbl.unassigned }, ...crm.me.members.map((mm) => ({ value: mm.id, label: mm.name }))]} size="sm" menuWidth="auto" className="mt-[2px] w-full" /></div> : field(c.owner, owner?.name)}{field(c.client.branch, crm.me.branches.find((b) => b.id === cl.branchId)?.name)}{field(c.client.country, countryName(cl.country, lang))}{field(c.client.citizenship, countryName(cl.citizenship, lang))}{field(c.client.channel, cl.channel ? `${c.channel[cl.channel]}${cl.contactTime ? ` · ${cl.contactTime}` : ""}` : null)}{field(c.client.campaign, cl.campaign)}
              {field(c.client.ref, refLabel)}{field(c.client.created, fmtDate(cl.createdAt, lang))}{field(c.client.updated, fmtDate(cl.updatedAt, lang))}{field(c.kvkk.info, cl.kvkk.info?.method ? fill(c.kvkk.informed, { date: fmtDate(cl.kvkk.info.at, lang) }) + ` · ${c.kvkk.methods[cl.kvkk.info.method]}` : c.kvkk.notInformed)}{field(c.kvkk.consent, cl.kvkk.consent?.revokedAt ? fill(c.kvkk.revoked, { date: fmtDate(cl.kvkk.consent.revokedAt, lang) }) : (["call", "sms", "whatsapp", "email"] as const).filter((k) => cl.kvkk.consent?.[k]).map((k) => c.kvkk.ch[k]).join(", ") || c.kvkk.none)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {cl.contacts.map((x) => (
                <div key={x.id} className="flex items-center gap-1 rounded-[6px] border border-line bg-surface py-[3px] pl-2 pr-1 text-[12.5px]">
                  <span className="text-[10px] font-semibold uppercase text-muted">{c.kinds[x.kind]}{x.label ? ` · ${x.label}` : ""}</span><span className="ml-1 font-medium text-ink">{x.value}</span>
                  {(x.kind === "phone" || x.kind === "whatsapp") && <><a href={`tel:${x.value.replace(/[^\d+]/g, "")}`} className="ml-1 flex h-6 w-6 items-center justify-center rounded-[4px] text-muted hover:bg-bg-2 hover:text-ink"><IconPhone size={13} /></a><a href={waOf(x.value)} target="_blank" rel="noreferrer" className="flex h-6 w-6 items-center justify-center rounded-[4px] text-[#25d366] hover:bg-bg-2"><IconBrandWhatsapp size={14} /></a></>}
                  {x.kind === "telegram" && <a href={`https://t.me/${x.value.replace(/^@/, "").replace(/^https?:\/\/t\.me\//, "")}`} target="_blank" rel="noreferrer" title="Telegram" className="ml-1 flex h-6 w-6 items-center justify-center rounded-[4px] text-[#229ed9] hover:bg-bg-2"><IconBrandTelegram size={14} /></a>}
                  {x.kind === "email" && <a href={`mailto:${x.value}`} className="ml-1 flex h-6 w-6 items-center justify-center rounded-[4px] text-muted hover:bg-bg-2 hover:text-ink"><IconMail size={13} /></a>}
                  <button type="button" onClick={() => copy(x.value)} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[4px] text-muted hover:bg-bg-2 hover:text-ink"><IconCopy size={12} /></button>
                  {!ro && cl.contacts.length > 1 && <button type="button" title={c.client.removeContact} onClick={async () => { if (!(await confirmDialog({ text: `${x.value} — ${c.client.removeContact}?`, danger: true }))) return; setData((d) => (d ? { ...d, client: { ...d.client, contacts: d.client.contacts.filter((y) => y.id !== x.id) } } : d)); try { await removeContact(x.id); } catch (e) { err(e); load(); } }} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[4px] text-muted hover:bg-red-tint hover:text-red"><IconX size={12} /></button>}
                </div>
              ))}
              {/* добавить контакт — всплывающее поле на месте, без всей формы (правило пользователя 12.10.2026) */}
              <QuickContact clientId={cl.id} disabled={ro} onAdded={(x) => { setData((d) => (d ? { ...d, client: { ...d.client, contacts: [...d.client.contacts, x] } } : d)); load(); }} />
            </div>
            {cl.notes && <div className="mt-3 whitespace-pre-line rounded-[6px] bg-[#fafbfc] px-3 py-2 text-[12.5px] text-text">{cl.notes}</div>}
            {dups.length > 0 && (
              <div className="mt-3 rounded-[6px] border border-[#f5d58a] bg-[#fff8e6] p-3 text-[12.5px]">
                <div className="mb-1 font-semibold text-ink">{dups.length > 1 ? c.client.dupMany : c.client.dup}:</div>
                {dups.map((d) => <div key={d.clientId} className="flex flex-wrap items-center gap-2"><Link href={`${crm.base}/c/${d.clientId}`} className="font-medium text-blue-2 hover:underline">{d.name}</Link><span className="text-muted">{c.kinds[d.kind]}</span><button type="button" onClick={() => merge(d)} disabled={ro} className="cursor-pointer text-[12px] font-semibold text-ink underline">{c.client.dupMerge}</button></div>)}
              </div>
            )}
            <div className="mt-3 flex flex-wrap gap-2 border-t border-line pt-3">
              <button type="button" onClick={archive} disabled={ro} className={btnS}><IconArchive size={14} /> {cl.status === "active" ? c.client.archive : c.client.unarchive}</button>
              <button type="button" onClick={del} disabled={ro} className={btnD}><IconTrash size={14} /> {c.client.delete}</button>
            </div>
          </div>

          {/* ---- заявки (0017): одна карточка клиента — несколько потребностей ---- */}
          <div className={card}>
            <div className="mb-3 flex items-center justify-between"><div className="text-[13px] font-semibold text-ink">{c.rq.title} · {requests.length}</div><button type="button" onClick={() => setReqM({ open: true, req: null })} disabled={ro} className={btnS}><IconPlus size={14} /> {c.rq.add}</button></div>
            {requests.length === 0 ? (
              <div className="flex flex-wrap items-center gap-2 text-[13px] text-muted">{c.rq.none}{REQUEST_KINDS.map((k) => <button key={k} type="button" disabled={ro} onClick={() => setReqM({ open: true, req: null, kind: k })} className="h-7 cursor-pointer rounded-full border border-line bg-surface px-3 text-[12px] font-medium text-text hover:bg-bg-3">+ {c.rq.kinds[k]}</button>)}</div>
            ) : (
              <div className="flex flex-col gap-2">{requests.map((r) => (
                <div key={r.id} className="rounded-[6px] border border-line px-3 py-2">
                  {/* строка 1 — тип и суть (одна строка, обрезается); группа управления переносится целиком (13.10.2026) */}
                  <div className="flex flex-wrap items-center gap-2">
                    <div className="flex min-w-[240px] flex-[1_1_320px] items-center gap-2">
                  <span className="inline-flex items-center rounded-[4px] px-2 py-[2px] text-[11.5px] font-semibold text-white" style={{ background: REQ_COLOR[r.kind] }}>{c.rq.kinds[r.kind]}</span>
                  <button type="button" onClick={() => setReqM({ open: true, req: r })} className="min-w-0 flex-1 cursor-pointer truncate text-left text-[13px] text-ink hover:text-blue-2" title={reqSummary(r.kind, r.fields)}>{reqSummary(r.kind, r.fields) || c.rq.details}</button>
                  <button type="button" onClick={() => setOpenReq((m) => ({ ...m, [r.id]: m[r.id] !== true }))} title={openReq[r.id] !== true ? c.rq.show : c.rq.hide} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[4px] text-muted hover:bg-bg-2 hover:text-ink">{openReq[r.id] !== true ? <IconChevronDown size={15} /> : <IconChevronUp size={15} />}</button>
                    </div>
                    <div className="ml-auto flex flex-none items-center gap-2">
                  {r.priority && <span className="h-2 w-2 rounded-full" title={c.prio[r.priority]} style={{ background: PRIO_COLOR[r.priority] }} />}
                  {r.deadline && <span className="text-[12px] text-muted">{c.rq.dl[r.deadline]}</span>}
                  <Select value={r.status} onChange={async (v) => { const st = v as RequestStatus; setData((d) => (d ? { ...d, requests: d.requests.map((q) => (q.id === r.id ? { ...q, status: st } : q)) } : d)); try { await setRequestStatus(r.id, st); load(); } catch (e) { err(e); load(); } }} options={(Object.keys(c.rq.st) as RequestStatus[]).map((k) => ({ value: k, label: c.rq.st[k] }))} size="sm" className="w-[150px]" disabled={ro} />
                  <button type="button" onClick={() => setReqM({ open: true, req: r })} disabled={ro} title={c.client.edit} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[4px] text-muted hover:bg-bg-2 hover:text-ink"><IconPencil size={14} /></button>
                  <button type="button" onClick={async () => { if (!(await confirmDialog({ text: c.rq.delQ, danger: true }))) return; try { await deleteRequest(r.id); load(); } catch (e) { err(e); } }} disabled={ro} className="h-8 cursor-pointer px-2 text-[12px] text-muted hover:text-red">✕</button>
                    </div>
                  </div>
                  {openReq[r.id] === true && <div className="mt-2 border-t border-line pt-2"><RequestDetails r={r} briefs={briefs} onEdit={() => setReqM({ open: true, req: r })} /></div>}
                </div>))}</div>
            )}
          </div>

          <div className={card}>
            <div className="mb-3 flex items-center justify-between"><div className="text-[13px] font-semibold text-ink">{c.client.deals} · {deals.length}</div><button type="button" onClick={() => setDealM({ open: true, deal: null })} disabled={ro} className={btnS}><IconPlus size={14} /> {c.deal.add}</button></div>
            {deals.length === 0 ? <div className="text-[13px] text-muted">{c.deal.none}</div> : (
              <div className="flex flex-col gap-3">{deals.map((d) => { const st = crm.stages.find((s) => s.id === d.stageId); return (
                <div key={d.id} className="rounded-[6px] border border-line p-3">
                  <div className="flex flex-wrap items-start gap-2">
                    <span className="mt-[6px] h-[9px] w-[9px] flex-none rounded-full" style={{ background: st?.color ?? "#8a93a2" }} />
                    <Link href={`${crm.base}/d/${d.id}`} className="min-w-0 flex-1 cursor-pointer text-left"><div className="text-[13.5px] font-semibold text-ink hover:text-blue-2">{d.title || "—"} <span className="text-[11.5px] font-normal text-muted">{dealNo(d)}</span></div><div className="text-[12px] text-muted">{t.deal[d.deal as keyof typeof t.deal]}{d.amount != null ? ` · ${fmt(d.amount, d.cur as Currency)}` : ""}{d.closedAt ? ` · ${c.deal.closed} ${fmtDate(d.closedAt, lang)}` : ""}{d.lostReason ? ` · ${d.lostReason}` : ""}</div></Link>
                    <Select value={d.stageId ?? ""} onChange={(v) => move(d, v)} options={crm.stages.map((s) => ({ value: s.id, label: stageName(s, t, lang) }))} size="sm" className="w-[170px]" disabled={ro} />
                    <button type="button" onClick={() => delDeal(d)} disabled={ro} className="h-8 cursor-pointer px-2 text-[12px] text-muted hover:text-red">✕</button>
                  </div>
                  {(() => { const r = dealRef(d); return r ? <div className="mt-2"><ObjCard r={r} briefs={briefs} /></div> : null; })()}
                  <DocsPanel dealId={d.id} dealKind={d.deal} onChange={load} />
                </div>); })}</div>
            )}
          </div>

          <div className={card}>
            <div className="mb-2 flex items-center justify-between"><div className="text-[13px] font-semibold text-ink">{c.client.tasks} · {openTasks.length}</div><button type="button" onClick={() => setTaskM({ open: true, task: null })} disabled={ro} className={btnS}><IconPlus size={14} /> {c.task.add}</button></div>
            {openTasks.length === 0 ? <div className="text-[12.5px] text-muted">{c.task.none}</div> : <div className="flex flex-col gap-1">{openTasks.map((x) => <div key={x.id} className="flex items-center gap-2 rounded-[6px] border border-line px-2 py-[6px]"><button type="button" onClick={async () => { try { await doneTask(x.id, true); load(); } catch (e) { err(e); } }} disabled={ro} className="h-5 w-5 flex-none cursor-pointer rounded-full border-2 border-line hover:border-blue" /><button type="button" onClick={() => setTaskM({ open: true, task: x })} className="min-w-0 flex-1 cursor-pointer text-left"><div className="truncate text-[12.5px] font-medium text-ink">{x.title}</div><div className={`text-[11px] ${new Date(x.dueAt) < new Date() ? "font-semibold text-red" : "text-muted"}`}>{taskKindName(x.kind, t)} · {fmtDT(x.dueAt, lang)}</div></button></div>)}</div>}
          </div>
        </div>

        {/* ---- правая колонка: лента активности с комментарием ---- */}
        <div className={`${card} self-start min-[1101px]:sticky min-[1101px]:top-[160px]`}>
          <div className="mb-2 flex items-center justify-between"><span className="text-[13px] font-semibold text-ink">{c.card.activity}</span><button type="button" onClick={() => setTaskM({ open: true, task: null })} disabled={ro} className={`${btnS} h-7 px-2 text-[12px]`}><IconPlus size={13} /> {c.card.task}</button></div>
          {/* поле комментария во всю ширину колонки, кнопка под ним (замечание пользователя 11.10.2026 — «форма мелкая, текст не виден») */}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") sendNote(); }} placeholder={c.ev.addPh} disabled={ro} className={`${inp} h-auto min-h-[84px] w-full resize-y py-2 leading-[1.45]`} rows={3} />
          <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[11px] text-muted">⌘/Ctrl + Enter</span><button type="button" onClick={sendNote} disabled={ro || !note.trim()} className={btnP}>{c.ev.add}</button></div>
          <div className="mt-4"><Timeline events={events} /></div>
        </div>
      </div>

      <TransferModal open={transfer} title={c.client.transferOne} hint={c.client.transferH} busy={trBusy} prefer={crm.me.members.filter((m) => m.id !== cl.ownerId && m.id !== crm.me.meId).map((m) => ({ id: m.id, name: m.name }))} onClose={() => setTransfer(false)} onPick={async (toId, target) => { setTrBusy(true); try { const r = await transferClient(cl.id, toId); setTransfer(false); showToast(fill(c.client.transferDone, { name: target?.name ?? crm.me.members.find((m) => m.id === toId)?.name ?? "" })); if (r.moved) { crm.closeTab?.(cl.id); router.push(`${crm.base}/clients`); } else load(); } catch (e) { crmError(e, c.errSave, c.errReadonly); } finally { setTrBusy(false); } }} />
      <RequestModal open={reqM.open} clientId={cl.id} request={reqM.req} kind={reqM.kind} briefs={briefs} onClose={() => setReqM({ open: false, req: null })} onSaved={() => { setReqM({ open: false, req: null }); load(); }} />
      <DossierModal open={dossier} clientId={cl.id} clientName={cl.name} value={cl.dossier} onClose={() => setDossier(false)} onSaved={(v) => { patchLocal({ dossier: v }); setDossier(false); load(); }} />
      <ClientModal open={edit} client={cl} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); load(); }} onOpenDup={(x) => router.push(`${crm.base}/c/${x}`)} />
      <DealModal open={dealM.open} deal={dealM.deal} clients={[{ id: cl.id, name: cl.name }]} clientId={cl.id} briefs={briefs} requests={requests.map((r) => ({ id: r.id, label: `${c.rq.kinds[r.kind]}${reqSummary(r.kind, r.fields) ? ` · ${reqSummary(r.kind, r.fields)}` : ""}` }))} onClose={() => setDealM({ open: false, deal: null })} onSaved={() => { setDealM({ open: false, deal: null }); load(); }} />
      <TaskModal open={taskM.open} task={taskM.task} clients={[{ id: cl.id, name: cl.name }]} clientId={cl.id} onClose={() => setTaskM({ open: false, task: null })} onSaved={() => { setTaskM({ open: false, task: null }); load(); }} />
    </>
  );
}

/** Приоритет как чип-статус (13.10.2026): клик — меню из четырёх значений; цвет = приоритет. */
function PriorityChip({ value, onChange, disabled }: { value: Priority | null; onChange: (v: Priority | null) => void; disabled?: boolean }) {
  const { t } = useI18n();
  const c = t.crm;
  const [open, setOpen] = useState(false);
  const col = value ? PRIO_COLOR[value] : "#8a93a2";
  const opts: (Priority | null)[] = ["hot", "warm", "cold", null];
  return (
    <span className="relative inline-block">
      <button type="button" disabled={disabled} onClick={() => setOpen((v) => !v)} className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-[5px] px-2 text-[12px] font-medium hover:brightness-95 disabled:cursor-default" style={{ background: col + "1f", color: col }}><span className="h-[7px] w-[7px] rounded-full" style={{ background: col }} />{value ? c.prio[value] : c.prio.none}{!disabled && <IconChevronDown size={12} className="opacity-70" />}</button>
      {open && (
        <div className="absolute left-0 top-[calc(100%+4px)] z-30 w-[180px] rounded-[8px] border border-line bg-surface p-1 shadow-[0_12px_40px_rgba(20,36,63,.16)]" onMouseLeave={() => setOpen(false)}>
          {opts.map((k) => <button key={k ?? "none"} type="button" onClick={() => { setOpen(false); onChange(k); }} className={`flex w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 py-[6px] text-left text-[12.5px] hover:bg-bg-3 ${k === value ? "font-semibold text-ink" : "text-text"}`}><span className="h-[7px] w-[7px] rounded-full" style={{ background: k ? PRIO_COLOR[k] : "#c9d0dc" }} />{k ? c.prio[k] : c.prio.none}</button>)}
        </div>
      )}
    </span>
  );
}

const ACT_FILTERS: Record<string, string[] | null> = { all: null, notes: ["note", "call", "show", "meeting"], tasks: ["task"], deals: ["deal", "stage"], docs: ["doc"], system: ["created", "edit", "request", "transfer", "lead", "merge", "contact"] };
export function Timeline({ events }: { events: CrmEvent[] }) {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const [tr, setTr] = useState<Record<number, { busy?: boolean; text?: string; show?: boolean }>>({});
  const [flt, setFlt] = useState("all");
  const [sysOpen, setSysOpen] = useState(false);
  // «Все»: системные события (правки карточки, заявки, передачи) свёрнуты в одну строку — как в Attio 2026
  const sysN = flt === "all" ? events.filter((e) => ACT_FILTERS.system!.includes(e.kind)).length : 0;
  const shown = ACT_FILTERS[flt] ? events.filter((e) => ACT_FILTERS[flt]!.includes(e.kind)) : sysOpen ? events : events.filter((e) => !ACT_FILTERS.system!.includes(e.kind));
  const chips = (
    <div className="mb-3 flex flex-wrap gap-1">{Object.keys(ACT_FILTERS).map((k) => { const n = ACT_FILTERS[k] ? events.filter((e) => ACT_FILTERS[k]!.includes(e.kind)).length : events.length; return <button key={k} type="button" onClick={() => setFlt(k)} className={`inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border px-[10px] text-[12px] font-medium ${flt === k ? "border-ink bg-ink text-white" : "border-line bg-surface text-text hover:bg-bg-3"}`}>{(c.act as Record<string, string>)[k]}<span className={flt === k ? "text-white/70" : "text-muted"}>{n}</span></button>; })}</div>
  );
  const stName = (id: unknown) => stageName(crm.stages.find((s) => s.id === id), t, lang);
  const label = (e: CrmEvent): string => {
    const p = e.payload as Record<string, string>;
    switch (e.kind) {
      case "stage": return fill(c.ev.stage, { from: stName(p.from), to: stName(p.to) });
      case "task": return fill(c.ev.task, { title: p.title ?? "" });
      case "deal": return fill(c.ev.deal, { title: p.title ?? "" });
      case "doc": return fill(c.ev.doc, { title: p.title ?? "" });
      case "lead": return fill(c.ev.lead, { source: sourceName(crm.sources.find((s) => s.id === p.sourceId), t) });
      case "request": return fill(p.edit ? c.ev.requestEdit : c.ev.request, { kind: (c.rq.kinds as Record<string, string>)[p.requestKind] ?? p.requestKind ?? "" });
      default: return (c.ev as Record<string, string>)[e.kind] ?? e.kind;
    }
  };
  async function translateIt(e: CrmEvent) {
    const cur = tr[e.id];
    if (cur?.text) { setTr((m) => ({ ...m, [e.id]: { ...cur, show: !cur.show } })); return; }
    setTr((m) => ({ ...m, [e.id]: { busy: true } }));
    try { const text = e.tr[lang] ?? (await translateNote(e.id, lang as Lang)); setTr((m) => ({ ...m, [e.id]: { text, show: true } })); }
    catch { showToast(c.ev.trErr); setTr((m) => ({ ...m, [e.id]: {} })); }
  }
  if (!events.length) return <div className="text-[13px] text-muted">{c.card.noActivity}</div>;
  const sysLine = sysN > 0 && flt === "all" ? <button type="button" onClick={() => setSysOpen((v) => !v)} className="mt-2 cursor-pointer text-[12px] text-muted hover:text-ink">{fill(c.act.systemN, { n: sysN })} · {sysOpen ? c.act.hide : c.act.show}</button> : null;
  if (!shown.length) return <>{chips}<div className="text-[13px] text-muted">{c.notFound}</div>{sysLine}</>;
  const tone: Record<string, string> = { note: "#4d7cfe", call: "#22c15e", show: "#f5a623", meeting: "#7b4fd0", lead: "#0ea5a4", doc: "#e06aa3", stage: "#8a93a2" };
  return (
    <>{chips}
    <div className="relative flex flex-col gap-3 pl-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-[2px] before:bg-line">
      {shown.map((e) => {
        const who = crm.me.members.find((m) => m.id === e.actorId)?.name;
        const x = tr[e.id];
        return (
          <div key={e.id} className="relative">
            <span className="absolute -left-5 top-[5px] h-3 w-3 rounded-full border-2 border-surface" style={{ background: tone[e.kind] ?? "#c9d0dc" }} />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-muted">{fmtDT(e.createdAt, lang)}{who ? ` · ${who}` : ""} · <span className="font-semibold text-text">{label(e)}</span></div>
              {e.text && (
                <div className="mt-1 rounded-[6px] border border-line bg-[#fafbfc] px-3 py-2 text-[13px] text-ink">
                  <div className="whitespace-pre-line">{x?.show && x.text ? x.text : e.text}</div>
                  <button type="button" onClick={() => translateIt(e)} className="mt-1 inline-flex cursor-pointer items-center gap-1 text-[11.5px] font-bold text-blue-2 hover:underline"><IconLanguage size={13} /> {x?.busy ? c.ev.translating : x?.show ? c.ev.original : c.ev.translate}</button>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
    {sysLine}
    </>
  );
}

/** Объект базы в карточке клиента (заявка/сделка → объявление). */

/** Заполненные поля заявки по группам (значения по реестру), объект — карточкой. */
function RequestDetails({ r, briefs, onEdit }: { r: CrmRequest; briefs: Briefs; onEdit: () => void }) {
  const { t, lang } = useI18n();
  const c = t.crm; const rq = c.rq;
  const crm = useCrm();
  const fields = REQUEST_FIELDS[r.kind];
  const val = (k: string, v: unknown, type: string, opts?: string): string | null => {
    if (v == null || v === "" || (Array.isArray(v) && !v.length)) return null;
    const ol = (o: string) => (opts ? (rq.o as Record<string, Record<string, string>>)[opts]?.[o] ?? o : o);
    switch (type) {
      case "money": return fmt(Number(v), ((r.fields.cur as string) || "TRY") as Currency);
      case "cur": return null;
      case "select": return ol(String(v));
      case "multi": return (v as string[]).map(ol).join(", ");
      case "bool": return v ? "✓" : null;
      case "date": return fmtDate(String(v), lang);
      case "geo": return wantGeoLabel(v as { il?: string }, "");
      case "rooms": return (v as string[]).join(", ");
      case "listing": return null;
      case "clients": return `${(v as string[]).length}`;
      default: return String(v);
    }
  };
  const rows: { g: string; k: string; label: string; v: string; closed?: boolean }[] = [];
  for (const g of GROUP_ORDER) for (const f of fields.filter((x) => x.group === g)) { const raw = f.closed ? r.closed[f.key] : r.fields[f.key]; const v = val(f.key, raw, f.type, f.opts); if (v) rows.push({ g, k: f.key, label: (rq.f as Record<string, string>)[f.key] ?? f.key, v, closed: f.closed }); }
  const owner = crm.me.members.find((m) => m.id === r.ownerId);
  const groups = [...new Set(rows.map((x) => x.g))];
  return (
    <div className="flex flex-col gap-2">
      {r.listingId && <ObjCard r={{ kind: "listing", id: r.listingId }} briefs={briefs} />}
      {r.variants.length > 0 && <div><div className="mb-1 text-[11px] font-semibold uppercase tracking-[.04em] text-muted">{c.obj.variants} · {r.variants.length}</div><div className="flex flex-col gap-1">{r.variants.map((v, i) => <ObjCard key={i} r={v} briefs={briefs} compact />)}</div></div>}
      {rows.length === 0 ? <button type="button" onClick={onEdit} className="cursor-pointer text-left text-[12.5px] text-muted hover:text-ink">{rq.noFields}</button> : groups.map((g) => (
        <div key={g}>
          <div className="mb-1 text-[11px] font-semibold uppercase tracking-[.04em] text-muted">{rq.g[g as keyof typeof rq.g]}</div>
          <div className="grid grid-cols-3 gap-x-4 gap-y-[6px] max-[1100px]:grid-cols-2 max-md:grid-cols-1">{rows.filter((x) => x.g === g).map((x) => <div key={x.k} className={`min-w-0 ${x.v.length > 40 ? "col-span-3 max-[1100px]:col-span-2 max-md:col-span-1" : ""}`}><div className="text-[11px] text-muted">{x.label}{x.closed ? " 🔒" : ""}</div><div className="whitespace-normal break-words text-[13px] leading-[1.4] text-ink">{x.v}</div></div>)}</div>
        </div>
      ))}
      <div className="flex items-center gap-3 text-[11.5px] text-muted"><span>{owner ? `${c.owner}: ${owner.name} · ` : ""}{fmtDate(r.updatedAt, lang)}</span><button type="button" onClick={onEdit} className="inline-flex cursor-pointer items-center gap-1 font-semibold text-blue-2 hover:underline"><IconPencil size={12} /> {c.client.edit}</button></div>
    </div>
  );
}

/** «+ Добавить контакт»: маленькое поле на месте — тип, значение, подпись; Enter сохраняет, Esc закрывает. */
function QuickContact({ clientId, disabled, onAdded }: { clientId: string; disabled: boolean; onAdded: (x: Contact) => void }) {
  const { t } = useI18n(); const c = t.crm;
  const [open, setOpen] = useState(false);
  const [kind, setKind] = useState<ContactKind>("phone");
  const [value, setValue] = useState("");
  const [label, setLabel] = useState("");
  const [busy, setBusy] = useState(false);
  async function save() {
    if (!value.trim() || busy) return; setBusy(true);
    try { onAdded(await addContact(clientId, { kind, value, label })); setValue(""); setLabel(""); setOpen(false); }
    catch (e) { crmError(e, c.errSave, c.errReadonly); } finally { setBusy(false); }
  }
  if (!open) return <button type="button" onClick={() => setOpen(true)} disabled={disabled} className="inline-flex h-[30px] cursor-pointer items-center gap-1 rounded-[6px] border border-dashed border-line px-2 text-[12.5px] font-medium text-blue-2 hover:bg-blue-tint disabled:opacity-50"><IconPlus size={13} /> {c.client.addContact}</button>;
  return (
    <div data-crm-form="1" className="flex flex-wrap items-center gap-2 rounded-[6px] border border-sel-line bg-blue-tint/40 p-2">
      <Select value={kind} onChange={(v) => setKind(v as ContactKind)} options={(["phone", "whatsapp", "email", "telegram", "other"] as ContactKind[]).map((k) => ({ value: k, label: c.kinds[k] }))} size="sm" className="w-[130px]" />
      <input autoFocus value={value} onChange={(e) => setValue(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") save(); if (e.key === "Escape") setOpen(false); }} placeholder={kind === "email" ? "name@mail.com" : kind === "telegram" ? "@login" : "+90 5xx xxx xx xx"} className={`${inp} w-[200px]`} />
      <Select value={label} onChange={setLabel} options={contactLabelOptions(label, c.client.labels, c.client.label)} size="sm" menuWidth="auto" className="w-[150px]" />
      <button type="button" onClick={save} disabled={busy || !value.trim()} className={btnP}>{c.ev.add}</button>
      <button type="button" onClick={() => setOpen(false)} className={btnS}>{c.cancel}</button>
    </div>
  );
}
