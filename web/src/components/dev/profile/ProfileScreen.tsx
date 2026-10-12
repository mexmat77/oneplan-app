"use client";

// §1.15 «Профайл» (prototype lines 1106–1142). Переработано 07.10.2026 по образцу профиля риэлтора: одна колонка ≤ 760px,
// карточка с аватаром (загрузка в Storage `media`, ссылка — в user_metadata.avatar_url), данные, реквизиты компании (админ),
// безопасность, правовые документы; «Выйти» продублирован в меню пользователя в шапке.
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { IconCamera, IconCheck, IconCopy, IconLock, IconLogout, IconRefresh, IconShieldCheck, IconTrash } from "@tabler/icons-react";
import { showToast } from "@/components/ui/toast";
import { Avatar } from "@/components/ui/UserMenu";
import { useDevT } from "@/i18n/dev";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import { uploadFile } from "@/lib/upload";
import { toJpegFile } from "@/lib/photos";
import { updateMyProfile } from "@/app/(app)/profile/actions";
import { setCurrentUserName, touch, useDev } from "@/store/dev";
import { copyText, genPassword, useRoleFlags } from "@/components/dev/users/shared";
import { LegalModal } from "./LegalModal";
import { TwoFactorCard } from "@/components/auth/TwoFactor";

export type ProfileMe = { id: string; name: string; email: string; phone: string; avatar: string | null; company: string };

const card = "rounded-[16px] border border-line bg-surface p-[22px] max-md:p-4";
const input = "w-full rounded-[10px] border border-line bg-surface px-3 py-[11px] text-[14px] text-ink outline-none focus:border-blue";
const inputRo = "w-full rounded-[10px] border border-line bg-bg-2 px-3 py-[11px] text-[14px] text-muted outline-none";
const primary = "inline-flex cursor-pointer items-center gap-[7px] rounded-[10px] bg-blue-2 px-4 py-[10px] text-[14px] font-semibold text-white hover:bg-blue-3 disabled:opacity-60";
const secondary = "inline-flex cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[10px] border border-line bg-surface px-[14px] py-[9px] text-[13px] font-semibold text-text hover:border-blue hover:text-blue disabled:opacity-60";

