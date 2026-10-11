// Проверка живости для мониторинга: приложение отвечает, база Supabase доступна (лёгкий запрос к geo_il).
// Сторож на сервере (`scripts/watchdog.sh`, cron) дёргает этот адрес и шлёт письмо через Resend при двух подряд сбоях.
import { NextResponse } from "next/server";
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export async function GET() {
  const out: { ok: boolean; app: "ok"; db: "ok" | "skip" | "fail"; stage: string; at: string } = { ok: true, app: "ok", db: "skip", stage: process.env.NEXT_PUBLIC_STAGE || "prod", at: new Date().toISOString() };
  if (hasServiceRole()) {
    try { const { error } = await createAdminClient().from("geo_il").select("k").limit(1); out.db = error ? "fail" : "ok"; } catch { out.db = "fail"; }
    if (out.db === "fail") out.ok = false;
  }
  return NextResponse.json(out, { status: out.ok ? 200 : 503, headers: { "Cache-Control": "no-store" } });
}
