import { SITE, listingsFor, scopeByKey, toApi, toXml } from "@/lib/apiListings";

// GET /feed/<key>.xml — XML-фид активных объявлений риэлтора или агентства (см. /api/docs)
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const scope = await scopeByKey(key.replace(/\.xml$/i, ""));
  if (!scope) return new Response("invalid key", { status: 401 });
  const { rows } = await listingsFor(scope, { limit: "500" });
  const site = SITE();
  return new Response(toXml(rows.map((r) => toApi(r, site, scope)), scope, site), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "private, max-age=900", "Access-Control-Allow-Origin": "*" } });
}
