import "server-only";

// Публичная подборка /s/<slug>: читается на сервере сервисным ключом (аноним по RLS подборки не видит) вместе с объявлениями
// из базы и профилем риэлтора (каналы связи). Демо-объекты прототипа (id не uuid) клиент дорисовывает из seed сам.
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import type { Listing } from "@/lib/types";
import type { Profile } from "@/store/profile";
import type { Selection } from "@/store/selections";
import { trPhone } from "@/lib/phone";

export type PublicSelection = { s: Selection; listings: Listing[]; owner: Profile };
const isUuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s);

export async function loadPublicSelection(slug: string): Promise<PublicSelection | null> {
  if (!hasServiceRole() || !process.env.NEXT_PUBLIC_SUPABASE_URL || !slug) return null;
  const admin = createAdminClient();
  const { data: row } = await admin.from("selections").select("*").eq("slug", slug.toUpperCase()).maybeSingle();
  if (!row) return null;
  const [{ data: items }, { data: prof }] = await Promise.all([
    admin.from("selection_items").select("listing_id, comment, sort, reaction").eq("selection_id", row.id).order("sort"),
    admin.from("profiles").select("name, phone, agency_text, wa_on, tg_on, tg_login, viber_on, max_on, max_id, wechat_on, wechat_id, agencies(name)").eq("id", row.owner_id).maybeSingle(),
  ]);
  const its = (items ?? []) as { listing_id: string; comment: string | null; sort: number; reaction: "like" | "maybe" | "no" | null }[];
  const reacts: Selection["reacts"] = {}; const cm: Record<string, string> = {};
  its.forEach((it) => { if (it.reaction) reacts[it.listing_id] = it.reaction; if (it.comment) cm[it.listing_id] = it.comment; });
  const s: Selection = { id: row.id, slug: row.slug, title: row.title, name: row.client_name ?? "—", note: row.note ?? "", items: its.map((it) => it.listing_id), cm, status: row.status, views: row.views, reacts, createdAt: row.created_at, updatedAt: row.updated_at };
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
    waFound: true, tgFound: true, tgAdded: false, waOn: !!prof?.wa_on, tgOn: !!prof?.tg_on, tgLogin: prof?.tg_login ?? "", vbOn: !!prof?.viber_on, mxOn: !!prof?.max_on, mxId: prof?.max_id ?? "", wcOn: !!prof?.wechat_on, wcId: prof?.wechat_id ?? "", tfaOn: false,
  };
  return { s, listings, owner };
}
