"use client";

// Двухфакторная аутентификация (TOTP: Google Authenticator и аналоги) на Supabase Auth MFA — реальная, не заглушка (07.10.2026).
//   <TwoFactorCard L={labels} />  — блок в профиле: включить (QR + ключ + код подтверждения) / отключить.
//   <MfaCodeForm L={labels} onDone={…} /> — ввод кода при входе (страница /auth/mfa и шаг на /login).
//   mfaNeeded() — у пользователя есть подтверждённый фактор, а текущая сессия ещё aal1 → нужен код.
import { useEffect, useState } from "react";
import { IconShieldCheck, IconShieldOff } from "@tabler/icons-react";
import { showToast } from "@/components/ui/toast";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";

export type TfaLabels = { title: string; sub: string; on: string; off: string; enable: string; disable: string; code: string; verify: string; done: string; removed: string; bad: string; secret: string; qr: string; get: string; relogin: string; cancel: string };
export type MfaLabels = { title: string; sub: string; code: string; verify: string; bad: string };

export async function mfaNeeded(sb = createClient()): Promise<boolean> {
  try { const { data } = await sb.auth.mfa.getAuthenticatorAssuranceLevel(); return !!data && data.nextLevel === "aal2" && data.currentLevel !== "aal2"; } catch { return false; }
}

const input = "w-full rounded-[10px] border border-line bg-surface px-3 py-[10px] text-center font-mono text-[18px] tracking-[.35em] text-ink outline-none focus:border-blue";
const primary = "inline-flex cursor-pointer items-center justify-center gap-[7px] rounded-[10px] bg-blue-2 px-4 py-[10px] text-[13.5px] font-semibold text-white hover:bg-blue-3 disabled:opacity-60";
const secondary = "inline-flex cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[10px] border border-line bg-surface px-[14px] py-[9px] text-[13px] font-semibold text-text hover:border-blue hover:text-blue disabled:opacity-60";
const digits = (v: string) => v.replace(/\D/g, "").slice(0, 6);

