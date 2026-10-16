import "server-only";

// Выгрузка объявлений риэлтора на его сайт (16.10.2026, «экспорт на свой сайт наладить»): персональный ключ `profiles.api_key`
// (0031) → JSON `/api/v1/listings`, карточка `/api/v1/listings/<uuid>`, XML-фид `/feed/<key>.xml`. Только активные объявления
// владельца ключа; фото — публичные URL Storage; цены в валюте объявления. Поля — как в примере на странице «API и выгрузка».
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { ilName, ilceName } from "@/lib/seed";

type Row = Record<string, unknown>;
export type ApiFilters = { deal?: string | null; type?: string | null; il?: string | null; ilce?: string | null; rooms?: string | null; price_min?: string | null; price_max?: string | null; limit?: string | null; offset?: string | null };

export function keyFrom(req: Request): string | null {
  const h = req.headers.get("authorization") ?? "";
  const m = /^Bearer\s+(\S+)$/i.exec(h);
  if (m) return m[1];
  return new URL(req.url).searchParams.get("key");
}
/** Владелец ключа (id, имя, агентство) или null. */
export async function ownerByKey(key: string | null): Promise<{ id: string; name: string; agency: string } | null> {
  if (!key || !hasServiceRole() || !/^opl_[a-z]+_[0-9a-f]{24,}$/.test(key)) return null;
  const { data } = await createAdminClient().from("profiles").select("id, name, status, agency_text, agencies(name)").eq("api_key", key).maybeSingle();
  if (!data || data.status !== "active") return null;
  const ag = (Array.isArray(data.agencies) ? data.agencies[0] : data.agencies) as { name?: string } | null;
  return { id: data.id as string, name: String(data.name ?? ""), agency: ag?.name || String(data.agency_text ?? "") };
}
export async function listingsFor(ownerId: string, f: ApiFilters, id?: string): Promise<{ rows: Row[]; total: number }> {
  const admin = createAdminClient();
  let q = admin.from("listings").select("id, short_id, deal, type, status, title, description, price, cur, rooms, area, gross_area, floor_n, floors_total, il, ilce, semt, lat, lng, photos, cover_url, feats, furn, vnj, cit, data, created_at, updated_at", { count: "exact" }).eq("owner_id", ownerId).eq("status", "active");
  if (id) q = q.eq("id", id);
  if (f.deal) q = q.eq("deal", f.deal);
  if (f.type) q = q.eq("type", f.type);
  if (f.il) q = q.eq("il", f.il);
  if (f.ilce) q = q.eq("ilce", f.ilce);
  if (f.rooms) q = q.in("rooms", f.rooms.split(",").map((s) => s.trim()).filter(Boolean));
  if (f.price_min && +f.price_min) q = q.gte("price", +f.price_min);
  if (f.price_max && +f.price_max) q = q.lte("price", +f.price_max);
  const limit = Math.min(Math.max(+(f.limit ?? 100) || 100, 1), 500), offset = Math.max(+(f.offset ?? 0) || 0, 0);
  const { data, count } = await q.order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
  return { rows: (data ?? []) as Row[], total: count ?? 0 };
}
export function toApi(r: Row, site: string) {
  const d = (r.data as Row | null) ?? {};
  const ph = (d.ph as [string, number][] | undefined) ?? [];
  return {
    id: r.short_id ? `OP-${r.short_id}` : (r.id as string), uuid: r.id, deal: r.deal, type: r.type, rooms: r.rooms,
    price: Number(r.price) || 0, currency: r.cur ?? "TRY",
    title: r.title ?? {}, description: r.description ?? {},
    location: { il: r.il ?? null, il_name: ilName(String(r.il ?? "")) || null, ilce: r.ilce ?? null, ilce_name: ilceName(String(r.ilce ?? "")) || null, mahalle: r.semt ?? null, lat: r.lat ?? null, lng: r.lng ?? null },
    area: { gross: r.gross_area ?? null, net: r.area ?? null }, floor: r.floor_n ?? null, floors_total: r.floors_total ?? null,
    photos: ((r.photos as string[] | null) ?? []).filter(Boolean), features: (r.feats as string[] | null) ?? [], furnished: !!r.furn, citizenship: !!r.cit, residence_permit: !!r.vnj,
    price_history: ph.map(([date, price]) => ({ date, price })),
    url: `${site}/share/obj/${r.id as string}`, created_at: r.created_at, updated_at: r.updated_at,
  };
}
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function toXml(items: ReturnType<typeof toApi>[], owner: { name: string; agency: string }, site: string): string {
  const one = (o: ReturnType<typeof toApi>) => {
    const t = o.title as Record<string, string>, d = o.description as Record<string, string>;
    return `  <listing id="${esc(o.id)}" uuid="${esc(o.uuid)}">
    <deal>${esc(o.deal)}</deal><type>${esc(o.type)}</type><rooms>${esc(o.rooms)}</rooms>
    <price currency="${esc(o.currency)}">${o.price}</price>
    <title lang="ru">${esc(t.RU)}</title><title lang="en">${esc(t.EN)}</title><title lang="tr">${esc(t.TR)}</title>
    <description lang="ru">${esc(d.RU)}</description><description lang="en">${esc(d.EN)}</description><description lang="tr">${esc(d.TR)}</description>
    <location il="${esc(o.location.il)}" ilce="${esc(o.location.ilce)}" mahalle="${esc(o.location.mahalle)}" lat="${esc(o.location.lat)}" lng="${esc(o.location.lng)}">${esc([o.location.il_name, o.location.ilce_name].filter(Boolean).join(", "))}</location>
    <area gross="${esc(o.area.gross)}" net="${esc(o.area.net)}"/><floor total="${esc(o.floors_total)}">${esc(o.floor)}</floor>
    <photos>${o.photos.map((p) => `<photo>${esc(p)}</photo>`).join("")}</photos>
    <features>${o.features.map((f) => `<feature>${esc(f)}</feature>`).join("")}</features>
    <url>${esc(o.url)}</url><updated_at>${esc(o.updated_at)}</updated_at>
  </listing>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n<listings generated="${new Date().toISOString()}" source="${esc(site)}" realtor="${esc(owner.name)}" agency="${esc(owner.agency)}" count="${items.length}">\n${items.map(one).join("\n")}\n</listings>\n`;
}
export const SITE = () => process.env.NEXT_PUBLIC_SITE_URL || "https://one-plan.pro";
