-- 0018 — воронка КЛИЕНТА (12.10.2026): статусы работы менеджера с клиентом до сделки (новый → недозвон → в работе → подбор →
-- показ → думает → сделка / отказ / нецелевой), настраиваемые на пространство как и этапы сделок. Этапы хранятся в той же
-- crm_stages с полем scope ('deal' | 'client'); crm_clients.stage — КЛЮЧ этапа клиента (text), без фиксированного списка.
-- Запускать в Supabase SQL Editor после 0017.

alter table crm_stages add column if not exists scope text not null default 'deal' check (scope in ('deal','client'));
create index if not exists crm_stages_scope_idx on crm_stages(ws_kind, ws_id, scope, sort);

-- статус клиента — любой ключ этапа scope='client' (наборы по умолчанию создаёт приложение при первом открытии)
alter table crm_clients drop constraint if exists crm_clients_stage_check;
-- старые значения 0017 → ключи новой воронки
update crm_clients set stage = 'work' where stage in ('contacted','qualified');
update crm_clients set stage = 'unqualified' where stage = 'unqualified';
create index if not exists crm_clients_stage_idx on crm_clients(ws_kind, ws_id, stage);
