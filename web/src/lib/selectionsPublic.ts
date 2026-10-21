import "server-only";

// Публичная подборка /s/<slug>: читается на сервере сервисным ключом (аноним по RLS подборки не видит) вместе с объявлениями
// из базы и профилем риэлтора (каналы связи). Демо-объекты прототипа (id не uuid) клиент дорисовывает из seed сам.
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import type { Listing } from "@/lib/types";
import type { Profile } from "@/store/profile";
import type { SelSnap, Selection } from "@/store/selections";
import { trPhone } from "@/lib/phone";
import { getSeedListings } from "@/lib/seed";
import { plural } from "@/lib/plural";
import type { Lang } from "@/i18n";

export type PublicSelection = { s: Selection; listings: Listing[]; owner: Profile };
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function loadPublicSelection(slug: string): Promise<PublicSelection | null> {
  if (!hasServiceRole() || !process.env.NEXT_PUBLIC_SUPABASE_URL || !slug) return null;
  const admin = createAdminClient();
  const { data: row } = await admin.from("selections").select("*").eq("slug", slug.toUpperCase()).maybeSingle();
  if (!row) return null;
  const [{ data: items }, { data: prof }] = await Promise.all([
    admin.from("selection_items").select("listing_id, comment, sort, reaction, snap").eq("selection_id", row.id).order("sort"),
    admin.from("profiles").select("name, phone, agency_text, avatar_url, wa_on, tg_on, tg_login, viber_on, max_on, max_id, wechat_on, wechat_id, agencies(name)").eq("id", row.owner_id).maybeSingle(),
  ]);
  const its = (items ?? []) as { listing_id: string; comment: string | null; sort: number; reaction: "like" | "maybe" | "no" | null; snap: SelSnap | null }[];
  const reacts: Selection["reacts"] = {}; const cm: Record<string, string> = {}; const snap: Record<string, SelSnap> = {};
  its.forEach((it) => { if (it.reaction) reacts[it.listing_id] = it.reaction; if (it.comment) cm[it.listing_id] = it.comment; if (it.snap) snap[it.listing_id] = it.snap; });
  const s: Selection = { id: row.id, slug: row.slug, title: row.title, name: row.client_name ?? "—", note: row.note ?? "", items: its.map((it) => it.listing_id), cm, snap, lang: row.lang ?? undefined, status: row.status, views: row.views, reacts, createdAt: row.created_at, updatedAt: row.updated_at };
  const ids = s.items.filter(isUuid);
  const listings: Listing[] = [];
  if (ids.length) {
    const { data: rows } = await admin.from("listings").select("id, owner_id, status, price, photos, cover_url, data").in("id", ids);
    for (const r of rows ?? []) { const d = r.data as Listing; const photos = (r.photos as string[])?.length ? (r.photos as string[]) : d.photos; listings.push({ ...d, id: r.id, owner: r.owner_id, st: r.status, price: Number(r.price) || d.price, photos, img: r.cover_url || photos[0] || d.img }); }
  }
  const agRow = (prof?.agencies ?? null) as unknown as { name?: string } | { name?: string }[] | null;
  const ag = Array.isArray(agRow) ? agRow[0]?.name : agRow?.name;
  const owner: Profile = {
    name: prof?.name || "—", agency: ag || prof?.agency_text || "", email: "", phone: prof?.phone ? trPhone(prof.phone) : "", areas: [],
    waFound: true, tgFound: true, tgAdded: false, waOn: !!prof?.wa_on, tgOn: !!prof?.tg_on, tgLogin: prof?.tg_login ?? "", vbOn: !!prof?.viber_on, mxOn: !!prof?.max_on, mxId: prof?.max_id ?? "", wcOn: !!prof?.wechat_on, wcId: prof?.wechat_id ?? "", tfaOn: false, avatar: prof?.avatar_url || null,
  };
  return { s, listings, owner };
}

/** Текст для превью ссылки и OG-картинки: «Подборка для Ивана · 5 объектов», цены, районы, риэлтор. */
/** Язык страницы клиента: язык подборки → Accept-Language браузера → RU. */
export function pickSelectionLang(d: PublicSelection | null, acceptLanguage?: string | null): Lang {
  if (d?.s.lang) return d.s.lang;
  const a = (acceptLanguage ?? "").toLowerCase();
  const first = a.split(",")[0]?.trim() ?? "";
  if (first.startsWith("tr")) return "TR";
  if (first.startsWith("ru") || first.startsWith("uk") || first.startsWith("be") || first.startsWith("kk")) return "RU";
  if (first) return "EN";
  return "RU";
}
const SUM = {
  RU: { forWho: (w: string) => `Подборка для ${w}`, generic: "Подборка объектов", n: { one: "объект", few: "объекта", many: "объектов" }, by: (r: string) => `Подготовил(а) ${r}`, tail: "Фото, описания и контакты — по ссылке.", loc: "ru-RU" },
  EN: { forWho: (w: string) => `Selection for ${w}`, generic: "Property selection", n: { one: "listing", other: "listings" }, by: (r: string) => `Prepared by ${r}`, tail: "Photos, details and contacts at the link.", loc: "en-GB" },
  TR: { forWho: (w: string) => `${w} için seçki`, generic: "Konut seçkisi", n: { other: "ilan" }, by: (r: string) => `Hazırlayan: ${r}`, tail: "Fotoğraflar, açıklamalar ve iletişim bağlantıda.", loc: "tr-TR" },
} as const;
export function selectionSummary(d: PublicSelection, lang: Lang = pickSelectionLang(d)) {
  const S = SUM[lang];
  // демо-объекты прототипа (id не uuid) сервер не грузит — для превью берём их из seed, как клиент
  const seedById = new Map(getSeedListings().map((o) => [o.id, o]));
  const all: Listing[] = d.s.items.map((id) => d.listings.find((o) => o.id === id) ?? seedById.get(id)).filter((o): o is Listing => !!o);
  const n = all.length;
  const who = d.s.name?.trim();
  const title = `${who ? S.forWho(who) : d.s.title?.trim() || S.generic} · ${n} ${plural(lang, n, S.n)}`;
  const prices = all.map((o) => o.price).filter((p) => p > 0).sort((a, b) => a - b);
  const cur = all[0]?.cur ?? "TRY";
  const sym = cur === "EUR" ? "€" : cur === "USD" ? "$" : "₺";
  const fmtP = (v: number) => `${Math.round(v).toLocaleString(S.loc).replace(/\u00a0/g, " ")} ${sym}`;
  const priceTxt = prices.length ? (prices.length > 1 && prices[0] !== prices[prices.length - 1] ? `${fmtP(prices[0])} – ${fmtP(prices[prices.length - 1])}` : fmtP(prices[0])) : "";
  const places = Array.from(new Set(all.map((o) => (o.loc?.TR || o.loc?.EN || o.loc?.RU || "").split(",")[0]?.trim()).filter(Boolean) as string[])).slice(0, 2).join(" · "); // названия мест — латиницей по-турецки (правило пользователя)
  const realtor = [d.owner.name, d.owner.agency].filter(Boolean).join(" · ");
  const description = [priceTxt, places, realtor ? S.by(realtor) : ""].filter(Boolean).join(" · ") + ". " + S.tail;
  const photos = all.map((o) => o.photos?.[0] || o.img).filter((u): u is string => !!u).slice(0, 3);
  return { title, description, n, priceTxt, places, realtor, photos, who };
}
