"use client";

import { confirmDialog } from "@/components/ui/confirm";
import { useState, useTransition } from "react";
import { Select } from "@/components/ui/Select";
import {
  IconAlertTriangle, IconCheck, IconCopy, IconKey, IconLink, IconPencil, IconPlus, IconRefresh, IconSearch, IconShieldLock, IconTrash,
  IconMailForward, IconUserPlus, IconX, IconHome2,
} from "@tabler/icons-react";
import Link from "next/link";
import { useI18n } from "@/i18n/provider";
import { validMail } from "@/lib/phone";
import { createInvite, createUser, deleteUser, resendInvite, setUserPassword, updateUser, type Role, type Status, type UserInput } from "@/app/admin/actions";

export type AdminUser = {
  id: string; name: string; email: string | null; phone: string | null; role: Role; status: Status;
  agency_id: string | null; agency_text: string | null; developer_id: string | null; dev_role: string | null; paid_to: string | null;
  platform_staff: boolean; color: string; last_seen: string | null; created_at: string; developer_ids?: string[];
  agency_role?: "owner" | "manager" | "agent" | null; // роль в агентстве (org_members, 0022)
};
export type Company = { id: string; name: string };
type DevRole = "admin" | "editor" | "manager";
type Draft = Partial<AdminUser> & { password?: string; sendWelcome?: boolean; developer_ids: string[]; dev_role: DevRole | null; lang?: "RU" | "EN" | "TR" };

