import "server-only";
import { createClient as createSupabase } from "@supabase/supabase-js";

// Service-role client: bypasses RLS. Server code only — never import from client components.
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set in .env.local");
  return createSupabase(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

export const hasServiceRole = () => Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY);
