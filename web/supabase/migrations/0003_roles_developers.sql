-- Roles: admin / realtor / developer (сотрудник застройщика). Developer companies + membership.
-- Run in Supabase → SQL Editor after 0001.

alter type member_role add value if not exists 'developer';

create table if not exists developers (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  phone       text,
  addr        text,
  lic         text,
  logo_path   text,
  created_at  timestamptz not null default now()
);

alter table profiles add column if not exists developer_id uuid references developers(id) on delete set null;
alter table profiles add column if not exists dev_role text; -- owner | manager | sales (внутри компании застройщика)

-- access requests: which product the person asked for
alter table access_requests add column if not exists role member_role not null default 'realtor';
alter table access_requests add column if not exists company text;

-- invites carry the role and company they grant
alter table invites add column if not exists role member_role not null default 'realtor';
alter table invites add column if not exists agency_id uuid references agencies(id) on delete set null;
alter table invites add column if not exists developer_id uuid references developers(id) on delete set null;

alter table developers enable row level security;
create policy "developers read"  on developers for select using (is_active_member());
create policy "developers admin" on developers for all using (is_admin());
create policy "developers self edit" on developers for update
  using (exists (select 1 from profiles p where p.id = auth.uid() and p.developer_id = developers.id and p.dev_role = 'owner'));

-- admins may read every profile regardless of status (moderation list)
drop policy if exists "profiles read" on profiles;
create policy "profiles read" on profiles for select using (is_active_member() or id = auth.uid() or is_admin());

-- helper for server code: role of the current user
create or replace function my_role() returns member_role
language sql stable security definer set search_path = public as $$
  select role from profiles where id = auth.uid();
$$;
