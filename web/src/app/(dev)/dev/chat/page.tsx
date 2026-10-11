import { ChatScreen } from "@/components/dev/chat/ChatScreen";
import { DevChatReal } from "@/components/dev/chat/DevChatReal";
import { getCurrentUser } from "@/lib/auth";
import { getSupportId } from "@/lib/chat/server";
import { PROFILE_SEL, toPeer, type ChatPeer } from "@/lib/chat/shared";
import { createClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// Чат кабинета застройщика: с Supabase — реальные диалоги с коллегами по компании и поддержкой; без ключей — демо прототипа.
export default async function Page() {
  const [me, supportId] = await Promise.all([getCurrentUser(), getSupportId()]);
  if (!me || !supportId) return <ChatScreen />;
  const sb = await createClient();
  let colleagues: ChatPeer[] = [];
  if (me.role === "admin") {
    const { data } = await sb.from("profiles").select(PROFILE_SEL).eq("role", "developer").eq("status", "active").order("name");
    colleagues = (data ?? []).map((p) => toPeer(p as unknown as Parameters<typeof toPeer>[0], supportId));
  } else {
    const { data: mem } = await sb.from("developer_members").select("developer_id").eq("profile_id", me.id);
    const cos = new Set<string>((mem ?? []).map((m) => m.developer_id as string)); if (me.developerId) cos.add(me.developerId);
    if (cos.size) {
      const ids = Array.from(cos);
      const [{ data: p1 }, { data: m2 }] = await Promise.all([
        sb.from("profiles").select(`${PROFILE_SEL}, developer_id`).in("developer_id", ids).eq("status", "active"),
        sb.from("developer_members").select("profile_id").in("developer_id", ids),
      ]);
      const extra = (m2 ?? []).map((m) => m.profile_id as string).filter((id) => id !== me.id && !(p1 ?? []).some((p) => p.id === id));
      const { data: p2 } = extra.length ? await sb.from("profiles").select(PROFILE_SEL).in("id", extra).eq("status", "active") : { data: [] };
      colleagues = [...(p1 ?? []), ...(p2 ?? [])].filter((p) => p.id !== me.id && !p.platform_staff).map((p) => toPeer(p as unknown as Parameters<typeof toPeer>[0], supportId));
    }
  }
  return <DevChatReal me={{ id: me.id, name: me.name, isAdmin: me.role === "admin" }} supportId={supportId} colleagues={colleagues.filter((c) => c.id !== me.id)} />;
}
