"use client";

// Sign-in screen — prototype lines 124–142 (card), 144–178 (access request modal), 1896–1917 (password recovery).
// Supabase sign-in + the red error block are an extension over the prototype (which only flips `logged:true`).
import { PhoneInput } from "@/components/ui/PhoneInput";
import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { IconAlertCircle, IconCircleCheck, IconFilePencil, IconLock, IconLogin2, IconMailCheck, IconMailForward, IconShieldCheck, IconUserPlus } from "@tabler/icons-react";
import { Logo } from "@/components/Logo";
import { LangSwitch } from "@/components/LangSwitch";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import { REALTORS } from "@/lib/seed";
import { normPh, validMail } from "@/lib/phone";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import { MfaCodeForm, mfaNeeded } from "@/components/auth/TwoFactor";
import { submitAccessRequest, submitUnblockRequest } from "@/app/lead-actions";

const inputCls = "w-full rounded-[11px] border border-line px-[13px] py-[11px] text-[14px] outline-none focus:border-blue";
const labelCls = "mb-[6px] block text-[12.5px] font-semibold text-text-2";
const badCls = "border-red bg-red-tint"; // незаполненное обязательное поле после попытки отправки
const primary = "flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-blue-2 py-[13px] text-[14.5px] font-bold text-white transition hover:bg-blue-3 disabled:opacity-60";
const primaryM = "flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-blue-2 py-[13px] text-[14px] font-bold text-white transition hover:bg-blue-3 disabled:opacity-60";
const errCls = "mb-3 flex items-start gap-2 rounded-[11px] bg-red-tint px-[13px] py-[11px] text-[12.5px] text-red-2";

/** Prototype `chipF(on)` (line ~470028): agency chip in the request form. */
const chipCls = (on: boolean) =>
  `cursor-pointer rounded-[18px] border px-[13px] py-[9px] text-[12.5px] transition-[background,border-color] duration-[.12s] hover:bg-[#eef1f6] ${on ? "border-sel-line bg-blue-tint font-bold text-sel-ink" : "border-line bg-surface font-semibold text-[#3d4a5e]"}`;

// Demo credentials (prototype state, line 2498) are pre-filled only when explicitly enabled — never in production.
const DEMO = process.env.NEXT_PUBLIC_DEMO_LOGIN === "1";

