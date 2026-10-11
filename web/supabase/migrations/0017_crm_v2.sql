-- 0017 — CRM v2 (ТЗ docs/crm-spec.md, 11.10.2026):
--   • агентство как рабочее пространство (ws_kind 'agency', ws_id = agencies.id) — риэлторы одного агентства работают в
--     одной CRM; одиночка остаётся в личном ws 'realtor'; застройщик — 'developer' как раньше;
--   • команда и филиалы: crm_members (роль owner / manager / agent, филиал), crm_branches;
--   • клиент: тип (физ/юр), роли (покупатель/продавец/арендодатель/арендатор), статус контакта, приоритет, страна,
--     гражданство, канал и время связи, кампания, «кто рекомендовал» = клиент, филиал, KVKK-блок (информирование и
--     согласия раздельно);
--   • заявки crm_requests (buy / sell / rent_out / rent_in) с полями по типу (jsonb по реестру lib/crm/requestFields.ts),
--     закрытые поля зашифрованы; «Что ищет» + бюджет существующих клиентов переносятся в заявку;
--   • сделка: связь с заявкой, филиал, комиссия, задаток; справочник причин отказа в crm_settings.
-- Запускать в Supabase SQL Editor после 0016.

-- ---------- 1. виды рабочих пространств ----------
alter table crm_keys drop constraint if exists crm_keys_ws_kind_check;
alter table crm_keys add constraint crm_keys_ws_kind_check check (ws_kind in ('realtor','agency','developer'));
alter table agencies add column if not exists crm_started_at timestamptz;
alter table agencies add column if not exists crm_paid_to    date;

