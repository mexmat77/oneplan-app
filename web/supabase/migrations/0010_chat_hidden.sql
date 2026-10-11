-- Скрытие (удаление у себя) диалогов чата (07.10.2026): запись = «пользователь скрыл диалог в hidden_at».
-- Диалог снова виден, когда в нём появляется сообщение новее hidden_at. Сообщения не удаляются.
create table if not exists conversation_hidden (
  conv_id    uuid not null references conversations(id) on delete cascade,
  user_id    uuid not null references profiles(id) on delete cascade,
  hidden_at  timestamptz not null default now(),
  primary key (conv_id, user_id)
);
alter table conversation_hidden enable row level security;
drop policy if exists "conversation_hidden self" on conversation_hidden;
create policy "conversation_hidden self" on conversation_hidden for all using (user_id = auth.uid()) with check (user_id = auth.uid());
