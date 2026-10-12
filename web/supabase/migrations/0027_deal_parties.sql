-- 0027 (13.10.2026): стороны сделки и анкеты (решение пользователя).
--   • crm_clients.dossier_enc — АНКЕТА стороны для договоров (паспорт / T.C. kimlik, адрес, налоговый номер, IBAN…),
--     заполняется один раз в карточке клиента и подставляется во все документы, где клиент — покупатель или продавец;
--   • crm_deals.company_profile_id — юрлицо (набор реквизитов из настроек), от имени которого заключается сделка;
--   • crm_deals.seller_client_id — продавец (клиент CRM с анкетой) для трёхсторонних договоров вторички; у застройщика пусто;
--   • заявки: статус «Бронь» (showing / booked — этапы работы по заявке, а не сделки);
--   • воронка сделок упрощается: Открыта → Закрыта / Отменена (показы и брони — у заявок). Переводятся только пространства
--     с нетронутым набором по умолчанию; сделки на «В работе/Показ/Бронь» становятся «Открыта».
alter table crm_clients add column if not exists dossier_enc text;
alter table crm_deals   add column if not exists company_profile_id text;
alter table crm_deals   add column if not exists seller_client_id uuid references crm_clients(id) on delete set null;

alter table crm_requests drop constraint if exists crm_requests_status_check;
alter table crm_requests add constraint crm_requests_status_check
  check (status in ('active','matching','showing','booked','negotiation','paused','closed'));

do $$
declare w record; s_open uuid;
begin
  for w in
    select ws_kind, ws_id from crm_stages where scope = 'deal'
    group by ws_kind, ws_id
    having array_agg(key order by key) = array['booked','lost','new','show','won','work'] and bool_and(name = '{}'::jsonb)
  loop
    select id into s_open from crm_stages where ws_kind = w.ws_kind and ws_id = w.ws_id and scope = 'deal' and key = 'new';
    update crm_deals set stage_id = s_open
      where ws_kind = w.ws_kind and ws_id = w.ws_id
        and stage_id in (select id from crm_stages where ws_kind = w.ws_kind and ws_id = w.ws_id and scope = 'deal' and key in ('work','show','booked'));
    delete from crm_stages where ws_kind = w.ws_kind and ws_id = w.ws_id and scope = 'deal' and key in ('work','show','booked');
    update crm_stages set key = 'open', color = '#4d7cfe', sort = 0 where id = s_open;
    update crm_stages set key = 'closed', sort = 1 where ws_kind = w.ws_kind and ws_id = w.ws_id and scope = 'deal' and key = 'won';
    update crm_stages set key = 'cancelled', sort = 2 where ws_kind = w.ws_kind and ws_id = w.ws_id and scope = 'deal' and key = 'lost';
  end loop;
end $$;
