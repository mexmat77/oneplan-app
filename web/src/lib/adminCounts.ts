import "server-only";
import { createClient } from "@/lib/supabase/server";
const hasSupabaseEnv = () => !!process.env.NEXT_PUBLIC_SUPABASE_URL && !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

/** Счётчики для бейджей админа: необработанные заявки (запросы доступа + заявки с главной) и новые жалобы. Для не-админов — нули. */
export async function countAdminPending(isAdmin: boolean): Promise<{ requests: number; reports: number }> {
  if (!isAdmin || !hasSupabaseEnv()) return { requests: 0, reports: 0 };
  try {
    const sb = await createClient();
    const [a, l, r] = await Promise.all([
      sb.from("access_requests").select("id", { count: "exact", head: true }).eq("status", "new"),
      sb.from("leads").select("id", { count: "exact", head: true }).eq("handled", false),
      sb.from("reports").select("id", { count: "exact", head: true }).eq("status", "new"),
    ]);
    return { requests: (a.count ?? 0) + (l.count ?? 0), reports: r.count ?? 0 };
  } catch {
    return { requests: 0, reports: 0 };
  }
}
/** Сумма для чипа «Управление» в шапке. */
export async function countPendingRequests(isAdmin: boolean): Promise<number> {
  const c = await countAdminPending(isAdmin);
  return c.requests + c.reports;
}
