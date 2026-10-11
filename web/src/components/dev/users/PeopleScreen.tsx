"use client";

// §1.13 «Пользователи: все люди» (prototype lines 991–1014; data 3290–3302).
import { useState } from "react";
import { IconBuilding, IconShieldLock, IconUserOff, IconUserPlus } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { toggleUserActive, useDev } from "@/store/dev";
import { UserModal } from "./UserModal";
import { useAdminCoId, DarkButton, InactiveBadge, RoleChip, SearchInput, UserRowActions, UsersTabs, inits, useRoleFlags } from "./shared";

export function PeopleScreen() {
  const { t } = useDevT();
  const CO = t.co;
  const { companies, users } = useDev();
  const { showUsersTabs, isAdminView } = useRoleFlags();
  const adminCoId = useAdminCoId();
  const [search, setSearch] = useState("");
  const [modal, setModal] = useState<{ coId: number | null; editId: number | null } | null>(null);

  const companyName = (id: number) => companies.find((c) => c.id === id)?.name ?? `#${id}`;
  const q = search.trim().toLowerCase();
  const view = q ? users.filter((u) => `${u.fio || ""} ${u.mail || ""}`.toLowerCase().includes(q)) : users;

  return (
    <>
      {showUsersTabs && <UsersTabs active="people" />}
      <div className="mb-4 flex flex-wrap items-end gap-[14px]">
        <div className="min-w-[200px] flex-1">
          <h1 className="mb-[6px] text-[28px] font-extrabold tracking-[-.02em] text-ink">{CO.people_title}</h1>
          <div className="text-[13.5px] text-text-2">{CO.people_sub} · {users.length} {CO.people_count}</div>
        </div>
        <DarkButton onClick={() => setModal({ coId: isAdminView ? adminCoId : null, editId: null })}><IconUserPlus size={17} /> {CO.add_user}</DarkButton>
      </div>
      <SearchInput value={search} onChange={setSearch} placeholder={CO.search_people} className="mb-[18px]" />

      {view.length === 0 && (
        <div className="px-5 py-[50px] text-center text-[14.5px] text-muted"><IconUserOff size={30} className="mx-auto mb-[10px] block opacity-55" />{CO.no_people}</div>
      )}
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
        {view.map((u) => (
          <div key={u.id} className="flex flex-wrap items-center gap-[13px] border-b border-[#f0f2f6] px-4 py-[13px] hover:bg-bg-5" style={{ opacity: u.active === false ? 0.5 : 1 }}>
            <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-blue-tint text-[13.5px] font-extrabold text-blue">{inits(u.fio)}</div>
            <div className="min-w-0 flex-1">
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14.5px] font-bold text-ink">
                {u.fio}
                {u.active === false && <InactiveBadge label={CO.inactive_badge} />}
                {u.platform && <span className="ml-1 inline-flex items-center rounded-[6px] bg-blue-tint px-[7px] py-[2px] text-[11px] font-bold text-blue"><IconShieldLock size={12} className="mr-[3px]" />{CO.plat_badge}</span>}
              </div>
              <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[12px] text-muted">{u.mail}</div>
            </div>
            <RoleChip role={u.role} />
            <div className="flex flex-none flex-wrap gap-[5px]">
              {(u.companyIds || []).map((id) => (
                <span key={id} className="inline-flex items-center whitespace-nowrap rounded-[7px] bg-bg-2 px-[9px] py-1 text-[11.5px] font-semibold text-text-2"><IconBuilding size={12} className="mr-[3px] opacity-70" />{companyName(id)}</span>
              ))}
            </div>
            <UserRowActions user={u} onEdit={() => setModal({ coId: (u.companyIds || [])[0] ?? null, editId: u.id })} onToggle={() => toggleUserActive(u.id)} />
          </div>
        ))}
      </div>

      {modal && <UserModal key={`${modal.editId ?? "new"}-${modal.coId ?? 0}`} coId={modal.coId} editId={modal.editId} onClose={() => setModal(null)} />}
    </>
  );
}
