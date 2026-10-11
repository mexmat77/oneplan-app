"use client";

// CRM — клиенты списком по образцу пользователя (11.10.2026): заголовок со счётчиком, поиск, «Все фильтры», плотность
// (компакт / развёрнуто), сохранённые виды с числами, строка этапов с числами, таблица с двухстрочными ячейками
// (клиент + телефон, объект + сделка, источник + язык, команда), действия при наведении, панель карточки по клику на строку.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconAdjustmentsHorizontal, IconArchive, IconArrowsSort, IconChevronRight, IconExternalLink, IconEye, IconPhone, IconPlus, IconSearch, IconX } from "@tabler/icons-react";
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
import { btnP, btnS, fill, fmtDate, initials, inp, setPref, sourceName, stageName, useCrm, useNow, usePref } from "./crmUi";

type View = "all" | "mine" | "withTask" | "overdue" | "noDeal";
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
  const urlQ = sp.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) { setPrevUrlQ(urlQ); setQ(urlQ); }
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [view, setView] = useState<View>("all");
  const [stage, setStage] = useState<string>(""); // "" все, "none" без сделки, иначе id этапа
  const [owner, setOwner] = useState(""); const [source, setSource] = useState(""); const [tag, setTag] = useState("");
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [list, setList] = useState<Client[] | null>(null);
  const [deals, setDeals] = useState<Record<string, DealSummary>>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "updated", dir: -1 });
  const [drawer, setDrawer] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const dense = usePref(DENS_LS) !== "expanded";

  const load = useCallback(() => {
    listClients({ q, status }).then(async (l) => { setList(l); setDeals(await clientDealSummary(l.map((x) => x.id)).catch(() => ({}))); }).catch(() => setList([]));
  }, [q, status]);
  useEffect(() => { const h = setTimeout(load, q ? 250 : 0); return () => clearTimeout(h); }, [load, q]);

  const isOver = (x: Client) => !!x.nextTask && new Date(x.nextTask.dueAt).getTime() < now;
  const base = useMemo(() => list ?? [], [list]);
  const viewCount = (v: View) => base.filter((x) => matchView(x, v)).length;
  function matchView(x: Client, v: View) {
    switch (v) { case "mine": return x.ownerId === crm.me.meId; case "withTask": return !!x.nextTask; case "overdue": return isOver(x); case "noDeal": return !deals[x.id]; default: return true; }
  }
  const stageCount = (id: string) => base.filter((x) => (id === "none" ? !deals[x.id] : deals[x.id]?.stageId === id)).length;
  const allTags = useMemo(() => [...new Set(base.flatMap((x) => x.tags))].sort(), [base]);
  const rows = useMemo(() => {
    let r = base.filter((x) => matchView(x, view));
    if (stage) r = r.filter((x) => (stage === "none" ? !deals[x.id] : deals[x.id]?.stageId === stage));
    if (owner) r = r.filter((x) => x.ownerId === owner);
    if (source) r = r.filter((x) => x.sourceId === source);
    if (tag) r = r.filter((x) => x.tags.includes(tag));
    const key = (x: Client) => (sort.key === "name" ? x.name.toLowerCase() : sort.key === "created" ? x.createdAt : x.updatedAt);
    return r.sort((a, b) => (key(a) < key(b) ? -1 : key(a) > key(b) ? 1 : 0) * sort.dir);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, view, stage, owner, source, tag, sort, deals, now]);
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "name" ? 1 : -1 }));
  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const err = (e: unknown) => showToast((e as Error).message === "readonly" ? c.errReadonly : c.errSave);
  async function bulk(patch: Parameters<typeof bulkClients>[1]) { try { await bulkClients([...sel], patch); setSel(new Set()); load(); } catch (e) { err(e); } }
  const hoursAgo = (iso: string) => { const h = Math.max(1, Math.round((now - new Date(iso).getTime()) / 36e5)); return h < 24 ? `${h} ч` : `${Math.round(h / 24)} д`; };
  const regionOf = (x: Client) => { const il = GEO.find((g) => g.k === x.want.il); return il ? { name: il.n, more: x.want.ilces?.length ?? 0 } : null; };
  const activeFilters = [owner, source, tag].filter(Boolean).length;
  const th = (label: string, key?: SortKey) => (
    <th key={label} onClick={key ? () => toggleSort(key) : undefined} className={`px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[.05em] text-muted ${key ? "cursor-pointer select-none hover:text-ink" : ""}`}>
      <span className="inline-flex items-center gap-1">{label}{key && (sort.key === key ? <span className="text-blue-2">{sort.dir === 1 ? "▲" : "▼"}</span> : <IconArrowsSort size={12} className="opacity-40" />)}</span>
    </th>
  );
  const pad = dense ? "py-[6px]" : "py-[12px]";
  const stageChip = (d?: DealSummary) => {
    const st = crm.stages.find((s) => s.id === d?.stageId);
    if (!d) return <span className="text-muted">—</span>;
    const col = st?.color ?? "#8a93a2";
    return <span className="inline-flex items-center rounded-[4px] px-2 py-[2px] text-[12px] font-medium" style={{ background: col + "1f", color: col }}>{stageName(st, t, lang)}</span>;
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h1 className="text-[20px] font-semibold text-ink">{c.nav.clients} <span className="text-[13px] font-normal text-muted">{list ? base.length.toLocaleString("ru-RU") : ""}</span></h1>
        <div className="flex-1" />
        <div className="relative w-[260px]"><IconSearch size={14} className="absolute left-[9px] top-1/2 -translate-y-1/2 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.search} className={`${inp} pl-8`} /></div>
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
        <button type="button" onClick={() => setStage(stage === "none" ? "" : "none")} className={`inline-flex h-7 cursor-pointer items-center gap-[6px] rounded-full border px-3 ${stage === "none" ? "border-ink bg-ink text-white" : "border-line bg-surface text-text hover:bg-bg-3"}`}>{c.tbl.noStage}<span className={stage === "none" ? "text-white/70" : "text-muted"}>{stageCount("none")}</span></button>
      </div>
      {filtersOpen && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[6px] border border-line bg-surface px-3 py-2">
          {crm.me.members.length > 1 && <Select value={owner} onChange={setOwner} options={[{ value: "", label: c.tbl.anyOwner }, ...crm.me.members.map((m) => ({ value: m.id, label: m.name }))]} className="w-[190px]" size="sm" />}
          <Select value={source} onChange={setSource} options={[{ value: "", label: c.tbl.anySource }, ...crm.sources.map((s) => ({ value: s.id, label: sourceName(s, t) }))]} className="w-[180px]" size="sm" />
          <Select value={tag} onChange={setTag} options={[{ value: "", label: c.tbl.anyTag }, ...allTags.map((g) => ({ value: g, label: g }))]} className="w-[160px]" size="sm" />
          {activeFilters > 0 && <button type="button" onClick={() => { setOwner(""); setSource(""); setTag(""); }} className="cursor-pointer text-[12.5px] font-semibold text-red">{c.tbl.clear}</button>}
        </div>
      )}
      {sel.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[6px] bg-ink px-3 py-[6px] text-[12.5px] text-white">
          <span className="font-semibold">{fill(c.tbl.selected, { n: sel.size })}</span>
          {crm.me.members.length > 1 && <Select value="" onChange={(v) => bulk({ ownerId: v })} placeholder={c.tbl.assign} options={crm.me.members.map((m) => ({ value: m.id, label: m.name }))} className="w-[170px]" size="sm" />}
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
                  <td className={`px-3 ${pad}`}><Link href={`${crm.base}/c/${x.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-semibold text-ink hover:text-blue-2">{x.name}</Link>{!dense && <span className={`block truncate text-[12px] ${over ? "text-red" : "text-muted"}`}>{main?.value ?? "—"}{over && x.nextTask ? ` · ${fill(c.tbl.overdueBy, { d: hoursAgo(x.nextTask.dueAt) })}` : ""}</span>}{dense && over && <span className="ml-2 text-[11px] text-red">!</span>}</td>
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
