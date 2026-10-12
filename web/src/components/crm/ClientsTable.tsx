"use client";

// CRM — клиенты списком по образцу пользователя (11.10.2026): заголовок со счётчиком, поиск, «Все фильтры», плотность
// (компакт / развёрнуто), сохранённые виды с числами, строка этапов с числами, таблица с двухстрочными ячейками
// (клиент + телефон, объект + сделка, источник + язык, команда), действия при наведении, панель карточки по клику на строку.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconAdjustmentsHorizontal, IconArchive, IconArrowsSort, IconCalendar, IconChevronDown, IconChevronRight, IconExternalLink, IconEye, IconPhone, IconPlus, IconX } from "@tabler/icons-react";
import { bulkClients, clientDealSummary, listClients, patchClient, saveTask, type DealSummary } from "@/app/crm/actions";
import { DuePicker } from "./DuePicker";
import { DateRange, fmtD } from "@/components/ui/DateRange";
import { useEscape } from "@/hooks/useScrollLock";
import { Select } from "@/components/ui/Select";
import { showToast, showUndo } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Client } from "@/lib/crm/types";
import type { Lang } from "@/i18n";
import { fmt } from "@/lib/money";
import { GEO } from "@/lib/seed";
import type { Currency } from "@/lib/types";
import { ClientDrawer } from "./ClientDrawer";
import { ClientModal } from "./ClientModal";
import { PRIO_COLOR, REQ_COLOR, btnP, btnS, cacheGet, cacheSet, fill, fmtDate, getPref, initials, inp, reqSummary, setPref, sourceName, stageName, useCrm, useNow, usePref } from "./crmUi";

type View = "all" | "mine" | "withTask" | "overdue" | "noDeal";
type Flt = { owner: string; branch: string; source: string; role: string; cstage: string; dealStage: string; priority: string; lang: string; kind: string; il: string; budgetMin: string; budgetMax: string; createdFrom: string; createdTo: string; tag: string; channel: string };
type SavedView = { id: string; name: string; flt: Flt; stage: string; view: View; sort: { key: SortKey; dir: 1 | -1 } };
const MODE_LS = "opl-crm-clients-mode";
const EMPTY_FLT: Flt = { owner: "", branch: "", source: "", role: "", cstage: "", dealStage: "", priority: "", lang: "", kind: "", il: "", budgetMin: "", budgetMax: "", createdFrom: "", createdTo: "", tag: "", channel: "" };
type SortKey = "name" | "updated" | "created";
const DENS_LS = "opl-crm-density";

