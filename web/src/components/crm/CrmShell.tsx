"use client";

import { useBackClose } from "@/hooks/useScrollLock";

// CRM v2 — каркас: боковое меню (обзор / клиенты / сделки / задачи / настройки), строка поиска, кнопка «Создать»,
// контекст рабочего пространства. Маршруты: [] обзор, ["clients"], ["deals"], ["tasks"], ["settings", sub?], ["c", id]
// (и старые ["<uuid>"]). Во всю ширину окна под шапкой (html[data-crmmode]). Живёт в layout маршрута и читает путь
// из usePathname — содержимое раздела меняется без пересоздания каркаса.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
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
import { DealPage } from "./DealPage";
import { Overview } from "./Overview";
import { TasksView } from "./TasksView";
import { CrmCtx, cacheGet, cacheRun, cacheSet, fill, fmtDate, getPref, setPref, usePref, type CrmTab } from "./crmUi";

const SIDE_LS = "opl-crm-side";
const TABS_LS = "opl-crm-tabs";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function CrmShell({ base }: { base: string }) {
  const { t, lang } = useI18n();
  const c = t.crm;
  const CREATE_LABEL = { client: c.nav.newClient, deal: c.nav.newDeal, task: c.nav.newTask } as const;
  const router = useRouter();
  const pathname = usePathname();
  const path = pathname.startsWith(base) ? pathname.slice(base.length).split("/").filter(Boolean) : [];
  const [boot, setBoot] = useState<{ me: CrmMe; stages: Stage[]; cstages: Stage[]; sources: Source[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [create, setCreate] = useState<"" | "client" | "deal" | "task">("");
  const [menu, setMenu] = useState(false);
  const [menuRect, setMenuRect] = useState<{ bottom: number; right: number } | null>(null); // якорь меню создания (снимок при открытии)
  useBackClose(menu, () => setMenu(false)); // на телефоне меню создания — шторка снизу, «назад» закрывает (стандарт 18.10.2026)
  const [palette, setPalette] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string; roles?: string[] }[]>([]);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const [counts, setCounts] = useState<{ clients: number; deals: number; tasks: number } | null>(null);
  const load = () => {
    crmBootstrap().then(setBoot).catch((e: Error) => setErr(e.message));
    // страница клиентов — параллельно с каркасом, в кэш раздела (а не после него): минус один круг запросов
    if (!cacheGet(`${base}:clients:active`)) cacheRun(`${base}:clients:active`, () => crmClientsPage({})).then((r) => { cacheSet(`${base}:clients:active`, { list: r.list, deals: r.deals }); setCounts(r.counts); }).catch(() => {});
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps -- load пересоздаётся на каждый рендер, грузим один раз на кабинет
  useEffect(() => { load(); }, [base]);
  useEffect(() => { document.documentElement.setAttribute("data-crmmode", "1"); return () => document.documentElement.removeAttribute("data-crmmode"); }, []);
  // Высота липкой шапки кабинета → CSS-переменная --crm-top (13.10.2026): панели CRM прилипают под неё. Шапка риэлтора — 62px,
  // шапка застройщика на узком окне переносится и выше; константа 62 давала дыру/наложение.
  useEffect(() => {
    const hdr = document.querySelector<HTMLElement>("header[data-topbar], [data-dev] > header");
    if (!hdr) return;
    const root = document.documentElement;
    // шапка риэлтора на телефоне прячется при прокрутке (data-hdr-hidden) — тогда панели CRM прилипают к самому верху,
    // иначе над ними оставалась «дыра» в 62px, сквозь которую ехало содержимое (18.10.2026, «вёрстка в мобильном поехала»)
    const apply = () => root.style.setProperty("--crm-top", hdr.dataset.hdrHidden === "1" ? "0px" : `${Math.round(hdr.getBoundingClientRect().height)}px`);
    apply();
    const ro = new ResizeObserver(apply); ro.observe(hdr);
    const mo = new MutationObserver(apply); mo.observe(hdr, { attributes: true, attributeFilter: ["data-hdr-hidden"] });
    return () => { ro.disconnect(); mo.disconnect(); root.style.removeProperty("--crm-top"); };
  }, []);
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
  const section = path[0] ?? "";
  const primary: "client" | "deal" | "task" = section === "deals" ? "deal" : section === "tasks" ? "task" : "client";
  const clientId = section === "c" ? path[1] : UUID.test(section) ? section : null;
  const dealId = section === "d" ? path[1] : null; // карточка сделки (13.10.2026) — вкладка с id «d:<uuid>»
  const activeTab = dealId ? `d:${dealId}` : clientId;
  useEffect(() => { if (section === "clients" || clientId) return; crmCounts().then(setCounts).catch(() => {}); }, [pathname, section, clientId]); // на клиентах счётчики приходят вместе со страницей
  const me = boot?.me.members.find((m) => m.id === boot.me.meId);
  // вкладки открытых карточек (localStorage, на кабинет): [{id, name}]
  const tabsKey = `${TABS_LS}:${base}:${boot?.me.ws.id ?? ""}`; // ключ на пространство: другой пользователь в том же браузере не видит чужих вкладок
  const tabsPref = usePref(tabsKey);
  const lastListKey = `${TABS_LS}:last:${base}`;
  const lastList = usePref(lastListKey) || "clients";
  useEffect(() => { if (!clientId && !dealId && ["", "clients", "deals", "tasks"].includes(section)) setPref(lastListKey, section); }, [clientId, dealId, section, lastListKey]);
  const tabs: CrmTab[] = (() => { if (!boot) return []; try { const v = JSON.parse(tabsPref || "[]"); return Array.isArray(v) ? v.filter((x) => x && x.id && x.name) : []; } catch { return []; } })();
  // Активная вкладка всегда в кадре (18.10.2026, «если их 20 — не листать же до неё»): при смене активной вкладки или появлении
  // новой строка прокручивается к ней (горизонтально, без прыжка страницы).
  const tabsRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = tabsRef.current, el = row?.querySelector<HTMLElement>("[data-tab-active]");
    if (!row || !el) return;
    // руками по горизонтали (scrollIntoView в фоновой вкладке/с smooth не срабатывал и мог дёрнуть страницу по вертикали)
    const left = el.offsetLeft - row.offsetLeft, right = left + el.offsetWidth;
    if (left < row.scrollLeft + 12) row.scrollLeft = Math.max(0, left - 12);
    else if (right > row.scrollLeft + row.clientWidth - 12) row.scrollLeft = right - row.clientWidth + 12;
  }, [activeTab, tabsPref, boot]); // boot: до загрузки вкладок в DOM нет — после неё прокрутить ещё раз
  const readTabs = useCallback((): CrmTab[] => { try { const v = JSON.parse(getPref(tabsKey) || "[]"); return Array.isArray(v) ? v : []; } catch { return []; } }, [tabsKey]);
  const openTab = useCallback((id: string, name: string) => { const cur = readTabs(); const i = cur.findIndex((x) => x.id === id); if (i >= 0) { if (cur[i].name !== name) setPref(tabsKey, JSON.stringify(cur.map((x) => (x.id === id ? { id, name } : x)))); } else setPref(tabsKey, JSON.stringify([...cur, { id, name }].slice(-12))); }, [tabsKey, readTabs]);
  const closeTab = useCallback((id: string) => { setPref(tabsKey, JSON.stringify(readTabs().filter((x) => x.id !== id))); }, [tabsKey, readTabs]);
  const accessText = boot?.me.access === "readonly" ? c.readonly : boot?.me.paidTo ? fill(c.paidTo, { date: fmtDate(boot.me.paidTo, lang) }) : boot?.me.trialUntil ? fill(c.trial, { date: fmtDate(boot.me.trialUntil, lang) }) : "";
  const nav: { key: string; href: string; label: string; Icon: typeof IconUsers; active: boolean }[] = [
    { key: "", href: base, label: c.nav.overview, Icon: IconLayoutDashboard, active: section === "" },
    { key: "clients", href: `${base}/clients`, label: c.nav.clients, Icon: IconUsers, active: section === "clients" || !!clientId },
    { key: "deals", href: `${base}/deals`, label: c.nav.deals, Icon: IconLayoutKanban, active: section === "deals" || !!dealId },
    { key: "tasks", href: `${base}/tasks`, label: c.nav.tasks, Icon: IconCalendarCheck, active: section === "tasks" },
    { key: "settings", href: `${base}/settings`, label: c.nav.settings, Icon: IconSettings, active: section === "settings" },
  ];

  if (err) return <div className="p-6 text-[13px] text-muted">{err === "no-company" ? "—" : err}</div>;
  if (!boot) return <div className="py-16 text-center text-[13px] text-muted">…</div>;
  const ctx = { me: boot.me, stages: boot.stages, cstages: boot.cstages, sources: boot.sources, base, refresh: load, setStages: (s: Stage[]) => setBoot((b) => (b ? { ...b, stages: s } : b)), setCstages: (s: Stage[]) => setBoot((b) => (b ? { ...b, cstages: s } : b)), setSources: (s: Source[]) => setBoot((b) => (b ? { ...b, sources: s } : b)), openTab, closeTab, q, setQ, setCounts };
  // первая вкладка — СПИСОК, из которого открыли карточку (12.10.2026, вопрос пользователя «из сделок перекидывает в клиентов»):
  // раздел запоминается, пока открыт список; с карточки вкладка и крестик возвращают туда же
  const listSection = ["", "clients", "deals", "tasks"].includes(section) ? section : lastList;
  const listTab = nav.find((n) => n.key === (activeTab ? lastList : listSection)) ?? nav[1];
  const hrefOf = (id: string) => (id.startsWith("d:") ? `${base}/d/${id.slice(2)}` : `${base}/c/${id}`);
  const closeAndGo = (id: string) => { closeTab(id); if (activeTab === id) router.push(listTab.href); };
  const ro = boot.me.access !== "full";
  const SEARCHABLE = ["clients", "deals", "tasks"]; // поиск в шапке фильтрует список раздела (сделки/задачи — 19.10.2026), из остальных уводит в клиентов
  const submitSearch = () => { if (!SEARCHABLE.includes(section)) router.push(`${base}/clients`); };

  let page: ReactNode;
  if (clientId) page = <ClientPage key={clientId} base={base} id={clientId} embedded />;
  else if (dealId) page = <DealPage key={dealId} id={dealId} />;
  else if (section === "clients") page = <ClientsTable />;
  else if (section === "deals") page = <DealsBoard />;
  else if (section === "tasks") page = <TasksView />;
  else if (section === "settings") page = <CrmSettings sub={path[1]} />;
  else page = <Overview />;

  return (
    <CrmCtx.Provider value={ctx}>
      <div className="flex min-h-[calc(100vh_-_var(--crm-top,62px))]">
        <aside data-crm-side="1" data-wide={wide ? "1" : "0"} className="sticky top-[var(--crm-top,62px)] flex h-[calc(100vh_-_var(--crm-top,62px))] flex-none flex-col border-r border-line bg-surface py-3">
          <button type="button" onClick={() => setPref(SIDE_LS, wide ? "0" : "1")} title={wide ? c.nav.collapse : c.nav.expand} className="mx-2 mb-2 flex h-9 cursor-pointer items-center gap-3 overflow-hidden whitespace-nowrap rounded-[6px] px-3 text-muted hover:bg-bg-3 hover:text-ink"><IconMenu2 size={19} className="flex-none" /><span data-crm-label="1" className="flex items-center gap-2 text-[14px] font-semibold text-ink"><span className="flex h-6 w-6 items-center justify-center rounded-[6px] bg-blue-2 text-[11px] font-bold text-white">C</span>CRM</span></button>
          <nav className="flex flex-col gap-[2px] px-2">
            {nav.map((n) => { const cnt = n.key === "clients" ? counts?.clients : n.key === "deals" ? counts?.deals : n.key === "tasks" ? counts?.tasks : undefined; return (
              <Link key={n.key} href={n.href} title={n.label} className={`flex h-9 items-center gap-3 overflow-hidden whitespace-nowrap rounded-[6px] px-3 text-[13px] transition-colors ${n.active ? "bg-blue-tint font-semibold text-sel-ink" : "font-normal text-text hover:bg-bg-3"}`}>
                <n.Icon size={19} stroke={1.7} className="flex-none" /><span data-crm-label="1" className="min-w-0 flex-1 truncate leading-none">{n.label}</span>{cnt !== undefined && <span data-crm-label="1" className="text-[12px] font-normal text-muted">{cnt.toLocaleString("ru-RU")}</span>}
              </Link>); })}
          </nav>
          <div className="flex-1" />
          {boot.me.access === "readonly" && <div title={accessText} className={`mx-2 mb-1 flex h-8 items-center gap-2 overflow-hidden whitespace-nowrap rounded-[6px] px-[15px] text-[11px] leading-[1.3] ${boot.me.access === "readonly" ? "bg-red-tint text-red" : "text-muted"}`}><IconLock size={13} className="flex-none" /><span data-crm-label="1" className="min-w-0 truncate">{accessText}</span></div>}
          {me && <div className="mx-2 flex items-center gap-[10px] overflow-hidden whitespace-nowrap rounded-[6px] px-[6px] py-[6px]"><span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-bold text-white" style={{ background: me.color }}>{me.name.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2)}</span><span data-crm-label="1" className="min-w-0"><span className="block truncate text-[13px] font-semibold text-ink">{me.name}</span><span className="block text-[11px] text-muted">{boot.me.isAdmin ? c.tbl.role.owner : c.tbl.role.member}</span></span></div>}
        </aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-[var(--crm-top,62px)] z-20 flex h-12 items-center gap-2 border-b border-line bg-surface px-4">
            <div className="text-[15px] font-semibold text-ink max-md:hidden">{nav.find((n) => n.active)?.label ?? c.title}</div>{/* на телефоне раздел виден в нижней панели — заголовок уступает место поиску (18.10.2026, «+ Клиент уходил за край») */}
            <div className="relative ml-2 w-[320px] max-w-[40vw] max-md:ml-0 max-md:w-auto max-md:max-w-none max-md:flex-1">
              <IconSearch size={14} className="absolute left-[9px] top-1/2 -translate-y-1/2 text-muted" />
              <kbd className="pointer-events-none absolute right-[8px] top-1/2 -translate-y-1/2 rounded-[4px] border border-line px-[5px] text-[10px] text-muted max-md:hidden">⌘K</kbd>
              <input ref={searchRef} value={q} onChange={(e) => { setQ(e.target.value); if (!SEARCHABLE.includes(section) && e.target.value.trim()) router.push(`${base}/clients`); }} onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); if (e.key === "Escape") setQ(""); }} placeholder={c.nav.search} className="h-8 w-full rounded-[6px] border border-line bg-surface pl-7 pr-12 text-[13px] text-ink outline-none focus:border-blue focus:ring-2 focus:ring-blue/15" />
            </div>
            <div className="flex-1 max-md:hidden" />
            {/* ОДНА кнопка создания на экран (замечание пользователя 12.10.2026 «дублируются кнопки»): главное действие — по разделу
                (клиенты → клиент, сделки → сделка, задачи → задача), стрелка — остальные два; в разделах своих кнопок нет */}
            <div className="relative flex flex-none items-stretch">
              <button type="button" disabled={ro} onClick={() => setCreate(primary)} className="inline-flex h-8 cursor-pointer items-center gap-1 whitespace-nowrap rounded-l-[6px] bg-blue-2 px-3 text-[13px] font-semibold text-white hover:bg-blue-3 disabled:opacity-50"><IconPlus size={14} /> {CREATE_LABEL[primary]}</button>
              <button type="button" disabled={ro} onClick={(e) => { const r = e.currentTarget.parentElement?.getBoundingClientRect(); setMenuRect(r ? { bottom: r.bottom, right: r.right } : null); setMenu((v) => !v); }} title={c.nav.create} className="inline-flex h-8 w-7 cursor-pointer items-center justify-center rounded-r-[6px] border-l border-white/25 max-md:h-10 max-md:w-9 bg-blue-2 text-white hover:bg-blue-3 disabled:opacity-50"><IconChevronDown size={13} /></button>
              {/* порталом в body: внутри липкой шапки (z-20) шторка на телефоне оказывалась ПОД нижней панелью вкладок (18.10.2026) */}
              {menu && createPortal(<div data-overlay="1">
                <div className="fixed inset-0 z-[310] bg-[rgba(10,16,28,.35)] md:hidden" onClick={() => setMenu(false)} />
                <div data-sheet="fit" style={menuRect ? { position: "fixed", top: menuRect.bottom + 4, left: Math.max(8, menuRect.right - 170), zIndex: 600 } : { position: "fixed", zIndex: 600 }} className="w-[170px] overflow-hidden rounded-[6px] border border-line bg-surface py-1 shadow-[0_8px_24px_rgba(20,36,63,.14)] max-md:p-3 max-md:pb-[max(12px,env(safe-area-inset-bottom))]" onMouseLeave={() => setMenu(false)}>
                  {(["client", "deal", "task"] as const).filter((k) => k !== primary).map((k) => <button key={k} type="button" onClick={() => { setMenu(false); setCreate(k); }} className="block w-full cursor-pointer px-3 py-[7px] text-left text-[13px] text-ink hover:bg-bg-3">{CREATE_LABEL[k]}</button>)}
                </div>
              </div>, document.body)}
            </div>
          </div>
          {/* вкладки: список раздела + открытые карточки (замечание пользователя 11.10.2026 — «как заявки во вкладках») */}
          <div ref={tabsRef} className="sticky top-[calc(var(--crm-top,62px)_+_48px)] z-10 flex h-10 items-stretch gap-[2px] overflow-x-auto border-b border-line bg-[#eef0f3] px-3 pt-[6px] max-md:[scrollbar-width:none]">
            <Link href={listTab.href} className={`flex flex-none items-center gap-2 rounded-t-[6px] border border-b-0 px-3 text-[12.5px] font-medium ${!activeTab ? "border-line bg-surface text-ink" : "border-transparent text-muted hover:bg-[#e4e7ec] hover:text-ink"}`}><IconMenu2 size={14} /> {listTab.key === "clients" ? c.tbl.listOf : listTab.label}</Link>
            {tabs.map((tb) => (
              <div key={tb.id} data-tab-active={activeTab === tb.id ? "1" : undefined} role="link" tabIndex={0} onClick={() => router.push(hrefOf(tb.id))} onKeyDown={(e) => { if (e.key === "Enter") router.push(hrefOf(tb.id)); }} onAuxClick={(e) => { if (e.button === 1) closeAndGo(tb.id); }} title={tb.name} className={`flex min-w-[120px] max-w-[220px] flex-none cursor-pointer select-none items-center gap-2 rounded-t-[6px] border border-b-0 pl-3 pr-1 text-[12.5px] ${activeTab === tb.id ? "border-line bg-surface font-medium text-ink" : "border-transparent text-muted hover:bg-[#e4e7ec] hover:text-ink"}`}>
                <span className={`h-[6px] w-[6px] flex-none rounded-full ${activeTab === tb.id ? "bg-blue-2" : tb.id.startsWith("d:") ? "bg-[#f5a623]" : "bg-line-4"}`} />
                <span className="min-w-0 flex-1 truncate">{tb.name}</span>
                <button type="button" onClick={(e) => { e.stopPropagation(); closeAndGo(tb.id); }} title={c.close} className="flex h-6 w-6 flex-none cursor-pointer items-center justify-center rounded-[4px] text-muted hover:bg-bg-3 hover:text-ink"><IconX size={13} /></button>
              </div>
            ))}
          </div>
          <div className="px-4 py-4 max-md:overflow-x-hidden">{page}</div>
        </div>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} onCreate={(k) => setCreate(k)} />
      {boot.me.access === "readonly" && <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-red px-4 py-2 text-[12px] font-bold text-white shadow-lg">{c.readonly}</div>}
      <ClientModal open={create === "client"} client={null} onClose={() => setCreate("")} onSaved={(id) => { setCreate(""); router.push(`${base}/c/${id}`); }} onOpenDup={(id) => { setCreate(""); router.push(`${base}/c/${id}`); }} />
      <CreateDealHost open={create === "deal"} onClose={() => setCreate("")} clients={clients} setClients={setClients} base={base} preset={clientId ? { id: clientId, name: tabs.find((x) => x.id === clientId)?.name ?? "…" } : null} />
      <CreateTaskHost open={create === "task"} onClose={() => setCreate("")} clients={clients} setClients={setClients} preset={clientId ? { id: clientId, name: tabs.find((x) => x.id === clientId)?.name ?? "…" } : null} />
      {/* Телефон: разделы — нижняя панель вкладок (18.10.2026, «иконка обрезана, как в мире делают»): как у Pipedrive/HubSpot в
          мобильном вебе — иконка + подпись + счётчик, активный синий, боковое меню на ≤760 скрыто (globals.css) */}
      <nav data-crm-bottom="1" className="fixed inset-x-0 bottom-0 z-[90] hidden border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] max-md:flex">
        {nav.map((n) => { const cnt = n.key === "clients" ? counts?.clients : n.key === "deals" ? counts?.deals : n.key === "tasks" ? counts?.tasks : undefined; return (
          <Link key={n.key} href={n.href} className={`relative flex h-[56px] min-w-0 flex-1 flex-col items-center justify-center gap-[3px] text-[10.5px] font-semibold ${n.active ? "text-blue-2" : "text-muted"}`}>
            <n.Icon size={21} stroke={n.active ? 2 : 1.7} />
            <span className="max-w-full truncate px-1">{n.label}</span>
            {!!cnt && <span className="absolute left-1/2 top-[6px] ml-[6px] rounded-[7px] bg-bg-2 px-[5px] text-[9.5px] font-bold text-text">{cnt}</span>}
          </Link>); })}
      </nav>
    </CrmCtx.Provider>
  );
}

