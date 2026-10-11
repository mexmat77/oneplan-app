"use client";

// CRM v2 — клиенты таблицей (Attio/Folk): сортируемые колонки, выбор колонок (localStorage), фильтры-чипы, поиск,
// выбор строк и групповые действия, клик по строке — боковая панель с карточкой без ухода со списка.
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconAdjustmentsHorizontal, IconArrowsSort, IconCalendarEvent, IconPlus, IconSearch, IconX } from "@tabler/icons-react";
import { bulkClients, clientDealSummary, listClients } from "@/app/crm/actions";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Client } from "@/lib/crm/types";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { ClientDrawer } from "./ClientDrawer";
import { ClientModal } from "./ClientModal";
import { btnP, btnS, chip, fill, fmtDT, fmtDate, initials, inp, setPref, sourceName, stageName, useCrm, usePref } from "./crmUi";

type ColKey = "phone" | "deal" | "stage" | "source" | "owner" | "task" | "tags" | "lang" | "updated" | "created";
const ALL_COLS: ColKey[] = ["phone", "deal", "stage", "source", "owner", "task", "tags", "lang", "updated", "created"];
const DEFAULT_COLS: ColKey[] = ["phone", "stage", "source", "owner", "task", "updated"];
const LS = "opl-crm-cols";
type Sort = { key: "name" | ColKey; dir: 1 | -1 };

