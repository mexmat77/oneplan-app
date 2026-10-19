"use client";

import { kbAutoFocus } from "@/lib/touch";
// CRM — клиенты списком по образцу пользователя (11.10.2026): заголовок со счётчиком, поиск, «Все фильтры», плотность
// (компакт / развёрнуто), сохранённые виды с числами, строка этапов с числами, таблица с двухстрочными ячейками
// (клиент + телефон, объект + сделка, источник + язык, команда), действия при наведении, панель карточки по клику на строку.
import Link from "next/link";
import { createPortal } from "react-dom";
import { menuPos, REQ_ST_COLOR } from "./ChipMenu";
import { OPTS } from "@/lib/crm/requestFields";
import { ROOMS_ALL } from "@/lib/types";
import { useRouter, useSearchParams } from "next/navigation";
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { IconAdjustmentsHorizontal, IconArchive, IconArrowsSort, IconCalendar, IconCheck, IconChevronDown, IconLayoutKanban, IconLayoutList, IconLayoutRows, IconList, IconChevronRight, IconExternalLink, IconEye, IconMapPin, IconPhone, IconPlus, IconX } from "@tabler/icons-react";
import { bulkClients, crmClientsPage, patchClient, setClientVisit, type DealSummary } from "@/app/crm/actions";
import { DuePicker } from "./DuePicker";
import { DateRange, fmtD } from "@/components/ui/DateRange";
import { Segmented } from "@/components/ui/Segmented";
import { useBackClose, useEscape } from "@/hooks/useScrollLock";
import { Select } from "@/components/ui/Select";
import { showToast, showUndo } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Client } from "@/lib/crm/types";
import type { Lang } from "@/i18n";
import { fmt } from "@/lib/money";
import { ilceName, GEO } from "@/lib/seed";
import type { Currency } from "@/lib/types";
import { ClientDrawer } from "./ClientDrawer";
import { ClientModal } from "./ClientModal";
import { cacheRun, dropIndex, posBetween, sortBoard, crmError, PRIO_COLOR, REQ_COLOR, btnP, btnS, cacheGet, cacheSet, fill, fmtDate, getPref, initials, inp, reqSummary, setPref, sourceName, stageName, useCrm, useNow, usePref, fmtDT, wantGeoLabel } from "./crmUi";
import { GeoPicker } from "@/components/GeoPicker";
import { ilceOfSemt } from "@/store/listings";

type View = "all" | "mine" | "withTask" | "overdue" | "noDeal";
/** Поля-списки фильтра — МУЛЬТИВЫБОР «любое из» (13.10.2026, «покупает и арендует», «в работе и приедет»); бюджет и даты — диапазоны. */
type SelKey = "owner" | "branch" | "source" | "role" | "cstage" | "dealStage" | "priority" | "lang" | "kind" | "il" | "ilces" | "semts" | "tag" | "channel" | "reqStatus" | "propType" | "purpose" | "rooms" | "payment";
const SEL_KEYS: SelKey[] = ["owner", "branch", "source", "role", "cstage", "dealStage", "priority", "lang", "kind", "il", "ilces", "semts", "tag", "channel", "reqStatus", "propType", "purpose", "rooms", "payment"]; // + параметры заявки (19.10.2026, «поиск по всему, что есть в заявке») // ilces/semts — районы и махалле из окна «Расположение» (18.10.2026)
type Flt = Record<SelKey, string[]> & { budgetMin: string; budgetMax: string; createdFrom: string; createdTo: string; visitFrom: string; visitTo: string };
const STR_KEYS = ["budgetMin", "budgetMax", "createdFrom", "createdTo", "visitFrom", "visitTo"] as const;
type SavedView = { id: string; name: string; flt: Flt; stage: string[]; view: View; sort: { key: SortKey; dir: 1 | -1 } };
const MODE_LS = "opl-crm-clients-mode";
const EMPTY_FLT: Flt = { owner: [], branch: [], source: [], role: [], cstage: [], dealStage: [], priority: [], lang: [], kind: [], il: [], ilces: [], semts: [], tag: [], channel: [], reqStatus: [], propType: [], purpose: [], rooms: [], payment: [], budgetMin: "", budgetMax: "", createdFrom: "", createdTo: "", visitFrom: "", visitTo: "" };
/** Сохранённое состояние (последний вид, сохранённые виды) могло быть записано, когда значения были одиночными строками. */
function normFlt(p: unknown): Flt {
  const o = (p && typeof p === "object" ? p : {}) as Record<string, unknown>; const out: Flt = { ...EMPTY_FLT };
  for (const k of SEL_KEYS) { const v = o[k]; out[k] = Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x) : typeof v === "string" && v ? [v] : []; }
  for (const k of STR_KEYS) out[k] = typeof o[k] === "string" ? (o[k] as string) : "";
  return out;
}
/** Строка статусов над таблицей = фильтр «Статус клиента» (`flt.cstage`), без отдельного состояния и без дубля-пилюли (13.10.2026);
 *  в сохранённых видах и последнем состоянии раньше лежал `stage` (одна строка) — сливается в cstage. */
