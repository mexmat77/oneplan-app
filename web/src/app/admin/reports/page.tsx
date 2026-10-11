import { ReportsList } from "@/components/admin/ReportsList";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { REPORT_SELECT, type ReportRow } from "@/lib/reports";

export const dynamic = "force-dynamic";

// Вкладка «Жалобы» в «Управлении»: таблица `reports` (жалобы риэлторов на объявления) — новые первыми.
export default async function AdminReportsPage() {
  const session = await createClient();
  const { data: { user } } = await session.auth.getUser();
  const bypass = process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";
  const supabase = !user && bypass && hasServiceRole() ? createAdminClient() : session;
  const { data } = await supabase.from("reports").select(REPORT_SELECT).order("created_at", { ascending: false });
  return <ReportsList rows={(data ?? []) as ReportRow[]} />;
}
