-- Developer-side access model (по ТЗ OnePlan v2, раздел 2 «Роли и модель доступа»):
-- сотрудник может работать с несколькими застройщиками; «Сотрудник платформы» не виден командам застройщиков;
-- у компании есть срок доступа и видимость.

alter table profiles add column if not exists platform_staff boolean not null default false;
alter table profiles drop constraint if exists profiles_dev_role_check;
alter table profiles add constraint profiles_dev_role_check check (dev_role is null or dev_role in ('admin', 'editor', 'manager'));

alter table developers add column if not exists active boolean not null default true;
alter table developers add column if not exists access_until date;   -- null = бессрочно
alter table developers add column if not exists director text;

create table if not exists developer_members (
  profile_id   uuid not null references profiles(id) on delete cascade,
  developer_id uuid not null references developers(id) on delete cascade,
  created_at   timestamptz not null default now(),
  primary key (profile_id, developer_id)
);

alter table developer_members enable row level security;
create policy "developer_members admin" on developer_members for all using (is_admin());
create policy "developer_members self"  on developer_members for select using (profile_id = auth.uid());
-- company admins see their own team (except platform staff)
create policy "developer_members team" on developer_members for select
  using (exists (
    select 1 from developer_members me join profiles p on p.id = developer_members.profile_id
    where me.profile_id = auth.uid() and me.developer_id = developer_members.developer_id and not p.platform_staff
  ));
