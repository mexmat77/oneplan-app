import { NextResponse } from "next/server";
import { CORS, SITE, keyFrom, listingsFor, scopeByKey, toApi } from "@/lib/apiListings";

// GET /api/v1/listings/<uuid|OP-номер>?key=… — одна карточка (любой статус)
export const dynamic = "force-dynamic";
export async function OPTIONS() { return new Response(null, { status: 204, headers: CORS }); }
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const scope = await scopeByKey(keyFrom(req));
  if (!scope) return NextResponse.json({ error: "invalid_key" }, { status: 401, headers: CORS });
  const { id } = await params;
  const { rows } = await listingsFor(scope, { status: "all" }, id.replace(/^OP-?/i, "")); // uuid или номер OP-100001 / 100001
  if (!rows.length) return NextResponse.json({ error: "not_found" }, { status: 404, headers: CORS });
  return NextResponse.json(toApi(rows[0], SITE(), scope), { headers: { ...CORS, "Cache-Control": "private, max-age=300" } });
}
