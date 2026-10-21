"use client";

// «Профиль» — prototype lines 1403–1534 (markup), 3680–3700 / 3824–3826 / 4243–4285 (logic).
import { PhoneInput } from "@/components/ui/PhoneInput";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  IconAddressBook, IconAlertTriangle, IconAt, IconBrandApple, IconBrandGooglePlay, IconBrandTelegram, IconBrandWechat, IconBrandWhatsapp,
  IconCircleCheck, IconExternalLink, IconEye, IconEyeOff, IconLock, IconLogout, IconPhone, IconPlus, IconWand,
} from "@tabler/icons-react";
import { useT } from "@/i18n/provider";
import { TwoFactorCard } from "@/components/auth/TwoFactor";
import { GEO } from "@/lib/seed";
import { useMahalleLoaded } from "@/lib/geo";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import { showToast } from "@/components/ui/toast";
import { saveProfile, useProfile } from "@/store/profile";
import { Avatar } from "@/components/ui/UserMenu";
import { uploadFile } from "@/lib/upload";
import { AvatarCropper } from "@/components/ui/AvatarCropper";
import { updateMyProfile } from "@/app/(app)/profile/actions";
import { IconCamera, IconTrash } from "@tabler/icons-react";

const input = "w-full rounded-[10px] border border-line px-[11px] py-[10px] text-[13.5px] outline-none focus:border-blue";
const label = "mb-[6px] block text-[12.5px] font-semibold text-text-2";
// Prototype `chipF`.
const chipCls = (on: boolean) => `cursor-pointer rounded-[18px] border px-[13px] py-[9px] text-[12.5px] transition-[background,border-color] duration-[120ms] hover:bg-line-2 ${on ? "border-sel-line bg-blue-tint font-bold text-sel-ink" : "border-line bg-surface font-semibold text-[#3d4a5e]"}`;
const smallBtn = "cursor-pointer rounded-[9px] border border-line bg-surface px-[13px] py-2 text-[12.5px] font-semibold text-text hover:brightness-[.96]";
const primSmall = "cursor-pointer rounded-[9px] bg-blue-2 px-[14px] py-2 text-[12.5px] font-bold text-white hover:brightness-[.92]";
const link = "cursor-pointer text-blue underline hover:text-blue-2";
const PW_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

/** Channel toggle — prototype `swS`/`knobS` (lines 3682–3683): 40×24, knob 18, colour per channel. */
function Switch({ on, color, onClick }: { on: boolean; color: string; onClick: () => void }) {
  return (
    <div onClick={onClick} role="switch" aria-checked={on} className="relative h-6 w-10 flex-none cursor-pointer rounded-[12px] transition-[background] duration-150 hover:brightness-[.96]" style={{ background: on ? color : "#d5dce6" }}>
      <span className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-[left] duration-150" style={{ left: on ? 19 : 3 }} />
    </div>
  );
}
function Row({ icon, name, byline, right, muted }: { icon: ReactNode; name: string; byline?: ReactNode; right: ReactNode; muted?: boolean }) {
  return (
    <div className={`flex items-center justify-between border-t border-[#f2f4f8] py-[11px] ${muted ? "opacity-55" : ""}`}>
      <span className={`flex items-center gap-2 text-[13.5px] ${muted ? "text-muted" : "text-ink"}`}>{icon} {name} {byline}</span>
      {right}
    </div>
  );
}
// «Проверить» opens the messenger with this number — the app itself tells whether an account exists.
const Verify = ({ href, text }: { href: string; text: string }) => <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-[3px] text-[11px] font-semibold text-blue hover:underline"><IconExternalLink size={12} /> {text}</a>;

