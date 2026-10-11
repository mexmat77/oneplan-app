"use client";

// Company card (§1.14). The «admin» role always sees their own company (prototype `effCoView = adminCoId`).
import { useParams } from "next/navigation";
import { CompanyCard } from "@/components/dev/users/CompanyCard";
import { useAdminCoId, useRoleFlags, useUsersGuard } from "@/components/dev/users/shared";

export default function Page() {
  const blocked = useUsersGuard();
  const { isAdminView } = useRoleFlags();
  const adminCoId = useAdminCoId();
  const params = useParams<{ id: string }>();
  if (blocked) return null;
  const id = isAdminView ? adminCoId : Number(params.id);
  return <CompanyCard id={id} />;
}
