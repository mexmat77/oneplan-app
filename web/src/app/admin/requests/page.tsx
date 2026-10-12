import { RequestsList, type AccessRequest } from "@/components/admin/RequestsList";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Вкладка «Заявки»: заявки с формы входа (`access_requests`) и с главной страницы (`leads`, форма лендинга) одним списком.
export default async function AdminRequestsPage() {
  const session = await createClient();
  // Обычно читаем от имени вошедшего админа (RLS `is_admin()`). Только в development с `DEV_AUTH_BYPASS=1` и без сессии —
  // сервисным ключом, чтобы экран можно было смотреть без входа (в продакшне этой ветки нет).
  const { data: { user } } = await session.auth.getUser();
  const bypass = process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";
  const supabase = !user && bypass && hasServiceRole() ? createAdminClient() : session;
  const [{ data }, { data: leads }, { data: profiles }, { data: agencies }, { data: developers }] = await Promise.all([
    supabase.from("access_requests").select("id, name, phone, email, agency, company, role, lang, status, created_at, kind, message").order("created_at", { ascending: false }),
    supabase.from("leads").select("id, name, phone, email, company, role, lang, message, handled, created_at").order("created_at", { ascending: false }),
    supabase.from("profiles").select("email"),
    supabase.from("agencies").select("id, name").order("name"),
    supabase.from("developers").select("id, name").order("name"),
  ]);
  const hasAccount = new Set((profiles ?? []).map((p) => String(p.email || "").toLowerCase()));
  const fromLogin = ((data ?? []) as Omit<AccessRequest, "src">[]).map((r) => ({ ...r, message: r.message || "", src: "login" as const }));
  // у заявки с сайта нет отдельного статуса: обработанная считается принятой, если для этой почты создан аккаунт
  const fromSite: AccessRequest[] = (leads ?? []).map((l) => ({
    id: l.id, name: l.name, phone: l.phone, email: l.email, agency: null, company: l.company || null,
    role: l.role === "d" ? "developer" : "realtor", lang: l.lang, created_at: l.created_at, message: l.message || "", src: "site",
    status: !l.handled ? "new" : hasAccount.has(String(l.email).toLowerCase()) ? "accepted" : "rejected",
  }));
  const rows = [...fromLogin, ...fromSite].sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  return <RequestsList rows={rows} orgs={{ agencies: (agencies ?? []) as { id: string; name: string }[], developers: (developers ?? []) as { id: string; name: string }[] }} />;
}
