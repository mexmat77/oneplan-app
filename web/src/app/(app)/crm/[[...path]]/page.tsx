"use client";

// CRM риэлтора: /crm (обзор), /crm/clients, /crm/deals, /crm/tasks, /crm/settings/[раздел], /crm/c/[id]. Один каркас `CrmShell`.
import { Suspense } from "react";
import { useParams } from "next/navigation";
import { CrmShell } from "@/components/crm/CrmShell";

export default function CrmPage() {
  const { path } = useParams<{ path?: string[] }>();
  return <Suspense><CrmShell base="/crm" path={path ?? []} /></Suspense>;
}
