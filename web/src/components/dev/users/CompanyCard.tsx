"use client";

// §1.14 «Карточка компании» (prototype lines 1016–1104; data 3246–3282). For the «admin» role this is the whole
// «Пользователи» screen (company `ADMIN_CO_ID`, no back link, no tabs).
import { coverOf } from "@/lib/dev/data";
import Link from "next/link";
import { useState } from "react";
import {
  IconArrowLeft, IconBuildingOff, IconCalendarEvent, IconChevronDown, IconCircleFilled, IconEye, IconEyeCheck, IconEyeOff, IconInfinity,
  IconUserCog, IconUserPlus,
} from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { asset, coExpired } from "@/lib/dev/data";
import type { Company, DevUser } from "@/lib/dev/types";
import { toggleCompanyActive, toggleUserActive, updateCompany, useDev } from "@/store/dev";
import { UserModal } from "./UserModal";
import { DarkButton, InactiveBadge, RoleChip, SaveBadge, UserRowActions, inits, useRoleFlags } from "./shared";

const OBJ_CAP = 6;

export function CompanyCard({ id }: { id: number }) {
  const { t } = useDevT();
  const CO = t.co;
  const stages = t.stages as Record<string, string>;
  const reasons = CO.reasons as Record<string, string>;
  const { companies, users, projects } = useDev();
  const { canEditAccess, showCoBack } = useRoleFlags();
  const [showAll, setShowAll] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const [modal, setModal] = useState<{ coId: number | null; editId: number | null } | null>(null);

  const co = companies.find((c) => c.id === id);
  if (!co) {
    return (
      <>
        {showCoBack && <BackLink label={CO.back} />}
        <div className="px-5 py-[50px] text-center text-[14.5px] text-muted"><IconBuildingOff size={30} className="mx-auto mb-[10px] block opacity-55" />{CO.no_co}</div>
      </>
    );
  }

  const coActive = co.active !== false;
  const expired = coExpired(co.until);
  const set = (k: keyof Company, v: string) => updateCompany(co.id, { [k]: v });
  const objName = (oid: number) => projects.find((p) => p.id === oid)?.name ?? `#${oid}`;
  const accessLabel = (u: DevUser) => (u.role === "client" ? (u.access === "all" ? CO.all_objects : Array.isArray(u.access) ? u.access.map(objName).join(", ") : "—") : CO.all_co_objects);

  const objAll = co.objIds.map((oid) => {
    const p = projects.find((x) => x.id === oid);
    const hidden = p?.stage === "done" || !!p?.hidden || !coActive;
    const reason = !coActive ? reasons.co : p?.hideReason ? reasons[p.hideReason] : p?.stage === "done" ? CO.completed : "";
    return { id: oid, name: p?.name ?? `#${oid}`, stageLabel: p?.stage ? stages[p.stage] : "", cover: p ? coverOf(p) : "", hidden, reason };
  });
  const objActive = objAll.filter((o) => !o.hidden);
  const objHidden = objAll.filter((o) => o.hidden);
  const team = users.filter((u) => (u.companyIds || []).includes(co.id) && !u.platform);

  const pill = (ok: boolean, label: string) => (
    <span className={`inline-flex items-center gap-[6px] rounded-[20px] px-3 py-[6px] text-[12.5px] font-bold ${ok ? "bg-green-tint text-green" : "bg-red-tint text-[#dc2626]"}`}><IconCircleFilled size={9} />{label}</span>
  );
  const field = (label: string, key: keyof Company, placeholder?: string, full = false) => (
    <div style={full ? { gridColumn: "1/-1" } : undefined}>
      <label className="mb-[5px] block text-[12.5px] text-text-2">{label}</label>
      <input value={(co[key] as string) || ""} onChange={(e) => set(key, e.target.value)} placeholder={placeholder} className="box-border w-full rounded-[10px] border border-line px-3 py-[10px] text-[14px] text-ink outline-none focus:border-blue" />
    </div>
  );
  const objCard = (o: (typeof objAll)[number], hidden: boolean) => (
    <Link key={o.id} href={`/dev/objects/${o.id}`} className={`flex cursor-pointer items-center gap-[11px] rounded-[13px] border border-line bg-surface p-[10px] hover:border-[#cdd7ea] ${hidden ? "relative opacity-[.62] hover:opacity-100" : "hover:shadow-[0_6px_18px_rgba(20,36,63,.07)]"}`}>
      <div className="h-[52px] w-[52px] flex-none overflow-hidden rounded-[10px] bg-[#e7eaf0]">{o.cover && <img src={o.cover} alt="" loading="lazy" className="h-full w-full object-cover" style={hidden ? { filter: "grayscale(.4)" } : undefined} />}</div>
      <div className="min-w-0">
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[13.5px] font-bold text-ink">{o.name}</div>
        {hidden
          ? <div className="mt-[3px] inline-flex items-center rounded-[6px] bg-[#eef1f5] px-[7px] py-[2px] text-[11px] font-bold text-muted"><IconEyeOff size={12} className="mr-[3px]" />{CO.hidden_badge} · {o.reason}</div>
          : <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-muted">{o.stageLabel}</div>}
      </div>
    </Link>
  );
  const grid = { gridTemplateColumns: "repeat(auto-fill,minmax(230px,1fr))" };

  return (
    <>
      {showCoBack && <BackLink label={CO.back} />}
      <div className="mb-6 flex flex-wrap items-center gap-4">
        <div className="flex h-[60px] w-[60px] flex-none items-center justify-center rounded-[16px] text-[22px] font-extrabold text-white" style={{ background: "linear-gradient(135deg,#4d7cfe,#7b4fd0)" }}>{inits(co.name)}</div>
        <div>
          <h1 className="mb-[3px] text-[26px] font-extrabold tracking-[-.02em] text-ink">{co.name}</h1>
          <div className="flex items-center text-[13.5px] text-text-2"><IconUserCog size={15} className="mr-1" />{CO.director}: {co.dir}</div>
        </div>
        <div className="flex-1" />
        {canEditAccess && <SaveBadge />}
      </div>

      {canEditAccess && (
        <>
          <div className="mb-4 rounded-[14px] border border-line bg-surface px-[19px] py-[18px]">
            <h3 className="mb-[5px] text-[15px] font-extrabold text-ink">{CO.cp_title}</h3>
            <div className="mb-4 text-[12.5px] text-muted">{CO.cp_desc}</div>
            <div className="grid gap-[13px]" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
              {field(CO.cp_contact, "dir")}
              {field(CO.cp_phone, "phone", "+90 ___ ___ __ __")}
              {field(CO.cp_mail, "mail", "info@company.com")}
              {field(CO.cp_web, "web", "company.com")}
              {field(CO.cp_vergi, "vergi", "1234567890")}
              {field(CO.cp_addr, "addr", "Cadde, No, İlçe / İl", true)}
            </div>
          </div>
          <div className="mb-6 rounded-[14px] border border-line bg-surface px-[19px] py-[18px]">
            <div className="mb-[5px] flex flex-wrap items-center gap-3">
              <h3 className="min-w-0 flex-1 text-[15px] font-extrabold text-ink">{CO.access_title}</h3>
              {pill(!expired, expired ? CO.access_expired : CO.access_active)}
            </div>
            <div className="mb-[14px] text-[12.5px] text-muted">{CO.access_desc}</div>
            <div className="flex flex-wrap items-center gap-3">
              <button type="button" onClick={() => updateCompany(co.id, { until: "" })} className={`inline-flex cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[10px] border px-[13px] py-[9px] text-[13px] font-semibold ${!co.until ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-text-2"}`}><IconInfinity size={16} /> {CO.access_unlimited}</button>
              <div className={`inline-flex items-center gap-[9px] rounded-[10px] border px-[11px] py-[6px] ${co.until ? "border-blue bg-blue-tint" : "border-line bg-surface"}`}>
                <label className="flex items-center whitespace-nowrap text-[13px] text-text-2"><IconCalendarEvent size={15} className="mr-[5px]" />{CO.access_until}</label>
                <input type="date" value={co.until || ""} onChange={(e) => updateCompany(co.id, { until: e.target.value })} className="rounded-[8px] border border-line bg-surface px-[10px] py-[7px] text-[14px] text-ink outline-none focus:border-blue" />
              </div>
            </div>
          </div>
          <div className="mb-6 flex flex-wrap items-center gap-4 rounded-[14px] border border-line bg-surface px-[19px] py-[18px]">
            <div className="min-w-[200px] flex-1">
              <div className="mb-[5px] flex flex-wrap items-center gap-[10px]"><h3 className="text-[15px] font-extrabold text-ink">{CO.co_vis_title}</h3>{pill(coActive, coActive ? CO.co_act_state : CO.co_inact_state)}</div>
              <div className="text-[12.5px] text-muted">{CO.co_vis_desc}</div>
            </div>
            <button type="button" onClick={() => toggleCompanyActive(co.id)} className={`inline-flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[10px] border px-[15px] py-[9px] text-[13.5px] font-bold ${coActive ? "border-[#f0b8b8] bg-surface text-[#dc2626]" : "border-green bg-green text-white"}`}>
              {coActive ? <IconEyeOff size={16} /> : <IconEyeCheck size={16} />} {coActive ? CO.co_deact : CO.co_act}
            </button>
          </div>
        </>
      )}

      <h3 className="mb-3 text-[15px] font-extrabold text-ink">{CO.co_objects}</h3>
      <div className="mb-[10px] grid gap-3" style={grid}>{(showAll ? objActive : objActive.slice(0, OBJ_CAP)).map((o) => objCard(o, false))}</div>
      {objActive.length > OBJ_CAP && (
        <button type="button" onClick={() => setShowAll((v) => !v)} className="mb-4 inline-flex cursor-pointer items-center gap-[6px] text-[13px] font-bold text-blue"><IconChevronDown size={15} /> {showAll ? CO.co_collapse : `${CO.co_show_all} (${objActive.length})`}</button>
      )}
      {objHidden.length > 0 && (
        <div className="mb-7 mt-[6px]">
          <button type="button" onClick={() => setShowHidden((v) => !v)} className="inline-flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[9px] border border-dashed border-[#cdd5e2] bg-[#fafbfd] px-[13px] py-2 text-[13px] font-semibold text-text-2 hover:border-blue hover:text-blue"><IconEye size={15} /> {showHidden ? CO.hide_hidden : CO.show_hidden} · {CO.co_hidden_obj} ({objHidden.length})</button>
          {showHidden && <div className="mt-3 grid gap-3" style={grid}>{objHidden.map((o) => objCard(o, true))}</div>}
        </div>
      )}

      <div className="mb-3 flex items-center gap-3">
        <h3 className="flex-1 text-[15px] font-extrabold text-ink">{CO.co_team}</h3>
        <DarkButton small onClick={() => setModal({ coId: co.id, editId: null })}><IconUserPlus size={16} /> {CO.add_user}</DarkButton>
      </div>
      <div className="overflow-x-auto rounded-[14px] border border-line bg-surface">
        <table className="w-full min-w-[760px] border-separate border-spacing-0">
          <thead><tr>
            {[CO.th_role, CO.th_name, CO.th_mail, CO.th_access].map((h) => <th key={h} className="border-b border-line bg-[#fafbfd] px-[15px] py-3 text-left text-[12.5px] font-semibold text-text-2">{h}</th>)}
            <th className="border-b border-line bg-[#fafbfd]" />
          </tr></thead>
          <tbody>
            {team.map((u) => { const ea = coActive && u.active !== false; return (
              <tr key={u.id} className="hover:bg-bg-5" style={{ opacity: ea ? 1 : 0.5 }}>
                <td className="border-b border-[#f0f2f6] px-[15px] py-3 text-[14px]"><RoleChip role={u.role} /></td>
                <td className="border-b border-[#f0f2f6] px-[15px] py-3 text-[14px] font-bold text-ink">{u.fio} {!ea && <InactiveBadge label={CO.inactive_badge} />}</td>
                <td className="border-b border-[#f0f2f6] px-[15px] py-3 text-[14px] text-text-2">{u.mail}</td>
                <td className="border-b border-[#f0f2f6] px-[15px] py-3 text-[13.5px]">{accessLabel(u)}</td>
                <td className="whitespace-nowrap border-b border-[#f0f2f6] px-[15px] py-3 text-right"><span className="inline-flex justify-end"><UserRowActions user={u} size={32} onEdit={() => setModal({ coId: co.id, editId: u.id })} onToggle={() => toggleUserActive(u.id)} /></span></td>
              </tr>
            ); })}
            {team.length === 0 && <tr><td colSpan={5} className="px-[15px] py-6 text-center text-[13.5px] text-muted">{CO.empty_team}</td></tr>}
          </tbody>
        </table>
      </div>

      {modal && <UserModal key={`${modal.editId ?? "new"}-${modal.coId ?? 0}`} coId={modal.coId} editId={modal.editId} onClose={() => setModal(null)} />}
    </>
  );
}

function BackLink({ label }: { label: string }) {
  return <Link href="/dev/users" className="mb-4 inline-flex cursor-pointer items-center gap-[6px] text-[13.5px] font-semibold text-blue"><IconArrowLeft size={15} /> {label}</Link>;
}
