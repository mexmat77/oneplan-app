import { CompaniesPanel, type CompanyRow, type StaffRow } from "@/components/admin/CompaniesPanel";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function AdminCompaniesPage() {
  const supabase = await createClient();
  const [{ data: agencies }, { data: developers }, { data: profiles }, { data: dm }] = await Promise.all([
    supabase.from("agencies").select("id, name, phone, addr, lic").order("name"),
    supabase.from("developers").select("id, name, phone, addr, lic").order("name"),
    supabase.from("profiles").select("id, name, email, phone, role, dev_role, status, agency_id, developer_id").order("name"),
    supabase.from("org_members").select("profile_id, org_id").eq("org_kind", "developer"),
  ]);
  // Сотрудники по компаниям: агентство — по profiles.agency_id; застройщик — основная компания + доп. членства (developer_members).
  const people = (profiles ?? []) as (StaffRow & { agency_id: string | null; developer_id: string | null })[];
  const staffOf = (key: "agency_id" | "developer_id", id: string): StaffRow[] => {
    const ids = new Set(people.filter((p) => p[key] === id).map((p) => p.id));
    if (key === "developer_id") (dm ?? []).filter((m) => m.org_id === id).forEach((m) => ids.add(m.profile_id as string));
    return people.filter((p) => ids.has(p.id)).map(({ id, name, email, phone, role, dev_role, status }) => ({ id, name, email, phone, role, dev_role, status }));
  };
  return (
    <CompaniesPanel
      agencies={((agencies ?? []) as CompanyRow[]).map((a) => { const st = staffOf("agency_id", a.id); return { ...a, members: st.length, staff: st }; })}
      developers={((developers ?? []) as CompanyRow[]).map((d) => { const st = staffOf("developer_id", d.id); return { ...d, members: st.length, staff: st }; })}
    />
  );
}
