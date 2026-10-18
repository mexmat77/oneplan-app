import { redirect } from "next/navigation";
import { AppChrome } from "@/components/AppChrome";
import { AdminTabs } from "@/components/admin/AdminTabs";
import { getCurrentUser } from "@/lib/auth";
import { countAdminPending } from "@/lib/adminCounts";
import { getSupportId } from "@/lib/chat/server";
import { PrefsProvider } from "@/store/prefs";
import { ProfileInit } from "@/components/ProfileInit";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const me = await getCurrentUser();
  // Приостановленные и ещё не одобренные пользователи в систему не допускаются (админов не блокируем, чтобы не запереть себя).
  if (me && me.role !== "admin" && me.status !== "active") redirect(`/auth/blocked?s=${me.status}`);
  if (me?.mfaRequired) redirect("/auth/mfa"); // 2FA включена — сначала код из приложения
  if (me && me.role !== "admin") redirect("/catalog");
  const [pend, supportId] = await Promise.all([countAdminPending(!!me), getSupportId()]);
  const adminN = pend.requests + pend.reports;
  return (
    <PrefsProvider>
      {/* ProfileInit — как в (app)/layout: без него TopBar/UserMenu берут демо-профиль прототипа («Alexander Morozov / AM Estate»)
          из store/profile (замечание пользователя 13.10.2026: у Константина в «Управлении» вылезали тестовые данные). */}
      <ProfileInit me={me ? { id: me.id, name: me.name, email: me.email, phone: me.phone, agency: me.agency } : null}>
      <AppChrome name={me?.name || "Admin"} isAdmin workspace="admin" adminN={adminN} adminReqN={pend.requests} adminRepN={pend.reports} email={me?.email} avatar={me?.avatar ?? null} agency={me?.agency} meId={me?.id ?? null} supportId={supportId} />
      <main className="mx-auto w-full max-w-[1220px] px-[clamp(14px,4vw,28px)] pb-[110px] pt-[26px] max-md:px-2 max-md:pt-[76px]">
        <AdminTabs reqsN={pend.requests} reportsN={pend.reports} />
        {children}
      </main>
      </ProfileInit>
    </PrefsProvider>
  );
}
