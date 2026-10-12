import { redirect } from "next/navigation";
import { getOrg } from "@/app/org/actions";
import { OrgCard } from "@/components/admin/OrgCard";
import { DevUsersClient } from "@/components/dev/users/DevUsersClient";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// «Пользователи» кабинета застройщика (12.10.2026, модель «Организации и участники»): для реального аккаунта —
// команда своей компании (`OrgCard`: администратор правит роли и приглашает, остальные видят состав); админ платформы —
// в «Управление → Организации»; без сессии (UI-режим) — экраны прототипа на демо-данных.
export default async function DevUsersPage() {
  const me = await getCurrentUser();
  if (!me) return <DevUsersClient />;
  if (me.role === "admin") redirect("/admin/companies");
  let devId = me.developerId;
  if (!devId) {
    const sb = await createClient();
    const { data } = await sb.from("org_members").select("org_id").eq("org_kind", "developer").eq("profile_id", me.id).limit(1).maybeSingle();
    devId = (data?.org_id as string | undefined) ?? null;
  }
  if (!devId) return <DevUsersClient />;
  const view = await getOrg("developer", devId);
  return <OrgCard initial={view} self />;
}
