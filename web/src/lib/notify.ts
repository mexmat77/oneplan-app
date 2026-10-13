import "server-only";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

// Уведомления (таблица `notifications`, RLS «только свои»): пишет сервер сервисным ключом, читает клиент (`lib/notifications/client.ts`).
// `kind` + `payload` — текст собирается на клиенте по словарю `ntfk` на языке получателя.
export type NtfKind =
  | "req_new" | "lead_new" | "unblock_req" | "report_new" | "join_registered"            // админам платформы
  | "access_approved" | "access_restored" | "report_resolved" | "invite_accepted" | "team_added" // пользователю
  | "dev_status" | "dev_price" | "dev_newobj"                                              // команде застройщика
  | "price_down" | "price_up"                                                            // избранное: цена объявления изменилась (триггер 0029)
  | "crm_lead"                                                                              // CRM: заявка с внешнего сайта
  | "listing_transfer" | "client_transfer"                                                 // передача объекта / клиента риэлтору
  | "role_changed";                                                                         // роль в организации изменена
export type NtfPayload = Record<string, string | number | null | undefined>;

export async function notify(userIds: string[], kind: NtfKind, payload: NtfPayload = {}): Promise<void> {
  const ids = Array.from(new Set(userIds.filter(Boolean)));
  if (!ids.length || !hasServiceRole()) return;
  try {
    const { error } = await createAdminClient().from("notifications").insert(ids.map((user_id) => ({ user_id, kind, payload })));
    if (error) console.error("[notify]", kind, error.message);
  } catch (e) { console.error("[notify]", kind, e); }
}

/** Всем активным админам платформы (кроме `exceptId`). */
export async function notifyAdmins(kind: NtfKind, payload: NtfPayload = {}, exceptId?: string | null): Promise<void> {
  if (!hasServiceRole()) return;
  const { data } = await createAdminClient().from("profiles").select("id").eq("role", "admin").eq("status", "active").eq("platform_staff", false);
  await notify((data ?? []).map((p) => p.id as string).filter((id) => id !== exceptId), kind, payload);
}

/** Сотрудникам компании застройщика (основная компания + доп. членства), кроме автора события. */
export async function notifyDeveloperStaff(developerId: string, kind: NtfKind, payload: NtfPayload = {}, exceptId?: string | null): Promise<void> {
  if (!hasServiceRole() || !developerId) return;
  const admin = createAdminClient();
  const [{ data: p }, { data: m }] = await Promise.all([
    admin.from("profiles").select("id").eq("developer_id", developerId).eq("status", "active"),
    admin.from("org_members").select("profile_id").eq("org_kind", "developer").eq("org_id", developerId),
  ]);
  const ids = [...(p ?? []).map((x) => x.id as string), ...(m ?? []).map((x) => x.profile_id as string)].filter((id) => id !== exceptId);
  await notify(ids, kind, payload);
}