export function ClientsTable() {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const router = useRouter();
  const sp = useSearchParams();
  const now = useNow();
  const ro = crm.me.access !== "full";
  const q = crm.q; // поиск — один, в шапке CRM
  const urlQ = sp.get("q") ?? "";
  const [urlApplied, setUrlApplied] = useState(false);
  if (urlQ && !urlApplied) { setUrlApplied(true); crm.setQ(urlQ); }
  // последнее состояние списка запоминается (стандарт 2026: «persist the last view»): фильтры, вид, этап, сортировка
  const lastKey = `opl-crm-last:${crm.base}:${crm.me.ws.id}`;
  const last = (() => { try { return JSON.parse(getPref(lastKey) || "{}") as Partial<{ flt: Flt; view: View; stage: string; sort: { key: SortKey; dir: 1 | -1 } }>; } catch { return {}; } })();
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [view, setView] = useState<View>(last.view ?? "all");
  const [stage, setStage] = useState<string>(last.stage ?? ""); // "" все, "none" нет сделок, "won"/"lost", иначе id этапа
  const [flt, setFlt] = useState<Flt>({ ...EMPTY_FLT, ...(last.flt ?? {}) });
  const setF = (p: Partial<Flt>) => { setFlt((v) => ({ ...v, ...p })); setCurSaved(""); };
  const [filtersOpen, setFiltersOpen] = useState(false);
  const cacheKey = `${crm.base}:clients:${status}`;
  const [list, setList] = useState<Client[] | null>(() => cacheGet<{ list: Client[]; deals: Record<string, DealSummary> }>(cacheKey)?.list ?? null);
  const [deals, setDeals] = useState<Record<string, DealSummary>>(() => cacheGet<{ list: Client[]; deals: Record<string, DealSummary> }>(cacheKey)?.deals ?? {});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>(last.sort ?? { key: "updated", dir: -1 });
  useEffect(() => { setPref(lastKey, JSON.stringify({ flt, view, stage, sort })); }, [lastKey, flt, view, stage, sort]);
  // сохранённые виды (Linear/Attio: view = сохранённые фильтры), личные, на пространство
  const viewsKey = `opl-crm-views:${crm.base}:${crm.me.ws.id}`;
  const savedRaw = usePref(viewsKey);
  const saved: SavedView[] = (() => { try { const v = JSON.parse(savedRaw || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } })();
  const [curSaved, setCurSaved] = useState<string>(last.flt ? "" : "");
  const saveView = async () => { const name = window.prompt(c.tbl.viewName); if (!name?.trim()) return; const v: SavedView = { id: crypto.randomUUID(), name: name.trim(), flt, stage, view, sort }; setPref(viewsKey, JSON.stringify([...saved, v])); setCurSaved(v.id); };
  const applySaved = (v: SavedView) => { setFlt({ ...EMPTY_FLT, ...v.flt }); setStage(v.stage); setView(v.view); setSort(v.sort); setCurSaved(v.id); };
  const deleteSaved = (id: string) => { setPref(viewsKey, JSON.stringify(saved.filter((x) => x.id !== id))); if (curSaved === id) setCurSaved(""); };
  const [drawer, setDrawer] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const dense = usePref(DENS_LS) !== "expanded";
  const mode = usePref(MODE_LS) === "board" ? "board" : "list"; // список или канбан по воронке клиента (выбор пользователя)

  const load = useCallback(() => {
    // без поиска — кэш раздела: прошлые строки показываются сразу, свежие приходят фоном (замечание пользователя 12.10.2026)
    const key = `${crm.base}:clients:${status}`;
    const cached = q ? undefined : cacheGet<{ list: Client[]; deals: Record<string, DealSummary> }>(key);
    if (cached) { setList(cached.list); setDeals(cached.deals); }
    listClients({ q, status }).then(async (l) => { const d = await clientDealSummary(l.map((x) => x.id)).catch(() => ({})); setList(l); setDeals(d); if (!q) cacheSet(key, { list: l, deals: d }); }).catch(() => setList([]));
  }, [q, status, crm.base]);
  useEffect(() => { const h = setTimeout(load, q ? 250 : 0); return () => clearTimeout(h); }, [load, q]);

  const isOver = (x: Client) => !!x.nextTask && new Date(x.nextTask.dueAt).getTime() < now;
  const base = useMemo(() => list ?? [], [list]);
  const viewCount = (v: View) => base.filter((x) => matchView(x, v)).length;
  function matchView(x: Client, v: View) {
    switch (v) { case "mine": return x.ownerId === crm.me.meId; case "withTask": return !!x.nextTask; case "overdue": return isOver(x); case "noDeal": return !deals[x.id]; default: return true; }
  }
  const dealStageOf = (x: Client) => { const d = deals[x.id]; return !d ? "none" : d.closed ? d.closed : d.stageId ?? ""; };
  const stageOf = (x: Client) => x.stage || "new"; // строка этапов и канбан — по воронке КЛИЕНТА (0018)
  const stageCount = (key: string) => base.filter((x) => stageOf(x) === key).length;
  const allTags = useMemo(() => [...new Set(base.flatMap((x) => x.tags))].sort(), [base]);
  const rows = useMemo(() => {
    let r = base.filter((x) => matchView(x, view));
    if (stage) r = r.filter((x) => stageOf(x) === stage);
    if (flt.owner) r = r.filter((x) => x.ownerId === flt.owner);
    if (flt.source) r = r.filter((x) => x.sourceId === flt.source);
    if (flt.tag) r = r.filter((x) => x.tags.includes(flt.tag));
    if (flt.branch) r = r.filter((x) => x.branchId === flt.branch);
    if (flt.role) r = r.filter((x) => x.roles.includes(flt.role as Client["roles"][number]));
    if (flt.cstage) r = r.filter((x) => x.stage === flt.cstage);
    if (flt.dealStage) r = r.filter((x) => dealStageOf(x) === flt.dealStage);
    if (flt.priority) r = r.filter((x) => (flt.priority === "none" ? !x.priority : x.priority === flt.priority));
    if (flt.lang) r = r.filter((x) => x.lang === flt.lang);
    if (flt.channel) r = r.filter((x) => x.channel === flt.channel);
    if (flt.kind) r = r.filter((x) => x.requests.some((q) => q.kind === flt.kind));
    if (flt.il) r = r.filter((x) => x.requests.some((q) => (q.fields.geo as { il?: string } | undefined)?.il === flt.il) || x.want.il === flt.il);
    const bMin = +flt.budgetMin.replace(/\D/g, "") || 0, bMax = +flt.budgetMax.replace(/\D/g, "") || 0;
    if (bMin || bMax) r = r.filter((x) => x.requests.some((q) => { const f = q.fields; const hi = Number(f.budgetMax ?? f.rentMax ?? f.priceList ?? f.rent ?? f.budgetMin ?? 0); const lo = Number(f.budgetMin ?? hi); return hi > 0 && (!bMin || hi >= bMin) && (!bMax || lo <= bMax); }));
    if (flt.createdFrom) r = r.filter((x) => x.createdAt >= flt.createdFrom);
    if (flt.createdTo) r = r.filter((x) => x.createdAt <= flt.createdTo + "T23:59:59");
    const key = (x: Client) => (sort.key === "name" ? x.name.toLowerCase() : sort.key === "created" ? x.createdAt : x.updatedAt);
    return r.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * sort.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, view, stage, flt, sort, deals, now]);
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "name" ? 1 : -1 }));
  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const err = (e: unknown) => showToast((e as Error).message === "readonly" ? c.errReadonly : c.errSave);
  async function bulk(patch: Parameters<typeof bulkClients>[1]) {
    const ids = [...sel];
    try { await bulkClients(ids, patch); setSel(new Set()); load(); if (patch.status) showUndo(fill(c.undo.archived, { n: ids.length }), async () => { await bulkClients(ids, { status: patch.status === "archived" ? "active" : "archived" }); load(); }, c.undo.undo); } catch (e) { err(e); }
  }
  const hoursAgo = (iso: string) => { const h = Math.max(1, Math.round((now - new Date(iso).getTime()) / 36e5)); return h < 24 ? `${h} ч` : `${Math.round(h / 24)} д`; };
  const regionOf = (x: Client) => { const g = (x.requests[0]?.fields.geo as { il?: string; ilces?: string[] } | undefined) ?? x.want; const il = GEO.find((y) => y.k === g?.il); return il ? { name: il.n, more: g?.ilces?.length ?? 0 } : null; };
  const activeFilters = Object.values(flt).filter(Boolean).length;
  const th = (label: string, key?: SortKey) => (
    <th key={label} onClick={key ? () => toggleSort(key) : undefined} className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[.05em] text-muted ${key ? "cursor-pointer select-none hover:text-ink" : ""}`}>
      <span className="inline-flex items-center gap-1">{label}{key && (sort.key === key ? <span className="text-blue-2">{sort.dir === 1 ? "▲" : "▼"}</span> : <IconArrowsSort size={12} className="opacity-40" />)}</span>
    </th>
  );
  const pad = dense ? "py-[6px]" : "py-[12px]";

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="text-[20px] font-semibold text-ink">{c.nav.clients} <span className="text-[13px] font-normal text-muted">{list ? base.length.toLocaleString("ru-RU") : ""}</span></h1>
        <div className="flex-1" />
        <button type="button" onClick={() => setFiltersOpen((v) => !v)} className={`${btnS} ${activeFilters ? "border-sel-line bg-blue-tint text-sel-ink" : ""}`}><IconAdjustmentsHorizontal size={15} /> {c.tbl.allFilters}{activeFilters ? ` · ${activeFilters}` : ""}</button>
        <div className="inline-flex rounded-[6px] border border-line bg-surface p-[2px]">{(["compact", "expanded"] as const).map((d) => <button key={d} type="button" onClick={() => setPref(DENS_LS, d)} className={`h-7 cursor-pointer rounded-[4px] px-3 text-[12.5px] font-medium ${(d === "compact") === dense ? "bg-blue-2 text-white" : "text-muted hover:text-ink"}`}>{d === "compact" ? c.tbl.compact : c.tbl.expanded}</button>)}</div>
        <button type="button" onClick={() => setModal(true)} disabled={ro} className={btnP}><IconPlus size={15} /> {c.nav.create}</button>
      </div>
      <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-line">
        {(["all", "mine", "withTask", "overdue", "noDeal"] as View[]).map((v) => { const n = viewCount(v); return (
          <button key={v} type="button" onClick={() => setView(v)} className={`-mb-px flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2 text-[13px] font-medium ${view === v ? "border-blue-2 text-ink" : "border-transparent text-text hover:text-ink"}`}>{c.tbl.views[v]}<span className={`rounded-full px-[7px] py-[1px] text-[11px] ${v === "overdue" && n ? "bg-red-tint text-red" : "bg-bg-2 text-muted"}`}>{n}</span></button>); })}
        {saved.map((v) => <span key={v.id} className={`group/sv -mb-px flex items-center gap-1 border-b-2 px-3 py-2 text-[13px] font-medium ${curSaved === v.id ? "border-blue-2 text-ink" : "border-transparent text-text hover:text-ink"}`}><button type="button" onClick={() => applySaved(v)} className="cursor-pointer">{v.name}</button><button type="button" onClick={() => deleteSaved(v.id)} title={c.tbl.deleteView} className="cursor-pointer text-muted opacity-0 hover:text-red group-hover/sv:opacity-100"><IconX size={12} /></button></span>)}
        {(activeFilters > 0 || stage) && !curSaved && <button type="button" onClick={saveView} className="-mb-px flex cursor-pointer items-center gap-1 border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-blue-2 hover:underline"><IconPlus size={13} /> {c.tbl.saveView}</button>}
        {/* архив — отдельная вкладка справа: архивные клиенты скрыты из «Активных», но остаются для истории и поиска дублей */}
        <button type="button" onClick={() => setStatus(status === "active" ? "archived" : "active")} className={`-mb-px ml-auto flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2 text-[13px] font-medium ${status === "archived" ? "border-blue-2 text-ink" : "border-transparent text-muted hover:text-ink"}`}><IconArchive size={14} /> {c.archived}{status === "archived" && list ? <span className="rounded-full bg-bg-2 px-[7px] py-[1px] text-[11px] text-muted">{base.length}</span> : null}</button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-[6px] text-[12.5px]">
        <span className="mr-1 text-muted">{c.tbl.stageRow}</span>
        {crm.cstages.map((st) => { const n = stageCount(st.key); return <button key={st.id} type="button" onClick={() => setStage(stage === st.key ? "" : st.key)} className={`inline-flex h-7 cursor-pointer items-center gap-[6px] rounded-full border px-3 ${stage === st.key ? "border-ink bg-ink text-white" : "border-line bg-surface text-text hover:bg-bg-3"}`}><span className="h-2 w-2 rounded-full" style={{ background: st.color ?? "#8a93a2" }} />{stageName(st, t, lang)}<span className={stage === st.key ? "text-white/70" : "text-muted"}>{n}</span></button>; })}
        <span className="flex-1" />
        <div className="inline-flex rounded-[6px] border border-line bg-surface p-[2px]">{(["list", "board"] as const).map((m) => <button key={m} type="button" onClick={() => setPref(MODE_LS, m)} className={`h-7 cursor-pointer rounded-[4px] px-3 text-[12.5px] font-medium ${mode === m ? "bg-blue-2 text-white" : "text-muted hover:text-ink"}`}>{m === "list" ? c.tbl.listMode : c.tbl.boardMode}</button>)}</div>
      </div>
      <FilterBar flt={flt} setF={setF} reset={() => setFlt(EMPTY_FLT)} allTags={allTags} />
      {filtersOpen && <FilterDrawer flt={flt} setF={setF} reset={() => setFlt(EMPTY_FLT)} allTags={allTags} onClose={() => setFiltersOpen(false)} />}
      {sel.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[6px] bg-ink px-3 py-[6px] text-[12.5px] text-white">
          <span className="font-semibold">{fill(c.tbl.selected, { n: sel.size })}</span>
          {crm.me.members.length > 1 && <Select value="" onChange={(v) => bulk({ ownerId: v })} placeholder={c.tbl.assign} options={crm.me.members.map((m) => ({ value: m.id, label: m.name }))} className="w-[170px]" size="sm" />}
          {crm.me.branches.length > 0 && <Select value="" onChange={(v) => bulk({ branchId: v || null })} placeholder={c.client.transferBranch} options={[{ value: "", label: c.client.noBranch }, ...crm.me.branches.map((b) => ({ value: b.id, label: b.name }))]} className="w-[170px]" size="sm" />}
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && tagInput.trim()) { bulk({ addTag: tagInput.trim() }); setTagInput(""); } }} placeholder={c.tbl.addTagPh} className="h-7 w-[170px] rounded-[4px] border border-white/20 bg-white/10 px-2 text-[12.5px] text-white outline-none placeholder:text-white/60" />
          <button type="button" onClick={() => bulk({ status: status === "active" ? "archived" : "active" })} className="h-7 cursor-pointer rounded-[4px] bg-white/15 px-3 font-semibold hover:bg-white/25">{status === "active" ? c.tbl.archive : c.tbl.restore}</button>
          <button type="button" onClick={() => setSel(new Set())} className="ml-auto cursor-pointer"><IconX size={15} /></button>
        </div>
      )}
      {mode === "board" && list !== null && <ClientBoard rows={rows} deals={deals} onMove={async (id, k) => { try { await patchClient(id, { stage: k }); load(); } catch (e) { err(e); } }} />}
      <div className={`overflow-x-auto rounded-[6px] border border-line bg-surface ${mode === "board" ? "hidden" : ""}`}>
        {list === null ? <div className="py-12 text-center text-[13px] text-muted">…</div> : rows.length === 0 ? <div className="py-12 text-center text-[13.5px] text-muted">{q || activeFilters || stage || view !== "all" ? c.notFound : status === "archived" ? c.noArchived : c.noClients}</div> : (
          <table data-crm-table="1" className="w-full min-w-[900px] text-[13px]">
            <thead><tr>
              <th className="w-[56px] px-3 py-2"><input type="checkbox" checked={allSel} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
              {th(c.tbl.cols2.client, "name")}{th(c.tbl.cols2.region)}{th(c.tbl.cols2.deal)}{th(c.tbl.cols2.status)}{th(c.tbl.cols2.source)}{th(c.tbl.cols2.team)}{th(c.tbl.updated, "updated")}<th className="w-[70px]" />
            </tr></thead>
            <tbody>
              {rows.map((x) => { const d = deals[x.id]; const m = crm.me.members.find((y) => y.id === x.ownerId); const main = x.contacts.find((y) => y.isMain) ?? x.contacts[0]; const reg = regionOf(x); const over = isOver(x); const st = crm.stages.find((s) => s.id === d?.stageId); return (
                <tr key={x.id} onClick={() => router.push(`${crm.base}/c/${x.id}`)} className={`group cursor-pointer hover:bg-[#f7f8fa] ${sel.has(x.id) ? "bg-blue-tint/50" : ""}`} style={over ? { boxShadow: "inset 3px 0 0 #e5484d" } : undefined}>
                  <td className={`px-3 ${pad}`} onClick={(e) => e.stopPropagation()}><span className="flex items-center gap-2"><IconChevronRight size={14} className="text-muted" /><input type="checkbox" checked={sel.has(x.id)} onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(x.id); else n.delete(x.id); return n; })} /></span></td>
                  <td className={`px-3 ${pad}`}><span className="flex items-center gap-[6px]"><button type="button" disabled={ro} onClick={async (e) => { e.stopPropagation(); const order: (Client["priority"])[] = [null, "hot", "warm", "cold"]; const next = order[(order.indexOf(x.priority) + 1) % order.length]; try { await patchClient(x.id, { priority: next }); load(); } catch (er) { err(er); } }} title={x.priority ? c.prio[x.priority] : c.prio.none} className="h-[10px] w-[10px] flex-none cursor-pointer rounded-full border border-line hover:scale-125" style={{ background: x.priority ? PRIO_COLOR[x.priority] : "transparent", borderColor: x.priority ? PRIO_COLOR[x.priority] : undefined }} /><Link href={`${crm.base}/c/${x.id}`} onClick={(e) => e.stopPropagation()} className="truncate font-semibold text-ink hover:text-blue-2">{x.name}</Link>{x.roles.slice(0, 2).map((r) => <span key={r} className="rounded-[3px] bg-bg-2 px-[5px] text-[10.5px] font-medium text-muted">{c.roles[r]}</span>)}</span>{!dense && <span className={`block truncate text-[12px] ${over ? "text-red" : "text-muted"}`}>{main?.value ?? "—"}{over && x.nextTask ? ` · ${fill(c.tbl.overdueBy, { d: hoursAgo(x.nextTask.dueAt) })}` : ""}</span>}{dense && over && <span className="ml-2 text-[11px] text-red">!</span>}</td>
                  <td className={`px-3 ${pad}`}>{reg ? <span className="inline-flex items-center gap-[6px] text-text">{reg.name}{reg.more > 0 && <span className="rounded-full bg-blue-tint px-[6px] text-[11px] font-semibold text-sel-ink">+{reg.more}</span>}</span> : <span className="text-muted">—</span>}</td>
                  <td className={`max-w-[260px] px-3 ${pad}`}>{d ? <><span className="block truncate text-text">{d.title || (d.amount != null ? fmt(d.amount, d.cur as Currency) : "—")}</span>{!dense && <span className="block truncate text-[12px] text-muted">{t.deal[d.deal as keyof typeof t.deal]}{d.amount != null ? ` · ${fmt(d.amount, d.cur as Currency)}` : ""}</span>}</> : <span className="text-muted">—</span>}</td>
                  <td className={`px-3 ${pad}`} onClick={(e) => e.stopPropagation()}><StageMenu value={x.stage} clientId={x.id} ownerId={x.ownerId} onChange={async (k) => { try { await patchClient(x.id, { stage: k }); load(); } catch (er) { err(er); } }} disabled={ro} />{!dense && <span className="mt-[3px] block truncate text-[12px] text-muted">{d ? (d.closed ? (d.closed === "won" ? c.tbl.won : c.tbl.lost) : `${c.deal.stage}: ${stageName(st, t, lang)}`) : x.nextTask ? x.nextTask.title : ""}</span>}</td>
                  <td className={`px-3 ${pad}`}><span className="block truncate text-text">{sourceName(crm.sources.find((s) => s.id === x.sourceId), t)}</span>{!dense && <span className="block text-[12px] text-muted">{x.lang}{x.tags.length ? ` · ${x.tags.slice(0, 2).join(", ")}` : ""}</span>}</td>
                  <td className={`px-3 ${pad}`} onClick={(e) => e.stopPropagation()}>{crm.me.members.length > 1 && !ro ? <Select value={x.ownerId ?? ""} onChange={async (v) => { try { await patchClient(x.id, { ownerId: v || null }); load(); } catch (e) { err(e); } }} options={[{ value: "", label: c.tbl.unassigned }, ...crm.me.members.map((mm) => ({ value: mm.id, label: mm.name }))]} size="sm" menuWidth="auto" stopPropagation className="w-[170px]" icon={m ? <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: m.color }}>{initials(m.name)}</span> : undefined} /> : m ? <span className="inline-flex items-center gap-2"><span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: m.color }}>{initials(m.name)}</span><span className="truncate text-text">{m.name}</span></span> : <span className="text-muted">{c.tbl.unassigned}</span>}</td>
                  <td className={`px-3 ${pad} text-muted`}>{fmtDate(x.updatedAt, lang)}</td>
                  <td className={`px-2 ${pad}`} onClick={(e) => e.stopPropagation()}><span className="flex items-center justify-end gap-1 opacity-0 transition group-hover:opacity-100">{main && (main.kind === "phone" || main.kind === "whatsapp") && <a href={`tel:${main.value.replace(/[^\d+]/g, "")}`} title={c.client.call} className="flex h-7 w-7 items-center justify-center rounded-[4px] text-muted hover:bg-bg-2 hover:text-ink"><IconPhone size={15} /></a>}<button type="button" onClick={() => setDrawer(x.id)} title={c.tbl.quickView} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[4px] text-muted hover:bg-bg-2 hover:text-ink"><IconEye size={15} /></button><Link href={`${crm.base}/c/${x.id}`} title={c.tbl.openTab} className="flex h-7 w-7 items-center justify-center rounded-[4px] text-muted hover:bg-bg-2 hover:text-ink"><IconExternalLink size={15} /></Link></span></td>
                </tr>); })}
            </tbody>
          </table>
        )}
      </div>
      {drawer && <ClientDrawer id={drawer} onClose={() => setDrawer(null)} onChanged={load} />}
      <ClientModal open={modal} client={null} onClose={() => setModal(false)} onSaved={(id) => { setModal(false); router.push(`${crm.base}/c/${id}`); }} onOpenDup={(id) => router.push(`${crm.base}/c/${id}`)} />
    </>
  );
}

