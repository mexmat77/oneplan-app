"use client";

// Личные заметки риэлтора к объектам (13.10.2026, идея пользователя): «что меня тут заинтересовало». Видны только автору.
// Стор как у избранного: useSyncExternalStore, запись в базу через hook из realtorRemote (таблица listing_notes, 0029).
import { useSyncExternalStore } from "react";

type Notes = Record<string, string>;
let notes: Notes = {};
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
const EMPTY: Notes = {};
let hook: ((id: string, text: string) => void) | null = null;

export function setNoteHook(fn: typeof hook) { hook = fn; }
export function seedNotes(map: Notes) { notes = { ...map }; emit(); }
export function setNote(id: string, text: string) {
  const v = text.trim();
  if ((notes[id] ?? "") === v) return;
  notes = { ...notes }; if (v) notes[id] = v; else delete notes[id]; emit();
  hook?.(id, v);
}
export function useNotes(): Notes { return useSyncExternalStore(subscribe, () => notes, () => EMPTY); }
export function useNote(id: string): string { return useNotes()[id] ?? ""; }
