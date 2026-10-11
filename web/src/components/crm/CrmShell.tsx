"use client";

// CRM v2 — каркас: боковое меню (обзор / клиенты / сделки / задачи / настройки), строка поиска, кнопка «Создать»,
// контекст рабочего пространства. Маршруты: [] обзор, ["clients"], ["deals"], ["tasks"], ["settings", sub?], ["c", id]
// (и старые ["<uuid>"]). Во всю ширину окна под шапкой (html[data-crmmode]).
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { IconAddressBook, IconCalendarCheck, IconChevronDown, IconLayoutDashboard, IconLayoutKanban, IconLock, IconPlus, IconSearch, IconSettings, IconUsers } from "@tabler/icons-react";
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
import { CrmCtx, fill, fmtDate } from "./crmUi";

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
        <aside data-crm-side="1" className="sticky top-[62px] flex h-[calc(100vh-62px)] flex-none flex-col border-r border-line bg-surface px-3 py-4">
          <div className="mb-4 flex items-center gap-2 px-2"><span className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-ink text-white"><IconAddressBook size={17} /></span><span data-crm-label="1" className="text-[15px] font-extrabold text-ink">CRM</span></div>
          <nav className="flex flex-col gap-[2px]">
            {nav.map((n) => <Link key={n.key} href={n.href} title={n.label} className={`flex items-center gap-[10px] rounded-[10px] px-3 py-[9px] text-[13.5px] font-semibold transition ${n.active ? "bg-blue-tint text-sel-ink" : "text-text hover:bg-bg-3"}`}><n.Icon size={18} stroke={1.9} /><span data-crm-label="1">{n.label}</span></Link>)}
          </nav>
          <div className="flex-1" />
          <div data-crm-label="1" className="rounded-[10px] bg-bg-2 px-3 py-[10px] text-[11.5px] leading-[1.4] text-muted">
            <div className="mb-1 flex items-center gap-1 font-bold text-text"><IconLock size={12} /> {c.title}</div>
            {boot.me.access === "readonly" ? <span className="font-semibold text-red">{c.readonly}</span> : boot.me.paidTo ? fill(c.paidTo, { date: fmtDate(boot.me.paidTo, lang) }) : boot.me.trialUntil ? fill(c.trial, { date: fmtDate(boot.me.trialUntil, lang) }) : null}
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          <div className="sticky top-[62px] z-20 flex items-center gap-2 border-b border-line bg-surface/95 px-[clamp(12px,2vw,24px)] py-[10px] backdrop-blur">
            <div data-crm-mobnav="1" className="hidden gap-1 overflow-x-auto">{nav.map((n) => <Link key={n.key} href={n.href} className={`flex h-9 w-9 flex-none items-center justify-center rounded-[9px] ${n.active ? "bg-blue-tint text-sel-ink" : "text-muted"}`}><n.Icon size={18} /></Link>)}</div>
            <div className="relative min-w-[160px] max-w-[460px] flex-1">
              <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
              <input ref={searchRef} value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") submitSearch(); }} placeholder={c.nav.search} className="w-full rounded-[10px] border border-line bg-bg-2 py-[8px] pl-9 pr-3 text-[13px] text-ink outline-none focus:border-blue focus:bg-surface" />
            </div>
            <div className="flex-1" />
            <div className="relative">
              <button type="button" disabled={ro} onClick={() => setMenu((v) => !v)} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] bg-blue-2 px-[14px] py-[8px] text-[13px] font-bold text-white hover:bg-blue-3 disabled:opacity-50"><IconPlus size={15} /> {c.nav.create} <IconChevronDown size={13} /></button>
              {menu && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-30 w-[180px] overflow-hidden rounded-[12px] border border-line bg-surface py-1 shadow-[0_14px_40px_rgba(20,36,63,.16)]" onMouseLeave={() => setMenu(false)}>
                  {([["client", c.nav.newClient], ["deal", c.nav.newDeal], ["task", c.nav.newTask]] as const).map(([k, l]) => <button key={k} type="button" onClick={() => { setMenu(false); setCreate(k); }} className="block w-full cursor-pointer px-4 py-[9px] text-left text-[13px] font-semibold text-ink hover:bg-bg-3">{l}</button>)}
                </div>
              )}
            </div>
          </div>
          <div className="px-[clamp(12px,2vw,24px)] py-[18px]">{page}</div>
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
