import { redirect } from "next/navigation";
import { DevShell, type DevMe } from "@/components/dev/DevShell";
import { getCurrentUser } from "@/lib/auth";
import { countPendingRequests } from "@/lib/adminCounts";
import { getSupportId } from "@/lib/chat/server";
import { createClient } from "@/lib/supabase/server";
import type { DevRole } from "@/lib/dev/types";

// Кабинет застройщика (OnePlan v2). Platform admins act as «superadmin»; developer staff get their `dev_role`.
export default async function DevLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  // Приостановленные и ещё не одобренные пользователи в систему не допускаются (админов не блокируем, чтобы не запереть себя).
  if (me && me.role !== "admin" && me.status !== "active") redirect(`/auth/blocked?s=${me.status}`);
  if (me?.mfaRequired) redirect("/auth/mfa"); // 2FA включена — сначала код из приложения
  if (me && me.role === "realtor") redirect("/catalog");
  const roleOf = (): DevRole => {
    if (!me || me.role === "admin") return "superadmin";
    return me.devRole === "manager" ? "client" : me.devRole === "editor" ? "editor" : "admin";
  };
  // Real companies from Supabase: platform admins see all, developer staff — their memberships.
  let companies: DevMe["companies"] = [];
  let myCompanies: DevMe["myCompanies"] = "all";
  if (me) {
    const sb = await createClient();
    const { data: devs } = await sb.from("developers").select("id, name, director, active, access_until").order("name");
    companies = (devs ?? []).map((d) => ({ uuid: d.id as string, name: d.name as string, director: (d.director as string) ?? "", active: d.active !== false, until: (d.access_until as string) ?? "" }));
    if (me.role !== "admin") {
      const { data: mem } = await sb.from("org_members").select("org_id").eq("org_kind", "developer").eq("profile_id", me.id);
      const ids = new Set<string>((mem ?? []).map((m) => m.org_id as string));
      if (me.developerId) ids.add(me.developerId);
      myCompanies = Array.from(ids);
      companies = companies.filter((c) => ids.has(c.uuid));
    }
  }
  const [adminN, supportId] = await Promise.all([countPendingRequests(!!me && me.role === "admin"), getSupportId()]);
  const shellMe: DevMe = { name: me?.name || "Admin", role: roleOf(), platformAdmin: !me || me.role === "admin", companies, myCompanies, adminN, email: me?.email, avatar: me?.avatar ?? null, id: me?.id ?? null, supportId };
  return <DevShell me={shellMe}>{children}</DevShell>;
}
