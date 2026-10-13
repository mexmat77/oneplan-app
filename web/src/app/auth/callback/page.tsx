"use client";

// Приём ссылок из писем Supabase: приглашение («Принять заявку» / создание пользователя), восстановление пароля, вход по ссылке.
// Supabase после проверки токена перенаправляет сюда либо с `?code=` (PKCE), либо с `#access_token=…&refresh_token=…&type=…`
// (implicit). До этой страницы токены никто не обрабатывал: человек попадал на форму входа и не мог задать пароль.
//   1. создаём сессию (exchangeCodeForSession / setSession → cookies через @supabase/ssr);
//   2. для invite / recovery / signup показываем форму «Задайте пароль» (updateUser);
//   3. ведём в раздел по роли: застройщик → /dev, остальные → /catalog (или `next`).
import { IconKey, IconLoader2 } from "@tabler/icons-react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useT } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { LogoMark } from "@/components/Logo";
import { mfaNeeded } from "@/components/auth/TwoFactor";

type Phase = "working" | "password" | "error";
// Сессия по ссылке восстановления/приглашения ДО сохранения пароля — «незавершённый вход» (13.10.2026, замечание пользователя:
// открыл письмо, пароль не менял, а оказался вошедшим). Cookie-флаг ставится до проверки токена; proxy и getCurrentUser с ним
// никуда не пускают, кроме этой страницы; снимается при сохранении пароля или по «Не менять пароль и выйти».
const PENDING = "opl-pw-pending";
const setPending = (on: boolean) => { document.cookie = `${PENDING}=${on ? "1" : ""}; path=/; max-age=${on ? 2592000 : 0}; SameSite=Lax`; };

