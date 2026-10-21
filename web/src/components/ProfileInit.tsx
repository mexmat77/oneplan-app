"use client";

// Seeds the client profile store with the signed-in user's Supabase profile and persists identity edits back.
import { ProfileCtx, initProfile, setProfilePersist } from "@/store/profile";
import { updateMyProfile } from "@/app/(app)/profile/actions";

export type ServerProfile = { id: string; name: string; email: string; phone: string; agency: string; avatar?: string | null };

/** Оборачивает дерево кабинета: профиль с сервера идёт в контекст (одинаковый снимок для SSR и гидрации) и в стор. */
export function ProfileInit({ me, children }: { me: ServerProfile | null; children: React.ReactNode }) {
  // Synchronous so pages rendered in the same pass already see the real name/phone.
  if (typeof window !== "undefined") {
    initProfile(me);
    setProfilePersist(me ? (patch) => updateMyProfile(patch).catch(() => {}) : null);
  }
  return <ProfileCtx.Provider value={me}>{children}</ProfileCtx.Provider>;
}