export default function ProfilePage() {
  useMahalleLoaded();
  const t = useT();
  const router = useRouter();
  const p = useProfile();
  // Unsaved edits only; until the user types, the fields mirror the store (which is seeded from Supabase after hydration).
  const [nameDraft, setName] = useState<string | null>(null);
  const [phoneDraft, setPhone] = useState<string | null>(null);
  const name = nameDraft ?? p.name;
  const phone = phoneDraft ?? p.phone;
  const [areasOpen, setAreasOpen] = useState(false);
  const [tgOptLogin, setTgOptLogin] = useState(false);
  const [mxForm, setMxForm] = useState(false);
  const [mxId, setMxId] = useState(p.mxId);
  const [wcForm, setWcForm] = useState(false);
  const [wcId, setWcId] = useState(p.wcId);
  const [pwEdit, setPwEdit] = useState(false);
  const [pwShow, setPwShow] = useState(false);
  const [pw, setPw] = useState({ old: "", n: "", c: "" });

  const initials = name.split(" ").map((w) => w[0]).join("").toUpperCase().slice(0, 2);
  // фото профиля (12.10.2026): хранится в user_metadata.avatar_url, файл — media/dev/avatars/<uid>; с телефона — любой формат
  const [uid, setUid] = useState("");
  const [avatar, setAvatar] = useState<string | null>(null);
  const [upBusy, setUpBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!hasSupabaseEnv()) return; createClient().auth.getUser().then(({ data }) => { setUid(data.user?.id ?? ""); setAvatar((data.user?.user_metadata?.avatar_url as string | undefined) || null); }).catch(() => {}); }, []);
  // выбранный файл открывает окно кадрирования (круг, сдвиг, масштаб, поворот — 21.10.2026); загружается уже вырезанный квадрат 512 px
  const [cropFile, setCropFile] = useState<File | null>(null);
  const pickPhoto = (file: File | undefined) => { if (file) setCropFile(file); if (fileRef.current) fileRef.current.value = ""; };
  const uploadAvatar = async (jpg: File) => {
    setCropFile(null); setUpBusy(true);
    try { const up = await uploadFile(jpg, `dev/avatars/${uid || "demo"}`); if (hasSupabaseEnv()) await updateMyProfile({ avatar_url: up.url }); setAvatar(up.url); showToast(t.prof.saved); router.refresh(); }
    catch (e) { showToast((e as Error).message); } finally { setUpBusy(false); }
  };
  const removePhoto = async () => { setUpBusy(true); try { if (hasSupabaseEnv()) await updateMyProfile({ avatar_url: "" }); setAvatar(null); router.refresh(); } catch (e) { showToast((e as Error).message); } finally { setUpBusy(false); } };
  const areaList = areasOpen ? GEO : GEO.filter((g) => p.areas.includes(g.k));
  const toggleArea = (k: string) => saveProfile({ areas: p.areas.includes(k) ? p.areas.filter((x) => x !== k) : [...p.areas, k] });
  const mxAdded = !!p.mxId;
  const wcAdded = !!p.wcId;
  const chVis = [t.prof.call, p.waOn && "WhatsApp", p.tgOn && "Telegram", p.vbOn && "Viber", p.mxOn && mxAdded && "MAX", p.wcOn && wcAdded && "WeChat"].filter(Boolean) as string[];
  const digits = p.phone.replace(/\D/g, "");

  async function pwSave() {
    if (!pw.old || !pw.n || pw.n !== pw.c) { showToast(t.prof.pwErr); return; }
    if (hasSupabaseEnv()) {
      const { error } = await createClient().auth.updateUser({ password: pw.n });
      if (error) { showToast(error.message); return; }
    }
    setPwEdit(false); showToast(t.prof.pwDone);
  }
  function pwGen() {
    let g = "";
    for (let i = 0; i < 8; i++) g += PW_CHARS[Math.floor(Math.random() * PW_CHARS.length)];
    setPw({ ...pw, n: g, c: g }); setPwShow(true);
  }
  async function logout() {
    if (hasSupabaseEnv()) await createClient().auth.signOut();
    router.push("/login");
    router.refresh();
  }
  const pwInput = (k: keyof typeof pw, l: string) => (
    <div>
      <label className={label}>{l}</label>
      <div className="relative">
        <input type={pwShow ? "text" : "password"} value={pw[k]} onChange={(e) => setPw({ ...pw, [k]: e.target.value })} placeholder="••••••" className={`${input} pr-[34px]`} />
        <button type="button" onClick={() => setPwShow((v) => !v)} className="absolute right-[9px] top-1/2 -translate-y-1/2 cursor-pointer text-muted">{pwShow ? <IconEyeOff size={16} /> : <IconEye size={16} />}</button>
      </div>
    </div>
  );
  const tgLoginInput = (
    <div className="relative mb-[6px] max-w-[320px]"><span className="absolute left-[11px] top-1/2 -translate-y-1/2 text-[13px] text-muted">@</span><input value={p.tgLogin} onChange={(e) => saveProfile({ tgLogin: e.target.value.replace(/^@/, "") })} placeholder="username" className={`${input} pl-[26px]`} /></div>
  );

  return (
    <div className="mx-auto max-w-[620px]">
      <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.prof.title}</h1>
      <p className="mb-[18px] mt-[5px] text-[14px] text-text-2 [text-wrap:pretty]">{t.prof.sub}</p>
      {/* «Подписка и оплата» скрыта: доступ для всех без ограничений (16.10.2026, решение пользователя) */}

      <div className="rounded-[16px] border border-line bg-surface p-[22px] max-md:p-4">
        <div className="mb-5 flex flex-wrap items-center gap-[14px]">
          {avatar ? <Avatar name={name} src={avatar} size={58} /> : <span className="flex h-[58px] w-[58px] items-center justify-center rounded-full bg-blue-2 text-[19px] font-extrabold text-white">{initials}</span>}
          {/* на телефоне кнопки — своей строкой под аватаром и именем (21.10.2026, «ФИО оказалось под кнопкой "Загрузить фото"») */}
          <div className="min-w-0 flex-1"><div className="truncate text-[16px] font-extrabold text-ink">{name}</div><div className="truncate text-[12.5px] text-muted">{p.agency}</div></div>
          <div className="flex flex-wrap items-center gap-2 max-md:basis-full">
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => pickPhoto(e.target.files?.[0])} />
            <AvatarCropper file={cropFile} onDone={(f) => void uploadAvatar(f)} onCancel={() => setCropFile(null)} />
            <button type="button" onClick={() => fileRef.current?.click()} disabled={upBusy} className={`${smallBtn} inline-flex items-center gap-[6px]`}><IconCamera size={15} /> {upBusy ? "…" : t.prof.photoChange}</button>
            {avatar && <button type="button" onClick={removePhoto} disabled={upBusy} className={`${smallBtn} inline-flex items-center gap-[6px] text-muted`}><IconTrash size={14} /> {t.prof.photoRemove}</button>}
          </div>
          <div className="w-full text-[12px] text-muted">{t.prof.photoHint}</div>
        </div>
        <div className="mb-[18px] grid grid-cols-[repeat(auto-fit,minmax(220px,1fr))] gap-[14px]">
          <div><label className={label}>{t.prof.name}</label><input value={name} onChange={(e) => setName(e.target.value)} className={input} /></div>
          <div><label className={label}>{t.prof.ag} <IconLock size={12} className="inline text-muted-2" /></label><input value={p.agency} readOnly title={t.prof.agLock} className={`${input} cursor-not-allowed bg-bg-3 text-muted`} /></div>
          <div><label className={label}>{t.prof.mail} <IconLock size={12} className="inline text-muted-2" /></label><input value={p.email} readOnly title={t.prof.mailLock} className={`${input} cursor-not-allowed bg-bg-3 text-muted`} /><div className="mt-1 text-[11px] text-muted-2">{t.prof.mailLock}</div></div>
        </div>

        <div className="mb-[18px]">
          <label className="mb-[3px] block text-[12.5px] font-semibold text-text-2">{t.prof.areasL}</label>
          <div className="mb-[9px] text-[11.5px] text-muted">{t.prof.areasS}</div>
          <div className="flex flex-wrap gap-[6px]">
            {areaList.map((g) => <span key={g.k} onClick={() => toggleArea(g.k)} className={chipCls(p.areas.includes(g.k))}>{g.n}</span>)}
            <span onClick={() => setAreasOpen((v) => !v)} className="inline-flex min-h-[31px] cursor-pointer items-center justify-center rounded-[16px] border border-dashed border-[#8fb0fe] bg-blue-tint px-[13px] text-[12px] font-bold leading-none text-blue-2 hover:bg-sel-tint">{areasOpen ? t.prof.areasCollapse : t.prof.areasAdd}</span>
          </div>
        </div>

        <div className="mb-[18px] border-t border-[#f2f4f8] pt-[18px]">
          <div className="mb-3 flex items-center gap-2 text-[14.5px] font-extrabold text-ink"><IconAddressBook size={17} className="text-muted" /> {t.prof.ch}</div>
          <label className={label}>{t.prof.phone}</label>
          <PhoneInput value={phone} onChange={setPhone} className={`${input} w-[260px]`} />
          <div className="mt-[7px] text-[11.5px] leading-[1.5] text-muted">{t.prof.chSelfH}</div>
          <div className="mb-[2px] mt-[14px] text-[11.5px] text-muted">{t.prof.chSub}</div>
          <Row icon={<IconPhone size={17} className="text-muted" />} name={t.prof.call} right={<span className="text-[11px] text-muted-2">{t.prof.always}</span>} />
          <Row icon={<IconBrandWhatsapp size={17} className="text-green-3" />} name="WhatsApp" byline={digits ? <Verify href={`https://wa.me/${digits}`} text={t.prof.verify} /> : undefined} right={<Switch on={p.waOn} color="#22c15e" onClick={() => saveProfile({ waOn: !p.waOn })} />} />
          <Row icon={<IconBrandTelegram size={17} className="text-blue" />} name="Telegram" byline={p.tgLogin ? <span className="text-[11px] text-muted-2">@{p.tgLogin}</span> : digits ? <Verify href={`https://t.me/+${digits}`} text={t.prof.verify} /> : undefined} right={<Switch on={p.tgOn} color="#4d7cfe" onClick={() => saveProfile({ tgOn: !p.tgOn })} />} />
          {p.tgOn && !tgOptLogin && <div className="mb-[10px] text-[11.5px] leading-[1.5] text-text-2"><IconAt size={13} className="inline" /> {t.prof.optLoginH} <span onClick={() => setTgOptLogin(true)} className={link}>{t.prof.optLogin}</span></div>}
          {p.tgOn && tgOptLogin && (
            <>
              {tgLoginInput}
              <div className="mb-2 text-[11.5px] leading-[1.5] text-text-2"><IconCircleCheck size={13} className="inline text-green" /> {t.prof.optDoneH}</div>
              <div className="mb-2 flex gap-2"><button type="button" onClick={() => setTgOptLogin(false)} className={smallBtn}>{t.common.cancel}</button><button type="button" onClick={() => { setTgOptLogin(false); showToast(t.prof.saved); }} className={primSmall}>{t.prof.save}</button></div>
            </>
          )}
          <Row icon={<span className="inline-flex h-[17px] w-[17px] flex-none items-center justify-center rounded-full bg-[#7360f2] text-[10px] font-extrabold text-white">V</span>} name="Viber" byline={digits ? <Verify href={`viber://chat?number=%2B${digits}`} text={t.prof.verify} /> : undefined} right={<Switch on={p.vbOn} color="#7360f2" onClick={() => saveProfile({ vbOn: !p.vbOn })} />} />
          {mxAdded ? (
            <Row icon={<span className="inline-flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[5px] bg-[#7b4fd0] text-[9px] font-extrabold text-white">M</span>} name="MAX" byline={<span className="text-[11px] text-muted-2">{t.prof.byHand} · {p.mxId}</span>} right={<Switch on={p.mxOn} color="#7b4fd0" onClick={() => saveProfile({ mxOn: !p.mxOn })} />} />
          ) : (
            <>
              <Row muted icon={<span className="inline-flex h-[17px] w-[17px] flex-none items-center justify-center rounded-[5px] bg-[#c3c9d4] text-[9px] font-extrabold text-white">M</span>} name="MAX · RU" right={<span className="text-[11px] text-muted-2">{t.prof.mxByNumber}</span>} />
              {!mxForm && <div className="mb-2 text-[11.5px] text-text-2"><IconPlus size={13} className="inline" /> <span onClick={() => setMxForm(true)} className={link}>{t.prof.mxAdd}</span></div>}
              {mxForm && (
                <>
                  <PhoneInput value={mxId} onChange={setMxId} placeholder="+7 ___ ___ __ __" className={`${input} mb-[6px] w-[260px]`} />
                  <div className="mb-2 text-[11.5px] leading-[1.5] text-text-2">{t.prof.mxManualH}</div>
                  <div className="mb-2 flex gap-2"><button type="button" onClick={() => setMxForm(false)} className={smallBtn}>{t.common.cancel}</button><button type="button" onClick={() => { if (!mxId.trim()) { showToast(t.prof.mxManualH); return; } saveProfile({ mxId, mxOn: true }); setMxForm(false); }} className={primSmall}>{t.prof.add}</button></div>
                </>
              )}
            </>
          )}
          {wcAdded ? (
            <Row icon={<IconBrandWechat size={17} className="text-[#07c160]" />} name="WeChat" byline={<span className="text-[11px] text-muted-2">ID: {p.wcId}</span>} right={<Switch on={p.wcOn} color="#07c160" onClick={() => saveProfile({ wcOn: !p.wcOn })} />} />
          ) : (
            <>
              <Row muted icon={<IconBrandWechat size={17} className="text-[#c3c9d4]" />} name="WeChat" right={<span className="text-[11px] text-muted-2">{t.prof.byId}</span>} />
              {!wcForm && <div className="mb-2 text-[11.5px] text-text-2"><span onClick={() => setWcForm(true)} className={link}>{t.prof.wcAdd}</span></div>}
              {wcForm && (
                <>
                  <input value={wcId} onChange={(e) => setWcId(e.target.value)} placeholder="weixin_id" className={`${input} mb-[6px] w-[220px]`} />
                  <div className="mb-2 text-[11.5px] leading-[1.5] text-text-2">{t.prof.wcH}</div>
                  <div className="mb-2 flex gap-2"><button type="button" onClick={() => setWcForm(false)} className={smallBtn}>{t.common.cancel}</button><button type="button" onClick={() => { if (!wcId.trim()) { showToast(t.prof.wcH); return; } saveProfile({ wcId, wcOn: true }); setWcForm(false); }} className={primSmall}>{t.prof.add}</button></div>
                </>
              )}
            </>
          )}
          {!p.waOn && !p.tgOn && <div className="mt-[10px] rounded-[10px] bg-warn-tint px-[13px] py-[10px] text-[12px] leading-[1.5] text-[#8a6400]"><IconAlertTriangle size={14} className="inline" /> {t.prof.warnNone}</div>}
          <div className={`mt-3 flex items-center gap-[6px] rounded-[10px] px-[13px] py-[10px] text-[12.5px] ${chVis.length === 1 ? "bg-bg-2 text-text" : "bg-green-tint text-[#2f7d4f]"}`}><IconEye size={15} /> <span>{t.prof.sees} <b>{chVis.join(" · ")}</b></span></div>
        </div>

        <div className="mb-4 border-t border-[#f2f4f8] pt-[18px]">
          <div className="mb-3 flex items-center gap-2 text-[14.5px] font-extrabold text-ink"><IconLock size={17} className="text-muted" /> {t.prof.sec}</div>
          {!pwEdit ? (
            <div className="flex items-center justify-between gap-[10px]">
              <div><div className="text-[13.5px] font-bold text-ink">{t.prof.pass}</div><div className="mt-[2px] text-[12px] tracking-[2px] text-muted-2">••••••••</div></div>
              <button type="button" onClick={() => { setPwEdit(true); setPw({ old: "", n: "", c: "" }); setPwShow(false); }} className="cursor-pointer rounded-[9px] border border-line bg-surface px-[14px] py-2 text-[12.5px] font-semibold text-text hover:border-blue hover:text-blue">{t.prof.chg}</button>
            </div>
          ) : (
            <>
              <div className="mb-3 flex max-w-[320px] flex-col gap-3">{pwInput("old", t.prof.oldP)}{pwInput("n", t.prof.newP)}{pwInput("c", t.prof.confP)}</div>
              <div className="flex flex-wrap items-center gap-2">
                <span onClick={pwGen} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[9px] bg-blue-tint px-[13px] py-2 text-[12.5px] font-semibold text-blue-2 hover:bg-sel-tint"><IconWand size={14} /> {t.prof.pwGenB}</span>
                <div className="flex-1" />
                <button type="button" onClick={() => setPwEdit(false)} className={smallBtn}>{t.common.cancel}</button>
                <button type="button" onClick={pwSave} className={primSmall}>{t.prof.upd}</button>
              </div>
            </>
          )}
          <div className="my-[14px] border-t border-[#f2f4f8]" />
          <TwoFactorCard L={{ title: t.prof.tfaT, sub: t.prof.tfaS, on: t.prof.tfaOn, off: t.prof.tfaOff, enable: t.prof.tfaEnable, disable: t.prof.tfaDisable, code: t.prof.tfaCode, verify: t.prof.tfaVerify, done: t.prof.tfaDone, removed: t.prof.tfaRemoved, bad: t.prof.tfaBad, secret: t.prof.tfaSecret, qr: t.prof.tfaQr, get: t.prof.tfaGet, relogin: t.prof.tfaRelogin, cancel: t.common.cancel }} />
        </div>

        <div className="flex gap-[10px]">
          <button type="button" onClick={() => { saveProfile({ name: name.trim() || p.name, phone }); setName(null); setPhone(null); showToast(t.prof.saved); }} className="cursor-pointer rounded-[11px] bg-blue-2 px-5 py-[11px] text-[14px] font-bold text-white hover:bg-blue-3">{t.prof.save}</button>
          <div className="flex-1" />
          <button type="button" onClick={logout} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[11px] border border-line bg-surface px-4 py-[11px] text-[13.5px] font-semibold text-red hover:brightness-[.96]"><IconLogout size={16} /> {t.prof.out}</button>
        </div>
      </div>
    </div>
  );
}