const ROLES_F = ["buyer", "seller", "landlord", "tenant"] as const;
const PRIOS_F = ["hot", "warm", "cold", "none"] as const;
const KINDS_F = ["buy", "sell", "rent_out", "rent_in"] as const;
const CHANNELS_F = ["call", "whatsapp", "telegram", "email"] as const;

/** Подпись активного фильтра для чипов. */
function fltLabel(k: keyof Flt, v: string, t: ReturnType<typeof useI18n>["t"], crm: ReturnType<typeof useCrm>, lang: Lang): string {
  const c = t.crm;
  switch (k) {
    case "owner": return crm.me.members.find((m) => m.id === v)?.name ?? v;
    case "branch": return crm.me.branches.find((b) => b.id === v)?.name ?? v;
    case "source": return sourceName(crm.sources.find((x) => x.id === v), t);
    case "role": return (c.roles as Record<string, string>)[v] ?? v;
    case "cstage": return stageName(crm.cstages.find((x) => x.key === v), t, lang);
    case "dealStage": return v === "won" ? c.tbl.won : v === "lost" ? c.tbl.lost : v === "none" ? c.tbl.noStage : stageName(crm.stages.find((x) => x.id === v), t, lang);
    case "priority": return (c.prio as Record<string, string>)[v] ?? v;
    case "kind": return (c.rq.kinds as Record<string, string>)[v] ?? v;
    case "il": return GEO.find((g) => g.k === v)?.n ?? v;
    case "channel": return (c.channel as Record<string, string>)[v] ?? v;
    case "budgetMin": return `≥ ${v}`;
    case "budgetMax": return `≤ ${v}`;
    case "createdFrom": return `${c.tbl.flt.created}: ${fmtD(v)} –`;
    case "createdTo": return `– ${fmtD(v)}`;
    default: return v;
  }
}

