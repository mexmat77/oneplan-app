import { redirect } from "next/navigation";
import { getOrg, myOrg } from "@/app/org/actions";
import { OrgCard } from "@/components/admin/OrgCard";
import { TeamSolo } from "@/components/org/TeamSolo";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// «Моё агентство» (12.10.2026): команда агентства для риэлтора — администратор агентства правит роли и приглашает,
// остальные видят состав. Свободный агент видит подсказку. Админ платформы — в «Управление → Организации».
export default async function TeamPage() {
  const me = await getCurrentUser();
  if (!me) return <TeamSolo />;
  if (me.role === "admin") redirect("/admin/companies");
  if (me.role === "developer") redirect("/dev/users");
  const org = await myOrg();
  if (!org) return <TeamSolo />;
  const view = await getOrg(org.kind, org.id);
  return <OrgCard initial={view} self />;
}
