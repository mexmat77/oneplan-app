"use client";

import { useParams } from "next/navigation";
import { ClientPage } from "@/components/crm/ClientPage";

export default function CrmClient() {
  const { id } = useParams<{ id: string }>();
  return <ClientPage base="/crm" id={id} />;
}
