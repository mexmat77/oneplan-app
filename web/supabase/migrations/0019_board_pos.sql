-- 0019 — порядок карточек на канбанах (12.10.2026): ручная позиция клиента в колонке воронки клиента и сделки в колонке этапа.
-- Дробные позиции (между соседями), без позиции — по дате изменения. Запускать после 0018.
alter table crm_clients add column if not exists board_pos double precision;
alter table crm_deals   add column if not exists board_pos double precision;
