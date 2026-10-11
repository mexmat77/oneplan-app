"use client";

// «Все уведомления» — prototype `OnePlan v2.dc.html` lines 1199–1247 (markup), 3756–3793 (data), spec §1.17 / §5.3.
// Type filter chips with counts, groups Today / Yesterday / Earlier (mins < 900 / < 2340 / else), pages of 20,
// «mark all read», «clear» (`notifCleared`). Click on a row only marks it read.
import { confirmDialog } from "@/components/ui/confirm";
import { useState } from "react";
import { IconBellOff, IconChecks, IconChevronDown, IconTrash } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { NOTIFS } from "@/lib/dev/data";
import { buildNotifs } from "@/lib/dev/notifs";
import { clearNotifs, markNotifRead, useDev } from "@/store/dev";
import { DevIcon } from "@/components/dev/DevIcon";
import { NtfIcon } from "@/components/ntf/NtfIcon";
import { useI18n } from "@/i18n/provider";
import { nowMs, renderNtf, useNotifs, type NtfDict } from "@/lib/notifications/client";
import { agoText } from "@/lib/dev/notifs";
import { useRouter } from "next/navigation";

const KEYS = ["all", "sold", "booked", "price", "status", "media", "doc", "newobj"];
const dayOf = (m: number) => (m < 900 ? 0 : m < 2340 ? 1 : 2);

