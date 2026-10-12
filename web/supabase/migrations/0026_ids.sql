-- 0026 (12.10.2026): единая система номеров (решение пользователя «нормальная id-система, эталон»).
-- Как у Sahibinden / HubSpot / Pipedrive: технический uuid — только в адресах и базе, людям — короткий сквозной номер
-- фиксированной ширины: объявления OP-100001…, клиенты CRM C-100001…, сделки D-100001… (глобальные последовательности, без
-- повторов, без «подбора» соседних номеров как смысла — просто порядковый).

-- объявления: short_id уже есть (serial с 1) → переносим в диапазон 100001+
update listings set short_id = short_id + 100000 where short_id < 100000;
select setval('listings_short_id_seq', greatest(coalesce((select max(short_id) from listings), 0), 100000));

-- клиенты CRM
alter table crm_clients add column if not exists no bigint;
create sequence if not exists crm_clients_no_seq start with 100001;
update crm_clients c set no = s.n from (select id, 100000 + row_number() over (order by created_at) as n from crm_clients where no is null) s where s.id = c.id;
select setval('crm_clients_no_seq', greatest(coalesce((select max(no) from crm_clients), 0), 100000));
alter table crm_clients alter column no set default nextval('crm_clients_no_seq');
alter table crm_clients alter column no set not null;
create unique index if not exists crm_clients_no_idx on crm_clients(no);

-- сделки CRM
alter table crm_deals add column if not exists no bigint;
create sequence if not exists crm_deals_no_seq start with 100001;
update crm_deals d set no = s.n from (select id, 100000 + row_number() over (order by created_at) as n from crm_deals where no is null) s where s.id = d.id;
select setval('crm_deals_no_seq', greatest(coalesce((select max(no) from crm_deals), 0), 100000));
alter table crm_deals alter column no set default nextval('crm_deals_no_seq');
alter table crm_deals alter column no set not null;
create unique index if not exists crm_deals_no_idx on crm_deals(no);