const normStage = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string" && !!x) : typeof v === "string" && v ? [v] : []);
const fltActive = (f: Flt) => SEL_KEYS.filter((k) => k !== "ilces" && k !== "semts" && f[k].length).length + (f.budgetMin || f.budgetMax ? 1 : 0) + (f.createdFrom || f.createdTo ? 1 : 0) + (f.visitFrom || f.visitTo ? 1 : 0); // расположение — одно условие
type SortKey = "name" | "activity" | "created" | "updated" | "stage" | "owner" | "source" | "next" | "region";
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
  const last = (() => { try { return JSON.parse(getPref(lastKey) || "{}") as Partial<{ flt: Flt; view: View; stage: string[] | string; sort: { key: SortKey; dir: 1 | -1 } }>; } catch { return {}; } })();
  const [status, setStatus] = useState<"active" | "archived">("active");
  const [view, setView] = useState<View>(last.view ?? "all");
  const [flt, setFlt] = useState<Flt>(() => { const f0 = normFlt(last.flt); return { ...f0, cstage: [...new Set([...f0.cstage, ...normStage(last.stage)])] }; });
  const setF = (p: Partial<Flt>) => { setFlt((v) => ({ ...v, ...p })); setCurSaved(""); };
  const stage = flt.cstage; // строка статусов над таблицей = фильтр «Статус клиента»
  const [filtersOpen, setFiltersOpen] = useState(false);
  const cacheKey = `${crm.base}:clients:${status}`;
  const [list, setList] = useState<Client[] | null>(() => cacheGet<{ list: Client[]; deals: Record<string, DealSummary> }>(cacheKey)?.list ?? null);
  const [deals, setDeals] = useState<Record<string, DealSummary>>(() => cacheGet<{ list: Client[]; deals: Record<string, DealSummary> }>(cacheKey)?.deals ?? {});
  const [sel, setSel] = useState<Set<string>>(new Set());
  // по умолчанию — последняя активность (эталон HubSpot/Pipedrive/Attio, 0023); старая память «updated» → activity
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>(last.sort && last.sort.key !== "updated" ? last.sort : { key: "activity", dir: -1 });
  useEffect(() => { setPref(lastKey, JSON.stringify({ flt, view, sort })); }, [lastKey, flt, view, sort]);
  // сохранённые виды (Linear/Attio: view = сохранённые фильтры), личные, на пространство
  const viewsKey = `opl-crm-views:${crm.base}:${crm.me.ws.id}`;
  const savedRaw = usePref(viewsKey);
  const saved: SavedView[] = (() => { try { const v = JSON.parse(savedRaw || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } })();
  const [curSaved, setCurSaved] = useState<string>(last.flt ? "" : "");
  const saveView = async () => { const name = window.prompt(c.tbl.viewName); if (!name?.trim()) return; const v: SavedView = { id: crypto.randomUUID(), name: name.trim(), flt, stage: [], view, sort }; setPref(viewsKey, JSON.stringify([...saved, v])); setCurSaved(v.id); };
  const applySaved = (v: SavedView) => { const f0 = normFlt(v.flt); setFlt({ ...f0, cstage: [...new Set([...f0.cstage, ...normStage(v.stage)])] }); setView(v.view); setSort(v.sort); setCurSaved(v.id); };
  const deleteSaved = (id: string) => { setPref(viewsKey, JSON.stringify(saved.filter((x) => x.id !== id))); if (curSaved === id) setCurSaved(""); };
  const [drawer, setDrawer] = useState<string | null>(null);
  useBackClose(!!drawer, () => setDrawer(null));
  const [modal, setModal] = useState(false);
  const [tagInput, setTagInput] = useState("");
  const dense = usePref(DENS_LS) !== "expanded";
  const mode = usePref(MODE_LS) === "board" ? "board" : "list"; // список или канбан по воронке клиента (выбор пользователя)

  const patchRow = (id: string, p: Partial<Client>) => setList((prev) => prev?.map((x) => (x.id === id ? { ...x, ...p } : x)) ?? prev); // оптимистично
  const setCounts = crm.setCounts;
  const load = useCallback(() => {
    // без поиска — кэш раздела: прошлые строки показываются сразу, свежие приходят фоном (замечание пользователя 12.10.2026)
    const key = `${crm.base}:clients:${status}`;
    const cached = q ? undefined : cacheGet<{ list: Client[]; deals: Record<string, DealSummary> }>(key);
    if (cached) { setList(cached.list); setDeals(cached.deals); }
    const run = !q ? cacheRun(key, () => crmClientsPage({ q, status })) : crmClientsPage({ q, status });
    run.then(({ list: l, deals: d, counts }) => { setList(l); setDeals(d); if (!q) cacheSet(key, { list: l, deals: d }); setCounts?.(counts); }).catch(() => setList([]));
  }, [q, status, crm.base, setCounts]);
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
  const hoursAgo = (iso: string) => { const h = Math.max(1, Math.round((now - new Date(iso).getTime()) / 36e5)); return h < 24 ? `${h} ч` : `${Math.round(h / 24)} д`; };
  // регион заявки: «Antalya › Döşemealtı», при нескольких районах — первый и «+N» (12.10.2026: «+1» при одном районе путало)
  // регионы ВСЕХ активных заявок клиента (12.10.2026: вторая заявка в другом регионе не показывалась): «Antalya › Döşemealtı,
  // Muratpaşa · Alanya»; больше трёх районов — «+N», полный список в подсказке
  const regionOf = (x: Client) => {
    const geos = [...x.requests.map((r) => r.fields.geo as { il?: string; ilces?: string[] } | undefined), x.requests.length ? undefined : x.want].filter((g): g is { il?: string; ilces?: string[] } => !!g?.il);
    const byIl = new Map<string, Set<string>>();
    for (const g of geos) { const set = byIl.get(g.il!) ?? new Set<string>(); (g.ilces ?? []).forEach((k) => set.add(k)); byIl.set(g.il!, set); }
    if (!byIl.size) return null;
    const parts: string[] = []; let total = 0;
    for (const [ilk, set] of byIl) { const il = GEO.find((y) => y.k === ilk); if (!il) continue; const names = [...set].map(ilceName); total += names.length; parts.push(names.length ? `${il.n} › ${names.join(", ")}` : il.n); }
    const full = parts.join(" · ");
    const short = (() => { let n = 0; const out: string[] = []; for (const [ilk, set] of byIl) { const il = GEO.find((y) => y.k === ilk); if (!il) continue; const names = [...set].map(ilceName); const take = names.slice(0, Math.max(0, 3 - n)); n += names.length; if (take.length || !names.length) out.push(take.length ? `${il.n} › ${take.join(", ")}` : il.n); } return out.join(" · "); })();
    return { name: short, more: Math.max(0, total - 3), full };
  };
  const rows = useMemo(() => {
    let r = base.filter((x) => matchView(x, view));
    // каждое поле — «любое из выбранных»; разные поля — «и»
    if (flt.owner.length) r = r.filter((x) => flt.owner.includes(x.ownerId ?? ""));
    if (flt.source.length) r = r.filter((x) => flt.source.includes(x.sourceId ?? ""));
    if (flt.tag.length) r = r.filter((x) => x.tags.some((g) => flt.tag.includes(g)));
    if (flt.branch.length) r = r.filter((x) => flt.branch.includes(x.branchId ?? ""));
    if (flt.role.length) r = r.filter((x) => x.roles.some((g) => flt.role.includes(g)));
    if (flt.cstage.length) r = r.filter((x) => flt.cstage.includes(x.stage));
    if (flt.dealStage.length) r = r.filter((x) => flt.dealStage.includes(dealStageOf(x)));
    if (flt.priority.length) r = r.filter((x) => flt.priority.includes(x.priority ?? "none"));
    if (flt.lang.length) r = r.filter((x) => flt.lang.includes(x.lang));
    if (flt.channel.length) r = r.filter((x) => flt.channel.includes(x.channel ?? ""));
    if (flt.kind.length) r = r.filter((x) => x.requests.some((q) => flt.kind.includes(q.kind)));
    // параметры заявки: «любое из» внутри поля, совпадение по любой заявке клиента
    if (flt.reqStatus.length) r = r.filter((x) => x.requests.some((q) => flt.reqStatus.includes(q.status)));
    for (const k of ["propType", "purpose", "payment"] as const) if (flt[k].length) r = r.filter((x) => x.requests.some((q) => flt[k].includes(String(q.fields[k] ?? ""))));
    if (flt.rooms.length) r = r.filter((x) => x.requests.some((q) => (Array.isArray(q.fields.rooms) ? (q.fields.rooms as string[]) : []).some((v) => flt.rooms.includes(v))));
    if (flt.visitFrom) r = r.filter((x) => !!x.visitAt && x.visitAt >= flt.visitFrom);
    if (flt.visitTo) r = r.filter((x) => !!x.visitAt && x.visitAt <= flt.visitTo + "T23:59:59");
    if (flt.il.length) r = r.filter((x) => { // расположение как в каталоге: провинция → районы → махалле (18.10.2026)
      const geos = [...x.requests.map((q) => q.fields.geo as { il?: string; ilces?: string[]; semts?: string[] } | undefined), x.want].filter((g): g is { il?: string; ilces?: string[]; semts?: string[] } => !!g);
      return geos.some((g) => flt.il.includes(g.il ?? "")
        && (!flt.ilces.length || (g.ilces ?? []).some((k) => flt.ilces.includes(k)) || (g.semts ?? []).some((k) => flt.ilces.includes(ilceOfSemt(k))))
        && (!flt.semts.length || (g.semts ?? []).some((k) => flt.semts.includes(k))));
    });
    const bMin = +flt.budgetMin.replace(/\D/g, "") || 0, bMax = +flt.budgetMax.replace(/\D/g, "") || 0;
    if (bMin || bMax) r = r.filter((x) => x.requests.some((q) => { const f = q.fields; const hi = Number(f.budgetMax ?? f.rentMax ?? f.priceList ?? f.rent ?? f.budgetMin ?? 0); const lo = Number(f.budgetMin ?? hi); return hi > 0 && (!bMin || hi >= bMin) && (!bMax || lo <= bMax); }));
    if (flt.createdFrom) r = r.filter((x) => x.createdAt >= flt.createdFrom);
    if (flt.createdTo) r = r.filter((x) => x.createdAt <= flt.createdTo + "T23:59:59");
    const stageIdx = new Map(crm.cstages.map((st, i) => [st.key, i]));
    const key = (x: Client): string | number => {
      switch (sort.key) {
        case "name": return x.name.toLowerCase();
        case "created": return x.createdAt;
        case "updated": return x.updatedAt;
        case "stage": return stageIdx.get(x.stage || "new") ?? 999;
        case "owner": return (crm.me.members.find((m) => m.id === x.ownerId)?.name ?? "\uffff").toLowerCase();
        case "source": return (sourceName(crm.sources.find((sr) => sr.id === x.sourceId), t) ?? "\uffff").toLowerCase();
        case "region": return regionOf(x)?.name.toLowerCase() ?? "\uffff";
        case "next": return x.nextTask ? x.nextTask.dueAt : "\uffff"; // без задачи — в конце при любом направлении
        default: return x.lastActivityAt;
      }
    };
    return r.sort((a, b) => {
      const ka = key(a), kb = key(b);
      if (sort.key === "next" && (ka === "\uffff") !== (kb === "\uffff")) return ka === "\uffff" ? 1 : -1;
      return (ka < kb ? -1 : ka > kb ? 1 : 0) * sort.dir;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [base, view, flt, sort, deals, now]);
  const toggleSort = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: ["name", "stage", "owner", "source", "region", "next"].includes(key) ? 1 : -1 }));
  const allSel = rows.length > 0 && rows.every((r) => sel.has(r.id));
  const err = (e: unknown) => { const m = (e as Error)?.message; if (m === "not-member") return showToast(c.team.notMember); if (m === "forbidden") return showToast(c.team.forbiddenT); crmError(e, c.errSave, c.errReadonly); };
  async function bulk(patch: Parameters<typeof bulkClients>[1]) {
    const ids = [...sel];
    try { await bulkClients(ids, patch); setSel(new Set()); load(); if (patch.status) showUndo(fill(c.undo.archived, { n: ids.length }), async () => { await bulkClients(ids, { status: patch.status === "archived" ? "active" : "archived" }); load(); }, c.undo.undo); } catch (e) { err(e); }
  }
  const activeFilters = fltActive(flt);
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
        {/* стандарт тулбара (12.10.2026): справа → вид · плотность · фильтры · главное действие */}
        <Segmented value={mode} onChange={(m) => setPref(MODE_LS, m)} options={[{ value: "list", label: c.tbl.listMode, icon: <IconList size={15} /> }, { value: "board", label: c.tbl.boardMode, icon: <IconLayoutKanban size={15} /> }]} />
        {mode === "list" && <Segmented value={dense ? "compact" : "expanded"} onChange={(d) => setPref(DENS_LS, d)} options={[{ value: "compact", label: c.tbl.compact, icon: <IconLayoutRows size={15} /> }, { value: "expanded", label: c.tbl.expanded, icon: <IconLayoutList size={15} /> }]} />}
        <button type="button" onClick={() => setFiltersOpen((v) => !v)} className={`${btnS} ${activeFilters ? "border-sel-line bg-blue-tint text-sel-ink" : ""}`}><IconAdjustmentsHorizontal size={15} /> {c.tbl.allFilters}{activeFilters ? ` · ${activeFilters}` : ""}</button>

      </div>
      {/* виды — на телефоне одной строкой с прокруткой и затуханием справа (18.10.2026, решение пользователя: «в одну строку со скроллом») */}
      <div className="mb-2 flex flex-wrap items-center gap-1 border-b border-line max-md:flex-nowrap max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[mask-image:linear-gradient(to_right,#000_calc(100%-36px),transparent)] max-md:[&>*]:flex-none">
        {(["all", "mine", "withTask", "overdue", "noDeal"] as View[]).map((v) => { const n = viewCount(v); return (
          <button key={v} type="button" onClick={() => setView(v)} className={`-mb-px flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2 text-[13px] font-medium ${view === v ? "border-blue-2 text-ink" : "border-transparent text-text hover:text-ink"}`}>{c.tbl.views[v]}<span className={`rounded-full px-[7px] py-[1px] text-[11px] ${v === "overdue" && n ? "bg-red-tint text-red" : "bg-bg-2 text-muted"}`}>{n}</span></button>); })}
        {saved.map((v) => <span key={v.id} className={`group/sv -mb-px flex items-center gap-1 border-b-2 px-3 py-2 text-[13px] font-medium ${curSaved === v.id ? "border-blue-2 text-ink" : "border-transparent text-text hover:text-ink"}`}><button type="button" onClick={() => applySaved(v)} className="cursor-pointer">{v.name}</button><button type="button" onClick={() => deleteSaved(v.id)} title={c.tbl.deleteView} className="cursor-pointer text-muted opacity-0 hover:text-red group-hover/sv:opacity-100"><IconX size={12} /></button></span>)}
        {activeFilters > 0 && !curSaved && <button type="button" onClick={saveView} className="-mb-px flex cursor-pointer items-center gap-1 border-b-2 border-transparent px-3 py-2 text-[13px] font-medium text-blue-2 hover:underline"><IconPlus size={13} /> {c.tbl.saveView}</button>}
        {/* архив — отдельная вкладка справа: архивные клиенты скрыты из «Активных», но остаются для истории и поиска дублей */}
        <button type="button" onClick={() => setStatus(status === "active" ? "archived" : "active")} className={`-mb-px ml-auto flex cursor-pointer items-center gap-2 border-b-2 px-3 py-2 text-[13px] font-medium ${status === "archived" ? "border-blue-2 text-ink" : "border-transparent text-muted hover:text-ink"}`}><IconArchive size={14} /> {c.archived}{status === "archived" && list ? <span className="rounded-full bg-bg-2 px-[7px] py-[1px] text-[11px] text-muted">{base.length}</span> : null}</button>
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-[6px] text-[12.5px] max-md:flex-nowrap max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[mask-image:linear-gradient(to_right,#000_calc(100%-36px),transparent)] max-md:[&>*]:flex-none">
        <span className="mr-1 text-muted">{c.tbl.stageRow}</span>
        {crm.cstages.map((st) => { const n = stageCount(st.key); const on = stage.includes(st.key); return <button key={st.id} type="button" onClick={() => setF({ cstage: on ? stage.filter((k) => k !== st.key) : [...stage, st.key] })} aria-pressed={on} className={`inline-flex h-7 cursor-pointer items-center gap-[6px] rounded-full border px-3 ${on ? "border-ink bg-ink text-white" : "border-line bg-surface text-text hover:bg-bg-3"}`}><span className="h-2 w-2 rounded-full" style={{ background: st.color ?? "#8a93a2" }} />{stageName(st, t, lang)}<span className={on ? "text-white/70" : "text-muted"}>{n}</span></button>; })}
        {stage.length > 0 && <button type="button" onClick={() => setF({ cstage: [] })} className="inline-flex h-7 cursor-pointer items-center gap-1 px-2 text-[12px] font-medium text-muted hover:text-red"><IconX size={12} /> {c.tbl.clear}</button>}
      </div>
      <FilterBar flt={flt} setF={setF} reset={() => setFlt(EMPTY_FLT)} allTags={allTags} />
      {filtersOpen && <FilterDrawer flt={flt} setF={setF} reset={() => setFlt(EMPTY_FLT)} allTags={allTags} count={rows.length} onClose={() => setFiltersOpen(false)} />}
      {sel.size > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-2 rounded-[6px] bg-ink px-3 py-[6px] text-[12.5px] text-white">
          <span className="font-semibold">{fill(c.tbl.selected, { n: sel.size })}</span>
          {crm.me.members.length > 1 && <Select value="" onChange={(v) => bulk({ ownerId: v })} placeholder={c.tbl.assign} options={crm.me.members.map((m) => ({ value: m.id, label: m.name, color: m.color }))} className="w-[170px]" size="sm" />}
          {crm.me.branches.length > 0 && <Select value="" onChange={(v) => bulk({ branchId: v || null })} placeholder={c.client.transferBranch} options={[{ value: "", label: c.client.noBranch }, ...crm.me.branches.map((b) => ({ value: b.id, label: b.name }))]} className="w-[170px]" size="sm" />}
          <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && tagInput.trim()) { bulk({ addTag: tagInput.trim() }); setTagInput(""); } }} placeholder={c.tbl.addTagPh} className="h-7 w-[170px] rounded-[4px] border border-white/20 bg-white/10 px-2 text-[12.5px] text-white outline-none placeholder:text-white/60" />
          <button type="button" onClick={() => bulk({ status: status === "active" ? "archived" : "active" })} className="h-7 cursor-pointer rounded-[4px] bg-white/15 px-3 font-semibold hover:bg-white/25">{status === "active" ? c.tbl.archive : c.tbl.restore}</button>
          <button type="button" onClick={() => setSel(new Set())} className="ml-auto cursor-pointer"><IconX size={15} /></button>
        </div>
      )}
      {mode === "board" && list !== null && <ClientBoard rows={rows} deals={deals} onMove={async (id, k, pos) => { patchRow(id, { stage: k, boardPos: pos }); try { await patchClient(id, { stage: k, boardPos: pos }); } catch (e) { err(e); load(); } }} />}
      <div className={`overflow-x-auto rounded-[6px] border border-line bg-surface ${mode === "board" ? "hidden" : ""}`}>
        {list === null ? <div className="py-12 text-center text-[13px] text-muted">…</div> : rows.length === 0 ? <div className="py-12 text-center text-[13.5px] text-muted">{q || activeFilters || view !== "all" ? c.notFound : status === "archived" ? c.noArchived : c.noClients}</div> : (
          <table data-crm-table="1" className="w-full min-w-[1100px] text-[13px]">
            <thead><tr>
              <th className="w-[56px] px-3 py-2"><input type="checkbox" checked={allSel} onChange={(e) => setSel(e.target.checked ? new Set(rows.map((r) => r.id)) : new Set())} /></th>
              {th(c.tbl.cols2.client, "name")}{th(c.tbl.cols2.region, "region")}{th(c.tbl.cols2.deal)}{th(c.tbl.cols2.status, "stage")}{th(c.tbl.cols2.source, "source")}{th(c.tbl.cols2.team, "owner")}{th(c.tbl.next, "next")}{th(c.tbl.activity, "activity")}{th(c.tbl.created, "created")}<th className="w-[70px]" />
            </tr></thead>
            <tbody>
              {rows.map((x) => { const d = deals[x.id]; const m = crm.me.members.find((y) => y.id === x.ownerId); const main = x.contacts.find((y) => y.isMain) ?? x.contacts[0]; const reg = regionOf(x); const over = isOver(x); const st = crm.stages.find((s) => s.id === d?.stageId); return (
                <tr key={x.id} onClick={() => router.push(`${crm.base}/c/${x.id}`)} className={`group cursor-pointer hover:bg-[#f7f8fa] ${sel.has(x.id) ? "bg-blue-tint/50" : ""}`} style={over ? { boxShadow: "inset 3px 0 0 #e5484d" } : undefined}>
                  <td className={`px-3 ${pad}`} onClick={(e) => e.stopPropagation()}><span className="flex items-center gap-2"><IconChevronRight size={14} className="text-muted" /><input type="checkbox" checked={sel.has(x.id)} onChange={(e) => setSel((s) => { const n = new Set(s); if (e.target.checked) n.add(x.id); else n.delete(x.id); return n; })} /></span></td>
                  <td className={`px-3 ${pad}`}><span className="flex items-center gap-[6px]"><button type="button" disabled={ro} onClick={async (e) => { e.stopPropagation(); const order: (Client["priority"])[] = [null, "hot", "warm", "cold"]; const next = order[(order.indexOf(x.priority) + 1) % order.length]; patchRow(x.id, { priority: next }); try { await patchClient(x.id, { priority: next }); } catch (er) { err(er); load(); } }} title={x.priority ? c.prio[x.priority] : c.prio.none} className="h-[10px] w-[10px] flex-none cursor-pointer rounded-full border border-line hover:scale-125" style={{ background: x.priority ? PRIO_COLOR[x.priority] : "transparent", borderColor: x.priority ? PRIO_COLOR[x.priority] : undefined }} /><Link href={`${crm.base}/c/${x.id}`} onClick={(e) => e.stopPropagation()} className="truncate font-semibold text-ink hover:text-blue-2">{x.name}</Link>{x.roles.slice(0, 2).map((r) => <span key={r} className="rounded-[3px] bg-bg-2 px-[5px] text-[10.5px] font-medium text-muted">{c.roles[r]}</span>)}</span>{!dense && <span className={`block truncate text-[12px] ${over ? "text-red" : "text-muted"}`}>{main?.value ?? "—"}{over && x.nextTask ? ` · ${fill(c.tbl.overdueBy, { d: hoursAgo(x.nextTask.dueAt) })}` : ""}</span>}{dense && over && <span className="ml-2 text-[11px] text-red">!</span>}</td>
                  <td className={`max-w-[240px] px-3 ${pad}`}>{reg ? <span className="inline-flex max-w-full items-center gap-[6px] text-text" title={reg.full}><span className="truncate">{reg.name}</span>{reg.more > 0 && <span className="flex-none rounded-full bg-blue-tint px-[6px] text-[11px] font-semibold text-sel-ink">+{reg.more}</span>}</span> : <span className="text-muted">—</span>}</td>
                  <td className={`max-w-[280px] px-3 ${pad}`}>{d ? (() => { const col = d.closed === "won" ? "#0f9d6b" : d.closed === "lost" ? "#e5484d" : st?.color ?? "#8a93a2"; const label = d.closed ? (d.closed === "won" ? c.tbl.won : c.tbl.lost) : stageName(st, t, lang); return <>
                    <span className="flex items-center gap-2"><span className="truncate text-text">{d.title || (d.amount != null ? fmt(d.amount, d.cur as Currency) : "—")}</span>{dense && <span className="flex-none rounded-[5px] px-[6px] text-[11px] font-medium" style={{ background: col + "1f", color: col }}>{label}</span>}</span>
                    {!dense && <span className="mt-[3px] flex items-center gap-2 text-[12px] text-muted"><span className="flex-none rounded-[5px] px-[6px] py-[1px] text-[11px] font-medium" style={{ background: col + "1f", color: col }}>{label}</span><span className="truncate">{t.dealF[d.deal as keyof typeof t.dealF]}{d.amount != null ? ` · ${fmt(d.amount, d.cur as Currency)}` : ""}</span></span>}
                  </>; })() : <span className="text-muted">—</span>}</td>
                  <td className={`px-3 ${pad}`} onClick={(e) => e.stopPropagation()}><StageMenu value={x.stage} clientId={x.id} ownerId={x.ownerId} suffix={x.stage === "visit" ? (x.nextTask?.kind === "meeting" ? fmtDT(x.nextTask.dueAt, lang) : c.tbl.visitNoDate) : undefined} onVisit={(d) => patchRow(x.id, { stage: "visit", nextTask: { id: "tmp", title: c.tbl.visitTask, dueAt: d, kind: "meeting" } })} onSaved={() => load()} onChange={async (k) => { patchRow(x.id, { stage: k }); try { await patchClient(x.id, { stage: k }); } catch (er) { err(er); load(); } }} disabled={ro} />{!dense && x.nextTask && <span className="mt-[3px] block truncate text-[12px] text-muted">{x.nextTask.title}</span>}</td>
                  <td className={`px-3 ${pad}`}><span className="block truncate text-text">{sourceName(crm.sources.find((s) => s.id === x.sourceId), t)}</span>{!dense && <span className="block text-[12px] text-muted">{x.lang}{x.tags.length ? ` · ${x.tags.slice(0, 2).join(", ")}` : ""}</span>}</td>
                  <td className={`px-3 ${pad}`} onClick={(e) => e.stopPropagation()}>{crm.me.members.length > 1 && !ro ? <Select value={x.ownerId ?? ""} onChange={async (v) => { patchRow(x.id, { ownerId: v || null }); try { await patchClient(x.id, { ownerId: v || null }); } catch (e) { err(e); load(); } }} options={[{ value: "", label: c.tbl.unassigned }, ...crm.me.members.map((mm) => ({ value: mm.id, label: mm.name, color: mm.color }))]} size="sm" menuWidth="auto" stopPropagation className="w-[170px]" icon={m ? <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: m.color }}>{initials(m.name)}</span> : undefined} /> : m ? <span className="inline-flex items-center gap-2"><span className="flex h-6 w-6 flex-none items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: m.color }}>{initials(m.name)}</span><span className="truncate text-text">{m.name}</span></span> : <span className="text-muted">{c.tbl.unassigned}</span>}</td>
                  <td className={`px-3 ${pad}`}>{x.nextTask ? <span className={`block truncate text-[12.5px] ${over ? "font-semibold text-red" : "text-text"}`} title={x.nextTask.title}>{fmtDT(x.nextTask.dueAt, lang)}{!dense && <span className="block truncate text-[12px] font-normal text-muted">{x.nextTask.title}</span>}</span> : <span className="text-muted">—</span>}</td>
                  <td className={`px-3 ${pad} text-muted`} title={fmtDT(x.lastActivityAt, lang)}>{hoursAgo(x.lastActivityAt)}</td>
                  <td className={`px-3 ${pad} text-muted`}>{fmtDate(x.createdAt, lang)}</td>
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
    case "reqStatus": return (c.rq.st as Record<string, string>)[v] ?? v;
    case "propType": case "purpose": case "payment": return (c.rq.o as Record<string, Record<string, string>>)[k]?.[v] ?? v;
    case "visitFrom": return `${c.tbl.flt.visit}: ${fmtD(v)} –`;
    case "visitTo": return `– ${fmtD(v)}`;
    case "budgetMin": return `≥ ${v}`;
    case "budgetMax": return `≤ ${v}`;
    case "createdFrom": return `${c.tbl.flt.created}: ${fmtD(v)} –`;
    case "createdTo": return `– ${fmtD(v)}`;
    default: return v;
  }
}

/** Поле фильтра для «+ Фильтр»: подпись и способ ввода значения. */
type FieldDef = { key: string; label: string; kind: "select" | "budget" | "dates"; opts?: { value: string; label: string; color?: string }[]; /** для kind dates — ключи «с» и «по» в Flt */ range?: { from: "createdFrom" | "visitFrom"; to: "createdTo" | "visitTo" } };
/** Цвет роли — как у типа заявки (покупатель = buy, продавец = sell, арендодатель = rent_out, арендатор = rent_in). */
const ROLE_COLOR: Record<string, string> = { buyer: REQ_COLOR.buy, seller: REQ_COLOR.sell, landlord: REQ_COLOR.rent_out, tenant: REQ_COLOR.rent_in };
const GREY = "#8a93a2";
function useFieldDefs(allTags: string[]): FieldDef[] {
  const { t, lang } = useI18n(); const crm = useCrm(); const c = t.crm;
  const opt = (list: readonly string[], names: Record<string, string>, colors?: Record<string, string>) => list.map((v) => ({ value: v, label: names[v] ?? v, color: colors ? colors[v] ?? GREY : undefined }));
  const defs: FieldDef[] = [
    { key: "role", label: c.client.roles, kind: "select", opts: opt(ROLES_F, c.roles, ROLE_COLOR) },
    { key: "cstage", label: c.client.stage, kind: "select", opts: crm.cstages.map((x) => ({ value: x.key, label: stageName(x, t, lang), color: x.color ?? GREY })) },
    { key: "dealStage", label: c.tbl.dealStage, kind: "select", opts: [...crm.stages.filter((x) => x.kind === "open").map((x) => ({ value: x.id, label: stageName(x, t, lang), color: x.color ?? GREY })), { value: "won", label: c.tbl.won, color: "#22c15e" }, { value: "lost", label: c.tbl.lost, color: "#e5484d" }, { value: "none", label: c.tbl.noStage, color: GREY }] },
    { key: "priority", label: c.client.priority, kind: "select", opts: opt(PRIOS_F, c.prio, PRIO_COLOR as Record<string, string>) },
    { key: "kind", label: c.rq.kind, kind: "select", opts: opt(KINDS_F, c.rq.kinds, REQ_COLOR as Record<string, string>) },
    { key: "reqStatus", label: c.tbl.flt.reqStatus, kind: "select", opts: (Object.keys(c.rq.st) as string[]).map((v) => ({ value: v, label: (c.rq.st as Record<string, string>)[v], color: (REQ_ST_COLOR as Record<string, string>)[v] ?? GREY })) },
    { key: "propType", label: c.rq.f.propType, kind: "select", opts: OPTS.propType.map((v) => ({ value: v, label: (c.rq.o as Record<string, Record<string, string>>).propType?.[v] ?? v })) },
    { key: "purpose", label: c.rq.f.purpose, kind: "select", opts: OPTS.purpose.map((v) => ({ value: v, label: (c.rq.o as Record<string, Record<string, string>>).purpose?.[v] ?? v })) },
    { key: "rooms", label: c.rq.f.rooms, kind: "select", opts: ROOMS_ALL.map((v) => ({ value: v, label: v })) },
    { key: "payment", label: c.rq.f.payment, kind: "select", opts: OPTS.payment.map((v) => ({ value: v, label: (c.rq.o as Record<string, Record<string, string>>).payment?.[v] ?? v })) },
    { key: "il", label: c.want.il, kind: "select", opts: GEO.map((g) => ({ value: g.k, label: g.n })) },
    { key: "budget", label: c.client.budget, kind: "budget" },
    { key: "source", label: c.source, kind: "select", opts: crm.sources.map((x) => ({ value: x.id, label: sourceName(x, t) })) },
    ...(crm.me.members.length > 1 ? [{ key: "owner", label: c.owner, kind: "select" as const, opts: crm.me.members.map((m) => ({ value: m.id, label: m.name, color: m.color })) }] : []),
    ...(crm.me.branches.length > 0 ? [{ key: "branch", label: c.client.branch, kind: "select" as const, opts: crm.me.branches.map((b) => ({ value: b.id, label: b.name })) }] : []),
    { key: "lang", label: c.client.lang, kind: "select", opts: ["RU", "EN", "TR"].map((l) => ({ value: l, label: l })) },
    { key: "channel", label: c.client.channel, kind: "select", opts: opt(CHANNELS_F, c.channel) },
    ...(allTags.length ? [{ key: "tag", label: c.tbl.tag, kind: "select" as const, opts: allTags.map((g) => ({ value: g, label: g })) }] : []),
    { key: "created", label: c.tbl.flt.created, kind: "dates", range: { from: "createdFrom", to: "createdTo" } },
    { key: "visit", label: c.tbl.flt.visit, kind: "dates", range: { from: "visitFrom", to: "visitTo" } },
  ];
  return defs;
}
/** Активные условия как пилюли «Поле: значение» (составные budget/created — одной пилюлей). */
function pillsOf(flt: Flt, defs: FieldDef[], t: ReturnType<typeof useI18n>["t"], crm: ReturnType<typeof useCrm>, lang: Lang): { key: string; label: string; value: string }[] {
  const out: { key: string; label: string; value: string }[] = [];
  for (const d of defs) {
    if (d.key === "cstage") continue; // статус клиента показан строкой чипов над таблицей — пилюлю не дублировать
    if (d.kind === "budget") { if (flt.budgetMin || flt.budgetMax) out.push({ key: d.key, label: d.label, value: `${flt.budgetMin ? `≥ ${Number(flt.budgetMin).toLocaleString("ru-RU")}` : ""}${flt.budgetMin && flt.budgetMax ? " " : ""}${flt.budgetMax ? `≤ ${Number(flt.budgetMax).toLocaleString("ru-RU")}` : ""}` }); }
    else if (d.kind === "dates" && d.range) { const a = flt[d.range.from], b = flt[d.range.to]; if (a || b) out.push({ key: d.key, label: d.label, value: `${fmtD(a) || "…"} – ${fmtD(b) || "…"}` }); }
    else { const v = flt[d.key as SelKey]; if (v.length) { const names = v.map((x) => fltLabel(d.key as keyof Flt, x, t, crm, lang)); out.push({ key: d.key, label: d.label, value: names.slice(0, 2).join(", ") + (names.length > 2 ? ` +${names.length - 2}` : "") }); } }
  }
  return out;
}
const clearField = (key: string): Partial<Flt> => (key === "budget" ? { budgetMin: "", budgetMax: "" } : key === "created" ? { createdFrom: "", createdTo: "" } : key === "visit" ? { visitFrom: "", visitTo: "" } : key === "il" ? { il: [], ilces: [], semts: [] } : ({ [key]: [] } as Partial<Flt>));
/** Строка значения мультивыбора: чекбокс, цветная точка, подпись — одна и та же в «+ Фильтр», в пилюле и в панели. */
function OptRow({ on, color, label, onClick }: { on: boolean; color?: string; label: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className={`flex h-8 w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 text-left text-[13px] max-md:h-11 max-md:text-[14px] ${on ? "bg-blue-tint text-sel-ink" : "text-ink hover:bg-bg-3"}`}>
      <span className={`flex h-[15px] w-[15px] flex-none items-center justify-center rounded-[4px] border ${on ? "border-blue-2 bg-blue-2 text-white" : "border-line bg-surface"}`}>{on && <IconCheck size={11} stroke={3} />}</span>
      {color && <span className="h-2 w-2 flex-none rounded-full" style={{ background: color }} />}
      <span className="truncate">{label}</span>
    </button>
  );
}
/** Список значений поля-мультивыбора с поиском (при >8 вариантах), «Сбросить» и «Готово»; применяется сразу при каждом клике. */
function MultiList({ def, flt, setF, onDone }: { def: FieldDef; flt: Flt; setF: (p: Partial<Flt>) => void; onDone: () => void }) {
  const { t } = useI18n(); const c = t.crm;
  const [q, setQ] = useState("");
  const cur = flt[def.key as SelKey];
  const opts = (def.opts ?? []).filter((o) => !q.trim() || o.label.toLowerCase().includes(q.trim().toLowerCase()));
  const toggle = (v: string) => setF({ [def.key]: cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v] } as Partial<Flt>);
  return (
    <>
      <div className="flex items-center justify-between px-2 pb-1 pt-1"><span className="text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{def.label}</span>{cur.length > 0 && <button type="button" onClick={() => setF({ [def.key]: [] } as Partial<Flt>)} className="cursor-pointer text-[11px] font-medium text-muted hover:text-red">{c.tbl.clear}</button>}</div>
      {(def.opts?.length ?? 0) > 8 && <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.tbl.findField} autoFocus={kbAutoFocus()} className="mb-1 h-8 w-full rounded-[5px] border border-line px-2 text-[13px] outline-none focus:border-blue" />}
      <div className="max-h-[280px] overflow-y-auto max-md:max-h-[60dvh]">{opts.map((o) => <OptRow key={o.value} on={cur.includes(o.value)} color={o.color} label={o.label} onClick={() => toggle(o.value)} />)}</div>
      <div className="mt-1 border-t border-line pt-1"><button type="button" onClick={onDone} className="flex h-8 w-full cursor-pointer items-center justify-center rounded-[5px] text-[13px] font-semibold text-blue-2 hover:bg-bg-3">{c.tbl.done}</button></div>
    </>
  );
}
/** Поле-мультивыбор в панели «Все фильтры»: триггер как у Select (подпись поля, выбранные значения с точками), список — fixed-меню. */
function MultiField({ def, flt, setF }: { def: FieldDef; flt: Flt; setF: (p: Partial<Flt>) => void }) {
  const [open, setOpen] = useState(false);
  const [rect, setRect] = useState<{ left: number; top: number; bottom: number } | null>(null);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h, true); return () => document.removeEventListener("mousedown", h, true); }, [open]);
  useEscape(open, () => setOpen(false));
  useBackClose(open, () => setOpen(false)); // на телефоне список — шторка снизу, «назад» закрывает (18.10.2026)
  const cur = flt[def.key as SelKey];
  const sel = cur.map((v) => def.opts?.find((o) => o.value === v)).filter((o): o is NonNullable<typeof o> => !!o);
  return (
    <div ref={ref} className="relative">
      <button type="button" aria-haspopup="listbox" aria-expanded={open} onClick={(e) => { const b = (e.currentTarget as HTMLElement).getBoundingClientRect(); setRect({ left: b.left, top: b.top, bottom: b.bottom }); setOpen((v) => !v); }} className={`flex h-9 w-full cursor-pointer items-center gap-2 rounded-[6px] border bg-surface px-3 text-left text-[13px] ${open ? "border-blue" : "border-line hover:border-blue/60"}`}>
        {sel.length === 0 ? <span className="flex-1 truncate text-muted">{def.label}</span> : (
          <span className="flex min-w-0 flex-1 items-center gap-2"><span className="flex-none text-[11px] uppercase tracking-[.04em] text-muted">{def.label}</span><span className="flex min-w-0 flex-1 items-center gap-[6px] truncate">{sel.slice(0, 3).map((o) => <span key={o.value} className="inline-flex items-center gap-1 whitespace-nowrap">{o.color && <span className="h-2 w-2 flex-none rounded-full" style={{ background: o.color }} />}{o.label}</span>)}{sel.length > 3 && <span className="text-muted">+{sel.length - 3}</span>}</span></span>
        )}
        {sel.length > 0 && <span className="flex-none rounded-full bg-blue-tint px-[6px] text-[11px] font-semibold text-sel-ink">{sel.length}</span>}
        <IconChevronDown size={14} className="flex-none text-muted" />
      </button>
      {open && <div className="fixed inset-0 z-[311] bg-[rgba(10,16,28,.35)] md:hidden" onClick={() => setOpen(false)} />}
      {open && <div data-sheet="fit" style={menuPos(rect, 300, 48 + Math.min(def.opts?.length ?? 0, 8) * 32 + 40)} className="w-[300px] rounded-[8px] border border-line bg-surface p-1 shadow-[0_12px_40px_rgba(20,36,63,.16)] max-md:p-3 max-md:pb-[max(12px,env(safe-area-inset-bottom))]"><MultiList def={def} flt={flt} setF={setF} onDone={() => setOpen(false)} /></div>}
    </div>
  );
}

