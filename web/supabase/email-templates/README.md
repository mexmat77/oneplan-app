# Письма Supabase Auth — фирменные шаблоны OnePlan

Файлы генерируются `node scripts/gen-email-templates.mjs` (править тексты там, не здесь). Язык письма — из user metadata
`lang` (RU/EN/TR), который приложение пишет при приглашении; без него письмо на трёх языках сразу.

## Как подключить (один раз, в Supabase Dashboard)
Authentication → Email Templates → для каждого типа вставить тему из `*.subject.txt` в Subject и содержимое `*.html` в Body:

| Шаблон Supabase | Файл | Когда уходит |
|---|---|---|
| Invite user | `invite.html` | «Принять» заявку, «Добавить» пользователя без пароля |
| Magic Link | `magic_link.html` | вход по ссылке |
| Reset Password | `recovery.html` | «Забыли пароль?» |
| Confirm signup | `confirmation.html` | самостоятельная регистрация (сейчас не используется) |

Там же Authentication → URL Configuration: Site URL `https://ai.one-plan.pro`, Redirect URLs `https://ai.one-plan.pro/**`.

## Отправитель «OnePlan <noreply@one-plan.pro>»
Встроенный SMTP Supabase шлёт от `noreply@mail.app.supabase.io` и ограничен ~2 письмами в час — для продакшна нужен свой SMTP:
Project Settings → Authentication → SMTP Settings → Enable Custom SMTP. Подходит Resend (бесплатно до 3000 писем/мес): завести
аккаунт, добавить домен `one-plan.pro`, прописать выданные DNS-записи (SPF/DKIM) в панели ihc.ru, затем в Supabase указать
host `smtp.resend.com`, port 465, user `resend`, password = API-ключ Resend, Sender email `noreply@one-plan.pro`, Sender name `OnePlan`.
