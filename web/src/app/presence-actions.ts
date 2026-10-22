"use server";

import { createClient } from "@/lib/supabase/server";

// Пульс присутствия (22.10.2026, «видеть, кто когда заходил, как в мире»): клиент `components/Presence.tsx` раз в минуту
// в открытой вкладке зовёт этот экшен, он ставит `profiles.last_seen = now()` своему профилю (RLS «profiles self»).
// Раньше колонка существовала с 0001, но её никто не писал — «был(а) недавно» в чате и активность в админке были пустыми.
export async function touchSeen(): Promise<void> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  await supabase.from("profiles").update({ last_seen: new Date().toISOString() }).eq("id", user.id);
}