function Inner() {
  const t = useT();
  const router = useRouter();
  const params = useSearchParams();
  const [phase, setPhase] = useState<Phase>("working");
  const [err, setErr] = useState("");
  const [pass, setPass] = useState("");
  const [pass2, setPass2] = useState("");
  const [busy, setBusy] = useState(false);
  const [email, setEmail] = useState(""); // логин для менеджера паролей (autocomplete=username), 12.10.2026

  const goHome = async () => {
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    const next = params.get("next");
    let dest = next && next.startsWith("/") ? next : "/catalog";
    if (user && !next) {
      const { data: prof } = await sb.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (prof?.role === "developer") dest = "/dev";
    }
    if (await mfaNeeded(sb)) { window.location.assign(`/auth/mfa?next=${encodeURIComponent(dest)}`); return; } // 2FA — сначала код
    router.replace(dest); // без router.refresh(): cookies уже выставлены, RSC-ответ /dev прочитает их сам
  };

  useEffect(() => {
    const sb = createClient();
    const hash = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const code = params.get("code");
    const tokenHash = params.get("token_hash"); // ссылка из наших писем: {{ .SiteURL }}/auth/callback?token_hash=…&type=…
    const type = hash.get("type") || params.get("type") || "";
    const resume = params.get("resume") === "1"; // proxy вернул сюда незавершённый вход — форма пароля на уже созданной сессии
    const needPassword = resume || type === "invite" || type === "recovery" || type === "signup";
    (async () => {
      try {
        if (hash.get("error_description") || params.get("error_description")) throw new Error(hash.get("error_description") || params.get("error_description") || "error");
        if (needPassword && !resume) setPending(true);
        if (tokenHash) {
          const { error } = await sb.auth.verifyOtp({ token_hash: tokenHash, type: (type || "magiclink") as "invite" | "recovery" | "signup" | "magiclink" | "email" });
          if (error) throw error;
          window.history.replaceState(null, "", window.location.pathname);
        } else if (code) {
          const { error } = await sb.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } else if (hash.get("access_token") && hash.get("refresh_token")) {
          const { error } = await sb.auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! });
          if (error) throw error;
          window.history.replaceState(null, "", window.location.pathname + window.location.search); // токены из адресной строки убираем
        } else {
          const { data: { session } } = await sb.auth.getSession();
          if (!session) throw new Error(t.auth.no_token);
        }
        if (needPassword) { const { data: { user: u } } = await sb.auth.getUser(); setEmail(u?.email ?? ""); setPhase("password"); } else await goHome();
      } catch (e) {
        setErr(e instanceof Error ? e.message : String(e));
        setPhase("error");
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const savePassword = async (e: FormEvent) => {
    e.preventDefault();
    if (pass.length < 8) { setErr(t.auth.pass_short); return; }
    if (pass !== pass2) { setErr(t.auth.pass_mismatch); return; }
    setBusy(true); setErr("");
    const { error } = await createClient().auth.updateUser({ password: pass });
    setBusy(false);
    if (error) { setErr(error.message); return; }
    setPending(false);
    await goHome();
  };
  const cancelPassword = async () => {
    setBusy(true);
    try { await createClient().auth.signOut(); } catch { /* сессии уже нет */ }
    setPending(false);
    window.location.assign("/login");
  };

  const inputCls = "w-full rounded-[12px] border border-line bg-surface px-[14px] py-[12px] text-[15px] text-ink outline-none focus:border-blue";
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-[420px] rounded-[20px] border border-line bg-surface p-[26px] shadow-[0_18px_50px_rgba(20,36,63,.08)]">
        <div className="mb-[18px] flex items-center gap-[9px] text-[19px] font-extrabold text-ink"><LogoMark size={26} /> OnePlan</div>
        {phase === "working" && <div className="flex items-center gap-[10px] text-[14px] text-text-2"><IconLoader2 size={18} className="animate-spin text-blue" /> {t.auth.working}</div>}
        {phase === "error" && (
          <>
            <div className="mb-2 text-[17px] font-extrabold text-ink">{t.auth.err_title}</div>
            <div className="mb-4 text-[13.5px] leading-[1.5] text-text-2">{t.auth.err_hint}</div>
            <div className="mb-4 rounded-[11px] bg-red-tint px-[13px] py-[10px] text-[12.5px] text-red-2 [overflow-wrap:anywhere]">{err}</div>
            <button type="button" onClick={() => router.replace("/login")} className="w-full cursor-pointer rounded-[12px] bg-blue py-3 text-[14px] font-bold text-white">{t.auth.to_login}</button>
          </>
        )}
        {phase === "password" && (
          <form onSubmit={savePassword}>
            <div className="mb-1 text-[17px] font-extrabold text-ink">{t.auth.set_title}</div>
            <div className="mb-4 text-[13.5px] leading-[1.5] text-text-2">{t.auth.set_hint}</div>
            <label className="mb-[6px] block text-[12.5px] font-semibold text-text-2">{t.login.email}</label>
            <input type="email" name="username" autoComplete="username" value={email} readOnly className={`${inputCls} mb-[12px] bg-bg-2 text-text-2`} />
            <label className="mb-[6px] block text-[12.5px] font-semibold text-text-2">{t.auth.pass}</label>
            <input type="password" autoComplete="new-password" value={pass} onChange={(e) => setPass(e.target.value)} className={`${inputCls} mb-[12px]`} autoFocus />
            <label className="mb-[6px] block text-[12.5px] font-semibold text-text-2">{t.auth.pass2}</label>
            <input type="password" autoComplete="new-password" value={pass2} onChange={(e) => setPass2(e.target.value)} className={`${inputCls} mb-[16px]`} />
            {err && <div className="mb-3 rounded-[11px] bg-red-tint px-[13px] py-[10px] text-[12.5px] text-red-2">{err}</div>}
            <button type="submit" disabled={busy} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-blue py-3 text-[14px] font-bold text-white disabled:opacity-60">{busy ? <IconLoader2 size={16} className="animate-spin" /> : <IconKey size={16} />} {t.auth.set_btn}</button>
            <div className="mt-3 text-[12px] leading-[1.5] text-muted">{t.auth.pending_hint}</div>
            <button type="button" onClick={cancelPassword} disabled={busy} className="mt-3 w-full cursor-pointer rounded-[12px] border border-line py-[11px] text-[13.5px] font-semibold text-text hover:bg-bg-2 disabled:opacity-60">{t.auth.cancel_pw}</button>
          </form>
        )}
      </div>
    </div>
  );
}

export default function Page() {
  return <Suspense><Inner /></Suspense>;
}