/** Поле фильтра для «+ Фильтр»: подпись и способ ввода значения. */
type FieldDef = { key: string; label: string; kind: "select" | "budget" | "dates"; opts?: { value: string; label: string }[] };
function useFieldDefs(allTags: string[]): FieldDef[] {
  const { t, lang } = useI18n(); const crm = useCrm(); const c = t.crm;
  const opt = (list: readonly string[], names: Record<string, string>) => list.map((v) => ({ value: v, label: names[v] ?? v }));
  const defs: FieldDef[] = [
    { key: "role", label: c.client.roles, kind: "select", opts: opt(ROLES_F, c.roles) },
    { key: "cstage", label: c.client.stage, kind: "select", opts: crm.cstages.map((x) => ({ value: x.key, label: stageName(x, t, lang) })) },
    { key: "dealStage", label: c.tbl.dealStage, kind: "select", opts: [...crm.stages.filter((x) => x.kind === "open").map((x) => ({ value: x.id, label: stageName(x, t, lang) })), { value: "won", label: c.tbl.won }, { value: "lost", label: c.tbl.lost }, { value: "none", label: c.tbl.noStage }] },
    { key: "priority", label: c.client.priority, kind: "select", opts: opt(PRIOS_F, c.prio) },
    { key: "kind", label: c.rq.kind, kind: "select", opts: opt(KINDS_F, c.rq.kinds) },
    { key: "il", label: c.want.il, kind: "select", opts: GEO.map((g) => ({ value: g.k, label: g.n })) },
    { key: "budget", label: c.client.budget, kind: "budget" },
    { key: "source", label: c.source, kind: "select", opts: crm.sources.map((x) => ({ value: x.id, label: sourceName(x, t) })) },
    ...(crm.me.members.length > 1 ? [{ key: "owner", label: c.owner, kind: "select" as const, opts: crm.me.members.map((m) => ({ value: m.id, label: m.name })) }] : []),
    ...(crm.me.branches.length > 0 ? [{ key: "branch", label: c.client.branch, kind: "select" as const, opts: crm.me.branches.map((b) => ({ value: b.id, label: b.name })) }] : []),
    { key: "lang", label: c.client.lang, kind: "select", opts: ["RU", "EN", "TR"].map((l) => ({ value: l, label: l })) },
    { key: "channel", label: c.client.channel, kind: "select", opts: opt(CHANNELS_F, c.channel) },
    ...(allTags.length ? [{ key: "tag", label: c.tbl.tag, kind: "select" as const, opts: allTags.map((g) => ({ value: g, label: g })) }] : []),
    { key: "created", label: c.tbl.flt.created, kind: "dates" },
  ];
  return defs;
}
/** Активные условия как пилюли «Поле: значение» (составные budget/created — одной пилюлей). */
function pillsOf(flt: Flt, defs: FieldDef[], t: ReturnType<typeof useI18n>["t"], crm: ReturnType<typeof useCrm>, lang: Lang): { key: string; label: string; value: string }[] {
  const out: { key: string; label: string; value: string }[] = [];
  for (const d of defs) {
    if (d.kind === "budget") { if (flt.budgetMin || flt.budgetMax) out.push({ key: d.key, label: d.label, value: `${flt.budgetMin ? `≥ ${Number(flt.budgetMin).toLocaleString("ru-RU")}` : ""}${flt.budgetMin && flt.budgetMax ? " " : ""}${flt.budgetMax ? `≤ ${Number(flt.budgetMax).toLocaleString("ru-RU")}` : ""}` }); }
    else if (d.kind === "dates") { if (flt.createdFrom || flt.createdTo) out.push({ key: d.key, label: d.label, value: `${fmtD(flt.createdFrom) || "…"} – ${fmtD(flt.createdTo) || "…"}` }); }
    else { const v = flt[d.key as keyof Flt]; if (v) out.push({ key: d.key, label: d.label, value: fltLabel(d.key as keyof Flt, v, t, crm, lang) }); }
  }
  return out;
}
const clearField = (key: string): Partial<Flt> => (key === "budget" ? { budgetMin: "", budgetMax: "" } : key === "created" ? { createdFrom: "", createdTo: "" } : ({ [key]: "" } as Partial<Flt>));

