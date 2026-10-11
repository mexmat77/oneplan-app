"use client";

// CRM v2 — боковая панель клиента из таблицы: контакты, сделки, задачи, быстрая заметка, ссылка на полную карточку.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { IconArrowUpRight, IconBrandWhatsapp, IconPhone, IconX } from "@tabler/icons-react";
import { addNote, doneTask, getClient } from "@/app/crm/actions";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Client, CrmEvent, Deal, Task } from "@/lib/crm/types";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { btnP, chip, fmtDT, initials, inp, sourceName, stageName, taskKindName, useCrm } from "./crmUi";

export function ClientDrawer({ id, onClose, onChanged }: { id: string; onClose: () => void; onChanged?: () => void }) {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const ro = crm.me.access !== "full";
  const [data, setData] = useState<{ client: Client; deals: Deal[]; tasks: Task[]; events: CrmEvent[] } | null | undefined>(undefined);
  const [note, setNote] = useState("");
  const load = useCallback(() => { getClient(id).then(setData).catch(() => setData(null)); }, [id]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, [onClose]);
  async function send() { if (!note.trim()) return; try { await addNote(id, null, "note", note); setNote(""); load(); onChanged?.(); } catch (e) { showToast((e as Error).message === "readonly" ? c.errReadonly : c.errSave); } }
  const waOf = (v: string) => `https://wa.me/${v.replace(/\D/g, "").replace(/^0/, "90")}`;
  return (
    <>
      <div className="fixed inset-0 z-[300] bg-ink/25" onClick={onClose} />
      <aside className="fixed right-0 top-0 z-[310] flex h-screen w-[460px] max-w-full flex-col border-l border-line bg-surface shadow-[-10px_0_40px_rgba(20,36,63,.15)]" style={{ animation: "opl-bg .15s ease" }}>
        {data === undefined ? <div className="p-6 text-[13px] text-muted">…</div> : data === null ? <div className="p-6 text-[13px] text-muted">{c.notFound}</div> : (
          <>
            <div className="flex items-start gap-3 border-b border-line px-5 py-4">
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-blue-tint text-[14px] font-extrabold text-sel-ink">{initials(data.client.name)}</span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><Link href={`${crm.base}/c/${id}`} className="text-[17px] font-extrabold text-ink hover:text-blue-2">{data.client.name}</Link><span className={chip}>{data.client.lang}</span>{data.client.tags.map((x) => <span key={x} className={chip}>{x}</span>)}</div>
                <div className="mt-[2px] text-[12px] text-muted">{sourceName(crm.sources.find((s) => s.id === data.client.sourceId), t)}{data.client.ownerId ? ` · ${crm.me.members.find((m) => m.id === data.client.ownerId)?.name ?? ""}` : ""}</div>
              </div>
              <Link href={`${crm.base}/c/${id}`} title={c.card.openFull} className="flex h-9 w-9 items-center justify-center rounded-[9px] text-muted hover:bg-bg-3 hover:text-ink"><IconArrowUpRight size={18} /></Link>
              <button type="button" onClick={onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[9px] text-muted hover:bg-bg-3 hover:text-ink"><IconX size={18} /></button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              <div className="mb-4 flex flex-wrap gap-2">
                {data.client.contacts.map((x) => <span key={x.id} className="inline-flex items-center gap-1 rounded-[10px] bg-bg-2 py-1 pl-3 pr-1 text-[12.5px]"><span className="text-[10.5px] font-bold uppercase text-muted">{c.kinds[x.kind]}</span><span className="ml-1 font-semibold text-ink">{x.value}</span>{(x.kind === "phone" || x.kind === "whatsapp") && <><a href={`tel:${x.value.replace(/[^\d+]/g, "")}`} className="ml-1 flex h-6 w-6 items-center justify-center rounded-[6px] text-muted hover:bg-surface hover:text-ink"><IconPhone size={13} /></a><a href={waOf(x.value)} target="_blank" rel="noreferrer" className="flex h-6 w-6 items-center justify-center rounded-[6px] text-[#25d366] hover:bg-surface"><IconBrandWhatsapp size={14} /></a></>}</span>)}
              </div>
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.04em] text-muted">{c.card.deals} · {data.deals.length}</div>
              {data.deals.length === 0 ? <div className="mb-4 text-[12.5px] text-muted">{c.deal.none}</div> : <div className="mb-4 flex flex-col gap-1">{data.deals.map((d) => { const st = crm.stages.find((s) => s.id === d.stageId); return <div key={d.id} className="flex items-center gap-2 rounded-[10px] border border-line px-3 py-2 text-[12.5px]"><span className="h-2 w-2 flex-none rounded-full" style={{ background: st?.color ?? "#8a93a2" }} /><span className="min-w-0 flex-1 truncate font-semibold text-ink">{d.title || "—"}</span><span className="text-muted">{stageName(st, t, lang)}</span>{d.amount != null && <span className="font-bold text-ink">{fmt(d.amount, d.cur as Currency)}</span>}</div>; })}</div>}
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.04em] text-muted">{c.card.tasks}</div>
              {data.tasks.filter((x) => !x.doneAt).length === 0 ? <div className="mb-4 text-[12.5px] text-muted">{c.task.none}</div> : <div className="mb-4 flex flex-col gap-1">{data.tasks.filter((x) => !x.doneAt).map((x) => <div key={x.id} className="flex items-center gap-2 rounded-[10px] border border-line px-3 py-2 text-[12.5px]"><button type="button" disabled={ro} onClick={async () => { try { await doneTask(x.id, true); load(); onChanged?.(); } catch { /* ro */ } }} className="h-5 w-5 flex-none cursor-pointer rounded-full border-2 border-line hover:border-blue" /><span className="min-w-0 flex-1 truncate font-semibold text-ink">{x.title}</span><span className={`text-[11.5px] ${new Date(x.dueAt) < new Date() ? "font-bold text-red" : "text-muted"}`}>{taskKindName(x.kind, t)} · {fmtDT(x.dueAt, lang)}</span></div>)}</div>}
              <div className="mb-2 text-[11px] font-extrabold uppercase tracking-[.04em] text-muted">{c.card.activity}</div>
              {data.events.length === 0 ? <div className="text-[12.5px] text-muted">{c.card.noActivity}</div> : <div className="flex flex-col gap-2">{data.events.slice(0, 6).map((e) => <div key={e.id} className="text-[12.5px]"><span className="text-muted">{fmtDT(e.createdAt, lang)} · </span><span className="font-semibold text-text">{(c.ev as Record<string, string>)[e.kind]?.replace(/\{[^}]+\}/g, "") ?? e.kind}</span>{e.text && <div className="mt-[2px] whitespace-pre-line rounded-[8px] bg-bg-2 px-2 py-1 text-ink">{e.text}</div>}</div>)}</div>}
            </div>
            <div className="border-t border-line px-5 py-3">
              <textarea value={note} onChange={(e) => setNote(e.target.value)} placeholder={c.ev.addPh} disabled={ro} className={`${inp} min-h-[56px] resize-none py-2 text-[13px]`} />
              <div className="mt-2 flex justify-end"><button type="button" onClick={send} disabled={ro || !note.trim()} className={`${btnP} px-4 py-[7px] text-[12.5px]`}>{c.ev.add}</button></div>
            </div>
          </>
        )}
      </aside>
    </>
  );
}
