// Курс для клиентов, которым нужен JSON (совместимость): тот же курс ЦБ Турции, что в `lib/ratesServer.ts`, база €.
import { NextResponse } from "next/server";
import { getRates } from "@/lib/ratesServer";

export async function GET() {
  const r = await getRates();
  return NextResponse.json({ base: "EUR", date: r.date, rates: { EUR: 1, USD: +(r.eur / r.usd).toFixed(4), TRY: r.eur }, live: !!r.date }, { headers: { "Cache-Control": "public, max-age=600" } });
}