function LoginInner() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const [email, setEmail] = useState(DEMO ? "realtor@one-plan.pro" : "");
  const [pass, setPass] = useState(DEMO ? "Realtor1@plan" : "");
  // `?blocked=paused|pending` — сюда отправляет /auth/blocked после закрытия сессии заблокированного пользователя
  const [err, setErr] = useState<string | null>(() => { const b = params.get("blocked"); return b === "paused" ? t.login.blockedPaused : b === "pending" ? t.login.blockedPending : null; });
  const [busy, setBusy] = useState(false);
  const [modal, setModal] = useState<"" | "reg" | "fpw" | "unb">("");
  const [mfaDest, setMfaDest] = useState<string | null>(null); // пароль принят, включена 2FA — ждём код
  const blocked = params.get("blocked") === "paused" || params.get("blocked") === "pending" || /приостановлен|модерации|suspended|under review|askıya|inceleniyor/i.test(err ?? "");
  const [miss, setMiss] = useState<string[]>([]); // email | pass — пустые или отклонённые при входе поля

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setErr(null);
    const missing = [!email.trim() && "email", !pass && "pass"].filter(Boolean) as string[];
    if (missing.length) { setMiss(missing); setErr(`${t.rl.reqErr}: ${missing.map((k) => (k === "email" ? t.login.email : t.login.pass)).join(", ")}`); return; }
    setMiss([]);
    const next = params.get("next") || "/catalog";
    if (!hasSupabaseEnv()) { router.push(next); return; } // local UI mode — prototype `doLogin` just sets `logged:true`
    setBusy(true);
    const sb = createClient();
    const { data, error } = await sb.auth.signInWithPassword({ email, password: pass });
    setBusy(false);
    if (error) { setMiss(["email", "pass"]); setErr(/invalid login credentials/i.test(error.message) ? t.login.badCreds : error.message); return; }
    // Developers land in their cabinet, everyone else in the realtors base (or where they were going).
    const { data: prof } = await sb.from("profiles").select("role, status").eq("id", data.user.id).maybeSingle();
    // «Пауза» / «На модерации» — в систему не пускаем: сессию закрываем сразу, показываем причину.
    if (prof && prof.role !== "admin" && prof.status !== "active") { await sb.auth.signOut(); setErr(prof.status === "paused" ? t.login.blockedPaused : t.login.blockedPending); return; }
    const dest = prof?.role === "developer" && next === "/catalog" ? "/dev" : next;
    // 2FA включена — второй шаг: код из приложения-аутентификатора
    if (await mfaNeeded(sb)) { setMfaDest(dest); return; }
    // Full navigation (not router.push + refresh): refresh re-ran the proxy on /login, which redirected to /catalog
    // before the push landed — developers saw the realtors chrome flash before /dev.
    window.location.assign(dest);
  }

  if (mfaDest) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7f8fb,#eef1f6)] p-6">
        <div className="animate-card w-[410px] max-w-full rounded-[20px] border border-line bg-surface px-8 py-[34px] shadow-card max-md:px-5">
          <div className="mb-[18px] flex justify-center"><Logo size={28} textSize={21} /></div>
          <MfaCodeForm L={{ title: t.login.mfaT, sub: t.login.mfaS, code: t.prof.tfaCode, verify: t.prof.tfaVerify, bad: t.prof.tfaBad }} onDone={() => window.location.assign(mfaDest)} />
          <button type="button" onClick={async () => { try { await createClient().auth.signOut(); } catch {} setMfaDest(null); }} className="mt-4 w-full cursor-pointer text-center text-[12.5px] font-semibold text-muted hover:text-ink">{t.login.mfaBack}</button>
        </div>
      </div>
    );
  }
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7f8fb,#eef1f6)] p-6">
      <form onSubmit={onSubmit} className="animate-card w-[410px] max-w-full rounded-[20px] border border-line bg-surface px-8 py-[34px] shadow-card max-md:px-5">
        <div className="mb-[10px] flex justify-center"><Logo size={28} textSize={21} /></div>
        <div className="mb-[22px] text-center">
          <span className="inline-flex items-center gap-[6px] rounded-full bg-blue-tint px-[13px] py-[6px] text-[12px] font-bold text-blue"><IconLock size={14} stroke={2.2} /> {t.common.badge}</span>
        </div>
        <h1 className="mb-[6px] text-center text-[22px] font-extrabold tracking-[-0.02em] text-ink">{t.login.title}</h1>
        <p className="mb-[22px] text-center text-[13.5px] leading-[1.55] text-text-2 [text-wrap:pretty]">{t.login.sub}</p>
        <label className={labelCls} htmlFor="email">{t.login.email}</label>
        <input id="email" type="email" autoComplete="email" value={email} onChange={(e) => { setEmail(e.target.value); setMiss([]); }} className={`${inputCls} mb-[14px] ${miss.includes("email") ? badCls : ""}`} />
        <label className={labelCls} htmlFor="pass">{t.login.pass}</label>
        <input id="pass" type="password" autoComplete="current-password" value={pass} onChange={(e) => { setPass(e.target.value); setMiss([]); }} className={`${inputCls} mb-[20px] ${miss.includes("pass") ? badCls : ""}`} />
        <div className="-mt-[6px] mb-3 flex justify-end">
          <button type="button" onClick={() => setModal("fpw")} className="cursor-pointer text-[12.5px] font-semibold text-blue hover:underline">{t.login.forgot}</button>
        </div>
        {err && <div className={errCls}><IconAlertCircle size={16} className="mt-[1px] shrink-0" /><span>{err}</span></div>}
        {blocked && <button type="button" onClick={() => setModal("unb")} className="mb-4 inline-flex w-full cursor-pointer items-center justify-center gap-[7px] rounded-[12px] border border-[#d8e3ff] bg-blue-tint px-4 py-[11px] text-[13.5px] font-bold text-blue hover:bg-[#e2ebff]"><IconMailForward size={16} /> {t.login.blockedWrite}</button>}
        <button type="submit" disabled={busy} className={primary}><IconLogin2 size={18} /> {t.login.btn}</button>
        <div className="mt-[18px] flex items-start gap-[9px] rounded-[12px] bg-bg-3 px-[14px] py-3 text-[12.5px] leading-[1.5] text-text"><IconUserPlus size={16} className="mt-[1px] shrink-0 text-blue" /><span>{t.login.invite}</span></div>
        <button type="button" onClick={() => setModal("reg")} className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-line bg-surface py-3 text-[13.5px] font-bold text-blue-2 transition hover:border-blue hover:bg-[#f8faff]"><IconFilePencil size={17} /> {t.login.regB}</button>
        <div className="mt-5 flex justify-center"><LangSwitch /></div>
      </form>
      <RegModal open={modal === "reg"} lang={lang} onClose={() => setModal("")} />
      {/* `fpwOpenB` (3703) copies the typed login email into the recovery form. */}
      <ForgotModal open={modal === "fpw"} initialMail={email} onClose={() => setModal("")} />
      <UnblockModal open={modal === "unb"} initialMail={email} lang={lang} onClose={() => setModal("")} />
    </div>
  );
}

