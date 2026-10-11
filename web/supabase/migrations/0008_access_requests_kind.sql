-- Обращения заблокированных пользователей (07.10.2026): со страницы входа «Написать администратору» → та же таблица
-- заявок, kind = 'unblock' (восстановление доступа). Админ видит их во вкладке «Заявки» и возвращает доступ одной кнопкой.
alter table access_requests add column if not exists kind text not null default 'access';  -- access | unblock
alter table access_requests add column if not exists message text;
