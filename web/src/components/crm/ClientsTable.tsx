"use client";

// CRM — клиенты списком по образцу пользователя (11.10.2026): заголовок со счётчиком, поиск, «Все фильтры», плотность
// (компакт / развёрнуто), сохранённые виды с числами, строка этапов с числами, таблица с двухстрочными ячейками
// (клиент + телефон, объект + сделка, источник + язык, команда), действия при наведении, панель карточки по клику на строку.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconAdjustmentsHorizontal, IconArchive, IconArrowsSort, IconChevronRight, IconExternalLink, IconEye, IconPhone, IconPlus, IconX } from "@tabler/icons-react";
import { bulkClients, clientDealSummary, listClients, type DealSummary } from "@/app/crm/actions";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Client } from "@/lib/crm/types";
import { fmt } from "@/lib/money";
import { GEO } from "@/lib/seed";
import type { Currency } from "@/lib/types";
import { ClientDrawer } from "./ClientDrawer";
import { ClientModal } from "./ClientModal";
import { PRIO_COLOR, btnP, btnS, cacheGet, cacheSet, fill, fmtDate, initials, inp, setPref, sourceName, stageName, useCrm, useNow, usePref } from "./crmUi";

type View = "all" | "mine" | "withTask" | "overdue" | "noDeal";
type Flt = { owner: string; branch: string; source: string; role: string; cstage: string; priority: string; lang: string; kind: string; il: string; budgetMin: string; budgetMax: string; createdFrom: string; createdTo: string; tag: string; channel: string };
const EMPTY_FLT: Flt = { owner: "", branch: "", source: "", role: "", cstage: "", priority: "", lang: "", kind: "", il: "", budgetMin: "", budgetMax: "", createdFrom: "", createdTo: "", tag: "", channel: "" };
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
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [view, setView] = useState<View>("all");
  const [stage, setStage] = useState<string>(""); // "" все, "none" без сделки, иначе id этапа
  const [flt, setFlt] = useState<Flt>(EMPTY_FLT); // расширенный фильтр блоками (12.10.2026, «как полный поиск в CRM»)
  const setF = (p: Partial<Flt>) => setFlt((v) => ({ ...v, ...p }));
  const [filtersOpen, setFiltersOpen] = useState(false);
  const cacheKey = `${crm.base}:clients:${status}`;
  const [list, setList] = useState<Client[] | null>(() => cacheGet<{ list: Client[]; deals: Record<string, DealSummary> }>(cacheKey)?.list ?? null);
  const [deals, setDeals] = useState<Record<string, DealSummary>>(() => cacheGet<{ list: Client[]; deals: Record<string, DealSummary> }>(cacheKey)?.deals ?? {});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "updated", dir: -1 });
  const [drawer, setDrawer] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const dense = usePref(DENS_LS) !== "expanded";

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
  const stageOf = (x: Client) => { const d = deals[x.id]; return !d ? "none" : d.closed ? d.closed : d.stageId ?? ""; };
  const stageCount = (id: string) => base.filter((x) => stageOf(x) === id).length;
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
  async function bulk(patch: Parameters<typeof bulkClients>[1]) { try { await bulkClients([...sel], patch); setSel(new Set()); load(); } catch (e) { err(e); } }
  const hoursAgo = (iso: string) => { const h = Math.max(1, Math.round((now - new Date(iso).getTime()) / 36e5)); return h < 24 ? `${h} ч` : `${Math.round(h / 24)} д`; };
  const regionOf = (x: Client) => { const g = (x.requests[0]?.fields.geo as { il?: string; ilces?: string[] } | undefined) ?? x.want; const il = GEO.find((y) => y.k === g?.il); return il ? { name: il.n, more: g?.ilces?.length ?? 0 } : null; };
  const activeFilters = Object.values(flt).filter(Boolean).length;
  const th = (label: string, key?: SortKey) => (
    <th key={label} onClick={key ? () => toggleSort(key) : undefined} className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[.05em] text-muted ${key ? "cursor-pointer select-none hover:text-ink" : ""}`}>
      <span className="inline-flex items-center gap-1">{label}{key && (sort.key === key ? <span className="text-blue-2">{sort.dir === 1 ? "▲" : "▼"}</span> : <IconArrowsSort size={12} className="opacity-40" />)}</span>
    </th>
  );
  const pad = dense ? "py-[6px]" : "py-[12px]";
  const stageChip = (d?: DealSummary) => {
    const st = crm.stages.find((s) => s.id === d?.stageId);
    if (!d) return <span className="text-muted">{c.tbl.noStage}</span>;
    if (d.closed) { const col = d.closed === "won" ? "#22c15e" : "#e5484d"; return <span className="inline-flex items-center rounded-[4px] px-2 py-[2px] text-[12px] font-medium" style={{ background: col + "1f", color: col }}>{d.closed === "won" ? c.tbl.won : c.tbl.lost}</span>; }
    const col = st?.color ?? "#8a93a2";
    return <span className="inline-flex items-center rounded-[4px] px-2 py-[2px] text-[12px] font-medium" style={{ background: col + "1f", color: col }}>{stageName(st, t, lang)}</span>;
  };

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
        {/* архив — отдельная вкладка справа: архивные клиенты скрыты из «Активных», но остаются для истории и поиска дублей */}
        <button type="button" onClick={() => setStatus(status === "active" ? "archived" : "active")} className={`-mb-px ml-auto flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2 text-[13px] font-medium ${status === "archived" ? "border-blue-2 text-ink" : "border-transparent text-muted hover:text-ink"}`}><IconArchive size={14} /> {c.archived}{status === "archived" && list ? <span className="rounded-full bg-bg-2 px-[7px] py-[1px] text-[11px] text-muted">{base.length}</span> : null}</button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-[6px] text-[12.5px]">
        <span className="mr-1 text-muted">{c.tbl.stageRow}</span>
        {crm.stages.filter((s) => s.kind === "open").map((s) => { const n = stageCount(s.id); return <button key={s.id} type="button" onClick={() => setStage(stage === s.id ? "" : s.id)} className={`inline-flex h-7 cursor-pointer items-center gap-[6px] rounded-full border px-3 ${stage === s.id ? "border-ink bg-ink text-white" : "border-line bg-surface text-text hover:bg-bg-3"}`}><span className="h-2 w-2 rounded-full" style={{ background: s.color ?? "#8a93a2" }} />{stageName(s, t, lang)}<span className={stage === s.id ? "text-white/70" : "text-muted"}>{n}</span></button>; })}
        {([["won", c.tbl.won, "#22c15e"], ["lost", c.tbl.lost, "#e5484d"], ["none", c.tbl.noStage, "#c9d0dc"]] as const).map(([k, l, col]) => <button key={k} type="button" onClick={() => setStage(stage === k ? "" : k)} className={`inline-flex h-7 cursor-pointer items-center gap-[6px] rounded-full border px-3 ${stage === k ? "border-ink bg-ink text-white" : "border-line bg-surface text-text hover:bg-bg-3"}`}><span className="h-2 w-2 rounded-full" style={{ background: col }} />{l}<span className={stage === k ? "text-white/70" : "text-muted"}>{stageCount(k)}</span></button>)}
      </div>
      {filtersOpen && <FilterPanel flt={flt} setF={setF} reset={() => setFlt(EMPTY_FLT)} allTags={allTags} />}
      {activeFilters > 0 && !filtersOpen && <ActiveChips flt={flt} setF={setF} reset={() => setFlt(EMPTY_FLT)} />}
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
      <div className="overflow-x-auto rounded-[6px] border border-line bg-surface">
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
                  <td className={`px-3 ${pad}`}><span className="flex items-center gap-[6px]">{x.priority && <span className="h-2 w-2 flex-none rounded-full" title={c.prio[x.priority]} style={{ background: PRIO_COLOR[x.priority] }} />}<Link href={`${crm.base}/c/${x.id}`} onClick={(e) => e.stopPropagation()} className="truncate font-semibold text-ink hover:text-blue-2">{x.name}</Link>{x.roles.slice(0, 2).map((r) => <span key={r} className="rounded-[3px] bg-bg-2 px-[5px] text-[10.5px] font-medium text-muted">{c.roles[r]}</span>)}</span>{!dense && <span className={`block truncate text-[12px] ${over ? "text-red" : "text-muted"}`}>{main?.value ?? "—"}{over && x.nextTask ? ` · ${fill(c.tbl.overdueBy, { d: hoursAgo(x.nextTask.dueAt) })}` : ""}</span>}{dense && over && <span className="ml-2 text-[11px] text-red">!</span>}</td>
                  <td className={`px-3 ${pad}`}>{reg ? <span className="inline-flex items-center gap-[6px] text-text">{reg.name}{reg.more > 0 && <span className="rounded-full bg-blue-tint px-[6px] text-[11px] font-semibold text-sel-ink">+{reg.more}</span>}</span> : <span className="text-muted">—</span>}</td>
                  <td className={`max-w-[260px] px-3 ${pad}`}>{d ? <><span className="block truncate text-text">{d.title || (d.amount != null ? fmt(d.amount, d.cur as Currency) : "—")}</span>{!dense && <span className="block truncate text-[12px] text-muted">{t.deal[d.deal as keyof typeof t.deal]}{d.amount != null ? ` · ${fmt(d.amount, d.cur as Currency)}` : ""}</span>}</> : <span className="text-muted">—</span>}</td>
                  <td className={`px-3 ${pad}`}>{stageChip(d)}{!dense && st && x.nextTask && <span className="mt-[3px] block truncate text-[12px] text-muted">{x.nextTask.title}</span>}</td>
                  <td className={`px-3 ${pad}`}><span className="block truncate text-text">{sourceName(crm.sources.find((s) => s.id === x.sourceId), t)}</span>{!dense && <span className="block text-[12px] text-muted">{x.lang}{x.tags.length ? ` · ${x.tags.slice(0, 2).join(", ")}` : ""}</span>}</td>
                  <td className={`px-3 ${pad}`}>{m ? <span className="inline-flex items-center gap-2"><span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: m.color }}>{initials(m.name)}</span><span className="truncate text-text">{m.name}</span></span> : <span className="inline-flex items-center gap-2 text-muted"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-2 text-[10px]">—</span>{c.tbl.unassigned}</span>}</td>
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
const CSTAGES_F = ["new", "contacted", "qualified", "unqualified"] as const;
const PRIOS_F = ["hot", "warm", "cold", "none"] as const;
const KINDS_F = ["buy", "sell", "rent_out", "rent_in"] as const;
const CHANNELS_F = ["call", "whatsapp", "telegram", "email"] as const;

/** Подпись активного фильтра для чипов. */
function fltLabel(k: keyof Flt, v: string, t: ReturnType<typeof useI18n>["t"], crm: ReturnType<typeof useCrm>): string {
  const c = t.crm;
  switch (k) {
    case "owner": return crm.me.members.find((m) => m.id === v)?.name ?? v;
    case "branch": return crm.me.branches.find((b) => b.id === v)?.name ?? v;
    case "source": return sourceName(crm.sources.find((x) => x.id === v), t);
    case "role": return (c.roles as Record<string, string>)[v] ?? v;
    case "cstage": return (c.cstage as Record<string, string>)[v] ?? v;
    case "priority": return (c.prio as Record<string, string>)[v] ?? v;
    case "kind": return (c.rq.kinds as Record<string, string>)[v] ?? v;
    case "il": return GEO.find((g) => g.k === v)?.n ?? v;
    case "channel": return (c.channel as Record<string, string>)[v] ?? v;
    case "budgetMin": return `≥ ${v}`;
    case "budgetMax": return `≤ ${v}`;
    case "createdFrom": return `${c.tbl.flt.createdFrom} ${v}`;
    case "createdTo": return `${c.tbl.flt.createdTo} ${v}`;
    default: return v;
  }
}

function ActiveChips({ flt, setF, reset }: { flt: Flt; setF: (p: Partial<Flt>) => void; reset: () => void }) {
  const { t } = useI18n(); const crm = useCrm();
  const keys = (Object.keys(flt) as (keyof Flt)[]).filter((k) => flt[k]);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-[6px] text-[12.5px]">
      {keys.map((k) => <span key={k} className="inline-flex h-7 items-center gap-1 rounded-full border border-sel-line bg-blue-tint pl-3 pr-1 font-medium text-sel-ink">{fltLabel(k, flt[k], t, crm)}<button type="button" onClick={() => setF({ [k]: "" } as Partial<Flt>)} className="flex h-5 w-5 cursor-pointer items-center justify-center rounded-full hover:bg-white/60"><IconX size={12} /></button></span>)}
      <button type="button" onClick={reset} className="cursor-pointer text-[12.5px] font-semibold text-red hover:underline">{t.crm.tbl.clear}</button>
    </div>
  );
}

/** Расширенный фильтр блоками: клиент · команда и источник · заявка · сделка и даты. */
function FilterPanel({ flt, setF, reset, allTags }: { flt: Flt; setF: (p: Partial<Flt>) => void; reset: () => void; allTags: string[] }) {
  const { t } = useI18n(); const crm = useCrm(); const c = t.crm; const f = c.tbl.flt;
  const block = (title: string, children: React.ReactNode) => <div className="min-w-0"><div className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{title}</div><div className="flex flex-col gap-2">{children}</div></div>;
  const opt = (label: string, list: readonly string[], names: Record<string, string>) => [{ value: "", label }, ...list.map((v) => ({ value: v, label: names[v] ?? v }))];
  const active = Object.values(flt).filter(Boolean).length;
  return (
    <div data-crm-form="1" className="mb-3 rounded-[6px] border border-line bg-surface p-4">
      <div className="grid grid-cols-4 gap-5 max-[1200px]:grid-cols-2 max-md:grid-cols-1">
        {block(f.client, <>
          <Select value={flt.role} onChange={(v) => setF({ role: v })} options={opt(c.client.roles, ROLES_F, c.roles)} size="sm" />
          <Select value={flt.cstage} onChange={(v) => setF({ cstage: v })} options={opt(c.client.stage, CSTAGES_F, c.cstage)} size="sm" />
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
          <div className="grid grid-cols-2 gap-2"><input inputMode="numeric" value={flt.budgetMin} onChange={(e) => setF({ budgetMin: e.target.value })} placeholder={f.budgetFrom} className={inp} /><input inputMode="numeric" value={flt.budgetMax} onChange={(e) => setF({ budgetMax: e.target.value })} placeholder={f.budgetTo} className={inp} /></div>
        </>)}
        {block(f.dates, <>
          <div className="grid grid-cols-[auto_1fr] items-center gap-2 text-[12px] text-muted"><span>{f.createdFrom}</span><input type="date" value={flt.createdFrom} onChange={(e) => setF({ createdFrom: e.target.value })} className={inp} /></div>
          <div className="grid grid-cols-[auto_1fr] items-center gap-2 text-[12px] text-muted"><span>{f.createdTo}</span><input type="date" value={flt.createdTo} onChange={(e) => setF({ createdTo: e.target.value })} className={inp} /></div>
        </>)}
      </div>
      <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[12.5px]"><span className="text-muted">{active ? fill(f.active, { n: active }) : f.hint}</span><button type="button" onClick={reset} disabled={!active} className="cursor-pointer font-semibold text-red hover:underline disabled:cursor-default disabled:opacity-40">{c.tbl.clear}</button></div>
    </div>
  );
}
