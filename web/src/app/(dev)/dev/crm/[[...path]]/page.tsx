"use client";

// CRM застройщика: тот же каркас, рабочее пространство — компания.
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { CrmShell } from "@/components/crm/CrmShell";

export default function DevCrmPage() {
  const { path } = useParams<{ path?: string[] }>();
  return <Suspense><CrmShell base="/dev/crm" path={path ?? []} /></Suspense>;
}