export function TwoFactorCard({ L }: { L: TfaLabels }) {
  const [factors, setFactors] = useState<{ id: string; status: string }[] | null>(() => (hasSupabaseEnv() ? null : [])); // без Supabase — демо, факторов нет
  const [enroll, setEnroll] = useState<{ id: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const load = async () => {
    const { data } = await createClient().auth.mfa.listFactors();
    setFactors((data?.totp ?? []).map((f) => ({ id: f.id, status: f.status })));
  };
  useEffect(() => {
    if (!hasSupabaseEnv()) return;
    let on = true;
    createClient().auth.mfa.listFactors().then(({ data }) => { if (on) setFactors((data?.totp ?? []).map((f) => ({ id: f.id, status: f.status }))); });
    return () => { on = false; };
  }, []);
  const active = factors?.find((f) => f.status === "verified");

  const start = async () => {
    if (!hasSupabaseEnv()) { showToast(L.relogin); return; }
    setBusy(true);
    try {
      const sb = createClient();
      for (const f of factors ?? []) if (f.status !== "verified") await sb.auth.mfa.unenroll({ factorId: f.id }); // незавершённые попытки
      const { data, error } = await sb.auth.mfa.enroll({ factorType: "totp", friendlyName: "OnePlan" });
      if (error) throw error;
      setEnroll({ id: data.id, qr: data.totp.qr_code, secret: data.totp.secret }); setCode("");
    } catch (e) { showToast((e as Error).message); } finally { setBusy(false); }
  };
  const verify = async () => {
    if (!enroll) return;
    const c = digits(code); if (c.length !== 6) { showToast(L.bad); return; }
    setBusy(true);
    try {
      const sb = createClient();
      const { data: ch, error: e1 } = await sb.auth.mfa.challenge({ factorId: enroll.id }); if (e1) throw e1;
      const { error: e2 } = await sb.auth.mfa.verify({ factorId: enroll.id, challengeId: ch.id, code: c }); if (e2) throw new Error(L.bad);
      setEnroll(null); showToast(L.done); await load();
    } catch (e) { showToast((e as Error).message); } finally { setBusy(false); }
  };
  const disable = async () => {
    if (!active) return;
    setBusy(true);
    try {
      const { error } = await createClient().auth.mfa.unenroll({ factorId: active.id });
      if (error) throw new Error(/aal2|assurance/i.test(error.message) ? L.relogin : error.message);
      showToast(L.removed); await load();
    } catch (e) { showToast((e as Error).message); } finally { setBusy(false); }
  };

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3">
        <span className={`flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] ${active ? "bg-green-tint text-green" : "bg-bg-2 text-muted"}`}>{active ? <IconShieldCheck size={19} /> : <IconShieldOff size={19} />}</span>
        <div className="min-w-[180px] flex-1">
          <div className="text-[13.5px] font-bold text-ink">{L.title} <span className={`ml-1 rounded-[7px] px-2 py-[2px] text-[10.5px] font-bold ${active ? "bg-green-tint text-green" : "bg-bg-2 text-muted"}`}>{active ? L.on : L.off}</span></div>
          <div className="mt-[2px] text-[12px] leading-[1.45] text-muted">{L.sub}</div>
        </div>
        {factors && !enroll && (active
          ? <button type="button" onClick={disable} disabled={busy} className={secondary}>{L.disable}</button>
          : <button type="button" onClick={start} disabled={busy} className={primary}>{L.enable}</button>)}
      </div>
      {enroll && (
        <div className="mt-3 flex flex-wrap items-start gap-[14px] rounded-[13px] bg-bg-3 p-[14px]">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={enroll.qr} alt="QR" width={132} height={132} className="flex-none rounded-[12px] border border-line bg-white p-1" />
          <div className="min-w-[200px] flex-1">
            <div className="mb-2 text-[12.5px] leading-[1.5] text-text">{L.qr}</div>
            <div className="mb-1 text-[11px] font-semibold text-muted">{L.secret}</div>
            <span className="inline-block select-all rounded-[9px] border border-dashed border-[#c3cad6] bg-surface px-3 py-2 font-mono text-[12.5px] font-bold tracking-[.06em] text-ink [overflow-wrap:anywhere]">{enroll.secret}</span>
            <div className="mb-[6px] mt-3 text-[12px] font-semibold text-text-2">{L.code}</div>
            <div className="flex flex-wrap gap-2">
              <input value={code} onChange={(e) => setCode(digits(e.target.value))} onKeyDown={(e) => { if (e.key === "Enter") void verify(); }} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className={`${input} max-w-[180px]`} autoFocus />
              <button type="button" onClick={verify} disabled={busy || digits(code).length !== 6} className={primary}>{L.verify}</button>
              <button type="button" onClick={() => setEnroll(null)} disabled={busy} className={secondary}>{L.cancel}</button>
            </div>
            <div className="mt-[10px] text-[11.5px] text-muted">{L.get} <a href="https://apps.apple.com/app/google-authenticator/id388497605" target="_blank" rel="noopener" className="font-semibold text-blue hover:underline">iOS</a> · <a href="https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2" target="_blank" rel="noopener" className="font-semibold text-blue hover:underline">Android</a></div>
          </div>
        </div>
      )}
    </div>
  );
}

export function MfaCodeForm({ L, onDone }: { L: MfaLabels; onDone: () => void }) {
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const submit = async () => {
    const c = digits(code); if (c.length !== 6) { setErr(L.bad); return; }
    setBusy(true); setErr("");
    try {
      const sb = createClient();
      const { data } = await sb.auth.mfa.listFactors();
      const f = (data?.totp ?? []).find((x) => x.status === "verified");
      if (!f) { onDone(); return; }
      const { error } = await sb.auth.mfa.challengeAndVerify({ factorId: f.id, code: c });
      if (error) { setErr(L.bad); setCode(""); return; }
      onDone();
    } catch (e) { setErr((e as Error).message); } finally { setBusy(false); }
  };
  return (
    <div>
      <div className="mb-1 text-center text-[20px] font-extrabold tracking-[-.02em] text-ink">{L.title}</div>
      <div className="mb-5 text-center text-[13.5px] leading-[1.55] text-text-2">{L.sub}</div>
      <label className="mb-[6px] block text-[12.5px] font-semibold text-text-2">{L.code}</label>
      <input value={code} onChange={(e) => { setCode(digits(e.target.value)); setErr(""); }} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void submit(); } }} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" className={`${input} mb-3 ${err ? "border-red bg-red-tint" : ""}`} autoFocus />
      {err && <div className="mb-3 rounded-[11px] bg-red-tint px-[13px] py-[10px] text-[12.5px] text-red-2">{err}</div>}
      <button type="button" onClick={submit} disabled={busy || digits(code).length !== 6} className={`${primary} w-full py-3`}><IconShieldCheck size={16} /> {L.verify}</button>
    </div>
  );
}