// модалки «Создать сделку/задачу» из шапки: список клиентов подгружается при открытии
import { listClients } from "@/app/crm/actions";
function useClientOpts(open: boolean, clients: { id: string; name: string; roles?: string[] }[], setClients: (v: { id: string; name: string; roles?: string[] }[]) => void) {
  useEffect(() => { if (open && !clients.length) listClients({}).then((l) => setClients(l.map((x) => ({ id: x.id, name: x.name, roles: x.roles })))).catch(() => {}); }, [open, clients.length, setClients]);
}
type Preset = { id: string; name: string } | null;
// в карточке клиента «Создать → Сделка/Задача» подставляет этого клиента и открывает окно сразу, не дожидаясь списка клиентов
const withPreset = (clients: { id: string; name: string; roles?: string[] }[], preset: Preset) => (preset && !clients.some((x) => x.id === preset.id) ? [preset, ...clients] : clients);
function CreateDealHost({ open, onClose, clients, setClients, base, preset }: { open: boolean; onClose: () => void; clients: { id: string; name: string; roles?: string[] }[]; setClients: (v: { id: string; name: string; roles?: string[] }[]) => void; base: string; preset: Preset }) {
  useClientOpts(open, clients, setClients);
  const router = useRouter();
  const list = withPreset(clients, preset);
  return <DealModal open={open && list.length > 0} deal={null} clients={list} clientId={preset?.id ?? null} onClose={onClose} onSaved={() => { onClose(); if (!preset) router.push(`${base}/deals`); router.refresh(); }} />;
}
function CreateTaskHost({ open, onClose, clients, setClients, preset }: { open: boolean; onClose: () => void; clients: { id: string; name: string; roles?: string[] }[]; setClients: (v: { id: string; name: string; roles?: string[] }[]) => void; preset: Preset }) {
  useClientOpts(open, clients, setClients);
  const router = useRouter();
  return <TaskModal open={open} task={null} clients={withPreset(clients, preset)} clientId={preset?.id ?? null} onClose={onClose} onSaved={() => { onClose(); router.refresh(); }} />;
}