export function ProfileScreen({ me }: { me: ProfileMe }) {
  const { t } = useDevT();
  const router = useRouter();
  const { viewRole } = useDev();
  const { profCanCompany } = useRoleFlags();
  const roles = t.roles as Record<string, string>;
  const [name, setName] = useState(me.name);
  const [phone, setPhone] = useState(me.phone);
  const [avatar, setAvatar] = useState<string | null>(me.avatar);
  const [saving, setSaving] = useState(false);
  const [upBusy, setUpBusy] = useState(false);
  const [pass, setPass] = useState("");
  const [copied, setCopied] = useState(false);
  const [legal, setLegal] = useState(false);
  const [passBusy, setPassBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const dirty = name.trim() !== me.name || phone.trim() !== me.phone;
  const label = (text: string) => <label className="mb-[6px] block text-[12.5px] font-semibold text-text-2">{text}</label>;

  const save = async () => {
    if (!name.trim()) { showToast(`${t.prof_data}: ${t.fld_fio}`); return; }
    setSaving(true);
    try {
      if (hasSupabaseEnv()) await updateMyProfile({ name: name.trim(), phone: phone.trim() });
      setCurrentUserName(name.trim());
      showToast(t.prof_saved); router.refresh();
    } catch (e) { showToast((e as Error).message); } finally { setSaving(false); }
  };
  const pickPhoto = async (file: File | undefined) => {
    if (!file) return;
    setUpBusy(true);
    try {
      const jpg = await toJpegFile(file, 512).catch(() => { throw new Error(t.prof_photo_type); }); // HEIC/PNG/WebP → JPEG 512px
      const up = await uploadFile(jpg, `dev/avatars/${me.id || "demo"}`);
      if (hasSupabaseEnv()) await updateMyProfile({ avatar_url: up.url });
      setAvatar(up.url); router.refresh();
    } catch (e) { showToast((e as Error).message); } finally { setUpBusy(false); if (fileRef.current) fileRef.current.value = ""; }
  };
  const removePhoto = async () => {
    setUpBusy(true);
    try { if (hasSupabaseEnv()) await updateMyProfile({ avatar_url: "" }); setAvatar(null); router.refresh(); }
    catch (e) { showToast((e as Error).message); } finally { setUpBusy(false); }
  };
  const gen = () => { setPass(genPassword()); setCopied(false); };
  const copy = () => { if (!pass) return; copyText(pass); setCopied(true); setTimeout(() => setCopied(false), 1600); };
  const savePass = async () => {
    if (!pass) return;
    if (pass.length < 6) { showToast(t.prof_pass_short); return; }
    if (!hasSupabaseEnv()) { showToast(t.prof_pass_demo); setPass(""); return; }
    setPassBusy(true);
    const { error } = await createClient().auth.updateUser({ password: pass });
    setPassBusy(false);
    if (error) { showToast(t.prof_pass_err); return; }
    showToast(t.prof_pass_saved); setPass("");
  };
  const logout = async () => { if (hasSupabaseEnv()) { try { await createClient().auth.signOut(); } catch {} } window.location.assign("/login"); };

  return (
    <div className="mx-auto max-w-[760px]">
      <h1 className="text-[26px] font-extrabold tracking-[-.02em] text-ink">{t.prof_title}</h1>
      <div className="mb-[18px] mt-1 text-[13px] text-text-2">{t.prof_sub}</div>

      {/* Личные данные + аватар */}
      <div className={`${card} mb-[14px]`}>
        <div className="mb-5 flex flex-wrap items-center gap-4">
          <div className="relative">
            <Avatar name={name || me.name} src={avatar} size={72} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={upBusy} title={t.prof_photo_change} className="absolute -bottom-1 -right-1 flex h-[28px] w-[28px] cursor-pointer items-center justify-center rounded-full border-2 border-surface bg-blue text-white shadow-[0_2px_6px_rgba(20,36,63,.25)] hover:bg-blue-3 disabled:opacity-60"><IconCamera size={14} /></button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => void pickPhoto(e.target.files?.[0])} />
          </div>
          <div className="min-w-[180px] flex-1">
            <div className="text-[18px] font-extrabold tracking-[-.01em] text-ink">{name || me.name}</div>
            <div className="mt-[3px] flex flex-wrap items-center gap-2 text-[12.5px] text-text-2">
              <span className="rounded-[7px] bg-blue-tint px-2 py-[2px] text-[11px] font-bold text-blue-2">{roles[viewRole]}</span>
              {me.company && <span>{me.company}</span>}
            </div>
            <div className="mt-2 flex flex-wrap gap-2">
              <button type="button" onClick={() => fileRef.current?.click()} disabled={upBusy} className={secondary}><IconCamera size={14} /> {t.prof_photo_change}</button>
              {avatar && <button type="button" onClick={removePhoto} disabled={upBusy} className={`${secondary} text-muted`}><IconTrash size={14} /> {t.prof_photo_remove}</button>}
            </div>
            <div className="mt-[6px] text-[11.5px] text-muted">{t.prof_photo_hint}</div>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-[14px] max-md:grid-cols-1">
          <div>{label(t.fld_fio)}<input value={name} onChange={(e) => { setName(e.target.value); touch(); }} className={input} /></div>
          <div>{label(t.fld_phone)}<input value={phone} onChange={(e) => { setPhone(e.target.value); touch(); }} placeholder="+90 5xx xxx xx xx" inputMode="tel" className={input} /></div>
          <div className="col-span-full">{label(t.fld_email)}<input value={me.email} readOnly className={inputRo} /><div className="mt-[5px] text-[11.5px] text-muted">{t.prof_mail_note}</div></div>
        </div>
        <div className="mt-4 flex justify-end"><button type="button" onClick={save} disabled={saving || !dirty} className={primary}><IconCheck size={16} /> {t.btn_save}</button></div>
      </div>

      {profCanCompany && (
        <div className={`${card} mb-[14px]`}>
          <h3 className="mb-4 text-[15px] font-bold text-ink">{t.prof_company} <span className="text-[12.5px] font-normal text-text-2">{t.prof_forclients}</span></h3>
          <div className="grid grid-cols-2 gap-[14px] max-md:grid-cols-1">
            <div className="col-span-full">{label(t.fld_org)}<input placeholder="New Level İnşaat Ltd. Şti." onChange={() => touch()} className={input} /></div>
            <div>{label(t.fld_director)}<input placeholder="Ad Soyad" onChange={() => touch()} className={input} /></div>
            <div>{label(t.fld_tax)}<input placeholder="1234567890" onChange={() => touch()} className={input} /></div>
            <div>{label(t.fld_bik)}<input placeholder="Ziraat Bankası" onChange={() => touch()} className={input} /></div>
            <div>{label(t.fld_iban)}<input placeholder="TR00 0000 0000 0000 0000 0000 00" onChange={() => touch()} className={input} /></div>
          </div>
        </div>
      )}

      {/* Безопасность */}
      <div className={`${card} mb-[14px]`}>
        <h3 className="mb-4 flex items-center gap-2 text-[15px] font-bold text-ink"><IconLock size={16} className="text-muted" /> {t.prof_security}</h3>
        {label(t.fld_newpass)}
        <div className="mb-2 flex flex-wrap gap-[9px]">
          <input value={pass} onChange={(e) => { setPass(e.target.value); setCopied(false); }} placeholder="••••••••" className={`${input} min-w-[150px] flex-1 font-mono tracking-[.03em]`} autoComplete="new-password" />
          <button type="button" onClick={gen} className={secondary}><IconRefresh size={14} /> {t.btn_generate}</button>
          {!!pass && <button type="button" onClick={copy} className={secondary}>{copied ? <IconCheck size={14} className="text-green" /> : <IconCopy size={14} />} {copied ? t.copied : t.btn_copy}</button>}
        </div>
        <div className="text-[12px] text-text-2">{t.pass_hint}</div>
        <div className="mt-[14px] flex justify-end"><button type="button" onClick={savePass} disabled={passBusy || !pass} className={primary}><IconLock size={15} /> {t.btn_save_pass}</button></div>
        <div className="my-4 border-t border-dashed border-line" />
        <TwoFactorCard L={{ title: t.tfa_title, sub: t.tfa_sub, on: t.tfa_on, off: t.tfa_off, enable: t.tfa_enable, disable: t.tfa_disable, code: t.tfa_code, verify: t.tfa_verify, done: t.tfa_done, removed: t.tfa_removed, bad: t.tfa_bad, secret: t.tfa_secret, qr: t.tfa_qr, get: t.tfa_get, relogin: t.tfa_relogin, cancel: t.cancel }} />
      </div>

      <div className="mb-[14px] flex flex-wrap items-center gap-3 rounded-[16px] border border-line bg-surface px-[18px] py-4">
        <IconShieldCheck size={19} className="flex-none text-muted" />
        <div className="min-w-[180px] flex-1 text-[13px] leading-[1.45] text-text-2">{t.pl.inline}</div>
        <button type="button" onClick={() => setLegal(true)} className="flex-none cursor-pointer whitespace-nowrap text-[13px] font-bold text-blue">{t.pl.view_all} →</button>
      </div>

      <div className="flex justify-end">
        <button type="button" onClick={logout} className="inline-flex cursor-pointer items-center gap-[7px] rounded-[10px] border border-line bg-surface px-4 py-[10px] text-[13.5px] font-semibold text-red hover:bg-red-tint"><IconLogout size={16} /> {t.btn_logout}</button>
      </div>

      {legal && <LegalModal onClose={() => setLegal(false)} />}
    </div>
  );
}
