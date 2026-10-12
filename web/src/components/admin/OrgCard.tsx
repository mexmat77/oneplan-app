"use client";

// Карточка организации (12.10.2026): реквизиты + команда (`OrgTeam`). Используется в «Управление → Организации»
// (админ платформы) и в «Моё агентство» / «Команда компании» (администратор организации, `self`).
import Link from "next/link";
import { useState, useTransition } from "react";
import { IconArrowLeft, IconBuilding, IconBuildingCommunity, IconDeviceFloppy } from "@tabler/icons-react";
import { saveOrg } from "@/app/org/actions";
import { OrgTeam } from "@/components/org/OrgTeam";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { OrgView } from "@/lib/org";

const inp = "h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-[14px] outline-none focus:border-blue disabled:bg-bg-2";
const lbl = "mb-[5px] block text-[12px] font-semibold text-text-2";

export function OrgCard({ initial, self, title, sub }: { initial: OrgView; self?: boolean; title?: string; sub?: string }) {
  const { t } = useI18n();
  const o = t.org.team;
  const { kind, id } = initial.org;
  const [org, setOrg] = useState(initial.org);
  const [f, setF] = useState({ name: org.name, phone: org.phone ?? "", addr: org.addr ?? "", lic: org.lic ?? "", director: org.director ?? "" });
  const [pending, start] = useTransition();
  const dirty = f.name !== org.name || f.phone !== (org.phone ?? "") || f.addr !== (org.addr ?? "") || f.lic !== (org.lic ?? "") || f.director !== (org.director ?? "");
  const Icon = kind === "agency" ? IconBuilding : IconBuildingCommunity;
  function save() {
    start(async () => {
      try { await saveOrg(kind, { id, ...f }); setOrg({ ...org, name: f.name.trim(), phone: f.phone || null, addr: f.addr || null, lic: f.lic || null, director: f.director || null }); showToast(o.saved); }
      catch (e) { showToast((t.org.err as Record<string, string>)[(e as Error).message] ?? (e as Error).message); }
    });
  }
  return (
    <div className="flex flex-col gap-4">
      {!self && <Link href="/admin/companies" className="inline-flex w-fit items-center gap-1 text-[13px] font-semibold text-blue hover:underline"><IconArrowLeft size={14} /> {o.back}</Link>}
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-blue-tint text-blue-2"><Icon size={20} /></span>
        <div className="min-w-0 flex-1">
          <h1 className="truncate text-[22px] font-extrabold tracking-[-0.02em] text-ink">{title ?? org.name}</h1>
          <div className="text-[13px] text-text-2">{sub ?? `${o.kind[kind]} · ${initial.members.length} ${o.membersN}`}</div>
        </div>
      </div>
      <div className="rounded-[16px] border border-line bg-surface p-4">
        <div className="mb-3 text-[12px] font-bold uppercase tracking-[.06em] text-muted">{o.details}</div>
        <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
          <div><label className={lbl}>{o.orgName}</label><input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} disabled={!initial.canManage} className={inp} /></div>
          <div><label className={lbl}>{o.phone}</label><input value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} disabled={!initial.canManage} className={inp} /></div>
          <div><label className={lbl}>{o.addr}</label><input value={f.addr} onChange={(e) => setF({ ...f, addr: e.target.value })} disabled={!initial.canManage} className={inp} /></div>
          <div><label className={lbl}>{o.lic}</label><input value={f.lic} onChange={(e) => setF({ ...f, lic: e.target.value })} disabled={!initial.canManage} className={inp} /></div>
          {kind === "developer" && <div><label className={lbl}>{o.director}</label><input value={f.director} onChange={(e) => setF({ ...f, director: e.target.value })} disabled={!initial.canManage} className={inp} /></div>}
        </div>
        {initial.canManage && dirty && <div className="mt-3 flex justify-end"><button type="button" disabled={pending || !f.name.trim()} onClick={save} className="inline-flex h-9 cursor-pointer items-center gap-[6px] rounded-[10px] bg-blue-2 px-[14px] text-[13px] font-bold text-white hover:bg-blue-3 disabled:opacity-50"><IconDeviceFloppy size={15} /> {o.save}</button></div>}
      </div>
      <div className="rounded-[16px] border border-line bg-surface p-4">
        <OrgTeam kind={kind} id={id} initial={initial} />
      </div>
    </div>
  );
}
