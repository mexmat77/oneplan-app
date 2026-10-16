import { SITE, listingsFor, ownerByKey, toApi, toXml } from "@/lib/apiListings";

// GET /feed/<key>.xml — XML-фид всех активных объявлений владельца ключа (для сайтов и агрегаторов)
export const dynamic = "force-dynamic";
export async function GET(_req: Request, { params }: { params: Promise<{ key: string }> }) {
  const { key } = await params;
  const owner = await ownerByKey(key.replace(/\.xml$/i, ""));
  if (!owner) return new Response("invalid key", { status: 401 });
  const { rows } = await listingsFor(owner.id, { limit: "500" });
  const site = SITE();
  return new Response(toXml(rows.map((r) => toApi(r, site)), owner, site), { headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=900" } });
}
