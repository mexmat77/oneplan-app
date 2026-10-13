-- 0028 (13.10.2026): воронка сделок риэлторов и агентств — ТОЛЬКО «Открыта → Закрыта / Отменена» (решение пользователя:
-- сделка — финальный этап, показы и брони — статусы заявки; «новый / в работе / показ» — не про сделку).
-- 0027 переводила лишь нетронутые наборы; здесь переводятся ВСЕ наборы realtor/agency со старым ключом «new» (в т. ч. с
-- переименованными этапами), свои имена сбрасываются на словарь. Сделки с любых открытых этапов → «Открыта»,
-- с выигранных → «Закрыта», с проигранных → «Отменена». Наборы застройщиков не трогаются.
do $$
declare w record; s_open uuid; s_won uuid; s_lost uuid; keep uuid[];
begin
  for w in
    select distinct c.ws_kind, c.ws_id from crm_stages c
    where c.scope = 'deal' and c.ws_kind in ('realtor','agency') and c.key = 'new'
      and not exists (select 1 from crm_stages s2 where s2.ws_kind = c.ws_kind and s2.ws_id = c.ws_id and s2.scope = 'deal' and s2.key = 'open')
  loop
    select id into s_open from crm_stages where ws_kind = w.ws_kind and ws_id = w.ws_id and scope = 'deal' and key = 'new';
    select id into s_won  from crm_stages where ws_kind = w.ws_kind and ws_id = w.ws_id and scope = 'deal' and kind = 'won'  order by sort limit 1;
    select id into s_lost from crm_stages where ws_kind = w.ws_kind and ws_id = w.ws_id and scope = 'deal' and kind = 'lost' order by sort limit 1;
    if s_won is null then
      insert into crm_stages (id, ws_kind, ws_id, scope, key, name, kind, color, sort) values (gen_random_uuid(), w.ws_kind, w.ws_id, 'deal', 'closed', '{}'::jsonb, 'won', '#22c15e', 1) returning id into s_won;
    end if;
    if s_lost is null then
      insert into crm_stages (id, ws_kind, ws_id, scope, key, name, kind, color, sort) values (gen_random_uuid(), w.ws_kind, w.ws_id, 'deal', 'cancelled', '{}'::jsonb, 'lost', '#e5484d', 2) returning id into s_lost;
    end if;
    keep := array[s_open, s_won, s_lost];
    update crm_deals d set stage_id = case s.kind when 'won' then s_won when 'lost' then s_lost else s_open end
      from crm_stages s
      where d.stage_id = s.id and d.ws_kind = w.ws_kind and d.ws_id = w.ws_id and s.scope = 'deal' and not (s.id = any(keep));
    delete from crm_stages where ws_kind = w.ws_kind and ws_id = w.ws_id and scope = 'deal' and not (id = any(keep));
    update crm_stages set key = 'open',      name = '{}'::jsonb, color = '#4d7cfe', sort = 0 where id = s_open;
    update crm_stages set key = 'closed',    name = '{}'::jsonb, color = '#22c15e', sort = 1 where id = s_won;
    update crm_stages set key = 'cancelled', name = '{}'::jsonb, color = '#e5484d', sort = 2 where id = s_lost;
  end loop;
end $$;
