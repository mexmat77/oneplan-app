"use client";

// Карточка клиента: контакты, что ищет, сделки, задачи, история с заметками (перевод по кнопке того, кто смотрит).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { IconArchive, IconArrowLeft, IconBrandWhatsapp, IconCheck, IconCopy, IconLanguage, IconPencil, IconPhone, IconPlus, IconTrash } from "@tabler/icons-react";
import { addNote, crmBootstrap, deleteClient, deleteDeal, doneTask, findDups, getClient, mergeClients, moveDeal, setClientStatus, translateNote } from "@/app/crm/actions";
import { confirmDialog } from "@/components/ui/confirm";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import type { Lang } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import type { Client, CrmEvent, CrmMe, Deal, DupHit, EventKind, Source, Stage, Task } from "@/lib/crm/types";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { GEO } from "@/lib/seed";
import { ClientModal } from "./ClientModal";
import { DealModal, TaskModal } from "./CrmModals";
import { DocsPanel } from "./DocsPanel";
import { CrmCtx, btnD, btnP, btnS, card, chip, fill, fmtDT, fmtDate, initials, inp, sourceName, stageName, taskKindName, useCrm } from "./crmUi";

export function ClientPage({ base, id }: { base: string; id: string }) {
  const [boot, setBoot] = useState<{ me: CrmMe; stages: Stage[]; sources: Source[] } | null>(null);
  const load = useCallback(() => { crmBootstrap().then(setBoot).catch(() => {}); }, []);
  useEffect(() => { load(); }, [load]);
  if (!boot) return <div className="py-10 text-center text-[13px] text-muted">…</div>;
  const ctx = { me: boot.me, stages: boot.stages, sources: boot.sources, base, refresh: load, setStages: (s: Stage[]) => setBoot((b) => (b ? { ...b, stages: s } : b)), setSources: (s: Source[]) => setBoot((b) => (b ? { ...b, sources: s } : b)) };
  return <CrmCtx.Provider value={ctx}><Inner id={id} /></CrmCtx.Provider>;
}

