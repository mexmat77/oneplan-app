import { NextResponse } from "next/server";
import { CORS, SITE, keyFrom, listingsFor, scopeByKey, toApi, type ApiFilters } from "@/lib/apiListings";

// GET /api/v1/listings?key=…  (см. /api/docs)
export const dynamic = "force-dynamic";
export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }
export async function GET(req: Request) {
  const scope = await scopeByKey(keyFrom(req));
  if (!scope) return NextResponse.json({ error: "invalid_key", message: "Передайте действующий API-ключ: ?key=… или заголовок Authorization: Bearer …" }, { status: 401, headers: CORS });
  const sp = new URL(req.url).searchParams;
  const f = Object.fromEntries(["deal", "type", "il", "ilce", "rooms", "price_min", "price_max", "status", "updated_since", "realtor", "limit", "offset"].map((k) => [k, sp.get(k)])) as ApiFilters;
  const { rows, total } = await listingsFor(scope, f);
  const site = SITE();
  const limit = Math.min(Math.max(+(f.limit ?? 100) || 100, 1), 500), offset = Math.max(+(f.offset ?? 0) || 0, 0);
  return NextResponse.json({ total, count: rows.length, limit, offset, scope: scope.kind, name: scope.name, agency: scope.agency, generated_at: new Date().toISOString(), items: rows.map((r) => toApi(r, site, scope)) }, { headers: { ...CORS, "Cache-Control": "public, max-age=300" } });
}
