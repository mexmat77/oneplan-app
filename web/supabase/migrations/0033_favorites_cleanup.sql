-- 16.10.2026. Избранное: при удалении объявления удаляются и строки favorites на него (listing_id — text без FK, т. к. бывают
-- демо-id прототипа); демо-id (o1, o2, …), которых нет в listings, вычищены разово. Бейдж в шапке считает только существующие объекты.
create or replace function favorites_drop_on_listing_delete() returns trigger language plpgsql security definer set search_path = public as $$
begin
  delete from favorites where listing_id = old.id::text;
  return old;
end $$;
drop trigger if exists listings_favorites_cleanup on listings;
create trigger listings_favorites_cleanup after delete on listings for each row execute function favorites_drop_on_listing_delete();
-- разовая чистка: избранное на объекты, которых нет
delete from favorites f where not exists (select 1 from listings l where l.id::text = f.listing_id);
