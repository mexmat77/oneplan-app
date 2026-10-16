import "server-only";

// Публичные данные объявления для превью ссылки в мессенджерах (16.10.2026, вопрос пользователя «можно ли превью для
// объектов, база же закрытая»): сервисным ключом читаем только то, что попадает в карточку превью — заголовок, цена,
// комнаты/площадь, район, обложка, риэлтор. Сам объект остаётся за входом.
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { ilName, ilceName } from "@/lib/seed";

export type PublicListing = { id: string; no: string; title: string; price: number; cur: string; deal: string; type: string; rooms: string; area: number; place: string; photos: string[]; realtor: string; agency: string };

const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);
export async function loadPublicListing(id: string): Promise<PublicListing | null> {
  if (!hasServiceRole() || !isUuid(id)) return null;
  const admin = createAdminClient();
  const { data: l } = await admin.from("listings").select("id, short_id, title, price, cur, deal, type, rooms, area, il, ilce, semt, photos, cover_url, status, owner_id, data").eq("id", id).maybeSingle();
  if (!l || l.status === "sold") return null;
  const { data: p } = await admin.from("profiles").select("name, agency_text, agencies(name)").eq("id", l.owner_id as string).maybeSingle();
  const ag = (Array.isArray(p?.agencies) ? p?.agencies[0] : p?.agencies) as { name?: string } | null | undefined;
  const t = (l.title as Record<string, string>) ?? {};
  const d = (l.data as { semt?: string; loc?: Record<string, string> } | null) ?? null;
  const place = [ilName(String(l.il ?? "")), ilceName(String(l.ilce ?? "")), d?.loc?.TR?.split("·")[1]?.trim() || ""].filter(Boolean).join(" › ");
  const photos = ((l.photos as string[] | null) ?? []).filter(Boolean); if (!photos.length && l.cover_url) photos.push(String(l.cover_url));
  return { id: l.id as string, no: l.short_id ? `OP-${l.short_id}` : "", title: t.RU || t.EN || t.TR || "", price: Number(l.price) || 0, cur: String(l.cur ?? "TRY"), deal: String(l.deal ?? "sale"), type: String(l.type ?? ""), rooms: String(l.rooms ?? ""), area: Number(l.area) || 0, place, photos, realtor: String(p?.name ?? ""), agency: ag?.name || String(p?.agency_text ?? "") };
}
export const fmtPrice = (v: number, cur: string) => `${Math.round(v).toLocaleString("ru-RU").replace(/ /g, " ")} ${cur === "EUR" ? "€" : cur === "USD" ? "$" : "₺"}`;
export function listingSummary(o: PublicListing) {
  const parts = [o.rooms, o.area ? `${o.area} м²` : "", o.place].filter(Boolean).join(" · ");
  return { title: `${o.title} · ${fmtPrice(o.price, o.cur)}`, description: [parts, o.realtor ? `${o.realtor}${o.agency ? ` · ${o.agency}` : ""}` : ""].filter(Boolean).join(" · ") + ". Объект в закрытой базе OnePlan — подробности после входа." };
}
