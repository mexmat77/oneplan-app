import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Пользователь со статусом «Пауза» / «На модерации» не допускается в систему: layouts шлют сюда, здесь сессия
// завершается и человек попадает на вход с пояснением (`/login?blocked=paused|pending`).
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get("s") === "pending" ? "pending" : "paused";
  try { const sb = await createClient(); await sb.auth.signOut(); } catch { /* сессии уже нет */ }
  // За nginx `req.nextUrl` — внутренний адрес (0.0.0.0:3000): берём публичный origin из NEXT_PUBLIC_SITE_URL или заголовков прокси.
  // origin только из NEXT_PUBLIC_SITE_URL — заголовок Host управляется клиентом (аудит 23.10.2026: open redirect через Host).
  const origin = process.env.NEXT_PUBLIC_SITE_URL || req.nextUrl.origin;
  return NextResponse.redirect(new URL(`/login?blocked=${s}`, origin));
}
