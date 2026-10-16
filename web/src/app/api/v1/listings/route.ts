import { NextResponse } from "next/server";
import { SITE, keyFrom, listingsFor, ownerByKey, toApi, type ApiFilters } from "@/lib/apiListings";

// GET /api/v1/listings?key=…[&deal=sale&type=flat&il=antalya&ilce=…&rooms=2+1,3+1&price_min=&price_max=&limit=100&offset=0]
export const dynamic = "force-dynamic";
export async function GET(req: Request) {
  const owner = await ownerByKey(keyFrom(req));
  if (!owner) return NextResponse.json({ error: "invalid_key", message: "Передайте действующий API-ключ: ?key=… или Authorization: Bearer …" }, { status: 401, headers: { "Access-Control-Allow-Origin": "*" } });
  const sp = new URL(req.url).searchParams;
  const f: ApiFilters = Object.fromEntries(["deal", "type", "il", "ilce", "rooms", "price_min", "price_max", "limit", "offset"].map((k) => [k, sp.get(k)]));
  const { rows, total } = await listingsFor(owner.id, f);
  const site = SITE();
  return NextResponse.json({ total, count: rows.length, realtor: owner.name, agency: owner.agency, items: rows.map((r) => toApi(r, site)) }, { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } });
}