const input = "w-full rounded-[10px] border border-line px-3 py-[11px] text-[14px] outline-none focus:border-blue";
const label = "mb-[6px] block text-[13px] text-text-2";
// Обязательные поля формы пользователя: ФИО и почта для всех ролей, для застройщика — хотя бы одна компания.
// Пустые подсвечиваются красной рамкой, звёздочка у подписи показывает обязательность заранее.
const inputBad = "border-red bg-red-tint";
const Req = () => <span className="ml-[2px] text-red" title="обязательно">*</span>;
const ST: Record<Status, [string, string]> = { active: ["#e4f6ee", "#0f9d6b"], paused: ["#fdf5df", "#c98d00"], pending: ["#eef3ff", "#4d7cfe"] };
const ROLE_C: Record<Role, string> = { admin: "#7b4fd0", realtor: "#4d7cfe", developer: "#0f9d6b" };
const genPassword = () => { const a = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789"; let p = ""; for (let i = 0; i < 10; i++) p += a[Math.floor(Math.random() * a.length)]; return p; };

// Checkbox-card as in the OnePlan v2 design.
function Tick({ on }: { on: boolean }) {
  return <span className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[6px] border text-white ${on ? "border-blue-2 bg-blue-2" : "border-[#c9d0dc] bg-surface"}`}>{on && <IconCheck size={14} stroke={3} />}</span>;
}

export function UsersTable({ users, agencies, developers, invites, serviceRole, initialQ, listingsBy = {} }: { users: AdminUser[]; agencies: Company[]; developers: Company[]; invites: { code: string; email: string | null; role: string; created_at: string }[]; serviceRole: boolean; initialQ?: string; listingsBy?: Record<string, number> }) {
  const { t, lang } = useI18n();
  const L = (ru: string, en: string, tr: string) => (lang === "RU" ? ru : lang === "TR" ? tr : en);
  const [q, setQ] = useState(initialQ ?? "");
  const [roleF, setRoleF] = useState<"" | Role>("");
  const [edit, setEdit] = useState<Draft | null>(null);
  const [help, setHelp] = useState(false);
  const [coQ, setCoQ] = useState("");
  const [copied, setCopied] = useState(false);
  const [inv, setInv] = useState<null | { role: Role; agency_id: string; developer_id: string; org_role: string; email: string; name: string; url?: string }>(null);
  const [pw, setPw] = useState<null | { id: string; value: string; mail: boolean }>(null);
  const [err, setErr] = useState("");
  const [miss, setMiss] = useState<string[]>([]); // ключи незаполненных обязательных полей: name | email | devs
  const [toast, setToast] = useState("");
  const [pending, start] = useTransition();
  const flash = (m: string) => { setToast(m); setTimeout(() => setToast(""), 2600); };

  const roleL: Record<Role, string> = { admin: L("Админ платформы", "Platform admin", "Platform yöneticisi"), realtor: L("Риэлтор", "Realtor", "Emlakçı"), developer: L("Застройщик", "Developer", "Geliştirici") };
  const devRoles: { k: DevRole; l: string; d: string }[] = [
    { k: "admin", l: L("Администратор", "Administrator", "Yönetici"), d: L("Реквизиты и данные компании для клиентов", "Company details shown to clients", "Müşterilere görünen şirket bilgileri") },
    { k: "editor", l: L("Редактор", "Editor", "Editör"), d: L("Наполняет объекты: планировки, фото, цены", "Fills projects: plans, photos, prices", "Projeleri doldurur: planlar, fotoğraflar, fiyatlar") },
    { k: "manager", l: L("Менеджер", "Manager", "Yönetici (satış)"), d: L("Продажи — просмотр объектов и свои данные", "Sales — views projects and own data", "Satış — projeleri ve kendi verilerini görür") },
  ];
  const stL: Record<Status, string> = { active: t.rl.act, paused: t.rl.pau, pending: t.rl.pen };
  const nq = q.trim().toLowerCase();
  // поиск: ФИО, почта, телефон и название агентства/компании застройщика
  const company = (u: AdminUser) => u.role === "developer"
    ? (u.developer_ids ?? []).map((id) => developers.find((d) => d.id === id)?.name).filter(Boolean).join(", ") || "—"
    : agencies.find((a) => a.id === u.agency_id)?.name ?? u.agency_text ?? "—";
  // поиск: ФИО, почта, телефон и название агентства/компании застройщика
  const rows = users.filter((u) => (!roleF || u.role === roleF) && (!nq || `${u.name} ${u.email ?? ""} ${u.phone ?? ""} ${company(u)}`.toLowerCase().includes(nq)));

  function run(fn: () => Promise<unknown>, ok: string) {
    setErr("");
    start(async () => { try { await fn(); flash(ok); } catch (e) { setErr((e as Error).message); } });
  }
  function openNew() { setEdit({ role: "realtor", status: "active", developer_ids: [], dev_role: "editor", platform_staff: false, password: "", sendWelcome: true, lang }); setHelp(false); setCoQ(""); setMiss([]); setErr(""); }
  function openEdit(u: AdminUser) { setEdit({ ...u, developer_ids: u.developer_ids ?? [], dev_role: (u.dev_role as DevRole) ?? "editor", password: "" }); setHelp(false); setCoQ(""); setMiss([]); setErr(""); }
  const fieldL: Record<string, string> = { name: L("ФИО", "Full name", "Ad Soyad"), email: L("почта", "e-mail", "e-posta"), devs: L("доступ к застройщикам", "developer access", "geliştirici erişimi") };
  const patch = (d: Partial<Draft>) => { if (!edit) return; setEdit({ ...edit, ...d }); if (miss.length) setMiss((m) => m.filter((k) => !(k in d) && !(k === "devs" && "developer_ids" in d) && !(k === "devs" && "role" in d))); };
  function save() {
    if (!edit) return;
    const missing: string[] = [];
    if (!(edit.name ?? "").trim()) missing.push("name");
    if (!(edit.email ?? "").trim()) missing.push("email");
    if (edit.role === "developer" && edit.developer_ids.length === 0) missing.push("devs");
    if (missing.length) { setMiss(missing); setErr(`${t.rl.reqErr}: ${missing.map((k) => fieldL[k]).join(", ")}`); return; }
    if (!validMail(edit.email ?? "")) { setMiss(["email"]); setErr(L("Проверьте адрес почты", "Check the e-mail address", "E-posta adresini kontrol edin")); return; }
    setMiss([]);
    const body: UserInput = {
      email: (edit.email ?? "").trim(), name: (edit.name ?? "").trim(), phone: edit.phone ?? "", role: edit.role ?? "realtor", status: edit.status ?? "active",
      agency_id: edit.role === "realtor" ? edit.agency_id || null : null, agency_text: edit.role === "realtor" ? edit.agency_text || null : null,
      developer_ids: edit.role === "developer" ? edit.developer_ids : [], dev_role: edit.role === "developer" ? edit.dev_role : null,
      platform_staff: edit.role === "developer" ? !!edit.platform_staff : false, paid_to: edit.role === "realtor" ? edit.paid_to || null : null, lang: edit.lang,
      agency_role: edit.role === "realtor" && edit.agency_id ? (edit.agency_role ?? "agent") : null,
      password: edit.password || undefined, send_welcome: edit.sendWelcome !== false,
    };
    run(async () => { if (edit.id) await updateUser(edit.id, body); else await createUser(body); setEdit(null); }, edit.id ? t.rl.editDone : body.password && body.send_welcome ? L("Пользователь создан, письмо с доступами отправлено", "User created, access e-mail sent", "Kullanıcı oluşturuldu, erişim e-postası gönderildi") : L("Пользователь создан", "User created", "Kullanıcı oluşturuldu"));
  }
  const toggleCo = (id: string) => edit && patch({ developer_ids: edit.developer_ids.includes(id) ? edit.developer_ids.filter((x) => x !== id) : [...edit.developer_ids, id] });
  const coList = developers.filter((d) => !coQ.trim() || d.name.toLowerCase().includes(coQ.trim().toLowerCase()));
  const allSel = edit ? developers.length > 0 && developers.every((d) => edit.developer_ids.includes(d.id)) : false;
  const seg = (on: boolean) => `flex-1 cursor-pointer rounded-[12px] border-2 px-3 py-[13px] text-center text-[15px] font-bold transition ${on ? "border-blue bg-[#f5f8ff] text-ink" : "border-line bg-surface text-text hover:border-[#c9d0dc]"}`;

  return (
    <>
      {!serviceRole && (
        <div className="mb-4 flex items-start gap-2 rounded-[12px] border border-[#f3e2ae] bg-[#fdf5df] px-[14px] py-3 text-[12.5px] leading-[1.5] text-[#8a6400]"><IconAlertTriangle size={16} className="mt-[1px] flex-none" /> {L("Не задан SUPABASE_SERVICE_ROLE_KEY в .env.local — создание и удаление аккаунтов недоступно.", "SUPABASE_SERVICE_ROLE_KEY is not set in .env.local — creating and deleting accounts is unavailable.", ".env.local içinde SUPABASE_SERVICE_ROLE_KEY yok — hesap oluşturma/silme kapalı.")}</div>
      )}
      <div className="mb-[14px] flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1"><IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.rl.rlSearch} className={`${input} rounded-[11px] py-[10px] pl-[34px] text-[13.5px]`} /></div>
        <Select value={roleF} onChange={(v) => setRoleF(v as "" | Role)} menuWidth="auto" className="w-auto rounded-[11px] py-[10px] text-[13.5px]" options={[{ value: "", label: L("Все роли", "All roles", "Tüm roller") }, ...(["admin", "realtor", "developer"] as Role[]).map((r) => ({ value: r, label: roleL[r] }))]} />
        <button type="button" onClick={() => setInv({ role: "realtor", agency_id: "", developer_id: "", org_role: "agent", email: "", name: "" })} className="inline-flex cursor-pointer items-center gap-1 rounded-[11px] border border-[#d8e3ff] bg-blue-tint px-4 py-[10px] text-[13px] font-bold text-blue hover:bg-[#e2ebff]"><IconLink size={15} /> {t.rl.inv}</button>
        <button type="button" onClick={openNew} className="inline-flex cursor-pointer items-center gap-1 rounded-[11px] bg-blue-2 px-4 py-[10px] text-[13px] font-bold text-white hover:bg-blue-3"><IconPlus size={15} /> {L("Добавить пользователя", "Add user", "Kullanıcı ekle")}</button>
      </div>
      {err && !edit && <div className="mb-3 rounded-[11px] bg-red-tint px-[13px] py-[11px] text-[12.5px] text-red-2">{err}</div>}
      <div className="overflow-hidden rounded-[16px] border border-line bg-surface">
        {rows.length === 0 && <div className="p-[22px] text-center text-[13px] text-muted">{t.chat.notFound}</div>}
        {rows.map((u) => {
          const st = ST[u.status];
          return (
            <div key={u.id} className="flex flex-wrap items-center gap-[13px] border-b border-[#f5f7fb] px-[18px] py-[13px]">
              <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: u.color || "#4d7cfe" }}>{(u.name || u.email || "?").split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}</span>
              <div className="min-w-[180px] flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-ink">{u.name || "—"}{u.platform_staff && <span className="inline-flex items-center gap-1 rounded-[7px] bg-[#efe7fb] px-2 py-[2px] text-[10.5px] font-bold text-[#7b4fd0]"><IconShieldLock size={11} /> {L("Платформа", "Platform", "Platform")}</span>}</div>
                <div className="text-[12px] text-muted">{u.email} {u.phone ? `· ${u.phone}` : ""} · {company(u)}</div>
              </div>
              <span className="flex-none rounded-[8px] px-[10px] py-1 text-[11px] font-bold text-white" style={{ background: ROLE_C[u.role] }}>{roleL[u.role]}{u.role === "developer" && u.dev_role ? ` · ${t.org.roles.developer[u.dev_role as "admin" | "editor" | "manager"] ?? u.dev_role}` : u.role === "realtor" && u.agency_id ? ` · ${t.org.roles.agency[u.agency_role ?? "agent"]}` : ""}</span>
              <span className="flex-none rounded-[8px] px-[10px] py-1 text-[11px] font-bold" style={{ background: st[0], color: st[1] }}>{stL[u.status]}</span>
              {u.role === "realtor" && <Link href={`/catalog?owner=${u.id}`} title={t.cat.profObjs} className="inline-flex flex-none items-center gap-1 rounded-[9px] bg-bg-2 px-[10px] py-[5px] text-[12px] font-bold text-text hover:bg-blue-tint hover:text-blue"><IconHome2 size={13} /> {listingsBy[u.id] ?? 0}</Link>}
              {u.paid_to && <span className="flex-none text-[11.5px] text-muted">{t.rl.payOk} {new Date(u.paid_to).toLocaleDateString("ru-RU")}</span>}
              {u.status === "pending" && <button type="button" disabled={pending} onClick={() => run(() => updateUser(u.id, { status: "active" }), t.rl.apprT)} className="flex-none cursor-pointer rounded-[9px] bg-[#22c15e] px-[13px] py-2 text-[12px] font-bold text-white">{t.rl.ok}</button>}
              {u.status !== "pending" && u.role !== "admin" && <button type="button" disabled={pending} onClick={() => run(() => updateUser(u.id, { status: u.status === "active" ? "paused" : "active" }), t.rl.editDone)} className={`flex-none cursor-pointer rounded-[9px] border px-[13px] py-2 text-[12px] font-bold ${u.status === "active" ? "border-line bg-surface text-text" : "border-transparent bg-[#22c15e] text-white"}`}>{u.status === "active" ? t.rl.pause : t.rl.resume}</button>}
              {u.email && <button type="button" title={L("Отправить письмо-приглашение повторно", "Resend invitation e-mail", "Davet e-postasını yeniden gönder")} disabled={pending} onClick={() => run(() => resendInvite(u.id, lang), L("Письмо отправлено", "E-mail sent", "E-posta gönderildi"))} className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-line text-text hover:border-blue hover:text-blue disabled:opacity-60"><IconMailForward size={15} /></button>}
              <button type="button" title={L("Задать пароль", "Set password", "Şifre belirle")} onClick={() => setPw({ id: u.id, value: "", mail: true })} className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-line text-text hover:border-blue hover:text-blue"><IconKey size={15} /></button>
              <button type="button" title={t.rl.editB} onClick={() => openEdit(u)} className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-line text-text hover:border-blue hover:text-blue"><IconPencil size={15} /></button>
              <button type="button" title={t.sel.del} disabled={pending} onClick={() => void confirmDialog({ text: L("Удалить пользователя?", "Delete user?", "Kullanıcı silinsin mi?"), ok: t.sel.del, danger: true }).then((ok) => { if (ok) run(() => deleteUser(u.id), t.sel.delDone); })} className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-line text-red hover:bg-[#fdf1f1]"><IconTrash size={15} /></button>
            </div>
          );
        })}
      </div>
      {invites.length > 0 && (
        <div className="mt-4 rounded-[16px] border border-line bg-surface px-[18px] py-[14px]">
          <div className="mb-2 text-[12px] font-bold uppercase tracking-[.06em] text-muted">{t.rl.stI} · {invites.length}</div>
          {invites.map((i) => (
            <div key={i.code} className="flex flex-wrap items-center gap-3 border-t border-[#f5f7fb] py-2 text-[13px]">
              <span className="font-mono font-bold text-ink">{i.code}</span><span className="text-muted">{roleL[i.role as Role] ?? i.role}{i.email ? ` · ${i.email}` : ""}</span>
              <button type="button" onClick={() => { try { navigator.clipboard.writeText(`${location.origin}/join/${i.code}`); } catch {} flash(t.rl.copied); }} className="ml-auto inline-flex cursor-pointer items-center gap-1 text-[12px] font-bold text-blue"><IconCopy size={13} /> {t.rl.copy}</button>
            </div>
          ))}
        </div>
      )}

      {edit && (
        <Modal title={edit.id ? t.rl.editT : L("Новый пользователь", "New user", "Yeni kullanıcı")} onClose={() => setEdit(null)} wide>
          {/* Platform-level role */}
          <label className={label}>{L("Тип пользователя", "User type", "Kullanıcı türü")}</label>
          <div className="mb-4 flex gap-[9px] max-md:flex-col">
            {(["realtor", "developer", "admin"] as Role[]).map((r) => <button key={r} type="button" onClick={() => patch({ role: r })} className={seg(edit.role === r)}>{roleL[r]}</button>)}
          </div>

          {edit.role === "developer" && (
            <>
              <div className="mb-[9px] flex items-center gap-2"><label className="text-[13px] text-text-2">{L("Роль", "Role", "Rol")}</label><button type="button" onClick={() => setHelp((v) => !v)} className={`flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-full text-[12px] font-extrabold ${help ? "bg-blue-2 text-white" : "bg-blue text-white"}`}>?</button></div>
              <div className="mb-[11px] flex gap-[9px] max-md:flex-col">{devRoles.map((r) => <button key={r.k} type="button" onClick={() => setEdit({ ...edit, dev_role: r.k })} className={seg(edit.dev_role === r.k)}>{r.l}</button>)}</div>
              {help && <div className="mb-4 rounded-[11px] bg-[#f0f4ff] px-[14px] py-3">{devRoles.map((r) => <div key={r.k} className="mb-[5px] text-[12px] leading-[1.45] text-[#4a5568]"><b className="text-ink">{r.l}</b> — {r.d}</div>)}</div>}
            </>
          )}

          <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
            <div><label className={label}>{L("ФИО", "Full name", "Ad Soyad")}<Req /></label><input value={edit.name ?? ""} onChange={(e) => patch({ name: e.target.value })} placeholder="Ad Soyad" className={`${input} ${miss.includes("name") ? inputBad : ""}`} /></div>
            <div><label className={label}>{t.prof.mail}<Req /></label><input type="email" value={edit.email ?? ""} onChange={(e) => patch({ email: e.target.value })} placeholder="user@mail.com" className={`${input} ${miss.includes("email") ? inputBad : ""}`} /></div>
            <div><label className={label}>{t.prof.phone} <span className="text-muted-2">({L("необязательно", "optional", "isteğe bağlı")})</span></label><input value={edit.phone ?? ""} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} placeholder="+90 5xx xxx xx xx" className={input} /></div>
            {edit.id && <div><label className={label}>{t.obj.statusT}</label><Select value={edit.status ?? "active"} onChange={(v) => setEdit({ ...edit, status: v as Status })} options={(["active", "pending", "paused"] as Status[]).map((s) => ({ value: s, label: stL[s] }))} /></div>}
          </div>

          {!edit.id && (
            <div className="mb-4">
              <label className={label}>{L("Пароль для входа", "Login password", "Giriş şifresi")}</label>
              <div className="flex flex-wrap gap-2">
                <input value={edit.password ?? ""} onChange={(e) => setEdit({ ...edit, password: e.target.value })} placeholder="••••••••" className={`${input} min-w-[150px] flex-1 font-mono text-[15px] tracking-[.03em]`} autoComplete="new-password" />
                <button type="button" onClick={() => { setEdit({ ...edit, password: genPassword() }); setCopied(false); }} className="inline-flex flex-none cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[10px] border border-blue bg-blue-tint px-[15px] text-[13px] font-bold text-[#2f5fe0] hover:bg-[#e0e9ff]"><IconRefresh size={15} /> {L("Сгенерировать", "Generate", "Oluştur")}</button>
                {edit.password && <button type="button" onClick={() => { try { navigator.clipboard.writeText(edit.password ?? ""); } catch {} setCopied(true); }} className="inline-flex flex-none cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[10px] border border-line bg-surface px-[14px] text-[13px] font-semibold text-text hover:bg-bg-3"><IconCopy size={15} /> {copied ? t.rl.copied : t.rl.copy}</button>}
              </div>
              {edit.password && (
                <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-text"><input type="checkbox" checked={edit.sendWelcome !== false} onChange={(e) => patch({ sendWelcome: e.target.checked })} className="h-4 w-4 accent-[#4d7cfe]" />{L("Отправить логин и пароль на почту", "E-mail the login and password", "Kullanıcı adı ve şifreyi e-postayla gönder")}</label>
              )}
              {(
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <span className="text-[13px] text-text-2">{L("Язык письма", "E-mail language", "E-posta dili")}</span>
                  <div className="flex gap-1 rounded-[9px] bg-bg-2 p-[3px]">{(["RU", "EN", "TR"] as const).map((lg) => <button key={lg} type="button" onClick={() => patch({ lang: lg })} className={`cursor-pointer rounded-[7px] px-[10px] py-[5px] text-[12px] font-bold ${(edit.lang ?? "RU") === lg ? "bg-surface text-ink shadow-[0_1px_2px_rgba(20,36,63,.12)]" : "text-muted"}`}>{lg}</button>)}</div>
                </div>
              )}
              <div className="mt-[7px] text-[11.5px] text-muted">{L("Пусто — придёт письмо-приглашение со ссылкой для установки пароля. С паролем — пользователь получит письмо с логином и паролем (или скопируйте и передайте сами).", "Empty — an invite e-mail with a link to set the password is sent. With a password — copy it and hand it over.", "Boş — şifre belirleme bağlantılı davet e-postası gider. Şifreyle — kopyalayıp kullanıcıya iletin.")}</div>
            </div>
          )}

          {edit.role === "developer" && (
            <>
              <div className="mb-4">
                <div className="mb-2 flex items-center gap-2"><label className="flex-1 text-[13px] text-text-2">{L("Доступ к застройщикам", "Developer access", "Geliştirici erişimi")}<Req /></label><span className="text-[11.5px] text-muted">{L("Выбрано", "Selected", "Seçildi")}: {edit.developer_ids.length} / {developers.length}</span></div>
                <div className="mb-[9px] flex gap-2">
                  <div className="relative flex-1"><IconSearch size={14} className="absolute left-[10px] top-1/2 -translate-y-1/2 text-muted-2" /><input value={coQ} onChange={(e) => setCoQ(e.target.value)} placeholder={L("Поиск застройщика", "Search developer", "Geliştirici ara")} className={`${input} py-[9px] pl-[31px] text-[13px]`} /></div>
                  <button type="button" onClick={() => setEdit({ ...edit, developer_ids: allSel ? [] : developers.map((d) => d.id) })} className="inline-flex flex-none cursor-pointer items-center gap-2 rounded-[10px] border border-line px-3 text-[13px] font-semibold text-ink hover:bg-bg-3"><Tick on={allSel} /> {L("Все", "All", "Tümü")}</button>
                </div>
                <div className={`max-h-[210px] overflow-auto rounded-[12px] border bg-[#fbfcfe] p-[9px] ${miss.includes("devs") ? "border-red bg-red-tint" : "border-line-2"}`}>
                  {coList.length === 0 && <div className="px-[10px] py-[18px] text-center text-[13px] text-muted-2">{developers.length === 0 ? L("Сначала добавьте застройщика во вкладке «Агентства и застройщики»", "Add a developer company first (Agencies & developers tab)", "Önce geliştirici ekleyin") : L("Ничего не найдено", "Nothing found", "Bulunamadı")}</div>}
                  <div className="grid grid-cols-[repeat(auto-fill,minmax(178px,1fr))] gap-[9px]">
                    {coList.map((d) => { const on = edit.developer_ids.includes(d.id); return <button key={d.id} type="button" onClick={() => toggleCo(d.id)} className={`flex cursor-pointer items-center gap-[9px] rounded-[10px] border px-[10px] py-[10px] text-left text-[13.5px] font-semibold ${on ? "border-blue bg-[#f5f8ff] text-ink" : "border-line bg-surface text-ink hover:border-[#c9d0dc]"}`}><Tick on={on} /><span className="truncate">{d.name}</span></button>; })}
                  </div>
                </div>
                <div className="mt-2 text-[11.5px] text-muted">{L("Редактор и менеджер могут работать сразу с несколькими застройщиками.", "Editors and managers may work with several developers at once.", "Editör ve yönetici birden fazla geliştiriciyle çalışabilir.")}</div>
              </div>
              <button type="button" onClick={() => setEdit({ ...edit, platform_staff: !edit.platform_staff })} className={`mb-4 flex w-full cursor-pointer items-start gap-3 rounded-[12px] border px-[14px] py-3 text-left ${edit.platform_staff ? "border-blue bg-[#f5f8ff]" : "border-line bg-surface"}`}>
                <Tick on={!!edit.platform_staff} />
                <span><span className="mb-[2px] flex items-center gap-[5px] text-[13.5px] font-bold text-ink"><IconShieldLock size={14} className="text-blue" /> {L("Сотрудник платформы", "Platform staff", "Platform personeli")}</span><span className="block text-[11.5px] leading-[1.4] text-muted">{L("Не виден застройщикам в их списке команды — работает с объектами «за кадром». Виден только вам (супер-админу).", "Hidden from developers' team lists — works on projects behind the scenes. Visible only to you (super admin).", "Geliştiricilerin ekip listesinde görünmez — projelerle perde arkasında çalışır. Yalnızca size görünür.")}</span></span>
              </button>
            </>
          )}

          {edit.role === "realtor" && (
            <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(190px,1fr))] gap-3">
              <div><label className={label}>{t.rl.agL}</label><Select value={edit.agency_id ?? ""} onChange={(v) => setEdit({ ...edit, agency_id: v, agency_role: v ? edit.agency_role ?? "agent" : null })} options={[{ value: "", label: t.rl.agFree }, ...agencies.map((a) => ({ value: a.id, label: a.name }))]} searchable searchPlaceholder={t.rl.agSearch} emptyText={t.chat.notFound} /></div>
              <div><label className={label}>{t.rl.paidToL}</label><input type="date" value={edit.paid_to ?? ""} onChange={(e) => setEdit({ ...edit, paid_to: e.target.value })} className={input} /></div>
            </div>
          )}
          {edit.role === "realtor" && edit.agency_id && (
            <div className="mb-4">
              <label className={label}>{t.rl.agRoleL}</label>
              <div className="flex gap-[9px] max-md:flex-col">{(["agent", "manager", "owner"] as const).map((r) => <button key={r} type="button" onClick={() => patch({ agency_role: r })} className={seg((edit.agency_role ?? "agent") === r)}>{t.org.roles.agency[r]}</button>)}</div>
              <div className="mt-2 text-[11.5px] text-muted">{t.org.roleHint.agency}</div>
            </div>
          )}
          {edit.role === "admin" && <div className="mb-4 rounded-[11px] bg-[#f0f4ff] px-[14px] py-3 text-[12px] leading-[1.45] text-[#4a5568]"><b className="text-ink">{roleL.admin}</b> — {L("владелец платформы: все компании, объекты и пользователи", "platform owner: all companies, projects and users", "platform sahibi: tüm şirketler, projeler ve kullanıcılar")}</div>}

          {err && <div className="mb-3 rounded-[11px] bg-red-tint px-[13px] py-[11px] text-[12.5px] text-red-2">{err}</div>}
          <div className="flex justify-end gap-[10px]">
            <button type="button" onClick={() => setEdit(null)} className="cursor-pointer rounded-[10px] border border-line bg-surface px-[18px] py-[11px] text-[14px] font-semibold text-text-2">{t.common.cancel}</button>
            <button type="button" disabled={pending} onClick={save} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] bg-blue-2 px-5 py-[11px] text-[14px] font-bold text-white hover:bg-blue-3 disabled:opacity-60"><IconUserPlus size={16} /> {t.prof.save}</button>
          </div>
        </Modal>
      )}
      {pw && (
        <Modal title={L("Новый пароль", "New password", "Yeni şifre")} onClose={() => setPw(null)}>
          <div className="flex gap-2"><input value={pw.value} onChange={(e) => setPw({ ...pw, value: e.target.value })} className={`${input} font-mono`} autoComplete="new-password" /><button type="button" onClick={() => setPw({ ...pw, value: genPassword() })} className="inline-flex flex-none cursor-pointer items-center gap-1 rounded-[10px] border border-blue bg-blue-tint px-3 text-[13px] font-bold text-[#2f5fe0]"><IconRefresh size={14} /></button></div>
          <label className="mt-3 flex cursor-pointer items-center gap-2 text-[13px] text-text"><input type="checkbox" checked={pw.mail} onChange={(e) => setPw({ ...pw, mail: e.target.checked })} className="h-4 w-4 accent-[#4d7cfe]" />{L("Отправить логин и пароль на почту", "E-mail the login and password", "Kullanıcı adı ve şifreyi e-postayla gönder")}</label>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setPw(null)} className="cursor-pointer rounded-[10px] border border-line px-4 py-[10px] text-[13px] font-semibold text-text">{t.common.cancel}</button>
            <button type="button" disabled={pending || pw.value.length < 6} onClick={() => run(async () => { await setUserPassword(pw.id, pw.value, pw.mail); setPw(null); }, pw.mail ? L("Пароль сохранён, письмо отправлено", "Password saved, e-mail sent", "Şifre kaydedildi, e-posta gönderildi") : t.prof.pwDone)} className="cursor-pointer rounded-[10px] bg-blue-2 px-4 py-[10px] text-[13px] font-bold text-white disabled:opacity-60">{t.prof.upd}</button>
          </div>
        </Modal>
      )}
      {inv && (
        <Modal title={t.rl.mT} onClose={() => setInv(null)}>
          {inv.url ? (
            <div className="flex gap-2"><input value={inv.url} readOnly className={`${input} font-mono text-[12px]`} /><button type="button" onClick={() => { try { navigator.clipboard.writeText(inv.url!); } catch {} flash(t.rl.copied); }} className="flex-none cursor-pointer rounded-[10px] bg-ink px-4 py-[10px] text-[13px] font-bold text-white">{t.rl.copy}</button></div>
          ) : (
            <>
              <div className="mb-3 text-[12.5px] leading-[1.5] text-muted">{t.rl.mS}</div>
              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                <div><label className={label}>{L("Тип", "Type", "Tür")}</label><Select value={inv.role} onChange={(v) => setInv({ ...inv, role: v as Role, org_role: v === "developer" ? "editor" : "agent" })} options={(["realtor", "developer"] as Role[]).map((r) => ({ value: r, label: roleL[r] }))} /></div>
                {inv.role === "developer" ? (
                  <div><label className={label}>{L("Застройщик", "Developer company", "Geliştirici firma")}</label><Select value={inv.developer_id} onChange={(v) => setInv({ ...inv, developer_id: v })} options={[{ value: "", label: "—" }, ...developers.map((d) => ({ value: d.id, label: d.name }))]} searchable searchPlaceholder={L("Поиск застройщика", "Search developer", "Geliştirici ara")} emptyText={t.chat.notFound} /></div>
                ) : (
                  <div><label className={label}>{t.rl.agL}</label><Select value={inv.agency_id} onChange={(v) => setInv({ ...inv, agency_id: v })} options={[{ value: "", label: t.rl.agFree }, ...agencies.map((a) => ({ value: a.id, label: a.name }))]} searchable searchPlaceholder={t.rl.agSearch} emptyText={t.chat.notFound} /></div>
                )}
                {(inv.role === "developer" ? !!inv.developer_id : !!inv.agency_id) && <div className="col-span-full"><label className={label}>{t.org.role}</label><div className="flex flex-wrap gap-[9px]">{(inv.role === "developer" ? (["editor", "manager", "admin"] as const) : (["agent", "manager", "owner"] as const)).map((r) => <button key={r} type="button" onClick={() => setInv({ ...inv, org_role: r })} className={`cursor-pointer rounded-[18px] border px-[13px] py-[8px] text-[12.5px] ${inv.org_role === r ? "border-sel-line bg-blue-tint font-bold text-sel-ink" : "border-line text-text hover:bg-bg-3"}`}>{inv.role === "developer" ? t.org.roles.developer[r as "editor" | "manager" | "admin"] : t.org.roles.agency[r as "agent" | "manager" | "owner"]}</button>)}</div></div>}
                <div><label className={label}>{t.org.name}</label><input value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} placeholder="Ad Soyad" className={input} /></div>
                <div><label className={label}>{t.rl.email} <span className="text-muted-2">({L("если указать — письмо со ссылкой уйдёт на почту", "if given — the link is e-mailed", "girilirse bağlantı e-postayla gider")})</span></label><input value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} placeholder="name@agency.com" className={input} /></div>
              </div>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setInv(null)} className="cursor-pointer rounded-[10px] border border-line px-4 py-[10px] text-[13px] font-semibold text-text">{t.common.cancel}</button>
                <button type="button" disabled={pending} onClick={() => run(async () => { const r = await createInvite({ role: inv.role, email: inv.email || undefined, name: inv.name || undefined, agency_id: inv.role === "realtor" ? inv.agency_id || null : null, developer_id: inv.role === "developer" ? inv.developer_id || null : null, org_role: (inv.role === "developer" ? inv.developer_id : inv.agency_id) ? inv.org_role : null, lang }); setInv({ ...inv, url: r.url }); }, inv.email ? L("Ссылка создана, письмо отправлено", "Link created, e-mail sent", "Bağlantı oluşturuldu, e-posta gönderildi") : t.rl.sent)} className="cursor-pointer rounded-[10px] bg-blue-2 px-4 py-[10px] text-[13px] font-bold text-white disabled:opacity-60">{L("Создать ссылку", "Create link", "Bağlantı oluştur")}</button>
              </div>
            </>
          )}
        </Modal>
      )}
      {toast && <div className="animate-card fixed bottom-6 left-1/2 z-500 -translate-x-1/2 rounded-[12px] bg-ink px-4 py-3 text-[13px] font-semibold text-white shadow-[0_10px_30px_rgba(10,16,28,.35)]">{toast}</div>}
    </>
  );
}

export function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: React.ReactNode; wide?: boolean }) {
  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-340 bg-[rgba(14,23,42,.5)]" />
      <div className={`fixed left-1/2 top-1/2 z-341 max-h-[90vh] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[18px] bg-surface p-[26px] shadow-[0_30px_80px_rgba(0,0,0,.4)] max-md:p-4 ${wide ? "w-[min(560px,94vw)]" : "w-[min(480px,94vw)]"}`}>
        <div className="mb-[18px] flex items-center gap-3"><h3 className="flex-1 text-[19px] font-extrabold text-ink">{title}</h3><button type="button" onClick={onClose} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[9px] bg-bg-2 text-text-2 hover:brightness-95"><IconX size={17} /></button></div>
        {children}
      </div>
    </>
  );
}
