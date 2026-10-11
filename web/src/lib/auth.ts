import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string; email: string; name: string; phone: string; agency: string;
  role: "realtor" | "admin" | "developer"; status: "pending" | "active" | "paused";
  developerId: string | null; devRole: "admin" | "editor" | "manager" | null;
  avatar: string | null; // user_metadata.avatar_url (Storage `media`, папка dev/avatars/<uid>)
  mfaRequired: boolean; // включена 2FA, а сессия ещё без кода (aal1) → layouts уводят на /auth/mfa
};

// Server-side: the signed-in user and their profile row (null when not signed in or Supabase is not configured).
export async function getCurrentUser(): Promise<CurrentUser | null> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) return null;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  const mfaRequired = !!aal && aal.nextLevel === "aal2" && aal.currentLevel !== "aal2";
  const { data: p } = await supabase.from("profiles").select("name, role, status, phone, agency_text, developer_id, dev_role, agencies(name)").eq("id", user.id).maybeSingle();
  const agencyRow = p?.agencies as { name?: string } | { name?: string }[] | null | undefined;
  const agencyName = Array.isArray(agencyRow) ? agencyRow[0]?.name : agencyRow?.name;
  return {
    id: user.id,
    email: user.email ?? "",
    name: p?.name || user.email?.split("@")[0] || "",
    phone: p?.phone ?? "",
    agency: agencyName || p?.agency_text || "",
    role: p?.role ?? "realtor",
    status: p?.status ?? "pending",
    developerId: p?.developer_id ?? null,
    devRole: p?.dev_role ?? null,
    avatar: (user.user_metadata?.avatar_url as string | undefined) || null,
    mfaRequired,
  };
}
