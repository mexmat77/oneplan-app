"use client";

// Invite link landing: one-plan.pro/join/<code> (prototype `invLink`, 4239) — registration form that creates
// the account with the invite's role. Fields mirror the access-request form (phone mask, agency chip); the
// password pair is an extension needed to actually create the account.
import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { IconAlertCircle, IconCircleCheck, IconLock, IconTicket } from "@tabler/icons-react";
import { Logo } from "@/components/Logo";
import { LangSwitch } from "@/components/LangSwitch";
import { useI18n } from "@/i18n/provider";
import { inviteInfo, registerByInvite } from "@/app/admin/actions";
import { trPhone, validMail } from "@/lib/phone";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";

const inputCls = "w-full rounded-[11px] border border-line px-[13px] py-[11px] text-[14px] outline-none focus:border-blue";
const labelCls = "mb-[6px] block text-left text-[12.5px] font-semibold text-text-2";
const badCls = "border-red bg-red-tint"; // незаполненное обязательное поле после попытки отправки
/** Prototype `chipF(on)` — same chip as in the access-request form. */
const chipCls = (on: boolean) =>
  `cursor-pointer rounded-[18px] border px-[13px] py-[9px] text-[12.5px] transition-[background,border-color] duration-[.12s] hover:bg-[#eef1f6] ${on ? "border-sel-line bg-blue-tint font-bold text-sel-ink" : "border-line bg-surface font-semibold text-[#3d4a5e]"}`;

