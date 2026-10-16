import { NextResponse } from "next/server";
import { SITE, keyFrom, listingsFor, ownerByKey, toApi } from "@/lib/apiListings";

// GET /api/v1/listings/<uuid>?key=… — одна карточка владельца ключа
export const dynamic = "force-dynamic";
export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const owner = await ownerByKey(keyFrom(req));
  if (!owner) return NextResponse.json({ error: "invalid_key" }, { status: 401, headers: { "Access-Control-Allow-Origin": "*" } });
  const { id } = await params;
  const { rows } = await listingsFor(owner.id, {}, id.replace(/^OP-/i, ""));
  if (!rows.length) return NextResponse.json({ error: "not_found" }, { status: 404, headers: { "Access-Control-Allow-Origin": "*" } });
  return NextResponse.json(toApi(rows[0], SITE()), { headers: { "Access-Control-Allow-Origin": "*", "Cache-Control": "public, max-age=300" } });
}
