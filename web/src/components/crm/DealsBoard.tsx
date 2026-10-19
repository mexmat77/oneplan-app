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
import { useI18n } from "@/i18n/provider";
import type { Deal, Task } from "@/lib/crm/types";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { DealStageChip } from "./ChipMenu";
import { DealModal } from "./CrmModals";
import { dropIndex, posBetween, sortBoard, crmError, cacheGet, cacheSet, card, DEAL_COLOR, fill, fmtDT, fmtDate, getPref, initials, setPref, stageName, useCrm, useNow, usePref } from "./crmUi";
import { activeCount, emptyOf, FilterPanel, FiltersButton, loadFlt, PanelField, PanelGroup, PillBar, sel, storeFlt, str, ViewTabs, type FDef, type GFlt } from "./FilterKit";

const LS = "opl-crm-deals-view";
type DView = "all" | "mine" | "open" | "won" | "lost" | "noTask";

export function DealsBoard() {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const router = useRouter();
  const ro = crm.me.access !== "full";
  const [deals, setDeals] = useState<Deal[] | null>(() => cacheGet<Deal[]>(`${crm.base}:deals`) ?? null);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [clients, setClients] = useState<{ id: string; name: string; roles?: string[] }[]>([]);
  const viewPref = usePref(LS);
  const view: "board" | "list" = viewPref === "list" ? "list" : "board";
  const setView = (v: "board" | "list") => setPref(LS, v);
  const now = useNow();
  // фильтры по параметрам сделки (19.10.2026, «в сделках нет фильтров — как в мировых CRM»): виды, пилюли «+ Фильтр», панель «Все фильтры»
  const fltKey = `opl-crm-deals-flt:${crm.base}`;
  const [fltRaw, setFltRaw] = useState<GFlt>(() => loadFlt(fltKey, []));
  const vwPref = usePref(`opl-crm-deals-vw:${crm.base}`);
  const vw: DView = (["all", "mine", "open", "won", "lost", "noTask"] as DView[]).includes(vwPref as DView) ? (vwPref as DView) : "all";
  const setVw = (v: DView) => setPref(`opl-crm-deals-vw:${crm.base}`, v);
  const [panel, setPanel] = useState(false);
  const [modal, setModal] = useState<{ open: boolean; deal: Deal | null }>({ open: false, deal: null });
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ col: string; idx: number } | null>(null); // пунктирное место вставки (12.10.2026)
  const ph = <div className="h-[84px] rounded-[4px] border-2 border-dashed border-blue-2/60 bg-blue-tint/40" />;
  const load = useCallback(() => {
    listDeals().then((v) => setDeals(cacheSet(`${crm.base}:deals`, v))).catch(() => setDeals([]));
    listTasks(true).then(setTasks).catch(() => {});
    listClients({}).then((l) => setClients(l.map((x) => ({ id: x.id, name: x.name, roles: x.roles })))).catch(() => {});
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
  const stKind = useCallback((d: Deal) => crm.stages.find((x) => x.id === d.stageId)?.kind ?? "open", [crm.stages]);
  const objKind = (d: Deal) => (d.listingId ? "listing" : d.projectId ? "unit" : d.objectText ? "free" : "none");
  const defs = useMemo<FDef[]>(() => {
    const lost = Array.from(new Set((deals ?? []).map((d) => d.lostReason?.trim()).filter((x): x is string => !!x)));
    return [
      { key: "stage", label: c.deal.stage, kind: "select", opts: crm.stages.map((x) => ({ value: x.id, label: stageName(x, t, lang), color: x.color ?? "#8a93a2" })) },
      { key: "type", label: c.dflt.type, kind: "select", opts: (["sale", "rent", "daily", "transfer"] as const).map((v) => ({ value: v, label: t.dealF[v], color: DEAL_COLOR[v] })) },
      ...(crm.me.members.length > 1 ? [{ key: "owner", label: c.owner, kind: "select" as const, opts: crm.me.members.map((m) => ({ value: m.id, label: m.name, color: m.color })) }] : []),
      ...(crm.me.branches.length > 0 ? [{ key: "branch", label: c.client.branch, kind: "select" as const, opts: crm.me.branches.map((b) => ({ value: b.id, label: b.name })) }] : []),
      { key: "object", label: c.dflt.object, kind: "select", opts: [{ value: "listing", label: c.dflt.objListing }, { value: "unit", label: c.dflt.objUnit }, { value: "free", label: c.dflt.objFree }, { value: "none", label: c.dflt.objNone }] },
      ...(lost.length ? [{ key: "lost", label: c.deal.lost, kind: "select" as const, opts: lost.map((v) => ({ value: v, label: v })) }] : []),
      { key: "amount", label: c.deal.amount, kind: "range", range: { from: "amountMin", to: "amountMax" }, ph: [c.dflt.from, c.dflt.to] },
      { key: "commission", label: c.deal.commission, kind: "range", range: { from: "comMin", to: "comMax" }, ph: [c.dflt.from, c.dflt.to] },
      { key: "created", label: c.tbl.flt.created, kind: "dates", range: { from: "createdFrom", to: "createdTo" } },
      { key: "closed", label: c.dflt.closed, kind: "dates", range: { from: "closedFrom", to: "closedTo" } },
      { key: "deposit", label: c.deal.depositAt, kind: "dates", range: { from: "depFrom", to: "depTo" } },
    ];
  }, [deals, crm.stages, crm.me.members, crm.me.branches, c, t, lang]);
  const flt = useMemo(() => ({ ...emptyOf(defs), ...fltRaw }), [defs, fltRaw]);
  const setF = (p: GFlt) => setFltRaw((prev) => { const n = { ...prev, ...p }; storeFlt(fltKey, n); return n; });
  const resetF = () => { setFltRaw({}); storeFlt(fltKey, {}); };
  const active = activeCount(flt, defs);
  const q = crm.q.trim().toLowerCase();
  const inRange = (v: number | null | undefined, a: string, b: string) => (!a && !b ? true : v != null && (!a || v >= +a) && (!b || v <= +b));
  const inDates = (v: string | null | undefined, a: string, b: string) => (!a && !b ? true : !!v && (!a || v >= a) && (!b || v <= b + "T23:59:59"));
  const filtered = useMemo(() => (deals ?? []).filter((d) =>
    (!q || [d.title, `d-${d.no}`, String(d.no), d.clientName, d.sellerName ?? ""].some((x) => x.toLowerCase().includes(q)))
    && (!sel(flt, "stage").length || sel(flt, "stage").includes(d.stageId ?? ""))
    && (!sel(flt, "type").length || sel(flt, "type").includes(d.deal))
    && (!sel(flt, "owner").length || sel(flt, "owner").includes(d.ownerId ?? ""))
    && (!sel(flt, "branch").length || sel(flt, "branch").includes(d.branchId ?? ""))
    && (!sel(flt, "object").length || sel(flt, "object").includes(objKind(d)))
    && (!sel(flt, "lost").length || sel(flt, "lost").includes(d.lostReason?.trim() ?? ""))
    && inRange(d.amount, str(flt, "amountMin"), str(flt, "amountMax")) && inRange(d.commission, str(flt, "comMin"), str(flt, "comMax"))
    && inDates(d.createdAt, str(flt, "createdFrom"), str(flt, "createdTo")) && inDates(d.closedAt, str(flt, "closedFrom"), str(flt, "closedTo")) && inDates(d.depositAt, str(flt, "depFrom"), str(flt, "depTo")),
  ), [deals, q, flt]);
  const hasTask = useCallback((d: Deal) => tasks.some((x) => x.dealId === d.id || x.clientId === d.clientId), [tasks]);
  const viewOk = useCallback((d: Deal, v: DView) => (v === "all" ? true : v === "mine" ? d.ownerId === crm.me.meId : v === "noTask" ? !hasTask(d) : stKind(d) === v), [crm.me.meId, hasTask, stKind]);
  const counts = useMemo(() => Object.fromEntries((["all", "mine", "open", "won", "lost", "noTask"] as DView[]).map((v) => [v, filtered.filter((d) => viewOk(d, v)).length])) as Record<DView, number>, [filtered, viewOk]);
  const shown = useMemo(() => filtered.filter((d) => viewOk(d, vw)), [filtered, vw, viewOk]);
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
        <div className="px-[10px] pb-2 md:hidden"><DealStageChip deal={d} onChange={(v) => move(d, v)} disabled={ro} /></div>
      </div>
    );
  };
  const totalSum = sum(shown);

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-text"><b className="font-semibold text-ink">{totalSum || "—"}</b> · {shown.length} {c.nav.deals.toLowerCase()}</span>
        <div className="ml-auto flex items-center gap-2 max-md:w-full">{/* на телефоне — своей строкой: вид слева, фильтры справа (19.10.2026) */}
          <Segmented value={view} onChange={setView} options={[{ value: "board", label: c.deal.board, icon: <IconLayoutKanban size={15} /> }, { value: "list", label: c.deal.list, icon: <IconList size={15} /> }]} />
          <FiltersButton n={active} onClick={() => setPanel(true)} className="ml-auto" />
        </div>
      </div>
      <ViewTabs value={vw} onChange={setVw} items={(["all", "mine", "open", "won", "lost", "noTask"] as DView[]).map((v) => ({ key: v, label: c.dflt.views[v], n: counts[v] }))} />
      <PillBar flt={flt} setF={setF} reset={resetF} defs={defs} />
      <FilterPanel open={panel} onClose={() => setPanel(false)} active={active} count={shown.length} reset={resetF}>
        <PanelGroup label={c.dflt.group}>{defs.filter((d) => ["stage", "type", "owner", "branch", "object", "lost"].includes(d.key)).map((d) => <PanelField key={d.key} def={d} flt={flt} setF={setF} />)}</PanelGroup>
        <PanelGroup label={c.dflt.money}>{defs.filter((d) => d.kind === "range").map((d) => <PanelField key={d.key} def={d} flt={flt} setF={setF} />)}</PanelGroup>
        <PanelGroup label={c.tbl.flt.dates}>{defs.filter((d) => d.kind === "dates").map((d) => <PanelField key={d.key} def={d} flt={flt} setF={setF} />)}</PanelGroup>
      </FilterPanel>
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
              <tbody>{shown.map((d) => { const tk = taskOf(d); return <tr key={d.id} className="hover:bg-[#f7f8fa]"><td className="px-3 py-[6px]"><button type="button" onClick={() => router.push(`${crm.base}/d/${d.id}`)} className="cursor-pointer font-bold text-ink hover:text-blue-2">{d.title || "—"}</button></td><td className="px-3 py-[6px]"><Link href={`${crm.base}/c/${d.clientId}`} className="text-blue-2 hover:underline">{d.clientName}</Link></td><td className="px-3 py-[6px]"><DealStageChip deal={d} onChange={(v) => move(d, v)} disabled={ro} /></td><td className="px-3 py-[6px] font-semibold">{d.amount != null ? fmt(d.amount, d.cur as Currency) : ""}</td><td className="px-3 py-[6px] text-muted">{crm.me.members.find((m) => m.id === d.ownerId)?.name ?? ""}</td><td className="px-3 py-[6px] text-muted">{tk ? `${fmtDT(tk.dueAt, lang)} · ${tk.title}` : "—"}</td><td className="px-3 py-[6px] text-muted">{fmtDate(d.updatedAt, lang)}</td><td className="px-3 py-[6px] text-right"><button type="button" onClick={() => del(d)} disabled={ro} className="cursor-pointer text-[12px] text-muted hover:text-red">✕</button></td></tr>; })}</tbody></table>
          )}
        </div>
      )}
      <DealModal open={modal.open} deal={modal.deal} clients={clients} onClose={() => setModal({ open: false, deal: null })} onSaved={() => { setModal({ open: false, deal: null }); load(); }} />
    </>
  );
}