/** Строка фильтров как у Attio/Linear: пилюли условий + «+ Фильтр» → список полей → значение. */
function FilterBar({ flt, setF, reset, allTags }: { flt: Flt; setF: (p: Partial<Flt>) => void; reset: () => void; allTags: string[] }) {
  const { t, lang } = useI18n(); const crm = useCrm(); const c = t.crm;
  const defs = useFieldDefs(allTags);
  const pills = pillsOf(flt, defs, t, crm, lang);
  const [open, setOpen] = useState<{ mode: "pick" | "value"; key?: string; anchor?: string; el?: HTMLElement | null } | null>(null);
  const [q, setQ] = useState("");
  const [range, setRange] = useState({ min: flt.budgetMin, max: flt.budgetMax });
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { const el = e.target as Element; if (ref.current && !ref.current.contains(el) && !el.closest?.("[data-fpop], [data-overlay]")) setOpen(null); }; document.addEventListener("mousedown", h, true); return () => document.removeEventListener("mousedown", h, true); }, [open]);
  useEscape(!!open, () => setOpen(null));
  const def = open?.key ? defs.find((d) => d.key === open.key) : undefined;
  const pickField = (d: FieldDef) => { setQ(""); setRange({ min: flt.budgetMin, max: flt.budgetMax }); setOpen({ mode: "value", key: d.key, anchor: open?.anchor, el: open?.el }); };
  const fields = defs.filter((d) => !q.trim() || d.label.toLowerCase().includes(q.trim().toLowerCase()));
  const pop = "w-[260px] rounded-[8px] border border-line bg-surface p-1 shadow-[0_12px_40px_rgba(20,36,63,.16)] max-md:p-3 max-md:pb-[max(12px,env(safe-area-inset-bottom))]";
  useBackClose(!!open, () => setOpen(null)); // на телефоне поповеры — шторки снизу (единый стандарт 18.10.2026), «назад» закрывает
  const item = (on: boolean) => `flex h-8 w-full cursor-pointer items-center rounded-[5px] px-2 text-left text-[13px] ${on ? "bg-blue-tint font-semibold text-sel-ink" : "text-ink hover:bg-bg-3"}`;
  return (
    <div ref={ref} className="mb-3 flex flex-wrap items-center gap-[6px] max-md:flex-nowrap max-md:overflow-x-auto max-md:[scrollbar-width:none] max-md:[mask-image:linear-gradient(to_right,#000_calc(100%-36px),transparent)] max-md:[&>*]:flex-none">
      {pills.map((p) => (
        <span key={p.key} className="relative inline-flex h-7 items-center rounded-full border border-sel-line bg-blue-tint pl-3 pr-1 text-[12.5px] text-sel-ink">
          <button type="button" onClick={(e) => { setOpen(open?.key === p.key ? null : { mode: "value", key: p.key, anchor: p.key, el: e.currentTarget.parentElement }); setRange({ min: flt.budgetMin, max: flt.budgetMax }); }} className="cursor-pointer"><span className="text-sel-ink/70">{p.label}:</span> <span className="font-semibold">{p.value}</span></button>
          <button type="button" onClick={() => setF(clearField(p.key))} className="ml-1 flex h-5 w-5 cursor-pointer items-center justify-center rounded-full hover:bg-white/60"><IconX size={12} /></button>
          {open?.mode === "value" && open.anchor === p.key && def && <ValuePop def={def} flt={flt} range={range} setRange={setRange} apply={(p2) => { setF(p2); setOpen(null); }} setF={setF} close={() => setOpen(null)} pop={pop} anchor={open.el} />}
        </span>
      ))}
      <span className="relative">
        <button type="button" onClick={(e) => { setOpen(open ? null : { mode: "pick", anchor: "+", el: e.currentTarget }); setQ(""); }} className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-dashed border-line px-3 text-[12.5px] font-medium text-text hover:border-blue hover:text-ink"><IconPlus size={13} /> {c.tbl.addFilter}</button>
        {open?.mode === "pick" && (
          <PopBox className={pop} close={() => setOpen(null)} anchor={open.el}>
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.tbl.findField} autoFocus={kbAutoFocus()} className="mb-1 h-8 w-full rounded-[5px] border border-line px-2 text-[13px] outline-none focus:border-blue" />
            <div className="max-h-[280px] overflow-y-auto">{fields.map((d) => <button key={d.key} type="button" onClick={() => pickField(d)} className={item(false)}>{d.label}</button>)}</div>
          </PopBox>
        )}
        {open?.mode === "value" && open.anchor === "+" && def && <ValuePop def={def} flt={flt} range={range} setRange={setRange} apply={(p2) => { setF(p2); setOpen(null); }} setF={setF} close={() => setOpen(null)} pop={pop} anchor={open.el} />}
      </span>
      {pills.length > 0 && <button type="button" onClick={reset} className="ml-1 cursor-pointer text-[12.5px] font-semibold text-muted hover:text-red">{c.tbl.clear}</button>}
    </div>
  );
}
function ValuePop({ def, flt, range, setRange, apply, setF, close, pop, anchor }: { def: FieldDef; flt: Flt; range: { min: string; max: string }; setRange: (r: { min: string; max: string }) => void; apply: (p: Partial<Flt>) => void; setF: (p: Partial<Flt>) => void; close: () => void; anchor?: HTMLElement | null; pop: string }) {
  const { t } = useI18n(); const c = t.crm;
  if (def.kind === "select") return <PopBox className={pop} close={close} anchor={anchor}><MultiList def={def} flt={flt} setF={setF} onDone={close} /></PopBox>;
  if (def.kind === "budget") return (
    <PopBox className={`${pop} p-3`} close={close} anchor={anchor}>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{def.label}</div>
      <div className="grid grid-cols-2 gap-2"><input inputMode="numeric" value={range.min} onChange={(e) => setRange({ ...range, min: e.target.value.replace(/\D/g, "") })} placeholder={c.tbl.flt.budgetFrom} autoFocus={kbAutoFocus()} className={inp} /><input inputMode="numeric" value={range.max} onChange={(e) => setRange({ ...range, max: e.target.value.replace(/\D/g, "") })} placeholder={c.tbl.flt.budgetTo} className={inp} onKeyDown={(e) => { if (e.key === "Enter") apply({ budgetMin: range.min, budgetMax: range.max }); }} /></div>
      <button type="button" onClick={() => apply({ budgetMin: range.min, budgetMax: range.max })} className={`${btnP} mt-2 w-full justify-center`}>{c.tbl.apply}</button>
    </PopBox>
  );
  return (
    <PopBox className={`${pop} w-[300px] p-3`} close={close} anchor={anchor} w={300}>
      <div className="mb-2 text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{def.label}</div>
      <DateRange from={def.range ? flt[def.range.from] : ""} to={def.range ? flt[def.range.to] : ""} onChange={(a, b) => apply(def.range ? ({ [def.range.from]: a, [def.range.to]: b } as Partial<Flt>) : {})} />
    </PopBox>
  );
}
/** Поповер фильтра: на компьютере — под пилюлей, на телефоне — шторка снизу с затемнением (`data-sheet="fit"`), как все
 *  выпадающие списки CRM (единый стандарт 18.10.2026, «чтобы не было только в одном месте так»). */
