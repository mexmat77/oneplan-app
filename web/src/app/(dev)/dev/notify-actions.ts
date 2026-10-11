"use server";

// События кабинета застройщика → уведомления коллегам по компании (кроме автора): смена статуса/цены квартиры (из журнала),
// новый объект. Вызывается из синхронизации `store/devRemote.ts`, где уже есть diff локального состояния.
import { getCurrentUser } from "@/lib/auth";
import { notifyDeveloperStaff, type NtfKind } from "@/lib/notify";

export type DevEvent = { kind: Extract<NtfKind, "dev_status" | "dev_price" | "dev_newobj">; obj: string; objId: number; unit?: string; from?: string; to?: string };

export async function notifyDevEvents(developerId: string, events: DevEvent[]): Promise<void> {
  const me = await getCurrentUser();
  if (!me || !developerId || !events.length) return;
  // по одному уведомлению на событие (не более 20 за раз — защита от массовых импортов)
  for (const e of events.slice(0, 20)) await notifyDeveloperStaff(developerId, e.kind, { who: me.name, obj: e.obj, objId: e.objId, unit: e.unit ?? "", from: e.from ?? "", to: e.to ?? "" }, me.id);
}
