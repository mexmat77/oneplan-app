"use client";

// Translation cache for the chat (prototype `trCache` / `_trPend`, `ensureTr` lines 2694–2717).
// External store so the thread can request translations from an effect without setState-in-effect.
import { useSyncExternalStore } from "react";
import { translate } from "@/app/(dev)/dev/chat/actions";
import type { DevLang } from "@/lib/dev/types";

export type TrEntry = { text: string; fallback: boolean };
type Cache = Record<string, TrEntry>;

let cache: Cache = {};
const pending = new Set<string>();
const listeners = new Set<() => void>();
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const emit = () => listeners.forEach((l) => l());

export const trKey = (lang: DevLang, text: string) => `${lang}${text}`;

export function useTrCache(): Cache { return useSyncExternalStore(subscribe, () => cache, () => cache); }

/** Request a translation once per (lang, text); results land in the cache. */
export function ensureTr(text: string, lang: DevLang) {
  if (!text || !text.trim()) return;
  const key = trKey(lang, text);
  if (cache[key] !== undefined || pending.has(key)) return;
  pending.add(key);
  translate(text, lang)
    .then((r) => { cache = { ...cache, [key]: { text: r.text || text, fallback: r.fallback } }; })
    .catch(() => { cache = { ...cache, [key]: { text, fallback: true } }; })
    .finally(() => { pending.delete(key); emit(); });
}
