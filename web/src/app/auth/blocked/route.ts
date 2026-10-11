import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

// Пользователь со статусом «Пауза» / «На модерации» не допускается в систему: layouts шлют сюда, здесь сессия
// завершается и человек попадает на вход с пояснением (`/login?blocked=paused|pending`).
export async function GET(req: NextRequest) {
  const s = req.nextUrl.searchParams.get("s") === "pending" ? "pending" : "paused";
  try { const sb = await createClient(); await sb.auth.signOut(); } catch { /* сессии уже нет */ }
  // За nginx `req.nextUrl` — внутренний адрес (0.0.0.0:3000): берём публичный origin из NEXT_PUBLIC_SITE_URL или заголовков прокси.
  const fwdHost = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const origin = process.env.NEXT_PUBLIC_SITE_URL || (fwdHost ? `${req.headers.get("x-forwarded-proto") ?? "https"}://${fwdHost}` : req.nextUrl.origin);
  return NextResponse.redirect(new URL(`/login?blocked=${s}`, origin));
}
