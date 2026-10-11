"use server";

// Действия клиента на публичной странице подборки (без входа): реакция на объект и счётчик просмотров — через сервисный ключ.
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

const REACTS = new Set(["like", "maybe", "no"]);
async function selId(slug: string): Promise<string | null> {
  if (!hasServiceRole() || !/^[A-Za-z0-9-]{1,40}$/.test(slug)) return null;
  const { data } = await createAdminClient().from("selections").select("id").eq("slug", slug.toUpperCase()).maybeSingle();
  return data?.id ?? null;
}
export async function reactPublic(slug: string, listingId: string, reaction: "like" | "maybe" | "no" | null) {
  const id = await selId(slug); if (!id || (reaction && !REACTS.has(reaction)) || !/^[\w-]{1,64}$/.test(listingId)) return;
  const admin = createAdminClient();
  await admin.from("selection_items").update({ reaction }).eq("selection_id", id).eq("listing_id", listingId);
  await admin.from("selections").update({ status: "viewed", updated_at: new Date().toISOString() }).eq("id", id);
}
export async function viewPublic(slug: string) {
  const id = await selId(slug); if (!id) return;
  const admin = createAdminClient();
  const { data } = await admin.from("selections").select("views").eq("id", id).maybeSingle();
  await admin.from("selections").update({ views: (data?.views ?? 0) + 1, status: "viewed" }).eq("id", id);
}
