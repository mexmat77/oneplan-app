import { redirect } from "next/navigation";
import { AppChrome } from "@/components/AppChrome";
import { PrefsProvider } from "@/store/prefs";
import { SelBar } from "@/components/sel/SelBar";
import { ProfileInit } from "@/components/ProfileInit";
import { RealtorSync } from "@/components/RealtorSync";
import { Presence } from "@/components/Presence";

import { getCurrentUser } from "@/lib/auth";
import { countPendingRequests } from "@/lib/adminCounts";
import { getSupportId } from "@/lib/chat/server";

// Demo identity for local UI work without Supabase; real sessions come from Supabase Auth + `profiles`.
const DEMO_USER = { name: "Alexander Morozov", isAdmin: true };

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  // Приостановленные и ещё не одобренные пользователи в систему не допускаются (админов не блокируем, чтобы не запереть себя).
  if (me && me.role !== "admin" && me.status !== "active") redirect(`/auth/blocked?s=${me.status}`);
  if (me?.mfaRequired) redirect("/auth/mfa"); // 2FA включена — сначала код из приложения
  const name = me?.name || DEMO_USER.name;
  const isAdmin = me ? me.role === "admin" : DEMO_USER.isAdmin;
  const [adminN, supportId] = await Promise.all([countPendingRequests(!!me && isAdmin), getSupportId()]);
  return (
    <PrefsProvider>
      <RealtorSync meId={me?.id ?? null} />
      <Presence meId={me?.id ?? null} />
      <ProfileInit me={me ? { id: me.id, name: me.name, email: me.email, phone: me.phone, agency: me.agency, avatar: me.avatar } : null}>
        <AppChrome name={name} isAdmin={isAdmin} adminN={adminN} email={me?.email} avatar={me?.avatar ?? null} agency={me?.agency} meId={me?.id ?? null} supportId={supportId} userRole={me?.role ?? (DEMO_USER.isAdmin ? "admin" : "realtor")} />
        <main className="mx-auto w-full max-w-[1220px] px-[clamp(14px,4vw,28px)] pb-[110px] pt-[26px] max-md:px-2 max-md:pt-[76px]">
          {children}
        </main>
        <SelBar />
      </ProfileInit>
    </PrefsProvider>
  );
}
