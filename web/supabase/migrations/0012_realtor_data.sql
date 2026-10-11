-- Объявления риэлторов, избранное, подборки, сохранённые поиски и запросы базы переезжают из localStorage в Supabase (10.10.2026).
-- Объявление хранится документом: data = объект Listing приложения (как dev_objects.data), плюс колонки для фильтров/индексов.
-- id объявления = uuid, который генерирует форма (crypto.randomUUID). Фото — bucket "photos" (<uid>/<listing>/<n>.jpg), публичные URL в photos[].
alter table listings add column if not exists data    jsonb  not null default '{}'::jsonb;
alter table listings add column if not exists photos  text[] not null default '{}';
alter table listings add column if not exists exports jsonb  not null default '{}'::jsonb;   -- экспорт на порталы {portal: true}
alter table listings add column if not exists cur     text   not null default 'TRY';

-- Ссылки на объявления в избранном, подборках и ответах — текстовые: там бывают демо-объекты каталога (id вида g40_0),
-- которых нет в таблице listings.
alter table favorites        drop constraint if exists favorites_listing_id_fkey;
alter table favorites        alter column listing_id type text using listing_id::text;
alter table selection_items  drop constraint if exists selection_items_listing_id_fkey;
alter table selection_items  alter column listing_id type text using listing_id::text;
alter table request_replies  drop constraint if exists request_replies_listing_id_fkey;
alter table request_replies  alter column listing_id type text using listing_id::text;

alter table saved_searches add column if not exists new_n integer not null default 0;
alter table requests       add column if not exists from_search uuid references saved_searches(id) on delete set null;

-- Чужие подборки не видны (RLS owner); публичная страница /s/<slug> и реакции клиента идут через сервер (service role).
-- Запросы базы: удалять может автор (политика "requests owner" уже for all).
create index if not exists favorites_user_idx on favorites(user_id);
create index if not exists selection_items_sel_idx on selection_items(selection_id, sort);
create index if not exists saved_searches_owner_idx on saved_searches(owner_id);
create index if not exists requests_created_idx on requests(created_at desc);