export default function JoinPage() {
  const { t, lang } = useI18n();
  const { code } = useParams<{ code: string }>();
  const router = useRouter();
  const [f, setF] = useState({ name: "", phone: "+90 ", email: "", ag: "", pass: "", pass2: "" });
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);
  const [fixedMail, setFixedMail] = useState(false); // почта пришла из приглашения (письмо ушло на неё) — поле не редактируется
  useEffect(() => { let on = true; void inviteInfo(code).then((i) => { if (on && i.ok) { setF((x) => ({ ...x, email: i.email ?? x.email, name: x.name || i.name || "" })); if (i.email) setFixedMail(true); } }); return () => { on = false; }; }, [code]);
  const [pending, start] = useTransition();
  const [miss, setMiss] = useState<string[]>([]); // поля с ошибкой: name | phone | email | pass | pass2
  const set = (p: Partial<typeof f>) => { setF((x) => ({ ...x, ...p })); if (miss.length) setMiss((m) => m.filter((k) => !(k in p))); };
  const bad = (k: string) => (miss.includes(k) ? badCls : "");
  const free = !f.ag.trim();

  function submit() {
    setErr("");
    const fieldL: Record<string, string> = { name: t.prof.name, phone: t.prof.phone, email: t.prof.mail, pass: t.login.pass, pass2: t.prof.confP };
    const missing = (["name", "phone", "email", "pass", "pass2"] as const).filter((k) => !f[k].trim() || (k === "phone" && f.phone.replace(/\D/g, "").length <= 2) /* только код страны «+90» */);
    if (missing.length) { setMiss([...missing]); setErr(`${t.rl.reqErr}: ${missing.map((k) => fieldL[k]).join(", ")}`); return; }
    if (!validMail(f.email)) { setMiss(["email"]); setErr(t.rl.mailErr); return; }
    if (f.phone.replace(/\D/g, "").length < 10) { setMiss(["phone"]); setErr(t.login.regPhoneErr); return; }
    if (f.pass.length < 6 || f.pass !== f.pass2) { setMiss(["pass", "pass2"]); setErr(t.prof.pwErr); return; }
    setMiss([]);
    start(async () => {
      try {
        await registerByInvite({ code, name: f.name.trim(), phone: f.phone.trim(), email: f.email.trim(), password: f.pass, agency: f.ag.trim(), lang });
        if (hasSupabaseEnv()) await createClient().auth.signInWithPassword({ email: f.email.trim(), password: f.pass });
        setDone(true);
        setTimeout(() => { router.push("/catalog"); router.refresh(); }, 1200);
      } catch (e) { setErr((e as Error).message); }
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7f8fb,#eef1f6)] p-6">
      <div className="animate-card w-[440px] max-w-full rounded-[20px] border border-line bg-surface px-8 py-[34px] text-center shadow-card max-md:px-5">
        <div className="mb-[10px] flex justify-center"><Logo size={28} textSize={21} /></div>
        <span className="inline-flex items-center gap-[6px] rounded-full bg-blue-tint px-[13px] py-[6px] text-[12px] font-bold text-blue"><IconLock size={14} stroke={2.2} /> {t.common.badge}</span>
        {done ? (
          <div className="py-8">
            <span className="mb-3 inline-flex h-14 w-14 items-center justify-center rounded-full bg-green-tint text-green"><IconCircleCheck size={27} /></span>
            <div className="text-[16px] font-extrabold text-ink">{t.login.joinDoneT}</div>
          </div>
        ) : (
          <>
            <div className="mx-auto my-4 flex h-12 w-12 items-center justify-center rounded-full bg-green-tint text-green"><IconTicket size={22} /></div>
            <h1 className="mb-[6px] text-[22px] font-extrabold tracking-[-0.02em] text-ink">{t.login.joinT}</h1>
            <p className="mb-4 text-[13.5px] leading-[1.55] text-text-2 [text-wrap:pretty]">{t.login.joinS}</p>
            <div className="mb-4 inline-block rounded-[10px] border border-dashed border-[#c3cad6] bg-bg-3 px-4 py-2 font-mono text-[13px] font-extrabold tracking-[.06em] text-ink">{code}</div>
            <label className={labelCls}>{t.prof.name} <span className="text-red">*</span></label>
            <input value={f.name} onChange={(e) => set({ name: e.target.value })} className={`${inputCls} mb-3 ${bad("name")}`} autoComplete="name" />
            <label className={labelCls}>{t.prof.phone} <span className="text-red">*</span></label>
            <input value={f.phone} onChange={(e) => set({ phone: trPhone(e.target.value) })} placeholder="+90 5xx xxx xx xx" inputMode="tel" className={`${inputCls} mb-1 ${bad("phone")}`} />
            <div className="mb-3 text-left text-[11px] text-muted-2">{t.login.regPhoneH}</div>
            <label className={labelCls}>{t.prof.mail} <span className="text-red">*</span></label>
            <input type="email" value={f.email} onChange={(e) => set({ email: e.target.value })} placeholder="name@agency.com" readOnly={fixedMail} className={`${inputCls} ${fixedMail ? "mb-1 bg-bg-2 text-text-2" : "mb-3"} ${bad("email")}`} autoComplete="email" />
            {fixedMail && <div className="mb-3 text-left text-[11.5px] text-muted">{t.rl.mailFromInvite}</div>}
            <label className={labelCls}>{t.rl.agL}</label>
            <div className="mb-2 flex flex-wrap gap-[6px]"><button type="button" onClick={() => set({ ag: "" })} className={chipCls(free)}>{t.rl.agFree}</button></div>
            <input value={f.ag} onChange={(e) => set({ ag: e.target.value })} placeholder={t.rl.agWrite} className={`${inputCls} mb-4`} />
            <div className="mb-4 grid grid-cols-2 gap-3 max-md:grid-cols-1">
              <div><label className={labelCls}>{t.login.pass} <span className="text-red">*</span></label><input type="password" value={f.pass} onChange={(e) => set({ pass: e.target.value })} className={`${inputCls} ${bad("pass")}`} autoComplete="new-password" /></div>
              <div><label className={labelCls}>{t.prof.confP} <span className="text-red">*</span></label><input type="password" value={f.pass2} onChange={(e) => set({ pass2: e.target.value })} className={`${inputCls} ${bad("pass2")}`} autoComplete="new-password" /></div>
            </div>
            {err && <div className="mb-3 flex items-start gap-2 rounded-[11px] bg-red-tint px-[13px] py-[11px] text-left text-[12.5px] text-red-2"><IconAlertCircle size={16} className="mt-[1px] shrink-0" /><span>{err}</span></div>}
            <button type="button" disabled={pending} onClick={submit} className="flex w-full cursor-pointer items-center justify-center rounded-[12px] bg-blue-2 py-[13px] text-[14.5px] font-bold text-white transition hover:bg-blue-3 disabled:opacity-60">{t.login.joinB}</button>
            <div className="mt-3 text-[12.5px] text-muted">{t.login.joinHave} <Link href="/login" className="font-bold text-blue">{t.login.btn}</Link></div>
          </>
        )}
        <div className="mt-5 flex justify-center"><LangSwitch /></div>
      </div>
    </div>
  );
}
