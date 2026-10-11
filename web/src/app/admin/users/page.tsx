import { UsersTable, type AdminUser, type Company } from "@/components/admin/UsersTable";
import { hasServiceRole } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminUsersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { q } = await searchParams; // ?q=<название компании> — переход из «Агентства и застройщики»
  const supabase = await createClient();
  const [{ data: profiles }, { data: agencies }, { data: developers }, { data: invites }, { data: members }] = await Promise.all([
    supabase.from("profiles").select("id, name, email, phone, role, status, agency_id, agency_text, developer_id, dev_role, paid_to, platform_staff, color, last_seen, created_at").order("created_at", { ascending: false }),
    supabase.from("agencies").select("id, name").order("name"),
    supabase.from("developers").select("id, name").order("name"),
    supabase.from("invites").select("code, email, role, used_by, created_at").is("used_by", null).order("created_at", { ascending: false }),
    supabase.from("developer_members").select("profile_id, developer_id"),
  ]);
  const byUser: Record<string, string[]> = {};
  for (const m of members ?? []) (byUser[m.profile_id] ??= []).push(m.developer_id);
  return (
    <UsersTable
      users={((profiles ?? []) as AdminUser[]).map((u) => ({ ...u, developer_ids: byUser[u.id] ?? (u.developer_id ? [u.developer_id] : []) }))}
      agencies={(agencies ?? []) as Company[]}
      developers={(developers ?? []) as Company[]}
      invites={(invites ?? []) as { code: string; email: string | null; role: string; created_at: string }[]}
      serviceRole={hasServiceRole()}
      initialQ={q}
    />
  );
}
