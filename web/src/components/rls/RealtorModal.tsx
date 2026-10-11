"use client";

// «Данные риэлтора» — prototype `rlEditOpen` (markup 1791–1810, logic 4200–4217).
// Same modal serves «Добавить» (`rlEditK === '__new'`, line 3924) and editing; for `me` it also syncs the profile.
import { useState } from "react";
import { IconAlertCircle, IconCalendar, IconCheck, IconChevronDown } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { normPh, trPhone, validMail } from "@/lib/phone";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { showToast } from "@/components/ui/toast";
import { addMember, updateMember, type Member } from "@/store/admin";
import { createUser, updateUser } from "@/app/admin/actions";
import { saveProfile } from "@/store/profile";
import { Calendar } from "./Calendar";

export const NEW_KEY = "__new";
const input = "w-full rounded-[11px] border border-line px-[13px] py-[11px] text-[14px] outline-none";
const label = "mb-[6px] block text-[12.5px] font-semibold text-text-2";

// `remote` — Supabase-режим: сохранение через серверные экшены админки (`updateUser` / `createUser` → письмо-приглашение); `meId` — текущий админ.
type Props = { k: string; members: Member[]; agencies: string[]; remote?: { meId: string; agencies: { id: string; name: string }[] }; onClose: () => void };

