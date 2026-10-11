"use client";

// CRM риэлтора (/crm): общий экран `components/crm/CrmApp` с базовым путём кабинета.
import { Suspense } from "react";
import { CrmApp } from "@/components/crm/CrmApp";

export default function CrmPage() {
  return <Suspense><CrmApp base="/crm" /></Suspense>;
}
