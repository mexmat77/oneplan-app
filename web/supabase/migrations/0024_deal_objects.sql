-- 0024 (12.10.2026): объекты в CRM — «из базы или свободно» (решение пользователя).
-- Сделка: один объект — объявление риэлтора (listing_id), квартира застройщика (project_id + unit_uid) ИЛИ свободный текст
-- (object_text: не из базы OnePlan / не хочется указывать подробно). Заявка клиента-покупателя: несколько подобранных
-- вариантов (variants jsonb: [{kind:'listing', id} | {kind:'unit', projectId, unitUid} | {kind:'free', text, url?}]).
alter table crm_deals    add column if not exists object_text text;
alter table crm_requests add column if not exists variants jsonb not null default '[]'::jsonb;
-- объявление, выставленное повторно после продажи (новый id, ссылка на прежнее)
alter table listings add column if not exists relisted_from uuid references listings(id) on delete set null;
