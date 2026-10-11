import { Suspense } from "react";
import { ChatDemo } from "@/components/chat/ChatDemo";
import { RealtorChat } from "@/components/chat/RealtorChat";
import { getCurrentUser } from "@/lib/auth";
import { getSupportId } from "@/lib/chat/server";

export const dynamic = "force-dynamic";

// Чат: с Supabase — реальные диалоги и поддержка (`RealtorChat`); без ключей — демо прототипа (`ChatDemo`).
export default async function ChatPage() {
  const [me, supportId] = await Promise.all([getCurrentUser(), getSupportId()]);
  if (!me || !supportId) return <ChatDemo />;
  return <Suspense><RealtorChat me={{ id: me.id, name: me.name, isAdmin: me.role === "admin" }} supportId={supportId} /></Suspense>;
}
