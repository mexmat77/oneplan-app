"use client";

// «Приглашение в базу» — prototype `invOpen` (markup 1812–1827, logic 4236–4242). В прототипе «Отправить» просто закрывал окно,
// а ссылка была фиксированной. С Supabase (`remote`): «Отправить» создаёт приглашение и шлёт письмо со ссылкой (Resend),
// «Создать ссылку» — приглашение без почты для передачи вручную; оба — через `createInvite` из «Управления».
import { useState } from "react";
import { IconX } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { Modal } from "@/components/ui/Modal";
import { showToast } from "@/components/ui/toast";
import { validMail } from "@/lib/phone";
import { INVITE_LINK } from "@/store/admin";
import { createInvite } from "@/app/admin/actions";

export function InviteModal({ remote = false, onClose }: { remote?: boolean; onClose: () => void }) {
  const { t, lang } = useI18n();
  const [mail, setMail] = useState("");
  const [url, setUrl] = useState(remote ? "" : INVITE_LINK);
  const [busy, setBusy] = useState(false);
  const [bad, setBad] = useState(false);
  const [copied, setCopied] = useState(false);
  const make = async (withMail: boolean) => {
    if (busy) return;
    if (withMail && !validMail(mail)) { setBad(true); showToast(t.rl.mailErr); return; }
    setBusy(true);
    try {
      const r = await createInvite({ role: "realtor", email: withMail ? mail.trim() : undefined, lang });
      setUrl(r.url);
      if (withMail) { showToast(r.mailed ? t.rl.sent : t.rl.invMailFail); if (r.mailed) { setMail(""); onClose(); } }
    } catch (e) { showToast((e as Error).message); } finally { setBusy(false); }
  };
  const copy = () => { try { navigator.clipboard.writeText(url); } catch {} setCopied(true); setTimeout(() => setCopied(false), 1500); };
  return (
    <Modal open onClose={onClose} width={460} z={310} overlay={0.55} padding="22px 24px">
      <div className="mb-[6px] flex items-start gap-[10px]"><div className="flex-1 text-[17.5px] font-extrabold text-ink">{t.rl.mT}</div><button type="button" onClick={onClose} aria-label="close" className="cursor-pointer p-[2px] text-muted hover:text-ink"><IconX size={18} /></button></div>
      <p className="mb-4 text-[13px] leading-[1.55] text-text-2 [text-wrap:pretty]">{t.rl.mS}</p>
      <label className="mb-[6px] block text-[12.5px] font-semibold text-text-2">{t.rl.email}</label>
      <div className="mb-4 flex gap-2">
        <input value={mail} onChange={(e) => { setMail(e.target.value); setBad(false); }} placeholder="name@agency.com" className={`min-w-0 flex-1 rounded-[10px] border px-3 py-[10px] text-[13.5px] outline-none ${bad ? "border-red bg-red-tint" : "border-line"}`} />
        <button type="button" disabled={busy} onClick={() => { if (remote) void make(true); else { setMail(""); onClose(); showToast(t.rl.sent); } }} className="flex-none cursor-pointer rounded-[10px] bg-blue-2 px-[15px] py-[10px] text-[13px] font-bold text-white hover:bg-blue-3 disabled:opacity-60">{t.rl.send}</button>
      </div>
      <div className="mb-2 text-[12px] text-muted">{t.rl.or}</div>
      <div className="flex gap-2">
        <input value={url} readOnly placeholder={remote ? t.rl.invMakeHint : ""} className="min-w-0 flex-1 rounded-[10px] border border-line bg-[#f8f9fc] px-[11px] py-[10px] font-mono text-[12px] outline-none" />
        {url
          ? <button type="button" onClick={copy} className={`flex-none cursor-pointer rounded-[10px] px-[15px] py-[10px] text-[13px] font-bold ${copied ? "bg-green-tint text-green" : "border border-line bg-surface text-ink hover:border-blue hover:text-blue"}`}>{copied ? t.rl.copied : t.rl.copy}</button>
          : <button type="button" disabled={busy} onClick={() => void make(false)} className="flex-none cursor-pointer rounded-[10px] border border-line bg-surface px-[15px] py-[10px] text-[13px] font-bold text-ink hover:border-blue hover:text-blue disabled:opacity-60">{t.rl.invMake}</button>}
      </div>
    </Modal>
  );
}
