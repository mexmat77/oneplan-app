"use client";

// Dialogs: demo seed from the prototype + messages sent in this browser (localStorage) until Supabase realtime is wired.
import { useSyncExternalStore } from "react";
import dlgJson from "@/mock/dlg.json";
import type { Lang } from "@/i18n";
import type { L10n } from "@/lib/types";

export type Msg = { me: boolean; by?: string; lang: Lang; tx: L10n; time: string; ts?: number; objId?: string };
export type Dialog = { id: string; who: string; msgs: Msg[] };

const SEED = dlgJson as Dialog[];
const KEY = "oneplan-chat";
type Extra = { msgs: Record<string, Msg[]>; read: string[]; tr: boolean };
const EMPTY: Extra = { msgs: {}, read: [], tr: true };

let snapshot: Extra | null = null;
const listeners = new Set<() => void>();
function read(): Extra {
  if (snapshot) return snapshot;
  let next = EMPTY;
  try { const raw = localStorage.getItem(KEY); if (raw) next = { ...EMPTY, ...JSON.parse(raw) }; } catch {}
  snapshot = next;
  return next;
}
function write(next: Extra) {
  snapshot = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function useChat() {
  const extra = useSyncExternalStore(subscribe, read, () => EMPTY);
  const ids = new Set([...SEED.map((d) => d.id), ...Object.keys(extra.msgs)]);
  const dialogs: Dialog[] = Array.from(ids).map((id) => {
    const seed = SEED.find((d) => d.id === id);
    return { id, who: seed?.who ?? id.replace(/^d_/, ""), msgs: [...(seed?.msgs ?? []), ...(extra.msgs[id] ?? [])] };
  });
  return { dialogs, read: extra.read, tr: extra.tr };
}

export const dialogIdFor = (who: string) => SEED.find((d) => d.who === who)?.id ?? `d_${who}`;

export function sendMessage(dialogId: string, text: string, lang: Lang, objId?: string) {
  const cur = read();
  const now = new Date();
  const msg: Msg = { me: true, lang, tx: { RU: text, EN: text, TR: text }, time: now.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" }), ts: now.getTime(), objId };
  write({ ...cur, msgs: { ...cur.msgs, [dialogId]: [...(cur.msgs[dialogId] ?? []), msg] } });
}
export function markRead(dialogId: string) {
  const cur = read();
  if (cur.read.includes(dialogId)) return;
  write({ ...cur, read: [...cur.read, dialogId] });
}
export function setTranslate(on: boolean) {
  write({ ...read(), tr: on });
}
// Demo: only dialog d3 starts unread (as in the prototype).
export const UNREAD_SEED: Record<string, number> = { d3: 1 };
