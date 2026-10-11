"use client";

// Notifications: demo seed + read-state in localStorage until Supabase is wired.
import { useSyncExternalStore } from "react";
import ntfJson from "@/mock/ntfdata.json";
import type { Lang } from "@/i18n";

export type Ntf = { id: string; icon: string; tone: string; bg: string; day: "today" | "yest"; time: string; unread: boolean; tx: Record<Lang, [string, string]> };
export const NTF_SEED = ntfJson as Ntf[];

const KEY = "oneplan-ntf-read";
let snapshot: string[] | null = null;
const EMPTY: string[] = [];
const listeners = new Set<() => void>();
function read(): string[] {
  if (snapshot) return snapshot;
  let next = EMPTY;
  try { const raw = localStorage.getItem(KEY); if (raw) next = JSON.parse(raw); } catch {}
  snapshot = next;
  return next;
}
function write(next: string[]) {
  snapshot = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useNotifications() {
  const readIds = useSyncExternalStore(subscribe, read, () => EMPTY);
  const items = NTF_SEED.map((n) => ({ ...n, unread: n.unread && !readIds.includes(n.id) }));
  return { items, unreadN: items.filter((n) => n.unread).length };
}
export function markAllRead() {
  write(NTF_SEED.map((n) => n.id));
}
