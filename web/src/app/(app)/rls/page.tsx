import { RlsScreen, type RemoteAgency, type RemoteMember, type RlsRemote } from "@/components/rls/RlsScreen";
import { REPORT_SELECT, type ReportRow } from "@/lib/reports";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Экран админа «Риэлторы» (прототип): с Supabase — реальные участники, агентства, жалобы и приглашения (те же таблицы,
// что в «Управлении»); без ключей — демо-стор прототипа (`remote = null`).
export default async function RlsPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return <RlsScreen remote={null} />;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return <RlsScreen remote={null} />;
  const [{ data: profiles }, { data: agencies }, { data: reports }, { count: invitesN }] = await Promise.all([
    sb.from("profiles").select("id, name, email, phone, agency_id, agency_text, color, city, langs, status, paid_to, last_seen, role").in("role", ["realtor", "admin"]).order("created_at", { ascending: false }),
    sb.from("agencies").select("id, name, addr, phone, lic, scan_path").order("name"),
    sb.from("reports").select(REPORT_SELECT).order("created_at", { ascending: false }),
    sb.from("invites").select("code", { count: "exact", head: true }).is("used_by", null),
  ]);
  // роли в CRM агентства (0017): владелец / руководитель / агент — показываются и правятся в «Данные риэлтора»
  const { data: roles } = await sb.from("crm_members").select("profile_id, role").eq("ws_kind", "agency");
  const roleOf = new Map((roles ?? []).map((r) => [r.profile_id as string, r.role as string]));
  const remote: RlsRemote = { members: ((profiles ?? []) as RemoteMember[]).map((p) => ({ ...p, agency_role: roleOf.get(p.id) ?? null })), agencies: (agencies ?? []) as RemoteAgency[], reports: (reports ?? []) as ReportRow[], invitesN: invitesN ?? 0, meId: user.id };
  return <RlsScreen remote={remote} />;
}