/** Строка фильтров как у Attio/Linear: пилюли условий + «+ Фильтр» → список полей → значение. */
function FilterBar({ flt, setF, reset, allTags }: { flt: Flt; setF: (p: Partial<Flt>) => void; reset: () => void; allTags: string[] }) {
  const { t, lang } = useI18n(); const crm = useCrm(); const c = t.crm;
  const defs = useFieldDefs(allTags);
  const pills = pillsOf(flt, defs, t, crm, lang);
  const [open, setOpen] = useState<{ mode: "pick" | "value"; key?: string; anchor?: string } | null>(null);
  const [q, setQ] = useState("");
  const [range, setRange] = useState({ min: flt.budgetMin, max: flt.budgetMax });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(null); }; document.addEventListener("mousedown", h, true); return () => document.removeEventListener("mousedown", h, true); }, [open]);
  useEscape(!!open, () => setOpen(null));
  const def = open?.key ? defs.find((d) => d.key === open.key) : undefined;
  const pickField = (d: FieldDef) => { setQ(""); setRange({ min: flt.budgetMin, max: flt.budgetMax }); setOpen({ mode: "value", key: d.key, anchor: open?.anchor }); };
  const fields = defs.filter((d) => !q.trim() || d.label.toLowerCase().includes(q.trim().toLowerCase()));
  const pop = "absolute left-0 top-[calc(100%+4px)] z-30 w-[260px] rounded-[8px] border border-line bg-surface p-1 shadow-[0_12px_40px_rgba(20,36,63,.16)]";
  const item = (on: boolean) => `flex h-8 w-full cursor-pointer items-center rounded-[5px] px-2 text-left text-[13px] ${on ? "bg-blue-tint font-semibold text-sel-ink" : "text-ink hover:bg-bg-3"}`;
  return (
    <div ref={ref} className="mb-3 flex flex-wrap items-center gap-[6px]">
      {pills.map((p) => (
        <span key={p.key} className="relative inline-flex h-7 items-center rounded-full border border-sel-line bg-blue-tint pl-3 pr-1 text-[12.5px] text-sel-ink">
          <button type="button" onClick={() => { setOpen(open?.key === p.key ? null : { mode: "value", key: p.key, anchor: p.key }); setRange({ min: flt.budgetMin, max: flt.budgetMax }); }} className="cursor-pointer"><span className="text-sel-ink/70">{p.label}:</span> <span className="font-semibold">{p.value}</span></button>
          <button type="button" onClick={() => setF(clearField(p.key))} className="ml-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full hover:bg-white/60"><IconX size={12} /></button>
          {open?.mode === "value" && open.anchor === p.key && def && <ValuePop def={def} flt={flt} range={range} setRange={setRange} apply={(p2) => { setF(p2); setOpen(null); }} pop={pop} item={item} />}
        </span>
      ))}
      <span className="relative">
        <button type="button" onClick={() => { setOpen(open ? null : { mode: "pick", anchor: "+" }); setQ(""); }} className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-dashed border-line px-3 text-[12.5px] font-medium text-text hover:border-blue hover:text-ink"><IconPlus size={13} /> {c.tbl.addFilter}</button>
        {open?.mode === "pick" && (
          <div className={pop}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.tbl.findField} autoFocus className="mb-1 h-8 w-full rounded-[5px] border border-line px-2 text-[13px] outline-none focus:border-blue" />
            <div className="max-h-[280px] overflow-y-auto">{fields.map((d) => <button key={d.key} type="button" onClick={() => pickField(d)} className={item(false)}>{d.label}</button>)}</div>
          </div>
        )}
        {open?.mode === "value" && open.anchor === "+" && def && <ValuePop def={def} flt={flt} range={range} setRange={setRange} apply={(p2) => { setF(p2); setOpen(null); }} pop={pop} item={item} />}
      </span>
      {pills.length > 0 && <button type="button" onClick={reset} className="ml-1 cursor-pointer text-[12.5px] font-semibold text-muted hover:text-red">{c.tbl.clear}</button>}
    </div>
  );
}
function ValuePop({ def, flt, range, setRange, apply, pop, item }: { def: FieldDef; flt: Flt; range: { min: string; max: string }; setRange: (r: { min: string; max: string }) => void; apply: (p: Partial<Flt>) => void; pop: string; item: (on: boolean) => string }) {
  const { t } = useI18n(); const c = t.crm;
  const [q, setQ] = useState("");
  if (def.kind === "select") {
    const cur = flt[def.key as keyof Flt];
    const opts = (def.opts ?? []).filter((o) => !q.trim() || o.label.toLowerCase().includes(q.trim().toLowerCase()));
    return (
      <div className={pop}>
        <div className="px-2 pb-1 pt-1 text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{def.label}</div>
        {(def.opts?.length ?? 0) > 8 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.tbl.findField} autoFocus className="mb-1 h-8 w-full rounded-[5px] border border-line px-2 text-[13px] outline-none focus:border-blue" />}
        <div className="max-h-[280px] overflow-y-auto">{opts.map((o) => <button key={o.value} type="button" onClick={() => apply({ [def.key]: o.value } as Partial<Flt>)} className={item(cur === o.value)}>{o.label}</button>)}</div>
      </div>
    );
  }
  if (def.kind === "budget") return (
    <div className={`${pop} p-3`}>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{def.label}</div>
      <div className="grid grid-cols-2 gap-2"><input inputMode="numeric" value={range.min} onChange={(e) => setRange({ ...range, min: e.target.value.replace(/\D/g, "") })} placeholder={c.tbl.flt.budgetFrom} autoFocus className={inp} /><input inputMode="numeric" value={range.max} onChange={(e) => setRange({ ...range, max: e.target.value.replace(/\D/g, "") })} placeholder={c.tbl.flt.budgetTo} className={inp} onKeyDown={(e) => { if (e.key === "Enter") apply({ budgetMin: range.min, budgetMax: range.max }); }} /></div>
      <button type="button" onClick={() => apply({ budgetMin: range.min, budgetMax: range.max })} className={`${btnP} mt-2 w-full justify-center`}>{c.tbl.apply}</button>
    </div>
  );
  return (
    <div className={`${pop} w-[300px] p-3`}>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{def.label}</div>
      <DateRange from={flt.createdFrom} to={flt.createdTo} onChange={(a, b) => apply({ createdFrom: a, createdTo: b })} />
    </div>
  );
}

