"use client";

// CRM v2 — каркас: боковое меню (обзор / клиенты / сделки / задачи / настройки), строка поиска, кнопка «Создать»,
// контекст рабочего пространства. Маршруты: [] обзор, ["clients"], ["deals"], ["tasks"], ["settings", sub?], ["c", id]
// (и старые ["<uuid>"]). Во всю ширину окна под шапкой (html[data-crmmode]).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IconCalendarCheck, IconChevronDown, IconLayoutDashboard, IconLayoutKanban, IconLayoutSidebarLeftCollapse, IconLayoutSidebarLeftExpand, IconLock, IconPlus, IconSearch, IconSettings, IconUsers } from "@tabler/icons-react";
import { crmBootstrap } from "@/app/crm/actions";
import { useI18n } from "@/i18n/provider";
import type { CrmMe, Source, Stage } from "@/lib/crm/types";
import { ClientModal } from "./ClientModal";
import { ClientPage } from "./ClientPage";
import { ClientsTable } from "./ClientsTable";
import { DealModal, TaskModal } from "./CrmModals";
import { CrmSettings } from "./CrmSettings";
import { DealsBoard } from "./DealsBoard";
import { Overview } from "./Overview";
import { TasksView } from "./TasksView";
import { CrmCtx, fill, fmtDate, setPref, usePref } from "./crmUi";

const SIDE_LS = "opl-crm-side";
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function CrmShell({ base, path }: { base: string; path: string[] }) {
  const { t, lang } = useI18n();
  const c = t.crm;
  const router = useRouter();
  const [boot, setBoot] = useState<{ me: CrmMe; stages: Stage[]; sources: Source[] } | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [create, setCreate] = useState<"" | "client" | "deal" | "task">("");
  const [menu, setMenu] = useState(false);
  const [clients, setClients] = useState<{ id: string; name: string }[]>([]);
  const [q, setQ] = useState("");
  const searchRef = useRef<HTMLInputElement>(null);
  const load = useCallback(() => { crmBootstrap().then(setBoot).catch((e: Error) => setErr(e.message)); }, []);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { document.documentElement.setAttribute("data-crmmode", "1"); return () => document.documentElement.removeAttribute("data-crmmode"); }, []);
  // «/» — фокус на поиск, Esc — закрыть меню
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement; const typing = ["INPUT", "TEXTAREA", "SELECT"].includes(el.tagName) || el.isContentEditable;
      if (e.key === "/" && !typing) { e.preventDefault(); searchRef.current?.focus(); }
      if (e.key === "Escape") setMenu(false);
    };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);

  const wide = usePref(SIDE_LS) === "1"; // развёрнутое левое меню (подписи справа от иконок) — запоминается
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
  const ctx = { me: boot.me, stages: boot.stages, sources: boot.sources, base, refresh: load, setStages: (s: Stage[]) => setBoot((b) => (b ? { ...b, stages: s } : b)), setSources: (s: Source[]) => setBoot((b) => (b ? { ...b, sources: s } : b)) };
  const ro = boot.me.access !== "full";
  const submitSearch = () => { router.push(`${base}/clients?q=${encodeURIComponent(q.trim())}`); };

  let page: ReactNode;
  if (clientId) page = <ClientPage base={base} id={clientId} embedded />;
  else if (section === "clients") page = <ClientsTable />;
  else if (section === "deals") page = <DealsBoard />;
  else if (section === "tasks") page = <TasksView />;
  else if (section === "settings") page = <CrmSettings sub={path[1]} />;
  else page = <Overview />;

  return (
    <CrmCtx.Provider value={ctx}>
      <div className="flex min-h-[calc(100vh-62px)]">
        <aside data-crm-side="1" data-wide={wide ? "1" : "0"} className="sticky top-[62px] flex h-[calc(100vh-62px)] flex-none flex-col items-stretch bg-ink py-3">
          <nav className="flex flex-col gap-1 px-2">
            {nav.map((n) => <Link key={n.key} href={n.href} title={n.label} data-active={n.active ? "1" : "0"} className={`flex items-center rounded-[6px] text-white/60 transition ${wide ? "gap-3 px-3 py-[8px] text-[13px] font-medium" : "flex-col gap-[3px] px-1 py-[8px] text-[10px] font-semibold"}`}><n.Icon size={20} stroke={1.7} className="flex-none" /><span data-crm-label="1" className="leading-none">{n.label}</span></Link>)}
          </nav>
          <div className="flex-1" />
          <div className={`mb-2 px-2 ${wide ? "" : "text-center"}`}>
            <div title={accessText} className={`${wide ? "flex items-center gap-2 rounded-[6px] px-2 py-[6px] text-[11px] leading-[1.3]" : "mx-auto flex h-7 w-7 items-center justify-center rounded-full"} ${boot.me.access === "readonly" ? "bg-red text-white" : "bg-white/10 text-white/70"}`}><IconLock size={13} className="flex-none" />{wide && <span>{accessText}</span>}</div>
          </div>
          <button type="button" onClick={() => setPref(SIDE_LS, wide ? "0" : "1")} title={wide ? c.nav.collapse : c.nav.expand} className={`mx-2 flex h-8 cursor-pointer items-center rounded-[6px] text-white/60 hover:bg-white/10 hover:text-white ${wide ? "gap-3 px-3 text-[12px]" : "justify-center"}`}>{wide ? <IconLayoutSidebarLeftCollapse size={18} /> : <IconLayoutSidebarLeftExpand size={18} />}{wide && <span>{c.nav.collapse}</span>}</button>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-[62px] z-20 flex h-12 items-center gap-2 border-b border-line bg-surface px-4">
            <div data-crm-mobnav="1" className="hidden gap-1 overflow-x-auto">{nav.map((n) => <Link key={n.key} href={n.href} className={`flex h-8 w-8 flex-none items-center justify-center rounded-[6px] ${n.active ? "bg-ink text-white" : "text-muted"}`}><n.Icon size={17} /></Link>)}</div>
            <div className="text-[15px] font-semibold text-ink">{nav.find((n) => n.active)?.label ?? c.title}</div>
            <div className="relative ml-2 w-[320px] max-w-[40vw]">
              <IconSearch size={14} className="absolute left-[9px] top-1/2 -translate-y-1/2 text-muted" />
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); }} placeholder={c.nav.search} className="h-8 w-full rounded-[6px] border border-line bg-surface pl-7 pr-2 text-[13px] text-ink outline-none focus:border-blue focus:ring-2 focus:ring-blue/15" />
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
          <div className="px-4 py-4">{page}</div>
        </div>
      </div>

      {boot.me.access === "readonly" && <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2 rounded-full bg-red px-4 py-2 text-[12px] font-bold text-white shadow-lg">{c.readonly}</div>}
      <ClientModal open={create === "client"} client={null} onClose={() => setCreate("")} onSaved={(id) => { setCreate(""); router.push(`${base}/c/${id}`); }} onOpenDup={(id) => { setCreate(""); router.push(`${base}/c/${id}`); }} />
      <CreateDealHost open={create === "deal"} onClose={() => setCreate("")} clients={clients} setClients={setClients} base={base} />
      <CreateTaskHost open={create === "task"} onClose={() => setCreate("")} clients={clients} setClients={setClients} />
    </CrmCtx.Provider>
  );
}