export function NotifsScreen({ meId = null }: { meId?: string | null }) {
  const { t, tt } = useDevT();
  const { t: tr } = useI18n();
  const router = useRouter();
  const s = useDev();
  const live = useNotifs(meId);
  const [filter, setFilter] = useState("all");
  const [lim, setLim] = useState(20);
  const nf = tt.nf as Record<string, string>;

  const liveBase = live.rows.map((r) => renderNtf(r, tr.ntfk as unknown as NtfDict)).map((v) => { const mins = Math.floor((nowMs() - v.at.getTime()) / 60000); return { id: v.id, type: v.kind, mins, who: "", init: "", color: "", icon: v.icon, iconFg: v.tone, iconBg: v.bg, ev: v.title, obj: v.sub, unit: "", extra: "", ago: agoText(mins, tt), unread: v.unread, href: v.href }; });
  const base = meId ? liveBase : buildNotifs(tt, s.notifReadIds, s.notifCleared).map((n) => ({ ...n, href: null as string | null }));
  const readAll = () => { if (meId) void live.markAll(); else markNotifRead(base.map((n) => n.id)); };
  const clearAllN = () => { if (meId) void confirmDialog({ text: `${tr.ntf.clear}?`, ok: tr.ntf.clear, danger: true }).then((ok) => { if (ok) void live.clearAll(); }); else clearNotifs(); };
  const readOne = (id: number, href: string | null) => { if (meId) void live.markRead([id]); else markNotifRead([id]); if (href) router.push(href); };
  const unread = base.filter((n) => n.unread).length;
  const filtered = base.filter((n) => filter === "all" || n.type === filter);
  const vis = filtered.slice(0, lim);
  const hasMore = filtered.length > lim;
  const dayLabel = [tt.day_today, tt.day_yesterday, tt.day_earlier];
  const groups = [0, 1, 2].map((d) => ({ label: dayLabel[d], items: vis.filter((n) => dayOf(n.mins) === d) })).filter((g) => g.items.length > 0);
  const chips = (meId ? ["all", ...Array.from(new Set(base.map((n) => n.type)))] : KEYS.filter((k) => k === "all" || NOTIFS.some((n) => n.type === k))).map((k) => ({ key: k, label: nf[k], count: k === "all" ? base.length : base.filter((n) => n.type === k).length, active: filter === k }));

  return (
    <div className="mx-auto max-w-[820px]">
      <div className="mb-[18px] flex flex-wrap items-start gap-[14px]">
        <div className="min-w-0 flex-1">
          <h1 className="mb-[6px] text-[28px] font-extrabold tracking-[-.02em] text-ink">{tt.notif_all_title}</h1>
          <div className="text-[13px] text-text-2">{unread > 0 && <b className="text-red">{unread} {tt.notif_new_c}</b>}</div>
        </div>
        <div className="flex flex-none gap-2">
          <button type="button" onClick={readAll} className="inline-flex cursor-pointer items-center gap-[7px] rounded-[10px] border border-line bg-surface px-[14px] py-[9px] text-[13px] font-bold text-text hover:border-blue hover:text-blue"><IconChecks size={16} /> {tt.notif_all}</button>
          <button type="button" onClick={clearAllN} className="inline-flex cursor-pointer items-center gap-[7px] rounded-[10px] border border-[#f4d4d6] bg-surface px-[14px] py-[9px] text-[13px] font-bold text-red hover:bg-[#fdecef]"><IconTrash size={16} /> {tt.notif_clear}</button>
        </div>
      </div>

      <div className="mb-[18px] flex gap-2 overflow-x-auto pb-1">
        {chips.map((c) => (
          <span key={c.key} onClick={() => { setFilter(c.key); setLim(20); }} className={`inline-flex cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-full border px-[13px] py-2 text-[13px] font-semibold ${c.active ? "border-blue bg-blue text-white" : "border-line bg-surface text-text"}`}>
            {c.label} <span className={`rounded-[8px] px-[6px] py-[1px] text-[11px] font-bold [font-variant-numeric:tabular-nums] ${c.active ? "bg-[rgba(255,255,255,.22)] text-white" : "bg-line-2 text-muted"}`}>{c.count}</span>
          </span>
        ))}
      </div>

      {filtered.length === 0 && (
        <div className="rounded-[16px] border border-line bg-surface px-6 py-14 text-center">
          <span className="mx-auto mb-4 flex h-[72px] w-[72px] items-center justify-center rounded-full bg-blue-tint text-[32px] text-blue"><IconBellOff size={32} /></span>
          <div className="mb-[6px] text-[18px] font-extrabold text-ink">{tt.notif_none}</div>
          <div className="mx-auto max-w-[340px] text-[13.5px] leading-[1.5] text-[#98a1af]">{tt.notif_none_sub}</div>
        </div>
      )}

      {groups.map((g) => (
        <div key={g.label} className="mb-[22px]">
          <div className="mb-[10px] pl-1 text-[11px] font-extrabold uppercase tracking-[.08em] text-[#98a1af]">{g.label}</div>
          <div className="flex flex-col gap-[10px]">
            {g.items.map((n) => (
              <div key={n.id} onClick={() => readOne(n.id, n.href)} className="relative flex cursor-pointer items-start gap-[13px] rounded-[14px] border p-[14px] hover:border-[#c9d6ef]" style={{ borderColor: n.unread ? "#dbe6ff" : "#eef1f6", background: n.unread ? "#f5f8ff" : "#fff" }}>
                <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[12px] text-[20px]" style={{ background: n.iconBg, color: n.iconFg }}>{meId ? <NtfIcon icon={n.icon} size={20} /> : <DevIcon icon={n.icon} size={20} />}</span>
                <div className="min-w-0 flex-1">
                  <div className="text-[14.5px] leading-[1.5] text-[#3c4759]">{n.who && <b className="text-ink">{n.who} </b>}{n.ev} {n.obj && <b className="text-ink">{n.obj}</b>} {n.unit}{n.extra}</div>
                  <div className="mt-1 text-[12px] text-[#98a1af]">{n.ago}</div>
                </div>
                {n.unread && <span className="mt-[7px] h-[9px] w-[9px] flex-none rounded-full bg-blue" />}
              </div>
            ))}
          </div>
        </div>
      ))}
      {hasMore && (
        <div onClick={() => setLim(lim + 20)} className="mb-2 flex cursor-pointer select-none items-center justify-center gap-1 rounded-[12px] border border-line bg-surface p-3 text-center text-[13.5px] font-bold text-blue hover:border-[#c9d6ef] hover:bg-[#fafbff]">
          <IconChevronDown size={16} /> {t.notif_more} ({Math.min(20, filtered.length - lim)}) <span className="text-[12px] font-semibold text-[#98a1af]">· {vis.length} / {filtered.length}</span>
        </div>
      )}
    </div>
  );
}
