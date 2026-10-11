// Фирменные письма OnePlan на RU/EN/TR. Запуск: `node scripts/gen-email-templates.mjs`. Пишет:
//   supabase/email-templates/*.html + *.subject.txt — шаблоны Supabase Auth (invite, magic_link, recovery, confirmation);
//     загружаются через Management API (см. README.md рядом). Язык — из user metadata `lang` (пишется при приглашении),
//     без него письмо на трёх языках сразу. Ссылка ведёт на наш домен: `{{ .SiteURL }}/auth/callback?token_hash=…&type=…`,
//     страница приёма вызывает `auth.verifyOtp`, поэтому адрес supabase.co в письме не светится.
//   src/lib/mail/templates.generated.ts — те же письма для собственной отправки через Resend (`lib/mail.ts`):
//     `join` (ссылка-приглашение /join/<code>) и повторное приглашение из админки.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const out = path.join(web, "supabase", "email-templates");
fs.mkdirSync(out, { recursive: true });
fs.mkdirSync(path.join(web, "src", "lib", "mail"), { recursive: true });

const SITE = "https://ai.one-plan.pro";
const T = {
  invite: {
    type: "invite",
    subject: { RU: "Приглашение в OnePlan", EN: "Invitation to OnePlan", TR: "OnePlan'a davet" },
    RU: { h: "Вас пригласили в OnePlan", p: "Для вас создан аккаунт на платформе OnePlan — закрытой базе недвижимости для риэлторов и застройщиков. Нажмите кнопку, задайте пароль и войдите.", btn: "Принять приглашение", note: "Ссылка одноразовая и действует 24 часа. Если вы не ожидали это письмо, просто проигнорируйте его." },
    EN: { h: "You are invited to OnePlan", p: "An account has been created for you on OnePlan — a private real-estate platform for realtors and developers. Click the button, set your password and sign in.", btn: "Accept invitation", note: "The link is single-use and valid for 24 hours. If you did not expect this e-mail, just ignore it." },
    TR: { h: "OnePlan'a davet edildiniz", p: "Emlakçılar ve geliştiriciler için kapalı gayrimenkul platformu OnePlan'da sizin için bir hesap oluşturuldu. Düğmeye tıklayın, şifrenizi belirleyin ve giriş yapın.", btn: "Daveti kabul et", note: "Bağlantı tek kullanımlıktır ve 24 saat geçerlidir. Bu e-postayı beklemiyorsanız yok sayın." },
  },
  magic_link: {
    type: "magiclink",
    subject: { RU: "Вход в OnePlan", EN: "Sign in to OnePlan", TR: "OnePlan'a giriş" },
    RU: { h: "Вход в OnePlan", p: "Нажмите кнопку, чтобы войти без пароля.", btn: "Войти", note: "Ссылка одноразовая и действует 1 час. Если вы не запрашивали вход, проигнорируйте письмо." },
    EN: { h: "Sign in to OnePlan", p: "Click the button to sign in without a password.", btn: "Sign in", note: "The link is single-use and valid for 1 hour. If you did not request it, ignore this e-mail." },
    TR: { h: "OnePlan'a giriş", p: "Şifresiz giriş yapmak için düğmeye tıklayın.", btn: "Giriş yap", note: "Bağlantı tek kullanımlıktır ve 1 saat geçerlidir. Talep etmediyseniz yok sayın." },
  },
  recovery: {
    type: "recovery",
    subject: { RU: "Сброс пароля OnePlan", EN: "Reset your OnePlan password", TR: "OnePlan şifre sıfırlama" },
    RU: { h: "Сброс пароля OnePlan", p: "Вы запросили сброс пароля. Нажмите кнопку и задайте новый.", btn: "Задать новый пароль", note: "Ссылка действует 1 час. Если это были не вы, ничего делать не нужно — пароль останется прежним." },
    EN: { h: "Reset your OnePlan password", p: "You asked to reset your password. Click the button and choose a new one.", btn: "Set a new password", note: "The link is valid for 1 hour. If it wasn't you, no action is needed — your password stays the same." },
    TR: { h: "OnePlan şifre sıfırlama", p: "Şifre sıfırlama talep ettiniz. Düğmeye tıklayın ve yeni şifre belirleyin.", btn: "Yeni şifre belirle", note: "Bağlantı 1 saat geçerlidir. Siz değilseniz bir şey yapmanıza gerek yok — şifreniz aynı kalır." },
  },
  confirmation: {
    type: "signup",
    subject: { RU: "Подтвердите почту для OnePlan", EN: "Confirm your e-mail for OnePlan", TR: "OnePlan için e-postanızı onaylayın" },
    RU: { h: "Подтвердите почту", p: "Нажмите кнопку, чтобы подтвердить адрес и завершить регистрацию в OnePlan.", btn: "Подтвердить почту", note: "Если вы не регистрировались в OnePlan, проигнорируйте письмо." },
    EN: { h: "Confirm your e-mail", p: "Click the button to confirm your address and finish signing up to OnePlan.", btn: "Confirm e-mail", note: "If you did not sign up to OnePlan, ignore this e-mail." },
    TR: { h: "E-postanızı onaylayın", p: "Adresinizi onaylamak ve OnePlan kaydını tamamlamak için düğmeye tıklayın.", btn: "E-postayı onayla", note: "OnePlan'a kaydolmadıysanız bu e-postayı yok sayın." },
  },
  join: {
    type: "join", // не шаблон Supabase — отправляем сами через Resend; ссылка /join/<code>
    subject: { RU: "Ссылка для регистрации в OnePlan", EN: "Your OnePlan registration link", TR: "OnePlan kayıt bağlantınız" },
    RU: { h: "Приглашение в OnePlan", p: "Вас пригласили в OnePlan — закрытую базу недвижимости для риэлторов и застройщиков. Перейдите по ссылке, заполните короткую анкету, и после подтверждения администратором вы получите доступ.", btn: "Зарегистрироваться", note: "Ссылка персональная. Если вы не ожидали это письмо, просто проигнорируйте его." },
    EN: { h: "Invitation to OnePlan", p: "You are invited to OnePlan — a private real-estate platform for realtors and developers. Follow the link, fill in a short form and get access once the administrator confirms it.", btn: "Register", note: "The link is personal. If you did not expect this e-mail, just ignore it." },
    TR: { h: "OnePlan'a davet", p: "Emlakçılar ve geliştiriciler için kapalı gayrimenkul platformu OnePlan'a davet edildiniz. Bağlantıya gidin, kısa formu doldurun; yönetici onayından sonra erişim alırsınız.", btn: "Kayıt ol", note: "Bağlantı kişiseldir. Bu e-postayı beklemiyorsanız yok sayın." },
  },
};

