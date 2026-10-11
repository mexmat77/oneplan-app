// «Профайл» (§1.15). Name / e-mail come from the signed-in account; the prototype's demo values are the fallback (lines 1113–1114).
import { ProfileScreen } from "@/components/dev/profile/ProfileScreen";
import { getCurrentUser } from "@/lib/auth";

export default async function Page() {
  const me = await getCurrentUser();
  return <ProfileScreen me={{ id: me?.id ?? "", name: me?.name || "Иван Админов", email: me?.email || "admin@oneplan.pro", phone: me?.phone ?? "", avatar: me?.avatar ?? null, company: me?.agency ?? "" }} />;
}
