-- Сделать первого пользователя администратором.
-- ЗАМЕНИТЕ адрес ниже на почту, с которой создали пользователя в Authentication → Users.
insert into profiles (id, email, name, role, status)
select id, email, 'Администратор', 'admin', 'active'
from auth.users
where email = 'mexmat77@gmail.com'
on conflict (id) do update set role = 'admin', status = 'active';
