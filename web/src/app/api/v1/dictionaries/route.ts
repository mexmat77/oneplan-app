import { NextResponse } from "next/server";
import { CORS, dictionaries, keyFrom, scopeByKey } from "@/lib/apiListings";

// GET /api/v1/dictionaries?key=… — подписи значений (RU/EN/TR) и география для вывода объявлений на сайте
export const dynamic = "force-dynamic";
export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }
export async function GET(req: Request) {
  const scope = await scopeByKey(keyFrom(req));
  if (!scope) return NextResponse.json({ error: "invalid_key" }, { status: 401, headers: CORS });
  return NextResponse.json(dictionaries(), { headers: { ...CORS, "Cache-Control": "public, max-age=86400" } });
}
