"use client";

// Карточка клиента: контакты, что ищет, сделки, задачи, история с заметками (перевод по кнопке того, кто смотрит).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IconArchive, IconBrandWhatsapp, IconCopy, IconLanguage, IconMail, IconPencil, IconPhone, IconPlus, IconTrash } from "@tabler/icons-react";
import { addNote, crmBootstrap, deleteClient, deleteDeal, deleteRequest, doneTask, findDups, getClient, mergeClients, moveDeal, setClientStatus, setRequestStatus, translateNote } from "@/app/crm/actions";
import { confirmDialog } from "@/components/ui/confirm";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import type { Lang } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import type { Client, CrmEvent, CrmMe, CrmRequest, Deal, DupHit, EventKind, RequestKind, RequestStatus, Source, Stage, Task } from "@/lib/crm/types";
import { REQUEST_KINDS } from "@/lib/crm/requestFields";
import { RequestModal } from "./RequestModal";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { ClientModal } from "./ClientModal";
import { DealModal, TaskModal } from "./CrmModals";
import { DocsPanel } from "./DocsPanel";
import { CrmCtx, PRIO_COLOR, REQ_COLOR, btnD, btnP, btnS, card, chip, countryName, fill, fmtDT, fmtDate, initials, inp, reqSummary, sourceName, stageName, taskKindName, useCrm } from "./crmUi";

/** `embedded` — внутри CrmShell (контекст уже есть); иначе страница сама грузит bootstrap. */
export function ClientPage({ base, id, embedded }: { base: string; id: string; embedded?: boolean }) {
  const [boot, setBoot] = useState<{ me: CrmMe; stages: Stage[]; sources: Source[] } | null>(null);
  const load = useCallback(() => { if (!embedded) crmBootstrap().then(setBoot).catch(() => {}); }, [embedded]);
  useEffect(() => { load(); }, [load]);
  if (embedded) return <Inner id={id} />;
  if (!boot) return <div className="py-10 text-center text-[13px] text-muted">…</div>;
  const ctx = { me: boot.me, stages: boot.stages, sources: boot.sources, base, refresh: load, setStages: (s: Stage[]) => setBoot((b) => (b ? { ...b, stages: s } : b)), setSources: (s: Source[]) => setBoot((b) => (b ? { ...b, sources: s } : b)) };
  return <CrmCtx.Provider value={ctx}><Inner id={id} /></CrmCtx.Provider>;
}