const esc = (s) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;");
const logo = `<img src="${SITE}/logo.png" width="28" height="28" alt="" style="display:inline-block;vertical-align:middle;border:0;">`;
const GREET = { RU: ["{{NAME}}, здравствуйте!", "Здравствуйте!"], EN: ["Hello, {{NAME}}!", "Hello!"], TR: ["Merhaba, {{NAME}}!", "Merhaba!"] };
// Go-шаблон Supabase: имя из user metadata; для собственных писем плейсхолдеры {{GREET:…|…}} / {{NAME}} / {{LINK}} (см. lib/mail.ts).
const greetGo = (L) => `{{ if .Data.name }}${GREET[L][0].replace("{{NAME}}", "{{ .Data.name }}")}{{ else }}${GREET[L][1]}{{ end }}`;
const greetOwn = (L) => `{{GREET:${GREET[L][0]}|${GREET[L][1]}}}`;
const linkGo = (type) => `{{ .SiteURL }}/auth/callback?token_hash={{ .TokenHash }}&type=${type}`;

const block = (L, t, link, greet) => `
      <h1 style="margin:0 0 10px;font-size:22px;line-height:1.25;color:#14243f;">${esc(t.h)}</h1>
      ${greet ? `<p style="margin:0 0 8px;font-size:15px;line-height:1.55;color:#3c4759;">${greet}</p>` : ""}
      <p style="margin:0 0 20px;font-size:15px;line-height:1.55;color:#3c4759;">${esc(t.p)}</p>
      <p style="margin:0 0 22px;"><a href="${link}" style="display:inline-block;background:#4d7cfe;color:#ffffff;text-decoration:none;font-weight:700;font-size:15px;padding:13px 24px;border-radius:12px;">${esc(t.btn)}</a></p>
      <p style="margin:0 0 6px;font-size:12.5px;line-height:1.5;color:#7a8597;">${esc(t.note)}</p>`;
