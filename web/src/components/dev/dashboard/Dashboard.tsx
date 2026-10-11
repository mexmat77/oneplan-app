"use client";

// Dashboard — prototype `OnePlan v2.dc.html` lines 266–407 (`isDashboard`), data 3795–3841. Spec §1.5, §5.9.
import {
  IconBuildingCommunity, IconBuildingSkyscraper, IconCircleCheck, IconEye, IconEyeOff, IconHome, IconLayoutGrid, IconRuler2, IconTag, IconUsers,
} from "@tabler/icons-react";
import Link from "next/link";
import { useDevT } from "@/i18n/dev";
import { buildNotifs } from "@/lib/dev/notifs";
import { useRates } from "@/lib/rates";
import { scopedProjects, useDev } from "@/store/dev";
import { DevIcon } from "@/components/dev/DevIcon";
import { ByObjects } from "./ByObjects";
import { buildDash } from "./dashModel";

const KPI_ICON = { tag: IconTag, home: IconHome, ruler: IconRuler2 };
const PUB_ICON = { eye: IconEye, "eye-off": IconEyeOff, users: IconUsers, building: IconBuildingSkyscraper };
const card = "rounded-[20px] border border-[#edeff4] bg-surface px-6 py-[22px] shadow-[0_1px_2px_rgba(20,36,63,.04)]";