function Inner({ id }: { id: string }) {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const router = useRouter();
  const [data, setData] = useState<{ client: Client; deals: Deal[]; tasks: Task[]; events: CrmEvent[]; requests: CrmRequest[] } | null | undefined>(undefined);
  const [reqM, setReqM] = useState<{ open: boolean; req: CrmRequest | null; kind?: RequestKind }>({ open: false, req: null });
  const [edit, setEdit] = useState(false);
  const [dealM, setDealM] = useState<{ open: boolean; deal: Deal | null }>({ open: false, deal: null });
  const [taskM, setTaskM] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [note, setNote] = useState("");
  const [noteKind, setNoteKind] = useState<EventKind>("note");
  const [dups, setDups] = useState<DupHit[]>([]);
  const ro = crm.me.access !== "full";
  const load = useCallback(() => { getClient(id).then((d) => { setData(d); if (d) crm.openTab?.(d.client.id, d.client.name); if (d) findDups(d.client.contacts.map((x) => ({ kind: x.kind, value: x.value })), d.client.id).then(setDups).catch(() => {}); }).catch(() => setData(null));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);
  useEffect(() => { load(); }, [load]);

  if (data === undefined) return <div className="py-10 text-center text-[13px] text-muted">…</div>;
  if (data === null) return <div className={card}>{c.notFound} · <Link href={`${crm.base}/clients`} className="text-blue-2">{c.nav.clients}</Link></div>;
  const { client: cl, deals, tasks, events, requests } = data;
  const err = (e: unknown) => showToast((e as Error).message === "readonly" ? c.errReadonly : c.errSave);
  const src = crm.sources.find((s) => s.id === cl.sourceId);
  const owner = crm.me.members.find((m) => m.id === cl.ownerId);
  const waOf = (v: string) => `https://wa.me/${v.replace(/\D/g, "").replace(/^0/, "90")}`;
  const copy = (v: string) => { navigator.clipboard?.writeText(v).then(() => showToast(c.client.copied)); };

  async function sendNote() {
    if (!note.trim()) return;
    try { await addNote(cl.id, null, noteKind, note); setNote(""); load(); } catch (e) { err(e); }
  }
  async function archive() { try { await setClientStatus(cl.id, cl.status === "active" ? "archived" : "active"); load(); } catch (e) { err(e); } }
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
    try { await moveDeal(d.id, stageId, picked); load(); } catch (e) { err(e); }
  }
  async function delDeal(d: Deal) { if (!(await confirmDialog({ text: c.deal.delQ, danger: true }))) return; try { await deleteDeal(d.id); load(); } catch (e) { err(e); } }

  const refLabel = cl.refKind === "none" ? null : cl.refKind === "text" ? cl.refText : cl.refKind === "realtor" ? c.client.refRealtor : c.client.refAgency;
  const mainPhone = cl.contacts.find((x) => x.kind === "phone" || x.kind === "whatsapp");
  const openDeal = deals.find((d) => !d.closedAt);
  const openTasks = tasks.filter((x) => !x.doneAt);
  const field = (l: string, v?: string | null) => v ? <div key={l} className="min-w-0"><div className="text-[11px] font-medium text-muted">{l}</div><div className="truncate text-[13px] text-ink">{v}</div></div> : null;
  return (
    <>
      {/* шапка карточки — образец пользователя: имя · номер, строка с телефоном/источником/ответственным, справа этап и действия */}
      <div className="-mx-4 -mt-4 mb-4 flex flex-wrap items-center gap-4 border-b border-line bg-surface px-5 py-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-blue-tint text-[14px] font-semibold text-sel-ink">{initials(cl.name)}</span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h1 className="text-[17px] font-semibold text-ink">{cl.name}</h1><span className="text-[14px] text-muted">· #{cl.id.slice(0, 8).toUpperCase()}</span><span className={chip}>{cl.lang}</span>{cl.priority && <span className="inline-flex items-center gap-1 rounded-[4px] px-[6px] py-[1px] text-[11px] font-semibold text-white" style={{ background: PRIO_COLOR[cl.priority] }}>{c.prio[cl.priority]}</span>}{cl.roles.map((r) => <span key={r} className={chip}>{c.roles[r]}</span>)}{cl.kind === "company" && cl.company && <span className={chip}>{cl.company}</span>}{cl.status === "archived" && <span className={chip}>{c.archived}</span>}{cl.tags.map((x) => <span key={x} className={chip}>{x}</span>)}</div>
          <div className="mt-[2px] truncate text-[13px] text-text">{[mainPhone?.value, sourceName(src, t), owner?.name].filter(Boolean).join(" · ")}</div>
        </div>
        {openDeal && <Select value={openDeal.stageId ?? ""} onChange={(v) => move(openDeal, v)} options={crm.stages.map((s) => ({ value: s.id, label: stageName(s, t, lang) }))} size="sm" className="w-[170px]" disabled={ro} />}
        {mainPhone && <a href={`tel:${mainPhone.value.replace(/[^\d+]/g, "")}`} className={btnP}><IconPhone size={14} /> {c.client.call}</a>}
        {mainPhone && <a href={waOf(mainPhone.value)} target="_blank" rel="noreferrer" className={btnS}><IconBrandWhatsapp size={15} /> {c.client.wa}</a>}
        <button type="button" onClick={() => setEdit(true)} disabled={ro} className={btnS}><IconPencil size={14} /> {c.client.edit}</button>
      </div>

      <div className="grid grid-cols-[1fr_460px] gap-4 max-[1100px]:grid-cols-1">
        {/* ---- основная колонка: данные, сделки, задачи ---- */}
        <div className="flex min-w-0 flex-col gap-4">
          <div className={card}>
            <div className="mb-3 text-[13px] font-semibold text-ink">{c.card.info}</div>
            <div className="grid grid-cols-4 gap-x-4 gap-y-3 max-md:grid-cols-2">
              {field(c.client.stage, c.cstage[cl.stage])}{field(c.client.priority, cl.priority ? c.prio[cl.priority] : null)}{field(c.source, sourceName(src, t))}{field(c.owner, owner?.name)}{field(c.client.branch, crm.me.branches.find((b) => b.id === cl.branchId)?.name)}{field(c.client.country, countryName(cl.country, lang))}{field(c.client.channel, cl.channel ? `${c.channel[cl.channel]}${cl.contactTime ? ` · ${cl.contactTime}` : ""}` : null)}{field(c.client.campaign, cl.campaign)}
              {field(c.client.ref, refLabel)}{field(c.client.created, fmtDate(cl.createdAt, lang))}{field(c.client.updated, fmtDate(cl.updatedAt, lang))}{field(c.kvkk.info, cl.kvkk.info?.method ? fill(c.kvkk.informed, { date: fmtDate(cl.kvkk.info.at, lang) }) + ` · ${c.kvkk.methods[cl.kvkk.info.method]}` : c.kvkk.notInformed)}{field(c.kvkk.consent, cl.kvkk.consent?.revokedAt ? fill(c.kvkk.revoked, { date: fmtDate(cl.kvkk.consent.revokedAt, lang) }) : (["call", "sms", "whatsapp", "email"] as const).filter((k) => cl.kvkk.consent?.[k]).map((k) => c.kvkk.ch[k]).join(", ") || c.kvkk.none)}
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              {cl.contacts.map((x) => (
                <div key={x.id} className="flex items-center gap-1 rounded-[6px] border border-line bg-surface py-[3px] pl-2 pr-1 text-[12.5px]">
                  <span className="text-[10px] font-semibold uppercase text-muted">{c.kinds[x.kind]}{x.label ? ` · ${x.label}` : ""}</span><span className="ml-1 font-medium text-ink">{x.value}</span>
                  {(x.kind === "phone" || x.kind === "whatsapp") && <><a href={`tel:${x.value.replace(/[^\d+]/g, "")}`} className="ml-1 flex h-6 w-6 items-center justify-center rounded-[4px] text-muted hover:bg-bg-2 hover:text-ink"><IconPhone size={13} /></a><a href={waOf(x.value)} target="_blank" rel="noreferrer" className="flex h-6 w-6 items-center justify-center rounded-[4px] text-[#25d366] hover:bg-bg-2"><IconBrandWhatsapp size={14} /></a></>}
                  {x.kind === "email" && <a href={`mailto:${x.value}`} className="ml-1 flex h-6 w-6 items-center justify-center rounded-[4px] text-muted hover:bg-bg-2 hover:text-ink"><IconMail size={13} /></a>}
                  <button type="button" onClick={() => copy(x.value)} className="flex h-6 w-6 cursor-pointer items-center justify-center rounded-[4px] text-muted hover:bg-bg-2 hover:text-ink"><IconCopy size={12} /></button>
                </div>
              ))}
              {/* второй телефон / e-mail добавляются в форме редактирования — кнопка прямо у контактов (вопрос пользователя 11.10.2026) */}
              <button type="button" onClick={() => setEdit(true)} disabled={ro} className="inline-flex h-[30px] cursor-pointer items-center gap-1 rounded-[6px] border border-dashed border-line px-2 text-[12.5px] font-medium text-blue-2 hover:bg-blue-tint disabled:opacity-50"><IconPlus size={13} /> {c.client.addContact}</button>
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
                <div key={r.id} className="flex flex-wrap items-center gap-2 rounded-[6px] border border-line px-3 py-2">
                  <span className="inline-flex items-center rounded-[4px] px-2 py-[2px] text-[11.5px] font-semibold text-white" style={{ background: REQ_COLOR[r.kind] }}>{c.rq.kinds[r.kind]}</span>
                  <button type="button" onClick={() => setReqM({ open: true, req: r })} className="min-w-0 flex-1 cursor-pointer text-left text-[13px] text-ink hover:text-blue-2">{reqSummary(r.kind, r.fields) || c.rq.details}</button>
                  {r.priority && <span className="h-2 w-2 rounded-full" title={c.prio[r.priority]} style={{ background: PRIO_COLOR[r.priority] }} />}
                  {r.deadline && <span className="text-[12px] text-muted">{c.rq.dl[r.deadline]}</span>}
                  <Select value={r.status} onChange={async (v) => { try { await setRequestStatus(r.id, v as RequestStatus); load(); } catch (e) { err(e); } }} options={(Object.keys(c.rq.st) as RequestStatus[]).map((k) => ({ value: k, label: c.rq.st[k] }))} size="sm" className="w-[150px]" disabled={ro} />
                  <button type="button" onClick={async () => { if (!(await confirmDialog({ text: c.rq.delQ, danger: true }))) return; try { await deleteRequest(r.id); load(); } catch (e) { err(e); } }} disabled={ro} className="h-8 cursor-pointer px-2 text-[12px] text-muted hover:text-red">✕</button>
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
                    <button type="button" onClick={() => setDealM({ open: true, deal: d })} className="min-w-0 flex-1 cursor-pointer text-left"><div className="text-[13.5px] font-semibold text-ink hover:text-blue-2">{d.title || "—"}</div><div className="text-[12px] text-muted">{t.deal[d.deal as keyof typeof t.deal]}{d.amount != null ? ` · ${fmt(d.amount, d.cur as Currency)}` : ""}{d.closedAt ? ` · ${c.deal.closed} ${fmtDate(d.closedAt, lang)}` : ""}{d.lostReason ? ` · ${d.lostReason}` : ""}</div></button>
                    <Select value={d.stageId ?? ""} onChange={(v) => move(d, v)} options={crm.stages.map((s) => ({ value: s.id, label: stageName(s, t, lang) }))} size="sm" className="w-[170px]" disabled={ro} />
                    <button type="button" onClick={() => delDeal(d)} disabled={ro} className="h-8 cursor-pointer px-2 text-[12px] text-muted hover:text-red">✕</button>
                  </div>
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
          <div className="mb-2 flex flex-wrap gap-1">
            {(["note", "call", "show", "meeting"] as const).map((k) => <button key={k} type="button" onClick={() => setNoteKind(k)} className={`inline-flex h-7 cursor-pointer items-center rounded-[6px] border px-[10px] text-[12px] font-medium ${noteKind === k ? "border-ink bg-ink text-white" : "border-line bg-surface text-text hover:bg-bg-3"}`}>{c.ev[k]}</button>)}
            <button type="button" onClick={() => setTaskM({ open: true, task: null })} disabled={ro} className="inline-flex h-7 cursor-pointer items-center rounded-[6px] border border-line bg-surface px-[10px] text-[12px] font-medium text-text hover:bg-bg-3">{c.card.task}</button>
          </div>
          {/* поле комментария во всю ширину колонки, кнопка под ним (замечание пользователя 11.10.2026 — «форма мелкая, текст не виден») */}
          <textarea value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => { if ((e.metaKey || e.ctrlKey) && e.key === "Enter") sendNote(); }} placeholder={c.ev.addPh} disabled={ro} className={`${inp} h-auto min-h-[84px] w-full resize-y py-2 leading-[1.45]`} rows={3} />
          <div className="mt-2 flex items-center justify-between gap-2"><span className="text-[11px] text-muted">⌘/Ctrl + Enter</span><button type="button" onClick={sendNote} disabled={ro || !note.trim()} className={btnP}>{c.ev.add}</button></div>
          <div className="mt-4"><Timeline events={events} /></div>
        </div>
      </div>

      <RequestModal open={reqM.open} clientId={cl.id} request={reqM.req} kind={reqM.kind} onClose={() => setReqM({ open: false, req: null })} onSaved={() => { setReqM({ open: false, req: null }); load(); }} />
      <ClientModal open={edit} client={cl} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); load(); }} onOpenDup={(x) => router.push(`${crm.base}/c/${x}`)} />
      <DealModal open={dealM.open} deal={dealM.deal} clients={[{ id: cl.id, name: cl.name }]} clientId={cl.id} requests={requests.map((r) => ({ id: r.id, label: `${c.rq.kinds[r.kind]}${reqSummary(r.kind, r.fields) ? ` · ${reqSummary(r.kind, r.fields)}` : ""}` }))} onClose={() => setDealM({ open: false, deal: null })} onSaved={() => { setDealM({ open: false, deal: null }); load(); }} />
      <TaskModal open={taskM.open} task={taskM.task} clients={[{ id: cl.id, name: cl.name }]} clientId={cl.id} onClose={() => setTaskM({ open: false, task: null })} onSaved={() => { setTaskM({ open: false, task: null }); load(); }} />
    </>
  );
}

function Timeline({ events }: { events: CrmEvent[] }) {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const [tr, setTr] = useState<Record<number, { busy?: boolean; text?: string; show?: boolean }>>({});
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
  const tone: Record<string, string> = { note: "#4d7cfe", call: "#22c15e", show: "#f5a623", meeting: "#7b4fd0", lead: "#0ea5a4", doc: "#e06aa3", stage: "#8a93a2" };
  return (
    <div className="relative flex flex-col gap-3 pl-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-[2px] before:bg-line">
      {events.map((e) => {
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
  );
}
