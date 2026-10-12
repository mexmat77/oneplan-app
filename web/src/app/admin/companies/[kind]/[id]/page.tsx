import { notFound } from "next/navigation";
import { OrgCard } from "@/components/admin/OrgCard";
import { getOrg } from "@/app/org/actions";
import type { OrgKind } from "@/lib/org";

export const dynamic = "force-dynamic";

// Карточка организации в «Управлении» (12.10.2026): реквизиты, участники с ролями, приглашения.
export default async function AdminOrgPage({ params }: { params: Promise<{ kind: string; id: string }> }) {
  const { kind, id } = await params;
  if (kind !== "agency" && kind !== "developer") notFound();
  let view;
  try { view = await getOrg(kind as OrgKind, id); } catch { notFound(); }
  return <OrgCard initial={view} />;
}