export function Dashboard() {
  const { t, tt } = useDevT();
  const s = useDev();
  const L = t.dash;
  const role = s.viewRole;
  const dIsAdmin = role === "superadmin" || role === "admin";
  const dIsEditor = role === "editor";
  const rates = useRates();
  const m = buildDash(t, scopedProjects(s), s.units, s.companies, s.users, role, rates);
  const activity = buildNotifs(tt, s.notifReadIds, s.notifCleared).slice(0, 6);
  const roles = t.roles as Record<string, string>;

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-[14px]">
        <div>
          <h1 className="mb-[5px] text-[28px] font-extrabold tracking-[-0.02em] text-ink">{L.title}</h1>
          <div className="text-[13px] text-text-2">{L.sub} · {roles[role]}</div>
        </div>
      </div>

      {/* KPI (274–284) */}
      <div className="mb-4 grid gap-[14px]" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(270px,1fr))" }}>
        {m.kpis.map((k) => {
          const Icon = KPI_ICON[k.icon];
          return (
            <div key={k.icon} className="flex items-center gap-4 rounded-[20px] border border-[#edeff4] bg-surface px-[22px] py-5 shadow-[0_1px_2px_rgba(20,36,63,.04)]">
              <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[15px] text-[24px]" style={{ background: k.bg, color: k.tone }}><Icon size={24} /></span>
              <div className="min-w-0">
                <div className="whitespace-nowrap text-[24px] font-extrabold leading-[1.05] tracking-[-0.02em] text-ink [font-variant-numeric:tabular-nums]">{k.val}</div>
                <div className="mt-[7px] overflow-hidden text-ellipsis whitespace-nowrap text-[13px] font-semibold text-muted">{k.label}</div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Units by status (286–309) */}
      <div className="mb-4">
        <div className={card}>
          <div className="mb-5 flex flex-wrap items-center gap-[18px]">
            <span className="text-[15px] font-extrabold text-ink">{L.statuses}</span>
            <span className="flex-1" />
            {m.statMeta.map((x) => (
              <span key={x.icon} className="inline-flex items-baseline gap-[6px] text-[14px] font-extrabold text-ink">
                <span className="relative top-[2px] text-[#a2abb8]">{x.icon === "objects" ? <IconBuildingCommunity size={16} /> : <IconLayoutGrid size={16} />}</span>{x.val} <span className="text-[12.5px] font-semibold text-[#a2abb8]">{x.word}</span>
              </span>
            ))}
          </div>
          <div className="mb-[22px] flex h-4 gap-[2px] overflow-hidden rounded-[8px] bg-bg-2">
            {m.segs.map((sg) => <div key={sg.key} className="h-full" style={{ background: sg.color, width: `${sg.width}%` }} />)}
          </div>
          <div className="grid gap-x-[30px] gap-y-[15px]" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(190px,1fr))" }}>
            {m.segs.map((sg) => (
              <div key={sg.key} className="flex items-center gap-[11px]">
                <span className="h-[11px] w-[11px] flex-none rounded-[3px]" style={{ background: sg.color }} />
                <span className="flex-1 text-[13.5px] text-text">{sg.label}</span>
                <span className="text-[16px] font-extrabold text-ink [font-variant-numeric:tabular-nums]">{sg.count}</span>
                <span className="w-10 text-right text-[12px] text-[#98a1af]">{sg.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="grid items-start gap-4" style={{ gridTemplateColumns: "1.5fr 1fr" }} data-dash-cols>
        <ByObjects dvis={m.dvis} byObj={m.byObj} />

        <div className="flex flex-col gap-4">
          {/* Publication & team (351–363) — superadmin / admin */}
          {dIsAdmin && (
            <div className={card}>
              <div className="mb-4 text-[15px] font-extrabold text-ink">{L.pub}</div>
              <div className="grid grid-cols-2 gap-3">
                {m.pub.map((p) => {
                  const Icon = PUB_ICON[p.icon];
                  return (
                    <div key={p.icon} className="flex items-center gap-[11px]">
                      <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] text-[19px]" style={{ background: p.bg, color: p.tone }}><Icon size={19} /></span>
                      <div><div className="text-[20px] font-extrabold leading-none text-ink">{p.val}</div><div className="mt-[3px] text-[11.5px] text-muted">{p.label}</div></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Content needs attention (365–384) — editor */}
          {dIsEditor && (
            <div className={card}>
              <div className="mb-4 text-[15px] font-extrabold text-ink">{L.content}</div>
              {m.content.length === 0 && (
                <div className="flex items-center gap-3 px-[2px] py-2">
                  <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[12px] bg-green-tint text-[21px] text-green"><IconCircleCheck size={21} /></span>
                  <div><div className="text-[14px] font-extrabold text-ink">{L.content_ok}</div><div className="mt-[2px] text-[12px] text-[#98a1af]">{L.content_ok_sub}</div></div>
                </div>
              )}
              <div className="flex flex-col gap-[11px]">
                {m.content.map((c) => (
                  <div key={c.name} className="flex flex-wrap items-center gap-[10px]">
                    <span className="h-2 w-2 flex-none rounded-full bg-amber" />
                    <span className="min-w-[120px] flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-bold text-ink">{c.name}</span>
                    <div className="flex flex-wrap gap-[6px]">{c.tags.map((tg) => <span key={tg} className="whitespace-nowrap rounded-[7px] bg-[#fdf3d7] px-[9px] py-[3px] text-[11px] font-bold text-[#b7791f]">{tg}</span>)}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent activity (386–404) */}
          <div className={card}>
            <div className="mb-3 flex items-center justify-between">
              <div className="text-[15px] font-extrabold text-ink">{L.activity}</div>
              <Link href="/dev/notifications" className="cursor-pointer text-[12.5px] font-bold text-blue hover:underline">{L.activity_all}</Link>
            </div>
            {activity.length > 0 && (
              <div className="flex flex-col">
                {activity.map((n) => (
                  <div key={n.id} className="flex items-start gap-3 px-[2px] py-3">
                    <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] text-[16px]" style={{ background: n.iconBg, color: n.iconFg }}><DevIcon icon={n.icon} size={16} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13px] leading-[1.45] text-[#3c4759]"><b className="text-ink">{n.who}</b> {n.ev} <b className="text-ink">{n.obj}</b> {n.unit}{n.extra}</div>
                      <div className="mt-[2px] text-[11.5px] text-[#98a1af]">{n.ago}</div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
