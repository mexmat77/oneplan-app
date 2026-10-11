"use client";

// Current UI role (prototype `role` + demo toggle `[data-demo]`, lines 1885–1893 / 3708–3709).
// The real role comes from Supabase `profiles.role`; an admin may preview the app as a plain realtor.
import { useSyncExternalStore } from "react";

export type Role = "admin" | "realtor";
type State = { role: Role; realAdmin: boolean };

let state: State = { role: "realtor", realAdmin: false };
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

/** Called once by AppChrome with the server-side role. */
export function initRole(isAdmin: boolean) {
  if (state.realAdmin === isAdmin && (isAdmin || state.role === "realtor")) return;
  state = { role: isAdmin ? "admin" : "realtor", realAdmin: isAdmin };
  emit();
}

export function setRole(role: Role) {
  if (!state.realAdmin && role === "admin") return;
  state = { ...state, role };
  emit();
}

const SERVER: State = { role: "realtor", realAdmin: false };
export function useRole(): State & { isAdmin: boolean; setRole: (r: Role) => void } {
  const s = useSyncExternalStore(subscribe, () => state, () => SERVER);
  return { ...s, isAdmin: s.role === "admin", setRole };
}
