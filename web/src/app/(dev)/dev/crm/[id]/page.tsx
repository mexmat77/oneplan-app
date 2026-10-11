"use client";

import { useParams } from "next/navigation";
import { ClientPage } from "@/components/crm/ClientPage";

export default function DevCrmClient() {
  const { id } = useParams<{ id: string }>();
  return <ClientPage base="/dev/crm" id={id} />;
}
