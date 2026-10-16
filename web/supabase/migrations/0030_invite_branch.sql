-- 0030 (13.10.2026): приглашение в агентство несёт филиал — руководитель филиала приглашает риэлторов сразу в свой филиал,
-- при регистрации по ссылке участник получает branch_id из приглашения.
alter table invites add column if not exists branch_id uuid references crm_branches(id) on delete set null;
