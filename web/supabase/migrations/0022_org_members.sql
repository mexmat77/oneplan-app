-- 0022 (12.10.2026): единая модель «Организации и участники» (замечание пользователя «управление пользователями сделано криво»).
--
-- Было три места, где жила роль человека в компании: crm_members (роль в CRM агентства/застройщика), developer_members
-- (доступ сотрудника к застройщикам, без роли) и profiles.dev_role (одна роль на все компании). Стало одно:
--   org_members (org_kind agency|developer, org_id, profile_id, role, branch_id)
--     агентство:  owner  = администратор агентства, manager = руководитель филиала, agent = риэлтор
--     застройщик: admin  = администратор компании,  editor  = редактор,             manager = менеджер продаж
-- Старые поля profiles.agency_id / developer_id («основная организация») и profiles.dev_role остаются для совместимости
-- и синхронизируются триггером из org_members. Приглашение (invites) несёт роль в организации (org_role).
-- Запускать в Supabase SQL Editor один раз.

-- ---------- 1. crm_members → org_members ----------
alter table if exists crm_members rename to org_members;
alter table org_members rename column ws_kind to org_kind;
alter table org_members rename column ws_id   to org_id;
alter index if exists crm_members_profile_idx rename to org_members_profile_idx;
alter table org_members drop constraint if exists crm_members_role_check;

-- роли застройщика: из profiles.dev_role (owner CRM → admin, agent → editor)
update org_members m
   set role = coalesce(p.dev_role, case m.role when 'owner' then 'admin' when 'manager' then 'manager' else 'editor' end)
  from profiles p
 where p.id = m.profile_id and m.org_kind = 'developer';

-- developer_members → org_members
insert into org_members (org_kind, org_id, profile_id, role)
select 'developer', dm.developer_id, dm.profile_id, coalesce(p.dev_role, 'editor')
  from developer_members dm join profiles p on p.id = dm.profile_id
on conflict (org_kind, org_id, profile_id) do nothing;

-- основная компания застройщика без записи членства
insert into org_members (org_kind, org_id, profile_id, role)
select 'developer', p.developer_id, p.id, coalesce(p.dev_role, 'editor')
  from profiles p where p.developer_id is not null
on conflict (org_kind, org_id, profile_id) do nothing;

-- риэлторы агентства без записи членства → риэлтор
insert into org_members (org_kind, org_id, profile_id, role)
select 'agency', p.agency_id, p.id, 'agent'
  from profiles p where p.agency_id is not null and p.role = 'realtor'
on conflict (org_kind, org_id, profile_id) do nothing;

alter table org_members add constraint org_members_role_check check (
  (org_kind = 'agency'    and role in ('owner', 'manager', 'agent')) or
  (org_kind = 'developer' and role in ('admin', 'editor', 'manager')));

-- ---------- 2. синхронизация старых полей профиля ----------
-- profiles.agency_id = агентство участника (одно), profiles.developer_id / dev_role = основная компания застройщика и роль в ней.
create or replace function org_members_sync() returns trigger
language plpgsql security definer set search_path = public as $$
declare o_id uuid; o_role text;
begin
  if tg_op = 'DELETE' then
    if old.org_kind = 'agency' then
      update profiles set agency_id = null where id = old.profile_id and agency_id = old.org_id;
    else
      select org_id, role into o_id, o_role from org_members where profile_id = old.profile_id and org_kind = 'developer' and org_id <> old.org_id limit 1;
      update profiles set developer_id = o_id, dev_role = o_role where id = old.profile_id and developer_id = old.org_id;
    end if;
    return old;
  end if;
  if new.org_kind = 'agency' then
    update profiles set agency_id = new.org_id, agency_text = null where id = new.profile_id and (agency_id is distinct from new.org_id);
  else
    update profiles set developer_id = coalesce(developer_id, new.org_id) where id = new.profile_id;
    update profiles set dev_role = new.role where id = new.profile_id and developer_id = new.org_id;
  end if;
  return new;
