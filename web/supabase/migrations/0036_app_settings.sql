-- 18.10.2026. Настройки платформы (ключ → jsonb): первая — автопринятие заявок на доступ (`auto_approve`: {"on": true}).
-- Читают/пишут только админы платформы (is_admin()); серверные действия — сервисным ключом.
create table if not exists app_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now()
);
alter table app_settings enable row level security;
drop policy if exists "app_settings admin" on app_settings;
create policy "app_settings admin" on app_settings for all using (is_admin()) with check (is_admin());
