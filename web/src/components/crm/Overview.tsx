"use client";

// CRM v2 — обзор: показатели за неделю/месяц, воронка по этапам, задачи на сегодня, последние заявки, недавние клиенты.
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { IconArrowUpRight, IconCalendarEvent, IconCheck, IconInbox, IconTrendingUp, IconUsers } from "@tabler/icons-react";
import { crmOverview, doneTask, type Overview as Ov } from "@/app/crm/actions";
import { useI18n } from "@/i18n/provider";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { cacheGet, cacheSet, card, fmtDT, fmtDate, initials, sourceName, stageName, taskKindName, useCrm } from "./crmUi";

const sumStr = (m: Record<string, number>) => Object.entries(m).map(([cur, v]) => fmt(v, cur as Currency)).join(" · ") || "—";

export function Overview() {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const [ov, setOv] = useState<Ov | null>(() => cacheGet<Ov>(`${crm.base}:ov`) ?? null);
  const load = useCallback(() => { crmOverview().then((v) => setOv(cacheSet(`${crm.base}:ov`, v))).catch(() => setOv(null)); }, [crm.base]);
  useEffect(() => { load(); }, [load]);
  const me = crm.me.members.find((m) => m.id === crm.me.meId);
  if (!ov) return <div className="py-12 text-center text-[13px] text-muted">…</div>;
  const maxN = Math.max(1, ...ov.funnel.map((f) => f.n));
  const kpi = [
    { Icon: IconUsers, n: ov.clients7, l: c.ov.clients7, s: `${ov.clients30} ${c.ov.clients30} · ${ov.clientsTotal} ${c.ov.total}`, href: `${crm.base}/clients`, tone: "#4d7cfe" },
    { Icon: IconTrendingUp, n: ov.openDeals, l: c.ov.open, s: `${c.ov.openSum} ${sumStr(ov.openSum)}`, href: `${crm.base}/deals`, tone: "#7b4fd0" },
    { Icon: IconCheck, n: ov.wonMonth, l: c.ov.won, s: `${sumStr(ov.wonMonthSum)} · ${ov.lostMonth} ${c.ov.lost}`, href: `${crm.base}/deals`, tone: "#22c15e" },
    { Icon: IconCalendarEvent, n: ov.tasksToday + ov.tasksOverdue, l: c.ov.tasks, s: ov.tasksOverdue ? `${ov.tasksOverdue} ${c.ov.overdue}` : "✓", href: `${crm.base}/tasks`, tone: ov.tasksOverdue ? "#e5484d" : "#f5a623" },
  ];
  return (
    <>
      <div className="mb-3 flex items-end justify-between gap-3">
        <div><h1 className="text-[18px] font-semibold text-ink">{c.ov.hello}{me ? `, ${me.name.split(" ")[0]}` : ""}</h1><div className="text-[12.5px] text-muted">{fmtDate(new Date().toISOString(), lang)}</div></div>
      </div>
      <div className="mb-4 grid grid-cols-4 gap-3 max-[1100px]:grid-cols-2 max-md:grid-cols-1">
        {kpi.map((k) => (
          <Link key={k.l} href={k.href} className={`${card} group flex items-start gap-3 hover:border-[#b9c2d0]`}>
            <k.Icon size={18} className="mt-[2px] flex-none text-muted" />
            <div className="min-w-0 flex-1"><div className="text-[12px] text-muted">{k.l}</div><div className="mt-[2px] text-[22px] font-semibold leading-none text-ink">{k.n}</div><div className="mt-[6px] truncate text-[11.5px] text-muted">{k.s}</div></div>
            <IconArrowUpRight size={14} className="text-muted opacity-0 transition group-hover:opacity-100" />
          </Link>
        ))}
      </div>
      <div className="grid grid-cols-[1.3fr_1fr] gap-4 max-[1100px]:grid-cols-1">
        <div className="flex flex-col gap-4">
          <div className={card}>
            <div className="mb-3 flex items-center justify-between"><div className="text-[13px] font-semibold text-ink">{c.ov.funnel}</div><Link href={`${crm.base}/deals`} className="text-[12.5px] font-bold text-blue-2 hover:underline">{c.ov.all} →</Link></div>
            {ov.funnel.length === 0 ? <div className="text-[13px] text-muted">{c.ov.noFunnel}</div> : (
              <div className="flex flex-col gap-2">
                {crm.stages.filter((s) => s.kind === "open").map((s) => { const f = ov.funnel.find((x) => x.stageId === s.id) ?? { n: 0, sum: {} }; return (
                  <div key={s.id} className="grid grid-cols-[130px_1fr_auto] items-center gap-3 text-[12.5px]">
                    <span className="flex items-center gap-2 truncate font-semibold text-ink"><span className="h-[9px] w-[9px] flex-none rounded-full" style={{ background: s.color ?? "#8a93a2" }} />{stageName(s, t, lang)}</span>
                    <div className="h-[14px] overflow-hidden rounded-[3px] bg-bg-2"><div className="h-full rounded-[3px]" style={{ width: `${(f.n / maxN) * 100}%`, background: s.color ?? "#8a93a2", opacity: 0.75 }} /></div>
                    <span className="w-[150px] text-right text-muted"><b className="text-ink">{f.n}</b> · {sumStr(f.sum)}</span>
                  </div>); })}
              </div>
            )}
          </div>
          <div className={card}>
            <div className="mb-3 flex items-center justify-between"><div className="text-[13px] font-semibold text-ink">{c.ov.leads}</div></div>
            {ov.recentLeads.length === 0 ? <div className="flex items-center gap-2 text-[13px] text-muted"><IconInbox size={16} /> {c.ov.noLeads}</div> : (
              <div className="flex flex-col divide-y divide-line">
                {ov.recentLeads.map((l, i) => <Link key={i} href={`${crm.base}/c/${l.clientId}`} className="flex items-center gap-3 py-[6px] text-[13px] hover:bg-[#f7f8fa]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-2 text-[10px] font-semibold text-text">{initials(l.name)}</span><span className="min-w-0 flex-1 truncate font-semibold text-ink">{l.name}</span>{l.dup && <span className="rounded-[8px] bg-[#fff8e6] px-2 py-[2px] text-[10.5px] font-bold text-[#a16207]">{c.ov.dup}</span>}<span className="text-[12px] text-muted">{sourceName(crm.sources.find((s) => s.id === l.sourceId), t)} · {fmtDT(l.at, lang)}</span></Link>)}
              </div>
            )}
          </div>
        </div>
        <div className="flex flex-col gap-4">
          <div className={card}>
            <div className="mb-3 flex items-center justify-between"><div className="text-[13px] font-semibold text-ink">{c.ov.today}</div><Link href={`${crm.base}/tasks`} className="text-[12.5px] font-bold text-blue-2 hover:underline">{c.ov.all} →</Link></div>
            {ov.todayTasks.length === 0 ? <div className="text-[13px] text-muted">{c.ov.noToday}</div> : (
              <div className="flex flex-col gap-2">
                {ov.todayTasks.slice(0, 8).map((x) => { const over = new Date(x.dueAt) < new Date(); return (
                  <div key={x.id} className="flex items-center gap-3 text-[13px]">
                    <button type="button" onClick={async () => { try { await doneTask(x.id, true); load(); } catch { /* readonly */ } }} className="flex h-5 w-5 flex-none cursor-pointer items-center justify-center rounded-full border-2 border-line hover:border-blue" />
                    <span className="min-w-0 flex-1 truncate font-semibold text-ink">{x.title}</span>
                    <span className={`text-[11.5px] ${over ? "font-bold text-red" : "text-muted"}`}>{taskKindName(x.kind, t)} · {fmtDT(x.dueAt, lang).split(",").pop()?.trim()}</span>
                  </div>); })}
              </div>
            )}
          </div>
          <div className={card}>
            <div className="mb-3 text-[13px] font-semibold text-ink">{c.ov.recent}</div>
            <div className="flex flex-col divide-y divide-line">
              {ov.recent.map((r) => <Link key={r.id} href={`${crm.base}/c/${r.id}`} className="flex items-center gap-3 py-[6px] text-[13px] hover:bg-[#f7f8fa]"><span className="flex h-6 w-6 items-center justify-center rounded-full bg-bg-2 text-[10px] font-semibold text-text">{initials(r.name)}</span><span className="min-w-0 flex-1 truncate font-semibold text-ink">{r.name}</span><span className="text-[12px] text-muted">{fmtDT(r.updatedAt, lang)}</span></Link>)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
