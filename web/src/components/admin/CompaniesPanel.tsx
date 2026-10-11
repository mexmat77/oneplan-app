"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { IconBuilding, IconBuildingCommunity, IconExternalLink, IconPencil, IconPlus, IconTrash, IconUsers } from "@tabler/icons-react";
import { Avatar } from "@/components/ui/UserMenu";
import { useI18n } from "@/i18n/provider";
import { deleteCompany, saveCompany } from "@/app/admin/actions";
import { Modal } from "./UsersTable";

export type StaffRow = { id: string; name: string; email: string | null; phone: string | null; role: string; dev_role: string | null; status: string };
export type CompanyRow = { id: string; name: string; phone: string | null; addr: string | null; lic: string | null; members?: number; staff?: StaffRow[] };
type Kind = "agencies" | "developers";
const input = "w-full rounded-[10px] border border-line px-3 py-[10px] text-[13.5px] outline-none focus:border-blue";
const label = "mb-[6px] block text-[12.5px] font-semibold text-text-2";

export function CompaniesPanel({ agencies, developers }: { agencies: CompanyRow[]; developers: CompanyRow[] }) {
  const { t, lang } = useI18n();
  const L = (ru: string, en: string, tr: string) => (lang === "RU" ? ru : lang === "TR" ? tr : en);
  const [kind, setKind] = useState<Kind>("agencies");
  const [edit, setEdit] = useState<Partial<CompanyRow> | null>(null);
  const [staffOf, setStaffOf] = useState<CompanyRow | null>(null); // список сотрудников компании (по клику на счётчик)
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, ok: string) => { setErr(""); start(async () => { try { await fn(); setToast(ok); setTimeout(() => setToast(""), 2600); } catch (e) { setErr((e as Error).message); } }); };
  const rows = kind === "agencies" ? agencies : developers;
  const tabCls = (on: boolean) => `inline-flex cursor-pointer items-center gap-[6px] rounded-[9px] px-[14px] py-[7px] text-[13px] font-semibold ${on ? "bg-surface text-ink shadow-[0_1px_3px_rgba(20,36,63,.12)]" : "text-muted hover:bg-line-2"}`;

  return (
    <>
      <div className="mb-[14px] flex flex-wrap items-center gap-2">
        <div className="flex w-fit gap-[6px] rounded-[12px] bg-line-2 p-1">
          <button type="button" onClick={() => setKind("agencies")} className={tabCls(kind === "agencies")}><IconBuilding size={15} /> {t.rl.tabA} <span className="rounded-[10px] bg-[#dfe4ec] px-[7px] py-[1px] text-[11px] font-extrabold text-text">{agencies.length}</span></button>
          <button type="button" onClick={() => setKind("developers")} className={tabCls(kind === "developers")}><IconBuildingCommunity size={15} /> {L("Застройщики", "Developers", "Geliştiriciler")} <span className="rounded-[10px] bg-[#dfe4ec] px-[7px] py-[1px] text-[11px] font-extrabold text-text">{developers.length}</span></button>
        </div>
        <span className="flex-1" />
        <button type="button" onClick={() => setEdit({})} className="inline-flex cursor-pointer items-center gap-1 rounded-[11px] bg-blue-2 px-4 py-[10px] text-[13px] font-bold text-white hover:bg-blue-3"><IconPlus size={15} /> {t.rl.agAdd}</button>
      </div>
      {err && <div className="mb-3 rounded-[11px] bg-red-tint px-[13px] py-[11px] text-[12.5px] text-red-2">{err}</div>}
      <div className="overflow-hidden rounded-[16px] border border-line bg-surface">
        {rows.length === 0 && <div className="p-[22px] text-center text-[13px] text-muted">{L("Пока пусто", "Nothing yet", "Henüz yok")}</div>}
        {rows.map((a) => (
          <div key={a.id} className="flex flex-wrap items-center gap-3 border-b border-[#f5f7fb] px-[18px] py-[13px]">
            <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] bg-blue-tint text-blue-2">{kind === "agencies" ? <IconBuilding size={17} /> : <IconBuildingCommunity size={17} />}</span>
            <div className="min-w-[180px] flex-1"><div className="text-[13.5px] font-bold text-ink">{a.name}</div><div className="text-[12px] text-muted">{[a.addr, a.phone, a.lic && `${t.rl.agLicL}: ${a.lic}`].filter(Boolean).join(" · ") || t.rl.agNoMeta}</div></div>
            <button type="button" onClick={() => setStaffOf(a)} title={L("Показать сотрудников", "Show staff", "Personeli göster")} className="inline-flex flex-none cursor-pointer items-center gap-[5px] rounded-[8px] border border-line bg-surface px-[10px] py-[5px] text-[12px] font-semibold text-text hover:border-blue hover:text-blue"><IconUsers size={13} /> {a.members ?? 0} {kind === "agencies" ? t.rl.agCnt : L("сотр.", "staff", "personel")}</button>
            <button type="button" onClick={() => setEdit(a)} className="flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-[9px] border border-line text-muted hover:border-blue hover:text-blue"><IconPencil size={14} /></button>
            <button type="button" disabled={pending || (a.members ?? 0) > 0} title={t.rl.agDelH} onClick={() => run(() => deleteCompany(kind, a.id), t.rl.agDone)} className="flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-[9px] border border-line text-muted-2 hover:border-red hover:text-red disabled:cursor-not-allowed disabled:opacity-40"><IconTrash size={14} /></button>
          </div>
        ))}
      </div>
      <div className="mt-[10px] text-[11.5px] text-muted-2">{t.rl.agDelH}</div>
      {staffOf && (
        <Modal title={staffOf.name} onClose={() => setStaffOf(null)} wide>
          <div className="mb-3 flex flex-wrap items-center gap-2 text-[12.5px] text-text-2">
            <span>{(staffOf.staff ?? []).length} {kind === "agencies" ? t.rl.agCnt : L("сотр.", "staff", "personel")}</span>
            <span className="flex-1" />
            <Link href={`/admin/users?q=${encodeURIComponent(staffOf.name)}`} className="inline-flex items-center gap-1 text-[12.5px] font-bold text-blue hover:underline"><IconExternalLink size={13} /> {L("Открыть в «Пользователях»", "Open in Users", "Kullanıcılarda aç")}</Link>
          </div>
          {(staffOf.staff ?? []).length === 0 && <div className="rounded-[12px] border border-dashed border-[#dfe4ec] p-[22px] text-center text-[13px] text-muted">{t.rl.agEmpty}</div>}
          <div className="overflow-hidden rounded-[14px] border border-line">
            {(staffOf.staff ?? []).map((p) => {
              const devRole = p.dev_role === "admin" ? L("Администратор", "Administrator", "Yönetici") : p.dev_role === "manager" ? L("Менеджер", "Manager", "Yönetici (satış)") : p.dev_role === "editor" ? L("Редактор", "Editor", "Editör") : "";
              const st = p.status === "active" ? ["#e4f6ee", "#0f9d6b", t.rl.act] : p.status === "paused" ? ["#f0f2f6", "#6b7688", t.rl.pau] : ["#fdf5df", "#c98d00", t.rl.pen];
              return (
                <div key={p.id} className="flex flex-wrap items-center gap-3 border-b border-[#f5f7fb] px-[14px] py-[11px] last:border-b-0">
                  <Avatar name={p.name || p.email || "?"} size={36} />
                  <div className="min-w-[160px] flex-1"><div className="text-[13.5px] font-bold text-ink">{p.name || "—"}</div><div className="text-[12px] text-muted">{[p.email, p.phone].filter(Boolean).join(" · ")}</div></div>
                  {devRole && <span className="rounded-[7px] bg-bg-2 px-2 py-[2px] text-[11px] font-bold text-text">{devRole}</span>}
                  <span className="rounded-[8px] px-[9px] py-[3px] text-[11px] font-bold" style={{ background: st[0], color: st[1] }}>{st[2]}</span>
                </div>
              );
            })}
          </div>
        </Modal>
      )}
      {edit && (
        <Modal title={edit.id ? t.rl.agEditT : t.rl.agAddT} onClose={() => setEdit(null)}>
          <div className="flex flex-col gap-3">
            <div><label className={label}>{L("Название", "Name", "Ad")} *</label><input value={edit.name ?? ""} onChange={(e) => setEdit({ ...edit, name: e.target.value })} className={input} /></div>
            <div><label className={label}>{t.rl.agAddrL}</label><input value={edit.addr ?? ""} onChange={(e) => setEdit({ ...edit, addr: e.target.value })} className={input} /></div>
            <div><label className={label}>{t.prof.phone}</label><input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} className={input} /></div>
            <div><label className={label}>{t.rl.agLicL}</label><input value={edit.lic ?? ""} onChange={(e) => setEdit({ ...edit, lic: e.target.value })} className={input} /></div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setEdit(null)} className="cursor-pointer rounded-[10px] border border-line px-4 py-[10px] text-[13px] font-semibold text-text">{t.common.cancel}</button>
            <button type="button" disabled={pending || !(edit.name ?? "").trim()} onClick={() => run(async () => { await saveCompany(kind, { id: edit.id, name: (edit.name ?? "").trim(), phone: edit.phone || null, addr: edit.addr || null, lic: edit.lic || null }); setEdit(null); }, t.rl.agSaved)} className="cursor-pointer rounded-[10px] bg-blue-2 px-4 py-[10px] text-[13px] font-bold text-white disabled:opacity-60">{t.rl.agSave}</button>
          </div>
        </Modal>
      )}
      {toast && <div className="animate-card fixed bottom-6 left-1/2 z-500 -translate-x-1/2 rounded-[12px] bg-ink px-4 py-3 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(10,16,28,.35)]">{toast}</div>}
    </>
  );
}