// ---- Access request (prototype 144–178, regSubmit 4218–4235) ------------------------------------------------

/** Prototype `mailOf` (3585): demo realtors have no `mail` field, the address is derived from the key. */
const mailOf = (k: string) => (REALTORS[k] as { mail?: string }).mail || (k === "me" ? "realtor@one-plan.pro" : `${k}@one-plan.pro`);

/** Prototype `dupCheck` (3587): email/phone already used by a member → `t.rl.dupMail` / `t.rl.dupPhone`. */
function dupCheck(mail: string, phone: string, t: { dupMail: string; dupPhone: string }) {
  for (const k of Object.keys(REALTORS)) {
    if (mail && mailOf(k).toLowerCase() === mail.toLowerCase()) return t.dupMail;
    if (phone && normPh(REALTORS[k].phone) === normPh(phone)) return t.dupPhone;
  }
  return "";
}

let lastReg = 0; // prototype `this._lastReg` — 60 s rate-limit between requests
const capPair = () => ({ a: 2 + Math.floor(Math.random() * 7), b: 2 + Math.floor(Math.random() * 7) });
const REG_EMPTY = { name: "", phone: "+90 ", mail: "", ag: "", co: "", role: "realtor" as "realtor" | "developer", cap: "", hp: "" };

function RegModal({ open, lang, onClose }: { open: boolean; lang: string; onClose: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState(REG_EMPTY);
  const [cap, setCap] = useState(capPair);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  const [miss, setMiss] = useState<string[]>([]); // ключи полей с ошибкой: name | phone | mail | co
  const set = (p: Partial<typeof f>) => { setF((x) => ({ ...x, ...p })); if (miss.length) setMiss((m) => m.filter((k) => !(k in p))); };
  const bad = (k: string) => (miss.includes(k) ? badCls : "");

  // `regOpenB` (4218): every opening regenerates the captcha, clears the error/answer/honeypot and restores `+90 `.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setCap(capPair());
      setDone(false);
      setErr("");
      setMiss([]);
      setF((x) => ({ ...x, phone: x.phone || "+90 ", cap: "", hp: "" }));
    }
  }

  async function submit() {
    setErr("");
    const fieldL: Record<string, string> = { name: t.prof.name, phone: t.prof.phone, mail: t.prof.mail, co: t.login.regCoL, cap: t.login.regCapL };
    const missing = (["name", "phone", "mail"] as const).filter((k) => !f[k].trim() || (k === "phone" && normPh(f.phone).length <= 2) /* только код страны «+90» */);
    if (f.role === "developer" && !f.co.trim()) missing.push("co" as never);
    if (!f.cap.trim()) missing.push("cap" as never);
    if (missing.length) { setMiss(missing); setErr(`${t.rl.reqErr}: ${missing.map((k) => fieldL[k]).join(", ")}`); return; }
    if (!validMail(f.mail)) { setMiss(["mail"]); setErr(t.rl.mailErr); return; }
    if (normPh(f.phone).length < 10) { setMiss(["phone"]); setErr(t.login.regPhoneErr); return; }
    setMiss([]);
    const d2 = dupCheck(f.mail.trim(), f.phone.trim(), t.rl);
    if (d2) { setErr(d2 + " " + t.login.regDup); return; }
    if (f.hp) { setDone(true); return; } // honeypot — silent success (4232)
    if (+f.cap !== cap.a + cap.b) { setMiss(["cap"]); setErr(t.login.regCapErr); return; }
    const now = Date.now();
    if (lastReg && now - lastReg < 60000) { setErr(t.login.regRate); return; }
    lastReg = now;
    if (hasSupabaseEnv()) {
      setBusy(true);
      // Free agent = empty agency string (the prototype's empty `regAgTxt`), not a localized label.
      // Застройщик: роль `developer` + название компании в `company`; риэлтор — агентство (пустое = свободный агент).
      const dev = f.role === "developer";
      const r = await submitAccessRequest({ name: f.name.trim(), phone: f.phone.trim(), email: f.mail.trim(), agency: dev ? "" : f.ag.trim(), company: dev ? f.co.trim() : null, role: f.role, lang });
      setBusy(false);
      if (!r.ok) { setErr(r.error || t.rl.reqErr); return; }
    }
    setDone(true);
  }

  const free = !f.ag.trim();

  return (
    <Modal open={open} onClose={onClose} width={460} z={410} sheet="fit">
      <div className="mb-[6px] flex items-center gap-[10px]"><span className="flex-1 text-[16px] font-extrabold text-ink">{t.login.regT}</span><ModalClose onClick={onClose} /></div>
      {done ? (
        <div className="px-2 py-[22px] text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-tint text-green"><IconCircleCheck size={27} /></div>
          <div className="mb-[6px] text-[15px] font-extrabold text-ink">{t.login.regDoneT}</div>
          <div className="text-[13px] leading-[1.55] text-text-2 [text-wrap:pretty]">{t.login.regDoneS}</div>
        </div>
      ) : (
        <>
          <p className="mb-4 text-[12.5px] leading-[1.5] text-text-2 [text-wrap:pretty]">{t.login.regS}</p>
          {/* Кто подаёт заявку: риэлтор (агентство / свободный агент) или застройщик (компания). Роль уходит в `access_requests.role`. */}
          <label className={labelCls}>{t.login.regRole}</label>
          <div className="mb-3 flex gap-[6px]">
            {(["realtor", "developer"] as const).map((r) => <button key={r} type="button" onClick={() => set({ role: r })} className={`${chipCls(f.role === r)} flex-1 text-center`}>{r === "realtor" ? t.login.regRoleR : t.login.regRoleD}</button>)}
          </div>
          <label className={labelCls}>{t.prof.name} <span className="text-red">*</span></label>
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} className={`${inputCls} mb-3 ${bad("name")}`} />
          <label className={labelCls}>{t.prof.phone} <span className="text-red">*</span></label>
          <PhoneInput value={f.phone} onChange={(v) => set({ phone: v })} className={`${inputCls} mb-1 ${bad("phone")}`} />
          <div className="mb-3 text-[11px] text-muted-2">{t.login.regPhoneH}</div>
          <label className={labelCls}>{t.prof.mail} <span className="text-red">*</span></label>
          <input value={f.mail} onChange={(e) => set({ mail: e.target.value })} placeholder="name@agency.com" className={`${inputCls} mb-3 ${bad("mail")}`} />
          {f.role === "developer" ? (
            <>
              <label className={labelCls}>{t.login.regCoL} <span className="text-red">*</span></label>
              <input value={f.co} onChange={(e) => set({ co: e.target.value })} placeholder={t.login.regCoPh} className={`${inputCls} mb-4 ${bad("co")}`} />
            </>
          ) : (
            <>
              <label className={labelCls}>{t.rl.agL}</label>
              {/* Chip is "on" while the agency text is empty (`chipF(!regAgTxt.trim())`); clicking it clears the text (4223–4224). */}
              <div className="mb-2 flex flex-wrap gap-[6px]"><button type="button" onClick={() => set({ ag: "" })} className={chipCls(free)}>{t.rl.agFree}</button></div>
              <input value={f.ag} onChange={(e) => set({ ag: e.target.value })} placeholder={t.rl.agWrite} className={`${inputCls} mb-4`} />
            </>
          )}
          <input value={f.hp} onChange={(e) => set({ hp: e.target.value })} tabIndex={-1} autoComplete="off" aria-hidden className="pointer-events-none absolute -left-[9999px] h-px w-px opacity-0" />
          <label className={labelCls}><IconShieldCheck size={13} className="inline text-green" /> {t.login.regCapL}</label>
          <div className="mb-3 flex items-center gap-[10px]">
            <span className="flex-none select-none rounded-[10px] bg-bg-2 px-[15px] py-[10px] text-[15px] font-extrabold tracking-[.06em] text-ink">{cap.a} + {cap.b} = ?</span>
            <input value={f.cap} onChange={(e) => set({ cap: e.target.value.replace(/\D/g, "") })} placeholder="0" className={`w-[90px] rounded-[11px] border border-line px-[13px] py-[11px] text-center text-[15px] font-bold outline-none focus:border-blue ${bad("cap")}`} inputMode="numeric" />
          </div>
          {err && <div className={errCls}><IconAlertCircle size={16} className="mt-[1px] shrink-0" /><span>{err}</span></div>}
          <button type="button" onClick={submit} disabled={busy} className={primaryM}>{t.login.regGo}</button>
        </>
      )}
    </Modal>
  );
}

