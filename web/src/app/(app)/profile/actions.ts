"use server";

import { createClient } from "@/lib/supabase/server";

// Persist the signed-in user's own identity fields to `profiles` (RLS policy «profiles self»).
// Channels/areas stay in the local store until they get columns of their own.
type Patch = { name?: string; phone?: string; avatar_url?: string; wa_on?: boolean; tg_on?: boolean; tg_login?: string; viber_on?: boolean; max_on?: boolean; max_id?: string; wechat_on?: boolean; wechat_id?: string };
const CHANNELS = ["wa_on", "tg_on", "tg_login", "viber_on", "max_on", "max_id", "wechat_on", "wechat_id"] as const;
export async function updateMyProfile(patch: Patch) {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return { ok: false as const, reason: "no-supabase" };
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false as const, reason: "no-session" };
  const row: Record<string, string | boolean> = {};
  if (patch.name !== undefined) row.name = patch.name.trim();
  if (patch.phone !== undefined) row.phone = patch.phone.trim();
  for (const k of CHANNELS) if (patch[k] !== undefined) row[k] = typeof patch[k] === "string" ? String(patch[k]).trim() : !!patch[k];
  if (patch.avatar_url !== undefined) {
    // Аватар живёт в user_metadata (без отдельной колонки); пустая строка — убрать фото.
    const { error: e } = await supabase.auth.updateUser({ data: { avatar_url: patch.avatar_url || null } });
    if (e) throw new Error(e.message);
  }
  if (!Object.keys(row).length) return { ok: true as const };
  const { error } = await supabase.from("profiles").update(row).eq("id", user.id);
  if (error) throw new Error(error.message);
  return { ok: true as const };
}
