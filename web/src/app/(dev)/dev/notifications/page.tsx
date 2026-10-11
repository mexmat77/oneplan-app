// Все уведомления — docs/prototype-developer-spec.md §1.17 / §5.3. С аккаунтом — реальные (таблица notifications).
import { NotifsScreen } from "@/components/dev/notifs/NotifsScreen";
import { getCurrentUser } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function Page() {
  const me = await getCurrentUser();
  return <NotifsScreen meId={me?.id ?? null} />;
}
