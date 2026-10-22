-- 0038 — закрытие дыр, найденных аудитом 23.10.2026 (три ревью: серверные экшены, публичные маршруты, клиент).
-- 1) invites: политика "invites read by code" (0001:315) была `using (true)` — любой АНОНИМ мог перечислить все открытые
--    приглашения (код, почта, роль, org_role) и зарегистрироваться по чужому коду с любой почтой. Приложение читает invites
--    только сервисным ключом (inviteInfo/registerByInvite/getOrg) — политика просто не нужна.
drop policy if exists "invites read by code" on public.invites;

-- 2) profiles: политика "profiles self" (0001:308) разрешала владельцу обновлять ЛЮБЫЕ колонки своей строки, в том числе
--    role/status/agency_id/developer_id/dev_role/platform_staff/paid_to/api_key — рядовой риэлтор из консоли браузера мог
--    сделать себя админом платформы (is_admin() читает profiles.role). Привилегированные колонки теперь меняет только
--    сервисный ключ или админ платформы — триггер BEFORE UPDATE.
create or replace function public.profiles_guard() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if coalesce(auth.jwt() ->> 'role', '') = 'service_role' or auth.uid() is null or public.is_admin() then
    return new;
  end if;
  if new.role is distinct from old.role
     or new.status is distinct from old.status
     or new.email is distinct from old.email
     or new.agency_id is distinct from old.agency_id
     or new.developer_id is distinct from old.developer_id
     or new.dev_role is distinct from old.dev_role
     or new.platform_staff is distinct from old.platform_staff
     or new.paid_to is distinct from old.paid_to
     or new.api_key is distinct from old.api_key
     or new.api_key_hint is distinct from old.api_key_hint then
    raise exception 'privileged profile columns can be changed only by an administrator' using errcode = '42501';
  end if;
  return new;
end $$;

-- 3) API-ключи хранились открытым текстом в profiles/agencies, а обе таблицы читает любой активный участник
--    (политики "profiles read"/"agencies read") — ключ любого агентства был виден всем. Теперь в колонке лежит sha256-хэш,
--    рядом подсказка (последние 4 символа) для показа «opl_agency_…ab12»; сам ключ показывается один раз при выпуске.
--    Уже выданные ключи продолжают работать: сервер ищет по хэшу входящего ключа.
create extension if not exists pgcrypto with schema extensions;
alter table public.profiles add column if not exists api_key_hint text;
alter table public.agencies add column if not exists api_key_hint text;
update public.profiles set api_key_hint = right(api_key, 4), api_key = encode(digest(convert_to(api_key, 'UTF8'), 'sha256'), 'hex')
  where api_key like 'opl_%';
update public.agencies set api_key_hint = right(api_key, 4), api_key = encode(digest(convert_to(api_key, 'UTF8'), 'sha256'), 'hex')
  where api_key like 'opl_%';

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles for each row execute function public.profiles_guard();
