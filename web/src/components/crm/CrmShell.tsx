"use client";

// CRM v2 — каркас: боковое меню (обзор / клиенты / сделки / задачи / настройки), строка поиска, кнопка «Создать»,
// контекст рабочего пространства. Маршруты: [] обзор, ["clients"], ["deals"], ["tasks"], ["settings", sub?], ["c", id]
// (и старые ["<uuid>"]). Во всю ширину окна под шапкой (html[data-crmmode]). Живёт в layout маршрута и читает путь
// из usePathname — содержимое раздела меняется без пересоздания каркаса.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IconCalendarCheck, IconChevronDown, IconLayoutDashboard, IconLayoutKanban, IconLock, IconMenu2, IconPlus, IconSearch, IconSettings, IconUsers, IconX } from "@tabler/icons-react";
import { crmBootstrap, crmClientsPage, crmCounts } from "@/app/crm/actions";
import { useI18n } from "@/i18n/provider";
import type { CrmMe, Source, Stage } from "@/lib/crm/types";
import { ClientModal } from "./ClientModal";
import { CommandPalette } from "./CommandPalette";
import { ClientPage } from "./ClientPage";
import { ClientsTable } from "./ClientsTable";
import { DealModal, TaskModal } from "./CrmModals";
import { CrmSettings } from "./CrmSettings";
import { DealsBoard } from "./DealsBoard";
import { Overview } from "./Overview";
import { TasksView } from "./TasksView";
import { CrmCtx, cacheGet, cacheSet, fill, fmtDate, getPref, setPref, usePref, type CrmTab } from "./crmUi";