-- ---------- 2. команда и филиалы ----------
create table if not exists crm_branches (
  id          uuid primary key default gen_random_uuid(),
  ws_kind     text not null, ws_id uuid not null,
  name        text not null,
  city        text,
  head_id     uuid references profiles(id) on delete set null,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists crm_branches_ws_idx on crm_branches(ws_kind, ws_id, sort);

create table if not exists crm_members (
  ws_kind     text not null, ws_id uuid not null,
  profile_id  uuid not null references profiles(id) on delete cascade,
  role        text not null default 'agent' check (role in ('owner','manager','agent')),
  branch_id   uuid references crm_branches(id) on delete set null,
  created_at  timestamptz not null default now(),
  primary key (ws_kind, ws_id, profile_id)
);
create index if not exists crm_members_profile_idx on crm_members(profile_id);

-- участник пространства: одиночка — сам; агентство — активный профиль с этим agency_id; застройщик — член компании
create or replace function crm_ws_ok(kind text, ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when kind = 'realtor'   then ws = auth.uid()
    when kind = 'agency'    then exists (select 1 from profiles p where p.id = auth.uid() and p.agency_id = ws and p.status = 'active')
    when kind = 'developer' then is_dev_member(ws)
    else false end;
$$;

-- роль участника: owner (всё), manager (свой филиал), agent (свои клиенты).
-- Одиночка — всегда owner; у застройщика dev_role 'admin' — owner; остальное — из crm_members (по умолчанию agent).
create or replace function crm_ws_role(kind text, ws uuid) returns text
language sql stable security definer set search_path = public as $$
  select case
    when not crm_ws_ok(kind, ws) then null
    when kind = 'realtor' then 'owner'
    when kind = 'developer' and exists (select 1 from profiles p where p.id = auth.uid() and p.dev_role = 'admin') then 'owner'
    else coalesce((select m.role from crm_members m where m.ws_kind = kind and m.ws_id = ws and m.profile_id = auth.uid()), 'agent')
  end;
$$;
create or replace function crm_ws_branch(kind text, ws uuid) returns uuid
language sql stable security definer set search_path = public as $$
  select m.branch_id from crm_members m where m.ws_kind = kind and m.ws_id = ws and m.profile_id = auth.uid();
$$;
-- «админ» для старых политик (журнал, чтение всех): владелец пространства
create or replace function crm_ws_admin(kind text, ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select crm_ws_role(kind, ws) = 'owner';
$$;

-- первый, кто открыл CRM агентства/компании, становится владельцем; остальные входят агентами (владелец меняет роли)
create or replace function crm_claim_member(kind text, ws uuid) returns text
language plpgsql security definer set search_path = public as $$
declare r text;
begin
  if not crm_ws_ok(kind, ws) then return null; end if;
  if kind = 'realtor' then return 'owner'; end if;
  select role into r from crm_members where ws_kind = kind and ws_id = ws and profile_id = auth.uid();
  if r is not null then return r; end if;
  if not exists (select 1 from crm_members where ws_kind = kind and ws_id = ws) then r := 'owner';
  elsif kind = 'developer' and exists (select 1 from profiles p where p.id = auth.uid() and p.dev_role = 'admin') then r := 'owner';
  else r := 'agent'; end if;
  insert into crm_members (ws_kind, ws_id, profile_id, role) values (kind, ws, auth.uid(), r) on conflict do nothing;
  return r;
end $$;

alter table crm_branches enable row level security;
alter table crm_members  enable row level security;
drop policy if exists "crm_branches read"  on crm_branches;
drop policy if exists "crm_branches write" on crm_branches;
drop policy if exists "crm_members read"   on crm_members;
drop policy if exists "crm_members write"  on crm_members;
create policy "crm_branches read"  on crm_branches for select using (crm_ws_ok(ws_kind, ws_id));
create policy "crm_branches write" on crm_branches for all using (crm_ws_admin(ws_kind, ws_id)) with check (crm_ws_admin(ws_kind, ws_id));
create policy "crm_members read"   on crm_members  for select using (crm_ws_ok(ws_kind, ws_id));
create policy "crm_members write"  on crm_members  for all using (crm_ws_admin(ws_kind, ws_id)) with check (crm_ws_admin(ws_kind, ws_id));

-- хранилище документов: ключ «agency/<uuid>/…» тоже допустим
create or replace function crm_obj_ok(obj_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare k text; i text;
begin
  k := split_part(obj_name, '/', 1); i := split_part(obj_name, '/', 2);
  if k not in ('realtor', 'agency', 'developer') or i !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return crm_ws_ok(k, i::uuid);
end $$;

-- ---------- 3. клиент ----------
alter table crm_clients add column if not exists kind          text not null default 'person' check (kind in ('person','company'));
alter table crm_clients add column if not exists company       text;
alter table crm_clients add column if not exists roles         text[] not null default '{}';           -- buyer / seller / landlord / tenant
alter table crm_clients add column if not exists stage         text not null default 'new' check (stage in ('new','contacted','qualified','unqualified'));
alter table crm_clients add column if not exists priority      text check (priority in ('hot','warm','cold'));
alter table crm_clients add column if not exists country       text;                                   -- ISO-2
alter table crm_clients add column if not exists citizenship   text;                                   -- ISO-2, по необходимости
alter table crm_clients add column if not exists channel       text check (channel in ('call','whatsapp','telegram','email'));
alter table crm_clients add column if not exists contact_time  text;
alter table crm_clients add column if not exists campaign      text;                                   -- UTM / объявление / номер
alter table crm_clients add column if not exists ref_client_id uuid references crm_clients(id) on delete set null;
alter table crm_clients add column if not exists branch_id     uuid references crm_branches(id) on delete set null;
alter table crm_clients add column if not exists kvkk          jsonb not null default '{}';
-- kvkk: {"info":{"at","method","version"}, "consent":{"call","sms","whatsapp","email","at","revokedAt","basis","source","retainMonths","deleteAt"}}
alter table crm_clients drop constraint if exists crm_clients_ref_kind_check;
alter table crm_clients add constraint crm_clients_ref_kind_check check (ref_kind in ('none','realtor','agency','client','text'));
create index if not exists crm_clients_branch_idx on crm_clients(ws_kind, ws_id, branch_id);

-- старая галочка «согласие» → KVKK: согласие на все каналы с датой
update crm_clients set kvkk = jsonb_build_object('consent', jsonb_build_object('call', true, 'sms', true, 'whatsapp', true, 'email', true, 'at', coalesce(consent_at, created_at), 'basis', 'consent'))
  where consent and kvkk = '{}'::jsonb;

-- ---------- 4. заявки ----------
create table if not exists crm_requests (
  id          uuid primary key default gen_random_uuid(),
  ws_kind     text not null, ws_id uuid not null,
  client_id   uuid not null references crm_clients(id) on delete cascade,
  kind        text not null check (kind in ('buy','sell','rent_out','rent_in')),
  status      text not null default 'active' check (status in ('active','matching','showing','negotiation','paused','closed')),
  owner_id    uuid references profiles(id) on delete set null,
  branch_id   uuid references crm_branches(id) on delete set null,
  listing_id  text,                                   -- продажа/сдача: объявление из базы OnePlan
  project_id  text, unit_uid integer,                 -- застройщик: проект/квартира
  priority    text check (priority in ('hot','warm','cold')),
  deadline    text check (deadline in ('asap','1m','3m','later')),
  fields      jsonb not null default '{}',            -- открытые поля по реестру requestFields.ts (ключ → значение)
  closed_enc  text,                                   -- закрытые поля (минимальная цена и т. п.), JSON зашифрован
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists crm_requests_client_idx on crm_requests(client_id);
create index if not exists crm_requests_ws_idx on crm_requests(ws_kind, ws_id, kind, status);
drop trigger if exists crm_requests_touch on crm_requests;
create trigger crm_requests_touch before update on crm_requests for each row execute function crm_touch();

-- «Что ищет» и бюджет существующих клиентов → первая заявка (покупка или аренда)
insert into crm_requests (ws_kind, ws_id, client_id, kind, owner_id, created_by, created_at, fields)
select c.ws_kind, c.ws_id, c.id,
       case when c.want->>'deal' in ('rent','daily') then 'rent_in' else 'buy' end,
       c.owner_id, c.created_by, c.created_at,
       jsonb_strip_nulls(jsonb_build_object(
         'propType', c.want->'type', 'rooms', c.want->'rooms', 'il', c.want->'il', 'ilces', c.want->'ilces', 'semts', c.want->'semts',
         'budgetMin', c.budget_min, 'budgetMax', c.budget_max, 'cur', c.cur, 'daily', case when c.want->>'deal' = 'daily' then true else null end))
from crm_clients c
where c.merged_into is null and (c.want <> '{}'::jsonb or c.budget_min is not null or c.budget_max is not null)
  and not exists (select 1 from crm_requests r where r.client_id = c.id);
update crm_clients c set roles = array[case when c.want->>'deal' in ('rent','daily') then 'tenant' else 'buyer' end]
  where roles = '{}' and exists (select 1 from crm_requests r where r.client_id = c.id);

-- ---------- 5. сделки ----------
alter table crm_deals add column if not exists request_id      uuid references crm_requests(id) on delete set null;
alter table crm_deals add column if not exists branch_id       uuid references crm_branches(id) on delete set null;
alter table crm_deals add column if not exists commission      numeric(14,2);
alter table crm_deals add column if not exists commission_kind text check (commission_kind in ('pct','sum'));
alter table crm_deals add column if not exists deposit         numeric(14,0);
alter table crm_deals add column if not exists deposit_at      date;
create index if not exists crm_deals_request_idx on crm_deals(request_id);

-- причины отказа (справочник пространства) — в настройках, jsonb ["Дорого", "Купил у другого", …]
alter table crm_settings add column if not exists lost_reasons jsonb not null default '[]';

-- ---------- 6. видимость: owner — всё; manager — свой филиал (+ свои); agent — свои и без ответственного ----------
create or replace function crm_row_ok(kind text, ws uuid, owner uuid, branch uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select crm_ws_ok(kind, ws) and (
    owner = auth.uid() or owner is null
    or crm_ws_role(kind, ws) = 'owner'
    or (crm_ws_role(kind, ws) = 'manager' and branch is not null and branch = crm_ws_branch(kind, ws)));
$$;
create or replace function crm_client_ok(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crm_clients x where x.id = c and crm_row_ok(x.ws_kind, x.ws_id, x.owner_id, x.branch_id));
$$;
drop policy if exists "crm_clients read"   on crm_clients;
drop policy if exists "crm_clients update" on crm_clients;
drop policy if exists "crm_clients delete" on crm_clients;
create policy "crm_clients read"   on crm_clients for select using (crm_row_ok(ws_kind, ws_id, owner_id, branch_id));
create policy "crm_clients update" on crm_clients for update using (crm_row_ok(ws_kind, ws_id, owner_id, branch_id));
create policy "crm_clients delete" on crm_clients for delete
  using (crm_ws_ok(ws_kind, ws_id) and (owner_id = auth.uid() or crm_ws_role(ws_kind, ws_id) in ('owner','manager')));

alter table crm_requests enable row level security;
drop policy if exists "crm_requests via client" on crm_requests;
create policy "crm_requests via client" on crm_requests for all using (crm_client_ok(client_id)) with check (crm_client_ok(client_id));

-- ---------- 7. история: передача клиента ----------
-- crm_events.kind += 'transfer' (payload {fromOwner, toOwner, fromBranch, toBranch}); ограничений на kind в таблице нет.