export function ClientsTable() {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const router = useRouter();
  const sp = useSearchParams();
  const ro = crm.me.access !== "full";
  const urlQ = sp.get("q") ?? "";
  const [q, setQ] = useState(urlQ);
  const [prevUrlQ, setPrevUrlQ] = useState(urlQ);
  if (urlQ !== prevUrlQ) { setPrevUrlQ(urlQ); setQ(urlQ); } // поиск из шапки → в таблицу
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [owner, setOwner] = useState(""); const [source, setSource] = useState(""); const [tag, setTag] = useState(""); const [withTask, setWithTask] = useState<"" | "task" | "overdue">("");
  const [list, setList] = useState<Client[] | null>(null);
  const [deals, setDeals] = useState<Record<string, { stageId: string | null; amount: number | null; cur: string; title: string }>>({});
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [sort, setSort] = useState<Sort>({ key: "updated", dir: -1 });
  const colsPref = usePref(LS);
  const cols = useMemo<ColKey[]>(() => { try { const v = JSON.parse(colsPref || "null"); return Array.isArray(v) ? v.filter((x) => ALL_COLS.includes(x)) : DEFAULT_COLS; } catch { return DEFAULT_COLS; } }, [colsPref]);
  const [colsOpen, setColsOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [drawer, setDrawer] = useState<string | null>(null);
  const [modal, setModal] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const saveCols = (v: ColKey[]) => setPref(LS, JSON.stringify(v));

  const load = useCallback(() => {
    listClients({ q, status, ownerId: owner || null }).then(async (l) => { setList(l); setDeals(await clientDealSummary(l.map((x) => x.id)).catch(() => ({}))); }).catch(() => setList([]));
  }, [q, status, owner]);
  useEffect(() => { const h = setTimeout(load, q ? 250 : 0); return () => clearTimeout(h); }, [load, q]);

  const allTags = useMemo(() => [...new Set((list ?? []).flatMap((x) => x.tags))].sort(), [list]);
  const rows = useMemo(() => {
    let r = (list ?? []).slice();
    if (source) r = r.filter((x) => x.sourceId === source);
    if (tag) r = r.filter((x) => x.tags.includes(tag));
    if (withTask === "task") r = r.filter((x) => x.nextTask);
    if (withTask === "overdue") r = r.filter((x) => x.nextTask && new Date(x.nextTask.dueAt) < new Date());
    const key = (x: Client): string | number => {
      switch (sort.key) {
        case "name": return x.name.toLowerCase();
        case "phone": return x.contacts[0]?.value ?? "";
        case "deal": return deals[x.id]?.amount ?? -1;
        case "stage": return crm.stages.findIndex((s) => s.id === deals[x.id]?.stageId);
        case "source": return sourceName(crm.sources.find((s) => s.id === x.sourceId), t);
        case "owner": return crm.me.members.find((m) => m.id === x.ownerId)?.name ?? "";
        case "task": return x.nextTask?.dueAt ?? "9";
        case "tags": return x.tags.join(",");
        case "lang": return x.lang;
        case "created": return x.createdAt;
        default: return x.updatedAt;
      }
    };
    r.sort((a, b) => { const ka = key(a), kb = key(b); return (ka < kb ? -1 : ka > kb ? 1 : 0) * sort.dir; });
    return r;
  }, [list, source, tag, withTask, sort, deals, crm, t]);

  const toggleSort = (key: Sort["key"]) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "updated" || key === "created" ? -1 : 1 }));
  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const err = (e: unknown) => showToast((e as Error).message === "readonly" ? c.errReadonly : c.errSave);
  async function bulk(patch: Parameters<typeof bulkClients>[1]) { try { await bulkClients([...sel], patch); setSel(new Set()); load(); } catch (e) { err(e); } }

  const colLabel: Record<ColKey, string> = { phone: c.tbl.phone, deal: c.tbl.deal, stage: c.tbl.stage, source: c.tbl.source, owner: c.tbl.owner, task: c.tbl.task, tags: c.tbl.tags, lang: c.tbl.lang, updated: c.tbl.updated, created: c.tbl.created };
  const activeFilters = [source && sourceName(crm.sources.find((s) => s.id === source), t), tag, withTask && (withTask === "task" ? c.tbl.withTask : c.tbl.overdue), owner && crm.me.members.find((m) => m.id === owner)?.name].filter(Boolean) as string[];
  const th = (k: Sort["key"], label: string) => (
    <th key={k} className="cursor-pointer select-none px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[.05em] text-muted hover:text-ink" onClick={() => toggleSort(k)}>
      <span className="inline-flex items-center gap-1">{label}{sort.key === k ? <span className="text-blue-2">{sort.dir === 1 ? "▲" : "▼"}</span> : <IconArrowsSort size={12} className="opacity-40" />}</span>
    </th>
  );
  const cell = (x: Client, k: ColKey) => {
    const d = deals[x.id];
    switch (k) {
      case "phone": { const m = x.contacts.find((y) => y.isMain) ?? x.contacts[0]; return <span className="text-text">{m?.value ?? <span className="text-muted">—</span>}</span>; }
      case "deal": return d ? <span className="font-semibold text-ink">{d.amount != null ? fmt(d.amount, d.cur as Currency) : d.title || "—"}</span> : <span className="text-muted">{c.tbl.noDeal}</span>;
      case "stage": { const st = crm.stages.find((s) => s.id === d?.stageId); return d ? <span className="inline-flex items-center gap-[6px] rounded-[4px] border border-line bg-surface px-[6px] py-[1px] text-[11.5px] font-medium text-ink"><span className="h-2 w-2 rounded-full" style={{ background: st?.color ?? "#8a93a2" }} />{stageName(st, t, lang)}</span> : <span className="text-muted">—</span>; }
      case "source": return <span className="text-text">{sourceName(crm.sources.find((s) => s.id === x.sourceId), t)}</span>;
      case "owner": { const m = crm.me.members.find((y) => y.id === x.ownerId); return m ? <span className="inline-flex items-center gap-[6px]"><span className="flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-extrabold text-white" style={{ background: m.color }}>{initials(m.name)}</span><span className="truncate text-text">{m.name}</span></span> : <span className="text-muted">—</span>; }
      case "task": return x.nextTask ? <span className={`inline-flex items-center gap-1 ${new Date(x.nextTask.dueAt) < new Date() ? "font-bold text-red" : "text-text"}`}><IconCalendarEvent size={13} />{fmtDT(x.nextTask.dueAt, lang)} · <span className="truncate">{x.nextTask.title}</span></span> : <span className="text-muted">—</span>;
      case "tags": return <span className="flex flex-wrap gap-1">{x.tags.map((g) => <span key={g} className={chip}>{g}</span>)}</span>;
      case "lang": return <span className={chip}>{x.lang}</span>;
      case "created": return <span className="text-muted">{fmtDate(x.createdAt, lang)}</span>;
      default: return <span className="text-muted">{fmtDate(x.updatedAt, lang)}</span>;
    }
  };

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <span className="text-[13px] text-muted">{list ? fill(c.tbl.rows, { n: rows.length }) : ""}</span>
        <div className="relative min-w-[200px] max-w-[320px] flex-1"><IconSearch size={14} className="absolute left-[9px] top-1/2 -translate-y-1/2 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.search} className={`${inp} pl-8`} /></div>
        <button type="button" onClick={() => setFiltersOpen((v) => !v)} className={`${btnS} ${activeFilters.length ? "border-sel-line bg-blue-tint text-sel-ink" : ""}`}><IconAdjustmentsHorizontal size={15} /> {c.tbl.filters}{activeFilters.length ? ` · ${activeFilters.length}` : ""}</button>
        <div className="relative">
          <button type="button" onClick={() => setColsOpen((v) => !v)} className={btnS}>{c.tbl.cols}</button>
          {colsOpen && <div className="absolute left-0 top-[calc(100%+6px)] z-30 w-[200px] rounded-[12px] border border-line bg-surface p-2 shadow-[0_14px_40px_rgba(20,36,63,.16)]" onMouseLeave={() => setColsOpen(false)}>{ALL_COLS.map((k) => <label key={k} className="flex cursor-pointer items-center gap-2 rounded-[8px] px-2 py-[6px] text-[13px] hover:bg-bg-3"><input type="checkbox" checked={cols.includes(k)} onChange={(e) => saveCols(e.target.checked ? ALL_COLS.filter((x) => x === k || cols.includes(x)) : cols.filter((x) => x !== k))} /> {colLabel[k]}</label>)}</div>}
        </div>
        <Select value={status} onChange={(v) => setStatus(v as "active" | "archived")} options={[{ value: "active", label: c.active }, { value: "archived", label: c.archived }]} className="w-[130px]" size="sm" />
        <div className="flex-1" />
        <button type="button" onClick={() => setModal(true)} disabled={ro} className={btnP}><IconPlus size={15} /> {c.addClient}</button>
      </div>
      {filtersOpen && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[6px] border border-line bg-surface px-3 py-2">
          {crm.me.members.length > 1 && <Select value={owner} onChange={setOwner} options={[{ value: "", label: c.tbl.anyOwner }, ...crm.me.members.map((m) => ({ value: m.id, label: m.name }))]} className="w-[190px]" size="sm" />}
          <Select value={source} onChange={setSource} options={[{ value: "", label: c.tbl.anySource }, ...crm.sources.map((s) => ({ value: s.id, label: sourceName(s, t) }))]} className="w-[180px]" size="sm" />
          <Select value={tag} onChange={setTag} options={[{ value: "", label: c.tbl.anyTag }, ...allTags.map((g) => ({ value: g, label: g }))]} className="w-[160px]" size="sm" />
          <Select value={withTask} onChange={(v) => setWithTask(v as "" | "task" | "overdue")} options={[{ value: "", label: c.tbl.task + ": " + c.want.any }, { value: "task", label: c.tbl.withTask }, { value: "overdue", label: c.tbl.overdue }]} className="w-[190px]" size="sm" />
          {activeFilters.length > 0 && <button type="button" onClick={() => { setOwner(""); setSource(""); setTag(""); setWithTask(""); }} className="cursor-pointer text-[12.5px] font-bold text-red">{c.tbl.clear}</button>}
        </div>
      )}
      {sel.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[6px] bg-ink px-3 py-[6px] text-[12.5px] text-white">
          <span className="font-bold">{fill(c.tbl.selected, { n: sel.size })}</span>
          {crm.me.members.length > 1 && <Select value="" onChange={(v) => bulk({ ownerId: v })} placeholder={c.tbl.assign} options={crm.me.members.map((m) => ({ value: m.id, label: m.name }))} className="w-[170px]" size="sm" />}
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && tagInput.trim()) { bulk({ addTag: tagInput.trim() }); setTagInput(""); } }} placeholder={c.tbl.addTagPh} className="w-[170px] rounded-[8px] border border-white/20 bg-white/10 px-2 py-[5px] text-[12.5px] text-white outline-none placeholder:text-white/60" />
          <button type="button" onClick={() => bulk({ status: status === "active" ? "archived" : "active" })} className="cursor-pointer rounded-[8px] bg-white/15 px-3 py-[5px] font-bold hover:bg-white/25">{status === "active" ? c.tbl.archive : c.tbl.restore}</button>
          <button type="button" onClick={() => setSel(new Set())} className="ml-auto cursor-pointer"><IconX size={15} /></button>
        </div>
      )}
      <div className="overflow-x-auto rounded-[6px] border border-line bg-surface">
        {list === null ? <div className="py-12 text-center text-[13px] text-muted">…</div> : rows.length === 0 ? <div className="py-12 text-center text-[13.5px] text-muted">{q || activeFilters.length ? c.notFound : c.noClients}</div> : (
          <table data-crm-table="1" className="w-full min-w-[760px] text-[13px]">
            <thead><tr className="border-b border-line">
              <th className="w-9 px-3 py-2"><input type="checkbox" checked={allSel} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
              {th("name", c.tbl.name)}
              {cols.map((k) => th(k, colLabel[k]))}
            </tr></thead>
            <tbody>
              {rows.map((x) => (
                <tr key={x.id} onClick={() => setDrawer(x.id)} className={`cursor-pointer hover:bg-[#f7f8fa] ${sel.has(x.id) ? "bg-blue-tint/60" : ""}`}>
                  <td className="px-3 py-[6px]" onClick={(e) => e.stopPropagation()}><input type="checkbox" checked={sel.has(x.id)} onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(x.id); else n.delete(x.id); return n; })} /></td>
                  <td className="px-3 py-[6px]"><span className="flex items-center gap-[10px]"><span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-bg-2 text-[10px] font-semibold text-text">{initials(x.name)}</span><span className="min-w-0"><Link href={`${crm.base}/c/${x.id}`} onClick={(e) => e.stopPropagation()} className="block truncate font-semibold text-ink hover:text-blue-2">{x.name}</Link>{!cols.includes("tags") && x.tags.length > 0 && <span className="block truncate text-[11px] text-muted">{x.tags.join(" · ")}</span>}</span></span></td>
                  {cols.map((k) => <td key={k} className="max-w-[260px] truncate px-3 py-[6px]">{cell(x, k)}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
      {drawer && <ClientDrawer id={drawer} onClose={() => setDrawer(null)} onChanged={load} />}
      <ClientModal open={modal} client={null} onClose={() => setModal(false)} onSaved={(id) => { setModal(false); router.push(`${crm.base}/c/${id}`); }} onOpenDup={(id) => router.push(`${crm.base}/c/${id}`)} />
    </>
  );
}
