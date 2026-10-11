"use client";

// «Пользователи» → tab «Пользователи» / all people (§1.13) — superadmin only; «admin» is sent back to their company card.
import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { PeopleScreen } from "@/components/dev/users/PeopleScreen";
import { useRoleFlags, useUsersGuard } from "@/components/dev/users/shared";

export default function Page() {
  const blocked = useUsersGuard();
  const { isAdminView } = useRoleFlags();
  const router = useRouter();
  useEffect(() => { if (isAdminView) router.replace("/dev/users"); }, [isAdminView, router]);
  if (blocked || isAdminView) return null;
  return <PeopleScreen />;
}
