-- CRM: документы сделки (11.10.2026). Шаблоны Word с плейсхолдерами {{client.name}} … → готовый DOCX (+PDF через LibreOffice
-- на сервере), свои файлы сделки (паспорт, тапу, расписки), реквизиты компании для подстановки. Файлы — в закрытом bucket
-- "crm" (путь <ws_kind>/<ws_id>/…), доступ только участникам ws через RLS хранилища и временные ссылки; параметры документа
-- (паспорта, суммы, адреса) — зашифрованы ключом ws (params_enc), как остальные персональные данные CRM.

-- реквизиты ws для документов (название, налоговый номер, адрес, представитель, IBAN…) — зашифрованный jsonb
create table if not exists crm_settings (
  ws_kind     text not null, ws_id uuid not null,
  company_enc text,
  updated_at  timestamptz not null default now(),
  primary key (ws_kind, ws_id)
);

-- шаблоны: встроенные (ws_id null, файлы в репозитории) + свои (DOCX в bucket crm)
create table if not exists crm_doc_templates (
  id          uuid primary key default gen_random_uuid(),
  ws_kind     text, ws_id uuid,                 -- null/null = встроенный
  key         text,                              -- ключ встроенного шаблона
  name        text not null,
  lang        text not null default 'TR',
  kind        text not null default 'other',    -- sale / rent / deposit / viewing / handover / consent / other
  path        text,                              -- storage path своего шаблона
  fields      jsonb not null default '[]',       -- [{key,label:{RU,EN,TR},type,group,required}]
  active      boolean not null default true,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists crm_doc_templates_ws_idx on crm_doc_templates(ws_kind, ws_id);

-- документы сделки/клиента: сгенерированные и загруженные
create table if not exists crm_docs (
  id          uuid primary key default gen_random_uuid(),
  ws_kind     text not null, ws_id uuid not null,
  client_id   uuid references crm_clients(id) on delete cascade,
  deal_id     uuid references crm_deals(id) on delete cascade,
  template_id uuid references crm_doc_templates(id) on delete set null,
  template_key text,                             -- для встроенных
  title       text not null,
  kind        text not null default 'other',
  status      text not null default 'draft' check (status in ('draft','sent','signed','void')),
  path_docx   text,                              -- storage path DOCX
  path_pdf    text,                              -- storage path PDF (если сконвертирован)
  path_file   text,                              -- загруженный файл (любой тип)
  mime        text, size integer,
  params_enc  text,                              -- значения полей (зашифрованы)
  valid_until date,
  signed_at   timestamptz,
  created_by  uuid references profiles(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists crm_docs_deal_idx on crm_docs(deal_id, created_at desc);
create index if not exists crm_docs_client_idx on crm_docs(client_id, created_at desc);
drop trigger if exists crm_docs_touch on crm_docs;
create trigger crm_docs_touch before update on crm_docs for each row execute function crm_touch();

-- в сделке — данные для договоров, которые переиспользуются между документами (продавец, тапу, оплата) — зашифрованы
alter table crm_deals add column if not exists extra_enc text;

alter table crm_settings      enable row level security;
alter table crm_doc_templates enable row level security;
alter table crm_docs          enable row level security;
create policy "crm_settings ws" on crm_settings for all using (crm_ws_ok(ws_kind, ws_id)) with check (crm_ws_ok(ws_kind, ws_id));
create policy "crm_doc_templates read" on crm_doc_templates for select using (ws_id is null or crm_ws_ok(ws_kind, ws_id));
create policy "crm_doc_templates write" on crm_doc_templates for all using (ws_id is not null and crm_ws_ok(ws_kind, ws_id)) with check (ws_id is not null and crm_ws_ok(ws_kind, ws_id));
create policy "crm_docs ws" on crm_docs for all
  using (crm_ws_ok(ws_kind, ws_id) and (client_id is null or crm_client_ok(client_id)))
  with check (crm_ws_ok(ws_kind, ws_id) and (client_id is null or crm_client_ok(client_id)));

-- ---------- хранилище: закрытый bucket "crm", папка = <ws_kind>/<ws_id>/… ----------
insert into storage.buckets (id, name, public, file_size_limit)
  values ('crm', 'crm', false, 26214400)
  on conflict (id) do update set public = false, file_size_limit = 26214400;
-- путь объекта → проверка ws; без приведения к uuid в самой политике (иначе объекты других bucket с не-uuid сегментом
-- ломали бы политику ошибкой приведения)
create or replace function crm_obj_ok(obj_name text) returns boolean
language plpgsql stable security definer set search_path = public as $$
declare k text; i text;
begin
  k := split_part(obj_name, '/', 1); i := split_part(obj_name, '/', 2);
  if k not in ('realtor', 'developer') or i !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return false; end if;
  return crm_ws_ok(k, i::uuid);
end $$;
drop policy if exists "crm storage read" on storage.objects;
drop policy if exists "crm storage write" on storage.objects;
drop policy if exists "crm storage update" on storage.objects;
drop policy if exists "crm storage delete" on storage.objects;
create policy "crm storage read"   on storage.objects for select using (bucket_id = 'crm' and crm_obj_ok(name));
create policy "crm storage write"  on storage.objects for insert with check (bucket_id = 'crm' and crm_obj_ok(name));
create policy "crm storage update" on storage.objects for update using (bucket_id = 'crm' and crm_obj_ok(name));
create policy "crm storage delete" on storage.objects for delete using (bucket_id = 'crm' and crm_obj_ok(name));
