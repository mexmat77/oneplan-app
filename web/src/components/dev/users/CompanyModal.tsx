"use client";

// «Новая компания» — two-step modal (prototype lines 1914–1938; logic 3319–3342):
// step 1 name* + director*, step 2 admin name* + admin e-mail* (validated) → creates the company and its admin user.
import { useState } from "react";
import { IconArrowLeft, IconArrowRight, IconCheck, IconInfoCircle, IconX } from "@tabler/icons-react";
import { Modal } from "@/components/ui/Modal";
import { useDevT } from "@/i18n/dev";
import { addCompany, nextCompanyId, nextUserId, upsertUser } from "@/store/dev";
import { emailOk } from "./shared";

type Props = { open: boolean; onClose: () => void; onCreated: (companyId: number) => void };

export function CompanyModal({ open, onClose, onCreated }: Props) {
  const { t } = useDevT();
  const CO = t.co;
  const [step, setStep] = useState(0);
  const [tried, setTried] = useState(false);
  const [name, setName] = useState("");
  const [dir, setDir] = useState("");
  const [admName, setAdmName] = useState("");
  const [admMail, setAdmMail] = useState("");

  const req = (v: string) => tried && !v.trim();
  // Inline colour like the prototype (`_cfInp`) — it must beat the global `[data-dev]` filled-field highlight.
  const inp = (bad: boolean) => ({ className: "w-full box-border rounded-[10px] border border-line px-[13px] py-3 text-[14px] outline-none focus:border-blue", style: bad ? { borderColor: "#dc2626" } : undefined });
  const badge = (on: boolean) => `inline-flex items-center gap-[7px] rounded-[20px] px-3 py-[6px] text-[12.5px] font-bold ${on ? "bg-blue-tint text-blue" : "bg-bg-2 text-muted"}`;
  const num = (on: boolean) => `flex h-5 w-5 items-center justify-center rounded-full text-[12px] text-white ${on ? "bg-blue" : "bg-[#c5cbd6]"}`;
  const label = (text: string) => <label className="mb-[6px] block text-[13px] text-text-2">{text} <span className="text-[#dc2626]">*</span></label>;

  const next = () => { if (!name.trim() || !dir.trim()) { setTried(true); return; } setStep(1); setTried(false); };
  const back = () => { setStep((s) => Math.max(0, s - 1)); setTried(false); };
  const create = () => {
    if (!admName.trim() || !emailOk(admMail)) { setTried(true); return; }
    const cid = nextCompanyId();
    addCompany({ id: cid, name: name.trim() || CO.nc_title, dir: dir.trim() || "—", objIds: [], until: "" });
    upsertUser({ id: nextUserId(), companyIds: [cid], role: "admin", fio: admName.trim() || "—", mail: admMail.trim() || "—", access: "all", until: "—" });
    onCreated(cid);
  };

  return (
    <Modal open={open} onClose={onClose} width={470} z={130} overlay={0.5} padding="26px" sheet={false} anim="none">
      <div className="mb-[18px] flex items-center gap-3">
        <h3 className="flex-1 text-[19px] font-extrabold text-ink">{CO.nc_title}</h3>
        <button type="button" onClick={onClose} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[9px] bg-bg-2 text-[17px] text-text-2"><IconX size={17} /></button>
      </div>
      <div className="mb-5 flex items-center gap-2">
        <span className={badge(true)}><span className={num(true)}>1</span>{CO.nc_step1}</span>
        <span className="h-px flex-1 bg-line" />
        <span className={badge(step >= 1)}><span className={num(step >= 1)}>2</span>{CO.nc_step2}</span>
      </div>
      {step === 0 ? (
        <>
          <div className="mb-[14px]">{label(CO.nc_name)}<input value={name} onChange={(e) => setName(e.target.value)} placeholder="ONEPLAN İnşaat Ltd." {...inp(req(name))} /></div>
          <div className="mb-[10px]">{label(CO.nc_dir)}<input value={dir} onChange={(e) => setDir(e.target.value)} placeholder="Ahmet Yılmaz" {...inp(req(dir))} /></div>
          <div className="mb-5 text-[11.5px] text-[#a0a8b5]">{CO.req_note}</div>
          <div className="flex justify-end gap-[10px]">
            <button type="button" onClick={onClose} className="cursor-pointer rounded-[10px] border border-line bg-surface px-[18px] py-[11px] text-[14px] font-semibold text-text-2">{CO.cancel}</button>
            <button type="button" onClick={next} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] bg-ink px-5 py-[11px] text-[14px] font-bold text-white">{CO.next} <IconArrowRight size={16} /></button>
          </div>
        </>
      ) : (
        <>
          <div className="mb-[14px]">{label(CO.nc_admin_name)}<input value={admName} onChange={(e) => setAdmName(e.target.value)} placeholder="Mehmet Kaya" {...inp(req(admName))} /></div>
          <div className="mb-2">{label(CO.nc_admin_mail)}<input value={admMail} onChange={(e) => setAdmMail(e.target.value)} type="email" placeholder="admin@company.com" {...inp(tried && !emailOk(admMail))} /></div>
          <div className="mb-[14px] text-[11.5px] text-[#a0a8b5]">{CO.req_note}</div>
          <div className="mb-5 flex items-start gap-[9px] rounded-[11px] bg-[#f0f4ff] px-[13px] py-[11px] text-[12.5px] text-text-2"><IconInfoCircle size={16} className="mt-[1px] flex-none text-blue" /><span>{CO.nc_hint}</span></div>
          <div className="flex justify-end gap-[10px]">
            <button type="button" onClick={back} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] border border-line bg-surface px-[18px] py-[11px] text-[14px] font-semibold text-text-2"><IconArrowLeft size={16} /> {CO.back_btn}</button>
            <button type="button" onClick={create} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] bg-blue px-5 py-[11px] text-[14px] font-bold text-white"><IconCheck size={16} /> {CO.create}</button>
          </div>
        </>
      )}
    </Modal>
  );
}
