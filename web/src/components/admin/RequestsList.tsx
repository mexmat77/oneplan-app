"use client";

import { useState, useTransition } from "react";
import { IconCheck, IconClock, IconX } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { approveLead, approveRequest, declineLead, declineRequest, restoreAccess, type ApproveOrg, type Role } from "@/app/admin/actions";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";

/** `src`: `login` — форма «запросить доступ» на странице входа (`access_requests`), `site` — форма на главной (`leads`, с комментарием). */
export type AccessRequest = { id: string; name: string; phone: string; email: string; agency: string | null; company: string | null; role: Role; lang: string; status: string; created_at: string; src: "login" | "site"; message?: string ; kind?: "access" | "unblock" };

type Org = { id: string; name: string };
export function RequestsList({ rows, orgs }: { rows: AccessRequest[]; orgs: { agencies: Org[]; developers: Org[] } }) {
  const { t, lang } = useI18n();
  const L = (ru: string, en: string, tr: string) => (lang === "RU" ? ru : lang === "TR" ? tr : en);
  const [err, setErr] = useState("");
  const [toast, setToast] = useState("");
  const [pending, start] = useTransition();
  const run = (fn: () => Promise<unknown>, ok: string) => { setErr(""); start(async () => { try { await fn(); setToast(ok); setTimeout(() => setToast(""), 2600); } catch (e) { setErr((e as Error).message); } }); };
  const stC: Record<string, [string, string, string]> = { new: ["#eef3ff", "#4d7cfe", L("Новая", "New", "Yeni")], accepted: ["#e4f6ee", "#0f9d6b", L("Принята", "Accepted", "Kabul")], rejected: ["#f0f2f6", "#6b7688", L("Отклонена", "Rejected", "Red")] };
  const list = [...rows].sort((a, b) => (a.status === "new" ? -1 : b.status === "new" ? 1 : 0));
  // окно одобрения (12.10.2026, модель «Организации и участники»): тип → организация (из справочника или новая по тексту заявки) → роль
  const [ap, setAp] = useState<null | { r: AccessRequest; role: Role; orgId: string; orgRole: string }>(null);
  const openApprove = (r: AccessRequest) => {
    const text = (r.agency ?? r.company ?? "").trim();
    const list = r.role === "developer" ? orgs.developers : orgs.agencies;
    const match = text ? list.find((o) => o.name.trim().toLowerCase() === text.toLowerCase()) : null;
    setAp({ r, role: r.role, orgId: match ? match.id : text ? "__new__" : "", orgRole: r.role === "developer" ? "editor" : "agent" });
  };
  const roleChips = (role: Role) => (role === "developer" ? (["editor", "manager", "admin"] as const) : (["agent", "manager", "owner"] as const));
  const roleLabel = (role: Role, r: string) => (role === "developer" ? (t.org.roles.developer as Record<string, string>)[r] : (t.org.roles.agency as Record<string, string>)[r]);
  function approve() {
    if (!ap) return;
    const { r, role, orgId, orgRole } = ap;
    const text = (r.agency ?? r.company ?? "").trim();
    const org: ApproveOrg = { agency_id: role === "realtor" && orgId && orgId !== "__new__" ? orgId : null, developer_id: role === "developer" && orgId && orgId !== "__new__" ? orgId : null, org_role: orgId ? orgRole : null, new_org_name: orgId === "__new__" ? text : null };
    run(async () => { if (r.src === "site") await approveLead(r.id, org); else await approveRequest(r.id, role, org); setAp(null); }, t.rl.apprT);
  }

  return (
    <>
      <p className="mb-[14px] text-[13px] text-text-2">{L("Заявки с главной страницы и с формы входа. «Принять» создаёт аккаунт и отправляет письмо со ссылкой для установки пароля.", "Requests from the home page and the login form. “Accept” creates the account and e-mails a link to set the password.", "Ana sayfadan ve giriş formundan gelen başvurular. “Kabul” hesabı oluşturur ve şifre bağlantısı gönderir.")}</p>
      {err && <div className="mb-3 rounded-[11px] bg-red-tint px-[13px] py-[11px] text-[12.5px] text-red-2">{err}</div>}
      {list.length === 0 && <div className="rounded-[14px] border border-dashed border-[#dfe4ec] bg-surface p-[26px] text-center text-[13px] text-muted">{L("Заявок пока нет", "No requests yet", "Henüz başvuru yok")}</div>}
      <div className="flex flex-col gap-[10px]">
        {list.map((r) => {
          const s = stC[r.status] ?? stC.new;
          return (
            <div key={`${r.src}-${r.id}`} className="flex flex-wrap items-center gap-[13px] rounded-[14px] border border-line bg-surface px-4 py-[14px]">
              <div className="min-w-[220px] flex-1">
                <div className="text-[14px] font-bold text-ink">{r.name} {r.kind === "unblock"
                  ? <span className="ml-1 rounded-[7px] bg-red-tint px-2 py-[2px] text-[10.5px] font-bold text-red-2">{t.rl.unbBadge}</span>
                  : <span className="ml-1 rounded-[7px] bg-bg-2 px-2 py-[2px] text-[10.5px] font-bold text-text">{r.role === "developer" ? L("Застройщик", "Developer", "Geliştirici") : L("Риэлтор", "Realtor", "Emlakçı")}</span>}{r.src === "site" && <span className="ml-1 rounded-[7px] bg-[#fdf2e4] px-2 py-[2px] text-[10.5px] font-bold text-[#b9741a]">{L("С главной", "Home page", "Ana sayfa")}</span>}</div>
                <div className="text-[12.5px] text-muted">{r.email}{r.phone ? ` · ${r.phone}` : ""}{r.agency || r.company ? ` · ${r.agency ?? r.company}` : ""}</div>
                {r.message && <div className="mt-[5px] max-w-[640px] rounded-[9px] bg-bg-2 px-[10px] py-[6px] text-[12.5px] text-text [overflow-wrap:anywhere]">{r.message}</div>}
                <div className="mt-[3px] flex items-center gap-1 text-[11.5px] text-muted-2"><IconClock size={11} /> {new Date(r.created_at).toLocaleString("ru-RU")} · {r.lang}</div>
              </div>
              <span className="flex-none rounded-[8px] px-[10px] py-1 text-[11px] font-bold" style={{ background: s[0], color: s[1] }}>{s[2]}</span>
              {r.status === "new" && (
                <>
                  <button type="button" disabled={pending} onClick={() => (r.kind === "unblock" ? run(() => restoreAccess(r.id), t.rl.apprT) : openApprove(r))} className="inline-flex flex-none cursor-pointer items-center gap-1 rounded-[9px] bg-[#22c15e] px-[13px] py-2 text-[12px] font-bold text-white disabled:opacity-60">{r.kind === "unblock" ? t.rl.resume : <><IconCheck size={14} /> {t.rl.ok}</>}</button>
                  <button type="button" disabled={pending} onClick={() => run(() => (r.src === "site" ? declineLead(r.id) : declineRequest(r.id)), t.rl.declT)} className="inline-flex flex-none cursor-pointer items-center gap-1 rounded-[9px] border border-line bg-surface px-[13px] py-2 text-[12px] font-bold text-red disabled:opacity-60"><IconX size={14} /> {t.rl.no}</button>
                </>
              )}
            </div>
          );
        })}
      </div>
      {ap && (() => {
        const text = (ap.r.agency ?? ap.r.company ?? "").trim();
        const list = ap.role === "developer" ? orgs.developers : orgs.agencies;
        const opts = [{ value: "", label: ap.role === "developer" ? L("Без компании", "No company", "Şirketsiz") : t.rl.agFree }, ...(text && !list.some((o) => o.name.trim().toLowerCase() === text.toLowerCase()) ? [{ value: "__new__", label: `${L("Создать", "Create", "Oluştur")}: «${text}»` }] : []), ...list.map((o) => ({ value: o.id, label: o.name }))];
        return (
          <Modal open onClose={() => setAp(null)} width={520}>
            <div className="mb-3 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{L("Принять заявку", "Approve request", "Başvuruyu kabul et")}</div><ModalClose onClick={() => setAp(null)} /></div>
            <div className="mb-3 text-[13px] text-text"><b className="text-ink">{ap.r.name}</b> · {ap.r.email}{text ? ` · ${text}` : ""}</div>
            <label className="mb-[5px] block text-[12px] font-semibold text-text-2">{L("Тип пользователя", "User type", "Kullanıcı türü")}</label>
            <div className="mb-3 flex gap-2">{(["realtor", "developer"] as Role[]).map((r) => <button key={r} type="button" onClick={() => setAp({ ...ap, role: r, orgId: "", orgRole: r === "developer" ? "editor" : "agent" })} className={`flex-1 cursor-pointer rounded-[10px] border px-3 py-[9px] text-[13px] font-bold ${ap.role === r ? "border-blue bg-[#f5f8ff] text-ink" : "border-line text-text"}`}>{r === "developer" ? L("Застройщик", "Developer", "Geliştirici") : L("Риэлтор", "Realtor", "Emlakçı")}</button>)}</div>
            <label className="mb-[5px] block text-[12px] font-semibold text-text-2">{ap.role === "developer" ? L("Компания", "Company", "Şirket") : t.rl.agL}</label>
            <Select value={ap.orgId} onChange={(v) => setAp({ ...ap, orgId: v })} options={opts} searchable />
            {ap.orgId && <>
              <label className="mb-[5px] mt-3 block text-[12px] font-semibold text-text-2">{t.org.role}</label>
              <div className="flex flex-wrap gap-2">{roleChips(ap.role).map((r) => <button key={r} type="button" onClick={() => setAp({ ...ap, orgRole: r })} className={`cursor-pointer rounded-[18px] border px-[13px] py-[8px] text-[12.5px] ${ap.orgRole === r ? "border-sel-line bg-blue-tint font-bold text-sel-ink" : "border-line text-text hover:bg-bg-3"}`}>{roleLabel(ap.role, r)}</button>)}</div>
            </>}
            <p className="mt-3 text-[11.5px] text-muted">{L("Человек получит письмо со ссылкой для установки пароля и сразу окажется в выбранной организации.", "The person receives an e-mail with a link to set a password and joins the chosen organization right away.", "Kişi şifre belirleme bağlantısını e-postayla alır ve seçilen kuruluşa hemen katılır.")}</p>
            <div className="mt-4 flex justify-end gap-2">
              <button type="button" onClick={() => setAp(null)} className="cursor-pointer rounded-[10px] border border-line px-4 py-[10px] text-[13px] font-semibold text-text">{t.common.cancel}</button>
              <button type="button" disabled={pending} onClick={approve} className="inline-flex cursor-pointer items-center gap-1 rounded-[10px] bg-[#22c15e] px-4 py-[10px] text-[13px] font-bold text-white disabled:opacity-60"><IconCheck size={15} /> {t.rl.ok}</button>
            </div>
          </Modal>
        );
      })()}
      {toast && <div className="animate-card fixed bottom-6 left-1/2 z-500 -translate-x-1/2 rounded-[12px] bg-ink px-4 py-3 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(10,16,28,.35)]">{toast}</div>}
    </>
  );
}
