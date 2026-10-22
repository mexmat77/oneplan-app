"use server";

// События кабинета застройщика → уведомления коллегам по компании (кроме автора): смена статуса/цены квартиры (из журнала),
// новый объект. Вызывается из синхронизации `store/devRemote.ts`, где уже есть diff локального состояния.
import { getCurrentUser } from "@/lib/auth";
import { notifyDeveloperStaff, type NtfKind } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";

export type DevEvent = { kind: Extract<NtfKind, "dev_status" | "dev_price" | "dev_newobj">; obj: string; objId: number; unit?: string; from?: string; to?: string };

export async function notifyDevEvents(developerId: string, events: DevEvent[]): Promise<void> {
  const me = await getCurrentUser();
  if (!me || !developerId || !events.length) return;
  // только участник этой компании (аудит 23.10.2026: раньше любой вошедший мог слать «уведомления» сотрудникам чужого застройщика)
  if (me.role !== "admin") {
    const admin = createAdminClient();
    const [{ data: m }, { data: p }] = await Promise.all([
      admin.from("org_members").select("profile_id").eq("org_kind", "developer").eq("org_id", developerId).eq("profile_id", me.id).maybeSingle(),
      admin.from("profiles").select("developer_id").eq("id", me.id).maybeSingle(),
    ]);
    if (!m && p?.developer_id !== developerId) return;
  }
  const clip = (s: string | undefined) => String(s ?? "").slice(0, 120);
  // по одному уведомлению на событие (не более 20 за раз — защита от массовых импортов)
  for (const e of events.slice(0, 20)) await notifyDeveloperStaff(developerId, e.kind, { who: me.name, obj: clip(e.obj), objId: Number(e.objId) || 0, unit: clip(e.unit), from: clip(e.from), to: clip(e.to) }, me.id);
}
