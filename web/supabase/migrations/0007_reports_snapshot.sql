-- Жалобы на объявления (07.10.2026): объявления риэлторов пока живут в сид-данных/localStorage, а не в таблице listings,
-- поэтому жалоба хранит ссылку на объявление строкой и снимок карточки (название, цена, фото, владелец) для админки.
alter table reports alter column listing_id drop not null;
alter table reports add column if not exists listing_ref   text;      -- id объявления в приложении (сид/локальный)
alter table reports add column if not exists listing_title text;
alter table reports add column if not exists listing_price numeric;
alter table reports add column if not exists listing_cur   text;
alter table reports add column if not exists listing_photo text;
alter table reports add column if not exists listing_owner text;
alter table reports add column if not exists from_name     text;      -- имя пожаловавшегося на момент жалобы
alter table reports add column if not exists handled_at    timestamptz;
create index if not exists reports_status_idx on reports (status, created_at desc);
-- свои жалобы видит и автор (для «вы уже жаловались»); админ — все (policy "reports admin")
drop policy if exists "reports read own" on reports;
create policy "reports read own" on reports for select using (from_id = auth.uid());
