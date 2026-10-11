import "server-only";
import { createClient } from "@/lib/supabase/server";
import { SUPPORT_EMAIL } from "@/lib/chat/shared";

/** id сервисного профиля поддержки (support@one-plan.pro) — null без Supabase или если профиль не виден текущему пользователю. */
export async function getSupportId(): Promise<string | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  try {
    const sb = await createClient();
    const { data } = await sb.from("profiles").select("id").eq("email", SUPPORT_EMAIL).maybeSingle();
    return (data?.id as string | undefined) ?? null;
  } catch { return null; }
}