function Inner({ id }: { id: string }) {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const router = useRouter();
  const [data, setData] = useState<{ client: Client; deals: Deal[]; tasks: Task[]; events: CrmEvent[] } | null | undefined>(undefined);
  const [edit, setEdit] = useState(false);
  const [dealM, setDealM] = useState<{ open: boolean; deal: Deal | null }>({ open: false, deal: null });
  const [taskM, setTaskM] = useState<{ open: boolean; task: Task | null }>({ open: false, task: null });
  const [note, setNote] = useState("");
  const [noteKind, setNoteKind] = useState<EventKind>("note");
  const [dups, setDups] = useState<DupHit[]>([]);
  const ro = crm.me.access !== "full";
  const load = useCallback(() => { getClient(id).then((d) => { setData(d); if (d) findDups(d.client.contacts.map((x) => ({ kind: x.kind, value: x.value })), d.client.id).then(setDups).catch(() => {}); }).catch(() => setData(null)); }, [id]);
  useEffect(() => { load(); }, [load]);

  if (data === undefined) return <div className="py-10 text-center text-[13px] text-muted">…</div>;
  if (data === null) return <div className={card}>{c.notFound} · <Link href={crm.base} className="text-blue-2">{c.title}</Link></div>;
  const { client: cl, deals, tasks, events } = data;
  const err = (e: unknown) => showToast((e as Error).message === "readonly" ? c.errReadonly : c.errSave);
  const src = crm.sources.find((s) => s.id === cl.sourceId);
  const owner = crm.me.members.find((m) => m.id === cl.ownerId);
  const want = [cl.want.deal ? t.deal[cl.want.deal as keyof typeof t.deal] : null, cl.want.type ? t.typ[cl.want.type as keyof typeof t.typ] : null, cl.want.rooms?.length ? cl.want.rooms.join(", ") : null, cl.want.il ? GEO.find((g) => g.k === cl.want.il)?.n ?? cl.want.il : null].filter(Boolean).join(" · ");
  const budget = cl.budgetMin || cl.budgetMax ? `${cl.budgetMin ? fmt(cl.budgetMin, cl.cur as Currency) : "…"} — ${cl.budgetMax ? fmt(cl.budgetMax, cl.cur as Currency) : "…"}` : "";
  const waOf = (v: string) => `https://wa.me/${v.replace(/\D/g, "").replace(/^0/, "90")}`;
  const copy = (v: string) => { navigator.clipboard?.writeText(v).then(() => showToast(c.client.copied)); };

  async function sendNote() {
    if (!note.trim()) return;
    try { await addNote(cl.id, null, noteKind, note); setNote(""); load(); } catch (e) { err(e); }
  }
  async function archive() { try { await setClientStatus(cl.id, cl.status === "active" ? "archived" : "active"); load(); } catch (e) { err(e); } }
  async function del() {
    if (!(await confirmDialog({ title: c.client.delT, text: c.client.delQ, danger: true }))) return;
    try { await deleteClient(cl.id); router.push(crm.base); } catch (e) { err(e); }
  }
  async function merge(d: DupHit) {
    if (!(await confirmDialog({ title: c.client.mergeT, text: c.client.mergeQ }))) return;
    try { await mergeClients(cl.id, d.clientId); load(); } catch (e) { err(e); }
  }
  async function move(d: Deal, stageId: string) {
    const st = crm.stages.find((s) => s.id === stageId);
    const reason = st?.kind === "lost" ? window.prompt(c.deal.lostPh) ?? undefined : undefined;
    try { await moveDeal(d.id, stageId, reason); load(); } catch (e) { err(e); }
  }
  async function delDeal(d: Deal) { if (!(await confirmDialog({ text: c.deal.delQ, danger: true }))) return; try { await deleteDeal(d.id); load(); } catch (e) { err(e); } }

  const refLabel = cl.refKind === "none" ? null : cl.refKind === "text" ? cl.refText : cl.refKind === "realtor" ? c.client.refRealtor : c.client.refAgency;
  return (
    <>
      <Link href={crm.base} className="mb-3 inline-flex items-center gap-1 text-[13px] font-semibold text-muted hover:text-ink"><IconArrowLeft size={15} /> {c.title}</Link>
      <div className={`${card} mb-4`}>
        <div className="flex flex-wrap items-start gap-4">
          <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-blue-tint text-[18px] font-extrabold text-sel-ink">{initials(cl.name)}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2"><h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">{cl.name}</h1><span className={chip}>{cl.lang}</span>{cl.status === "archived" && <span className={chip}>{c.archived}</span>}{cl.tags.map((x) => <span key={x} className={chip}>{x}</span>)}</div>
            <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-[12.5px] text-muted">
              <span>{c.source}: <b className="text-text">{sourceName(src, t)}</b></span>
              {owner && <span>{c.owner}: <b className="text-text">{owner.name}</b></span>}
              {refLabel && <span>{c.client.ref}: <b className="text-text">{refLabel}</b></span>}
              <span>{c.client.created}: {fmtDate(cl.createdAt, lang)}</span>
            </div>
            {(want || budget) && <div className="mt-2 text-[13.5px] text-text">{want && <span>{c.client.want}: <b>{want}</b></span>}{want && budget && " · "}{budget && <span>{c.client.budget}: <b>{budget}</b></span>}</div>}
            {cl.notes && <div className="mt-2 whitespace-pre-line text-[13.5px] text-text-2">{cl.notes}</div>}
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => setEdit(true)} disabled={ro} className={btnS}><IconPencil size={15} /> {c.client.edit}</button>
            <button type="button" onClick={archive} disabled={ro} className={btnS}><IconArchive size={15} /> {cl.status === "active" ? c.client.archive : c.client.unarchive}</button>
            <button type="button" onClick={del} disabled={ro} className={btnD}><IconTrash size={15} /> {c.client.delete}</button>
          </div>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {cl.contacts.length === 0 && <span className="text-[13px] text-muted">{c.client.noContacts}</span>}
          {cl.contacts.map((x) => (
            <div key={x.id} className="flex items-center gap-1 rounded-[12px] border border-line bg-bg-2 py-1 pl-3 pr-1 text-[13px]">
              <span className="text-[11px] font-bold uppercase text-muted">{c.kinds[x.kind]}{x.label ? ` · ${x.label}` : ""}</span>
              <span className="ml-2 font-semibold text-ink">{x.value}</span>
              {(x.kind === "phone" || x.kind === "whatsapp") && <a href={`tel:${x.value.replace(/[^\d+]/g, "")}`} title={c.client.call} className="ml-1 flex h-7 w-7 items-center justify-center rounded-[8px] text-muted hover:bg-surface hover:text-ink"><IconPhone size={15} /></a>}
              {(x.kind === "phone" || x.kind === "whatsapp") && <a href={waOf(x.value)} target="_blank" rel="noreferrer" title={c.client.wa} className="flex h-7 w-7 items-center justify-center rounded-[8px] text-[#25d366] hover:bg-surface"><IconBrandWhatsapp size={16} /></a>}
              <button type="button" onClick={() => copy(x.value)} title={c.client.copy} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[8px] text-muted hover:bg-surface hover:text-ink"><IconCopy size={14} /></button>
            </div>
          ))}
        </div>
        {dups.length > 0 && (
          <div className="mt-3 rounded-[12px] border border-[#f5d58a] bg-[#fff8e6] p-3 text-[13px]">
            <div className="mb-1 font-bold text-ink">{dups.length > 1 ? c.client.dupMany : c.client.dup}:</div>
            {dups.map((d) => <div key={d.clientId} className="flex flex-wrap items-center gap-3"><Link href={`${crm.base}/${d.clientId}`} className="font-semibold text-blue-2 hover:underline">{d.name}</Link><span className="text-muted">{c.kinds[d.kind]}</span><button type="button" onClick={() => merge(d)} disabled={ro} className="cursor-pointer text-[12.5px] font-bold text-ink underline">{c.client.dupMerge}</button></div>)}
          </div>
        )}
      </div>

      <div className="grid grid-cols-[1.5fr_1fr] gap-4 max-md:grid-cols-1">
        <div className={card}>
          <div className="mb-3 flex items-center justify-between"><div className="text-[15px] font-extrabold text-ink">{c.client.deals} · {deals.length}</div><button type="button" onClick={() => setDealM({ open: true, deal: null })} disabled={ro} className={btnS}><IconPlus size={14} /> {c.deal.add}</button></div>
          {deals.length === 0 ? <div className="text-[13px] text-muted">{c.deal.none}</div> : (
            <div className="flex flex-col gap-2">{deals.map((d) => (
              <div key={d.id} className="rounded-[12px] border border-line p-3">
                <div className="flex items-start justify-between gap-2"><button type="button" onClick={() => setDealM({ open: true, deal: d })} className="cursor-pointer text-left text-[13.5px] font-bold text-ink hover:text-blue-2">{d.title || "—"}</button><button type="button" onClick={() => delDeal(d)} disabled={ro} className="cursor-pointer text-[12px] text-muted hover:text-red">✕</button></div>
                <div className="mt-1 text-[12.5px] text-muted">{t.deal[d.deal as keyof typeof t.deal]}{d.amount != null ? ` · ${fmt(d.amount, d.cur as Currency)}` : ""}{d.closedAt ? ` · ${c.deal.closed} ${fmtDate(d.closedAt, lang)}` : ""}{d.lostReason ? ` · ${d.lostReason}` : ""}</div>
                <div className="mt-2"><Select value={d.stageId ?? ""} onChange={(v) => move(d, v)} options={crm.stages.map((s) => ({ value: s.id, label: stageName(s, t, lang) }))} size="sm" disabled={ro} /></div>
                <DocsPanel dealId={d.id} dealKind={d.deal} onChange={load} />
              </div>))}</div>
          )}
        </div>
        <div className={card}>
          <div className="mb-3 flex items-center justify-between"><div className="text-[15px] font-extrabold text-ink">{c.client.tasks}</div><button type="button" onClick={() => setTaskM({ open: true, task: null })} disabled={ro} className={btnS}><IconPlus size={14} /> {c.task.add}</button></div>
          {tasks.length === 0 ? <div className="text-[13px] text-muted">{c.task.none}</div> : (
            <div className="flex flex-col gap-2">{tasks.map((x) => (
              <div key={x.id} className="flex items-center gap-3 rounded-[12px] border border-line px-3 py-2">
                <button type="button" onClick={async () => { try { await doneTask(x.id, !x.doneAt); load(); } catch (e) { err(e); } }} disabled={ro} className={`flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-full border-2 ${x.doneAt ? "border-green bg-green text-white" : "border-line hover:border-blue"}`}>{x.doneAt && <IconCheck size={14} />}</button>
                <button type="button" onClick={() => setTaskM({ open: true, task: x })} className="min-w-0 flex-1 cursor-pointer text-left"><div className={`truncate text-[13.5px] font-semibold ${x.doneAt ? "text-muted line-through" : "text-ink"}`}>{x.title}</div><div className="text-[12px] text-muted">{taskKindName(x.kind, t)} · <span className={!x.doneAt && new Date(x.dueAt) < new Date() ? "font-semibold text-red" : ""}>{fmtDT(x.dueAt, lang)}</span></div></button>
              </div>))}</div>
          )}
        </div>
      </div>

      <div className={`${card} mt-4`}>
        <div className="mb-3 text-[15px] font-extrabold text-ink">{c.client.history}</div>
        <div className="mb-4 flex flex-col gap-2">
          <div className="flex gap-2"><Select value={noteKind} onChange={(v) => setNoteKind(v as EventKind)} options={(["note", "call", "show", "meeting"] as const).map((k) => ({ value: k, label: c.ev[k] }))} size="sm" className="w-[150px]" disabled={ro} /><div className="flex-1" /></div>
          <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={c.ev.addPh} disabled={ro} className={`${inp} min-h-[70px] resize-y`} />
          <div><button type="button" onClick={sendNote} disabled={ro || !note.trim()} className={btnP}>{c.ev.add}</button></div>
        </div>
        <Timeline events={events} />
      </div>

      <ClientModal open={edit} client={cl} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); load(); }} onOpenDup={(x) => router.push(`${crm.base}/${x}`)} />
      <DealModal open={dealM.open} deal={dealM.deal} clients={[{ id: cl.id, name: cl.name }]} clientId={cl.id} onClose={() => setDealM({ open: false, deal: null })} onSaved={() => { setDealM({ open: false, deal: null }); load(); }} />
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
  if (!events.length) return null;
  return (
    <div className="flex flex-col gap-3">
      {events.map((e) => {
        const who = crm.me.members.find((m) => m.id === e.actorId)?.name;
        const x = tr[e.id];
        return (
          <div key={e.id} className="flex gap-3">
            <div className="mt-[6px] h-2 w-2 flex-none rounded-full bg-line-4" />
            <div className="min-w-0 flex-1">
              <div className="text-[12px] text-muted">{fmtDT(e.createdAt, lang)}{who ? ` · ${who}` : ""} · <span className="font-semibold text-text">{label(e)}</span></div>
              {e.text && (
                <div className="mt-1 rounded-[10px] bg-bg-2 px-3 py-2 text-[13.5px] text-ink">
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