export function RealtorModal({ k, members, agencies, remote, onClose }: Props) {
  const { t, lang } = useI18n();
  const cur = members.find((m) => m.id === k);
  const [f, setF] = useState(() => cur
    ? { name: cur.name, mail: cur.mail, phone: cur.phone || "", ag: agencies.includes(cur.ag) ? cur.ag : "", to: cur.paidTo || "", agQ: "", err: "", miss: false }
    : { name: "", mail: "", phone: "+90 ", ag: "", to: "24.09.2026", agQ: "", err: "", miss: false });
  const [cal, setCal] = useState(false);
  const [busy, setBusy] = useState(false);
  const ruToIso = (d: string) => { const m = d.trim().match(/^(\d{2})\.(\d{2})\.(\d{4})$/); return m ? `${m[3]}-${m[2]}-${m[1]}` : null; };
  const agFree = t.rl.agFree;

  // Prototype `reAgOpts` (line 4206): «Свободный агент» first, then the selected agency, then the rest filtered + sorted.
  const q = f.agQ.trim().toLowerCase();
  const sel = f.ag && agencies.includes(f.ag) ? f.ag : "";
  const opts = [agFree, ...(sel ? [sel] : []), ...agencies.filter((a) => a !== sel && (!q || a.toLowerCase().includes(q))).sort((x, y) => x.localeCompare(y))];

  function dupCheck(mail: string, phone: string) {
    for (const m of members) {
      if (m.id === k) continue;
      if (mail && m.mail.toLowerCase() === mail.toLowerCase()) return t.rl.dupMail;
      if (phone && normPh(m.phone) === normPh(phone)) return t.rl.dupPhone;
    }
    return "";
  }
  async function save() {
    if (busy) return;
    const missing = [!f.name.trim() && t.prof.name, !f.mail.trim() && t.prof.mail].filter(Boolean) as string[];
    if (missing.length) { setF({ ...f, err: `${t.rl.reqErr}: ${missing.join(", ")}`, miss: true }); return; }
    if (!validMail(f.mail)) { setF({ ...f, err: t.rl.mailErr, miss: true }); return; }
    const d2 = dupCheck(f.mail.trim(), f.phone.trim()); if (d2) { setF({ ...f, err: d2 }); return; }
    const patch = { name: f.name.trim(), mail: f.mail.trim(), phone: f.phone.trim() || cur?.phone || "", ag: f.ag || agFree, paidTo: f.to.trim() || cur?.paidTo || "" };
    if (remote) {
      const agencyId = remote.agencies.find((a) => a.name === f.ag)?.id ?? null;
      const body = { name: patch.name, email: patch.mail, phone: patch.phone, agency_id: agencyId, agency_text: !agencyId && f.ag ? f.ag : null, paid_to: ruToIso(patch.paidTo) };
      setBusy(true);
      try {
        if (cur) await updateUser(k, body); else await createUser({ ...body, role: "realtor", status: "active", lang });
      } catch (e) { setF({ ...f, err: (e as Error).message }); setBusy(false); return; }
      setBusy(false);
      if (k === remote.meId) saveProfile({ name: patch.name, agency: patch.ag, email: patch.mail, phone: patch.phone });
      onClose();
      showToast(cur ? t.rl.editDone : t.rl.sent);
      return;
    }
    if (cur) updateMember(k, patch); else addMember(patch);
    if (k === "me") saveProfile({ name: patch.name, agency: patch.ag, email: patch.mail, phone: patch.phone });
    onClose();
    showToast(t.rl.editDone);
  }

  return (
    <Modal open onClose={() => { if (!cal) onClose(); }} width={460} z={310} overlay={0.55} padding="22px 24px">
      <div className="mb-4 flex items-center gap-[10px]"><span className="flex-1 text-[16px] font-extrabold text-ink">{t.rl.editT}</span><ModalClose onClick={onClose} /></div>
      <label className={label}>{t.prof.name}</label>
      <input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value, miss: false })} className={`${input} mb-3 ${f.miss && !f.name.trim() ? "border-red bg-red-tint" : ""}`} />
      <label className={label}>{t.prof.mail}</label>
      <input value={f.mail} onChange={(e) => setF({ ...f, mail: e.target.value, miss: false })} className={`${input} mb-3 ${f.miss && (!f.mail.trim() || !validMail(f.mail)) ? "border-red bg-red-tint" : ""}`} />
      <label className={label}>{t.prof.phone}</label>
      <input value={f.phone} onChange={(e) => setF({ ...f, phone: trPhone(e.target.value) })} placeholder="+90 5xx xxx xx xx" inputMode="tel" className={`${input} mb-3`} />
      <label className={label}>{t.rl.agL}</label>
      <input value={f.agQ} onChange={(e) => setF({ ...f, agQ: e.target.value })} placeholder={t.rl.agSearch} className={`${input} rounded-b-none border-b-0`} />
      <div className="mb-4 max-h-[180px] overflow-y-auto rounded-b-[11px] border border-line">
        {opts.map((a) => {
          const on = f.ag === a || (a === agFree && !f.ag);
          return (
            <div key={a} onClick={() => setF({ ...f, ag: a === agFree ? "" : a })} className={`flex cursor-pointer items-center gap-2 border-b border-[#f5f7fb] px-[13px] py-[10px] text-[13.5px] hover:brightness-[.96] ${on ? "bg-blue-tint font-bold text-ink" : "text-[#3d4a5e]"}`}>
              <span className="flex-1">{a}</span>{on && <IconCheck size={16} className="text-blue-2" />}
            </div>
          );
        })}
      </div>
      <label className={label}>{t.rl.paidToL}</label>
      <div onClick={() => setCal(true)} className="mb-3 flex w-[210px] cursor-pointer items-center gap-2 rounded-[11px] border border-line bg-surface px-[13px] py-[10px] text-[14px] hover:border-blue">
        <IconCalendar size={16} className="flex-none text-blue" /><span className="flex-1 font-bold text-ink">{f.to || "—"}</span><IconChevronDown size={16} className="flex-none text-muted" />
      </div>
      {f.err && <div className="mb-3 flex items-start gap-2 rounded-[11px] bg-red-tint px-[13px] py-[11px] text-[12.5px] text-red-2"><IconAlertCircle size={15} className="mt-[1px] flex-none" /><span>{f.err}</span></div>}
      <button type="button" onClick={save} disabled={busy} className="w-full cursor-pointer rounded-[12px] bg-blue-2 p-[13px] text-[14px] font-bold text-white hover:bg-blue-3 disabled:opacity-60">{t.rl.editSave}</button>
      {remote && !cur && <div className="mt-2 text-center text-[11.5px] text-muted">{t.rl.newMailHint}</div>}
      {cal && <Calendar value={f.to} lang={lang} onPick={(v) => { setF({ ...f, to: v }); setCal(false); }} onClose={() => setCal(false)} />}
    </Modal>
  );
}
