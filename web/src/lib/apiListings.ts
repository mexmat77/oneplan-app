import { createHash } from "node:crypto";
import "server-only";

// Выгрузка объявлений на внешние сайты (16.10.2026): ключ РИЭЛТОРА (`profiles.api_key`, `opl_live_…`) — его объявления;
// ключ АГЕНТСТВА (`agencies.api_key`, `opl_agency_…`, 0032) — объявления всех риэлторов агентства. JSON `/api/v1/listings`,
// карточка `/api/v1/listings/<uuid>`, справочники `/api/v1/dictionaries`, XML-фид `/feed/<key>.xml`. Документация — /api/docs.
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { GEO, ILCES, ilName, ilceName, semtName } from "@/lib/seed";
import ru from "@/i18n/ru.json";
import en from "@/i18n/en.json";
import tr from "@/i18n/tr.json";

type Row = Record<string, unknown>;
export type ApiScope = { kind: "realtor" | "agency"; ownerIds: string[]; name: string; agency: string; realtors: Record<string, { name: string; phone: string | null; email: string | null }> };
export type ApiFilters = { deal?: string | null; type?: string | null; il?: string | null; ilce?: string | null; rooms?: string | null; price_min?: string | null; price_max?: string | null; status?: string | null; updated_since?: string | null; realtor?: string | null; limit?: string | null; offset?: string | null };

