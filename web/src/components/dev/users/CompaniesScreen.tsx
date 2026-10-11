"use client";

// §1.12 «Пользователи: список компаний» (prototype lines 937–989; data 3208–3245, 3296–3305).
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  IconAlertTriangle, IconBuildingCommunity, IconBuildingOff, IconCalendarCheck, IconChevronRight, IconEye, IconEyeOff, IconInfinity,
  IconLayoutGrid, IconList, IconPlus, IconUserCog, IconUsers,
} from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { coExpired } from "@/lib/dev/data";
import { setShowInactiveCo, useDev } from "@/store/dev";
import { CompanyModal } from "./CompanyModal";
import { DarkButton, SearchInput, UsersTabs, fmtUntil, inits, useRoleFlags } from "./shared";

export function CompaniesScreen() {
  const { t, lang } = useDevT();
  const CO = t.co;
  const router = useRouter();
  const { companies, users, showInactiveCo } = useDev();
  const { showUsersTabs } = useRoleFlags();
  const [search, setSearch] = useState("");
  const [mode, setMode] = useState<"cards" | "list">("cards");
  const [addOpen, setAddOpen] = useState(false);

  const all = companies.map((c) => {
    const team = users.filter((u) => (u.companyIds || []).includes(c.id) && !u.platform);
    const adm = team.find((u) => u.role === "admin");
    const unlim = !c.until, exp = coExpired(c.until);
    return {
      ...c, initials: inits(c.name), active: c.active !== false,
      objectsLabel: `${c.objIds.length} ${CO.objects}`, usersLabel: `${team.length} ${CO.users}`, adminName: adm ? adm.fio : "—",
      accessBadge: unlim ? CO.access_unlimited : exp ? CO.access_expired : `${CO.access_until} ${fmtUntil(c.until, lang)}`,
      accessIcon: unlim ? <IconInfinity size={14} /> : exp ? <IconAlertTriangle size={14} /> : <IconCalendarCheck size={14} />,
      accessCls: exp ? "bg-red-tint text-[#dc2626]" : "bg-green-tint text-green",
    };
  });
  const inactiveCount = all.filter((c) => !c.active).length;
  const base = showInactiveCo ? all : all.filter((c) => c.active);
  const q = search.trim().toLowerCase();
  const view = q ? base.filter((c) => `${c.name || ""} ${c.dir || ""}`.toLowerCase().includes(q)) : base;
  const open = (id: number) => { router.push(`/dev/users/companies/${id}`); };
  const modeBtn = (on: boolean) => `flex h-[34px] w-9 flex-none cursor-pointer items-center justify-center rounded-[9px] border ${on ? "border-ink bg-ink text-white" : "border-line bg-surface text-muted"}`;
  const accessBadge = (c: (typeof all)[number]) => (
    <span className={`inline-flex flex-none items-center gap-[5px] whitespace-nowrap rounded-[8px] px-[10px] py-[5px] text-[12px] font-semibold ${c.accessCls}`}>{c.accessIcon}{c.accessBadge}</span>
  );

  return (
    <>
      {showUsersTabs && <UsersTabs active="companies" />}
      <div className="mb-4 flex flex-wrap items-end gap-[14px]">
        <div className="min-w-[200px] flex-1">
          <h1 className="mb-[6px] text-[28px] font-extrabold tracking-[-.02em] text-ink">{CO.title}</h1>
          <div className="text-[13.5px] text-text-2">{CO.sub}</div>
        </div>
        <DarkButton onClick={() => setAddOpen(true)}><IconPlus size={17} /> {CO.add_co}</DarkButton>
      </div>
      <div className="mb-[18px] flex flex-wrap items-center gap-[10px]">
        <SearchInput value={search} onChange={setSearch} placeholder={CO.search_co} className="min-w-[220px] flex-1" />
        {inactiveCount > 0 && (
          <button type="button" onClick={() => setShowInactiveCo(!showInactiveCo)} className={`inline-flex flex-none cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[11px] border px-[14px] py-[11px] text-[13px] font-semibold ${showInactiveCo ? "border-ink bg-ink text-white" : "border-line bg-surface text-text-2"}`}>
            <IconEye size={16} /> {showInactiveCo ? CO.hide_hidden : CO.show_hidden} ({inactiveCount})
          </button>
        )}
        <div className="flex flex-none gap-[6px]">
          <button type="button" onClick={() => setMode("cards")} className={modeBtn(mode === "cards")}><IconLayoutGrid size={17} /></button>
          <button type="button" onClick={() => setMode("list")} className={modeBtn(mode === "list")}><IconList size={17} /></button>
        </div>
      </div>

      {view.length === 0 && (
        <div className="px-5 py-[50px] text-center text-[14.5px] text-muted"><IconBuildingOff size={30} className="mx-auto mb-[10px] block opacity-55" />{CO.no_co}</div>
      )}

      {mode === "cards" && (
        <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(300px,1fr))" }}>
          {view.map((c) => (
            <div key={c.id} onClick={() => open(c.id)} className="flex cursor-pointer flex-col gap-[14px] rounded-[16px] border border-line bg-surface px-[19px] py-[18px] hover:border-[#cdd7ea] hover:shadow-[0_12px_30px_rgba(20,36,63,.1)]" style={{ opacity: c.active ? 1 : 0.5 }}>
              <div className="flex items-center gap-[13px]">
                <div className="flex h-12 w-12 flex-none items-center justify-center rounded-[13px] text-[17px] font-extrabold tracking-[.02em] text-white" style={{ background: "linear-gradient(135deg,#4d7cfe,#7b4fd0)" }}>{c.initials}</div>
                <div className="min-w-0">
                  <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[16px] font-extrabold text-ink">{c.name}</div>
                  <div className="flex items-center overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-muted"><IconUserCog size={14} className="mr-[3px] flex-none" />{c.dir}</div>
                </div>
              </div>
              <div className="flex flex-wrap gap-[9px]">
                <span className="inline-flex items-center gap-[5px] rounded-[8px] bg-blue-tint px-[10px] py-[5px] text-[12.5px] font-semibold text-blue"><IconBuildingCommunity size={14} /> {c.objectsLabel}</span>
                <span className="inline-flex items-center gap-[5px] rounded-[8px] bg-green-tint px-[10px] py-[5px] text-[12.5px] font-semibold text-green"><IconUsers size={14} /> {c.usersLabel}</span>
                {!c.active && <span className="inline-flex items-center gap-[5px] rounded-[8px] bg-red-tint px-[10px] py-[5px] text-[12.5px] font-bold text-[#dc2626]"><IconEyeOff size={14} /> {CO.co_inactive_badge}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-2 border-t border-dashed border-[#eef0f4] pt-3">
                <div className="min-w-0 flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-text-2"><span className="font-semibold text-muted">{CO.admin_of}:</span> {c.adminName}</div>
                {accessBadge(c)}
              </div>
            </div>
          ))}
        </div>
      )}

      {mode === "list" && view.length > 0 && (
        <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
          {view.map((c) => (
            <div key={c.id} onClick={() => open(c.id)} className="flex cursor-pointer items-center gap-[13px] border-b border-[#f0f2f6] px-4 py-[13px] hover:bg-bg-5" style={{ opacity: c.active ? 1 : 0.5 }}>
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] text-[14px] font-extrabold text-white" style={{ background: "linear-gradient(135deg,#4d7cfe,#7b4fd0)" }}>{c.initials}</div>
              <div className="min-w-0 flex-1">
                <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14.5px] font-bold text-ink">{c.name}</div>
                <div className="flex items-center overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-muted"><IconUserCog size={13} className="mr-[3px] flex-none" />{c.dir} · {c.adminName}</div>
              </div>
              <span className="flex-none whitespace-nowrap rounded-[7px] bg-blue-tint px-[9px] py-1 text-[12.5px] font-semibold text-blue">{c.objectsLabel}</span>
              <span className="flex-none whitespace-nowrap rounded-[7px] bg-green-tint px-[9px] py-1 text-[12.5px] font-semibold text-green">{c.usersLabel}</span>
              {!c.active && <span className="inline-flex flex-none items-center whitespace-nowrap rounded-[7px] bg-red-tint px-[9px] py-1 text-[12px] font-bold text-[#dc2626]"><IconEyeOff size={13} className="mr-[3px]" />{CO.co_inactive_badge}</span>}
              {accessBadge(c)}
              <IconChevronRight size={18} className="flex-none text-[#c5cbd6]" />
            </div>
          ))}
        </div>
      )}

      {addOpen && <CompanyModal open onClose={() => setAddOpen(false)} onCreated={(cid) => { setAddOpen(false); router.push(`/dev/users/companies/${cid}`); }} />}
    </>
  );
}
