-- Заявки с лендинга one-plan.pro (форма «Получить доступ»). Пишет только сервер (service role), читает админ платформы.
create table if not exists leads (
  id         uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  role       text not null check (role in ('r', 'd')),   -- r = риэлтор, d = застройщик
  name       text not null,
  company    text not null default '',
  phone      text not null,                              -- '+90' + 10 цифр
  email      text not null,
  message    text not null default '',
  lang       text not null default 'RU',
  handled    boolean not null default false
);
alter table leads enable row level security;
create policy "leads admin" on leads for all using (is_admin());