function PopBox({ className, close, children, anchor, w = 260 }: { className: string; close: () => void; children: React.ReactNode; anchor?: HTMLElement | null; w?: number }) {
  // Портал в body: строка пилюль на телефоне прокручивается с mask-image, а маска режет и fixed-потомков — шторка внутри строки
  // была невидима. Позиция на компьютере — под якорем (menuPos), на телефоне `[data-sheet]` ставит низ экрана.
  const rect = anchor?.getBoundingClientRect() ?? null;
  return createPortal(
    <>
      <div className="fixed inset-0 z-[310] bg-[rgba(10,16,28,.35)] md:hidden" onClick={close} />
      <div data-fpop="1" data-sheet="fit" style={menuPos(rect, w, 340)} className={className}>{children}</div>
    </>,
    document.body,
  );
}

/** «Все фильтры» — панель справа блоками (клиент · команда и источник · заявка · даты); таблица остаётся на месте. */
/** Панель «Все фильтры» — по канону расширенного поиска каталога (18.10.2026, «поиск в CRM по всем канонам, эталон — база
 *  риэлторов»): значения полей — чипы (тап переключает, выбранный — голубой с синей обводкой и цветной точкой), группы с
 *  заголовками, внизу «Сбросить» и «Показать N»; применяется сразу. На телефоне — во весь экран, «назад» закрывает. */
