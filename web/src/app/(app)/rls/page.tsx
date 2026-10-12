import { redirect } from "next/navigation";
import { RlsScreen } from "@/components/rls/RlsScreen";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Экран прототипа «Риэлторы» (12.10.2026): с аккаунтом ведёт в единое «Управление → Пользователи» (модель «Организации и
// участники», миграция 0022); без ключей Supabase / без входа — демо-стор прототипа (`remote = null`) для UI-режима.
export default async function RlsPage() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return <RlsScreen remote={null} />;
  const sb = await createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) return <RlsScreen remote={null} />;
  redirect("/admin/users");
}