const sep = `<hr style="border:0;border-top:1px solid #e6e9f0;margin:26px 0;">`;
const FALL = { RU: "Если кнопка не работает, скопируйте ссылку в браузер:", EN: "If the button does not work, copy the link into your browser:", TR: "Düğme çalışmazsa bağlantıyı tarayıcıya kopyalayın:" };
const fallback = (link, L) => `
      <p style="margin:22px 0 0;font-size:12px;line-height:1.5;color:#98a1af;">${L ? FALL[L] : `${FALL.RU} · ${FALL.EN} · ${FALL.TR}`}<br><a href="${link}" style="color:#4d7cfe;word-break:break-all;">${link}</a></p>`;
// Тема письма: Supabase рендерит subject тем же Go-шаблоном — выбираем язык по metadata, без языка — три варианта через точку.
const subjectGo = (sub) => `{{ if eq .Data.lang "RU" }}${sub.RU}{{ else if eq .Data.lang "TR" }}${sub.TR}{{ else if eq .Data.lang "EN" }}${sub.EN}{{ else }}${sub.RU} · ${sub.EN} · ${sub.TR}{{ end }}`;
const page = (inner) => `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>OnePlan</title></head>
<body style="margin:0;padding:0;background:#f4f6fa;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f6fa;padding:28px 12px;">
  <tr><td align="center">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:18px;padding:30px 32px;">
      <tr><td>
      <p style="margin:0 0 22px;font-size:19px;font-weight:800;color:#14243f;">${logo}&nbsp;&nbsp;<span style="vertical-align:middle;">OnePlan</span></p>
${inner}
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#98a1af;">OnePlan · <a href="https://one-plan.pro" style="color:#98a1af;">one-plan.pro</a></p>
  </td></tr>
</table>
</body></html>
`;

const ts = [];
for (const [key, t] of Object.entries(T)) {
  if (t.type !== "join") {
    const link = linkGo(t.type);
    const html = page(`{{ if eq .Data.lang "RU" }}${block("RU", t.RU, link, greetGo("RU"))}${fallback(link, "RU")}
{{ else if eq .Data.lang "TR" }}${block("TR", t.TR, link, greetGo("TR"))}${fallback(link, "TR")}
{{ else if eq .Data.lang "EN" }}${block("EN", t.EN, link, greetGo("EN"))}${fallback(link, "EN")}
{{ else }}${block("RU", t.RU, link, "")}${sep}${block("EN", t.EN, link, "")}${sep}${block("TR", t.TR, link, "")}${fallback(link)}
{{ end }}`);
    fs.writeFileSync(path.join(out, `${key}.html`), html);
    fs.writeFileSync(path.join(out, `${key}.subject.txt`), subjectGo(t.subject) + "\n");
  }
  const own = {};
  for (const L of ["RU", "EN", "TR"]) own[L] = page(block(L, t[L], "{{LINK}}", greetOwn(L)) + fallback("{{LINK}}", L));
  ts.push(`  ${key}: { subject: ${JSON.stringify(t.subject)}, html: ${JSON.stringify(own)} }`);
}
fs.writeFileSync(path.join(web, "src", "lib", "mail", "templates.generated.ts"),
  `// СГЕНЕРИРОВАНО scripts/gen-email-templates.mjs — не править руками. Письма OnePlan для отправки через Resend (lib/mail.ts).\n` +
  `// Плейсхолдеры: {{LINK}} — ссылка; {{GREET:с именем|без имени}} и {{NAME}} — приветствие.\n` +
  `export const MAIL_TEMPLATES = {\n${ts.join(",\n")},\n} as const;\nexport type MailKind = keyof typeof MAIL_TEMPLATES;\n`);
console.log("templates:", Object.keys(T).join(", "));
