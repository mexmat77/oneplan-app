-- OnePlan «Риэлторы» — initial schema.
-- Run in Supabase → SQL Editor (or `supabase db push`).

create extension if not exists "pgcrypto";

-- ---------- enums ----------
create type member_role   as enum ('realtor', 'admin');
create type member_status as enum ('pending', 'active', 'paused');
create type deal_type     as enum ('sale', 'rent', 'daily');
create type prop_type     as enum ('flat', 'house', 'comm', 'land');
create type listing_status as enum ('active', 'reserved', 'sold', 'off');
create type listing_badge as enum ('new', 'hot', 'exc');
create type heat_type     as enum ('none', 'kombi', 'central', 'ac', 'floor');
create type tapu_type     as enum ('mulkiyet', 'irtifak', 'mustakil', 'hisseli');
create type imar_type     as enum ('konut', 'ticari', 'tarla', 'imarsiz');
create type comm_type     as enum ('shop', 'office', 'depot', 'rest');
create type usage_type    as enum ('empty', 'owner', 'tenant');
create type cephe_type    as enum ('guney', 'kuzey', 'dogu', 'bati');
create type selection_status as enum ('draft', 'sent', 'viewed');
create type client_reaction  as enum ('like', 'maybe', 'no');
create type report_reason as enum ('stale', 'sold', 'price', 'dup', 'other');
create type report_status as enum ('new', 'done');
create type lang_code     as enum ('RU', 'EN', 'TR');

-- ---------- agencies ----------
create table agencies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  addr        text,
  phone       text,
  lic         text,
  scan_path   text,                       -- storage path of the licence scan
  created_at  timestamptz not null default now()
);

-- ---------- profiles (1:1 with auth.users) ----------
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '',
  email       text,
  phone       text,
  agency_id   uuid references agencies(id) on delete set null,
  agency_text text,                        -- free-text agency when not in directory
  color       text not null default '#4d7cfe',
  city        text,
  langs       text,                        -- "RU · EN"
  role        member_role   not null default 'realtor',
  status      member_status not null default 'pending',
  paid_to     date,
  areas       text[] not null default '{}',   -- il keys the realtor works in
  wa_on       boolean not null default true,
  tg_on       boolean not null default false,
  tg_login    text,
  viber_on    boolean not null default false,
  max_on      boolean not null default false,
  max_id      text,
  wechat_on   boolean not null default false,
  wechat_id   text,
  tfa_on      boolean not null default false,
  last_seen   timestamptz,
  created_at  timestamptz not null default now()
);

-- auto-create a profile when a user signs up (name/phone from signup metadata)
create or replace function handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, email, name, phone)
  values (new.id, new.email, coalesce(new.raw_user_meta_data->>'name', ''), new.raw_user_meta_data->>'phone');
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

create or replace function is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and role = 'admin');
$$;
create or replace function is_active_member() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from profiles where id = auth.uid() and status = 'active');
$$;

-- ---------- access requests (landing / login form) ----------
create table access_requests (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  phone       text not null,
  email       text not null,
  agency      text,
  lang        lang_code not null default 'RU',
  status      text not null default 'new',   -- new | accepted | rejected
  created_at  timestamptz not null default now()
);

-- ---------- invites ----------
create table invites (
  code        text primary key,
  created_by  uuid references profiles(id) on delete set null,
  email       text,
  used_by     uuid references profiles(id),
  expires_at  timestamptz,
  created_at  timestamptz not null default now()
);