/** «Все фильтры» — панель справа блоками (клиент · команда и источник · заявка · даты); таблица остаётся на месте. */
function FilterDrawer({ flt, setF, reset, allTags, onClose }: { flt: Flt; setF: (p: Partial<Flt>) => void; reset: () => void; allTags: string[]; onClose: () => void }) {
  const { t, lang } = useI18n(); const crm = useCrm(); const c = t.crm; const f = c.tbl.flt;
  useEscape(true, onClose);
  const block = (title: string, children: React.ReactNode) => <div><div className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{title}</div><div className="flex flex-col gap-2">{children}</div></div>;
  const opt = (label: string, list: readonly string[], names: Record<string, string>) => [{ value: "", label }, ...list.map((v) => ({ value: v, label: names[v] ?? v }))];
  const active = Object.values(flt).filter(Boolean).length;
  return (
    <>
      <div className="fixed inset-0 z-[300] bg-ink/20" onClick={onClose} />
      <aside data-crm-form="1" className="fixed right-0 top-0 z-[310] flex h-screen w-[420px] max-w-full flex-col border-l border-line bg-surface shadow-[-10px_0_40px_rgba(20,36,63,.15)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-3"><div className="text-[15px] font-semibold text-ink">{c.tbl.filters}{active ? <span className="ml-2 rounded-full bg-blue-tint px-2 py-[1px] text-[11px] text-sel-ink">{active}</span> : null}</div><button type="button" onClick={onClose} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-bg-3 hover:text-ink"><IconX size={17} /></button></div>
        <div className="flex min-h-0 flex-1 flex-col gap-5 overflow-y-auto px-5 py-4">
          {block(f.client, <>
            <Select value={flt.role} onChange={(v) => setF({ role: v })} options={opt(c.client.roles, ROLES_F, c.roles)} size="sm" />
            <Select value={flt.cstage} onChange={(v) => setF({ cstage: v })} options={[{ value: "", label: c.client.stage }, ...crm.cstages.map((x) => ({ value: x.key, label: stageName(x, t, lang) }))]} size="sm" />
            <Select value={flt.dealStage} onChange={(v) => setF({ dealStage: v })} options={[{ value: "", label: c.tbl.dealStage }, ...crm.stages.filter((x) => x.kind === "open").map((x) => ({ value: x.id, label: stageName(x, t, lang) })), { value: "won", label: c.tbl.won }, { value: "lost", label: c.tbl.lost }, { value: "none", label: c.tbl.noStage }]} size="sm" />
            <Select value={flt.priority} onChange={(v) => setF({ priority: v })} options={opt(c.client.priority, PRIOS_F, c.prio)} size="sm" />
            <div className="grid grid-cols-2 gap-2"><Select value={flt.lang} onChange={(v) => setF({ lang: v })} options={[{ value: "", label: c.client.lang }, ...["RU", "EN", "TR"].map((l) => ({ value: l, label: l }))]} size="sm" /><Select value={flt.channel} onChange={(v) => setF({ channel: v })} options={opt(c.client.channel, CHANNELS_F, c.channel)} size="sm" /></div>
          </>)}
          {block(f.team, <>
            {crm.me.members.length > 1 && <Select value={flt.owner} onChange={(v) => setF({ owner: v })} options={[{ value: "", label: c.owner }, ...crm.me.members.map((m) => ({ value: m.id, label: m.name }))]} size="sm" />}
            {crm.me.branches.length > 0 && <Select value={flt.branch} onChange={(v) => setF({ branch: v })} options={[{ value: "", label: c.client.branch }, ...crm.me.branches.map((b) => ({ value: b.id, label: b.name }))]} size="sm" />}
            <Select value={flt.source} onChange={(v) => setF({ source: v })} options={[{ value: "", label: c.source }, ...crm.sources.map((x) => ({ value: x.id, label: sourceName(x, t) }))]} size="sm" />
            <Select value={flt.tag} onChange={(v) => setF({ tag: v })} options={[{ value: "", label: c.tbl.tag }, ...allTags.map((g) => ({ value: g, label: g }))]} size="sm" disabled={!allTags.length} />
          </>)}
          {block(f.request, <>
            <Select value={flt.kind} onChange={(v) => setF({ kind: v })} options={opt(c.rq.kind, KINDS_F, c.rq.kinds)} size="sm" />
            <Select value={flt.il} onChange={(v) => setF({ il: v })} options={[{ value: "", label: c.want.il }, ...GEO.map((g) => ({ value: g.k, label: g.n }))]} size="sm" searchable />
            <div className="grid grid-cols-2 gap-2"><input inputMode="numeric" value={flt.budgetMin} onChange={(e) => setF({ budgetMin: e.target.value.replace(/\D/g, "") })} placeholder={f.budgetFrom} className={inp} /><input inputMode="numeric" value={flt.budgetMax} onChange={(e) => setF({ budgetMax: e.target.value.replace(/\D/g, "") })} placeholder={f.budgetTo} className={inp} /></div>
          </>)}
          {block(f.dates, <DateRange from={flt.createdFrom} to={flt.createdTo} onChange={(a, b) => setF({ createdFrom: a, createdTo: b })} placeholder={f.created} />)}
          <div className="text-[12px] text-muted">{f.hint}</div>
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-line px-5 py-3"><button type="button" onClick={reset} disabled={!active} className="cursor-pointer text-[13px] font-semibold text-red hover:underline disabled:cursor-default disabled:opacity-40">{c.tbl.clear}</button><button type="button" onClick={onClose} className={btnP}>{c.tbl.done}</button></div>
      </aside>
    </>
  );
}