end $$;
drop trigger if exists org_members_sync on org_members;
create trigger org_members_sync after insert or update or delete on org_members
  for each row execute function org_members_sync();

-- ---------- 3. функции доступа ----------
create or replace function is_dev_member(dev uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from org_members m where m.org_kind = 'developer' and m.org_id = dev and m.profile_id = auth.uid())
      or exists (select 1 from profiles p where p.id = auth.uid() and p.developer_id = dev);
$$;

-- участник пространства CRM: одиночка — сам; агентство — активный участник; застройщик — участник компании
create or replace function crm_ws_ok(kind text, ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when kind = 'realtor'   then ws = auth.uid()
    when kind = 'agency'    then exists (select 1 from org_members m join profiles p on p.id = m.profile_id
                                          where m.org_kind = 'agency' and m.org_id = ws and m.profile_id = auth.uid() and p.status = 'active')
    when kind = 'developer' then is_dev_member(ws)
    else false end;
$$;

-- роль в CRM: owner (всё) / manager (свой филиал) / agent (свои). Застройщик: admin → owner, остальные → agent.
create or replace function crm_ws_role(kind text, ws uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when not crm_ws_ok(kind, ws) then null
    when kind = 'realtor' then 'owner'
    when kind = 'developer' then case (select m.role from org_members m where m.org_kind = 'developer' and m.org_id = ws and m.profile_id = auth.uid())
                                   when 'admin' then 'owner' else
                                   case when exists (select 1 from profiles p where p.id = auth.uid() and p.developer_id = ws and p.dev_role = 'admin') then 'owner' else 'agent' end end
    else coalesce((select m.role from org_members m where m.org_kind = kind and m.org_id = ws and m.profile_id = auth.uid()), 'agent')
  end;
$$;
create or replace function crm_ws_branch(kind text, ws uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select m.branch_id from org_members m where m.org_kind = kind and m.org_id = ws and m.profile_id = auth.uid();
$$;
create or replace function crm_ws_admin(kind text, ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select crm_ws_role(kind, ws) = 'owner';
$$;

-- запись членства при первом входе в CRM: агентство — первый участник становится администратором (если его ещё никто не
-- назначил), остальные — риэлторами; застройщик — членство ставит админ платформы/компании, здесь только читаем.
create or replace function crm_claim_member(kind text, ws uuid) returns text
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if not crm_ws_ok(kind, ws) then return null; end if;
  if kind = 'realtor' then return 'owner'; end if;
  if kind = 'developer' then return crm_ws_role(kind, ws); end if;
  select role into r from org_members where org_kind = kind and org_id = ws and profile_id = auth.uid();
  if r is not null then return r; end if;
  if not exists (select 1 from org_members where org_kind = kind and org_id = ws and role = 'owner') then r := 'owner'; else r := 'agent'; end if;
  insert into org_members (org_kind, org_id, profile_id, role) values (kind, ws, auth.uid(), r) on conflict do nothing;
  return r;
end $$;

-- ---------- 4. политики org_members ----------
drop policy if exists "crm_members read"  on org_members;
drop policy if exists "crm_members write" on org_members;
drop policy if exists "org_members read"  on org_members;
drop policy if exists "org_members self"  on org_members;
drop policy if exists "org_members admin" on org_members;
-- свои членства видит каждый; участники организации видят друг друга; админ платформы — всё (запись — сервисным ключом)
create policy "org_members self"  on org_members for select using (profile_id = auth.uid());
create policy "org_members read"  on org_members for select using (crm_ws_ok(org_kind, org_id));
create policy "org_members admin" on org_members for all using (is_admin());

-- ---------- 5. старая таблица и приглашения ----------
drop table if exists developer_members;
alter table invites add column if not exists org_role text;      -- роль в организации для приглашённого
alter table invites add column if not exists name text;          -- имя приглашённого (необязательно)
