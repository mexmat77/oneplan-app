-- 0020 — передача объявления другому риэлтору (12.10.2026). Политика «listings owner» не даёт сменить owner_id на чужой
-- (with check owner_id = auth.uid()), поэтому — функция с проверкой прав: текущий владелец, владелец/руководитель CRM
-- того же агентства или админ платформы. Запускать после 0019.
create or replace function transfer_listing(lid uuid, to_profile uuid) returns void
language plpgsql security definer set search_path = public as $$
declare cur_owner uuid; ag uuid; ok boolean := false;
begin
  select owner_id into cur_owner from listings where id = lid;
  if cur_owner is null then raise exception 'not-found'; end if;
  if cur_owner = auth.uid() or is_admin() then ok := true;
  else
    select agency_id into ag from profiles where id = cur_owner;
    if ag is not null and exists (select 1 from profiles p where p.id = auth.uid() and p.agency_id = ag)
       and crm_ws_role('agency', ag) in ('owner','manager') then ok := true; end if;
  end if;
  if not ok then raise exception 'forbidden'; end if;
  if not exists (select 1 from profiles where id = to_profile and status = 'active' and role in ('realtor','admin')) then raise exception 'bad-target'; end if;
  update listings set owner_id = to_profile, updated_at = now() where id = lid;
end $$;