const SIDE_LS = "opl-crm-side";
const TABS_LS = "opl-crm-tabs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function CrmShell({ base }: { base: string }) {
  const { t, lang } = useI18n();
  const c = t.crm;
  const router = useRouter();
  const pathname = usePathname();
  const path = pathname.startsWith(base) ? pathname.slice(base.length).split("/").filter(Boolean) : [];
  const [boot, setBoot] = useState<{ me: CrmMe; stages: Stage[]; cstages: Stage[]; sources: Source[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [create, setCreate] = useState<"" | "client" | "deal" | "task">("");
  const [menu, setMenu] = useState(false);
  const [palette, setPalette] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
    const [counts, setCounts] = useState<{ clients: number; deals: number; tasks: number } | null>(null);
const load = useCallback(() => {
    crmBootstrap().then(setBoot).catch((e: Error) => setErr(e.message));
    // страница клиентов — параллельно с каркасом, в кэш раздела (а не после него): минус один круг запросов
    if (!cacheGet(`${base}:clients:active`)) crmClientsPage({}).then(({ list, deals, counts }) => { cacheSet(`${base}:clients:active`, { list, deals }); setCounts(counts); }).catch(() => {});
  }, [base]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.documentElement.setAttribute("data-crmmode", "1"); return () => document.documentElement.removeAttribute("data-crmmode"); }, []);
  // «/» — фокус на поиск, Esc — закрыть меню
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement; const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setPalette((v) => !v); return; }
      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key.toLowerCase() === "n" && !typing && !e.metaKey && !e.ctrlKey && !e.altKey) { e.preventDefault(); setCreate("client"); }
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  const wide = usePref(SIDE_LS) !== "0"; // левое меню с подписями и счётчиками (образец пользователя); сворачивается в иконки
  useEffect(() => { crmCounts().then(setCounts).catch(() => {}); }, [pathname]);
  const me = boot?.me.members.find((m) => m.id === boot.me.meId);
  // вкладки открытых карточек (localStorage, на кабинет): [{id, name}]
  const tabsKey = `${TABS_LS}:${base}:${boot?.me.ws.id ?? ""}`; // ключ на пространство: другой пользователь в том же браузере не видит чужих вкладок
  const tabsPref = usePref(tabsKey);
  const tabs: CrmTab[] = (() => { if (!boot) return []; try { const v = JSON.parse(tabsPref || "[]"); return Array.isArray(v) ? v.filter((x) => x && x.id && x.name) : []; } catch { return []; } })();
  const readTabs = useCallback((): CrmTab[] => { try { const v = JSON.parse(getPref(tabsKey) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }, [tabsKey]);
  const openTab = useCallback((id: string, name: string) => { const cur = readTabs(); const i = cur.findIndex((x) => x.id === id); if (i >= 0) { if (cur[i].name !== name) setPref(tabsKey, JSON.stringify(cur.map((x) => (x.id === id ? { id, name } : x)))); } else setPref(tabsKey, JSON.stringify([...cur, { id, name }].slice(-12))); }, [tabsKey, readTabs]);
  const closeTab = useCallback((id: string) => { setPref(tabsKey, JSON.stringify(readTabs().filter((x) => x.id !== id))); }, [tabsKey, readTabs]);
  const accessText = boot?.me.access === "readonly" ? c.readonly : boot?.me.paidTo ? fill(c.paidTo, { date: fmtDate(boot.me.paidTo, lang) }) : boot?.me.trialUntil ? fill(c.trial, { date: fmtDate(boot.me.trialUntil, lang) }) : "";
  const section = path[0] ?? "";
  const clientId = section === "c" ? path[1] : UUID.test(section) ? section : null;
  const nav: { key: string; href: string; label: string; Icon: typeof IconUsers; active: boolean }[] = [
    { key: "", href: base, label: c.nav.overview, Icon: IconLayoutDashboard, active: section === "" },
    { key: "clients", href: `${base}/clients`, label: c.nav.clients, Icon: IconUsers, active: section === "clients" || !!clientId },
    { key: "deals", href: `${base}/deals`, label: c.nav.deals, Icon: IconLayoutKanban, active: section === "deals" },
    { key: "tasks", href: `${base}/tasks`, label: c.nav.tasks, Icon: IconCalendarCheck, active: section === "tasks" },
    { key: "settings", href: `${base}/settings`, label: c.nav.settings, Icon: IconSettings, active: section === "settings" },
  ];

  if (err) return <div className="p-6 text-[13px] text-muted">{err === "no-company" ? "—" : err}</div>;
  if (!boot) return <div className="py-16 text-center text-[13px] text-muted">…</div>;
  const ctx = { me: boot.me, stages: boot.stages, cstages: boot.cstages, sources: boot.sources, base, refresh: load, setStages: (s: Stage[]) => setBoot((b) => (b ? { ...b, stages: s } : b)), setCstages: (s: Stage[]) => setBoot((b) => (b ? { ...b, cstages: s } : b)), setSources: (s: Source[]) => setBoot((b) => (b ? { ...b, sources: s } : b)), openTab, closeTab, q, setQ };
  const listTab = nav.find((n) => n.active && n.key !== "clients") ?? nav[1];
  const closeAndGo = (id: string) => { closeTab(id); if (clientId === id) router.push(`${base}/clients`); };
  const ro = boot.me.access !== "full";
  const submitSearch = () => { if (section !== "clients") router.push(`${base}/clients`); };

  let page: ReactNode;
  if (clientId) page = <ClientPage key={clientId} base={base} id={clientId} embedded />;
  else if (section === "clients") page = <ClientsTable />;
  else if (section === "deals") page = <DealsBoard />;
  else if (section === "tasks") page = <TasksView />;
  else if (section === "settings") page = <CrmSettings sub={path[1]} />;
  else page = <Overview />;

  return (
    <CrmCtx.Provider value={ctx}>
      <div className="flex min-h-[calc(100vh-62px)]">
        <aside data-crm-side="1" data-wide={wide ? "1" : "0"} className="sticky top-[62px] flex h-[calc(100vh-62px)] flex-none flex-col border-r border-line bg-surface py-3">
          <button type="button" onClick={() => setPref(SIDE_LS, wide ? "0" : "1")} title={wide ? c.nav.collapse : c.nav.expand} className="mx-2 mb-2 flex h-9 cursor-pointer items-center gap-3 overflow-hidden whitespace-nowrap rounded-[6px] px-3 text-muted hover:bg-bg-3 hover:text-ink"><IconMenu2 size={19} className="flex-none" /><span data-crm-label="1" className="flex items-center gap-2 text-[14px] font-semibold text-ink"><span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-blue-2 text-[11px] font-bold text-white">C</span>CRM</span></button>
          <nav className="flex flex-col gap-[2px] px-2">
            {nav.map((n) => { const cnt = n.key === "clients" ? counts?.clients : n.key === "deals" ? counts?.deals : n.key === "tasks" ? counts?.tasks : undefined; return (
              <Link key={n.key} href={n.href} title={n.label} className={`flex h-9 items-center gap-3 overflow-hidden whitespace-nowrap rounded-[6px] px-3 text-[13px] transition-colors ${n.active ? "bg-blue-tint font-semibold text-sel-ink" : "font-normal text-text hover:bg-bg-3"}`}>
                <n.Icon size={19} stroke={1.7} className="flex-none" /><span data-crm-label="1" className="min-w-0 flex-1 truncate leading-none">{n.label}</span>{cnt !== undefined && <span data-crm-label="1" className="text-[12px] font-normal text-muted">{cnt.toLocaleString("ru-RU")}</span>}
              </Link>); })}
          </nav>
          <div className="flex-1" />
          <div title={accessText} className={`mx-2 mb-1 flex h-8 items-center gap-2 overflow-hidden whitespace-nowrap rounded-[6px] px-[15px] text-[11px] leading-[1.3] ${boot.me.access === "readonly" ? "bg-red-tint text-red" : "text-muted"}`}><IconLock size={13} className="flex-none" /><span data-crm-label="1" className="min-w-0 truncate">{accessText}</span></div>
          {me && <div className="mx-2 flex items-center gap-[10px] overflow-hidden whitespace-nowrap rounded-[6px] px-[6px] py-[6px]"><span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: me.color }}>{me.name.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2)}</span><span data-crm-label="1" className="min-w-0"><span className="block truncate text-[13px] font-semibold text-ink">{me.name}</span><span className="block text-[11px] text-muted">{boot.me.isAdmin ? c.tbl.role.owner : c.tbl.role.member}</span></span></div>}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-[62px] z-20 flex h-12 items-center gap-2 border-b border-line bg-surface px-4">
            <div data-crm-mobnav="1" className="hidden gap-1 overflow-x-auto">{nav.map((n) => <Link key={n.key} href={n.href} className={`flex h-8 w-8 flex-none items-center justify-center rounded-[6px] ${n.active ? "bg-ink text-white" : "text-muted"}`}><n.Icon size={17} /></Link>)}</div>
            <div className="text-[15px] font-semibold text-ink">{nav.find((n) => n.active)?.label ?? c.title}</div>
            <div className="relative ml-2 w-[320px] max-w-[40vw]">
              <IconSearch size={14} className="absolute left-[9px] top-1/2 -translate-y-1/2 text-muted" />
              <kbd className="pointer-events-none absolute right-[8px] top-1/2 -translate-y-1/2 rounded-[4px] border border-line px-[5px] text-[10px] text-muted">⌘K</kbd>
              <input ref={searchRef} value={q} onChange={(e) => { setQ(e.target.value); if (section !== "clients" && e.target.value.trim()) router.push(`${base}/clients`); }} onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); if (e.key === "Escape") setQ(""); }} placeholder={c.nav.search} className="h-8 w-full rounded-[6px] border border-line bg-surface pl-7 pr-12 text-[13px] text-ink outline-none focus:border-blue focus:ring-2 focus:ring-blue/15" />
            </div>
            <div className="flex-1" />
            <div className="relative">
              <button type="button" disabled={ro} onClick={() => setMenu((v) => !v)} className="inline-flex h-8 cursor-pointer items-center gap-1 rounded-[6px] bg-blue-2 px-3 text-[13px] font-semibold text-white hover:bg-blue-3 disabled:opacity-50"><IconPlus size={14} /> {c.nav.create} <IconChevronDown size={12} /></button>
              {menu && (
                <div className="absolute right-0 top-[calc(100%+4px)] z-30 w-[170px] overflow-hidden rounded-[6px] border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(20,36,63,.14)]" onMouseLeave={() => setMenu(false)}>
                  {([["client", c.nav.newClient], ["deal", c.nav.newDeal], ["task", c.nav.newTask]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => { setMenu(false); setCreate(k); }} className="block w-full cursor-pointer px-3 py-[7px] text-left text-[13px] text-ink hover:bg-bg-3">{l}</button>)}
                </div>
              )}
            </div>
          </div>
          {/* вкладки: список раздела + открытые карточки (замечание пользователя 11.10.2026 — «как заявки во вкладках») */}
          <div className="sticky top-[110px] z-10 flex h-10 items-stretch gap-[2px] overflow-x-auto border-b border-line bg-[#eef0f3] px-3 pt-[6px]">
            <Link href={clientId ? `${base}/clients` : listTab.href} className={`flex flex-none items-center gap-2 rounded-t-[6px] border border-b-0 px-3 text-[12.5px] font-medium ${!clientId ? "border-line bg-surface text-ink" : "border-transparent text-muted hover:text-ink"}`}><IconMenu2 size={14} /> {clientId || section === "clients" ? c.tbl.listOf : listTab.label}</Link>
            {tabs.map((tb) => (
              <div key={tb.id} className={`flex max-w-[220px] flex-none items-center gap-2 rounded-t-[6px] border border-b-0 pl-3 pr-1 text-[12.5px] ${clientId === tb.id ? "border-line bg-surface font-medium text-ink" : "border-transparent text-muted hover:text-ink"}`}>
                <span className={`h-[6px] w-[6px] flex-none rounded-full ${clientId === tb.id ? "bg-blue-2" : "bg-line-4"}`} />
                <Link href={`${base}/c/${tb.id}`} className="truncate">{tb.name}</Link>
                <button type="button" onClick={() => closeAndGo(tb.id)} title={c.close} className="flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-[4px] text-muted hover:bg-bg-3 hover:text-ink"><IconX size={13} /></button>
              </div>
            ))}
          </div>
          <div className="px-4 py-4">{page}</div>
        </div>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} onCreate={(k) => setCreate(k)} />
      {boot.me.access === "readonly" && <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-red px-4 py-2 text-[12px] font-bold text-white shadow-lg">{c.readonly}</div>}
      <ClientModal open={create === "client"} client={null} onClose={() => setCreate("")} onSaved={(id) => { setCreate(""); router.push(`${base}/c/${id}`); }} onOpenDup={(id) => { setCreate(""); router.push(`${base}/c/${id}`); }} />
      <CreateDealHost open={create === "deal"} onClose={() => setCreate("")} clients={clients} setClients={setClients} base={base} preset={clientId ? { id: clientId, name: tabs.find((x) => x.id === clientId)?.name ?? "…" } : null} />
      <CreateTaskHost open={create === "task"} onClose={() => setCreate("")} clients={clients} setClients={setClients} preset={clientId ? { id: clientId, name: tabs.find((x) => x.id === clientId)?.name ?? "…" } : null} />
    </CrmCtx.Provider>
  );
}

