-- 0029 (13.10.2026): 1) личные заметки риэлтора к объектам («что меня тут заинтересовало»), видны только автору;
-- 2) уведомление об изменении цены объявления тем, у кого оно в избранном (kind price_down / price_up, payload для
-- словаря ntfk: title, old, new, cur, pct, id). Пишет триггер базы — срабатывает при любом пути записи.
create table if not exists listing_notes (
  user_id     uuid not null references profiles(id) on delete cascade,
  listing_id  text not null,                  -- uuid объявления из базы или демо-id прототипа
  text        text not null default '',
  updated_at  timestamptz not null default now(),
  primary key (user_id, listing_id)
);
alter table listing_notes enable row level security;
drop policy if exists "listing_notes own" on listing_notes;
create policy "listing_notes own" on listing_notes for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create or replace function notify_price_change() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if tg_op = 'UPDATE' and new.price is distinct from old.price and old.price is not null and old.price > 0 and new.status = 'active' then
    insert into notifications(user_id, kind, payload)
    select f.user_id,
           case when new.price < old.price then 'price_down' else 'price_up' end,
           jsonb_build_object('id', new.id, 'title', coalesce(new.title->>'RU', new.title->>'EN', new.title->>'TR', ''),
                              'old', old.price, 'new', new.price, 'cur', coalesce(new.cur, 'TRY'),
                              'pct', abs(round((new.price - old.price) * 100.0 / old.price)))
    from favorites f
    where f.listing_id::text = new.id::text and f.user_id <> new.owner_id;
  end if;
  return null;
end $$;
drop trigger if exists listings_price_notify on listings;
create trigger listings_price_notify after update on listings
  for each row execute function notify_price_change();