function FilterDrawer({ flt, setF, reset, allTags, count, onClose }: { flt: Flt; setF: (p: Partial<Flt>) => void; reset: () => void; allTags: string[]; count: number; onClose: () => void }) {
  const { t } = useI18n(); const c = t.crm; const f = c.tbl.flt;
  useEscape(true, onClose);
  useBackClose(true, onClose);
  const defs = useFieldDefs(allTags);
  const active = fltActive(flt);
  const title = (label: string, n = 0, clear?: () => void) => (
    <div className="mb-[8px] flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.05em] text-muted">
      <span>{label}</span>{n > 0 && <span className="rounded-full bg-blue-tint px-[6px] text-[10.5px] font-bold normal-case tracking-normal text-sel-ink">{n}</span>}
      {n > 0 && clear && <button type="button" onClick={clear} className="ml-auto cursor-pointer text-[11px] font-semibold normal-case tracking-normal text-muted hover:text-red">{t.cat.resetBtn}</button>}
    </div>
  );
  const Field = (k: SelKey) => { const d = defs.find((x) => x.key === k); return d && d.opts?.length ? <MultiField key={k} def={d} flt={flt} setF={setF} /> : null; };
  // расположение — то же окно GeoPicker, что в расширенном поиске каталога (эталон пользователя 18.10.2026)
  const [geo, setGeo] = useState(false);
  const geoVal = { il: flt.il[0] ?? "", ilces: flt.ilces, semts: flt.semts };
  const geoOn = !!geoVal.il;
  const geoLabel = defs.find((x) => x.key === "il")?.label ?? ""; // поля — выпадающие списки; на телефоне список открывается шторкой снизу (решение пользователя 18.10.2026: «не чипы, как в поиске — шторка»)
  const group = (label: string, children: React.ReactNode) => <section className="flex flex-col gap-2"><div className="mb-1 text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{label}</div>{children}</section>;
  return (
    <>
      <div className="fixed inset-0 z-[300] bg-ink/20" onClick={onClose} />
      <aside data-crm-form="1" className="fixed right-0 top-0 z-[310] flex h-dvh w-[460px] max-w-full flex-col border-l border-line bg-surface shadow-[-10px_0_40px_rgba(20,36,63,.15)]">
        <div className="flex items-center justify-between border-b border-line px-5 py-3"><div className="text-[15px] font-semibold text-ink">{c.tbl.filters}{active ? <span className="ml-2 rounded-full bg-blue-tint px-2 py-[1px] text-[11px] text-sel-ink">{active}</span> : null}</div><button type="button" onClick={onClose} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[8px] text-muted hover:bg-bg-3 hover:text-ink"><IconX size={18} /></button></div>
        <div className="flex min-h-0 flex-1 flex-col gap-6 overflow-y-auto px-5 py-4">
          {group(f.client, <>{Field("role")}{Field("cstage")}{Field("dealStage")}{Field("priority")}<div className="grid grid-cols-2 gap-2">{Field("lang")}{Field("channel")}</div></>)}
          {group(f.team, <>{Field("owner")}{Field("branch")}{Field("source")}{Field("tag")}</>)}
          {group(f.request, <>
            <div className="grid grid-cols-2 gap-2">{Field("kind")}{Field("reqStatus")}</div>
            <div className="grid grid-cols-2 gap-2">{Field("propType")}{Field("purpose")}</div>
            <div className="grid grid-cols-2 gap-2">{Field("rooms")}{Field("payment")}</div>
            <button type="button" onClick={() => setGeo(true)} className={`relative h-9 w-full cursor-pointer truncate rounded-[6px] border pl-8 pr-7 text-left text-[13px] ${geoOn ? "border-sel-line bg-blue-tint font-semibold text-sel-ink" : "border-line bg-surface text-muted hover:border-blue"}`}>
              <IconMapPin size={14} className={`absolute left-[9px] top-1/2 -translate-y-1/2 ${geoOn ? "text-sel-ink" : "text-muted"}`} />{geoOn ? wantGeoLabel(geoVal, geoLabel) : geoLabel}<IconChevronDown size={13} className="absolute right-[9px] top-1/2 -translate-y-1/2 text-muted" />
            </button>
            {geo && <GeoPicker mode="filter" showAll z={500} applyLabel={t.crm.want.applyGeo} value={geoVal} onApply={(v) => { setF({ il: v.il ? [v.il] : [], ilces: v.il ? v.ilces : [], semts: v.il ? v.semts : [] }); setGeo(false); }} onClose={() => setGeo(false)} />}
            <div>
              {title(c.client.budget, flt.budgetMin || flt.budgetMax ? 1 : 0, () => setF({ budgetMin: "", budgetMax: "" }))}
              <div className="flex items-center gap-2"><input inputMode="numeric" value={flt.budgetMin} onChange={(e) => setF({ budgetMin: e.target.value.replace(/\D/g, "") })} placeholder={f.budgetFrom} className={inp} /><span className="text-muted">—</span><input inputMode="numeric" value={flt.budgetMax} onChange={(e) => setF({ budgetMax: e.target.value.replace(/\D/g, "") })} placeholder={f.budgetTo} className={inp} /></div>
            </div>
          </>)}
          {group(f.dates, <><DateRange from={flt.visitFrom} to={flt.visitTo} onChange={(a, b) => setF({ visitFrom: a, visitTo: b })} placeholder={f.visit} /><DateRange from={flt.createdFrom} to={flt.createdTo} onChange={(a, b) => setF({ createdFrom: a, createdTo: b })} placeholder={f.created} /></>)}
          <div className="text-[12px] text-muted">{f.hint}</div>
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line px-5 py-3 pb-[max(12px,env(safe-area-inset-bottom))]">
          <button type="button" onClick={reset} disabled={!active} className={`flex-none cursor-pointer rounded-[10px] px-[14px] py-[10px] text-[13px] font-bold ${active ? "bg-red-tint text-red" : "text-muted"} disabled:cursor-default`}>{t.cat.resetBtn}</button>
          <button type="button" onClick={onClose} className="flex-none cursor-pointer rounded-[10px] bg-blue-2 px-5 py-[10px] text-[13px] font-bold text-white hover:bg-blue-3">{t.geo.show} {count}</button>
        </div>
      </aside>
    </>
  );
}

