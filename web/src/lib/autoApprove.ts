import "server-only";
// Автопринятие заявок на доступ (18.10.2026, решение пользователя: «сейчас важно принимать всех подряд, отвечать будем долго»):
// при включённой настройке `app_settings.auto_approve` заявка с формы входа или с лендинга сразу становится аккаунтом —
// письмо-приглашение «задайте пароль», профиль с ролью из заявки (риэлтор / застройщик), название компании — текстом
// (`agency_text`); в организацию НЕ добавляем (чужой человек не должен попасть в CRM агентства по совпадению названия) —
// админ привязывает к организации позже в «Пользователи». Если почта уже зарегистрирована — заявка остаётся на ручное решение.
import { createAdminClient } from "@/lib/supabase/admin";
import { notify, notifyAdmins } from "@/lib/notify";

type Admin = ReturnType<typeof createAdminClient>;
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

export async function isAutoApproveOn(admin: Admin): Promise<boolean> {
  try {
    const { data } = await admin.from("app_settings").select("value").eq("key", "auto_approve").maybeSingle();
    return !!(data?.value as { on?: boolean } | null)?.on;
  } catch { return false; }
}

export type AutoApproveInput = { name: string; phone: string; email: string; role: "realtor" | "developer"; lang: string; company: string | null };
/** Создаёт аккаунт по заявке. Возвращает id пользователя или null, если принять автоматически нельзя (почта занята и т. п.). */
export async function autoApproveAccount(admin: Admin, r: AutoApproveInput): Promise<string | null> {
  const { data, error } = await admin.auth.admin.inviteUserByEmail(r.email, { data: { name: r.name, phone: r.phone, lang: r.lang }, redirectTo: `${siteUrl()}/auth/callback` });
  if (error || !data?.user) { console.warn("[auto-approve] invite failed:", error?.message); return null; }
  const { error: e2 } = await admin.from("profiles").upsert({ id: data.user.id, email: r.email, name: r.name, phone: r.phone, role: r.role, status: "active", agency_text: r.company || null });
  if (e2) { console.warn("[auto-approve] profile failed:", e2.message); return null; }
  void notify([data.user.id], "access_approved");
  void notifyAdmins("req_auto", { name: r.name, email: r.email, role: r.role });
  return data.user.id;
}