/** Позиция fixed-меню под триггером: не вылезать за правый край, при нехватке места снизу — открыть вверх. */
function menuPos(rect: { left: number; top: number; bottom: number } | null, w: number, h: number): React.CSSProperties {
  if (!rect) return { position: "fixed", zIndex: 600 };
  const vw = window.innerWidth || document.documentElement.clientWidth || 1600, vh = window.innerHeight || document.documentElement.clientHeight || 1000;
  const left = Math.max(8, Math.min(rect.left, vw - w - 8));
  const up = rect.bottom + h > vh && rect.top - h > 0;
  return up ? { position: "fixed", zIndex: 600, left, bottom: vh - rect.top + 4 } : { position: "fixed", zIndex: 600, left, top: rect.bottom + 4 };
}
/** Чип этапа клиента с меню «Сменить статус» (как в современных CRM — прямо из списка). */
export function StageMenu({ value, onChange, disabled, clientId, ownerId }: { value: string; onChange: (key: string) => void; disabled?: boolean; clientId: string; ownerId: string | null }) {
  const { t, lang } = useI18n(); const crm = useCrm(); const c = t.crm;
  const [open, setOpen] = useState(false);
  const [visitFor, setVisitFor] = useState<string | null>(null); // этап с датой («Приедет»): выбор даты приезда → задача
  const [due, setDue] = useState("");
  const [rect, setRect] = useState<{ left: number; top: number; bottom: number } | null>(null); // меню — fixed, иначе его режет overflow таблицы
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h, true); return () => document.removeEventListener("mousedown", h, true); }, [open]);
  const st = crm.cstages.find((x) => x.key === value);
  const col = st?.color ?? "#8a93a2";
  return (
    <span ref={ref} className="relative inline-block">
      <button type="button" disabled={disabled} onClick={(e) => { const b = (e.currentTarget as HTMLElement).getBoundingClientRect(); setRect({ left: b.left, top: b.top, bottom: b.bottom }); setVisitFor(null); setOpen((v) => !v); }} className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-[5px] px-2 text-[12px] font-medium hover:brightness-95" style={{ background: col + "1f", color: col }}>{stageName(st, t, lang)}{!disabled && <IconChevronDown size={12} className="opacity-70" />}</button>
      {open && (
        <div style={menuPos(rect, visitFor ? 372 : 232, visitFor ? 440 : 380)} className={`rounded-[8px] border border-line bg-surface p-1 shadow-[0_12px_40px_rgba(20,36,63,.16)] ${visitFor ? "w-[360px]" : "w-[220px]"}`}>
          <div className="px-2 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[.05em] text-muted">{c.tbl.changeStatus}</div>
          {crm.cstages.map((x) => <button key={x.id} type="button" onClick={() => { if (x.key === "visit") { setVisitFor(x.key); const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); setDue(d.toISOString()); return; } setOpen(false); if (x.key !== value) onChange(x.key); }} className={`flex h-8 w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 text-left text-[13px] ${x.key === value ? "bg-blue-tint font-semibold text-sel-ink" : "text-ink hover:bg-bg-3"}`}><span className="h-2 w-2 flex-none rounded-full" style={{ background: x.color ?? "#8a93a2" }} />{stageName(x, t, lang)}{x.key === "visit" && <IconCalendar size={13} className="ml-auto text-muted" />}</button>)}
          {visitFor && (
            <div className="mt-1 border-t border-line p-2">
              <div className="mb-1 text-[11px] font-semibold text-ink">{c.tbl.visitDate}</div>
              <DuePicker value={due} onChange={setDue} />
              <button type="button" onClick={async () => { setOpen(false); setVisitFor(null); onChange(visitFor); try { await saveTask({ clientId, dealId: null, ownerId: ownerId ?? crm.me.meId, kind: "meeting", title: c.tbl.visitTask, dueAt: due || new Date().toISOString() }); } catch { /* задача не создалась — статус уже стоит */ } }} className={`${btnP} mt-2 w-full justify-center`}>{c.tbl.visitSave}</button>
            </div>
          )}
        </div>
      )}
    </span>
  );
}

