-- 0037 — фото профиля в таблице profiles (21.10.2026, «аватар крупно везде»).
-- Раньше avatar_url жил только в auth.users.raw_user_meta_data (виден лишь самому пользователю в шапке), поэтому на странице
-- риэлтора, объекта, в чате, команде и публичной подборке показывались инициалы. Колонка читается всеми, кто видит профиль
-- (RLS profiles не меняется), пишет её updateMyProfile вместе с user_metadata.
alter table public.profiles add column if not exists avatar_url text;

-- разовый перенос уже загруженных фото из метаданных пользователей
update public.profiles p
set avatar_url = u.raw_user_meta_data ->> 'avatar_url'
from auth.users u
where u.id = p.id
  and coalesce(u.raw_user_meta_data ->> 'avatar_url', '') <> ''
  and p.avatar_url is null;