-- ---------- listings ----------
create table listings (
  id            uuid primary key default gen_random_uuid(),
  short_id      serial,                            -- «№ объявления OP-123»
  owner_id      uuid not null references profiles(id) on delete cascade,
  title         jsonb not null,                    -- {"RU":..,"EN":..,"TR":..}
  description   jsonb not null default '{}',
  base_lang     lang_code not null default 'RU',
  deal          deal_type not null default 'sale',
  type          prop_type not null default 'flat',
  status        listing_status not null default 'active',
  badge         listing_badge,
  price         numeric(14,0) not null,            -- always TRY
  rooms         text not null default '',
  area          integer not null,                  -- net m² (land: plot m²)
  gross_area    integer,
  floor_n       integer,
  floors_total  integer,
  il            text, ilce text, semt text,
  loc           jsonb not null default '{}',       -- display "Antalya · Lara" per lang
  lat           double precision, lng double precision,
  cover_url     text,
  comm          numeric(4,1) not null default 0,   -- partner commission %
  furn          boolean not null default false,
  feats         text[] not null default '{}',
  bath          integer, age integer,
  heat          heat_type,
  balcony       boolean, lift boolean, gasline boolean, in_site boolean,
  credit        boolean, takas boolean,
  aidat         integer, sea_dist integer, deposit numeric(14,0),
  usage         usage_type, cephe cephe_type, tapu tapu_type, imar imar_type,
  emsal         numeric(5,2), ada_parsel text, garden integer,
  comm_type     comm_type, kiraci boolean, devir boolean,
  vnj           boolean not null default false,
  cit           boolean not null default false,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index listings_owner_idx  on listings(owner_id);
create index listings_filter_idx on listings(deal, type, status, il, ilce);

create table listing_photos (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings(id) on delete cascade,
  path        text not null,             -- storage path in bucket "photos"
  sort        integer not null default 0
);
create index listing_photos_listing_idx on listing_photos(listing_id, sort);

create table price_history (
  id          bigserial primary key,
  listing_id  uuid not null references listings(id) on delete cascade,
  price       numeric(14,0) not null,
  changed_at  timestamptz not null default now()
);

create or replace function track_price_change() returns trigger
language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into price_history(listing_id, price) values (new.id, new.price);
  elsif new.price <> old.price then
    insert into price_history(listing_id, price) values (new.id, new.price);
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger listings_price_track before insert or update on listings
  for each row execute function track_price_change();

-- ---------- favourites ----------
create table favorites (
  user_id     uuid not null references profiles(id) on delete cascade,
  listing_id  uuid not null references listings(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (user_id, listing_id)
);

-- ---------- selections (подборки для клиента) ----------
create table selections (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,        -- one-plan.pro/s/<slug>
  owner_id    uuid not null references profiles(id) on delete cascade,
  title       text not null,
  client_name text,
  note        text,
  status      selection_status not null default 'draft',
  views       integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create table selection_items (
  selection_id uuid not null references selections(id) on delete cascade,
  listing_id   uuid not null references listings(id) on delete cascade,
  comment      text,
  sort         integer not null default 0,
  reaction     client_reaction,
  primary key (selection_id, listing_id)
);

-- ---------- saved searches & requests ----------
create table saved_searches (
  id          uuid primary key default gen_random_uuid(),
  owner_id    uuid not null references profiles(id) on delete cascade,
  name        text not null,
  params      jsonb not null default '{}',
  last_opened timestamptz not null default now(),
  published   boolean not null default false,
  created_at  timestamptz not null default now()
);
create table requests (                     -- «Запросы базы»
  id          uuid primary key default gen_random_uuid(),
  by_id       uuid not null references profiles(id) on delete cascade,
  deal        deal_type not null,
  type        prop_type not null,
  rooms       text,
  il          text,
  geo         text,
  max_price   numeric(14,0),
  feat_keys   text[] not null default '{}',
  comment     jsonb not null default '{}',
  expires_at  timestamptz not null default now() + interval '30 days',
  created_at  timestamptz not null default now()
);
create table request_replies (
  request_id  uuid not null references requests(id) on delete cascade,
  listing_id  uuid not null references listings(id) on delete cascade,
  by_id       uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  primary key (request_id, listing_id)
);

-- ---------- chat ----------
create table conversations (
  id          uuid primary key default gen_random_uuid(),
  a_id        uuid not null references profiles(id) on delete cascade,
  b_id        uuid not null references profiles(id) on delete cascade,
  created_at  timestamptz not null default now(),
  unique (a_id, b_id)
);
create table messages (
  id          bigserial primary key,
  conv_id     uuid not null references conversations(id) on delete cascade,
  sender_id   uuid not null references profiles(id) on delete cascade,
  lang        lang_code not null,
  text        jsonb not null,               -- original + AI translations {"RU":..,"EN":..,"TR":..}
  listing_id  uuid references listings(id) on delete set null,
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index messages_conv_idx on messages(conv_id, created_at);

-- ---------- notifications ----------
create table notifications (
  id          bigserial primary key,
  user_id     uuid not null references profiles(id) on delete cascade,
  kind        text not null,
  payload     jsonb not null default '{}',
  read_at     timestamptz,
  created_at  timestamptz not null default now()
);
create index notifications_user_idx on notifications(user_id, created_at desc);

-- ---------- reports (жалобы) ----------
create table reports (
  id          uuid primary key default gen_random_uuid(),
  listing_id  uuid not null references listings(id) on delete cascade,
  from_id     uuid not null references profiles(id) on delete cascade,
  reason      report_reason not null,
  text        text,
  status      report_status not null default 'new',
  created_at  timestamptz not null default now()
);

-- ---------- storage ----------
insert into storage.buckets (id, name, public) values ('photos', 'photos', true)
  on conflict (id) do nothing;

-- ---------- RLS ----------
alter table agencies         enable row level security;
alter table profiles         enable row level security;
alter table access_requests  enable row level security;
alter table invites          enable row level security;
alter table listings         enable row level security;
alter table listing_photos   enable row level security;
alter table price_history    enable row level security;
alter table favorites        enable row level security;
alter table selections       enable row level security;
alter table selection_items  enable row level security;
alter table saved_searches   enable row level security;
alter table requests         enable row level security;
alter table request_replies  enable row level security;
alter table conversations    enable row level security;
alter table messages         enable row level security;
alter table notifications    enable row level security;
alter table reports          enable row level security;

-- members read the shared base; owners/admins write
create policy "agencies read"   on agencies for select using (is_active_member());
create policy "agencies admin"  on agencies for all using (is_admin());

create policy "profiles read"   on profiles for select using (is_active_member() or id = auth.uid());
create policy "profiles self"   on profiles for update using (id = auth.uid());
create policy "profiles admin"  on profiles for all using (is_admin());

create policy "access_requests insert" on access_requests for insert with check (true);
create policy "access_requests admin"  on access_requests for all using (is_admin());

create policy "invites admin"   on invites for all using (is_admin());
create policy "invites read by code" on invites for select using (true);

create policy "listings read"   on listings for select using (is_active_member());
create policy "listings owner"  on listings for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "listings admin"  on listings for all using (is_admin());

create policy "photos read"     on listing_photos for select using (is_active_member());
create policy "photos owner"    on listing_photos for all
  using (exists (select 1 from listings l where l.id = listing_id and (l.owner_id = auth.uid() or is_admin())));

create policy "price_history read" on price_history for select using (is_active_member());

create policy "favorites self"  on favorites for all using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "selections owner" on selections for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());
create policy "selection_items owner" on selection_items for all
  using (exists (select 1 from selections s where s.id = selection_id and s.owner_id = auth.uid()));

create policy "saved_searches self" on saved_searches for all using (owner_id = auth.uid()) with check (owner_id = auth.uid());

create policy "requests read"   on requests for select using (is_active_member());
create policy "requests owner"  on requests for all using (by_id = auth.uid()) with check (by_id = auth.uid());
create policy "request_replies read"  on request_replies for select using (is_active_member());
create policy "request_replies write" on request_replies for insert with check (by_id = auth.uid());

create policy "conversations member" on conversations for all
  using (a_id = auth.uid() or b_id = auth.uid()) with check (a_id = auth.uid() or b_id = auth.uid());
create policy "messages member" on messages for select
  using (exists (select 1 from conversations c where c.id = conv_id and (c.a_id = auth.uid() or c.b_id = auth.uid())));
create policy "messages send" on messages for insert
  with check (sender_id = auth.uid() and exists (select 1 from conversations c where c.id = conv_id and (c.a_id = auth.uid() or c.b_id = auth.uid())));
create policy "messages read-mark" on messages for update
  using (exists (select 1 from conversations c where c.id = conv_id and (c.a_id = auth.uid() or c.b_id = auth.uid())));

create policy "notifications self" on notifications for all using (user_id = auth.uid());

create policy "reports insert"  on reports for insert with check (from_id = auth.uid());
create policy "reports admin"   on reports for all using (is_admin());

-- photos bucket: everyone can view, members upload into their own folder <uid>/...
create policy "photos public read" on storage.objects for select using (bucket_id = 'photos');
create policy "photos member upload" on storage.objects for insert
  with check (bucket_id = 'photos' and auth.uid() is not null and (storage.foldername(name))[1] = auth.uid()::text);
create policy "photos owner delete" on storage.objects for delete
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

-- public (unauthenticated) view of a client selection: via the /s/<slug> route handler using service role.
