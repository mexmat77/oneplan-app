"use client";

// Подтверждение входа кодом 2FA: сюда ведут layouts (сессия aal1 при включённом факторе) и страница приёма ссылок из писем.
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { Logo } from "@/components/Logo";
import { MfaCodeForm } from "@/components/auth/TwoFactor";
import { useI18n } from "@/i18n/provider";
import { createClient } from "@/lib/supabase/client";
import { safeNext } from "@/lib/safeNext";

function Inner() {
  const { t } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const done = async () => {
    const next = params.get("next");
    if (next && safeNext(next, "") === next) { window.location.assign(next); return; } // не «//evil.com»
    const sb = createClient();
    const { data: { user } } = await sb.auth.getUser();
    const { data: prof } = user ? await sb.from("profiles").select("role").eq("id", user.id).maybeSingle() : { data: null };
    window.location.assign(prof?.role === "developer" ? "/dev" : "/catalog");
  };
  return (
    <div className="flex min-h-screen items-center justify-center bg-[linear-gradient(180deg,#f7f8fb,#eef1f6)] p-6">
      <div className="animate-card w-[410px] max-w-full rounded-[20px] border border-line bg-surface px-8 py-[34px] shadow-card max-md:px-5">
        <div className="mb-[18px] flex justify-center"><Logo size={28} textSize={21} /></div>
        <MfaCodeForm L={{ title: t.login.mfaT, sub: t.login.mfaS, code: t.prof.tfaCode, verify: t.prof.tfaVerify, bad: t.prof.tfaBad }} onDone={done} />
        <button type="button" onClick={async () => { try { await createClient().auth.signOut(); } catch {} router.replace("/login"); }} className="mt-4 w-full cursor-pointer text-center text-[12.5px] font-semibold text-muted hover:text-ink">{t.login.mfaBack}</button>
      </div>
    </div>
  );
}
export default function Page() { return <Suspense><Inner /></Suspense>; }
