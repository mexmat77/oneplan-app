"use client";

// CRM v2 — сделки: канбан с перетаскиванием (HTML5 drag & drop, на тач — выбор этапа в карточке), сумма и счётчик колонки,
// «дней на этапе», фильтр по ответственному; список таблицей как второй режим.
import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import { IconCalendarEvent, IconChevronRight, IconLayoutKanban, IconList } from "@tabler/icons-react";
import { deleteDeal, listClients, listDeals, listTasks, moveDeal } from "@/app/crm/actions";
import { confirmDialog } from "@/components/ui/confirm";
import { offerCloseObject } from "./closeObject";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { useI18n } from "@/i18n/provider";
import type { Deal, Task } from "@/lib/crm/types";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { DealModal } from "./CrmModals";
import { dropIndex, posBetween, sortBoard, crmError, cacheGet, cacheSet, card, fill, fmtDT, fmtDate, initials, setPref, stageName, useCrm, useNow, usePref } from "./crmUi";

const LS = "opl-crm-deals-view";

export function DealsBoard() {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const router = useRouter();
  const ro = crm.me.access !== "full";
  const [deals, setDeals] = useState<Deal[] | null>(() => cacheGet<Deal[]>(`${crm.base}:deals`) ?? null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const viewPref = usePref(LS);
  const view: "board" | "list" = viewPref === "list" ? "list" : "board";
  const setView = (v: "board" | "list") => setPref(LS, v);
  const now = useNow();
  const [owner, setOwner] = useState("");
  const [modal, setModal] = useState<{ open: boolean; deal: Deal | null }>({ open: false, deal: null });
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ col: string; idx: number } | null>(null); // пунктирное место вставки (12.10.2026)
  const ph = <div className="h-[84px] rounded-[4px] border-2 border-dashed border-blue-2/60 bg-blue-tint/40" />;
  const load = useCallback(() => {
    listDeals().then((v) => setDeals(cacheSet(`${crm.base}:deals`, v))).catch(() => setDeals([]));
    listTasks(true).then(setTasks).catch(() => {});
    listClients({}).then((l) => setClients(l.map((x) => ({ id: x.id, name: x.name })))).catch(() => {});
  }, [crm.base]);
  useEffect(() => { load(); }, [load]);
  const err = (e: unknown) => crmError(e, c.errSave, c.errReadonly);
  async function move(d: Deal, stageId: string, pos?: number) {
    if (d.stageId === stageId && pos === undefined) return;
    const st = crm.stages.find((s) => s.id === stageId);
    const reason = st?.kind === "lost" ? window.prompt(c.deal.lostPh) ?? undefined : undefined;
    setDeals((v) => (v ?? []).map((x) => (x.id === d.id ? { ...x, stageId, boardPos: pos ?? x.boardPos } : x))); // оптимистично
    try { await moveDeal(d.id, stageId, reason, pos); if (st?.kind === "won") await offerCloseObject(d, crm.me.ws.kind, t); } catch (e) { err(e); load(); } // без load() после успеха: карточка уже на месте
  }
  async function del(d: Deal) { if (!(await confirmDialog({ text: c.deal.delQ, danger: true }))) return; try { await deleteDeal(d.id); load(); } catch (e) { err(e); } }
  const shown = useMemo(() => (deals ?? []).filter((d) => !owner || d.ownerId === owner), [deals, owner]);
  const byStage = useMemo(() => { const m = new Map<string, Deal[]>(); shown.forEach((d) => { const k = d.stageId ?? ""; m.set(k, [...(m.get(k) ?? []), d]); }); for (const [k, v] of m) m.set(k, sortBoard(v)); return m; }, [shown]);
  const sum = (list: Deal[]) => { const by: Record<string, number> = {}; list.forEach((d) => { if (d.amount) by[d.cur] = (by[d.cur] ?? 0) + d.amount; }); return Object.entries(by).map(([cur, v]) => fmt(v, cur as Currency)).join(" · "); };
  const taskOf = (d: Deal) => tasks.find((x) => x.dealId === d.id) ?? tasks.find((x) => x.clientId === d.clientId);
  const days = (d: Deal) => (now ? Math.max(0, Math.round((now - new Date(d.updatedAt).getTime()) / 864e5)) : 0);

  const DealCard = (d: Deal) => {
    const tk = taskOf(d); const m = crm.me.members.find((x) => x.id === d.ownerId); const st = crm.stages.find((x) => x.id === d.stageId);
    const act = tk ? (new Date(tk.dueAt).getTime() < now ? "#e5484d" : "#22c15e") : "#c9d0dc";
    return (
      <div data-card="1" draggable={!ro} onDragStart={(e) => { setDragId(d.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", d.id); }} onDragEnd={() => { setDragId(null); setDrop(null); }}
        className={`group cursor-grab rounded-[4px] border border-line bg-surface shadow-[0_1px_2px_rgba(20,36,63,.06)] transition hover:border-[#b9c2d0] active:cursor-grabbing ${dragId === d.id ? "opacity-40" : ""}`} style={{ borderTop: `3px solid ${st?.color ?? "#8a93a2"}` }}>
        <button type="button" onClick={() => router.push(`${crm.base}/d/${d.id}`)} className="block w-full cursor-pointer px-[10px] pb-[6px] pt-[8px] text-left">
          <div className="flex items-start gap-2">
            <div className="min-w-0 flex-1">
              <div className="truncate text-[13px] font-semibold leading-[1.3] text-ink">{d.title || "—"}</div>
              <div className="truncate text-[12px] text-muted">{d.clientName}</div>
            </div>
            <span title={tk ? `${tk.title} · ${fmtDT(tk.dueAt, lang)}` : c.task.none} className="mt-[2px] flex h-[18px] w-[18px] flex-none items-center justify-center rounded-full border" style={{ borderColor: act, color: act }}>{tk ? <IconCalendarEvent size={11} /> : <IconChevronRight size={11} />}</span>
          </div>
          <div className="mt-[6px] flex items-center gap-[6px]">
            {m && <span title={m.name} className="flex h-[18px] w-[18px] items-center justify-center rounded-full text-[8.5px] font-bold text-white" style={{ background: m.color }}>{initials(m.name)}</span>}
            <span className="text-[13px] font-semibold text-ink">{d.amount != null ? fmt(d.amount, d.cur as Currency) : "—"}</span>
            <span className="ml-auto text-[11px] text-muted">{fill(c.kb.days, { n: days(d) })}</span>
          </div>
        </button>
        <div className="px-[10px] pb-2 md:hidden"><Select value={d.stageId ?? ""} onChange={(v) => move(d, v)} options={crm.stages.map((s) => ({ value: s.id, label: stageName(s, t, lang) }))} size="sm" disabled={ro} /></div>
      </div>
    );
  };
  const totalSum = sum(shown);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-text"><b className="font-semibold text-ink">{totalSum || "—"}</b> · {shown.length} {c.nav.deals.toLowerCase()}</span>
        {crm.me.members.length > 1 && <Select value={owner} onChange={setOwner} options={[{ value: "", label: c.kb.all }, { value: crm.me.meId, label: c.kb.mine }, ...crm.me.members.filter((m) => m.id !== crm.me.meId).map((m) => ({ value: m.id, label: m.name }))]} className="w-[170px]" size="sm" />}
        <div className="flex-1" />
        <Segmented value={view} onChange={setView} options={[{ value: "board", label: c.deal.board, icon: <IconLayoutKanban size={15} /> }, { value: "list", label: c.deal.list, icon: <IconList size={15} /> }]} />

      </div>
      {deals === null ? <div className="py-12 text-center text-[13px] text-muted">…</div> : view === "board" ? (
        <div data-crm-kanban="1" className="flex overflow-x-auto rounded-[6px] border border-line bg-surface" style={{ minHeight: "calc(100vh - 200px)" }}>
          {crm.stages.map((st, i) => { const list = byStage.get(st.id) ?? []; return (
            <div key={st.id} onDragOver={(e) => { if (!dragId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; const idx = dropIndex(e, e.currentTarget); if (drop?.col !== st.id || drop.idx !== idx) setDrop({ col: st.id, idx }); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop((x) => (x?.col === st.id ? null : x)); }}
              onDrop={(e) => { e.preventDefault(); const id = dragId ?? e.dataTransfer.getData("text/plain"); const d = (deals ?? []).find((x) => x.id === id); const others = list.filter((x) => x.id !== id); const idx = Math.min(drop?.col === st.id ? drop.idx : others.length, others.length); const prev = others[idx - 1], next = others[idx]; setDrop(null); setDragId(null); if (d) move(d, st.id, posBetween(prev?.boardPos ?? (prev ? 0 : null), next?.boardPos ?? (next ? 2 : null))); }}
              className={`flex w-[260px] flex-none flex-col bg-[#f7f8fa] transition ${i > 0 ? "border-l border-line" : ""} ${drop?.col === st.id ? "crm-drag-over" : ""}`}>
              <div className="border-b border-line bg-surface px-3 py-2">
                <div className="flex items-center gap-2 text-[13px] font-semibold text-ink"><span className="h-2 w-2 rounded-full" style={{ background: st.color ?? "#8a93a2" }} />{stageName(st, t, lang)}</div>
                <div className="text-[11.5px] text-muted">{sum(list) || "—"} · {list.length}</div>
              </div>
              <div className="flex min-h-[80px] flex-1 flex-col gap-2 p-2">{drop?.col === st.id && drop.idx === 0 && ph}{list.map((d, k) => <React.Fragment key={d.id}><div>{DealCard(d)}</div>{drop?.col === st.id && drop.idx === k + 1 && ph}</React.Fragment>)}{list.length === 0 && !(drop?.col === st.id) && <div className="mt-2 text-center text-[11.5px] text-muted">{c.kb.empty}</div>}</div>
            </div>); })}
          {(byStage.get("") ?? []).length > 0 && <div className="flex w-[260px] flex-none flex-col border-l border-line bg-[#f7f8fa]"><div className="border-b border-line bg-surface px-3 py-2 text-[13px] font-semibold text-muted">{c.deal.noStage}</div><div className="flex flex-col gap-2 p-2">{(byStage.get("") ?? []).map((d) => <div key={d.id}>{DealCard(d)}</div>)}</div></div>}
        </div>
      ) : (
        <div className={`${card} overflow-x-auto p-0`}>
          {shown.length === 0 ? <div className="py-12 text-center text-[13.5px] text-muted">{c.deal.none}</div> : (
            <table data-crm-table="1" className="w-full min-w-[720px] text-[13px]"><thead><tr className="text-left text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{[c.deal.title, c.deal.client, c.deal.stage, c.deal.amount, c.owner, c.tbl.task, c.client.updated, ""].map((h, i) => <th key={i} className="px-3 py-2">{h}</th>)}</tr></thead>
              <tbody>{shown.map((d) => { const tk = taskOf(d); return <tr key={d.id} className="hover:bg-[#f7f8fa]"><td className="px-3 py-[6px]"><button type="button" onClick={() => router.push(`${crm.base}/d/${d.id}`)} className="cursor-pointer font-bold text-ink hover:text-blue-2">{d.title || "—"}</button></td><td className="px-3 py-[6px]"><Link href={`${crm.base}/c/${d.clientId}`} className="text-blue-2 hover:underline">{d.clientName}</Link></td><td className="px-3 py-[6px]"><Select value={d.stageId ?? ""} onChange={(v) => move(d, v)} options={crm.stages.map((s) => ({ value: s.id, label: stageName(s, t, lang) }))} size="sm" className="w-[170px]" disabled={ro} /></td><td className="px-3 py-[6px] font-semibold">{d.amount != null ? fmt(d.amount, d.cur as Currency) : ""}</td><td className="px-3 py-[6px] text-muted">{crm.me.members.find((m) => m.id === d.ownerId)?.name ?? ""}</td><td className="px-3 py-[6px] text-muted">{tk ? `${fmtDT(tk.dueAt, lang)} · ${tk.title}` : "—"}</td><td className="px-3 py-[6px] text-muted">{fmtDate(d.updatedAt, lang)}</td><td className="px-3 py-[6px] text-right"><button type="button" onClick={() => del(d)} disabled={ro} className="cursor-pointer text-[12px] text-muted hover:text-red">✕</button></td></tr>; })}</tbody></table>
          )}
        </div>
      )}
      <DealModal open={modal.open} deal={modal.deal} clients={clients} onClose={() => setModal({ open: false, deal: null })} onSaved={() => { setModal({ open: false, deal: null }); load(); }} />
    </>
  );
}
