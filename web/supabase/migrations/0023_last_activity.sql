-- 0023 (12.10.2026): «последняя активность» клиента — как у HubSpot/Pipedrive/Attio: сортировка списка по умолчанию.
-- В отличие от updated_at (меняется любым update строки, в т. ч. позицией в канбане) обновляется только реальными событиями:
-- запись в ленте (заметка, звонок, смена этапа, документ, передача) и задачи (создание, перенос, выполнение).

alter table crm_clients add column if not exists last_activity_at timestamptz;

update crm_clients c set last_activity_at = greatest(
  c.created_at,
  coalesce((select max(e.created_at) from crm_events e where e.client_id = c.id), c.created_at),
  coalesce((select max(greatest(t.created_at, coalesce(t.done_at, t.created_at))) from crm_tasks t where t.client_id = c.id), c.created_at))
where last_activity_at is null;

alter table crm_clients alter column last_activity_at set default now();
alter table crm_clients alter column last_activity_at set not null;
create index if not exists crm_clients_activity_idx on crm_clients(ws_kind, ws_id, status, last_activity_at desc);

create or replace function crm_activity_touch() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.client_id is not null then update crm_clients set last_activity_at = now() where id = new.client_id; end if;
  return new;
end $$;
drop trigger if exists crm_events_activity on crm_events;
create trigger crm_events_activity after insert on crm_events for each row execute function crm_activity_touch();
drop trigger if exists crm_tasks_activity on crm_tasks;
create trigger crm_tasks_activity after insert or update of due_at, done_at, title on crm_tasks for each row execute function crm_activity_touch();
