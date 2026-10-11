"use client";

// Запускает синхронизацию кабинета риэлтора с Supabase для вошедшего пользователя (см. `store/realtorRemote.ts`).
import { useEffect } from "react";
import { startRealtorSync } from "@/store/realtorRemote";

export function RealtorSync({ meId }: { meId: string | null }) {
  useEffect(() => { if (meId) startRealtorSync(meId); }, [meId]);
  return null;
}
