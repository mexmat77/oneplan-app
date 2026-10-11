"use client";

// CRM риэлтора: /crm (обзор), /crm/clients, /crm/deals, /crm/tasks, /crm/settings/[раздел], /crm/c/[id].
// Каркас `CrmShell` живёт в layout — Next пересоздаёт page при смене сегмента `[[...path]]`, а layout сохраняется,
// поэтому меню, вкладки и bootstrap не перезагружаются при каждом переходе (замечание пользователя 11.10.2026).
import { Suspense } from "react";
import { CrmShell } from "@/components/crm/CrmShell";

export default function CrmLayout() {
  return <Suspense><CrmShell base="/crm" /></Suspense>;
}
