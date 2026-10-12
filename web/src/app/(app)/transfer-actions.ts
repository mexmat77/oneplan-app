"use server";

// Передача объекта другому риэлтору (12.10.2026): список получателей и вызов функции базы transfer_listing
// (проверяет права: владелец, владелец/руководитель CRM агентства, админ платформы). Новому владельцу — уведомление.
import { getCurrentUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { createClient } from "@/lib/supabase/server";

export type TransferTarget = { id: string; name: string; agency: string; email: string };

/** Активные риэлторы базы (кроме себя) — получатели объекта/клиента. */
export async function listTransferTargets(): Promise<TransferTarget[]> {
  const me = await getCurrentUser(); if (!me) throw new Error("no-session");
  const sb = await createClient();
  // служебные аккаунты платформы (поддержка, platform_staff) получателями быть не могут
  const { data } = await sb.from("profiles").select("id, name, email, agency_text, platform_staff, agencies(name)").eq("status", "active").in("role", ["realtor", "admin"]).neq("id", me.id).or("platform_staff.is.null,platform_staff.eq.false").order("name").limit(2000);
  return (data ?? []).map((p) => { const ag = (Array.isArray(p.agencies) ? p.agencies[0] : p.agencies) as { name?: string } | null; return { id: p.id as string, name: (p.name as string) || (p.email as string) || "—", agency: ag?.name || (p.agency_text as string) || "", email: (p.email as string) ?? "" }; });
}

export async function transferListing(id: string, toId: string): Promise<void> {
  const me = await getCurrentUser(); if (!me) throw new Error("no-session");
  const sb = await createClient();
  const { data: l } = await sb.from("listings").select("id, title").eq("id", id).maybeSingle();
  const { error } = await sb.rpc("transfer_listing", { lid: id, to_profile: toId });
  if (error) throw new Error(error.message);
  const t = (l?.title as Record<string, string> | null) ?? {};
  await notify([toId], "listing_transfer", { id, title: t.RU || t.EN || t.TR || "", from: me.name });
}
