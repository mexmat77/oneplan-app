-- История цен: триггер BEFORE INSERT (миграция 0001) писал в price_history до появления строки listings —
-- после 0013 вставка объявления падала с «violates foreign key constraint price_history_listing_id_fkey» (10.10.2026).
-- Делим на два триггера: updated_at — до записи, история цен — после (строка уже есть).
drop trigger if exists listings_price_track on listings;

create or replace function track_price_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'INSERT' or new.price is distinct from old.price then
    insert into price_history(listing_id, price) values (new.id, new.price);
  end if;
  return null;
end $$;

create or replace function listings_touch_updated() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger listings_touch_updated before update on listings
  for each row execute function listings_touch_updated();
create trigger listings_price_track after insert or update on listings
  for each row execute function track_price_change();