/** sha256 ключа — то, что лежит в profiles/agencies.api_key с миграции 0038. */
export const apiKeyHash = (key: string) => createHash("sha256").update(key, "utf8").digest("hex");
export function keyFrom(req: Request): string | null {
  const m = /^Bearer\s+(\S+)$/i.exec(req.headers.get("authorization") ?? "");
  return m ? m[1] : new URL(req.url).searchParams.get("key");
}
/** Кто стоит за ключом: риэлтор (свои объявления) или агентство (все его активные риэлторы). */
export async function scopeByKey(key: string | null): Promise<ApiScope | null> {
  if (!key || !hasServiceRole() || !/^opl_(live|agency)_[0-9a-f]{24,}$/.test(key)) return null;
  const admin = createAdminClient();
  const hash = apiKeyHash(key); // в базе только sha256 ключа (0038, 23.10.2026) — открытый ключ видели все участники
  if (key.startsWith("opl_agency_")) {
    const { data: ag } = await admin.from("agencies").select("id, name, active").eq("api_key", hash).maybeSingle();
    if (!ag || ag.active === false) return null;
    const { data: ps } = await admin.from("profiles").select("id, name, phone, email").eq("agency_id", ag.id as string).eq("status", "active").eq("role", "realtor");
    const realtors = Object.fromEntries((ps ?? []).map((p) => [p.id as string, { name: String(p.name ?? ""), phone: (p.phone as string | null) ?? null, email: (p.email as string | null) ?? null }]));
    return { kind: "agency", ownerIds: Object.keys(realtors), name: String(ag.name ?? ""), agency: String(ag.name ?? ""), realtors };
  }
  const { data } = await admin.from("profiles").select("id, name, phone, email, status, agency_text, agencies(name)").eq("api_key", hash).maybeSingle();
  if (!data || data.status !== "active") return null;
  const ag = (Array.isArray(data.agencies) ? data.agencies[0] : data.agencies) as { name?: string } | null;
  const id = data.id as string;
  return { kind: "realtor", ownerIds: [id], name: String(data.name ?? ""), agency: ag?.name || String(data.agency_text ?? ""), realtors: { [id]: { name: String(data.name ?? ""), phone: (data.phone as string | null) ?? null, email: (data.email as string | null) ?? null } } };
}
const COLS = "id, short_id, owner_id, deal, type, status, title, description, price, cur, rooms, area, gross_area, floor_n, floors_total, il, ilce, semt, lat, lng, photos, cover_url, feats, furn, vnj, cit, badge, data, created_at, updated_at";
export async function listingsFor(scope: ApiScope, f: ApiFilters, id?: string): Promise<{ rows: Row[]; total: number }> {
  if (!scope.ownerIds.length) return { rows: [], total: 0 };
  const admin = createAdminClient();
  let q = admin.from("listings").select(COLS, { count: "exact" }).in("owner_id", f.realtor && scope.ownerIds.includes(f.realtor) ? [f.realtor] : scope.ownerIds);
  q = f.status === "all" ? q.in("status", ["active", "reserved", "sold", "off"]) : f.status && ["active", "reserved", "sold", "off"].includes(f.status) ? q.eq("status", f.status) : q.eq("status", "active");
  if (id) q = /^\d+$/.test(id) ? q.eq("short_id", Number(id)) : /^[0-9a-f-]{36}$/i.test(id) ? q.eq("id", id) : q.eq("id", "00000000-0000-0000-0000-000000000000");
  if (f.deal) q = q.in("deal", f.deal.split(","));
  if (f.type) q = q.in("type", f.type.split(","));
  if (f.il) q = q.eq("il", f.il);
  if (f.ilce) q = q.in("ilce", f.ilce.split(","));
  if (f.rooms) q = q.in("rooms", f.rooms.split(",").map((s) => s.trim()).filter(Boolean));
  if (f.price_min && +f.price_min) q = q.gte("price", +f.price_min);
  if (f.price_max && +f.price_max) q = q.lte("price", +f.price_max);
  if (f.updated_since && !Number.isNaN(Date.parse(f.updated_since))) q = q.gte("updated_at", new Date(f.updated_since).toISOString());
  const limit = Math.min(Math.max(+(f.limit ?? 100) || 100, 1), 500), offset = Math.max(+(f.offset ?? 0) || 0, 0);
  const { data, count } = await q.order("updated_at", { ascending: false }).range(offset, offset + limit - 1);
  return { rows: (data ?? []) as Row[], total: count ?? 0 };
}
export function toApi(r: Row, site: string, scope?: ApiScope) {
  const d = (r.data as Row | null) ?? {};
  const ph = (d.ph as [string, number][] | undefined) ?? [];
  const owner = scope?.realtors[r.owner_id as string];
  return {
    id: r.short_id ? `OP-${r.short_id}` : (r.id as string), uuid: r.id as string, status: r.status, deal: r.deal, type: r.type, rooms: r.rooms || null,
    price: Number(r.price) || 0, currency: r.cur ?? "TRY", badge: r.badge ?? null,
    title: r.title ?? {}, description: r.description ?? {}, original_lang: (d.base as string) ?? "RU", machine_translated: (d.mt as string[]) ?? [],
    location: { il: r.il ?? null, il_name: ilName(String(r.il ?? "")) || null, ilce: r.ilce ?? null, ilce_name: ilceName(String(r.ilce ?? "")) || null, mahalle: r.semt ?? null, mahalle_name: r.semt ? semtName(String(r.ilce ?? ""), String(r.semt)) : null, lat: r.lat ?? null, lng: r.lng ?? null, sea_distance_m: (d.seaDist as number) ?? null },
    area: { gross: r.gross_area ?? null, net: r.area ?? null }, floor: r.floor_n ?? null, floors_total: r.floors_total ?? null,
    building: { age_years: (d.age as number) ?? null, heating: (d.heat as string[]) ?? [], bathrooms: (d.bath as number) ?? null, balcony: !!d.balcony, lift: !!d.lift, gas: !!d.gasline, in_complex: !!d.inSite, aidat_monthly: (d.aidat as number) ?? null },
    terms: { furnished: !!r.furn, citizenship_eligible: !!r.cit, residence_permit_eligible: !!r.vnj, mortgage: !!d.credit, exchange: !!d.takas, owned_5y: !!d.own5, deposit: (d.deposit as number) ?? null, commission: (d.comm as number) ?? null },
    photos: ((r.photos as string[] | null) ?? []).filter(Boolean), cover: (r.cover_url as string | null) ?? ((r.photos as string[] | null) ?? [])[0] ?? null, features: (r.feats as string[] | null) ?? [],
    price_history: ph.map(([date, price]) => ({ date, price })),
    realtor: owner ? { id: r.owner_id, name: owner.name, phone: owner.phone, email: owner.email } : { id: r.owner_id },
    url: `${site}/share/obj/${r.id as string}`, created_at: r.created_at, updated_at: r.updated_at,
  };
}
type Dict = { typ: Record<string, string>; deal: Record<string, string>; feat: Record<string, string>; stt: Record<string, string>; heat?: Record<string, string> };
const DICTS: Record<"RU" | "EN" | "TR", Dict> = { RU: ru as unknown as Dict, EN: en as unknown as Dict, TR: tr as unknown as Dict };
const tri = (k: string, sect: keyof Dict) => ({ RU: DICTS.RU[sect]?.[k] ?? k, EN: DICTS.EN[sect]?.[k] ?? DICTS.RU[sect]?.[k] ?? k, TR: DICTS.TR[sect]?.[k] ?? DICTS.RU[sect]?.[k] ?? k });
/** Справочники для разработчиков сайтов: подписи значений на трёх языках и география (il → ilçe → mahalle с объектами). */
export function dictionaries() {
  const sect = (s: keyof Dict) => Object.fromEntries(Object.keys(DICTS.RU[s] ?? {}).map((k) => [k, tri(k, s)]));
  return {
    deal: sect("deal"), type: sect("typ"), status: sect("stt"), features: sect("feat"), heating: sect("heat"),
    badge: { excl: { RU: "Эксклюзив", EN: "Exclusive", TR: "Özel" }, new: { RU: "Новый", EN: "New", TR: "Yeni" }, hot: { RU: "Горячее", EN: "Hot", TR: "Fırsat" }, drop: { RU: "Цена снижена", EN: "Price cut", TR: "Fiyat düştü" } },
    geo: GEO.map((g) => ({ key: g.k, name: g.n, ilce: g.ilces.map((i) => ({ key: i.k, name: i.n, mahalle: (ILCES[i.k]?.semts ?? []).map((s) => ({ key: s.k, name: s.n })) })) })),
    rooms: ["1+0", "1+1", "2+1", "3+1", "4+1", "5+1", "6+1"], currencies: ["TRY", "EUR", "USD"],
  };
}
const esc = (v: unknown) => String(v ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
export function toXml(items: ReturnType<typeof toApi>[], scope: ApiScope, site: string): string {
  const one = (o: ReturnType<typeof toApi>) => {
    const t = o.title as Record<string, string>, d = o.description as Record<string, string>;
    return `  <listing id="${esc(o.id)}" uuid="${esc(o.uuid)}" status="${esc(o.status)}">
    <deal>${esc(o.deal)}</deal><type>${esc(o.type)}</type><rooms>${esc(o.rooms)}</rooms>${o.badge ? `<badge>${esc(o.badge)}</badge>` : ""}
    <price currency="${esc(o.currency)}">${o.price}</price>
    <title lang="ru">${esc(t.RU)}</title><title lang="en">${esc(t.EN)}</title><title lang="tr">${esc(t.TR)}</title>
    <description lang="ru">${esc(d.RU)}</description><description lang="en">${esc(d.EN)}</description><description lang="tr">${esc(d.TR)}</description>
    <location il="${esc(o.location.il)}" ilce="${esc(o.location.ilce)}" mahalle="${esc(o.location.mahalle)}" lat="${esc(o.location.lat)}" lng="${esc(o.location.lng)}" sea_distance_m="${esc(o.location.sea_distance_m)}">${esc([o.location.il_name, o.location.ilce_name, o.location.mahalle_name].filter(Boolean).join(", "))}</location>
    <area gross="${esc(o.area.gross)}" net="${esc(o.area.net)}"/><floor total="${esc(o.floors_total)}">${esc(o.floor)}</floor>
    <building age_years="${esc(o.building.age_years)}" bathrooms="${esc(o.building.bathrooms)}" balcony="${o.building.balcony}" lift="${o.building.lift}" gas="${o.building.gas}" in_complex="${o.building.in_complex}" aidat_monthly="${esc(o.building.aidat_monthly)}">${o.building.heating.map((h) => `<heating>${esc(h)}</heating>`).join("")}</building>
    <terms furnished="${o.terms.furnished}" citizenship_eligible="${o.terms.citizenship_eligible}" residence_permit_eligible="${o.terms.residence_permit_eligible}" mortgage="${o.terms.mortgage}" exchange="${o.terms.exchange}" deposit="${esc(o.terms.deposit)}"/>
    <photos>${o.photos.map((p) => `<photo>${esc(p)}</photo>`).join("")}</photos>
    <features>${o.features.map((f) => `<feature>${esc(f)}</feature>`).join("")}</features>
    <realtor id="${esc(o.realtor.id)}">${esc((o.realtor as { name?: string }).name)}</realtor>
    <url>${esc(o.url)}</url><created_at>${esc(o.created_at)}</created_at><updated_at>${esc(o.updated_at)}</updated_at>
  </listing>`;
  };
  return `<?xml version="1.0" encoding="UTF-8"?>\n<listings generated="${new Date().toISOString()}" source="${esc(site)}" scope="${scope.kind}" name="${esc(scope.name)}" agency="${esc(scope.agency)}" count="${items.length}">\n${items.map(one).join("\n")}\n</listings>\n`;
}
export const SITE = () => process.env.NEXT_PUBLIC_SITE_URL || "https://one-plan.pro";
export const CORS = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "Authorization, Content-Type" };
