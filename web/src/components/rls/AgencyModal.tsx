"use client";

// «Новое агентство» / «Данные агентства» — prototype `agAddOpen` (markup 1866–1883, logic 4180–4198).
import { PhoneInput } from "@/components/ui/PhoneInput";
import { useState } from "react";
import { IconPaperclip } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { normPh } from "@/lib/phone";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { showToast } from "@/components/ui/toast";
import { saveAgency, updateMember, type Agency, type Member } from "@/store/admin";
import { saveCompany } from "@/app/admin/actions";
import { saveProfile } from "@/store/profile";

const input = "w-full rounded-[11px] border border-line px-[13px] py-[11px] text-[14px] outline-none";
const label = "mb-[6px] block text-[12.5px] font-semibold text-text-2";
const nl = (x?: string) => String(x || "").trim().toLowerCase();

type Props = { edit: string; agencies: Agency[]; members: Member[]; profileAgency: string; remote?: boolean; onSaved: (name: string, old: string) => void; onClose: () => void };

export function AgencyModal({ edit, agencies, members, profileAgency, remote, onSaved, onClose }: Props) {
  const { t } = useI18n();
  const meta = agencies.find((a) => a.name === edit);
  const [f, setF] = useState(() => ({ name: edit, addr: meta?.addr || "", phone: meta?.phone || "+90 ", lic: meta?.lic || "", scan: meta?.scan || "" }));
  const [miss, setMiss] = useState(false); // название не заполнено после попытки сохранить
  const [busy, setBusy] = useState(false);

  async function save() {
    if (busy) return;
    const nm = f.name.trim();
    if (!nm) { setMiss(true); showToast(`${t.rl.reqErr}: ${t.rl.agNewPh}`); return; }
    const old = edit;
    if (agencies.some((a) => a.name !== old && nl(a.name) === nl(nm))) { showToast(t.rl.agDupName); return; }
    for (const a of agencies) {
      if (a.name === old) continue;
      if (normPh(f.phone).length > 4 && normPh(a.phone || "") === normPh(f.phone)) { showToast(`${t.rl.agDupPhone} — ${a.name}`); return; }
      if (nl(f.lic) && nl(a.lic) === nl(f.lic)) { showToast(`${t.rl.agDupLic} — ${a.name}`); return; }
    }
    if (remote) {
      // Supabase: агентство — строка таблицы `agencies`; риэлторы ссылаются на неё по id, переименование подхватывается само.
      setBusy(true);
      try { await saveCompany("agencies", { id: meta?.id, name: nm, addr: f.addr.trim() || null, phone: f.phone.trim() || null, lic: f.lic.trim() || null }); }
      catch (e) { setBusy(false); showToast((e as Error).message); return; }
      setBusy(false);
      if (old && old !== nm && profileAgency === old) saveProfile({ agency: nm });
      onSaved(nm, old);
      showToast(t.rl.agSaved);
      return;
    }
    if (old && old !== nm) {
      members.filter((m) => m.ag === old).forEach((m) => updateMember(m.id, { ag: nm }));
      if (profileAgency === old) saveProfile({ agency: nm });
    }
    saveAgency(old || null, { name: nm, addr: f.addr.trim(), phone: f.phone.trim(), lic: f.lic.trim(), scan: f.scan });
    onSaved(nm, old);
    showToast(t.rl.agSaved);
  }

  return (
    <Modal open onClose={onClose} width={460} z={410} overlay={0.55} padding="22px 24px">
      <div className="mb-[14px] flex items-center gap-[10px]"><span className="flex-1 text-[16px] font-extrabold text-ink">{edit ? t.rl.agEditT : t.rl.agAddT}</span><ModalClose onClick={onClose} /></div>
      <label className={label}>{t.rl.agNewPh} <span className="text-red">*</span></label>
      <input value={f.name} onChange={(e) => { setF({ ...f, name: e.target.value }); setMiss(false); }} className={`${input} mb-3 ${miss && !f.name.trim() ? "border-red bg-red-tint" : ""}`} />
      <label className={label}>{t.rl.agAddrL}</label>
      <input value={f.addr} onChange={(e) => setF({ ...f, addr: e.target.value })} className={`${input} mb-3`} />
      <label className={label}>{t.prof.phone}</label>
      <PhoneInput value={f.phone} onChange={(v) => setF({ ...f, phone: v })} className={`${input} mb-3`} />
      <label className={label}>{t.rl.agLicL}</label>
      <input value={f.lic} onChange={(e) => setF({ ...f, lic: e.target.value })} placeholder="TR-07-XXXX" className={`${input} mb-3`} />
      {!remote && <label className={label}>{t.rl.agScanL}</label>}
      {!remote && <label className="mb-4 flex cursor-pointer items-center gap-[9px] rounded-[11px] border border-dashed border-[#c3cad6] px-[13px] py-[11px] text-[13px] text-blue-2 hover:border-blue hover:bg-bg-5">
        <IconPaperclip size={16} /> {f.scan || t.rl.agScanB}
        <input type="file" accept="image/*,.pdf" onChange={(e) => { const file = e.target.files?.[0]; if (file) setF({ ...f, scan: file.name }); }} className="hidden" />
      </label>}
      <button type="button" onClick={save} disabled={busy} className="mt-1 w-full cursor-pointer rounded-[12px] bg-blue-2 p-[13px] text-[14px] font-bold text-white hover:bg-blue-3 disabled:opacity-60">{t.rl.agSave}</button>
    </Modal>
  );
}
