import "server-only";
import { MAIL_TEMPLATES, type MailKind } from "@/lib/mail/templates.generated";

export type MailLang = "RU" | "EN" | "TR";
const FROM = "OnePlan <noreply@one-plan.pro>";

/** Собственная отправка писем через Resend (тот же домен и вид, что у писем Supabase Auth). Без RESEND_API_KEY — только лог. */
export async function sendMail(to: string, subject: string, html: string): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) { console.warn("[mail] RESEND_API_KEY не задан — письмо не отправлено:", to, subject); return false; }
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: FROM, to: [to], subject, html }),
  });
  if (!r.ok) { console.error("[mail] Resend", r.status, (await r.text()).slice(0, 300)); return false; }
  return true;
}

/** Письмо по шаблону (`join`, `invite`, `recovery`, …) на языке получателя. */
export type MailVars = { link: string; name?: string; login?: string; password?: string };
const escHtml = (v: string) => v.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function renderMail(kind: MailKind, lang: MailLang, vars: MailVars) {
  const t = MAIL_TEMPLATES[kind];
  const name = (vars.name ?? "").trim();
  const html = t.html[lang]
    .replace(/\{\{GREET:([\s\S]*?)\|([\s\S]*?)\}\}/g, (_m, a: string, b: string) => (name ? a : b))
    .replace(/\{\{NAME\}\}/g, name)
    .replace(/\{\{LINK\}\}/g, vars.link)
    .replace(/\{\{LOGIN\}\}/g, escHtml(vars.login ?? ""))
    .replace(/\{\{PASSWORD\}\}/g, escHtml(vars.password ?? ""));
  return { subject: t.subject[lang], html };
}

export async function sendTemplateMail(kind: MailKind, lang: MailLang, to: string, vars: MailVars) {
  const { subject, html } = renderMail(kind, lang, vars);
  return sendMail(to, subject, html);
}