// ---- «Написать администратору» (расширение, 07.10.2026): обращение заблокированного пользователя → access_requests (kind = unblock) ----
let lastUnb = 0;
function UnblockModal({ open, initialMail, lang, onClose }: { open: boolean; initialMail: string; lang: string; onClose: () => void }) {
  const { t } = useI18n();
  const [f, setF] = useState({ name: "", mail: "", msg: "" });
  const [miss, setMiss] = useState<string[]>([]);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);
  if (open !== wasOpen) { setWasOpen(open); if (open) { setDone(false); setMiss([]); setF((x) => ({ ...x, mail: x.mail || initialMail || "" })); } }
  const set = (p: Partial<typeof f>) => { setF((x) => ({ ...x, ...p })); if (miss.length) setMiss((m) => m.filter((k) => !(k in p))); };
  const bad = (k: string) => (miss.includes(k) ? badCls : "");
  async function send() {
    const missing = [!f.mail.trim() && "mail", !f.msg.trim() && "msg"].filter(Boolean) as string[];
    if (missing.length) { setMiss(missing); showToast(`${t.rl.reqErr}: ${missing.map((k) => (k === "mail" ? t.prof.mail : t.login.unbMsg)).join(", ")}`); return; }
    if (!validMail(f.mail)) { setMiss(["mail"]); showToast(t.rl.mailErr); return; }
    const now = Date.now();
    if (lastUnb && now - lastUnb < 60000) { showToast(t.login.regRate); return; }
    lastUnb = now;
    if (hasSupabaseEnv()) {
      setBusy(true);
      const r = await submitUnblockRequest({ name: f.name.trim(), email: f.mail.trim(), message: f.msg.trim(), lang });
      setBusy(false);
      if (!r.ok) { showToast(r.error || t.rl.reqErr); return; }
    }
    setDone(true);
  }
  return (
    <Modal open={open} onClose={onClose} width={460} z={410} sheet="fit">
      <div className="mb-[6px] flex items-center gap-[10px]"><span className="flex-1 text-[16px] font-extrabold text-ink">{t.login.unbT}</span><ModalClose onClick={onClose} /></div>
      {done ? (
        <div className="px-2 py-[22px] text-center">
          <div className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-tint text-green"><IconCircleCheck size={27} /></div>
          <div className="text-[13px] leading-[1.55] text-text-2 [text-wrap:pretty]">{t.login.unbDone}</div>
        </div>
      ) : (
        <>
          <p className="mb-4 text-[12.5px] leading-[1.5] text-text-2 [text-wrap:pretty]">{t.login.unbS}</p>
          <label className={labelCls}>{t.prof.mail} <span className="text-red">*</span></label>
          <input value={f.mail} onChange={(e) => set({ mail: e.target.value })} placeholder="name@agency.com" className={`${inputCls} mb-3 ${bad("mail")}`} />
          <label className={labelCls}>{t.prof.name}</label>
          <input value={f.name} onChange={(e) => set({ name: e.target.value })} className={`${inputCls} mb-3`} />
          <label className={labelCls}>{t.login.unbMsg} <span className="text-red">*</span></label>
          <textarea value={f.msg} onChange={(e) => set({ msg: e.target.value })} placeholder={t.login.unbPh} className={`${inputCls} mb-4 min-h-[96px] resize-y ${bad("msg")}`} />
          <button type="button" onClick={send} disabled={busy} className={primaryM}>{t.login.unbSend}</button>
        </>
      )}
    </Modal>
  );
}

