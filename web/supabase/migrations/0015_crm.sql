-- CRM (11.10.2026): клиенты, сделки, задачи, история — внутри OnePlan для риэлторов и застройщиков.
-- Рабочее пространство (ws) = риэлтор (ws_kind 'realtor', ws_id = profiles.id) или компания застройщика
-- ('developer', ws_id = developers.id). Персональные данные клиентов (телефоны, e-mail, мессенджеры, заметки, документы)
-- хранятся ЗАШИФРОВАННЫМИ на уровне приложения (lib/crm/crypto.ts): конвертное шифрование — мастер-ключ CRM_MASTER_KEY
-- в .env на сервере приложения, у каждого ws свой ключ данных (crm_keys.wrapped_key, завёрнут мастер-ключом), AES-256-GCM
-- с привязкой к записи. Поиск дублей — по HMAC нормализованного телефона (value_hash). В панели Supabase и в резервных
-- копиях контакты нечитаемы. Доступ — RLS: риэлтор видит только своё; в компании менеджер — своих клиентов, админ
-- компании — всех. Платформенные админы к данным CRM доступа не имеют (политик для is_admin() нет намеренно).

-- ---------- helpers ----------
create or replace function crm_ws_ok(kind text, ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when kind = 'realtor'   then ws = auth.uid()
    when kind = 'developer' then is_dev_member(ws)
    else false end;
$$;
-- админ компании застройщика (dev_role 'admin') видит всех клиентов компании; realtor-ws — всегда "свой"
create or replace function crm_ws_admin(kind text, ws uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select case
    when kind = 'realtor'   then ws = auth.uid()
    when kind = 'developer' then exists (select 1 from profiles p where p.id = auth.uid() and p.dev_role = 'admin' and is_dev_member(ws))
    else false end;
$$;

-- ---------- ключи данных (конвертное шифрование) ----------
create table if not exists crm_keys (
  ws_kind     text not null check (ws_kind in ('realtor','developer')),
  ws_id       uuid not null,
  wrapped_key text not null,                  -- DEK, зашифрованный мастер-ключом (AES-256-GCM), base64
  key_ver     integer not null default 1,     -- версия мастер-ключа, которым завёрнут DEK (для ротации)
  created_at  timestamptz not null default now(),
  primary key (ws_kind, ws_id)
);

-- ---------- доступ к CRM: бесплатный период 6 мес, потом ограниченный режим без оплаты ----------
alter table profiles   add column if not exists crm_started_at timestamptz;
alter table profiles   add column if not exists crm_paid_to    date;
alter table developers add column if not exists crm_started_at timestamptz;
alter table developers add column if not exists crm_paid_to    date;

-- ---------- справочник источников ----------
create table if not exists crm_sources (
  id          uuid primary key default gen_random_uuid(),
  ws_kind     text not null, ws_id uuid not null,
  name        text not null,
  kind        text not null default 'manual' check (kind in ('manual','site','phone','portal','referral','social','partner','other')),
  token_hash  text,                           -- для входящих заявок с внешних сайтов (api/crm/inbound): sha256 токена
  active      boolean not null default true,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists crm_sources_ws_idx on crm_sources(ws_kind, ws_id);

-- ---------- этапы воронки (свои у каждого ws; наборы по умолчанию создаёт приложение) ----------
create table if not exists crm_stages (
  id          uuid primary key default gen_random_uuid(),
  ws_kind     text not null, ws_id uuid not null,
  key         text not null,                  -- new / work / show / booked / won / lost …
  name        jsonb not null default '{}',    -- {RU, EN, TR}
  kind        text not null default 'open' check (kind in ('open','won','lost')),
  color       text,
  sort        integer not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists crm_stages_ws_idx on crm_stages(ws_kind, ws_id, sort);

-- ---------- клиенты ----------
create table if not exists crm_clients (
  id            uuid primary key default gen_random_uuid(),
  ws_kind       text not null, ws_id uuid not null,
  owner_id      uuid references profiles(id) on delete set null,   -- ответственный менеджер
  name          text not null,
  lang          text not null default 'RU',                         -- язык общения с клиентом
  source_id     uuid references crm_sources(id) on delete set null,
  -- кто привёл клиента (важно застройщику): риэлтор/агентство из базы или текстом
  ref_kind      text not null default 'none' check (ref_kind in ('none','realtor','agency','text')),
  ref_profile_id uuid references profiles(id) on delete set null,
  ref_agency_id  uuid references agencies(id) on delete set null,
  ref_text      text,
  budget_min    numeric(14,0), budget_max numeric(14,0), cur text not null default 'TRY',
  want          jsonb not null default '{}',                        -- {deal, type, rooms[], il, ilces[], semts[]}
  notes_enc     text,                                               -- общая заметка (зашифрована)
  tags          text[] not null default '{}',
  consent       boolean not null default false,                     -- согласие на обработку (KVKK/GDPR)
  consent_at    timestamptz,
  status        text not null default 'active' check (status in ('active','archived')),
  merged_into   uuid references crm_clients(id) on delete set null, -- после слияния дублей
  created_by    uuid references profiles(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists crm_clients_ws_idx on crm_clients(ws_kind, ws_id, status, updated_at desc);

-- контакты клиента: несколько телефонов/e-mail/мессенджеров; значение зашифровано, хэш — для поиска дублей
create table if not exists crm_contacts (
  id          uuid primary key default gen_random_uuid(),
  client_id   uuid not null references crm_clients(id) on delete cascade,
  ws_kind     text not null, ws_id uuid not null,
  kind        text not null check (kind in ('phone','email','whatsapp','telegram','other')),
  value_enc   text not null,
  value_hash  text not null,                  -- HMAC(ws, normalized value)
  label       text,
  is_main     boolean not null default false,
  sort        integer not null default 0
);
create index if not exists crm_contacts_client_idx on crm_contacts(client_id);
create index if not exists crm_contacts_hash_idx on crm_contacts(ws_kind, ws_id, value_hash);

-- ---------- сделки ----------
create table if not exists crm_deals (
  id           uuid primary key default gen_random_uuid(),
  ws_kind      text not null, ws_id uuid not null,
  client_id    uuid not null references crm_clients(id) on delete cascade,
  owner_id     uuid references profiles(id) on delete set null,
  stage_id     uuid references crm_stages(id) on delete set null,
  title        text not null default '',
  deal         text not null default 'sale',                        -- sale / rent / daily
  amount       numeric(14,0), cur text not null default 'TRY',
  listing_id   text,                                                -- риэлтор: объявление из базы/демо
  project_id   text,                                                -- застройщик: dev_objects.id
  unit_uid     integer,                                             -- застройщик: квартира в шахматке
  selection_id uuid references selections(id) on delete set null,  -- риэлтор: подборка клиента
  source_id    uuid references crm_sources(id) on delete set null,
  lost_reason  text,
  closed_at    timestamptz,
  created_by   uuid references profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists crm_deals_ws_idx on crm_deals(ws_kind, ws_id, stage_id, updated_at desc);
create index if not exists crm_deals_client_idx on crm_deals(client_id);

-- ---------- задачи / напоминания ----------
create table if not exists crm_tasks (
  id          uuid primary key default gen_random_uuid(),
  ws_kind     text not null, ws_id uuid not null,
  client_id   uuid references crm_clients(id) on delete cascade,
  deal_id     uuid references crm_deals(id) on delete cascade,
  owner_id    uuid references profiles(id) on delete set null,     -- исполнитель
  kind        text not null default 'call' check (kind in ('call','show','meeting','message','other')),
  title       text not null default '',
  due_at      timestamptz not null,
  done_at     timestamptz,
  notified_at timestamptz,                                          -- напоминание уже отправлено
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists crm_tasks_ws_idx on crm_tasks(ws_kind, ws_id, done_at, due_at);

-- ---------- история (таймлайн клиента/сделки) ----------
create table if not exists crm_events (
  id          bigserial primary key,
  ws_kind     text not null, ws_id uuid not null,
  client_id   uuid references crm_clients(id) on delete cascade,
  deal_id     uuid references crm_deals(id) on delete cascade,
  actor_id    uuid references profiles(id) on delete set null,
  kind        text not null,                  -- created / stage / note / call / show / meeting / task / contact / lead / merge / edit
  payload     jsonb not null default '{}',    -- нечувствительное: {from, to, taskId, field …}
  text_enc    text,                           -- текст заметки/комментария (зашифрован)
  created_at  timestamptz not null default now()
);
create index if not exists crm_events_client_idx on crm_events(client_id, created_at desc);
create index if not exists crm_events_deal_idx   on crm_events(deal_id, created_at desc);

-- кэш переводов заметок: переводит тот, кто смотрит, по кнопке; второй раз не платим
create table if not exists crm_event_tr (
  event_id    bigint not null references crm_events(id) on delete cascade,
  lang        text not null,
  text_enc    text not null,
  primary key (event_id, lang)
);

-- ---------- входящие заявки (внешние сайты, звонки) ----------
create table if not exists crm_inbound (
  id          uuid primary key default gen_random_uuid(),
  ws_kind     text not null, ws_id uuid not null,
  source_id   uuid references crm_sources(id) on delete set null,
  raw_enc     text not null,                  -- исходная заявка целиком (зашифрована)
  client_id   uuid references crm_clients(id) on delete set null,
  deal_id     uuid references crm_deals(id) on delete set null,
  is_dup      boolean not null default false, -- телефон уже был в базе → заявка привязана к существующему клиенту
  created_at  timestamptz not null default now()
);
create index if not exists crm_inbound_ws_idx on crm_inbound(ws_kind, ws_id, created_at desc);

-- ---------- журнал доступа (только добавление; читает владелец ws) ----------
create table if not exists crm_audit (
  id          bigserial primary key,
  ws_kind     text not null, ws_id uuid not null,
  actor_id    uuid references profiles(id) on delete set null,
  action      text not null,                  -- view_client / reveal_contact / export / delete_client / merge / key_created
  target_id   uuid,
  meta        jsonb not null default '{}',
  created_at  timestamptz not null default now()
);
create index if not exists crm_audit_ws_idx on crm_audit(ws_kind, ws_id, created_at desc);

-- ---------- updated_at ----------
create or replace function crm_touch() returns trigger language plpgsql as $$
begin new.updated_at := now(); return new; end $$;
drop trigger if exists crm_clients_touch on crm_clients;
create trigger crm_clients_touch before update on crm_clients for each row execute function crm_touch();
drop trigger if exists crm_deals_touch on crm_deals;
create trigger crm_deals_touch before update on crm_deals for each row execute function crm_touch();

-- ---------- RLS ----------
alter table crm_keys     enable row level security;
alter table crm_sources  enable row level security;
alter table crm_stages   enable row level security;
alter table crm_clients  enable row level security;
alter table crm_contacts enable row level security;
alter table crm_deals    enable row level security;
alter table crm_tasks    enable row level security;
alter table crm_events   enable row level security;
alter table crm_event_tr enable row level security;
alter table crm_inbound  enable row level security;
alter table crm_audit    enable row level security;

-- ключи и справочники: все участники ws
create policy "crm_keys ws"    on crm_keys    for all using (crm_ws_ok(ws_kind, ws_id)) with check (crm_ws_ok(ws_kind, ws_id));
create policy "crm_sources ws" on crm_sources for all using (crm_ws_ok(ws_kind, ws_id)) with check (crm_ws_ok(ws_kind, ws_id));
create policy "crm_stages ws"  on crm_stages  for all using (crm_ws_ok(ws_kind, ws_id)) with check (crm_ws_ok(ws_kind, ws_id));

-- клиенты: свои (owner_id) или админ компании; у риэлтора всё своё
create policy "crm_clients read" on crm_clients for select
  using (crm_ws_ok(ws_kind, ws_id) and (owner_id = auth.uid() or owner_id is null or crm_ws_admin(ws_kind, ws_id)));
create policy "crm_clients write" on crm_clients for insert with check (crm_ws_ok(ws_kind, ws_id));
create policy "crm_clients update" on crm_clients for update
  using (crm_ws_ok(ws_kind, ws_id) and (owner_id = auth.uid() or owner_id is null or crm_ws_admin(ws_kind, ws_id)));
create policy "crm_clients delete" on crm_clients for delete
  using (crm_ws_ok(ws_kind, ws_id) and (owner_id = auth.uid() or crm_ws_admin(ws_kind, ws_id)));

-- контакты, сделки, задачи, события, входящие: видимость через клиента
create or replace function crm_client_ok(c uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from crm_clients x where x.id = c
    and crm_ws_ok(x.ws_kind, x.ws_id) and (x.owner_id = auth.uid() or x.owner_id is null or crm_ws_admin(x.ws_kind, x.ws_id)));
$$;
create policy "crm_contacts via client" on crm_contacts for all using (crm_client_ok(client_id)) with check (crm_client_ok(client_id));
create policy "crm_deals via client"    on crm_deals    for all using (crm_client_ok(client_id)) with check (crm_client_ok(client_id));
create policy "crm_tasks ws"            on crm_tasks    for all
  using (crm_ws_ok(ws_kind, ws_id) and (client_id is null or crm_client_ok(client_id)))
  with check (crm_ws_ok(ws_kind, ws_id) and (client_id is null or crm_client_ok(client_id)));
create policy "crm_events via client"   on crm_events   for all
  using (crm_ws_ok(ws_kind, ws_id) and (client_id is null or crm_client_ok(client_id)))
  with check (crm_ws_ok(ws_kind, ws_id) and (client_id is null or crm_client_ok(client_id)));
create policy "crm_event_tr via event"  on crm_event_tr for all
  using (exists (select 1 from crm_events e where e.id = event_id and crm_ws_ok(e.ws_kind, e.ws_id) and (e.client_id is null or crm_client_ok(e.client_id))))
  with check (exists (select 1 from crm_events e where e.id = event_id and crm_ws_ok(e.ws_kind, e.ws_id)));
create policy "crm_inbound ws"          on crm_inbound  for select using (crm_ws_ok(ws_kind, ws_id));
-- журнал: добавлять могут участники, читать — админ ws (риэлтор = сам), удалять/менять нельзя никому
create policy "crm_audit insert" on crm_audit for insert with check (crm_ws_ok(ws_kind, ws_id));
create policy "crm_audit read"   on crm_audit for select using (crm_ws_admin(ws_kind, ws_id));