// модалки «Создать сделку/задачу» из шапки: список клиентов подгружается при открытии
import { listClients } from "@/app/crm/actions";
function useClientOpts(open: boolean, clients: { id: string; name: string }[], setClients: (v: { id: string; name: string }[]) => void) {
  useEffect(() => { if (open && !clients.length) listClients({}).then((l) => setClients(l.map((x) => ({ id: x.id, name: x.name })))).catch(() => {}); }, [open, clients.length, setClients]);
}
type Preset = { id: string; name: string } | null;
// в карточке клиента «Создать → Сделка/Задача» подставляет этого клиента и открывает окно сразу, не дожидаясь списка клиентов
const withPreset = (clients: { id: string; name: string }[], preset: Preset) => (preset && !clients.some((x) => x.id === preset.id) ? [preset, ...clients] : clients);
function CreateDealHost({ open, onClose, clients, setClients, base, preset }: { open: boolean; onClose: () => void; clients: { id: string; name: string }[]; setClients: (v: { id: string; name: string }[]) => void; base: string; preset: Preset }) {
  useClientOpts(open, clients, setClients);
  const router = useRouter();
  const list = withPreset(clients, preset);
  return <DealModal open={open && list.length > 0} deal={null} clients={list} clientId={preset?.id ?? null} onClose={onClose} onSaved={() => { onClose(); if (!preset) router.push(`${base}/deals`); router.refresh(); }} />;
}
function CreateTaskHost({ open, onClose, clients, setClients, preset }: { open: boolean; onClose: () => void; clients: { id: string; name: string }[]; setClients: (v: { id: string; name: string }[]) => void; preset: Preset }) {
  useClientOpts(open, clients, setClients);
  const router = useRouter();
  return <TaskModal open={open} task={null} clients={withPreset(clients, preset)} clientId={preset?.id ?? null} onClose={onClose} onSaved={() => { onClose(); router.refresh(); }} />;
}
