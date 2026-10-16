"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { IconBuilding, IconBuildingCommunity, IconChevronRight, IconHome2, IconPlus, IconTrash, IconUsers } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { deleteCompany } from "@/app/admin/actions";
import { saveOrg } from "@/app/org/actions";
import { Modal } from "./UsersTable";
import { confirmDialog } from "@/components/ui/confirm";

export type StaffRow = { id: string; name: string; email: string | null; phone: string | null; role: string; dev_role: string | null; status: string };
export type CompanyRow = { id: string; name: string; phone: string | null; addr: string | null; lic: string | null; members?: number; staff?: StaffRow[]; listings?: number };
type Kind = "agencies" | "developers";
const input = "w-full rounded-[10px] border border-line px-3 py-[10px] text-[13.5px] outline-none focus:border-blue";
const label = "mb-[6px] block text-[12.5px] font-semibold text-text-2";

export function CompaniesPanel({ agencies, developers }: { agencies: CompanyRow[]; developers: CompanyRow[] }) {
  const { t, lang } = useI18n();
  const L = (ru: string, en: string, tr: string) => (lang === "RU" ? ru : lang === "TR" ? tr : en);
  const [kind, setKind] = useState<Kind>("agencies");
  const [edit, setEdit] = useState<Partial<CompanyRow> | null>(null);
  const router = useRouter();
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
          <Link key={a.id} href={`/admin/companies/${kind === "agencies" ? "agency" : "developer"}/${a.id}`} className="flex flex-wrap items-center gap-3 border-b border-[#f5f7fb] px-[18px] py-[13px] hover:bg-bg-5">
            <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] bg-blue-tint text-blue-2">{kind === "agencies" ? <IconBuilding size={17} /> : <IconBuildingCommunity size={17} />}</span>
            <div className="min-w-[180px] flex-1"><div className="text-[13.5px] font-bold text-ink">{a.name}</div><div className="text-[12px] text-muted">{[a.addr, a.phone, a.lic && `${t.rl.agLicL}: ${a.lic}`].filter(Boolean).join(" · ") || "—"}</div></div>
            <span className="inline-flex flex-none items-center gap-1 rounded-[9px] bg-bg-2 px-[10px] py-[5px] text-[12px] font-bold text-text"><IconUsers size={13} /> {a.members ?? 0}</span>
            <span title={kind === "agencies" ? t.cat.agObjs : L("проектов", "projects", "proje")} className="inline-flex flex-none items-center gap-1 rounded-[9px] bg-bg-2 px-[10px] py-[5px] text-[12px] font-bold text-text"><IconHome2 size={13} /> {a.listings ?? 0}</span>
            <button type="button" disabled={pending || (a.members ?? 0) > 0} title={t.rl.agDelH} onClick={(e) => { e.preventDefault(); e.stopPropagation(); void confirmDialog({ text: `${a.name}?`, ok: t.sel.del, danger: true }).then((ok) => ok && run(() => deleteCompany(kind, a.id), t.rl.agDone)); }} className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-line text-red hover:bg-[#fdf1f1] disabled:cursor-default disabled:opacity-30"><IconTrash size={15} /></button>
            <IconChevronRight size={16} className="text-muted-2" />
          </Link>
        ))}
      </div>
      <div className="mt-[10px] text-[11.5px] text-muted-2">{t.rl.agDelH}</div>
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
            <button type="button" disabled={pending || !(edit.name ?? "").trim()} onClick={() => run(async () => { const r = await saveOrg(kind === "agencies" ? "agency" : "developer", { id: edit.id, name: (edit.name ?? "").trim(), phone: edit.phone || null, addr: edit.addr || null, lic: edit.lic || null }); setEdit(null); router.push(`/admin/companies/${kind === "agencies" ? "agency" : "developer"}/${r.id}`); }, t.rl.agSaved)} className="cursor-pointer rounded-[10px] bg-blue-2 px-4 py-[10px] text-[13px] font-bold text-white disabled:opacity-60">{t.rl.agSave}</button>
          </div>
        </Modal>
      )}
      {toast && <div className="animate-card fixed bottom-6 left-1/2 z-500 -translate-x-1/2 rounded-[12px] bg-ink px-4 py-3 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(10,16,28,.35)]">{toast}</div>}
    </>
  );
}
