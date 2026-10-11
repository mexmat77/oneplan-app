"use client";

// CRM застройщика: тот же каркас, рабочее пространство — компания. Каркас в layout (см. (app)/crm/layout.tsx).
import { Suspense } from "react";
import { CrmShell } from "@/components/crm/CrmShell";

export default function DevCrmLayout() {
  return <Suspense><CrmShell base="/dev/crm" /></Suspense>;
}
