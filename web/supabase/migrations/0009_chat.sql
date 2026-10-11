-- Реальный чат (07.10.2026): диалоги 1-на-1 (conversations a_id/b_id уже есть) + поддержка.
-- Поддержка — сервисный профиль support@one-plan.pro; диалог пользователя с поддержкой = (user, support).
-- Любой админ платформы видит все диалоги с поддержкой и отвечает в них от своего имени (sender_id = админ).
alter table conversations add column if not exists kind text not null default 'dm'; -- dm | support

create or replace function support_id() returns uuid
language sql stable security definer set search_path = public as $$
  select id from profiles where email = 'support@one-plan.pro' limit 1;
$$;

drop policy if exists "conversations support admin" on conversations;
create policy "conversations support admin" on conversations for all
  using (is_admin() and (a_id = support_id() or b_id = support_id()))
  with check (is_admin() and (a_id = support_id() or b_id = support_id()));

drop policy if exists "messages support admin read" on messages;
create policy "messages support admin read" on messages for select
  using (is_admin() and exists (select 1 from conversations c where c.id = conv_id and (c.a_id = support_id() or c.b_id = support_id())));
drop policy if exists "messages support admin send" on messages;
create policy "messages support admin send" on messages for insert
  with check (sender_id = auth.uid() and is_admin() and exists (select 1 from conversations c where c.id = conv_id and (c.a_id = support_id() or c.b_id = support_id())));
drop policy if exists "messages support admin mark" on messages;
create policy "messages support admin mark" on messages for update
  using (is_admin() and exists (select 1 from conversations c where c.id = conv_id and (c.a_id = support_id() or c.b_id = support_id())));

create index if not exists messages_conv_created_idx on messages (conv_id, created_at);
create index if not exists conversations_b_idx on conversations (b_id);

-- Живые обновления: подписка на вставки в messages (RLS применяется к realtime автоматически)
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'messages') then
    alter publication supabase_realtime add table messages;
  end if;
end $$;

-- Уведомления (таблица notifications из 0001): живые обновления + индекс непрочитанных
create index if not exists notifications_unread_idx on notifications (user_id) where read_at is null;
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = 'notifications') then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;
