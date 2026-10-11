"use client";

// Риэлторы для подписей объявлений и запросов: демо-справочник прототипа `REALTORS` + профили из Supabase (`profiles`,
// грузит `store/realtorRemote.ts`). Один вид `Realtor` для обоих, ключ — id (демо "r1"… или uuid профиля).
import { useSyncExternalStore } from "react";
import { REALTORS } from "@/lib/seed";
import type { Realtor } from "@/lib/types";

let extra: Record<string, Realtor> = {};
const subs = new Set<() => void>();
export function setRealtors(list: Realtor[]) { extra = Object.fromEntries(list.map((r) => [r.id, r])); subs.forEach((l) => l()); }
export const realtorOf = (id: string): Realtor | undefined => REALTORS[id] ?? extra[id];
const snap = () => extra;
/** Подписка на профили из базы: компонент перерисуется, когда они загрузятся. Возвращает функцию поиска. */
export function useRealtor(): (id: string) => Realtor | undefined {
  useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, snap, snap);
  return realtorOf;
}