/** Канбан клиентов по воронке клиента: перетаскивание меняет статус. */
function ClientBoard({ rows, deals, onMove }: { rows: Client[]; deals: Record<string, DealSummary>; onMove: (id: string, key: string) => void }) {
  const { t, lang } = useI18n(); const crm = useCrm(); const c = t.crm; const router = useRouter(); const now = useNow();
  const [dragId, setDragId] = useState<string | null>(null);
  const [over, setOver] = useState<string | null>(null);
  return (
    <div data-crm-kanban="1" className="mb-3 flex gap-0 overflow-x-auto rounded-[6px] border border-line bg-surface">
      {crm.cstages.map((st, i) => { const list = rows.filter((x) => (x.stage || "new") === st.key); return (
        <div key={st.id} onDragOver={(e) => { if (!dragId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (over !== st.key) setOver(st.key); }} onDragLeave={() => setOver((o) => (o === st.key ? null : o))} onDrop={(e) => { e.preventDefault(); if (dragId) onMove(dragId, st.key); setDragId(null); setOver(null); }}
          className={`flex w-[250px] flex-none flex-col bg-[#f7f8fa] ${i > 0 ? "border-l border-line" : ""} ${over === st.key ? "crm-drag-over" : ""}`}>
          <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-[12px] font-semibold text-ink"><span className="h-2 w-2 rounded-full" style={{ background: st.color ?? "#8a93a2" }} />{stageName(st, t, lang)}<span className="font-normal text-muted">{list.length}</span></div>
          <div className="flex min-h-[200px] flex-col gap-2 p-2">
            {list.map((x) => { const d = deals[x.id]; const over2 = !!x.nextTask && new Date(x.nextTask.dueAt).getTime() < now; const m = crm.me.members.find((y) => y.id === x.ownerId); const req = x.requests[0]; return (
              <div key={x.id} draggable onDragStart={(e) => { setDragId(x.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", x.id); }} onDragEnd={() => { setDragId(null); setOver(null); }} onClick={() => router.push(`${crm.base}/c/${x.id}`)}
                className={`cursor-pointer rounded-[4px] border border-line bg-surface p-[10px] hover:border-[#b9c2d0] ${dragId === x.id ? "opacity-50" : ""}`} style={{ borderTop: `3px solid ${x.priority ? PRIO_COLOR[x.priority] : st.color ?? "#8a93a2"}` }}>
                <div className="flex items-center gap-[6px]"><span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{x.name}</span>{m && <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[9px] font-bold text-white" title={m.name} style={{ background: m.color }}>{initials(m.name)}</span>}</div>
                <div className="mt-[2px] truncate text-[12px] text-muted">{x.contacts.find((y) => y.isMain)?.value ?? x.contacts[0]?.value ?? ""}</div>
                {req && <div className="mt-1 truncate text-[12px] text-text"><span className="rounded-[3px] px-1 text-[10.5px] font-semibold text-white" style={{ background: REQ_COLOR[req.kind] }}>{c.rq.kinds[req.kind]}</span> {reqSummary(req.kind, req.fields)}</div>}
                {d && !d.closed && <div className="mt-1 truncate text-[11.5px] text-muted">{c.deal.stage}: {stageName(crm.stages.find((s2) => s2.id === d.stageId), t, lang)}</div>}
                {x.nextTask && <div className={`mt-1 truncate text-[11.5px] ${over2 ? "font-semibold text-red" : "text-muted"}`}>{x.nextTask.title} · {fmtDate(x.nextTask.dueAt, lang)}</div>}
              </div>); })}
          </div>
        </div>); })}
    </div>
  );
}
