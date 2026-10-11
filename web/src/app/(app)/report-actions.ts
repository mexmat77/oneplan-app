"use server";

// Жалоба на объявление (форма «Пожаловаться» на /obj/[id]) → таблица reports (снимок карточки) + уведомление админам.
import { createClient } from "@/lib/supabase/server";
import { notifyAdmins } from "@/lib/notify";

export type ReportInput = { reason: string; text: string; listing_ref: string; listing_title: string; listing_price: number | null; listing_cur: string; listing_photo: string | null; listing_owner: string | null };
export async function submitReport(input: ReportInput): Promise<{ ok: boolean; error?: string }> {
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return { ok: false, error: "no-session" };
  const { data: me } = await sb.from("profiles").select("name").eq("id", user.id).maybeSingle();
  const { error } = await sb.from("reports").insert({ from_id: user.id, from_name: (me?.name as string) || user.email || "", reason: input.reason, text: input.text.trim() || null, listing_ref: input.listing_ref, listing_title: input.listing_title, listing_price: input.listing_price, listing_cur: input.listing_cur, listing_photo: input.listing_photo, listing_owner: input.listing_owner });
  if (error) return { ok: false, error: error.message };
  void notifyAdmins("report_new", { title: input.listing_title, reason: input.reason, from: (me?.name as string) || user.email || "" });
  return { ok: true };
}