/** Чип этапа клиента с меню «Сменить статус» (как в современных CRM — прямо из списка). */
export function StageMenu({ value, onChange, disabled, clientId, ownerId, suffix, onSaved, onVisit: onVisitProp }: { value: string; onChange: (key: string) => void; disabled?: boolean; clientId: string; ownerId: string | null; /** подпись после статуса — дата приезда у «Приедет» */ suffix?: string; /** задача-напоминание создана — обновить карточку/строку */ onSaved?: () => void; /** «Приедет» с датой: статус и задачу пишет setClientVisit, родителю — только локально показать статус */ onVisit?: (dueAt: string) => void }) {
  const { t, lang } = useI18n(); const crm = useCrm(); const c = t.crm;
  const [open, setOpen] = useState(false);
  useBackClose(open, () => setOpen(false));
  const [visitFor, setVisitFor] = useState<string | null>(null); // этап с датой («Приедет»): выбор даты приезда → задача
  const [due, setDue] = useState("");
  const onVisit = (d: string) => (onVisitProp ? onVisitProp(d) : onChange("visit"));
  const [rect, setRect] = useState<{ left: number; top: number; bottom: number } | null>(null); // меню — fixed, иначе его режет overflow таблицы
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => { if (!open) return; const h = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); }; document.addEventListener("mousedown", h, true); return () => document.removeEventListener("mousedown", h, true); }, [open]);
  const st = crm.cstages.find((x) => x.key === value);
  const col = st?.color ?? "#8a93a2";
  return (
    <span ref={ref} className="relative inline-block">
      <button type="button" disabled={disabled} onClick={(e) => { const b = (e.currentTarget as HTMLElement).getBoundingClientRect(); setRect({ left: b.left, top: b.top, bottom: b.bottom }); setVisitFor(null); setOpen((v) => !v); }} className="inline-flex h-7 cursor-pointer items-center gap-1 whitespace-nowrap rounded-[5px] px-2 text-[12px] font-medium hover:brightness-95" style={{ background: col + "1f", color: col }}>{stageName(st, t, lang)}{suffix && <span className="opacity-80">· {suffix}</span>}{!disabled && <IconChevronDown size={12} className="opacity-70" />}</button>
      {open && (<>
        <div className="fixed inset-0 z-[310] bg-[rgba(10,16,28,.35)] md:hidden" onClick={() => setOpen(false)} />
        <div data-sheet="fit" style={menuPos(rect, visitFor ? 372 : 232, visitFor ? 250 : 40 + crm.cstages.length * 32)} className={`rounded-[8px] border border-line bg-surface p-1 shadow-[0_12px_40px_rgba(20,36,63,.16)] max-md:p-3 max-md:pb-[max(12px,env(safe-area-inset-bottom))] ${visitFor ? "w-[360px]" : "w-[220px]"}`}>
          <div className="flex items-center gap-1 px-2 pb-1 pt-1 text-[10.5px] font-semibold uppercase tracking-[.05em] text-muted">{visitFor && <button type="button" onClick={() => setVisitFor(null)} className="cursor-pointer rounded-[4px] px-1 text-[12px] normal-case tracking-normal text-blue-2 hover:underline">←</button>}{visitFor ? c.tbl.visitDate : c.tbl.changeStatus}</div>
          {!visitFor && crm.cstages.map((x) => <button key={x.id} type="button" onClick={() => { if (x.key === "visit") { setVisitFor(x.key); const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(12, 0, 0, 0); setDue(d.toISOString()); return; } setOpen(false); if (x.key !== value) onChange(x.key); }} className={`flex h-8 w-full cursor-pointer items-center gap-2 rounded-[5px] px-2 text-left text-[13px] ${x.key === value ? "bg-blue-tint font-semibold text-sel-ink" : "text-ink hover:bg-bg-3"}`}><span className="h-2 w-2 flex-none rounded-full" style={{ background: x.color ?? "#8a93a2" }} />{stageName(x, t, lang)}{x.key === "visit" && <IconCalendar size={13} className="ml-auto text-muted" />}</button>)}
          {visitFor && (
            <div className="p-2">
              <DuePicker value={due} onChange={setDue} />
              <button type="button" onClick={async () => { setOpen(false); setVisitFor(null); onVisit(due || new Date().toISOString()); try { await setClientVisit(clientId, due || new Date().toISOString(), ownerId ?? crm.me.meId, c.tbl.visitTask); onSaved?.(); } catch (e) { crmError(e, c.errSave, c.errReadonly); onSaved?.(); } }} className={`${btnP} mt-2 w-full justify-center`}>{c.tbl.visitSave}</button>
            </div>
          )}
        </div></>
      )}
    </span>
  );
}

