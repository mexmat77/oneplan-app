"use client";

// «Пользователи» → tab «Компании» (§1.12). For the «admin» role the screen is the card of their own company (§2.1).
import { CompaniesScreen } from "@/components/dev/users/CompaniesScreen";
import { CompanyCard } from "@/components/dev/users/CompanyCard";
import { useAdminCoId, useRoleFlags, useUsersGuard } from "@/components/dev/users/shared";

export function DevUsersClient() {
  const blocked = useUsersGuard();
  const { isAdminView } = useRoleFlags();
  const adminCoId = useAdminCoId();
  if (blocked) return null;
  return isAdminView ? <CompanyCard id={adminCoId} /> : <CompaniesScreen />;
}
