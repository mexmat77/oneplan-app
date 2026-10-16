-- 0031 (16.10.2026): 1) администратор платформы передаёт объявление любому активному риэлтору, в том числе в другое
-- агентство (внутри агентства правила 0021 без изменений); 2) персональный API-ключ риэлтора для выгрузки объявлений на свой
-- сайт (/api/v1/listings, /feed/<key>.xml) — показывается владельцу в «API и выгрузка».
create or replace function transfer_listing(lid uuid, to_profile uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cur_owner uuid; ag uuid; ok boolean := false; adm boolean := is_admin();
begin
  select owner_id into cur_owner from listings where id = lid;
  if cur_owner is null then raise exception 'not-found'; end if;
  select agency_id into ag from profiles where id = cur_owner;
  if adm then
    if not exists (select 1 from profiles where id = to_profile and status = 'active' and role = 'realtor' and id <> cur_owner) then raise exception 'bad-target'; end if;
    update listings set owner_id = to_profile, updated_at = now() where id = lid;
    return;
  end if;
  if ag is null then raise exception 'no-agency'; end if;
  if cur_owner = auth.uid() then ok := true;
  elsif exists (select 1 from profiles p where p.id = auth.uid() and p.agency_id = ag) and crm_ws_role('agency', ag) in ('owner','manager') then ok := true; end if;
  if not ok then raise exception 'forbidden'; end if;
  if not exists (select 1 from profiles where id = to_profile and status = 'active' and agency_id = ag and id <> cur_owner) then raise exception 'bad-target'; end if;
  update listings set owner_id = to_profile, updated_at = now() where id = lid;
end $$;

alter table profiles add column if not exists api_key text unique;
