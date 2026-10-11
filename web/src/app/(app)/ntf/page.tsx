import { NtfDemo } from "@/components/ntf/NtfDemo";
import { NtfReal } from "@/components/ntf/NtfReal";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

// Уведомления: с аккаунтом — реальные (таблица notifications), без Supabase — демо прототипа.
export default async function NtfPage() {
  const me = await getCurrentUser();
  return me ? <NtfReal me={me.id} /> : <NtfDemo />;
}