// модалки «Создать сделку/задачу» из шапки: список клиентов подгружается при открытии
import { listClients } from "@/app/crm/actions";
function useClientOpts(open: boolean, clients: { id: string; name: string }[], setClients: (v: { id: string; name: string }[]) => void) {
  useEffect(() => { if (open && !clients.length) listClients({}).then((l) => setClients(l.map((x) => ({ id: x.id, name: x.name })))).catch(() => {}); }, [open, clients.length, setClients]);
}
function CreateDealHost({ open, onClose, clients, setClients, base }: { open: boolean; onClose: () => void; clients: { id: string; name: string }[]; setClients: (v: { id: string; name: string }[]) => void; base: string }) {
  useClientOpts(open, clients, setClients);
  const router = useRouter();
  return <DealModal open={open && clients.length > 0} deal={null} clients={clients} onClose={onClose} onSaved={() => { onClose(); router.push(`${base}/deals`); router.refresh(); }} />;
}
function CreateTaskHost({ open, onClose, clients, setClients }: { open: boolean; onClose: () => void; clients: { id: string; name: string }[]; setClients: (v: { id: string; name: string }[]) => void }) {
  useClientOpts(open, clients, setClients);
  const router = useRouter();
  return <TaskModal open={open} task={null} clients={clients} onClose={onClose} onSaved={() => { onClose(); router.refresh(); }} />;
}