// ---- Password recovery (prototype 1896–1917, fpwOpenB 3703, fpwSend 3706) -------------------------------------

function ForgotModal({ open, initialMail, onClose }: { open: boolean; initialMail: string; onClose: () => void }) {
  const { t } = useI18n();
  const [mail, setMail] = useState("");
  const [bad, setBad] = useState(false); // почта не прошла проверку — подсветка поля
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  const [wasOpen, setWasOpen] = useState(false);

  // `fpwOpenB`: `fpwDone:false, fpwMail: loginEmail || ''`.
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) { setDone(false); setMail(initialMail || ""); }
  }

  async function send() {
    if (!validMail(mail)) { setBad(true); showToast(t.rl.mailErr); return; }
    setBad(false);
    if (hasSupabaseEnv()) {
      setBusy(true);
      const { error } = await createClient().auth.resetPasswordForEmail(mail.trim(), { redirectTo: `${window.location.origin}/auth/callback` }); // → форма «Задайте пароль»
      setBusy(false);
      if (error) { showToast(error.message); return; }
    }
    setDone(true);
  }

  return (
    <Modal open={open} onClose={onClose} width={420} z={420} sheet="fit">
      <div className="mb-[6px] flex items-center gap-[10px]"><span className="flex-1 text-[16px] font-extrabold text-ink">{t.login.fpwT}</span><ModalClose onClick={onClose} /></div>
      {done ? (
        <div className="flex flex-col items-center px-0 pb-1 pt-[10px] text-center">
          <span className="mb-3 flex h-[54px] w-[54px] items-center justify-center rounded-full bg-green-tint text-green"><IconMailCheck size={26} /></span>
          <div className="mb-[6px] text-[15.5px] font-extrabold text-ink">{t.login.fpwDoneT}</div>
          <div className="mb-1 text-[12.5px] leading-[1.55] text-text-2 [text-wrap:pretty]">{mail}</div>
          <p className="mb-4 text-[12.5px] leading-[1.55] text-text-2 [text-wrap:pretty]">{t.login.fpwDoneS}</p>
          <button type="button" onClick={onClose} className="w-full cursor-pointer rounded-[12px] border border-line bg-surface py-3 text-[13.5px] font-bold text-ink transition hover:border-blue hover:text-blue">{t.login.fpwBack}</button>
        </div>
      ) : (
        <>
          <p className="mb-[14px] text-[12.5px] leading-[1.5] text-text-2 [text-wrap:pretty]">{t.login.fpwS}</p>
          <label className={labelCls}>{t.login.email}</label>
          <input type="email" value={mail} onChange={(e) => { setMail(e.target.value); setBad(false); }} placeholder="name@agency.com" className={`${inputCls} mb-[14px] ${bad ? badCls : ""}`} />
          <button type="button" onClick={send} disabled={busy} className={primaryM}><IconMailForward size={18} /> {t.login.fpwB}</button>
        </>
      )}
    </Modal>
  );
}

export default function LoginPage() {
  return <Suspense><LoginInner /></Suspense>;
}
