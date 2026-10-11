-- Данные кабинета застройщика переезжают из localStorage в базу: объект = одна строка (документ JSON), как в сторе `store/dev.tsx`.
-- data = Project (включая floorPlans), units = Unit[], plan_types = PlanType[], log = LogEntry[]. Доступ — участникам компании и админу платформы.
create table if not exists dev_objects (
  id           bigint primary key,                       -- числовой id объекта из приложения (новые — Date.now())
  developer_id uuid not null references developers(id) on delete cascade,
  slug         text not null,                             -- slugOf(name) — адрес публичной страницы /p/<slug>
  data         jsonb not null,
  units        jsonb not null default '[]'::jsonb,
  plan_types   jsonb not null default '[]'::jsonb,
  log          jsonb not null default '[]'::jsonb,
  updated_at   timestamptz not null default now(),
  updated_by   uuid references profiles(id) on delete set null
);
create index if not exists dev_objects_developer_idx on dev_objects(developer_id);
create index if not exists dev_objects_slug_idx on dev_objects(slug);

-- Настройки кабинета компании: цвета статусов шахматки и список особенностей квартир.
create table if not exists dev_settings (
  developer_id uuid primary key references developers(id) on delete cascade,
  colors       jsonb,
  features     jsonb,
  updated_at   timestamptz not null default now()
);

-- Участник компании: запись в developer_members или profiles.developer_id.
create or replace function is_dev_member(dev uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from developer_members m where m.profile_id = auth.uid() and m.developer_id = dev)
      or exists (select 1 from profiles p where p.id = auth.uid() and p.developer_id = dev);
$$;

alter table dev_objects enable row level security;
alter table dev_settings enable row level security;
create policy "dev_objects member"  on dev_objects  for all using (is_admin() or is_dev_member(developer_id)) with check (is_admin() or is_dev_member(developer_id));
create policy "dev_settings member" on dev_settings for all using (is_admin() or is_dev_member(developer_id)) with check (is_admin() or is_dev_member(developer_id));
-- Публичные страницы /p/<slug> и /d/<slug> читают объекты на сервере сервисным ключом (RLS не нужна анониму).
