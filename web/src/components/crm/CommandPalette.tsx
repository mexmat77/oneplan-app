"use client";

// Cmd+K / Ctrl+K (12.10.2026, стандарт Linear/Attio/Notion): поиск клиентов, переходы по разделам, создание, настройки.
// Стрелки/Enter/Esc, подсказки сочетаний; мышь тоже работает. Монтируется из CrmShell.
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { IconCalendarCheck, IconLayoutDashboard, IconLayoutKanban, IconPlus, IconSearch, IconSettings, IconUser, IconUsers } from "@tabler/icons-react";
import { listClients } from "@/app/crm/actions";
import { useI18n } from "@/i18n/provider";
import { initials, useCrm } from "./crmUi";

type Item = { id: string; group: "clients" | "go" | "create" | "settings"; label: string; sub?: string; icon: React.ReactNode; run: () => void; kbd?: string };

export function CommandPalette({ open, onClose, onCreate }: { open: boolean; onClose: () => void; onCreate: (k: "client" | "deal" | "task") => void }) {
  const { t } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const router = useRouter();
  const [q, setQ] = useState("");
  const [idx, setIdx] = useState(0);
  const [found, setFound] = useState<{ id: string; name: string; phone: string }[]>([]);
  const inp = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!open) return; const h = setTimeout(() => { if (!q.trim()) { setFound([]); return; } listClients({ q: q.trim() }).then((l) => setFound(l.slice(0, 6).map((x) => ({ id: x.id, name: x.name, phone: x.contacts.find((y) => y.isMain)?.value ?? x.contacts[0]?.value ?? "" })))).catch(() => setFound([])); }, 180); return () => clearTimeout(h); }, [q, open]);
  if (!open) return null;
  const go = (href: string) => { onClose(); router.push(href); };
  const base = crm.base;
  const low = q.trim().toLowerCase();
  const match = (s: string) => !low || s.toLowerCase().includes(low);
  const items: Item[] = [
    ...found.map((f) => ({ id: "c:" + f.id, group: "clients" as const, label: f.name, sub: f.phone, icon: <span className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-2 text-[10px] font-semibold text-text">{initials(f.name)}</span>, run: () => go(`${base}/c/${f.id}`) })),
    ...[
      { id: "go:ov", label: c.nav.overview, href: base, icon: <IconLayoutDashboard size={16} /> },
      { id: "go:cl", label: c.nav.clients, href: `${base}/clients`, icon: <IconUsers size={16} /> },
      { id: "go:dl", label: c.nav.deals, href: `${base}/deals`, icon: <IconLayoutKanban size={16} /> },
      { id: "go:tk", label: c.nav.tasks, href: `${base}/tasks`, icon: <IconCalendarCheck size={16} /> },
    ].filter((x) => match(x.label)).map((x) => ({ id: x.id, group: "go" as const, label: x.label, icon: x.icon, run: () => go(x.href) })),
    ...([["client", c.nav.newClient, "N"], ["deal", c.nav.newDeal, ""], ["task", c.nav.newTask, ""]] as const).filter((x) => match(x[1])).map((x) => ({ id: "new:" + x[0], group: "create" as const, label: x[1], icon: <IconPlus size={16} />, kbd: x[2] || undefined, run: () => { onClose(); onCreate(x[0]); } })),
    ...([["pipeline", c.setNav.pipeline], ["sources", c.setNav.sources], ["team", c.setNav.team], ["company", c.setNav.company], ["templates", c.setNav.templates], ["data", c.setNav.data]] as const).filter((x) => match(x[1]) || match(c.nav.settings)).map((x) => ({ id: "set:" + x[0], group: "settings" as const, label: `${c.nav.settings} · ${x[1]}`, icon: <IconSettings size={16} />, run: () => go(`${base}/settings/${x[0]}`) })),
  ];
  const cur = Math.min(idx, Math.max(0, items.length - 1));
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setIdx((i) => Math.min(i + 1, items.length - 1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setIdx((i) => Math.max(i - 1, 0)); }
    else if (e.key === "Enter") { e.preventDefault(); items[cur]?.run(); }
    else if (e.key === "Escape") onClose();
  };
  const groups: Item["group"][] = ["clients", "go", "create", "settings"];
  const gl: Record<Item["group"], string> = { clients: c.nav.clients, go: c.cmd.go, create: c.nav.create, settings: c.nav.settings };
  let n = -1;
  return (
    <>
      <div className="fixed inset-0 z-[600] bg-ink/30" onClick={onClose} />
      <div className="fixed left-1/2 top-[12vh] z-[610] w-[600px] max-w-[calc(100vw-24px)] -translate-x-1/2 overflow-hidden rounded-[10px] border border-line bg-surface shadow-[0_24px_80px_rgba(20,36,63,.3)]" style={{ animation: "opl-card .12s ease" }}>
        <div className="flex items-center gap-2 border-b border-line px-4"><IconSearch size={16} className="text-muted" /><input ref={inp} autoFocus value={q} onChange={(e) => { setQ(e.target.value); setIdx(0); }} onKeyDown={onKey} placeholder={c.cmd.placeholder} className="h-12 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted-2" /><kbd className="rounded-[4px] border border-line px-[6px] py-[1px] text-[10.5px] text-muted">Esc</kbd></div>
        <div className="max-h-[52vh] overflow-y-auto py-1">
          {items.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-muted">{c.cmd.noResults}</div>}
          {groups.map((g) => { const list = items.filter((x) => x.group === g); if (!list.length) return null; return (
            <div key={g} className="py-1">
              <div className="px-4 py-1 text-[10.5px] font-semibold uppercase tracking-[.05em] text-muted">{gl[g]}</div>
              {list.map((it) => { n++; const i = n; return (
                <button key={it.id} type="button" onMouseEnter={() => setIdx(i)} onClick={it.run} className={`flex w-full cursor-pointer items-center gap-3 px-4 py-[7px] text-left text-[13.5px] ${i === cur ? "bg-blue-tint text-sel-ink" : "text-ink"}`}>
                  <span className={`flex w-6 justify-center ${i === cur ? "text-sel-ink" : "text-muted"}`}>{it.icon}</span><span className="min-w-0 flex-1 truncate">{it.label}</span>{it.sub && <span className="text-[12px] text-muted">{it.sub}</span>}{it.kbd && <kbd className="rounded-[4px] border border-line px-[6px] py-[1px] text-[10.5px] text-muted">{it.kbd}</kbd>}
                </button>); })}
            </div>); })}
        </div>
        <div className="flex items-center gap-4 border-t border-line px-4 py-2 text-[11px] text-muted"><span>↑↓ {c.cmd.navigate}</span><span>↵ {c.cmd.select}</span><span className="ml-auto flex items-center gap-1"><IconUser size={12} /> {c.cmd.hint}</span></div>
      </div>
    </>
  );
}