/** Канбан клиентов по воронке клиента: перетаскивание меняет статус. */
function ClientBoard({ rows, deals, onMove }: { rows: Client[]; deals: Record<string, DealSummary>; onMove: (id: string, key: string, pos: number) => void }) {
  const { t, lang } = useI18n(); const crm = useCrm(); const c = t.crm; const router = useRouter(); const now = useNow();
  const [dragId, setDragId] = useState<string | null>(null);
  const [drop, setDrop] = useState<{ col: string; idx: number } | null>(null); // куда упадёт карточка — пунктирное место (12.10.2026)
  const ph = <div className="h-[76px] rounded-[4px] border-2 border-dashed border-blue-2/60 bg-blue-tint/40" />;
  return (
    <div data-crm-kanban="1" className="mb-3 flex gap-0 overflow-x-auto rounded-[6px] border border-line bg-surface">
      {crm.cstages.map((st, i) => { const list = sortBoard(rows.filter((x) => (x.stage || "new") === st.key)); const here = drop?.col === st.key ? drop.idx : -1; return (
        <div key={st.id} onDragOver={(e) => { if (!dragId) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; const idx = dropIndex(e, e.currentTarget); if (drop?.col !== st.key || drop.idx !== idx) setDrop({ col: st.key, idx }); }} onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDrop((d) => (d?.col === st.key ? null : d)); }}
          onDrop={(e) => { e.preventDefault(); if (dragId) { const others = list.filter((x) => x.id !== dragId); const idx = Math.min(drop?.col === st.key ? drop.idx : others.length, others.length); const before = others.slice(0, idx).filter((x) => x.id !== dragId); const prev = before[before.length - 1]; const next = others[idx]; onMove(dragId, st.key, posBetween(prev?.boardPos ?? (prev ? 0 : null), next?.boardPos ?? (next ? 2 : null))); } setDragId(null); setDrop(null); }}
          className={`flex w-[250px] flex-none flex-col bg-[#f7f8fa] ${i > 0 ? "border-l border-line" : ""} ${here >= 0 ? "crm-drag-over" : ""}`}>
          <div className="flex items-center gap-2 border-b border-line px-3 py-2 text-[12px] font-semibold text-ink"><span className="h-2 w-2 rounded-full" style={{ background: st.color ?? "#8a93a2" }} />{stageName(st, t, lang)}<span className="font-normal text-muted">{list.length}</span></div>
          <div className="flex min-h-[200px] flex-col gap-2 p-2">
            {here === 0 && ph}
            {list.map((x, k) => { const d = deals[x.id]; const over2 = !!x.nextTask && new Date(x.nextTask.dueAt).getTime() < now; const m = crm.me.members.find((y) => y.id === x.ownerId); const req = x.requests[0]; return (<React.Fragment key={x.id}>
              <div data-card="1" draggable onDragStart={(e) => { setDragId(x.id); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", x.id); }} onDragEnd={() => { setDragId(null); setDrop(null); }} onClick={() => router.push(`${crm.base}/c/${x.id}`)}
                className={`cursor-pointer rounded-[4px] border border-line bg-surface p-[10px] hover:border-[#b9c2d0] ${dragId === x.id ? "opacity-50" : ""}`} style={{ borderTop: `3px solid ${x.priority ? PRIO_COLOR[x.priority] : st.color ?? "#8a93a2"}` }}>
                <div className="flex items-center gap-[6px]"><span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-ink">{x.name}</span>{m && <span className="flex h-5 w-5 flex-none items-center justify-center rounded-full text-[9px] font-bold text-white" title={m.name} style={{ background: m.color }}>{initials(m.name)}</span>}</div>
                <div className="mt-[2px] truncate text-[12px] text-muted">{x.contacts.find((y) => y.isMain)?.value ?? x.contacts[0]?.value ?? ""}</div>
                {req && <div className="mt-1 truncate text-[12px] text-text"><span className="rounded-[3px] px-1 text-[10.5px] font-semibold text-white" style={{ background: REQ_COLOR[req.kind] }}>{c.rq.kinds[req.kind]}</span> {reqSummary(req.kind, req.fields)}</div>}
                {d && !d.closed && (() => { const s2 = crm.stages.find((q) => q.id === d.stageId); const col = s2?.color ?? "#8a93a2"; return <div className="mt-1 flex items-center gap-[6px] text-[11.5px] text-muted"><span className="flex-none rounded-[5px] px-[6px] text-[11px] font-medium" style={{ background: col + "1f", color: col }}>{stageName(s2, t, lang)}</span><span className="truncate">{d.title}</span></div>; })()}
                {x.nextTask && <div className={`mt-1 truncate text-[11.5px] ${over2 ? "font-semibold text-red" : "text-muted"}`}>{x.nextTask.title} · {fmtDate(x.nextTask.dueAt, lang)}</div>}
              </div>
              {here === k + 1 && ph}
            </React.Fragment>); })}
          </div>
        </div>); })}
    </div>
  );
}
