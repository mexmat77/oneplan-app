import "server-only";
import { headers } from "next/headers";

// Простой лимит частоты для анонимных форм (23.10.2026, аудит: заявки и приглашения без ограничений — спам писем с
// noreply@one-plan.pro и массовое создание аккаунтов). Счётчики в памяти процесса (один инстанс pm2) — этого достаточно,
// чтобы скрипт не мог слать тысячи запросов; при перезапуске сбрасывается.
const buckets = new Map<string, number[]>();

export async function clientIp(): Promise<string> {
  const h = await headers();
  return (h.get("x-forwarded-for") ?? "").split(",")[0].trim() || h.get("x-real-ip") || "unknown";
}

/** true — можно; false — лимит исчерпан (max событий за окно windowMs по ключу). */
export function allow(key: string, max: number, windowMs: number): boolean {
  const now = Date.now();
  const arr = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (arr.length >= max) { buckets.set(key, arr); return false; }
  arr.push(now); buckets.set(key, arr);
  if (buckets.size > 10_000) for (const [k, v] of buckets) if (!v.some((t) => now - t < windowMs)) buckets.delete(k);
  return true;
}
