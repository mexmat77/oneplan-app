"use client";

// CRM застройщика (/dev/crm): тот же экран, что у риэлтора, рабочее пространство — компания.
import { Suspense } from "react";
import { CrmApp } from "@/components/crm/CrmApp";

export default function DevCrmPage() {
  return <Suspense><CrmApp base="/dev/crm" /></Suspense>;
}
