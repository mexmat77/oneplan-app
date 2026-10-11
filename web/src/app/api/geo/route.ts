// Полигоны географии из Supabase (таблицы geo_il / geo_ilce / geo_mahalle, миграция 0011, анонимное чтение).
//   /api/geo?level=il                 — все il (геометрия упрощена)
//   /api/geo?level=ilce&il=<k>        — ilçe провинции
//   /api/geo?level=mahalle&ilce=<k>   — махалле/köy района (exact — граница из OSM, иначе расчётная зона)
//   /api/geo?level=mahalle&k=<k>,<k>  — конкретные махалле по ключам (контур выбранного семта)
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

export const revalidate = 3600;
export async function GET(req: Request) {
  const u = new URL(req.url);
  const level = u.searchParams.get("level") || "il";
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return NextResponse.json({ features: [] });
  const sb = createClient(url, key, { auth: { persistSession: false } });
  let q;
  if (level === "il") q = sb.from("geo_il").select("k,name,geom");
  else if (level === "ilce") { const il = u.searchParams.get("il"); if (!il) return NextResponse.json({ features: [] }); q = sb.from("geo_ilce").select("k,name,geom").eq("il", il); }
  else {
    const ilce = u.searchParams.get("ilce"), ks = u.searchParams.get("k");
    if (ks) q = sb.from("geo_mahalle").select("k,name,exact,kind,c,geom").in("k", ks.split(",").slice(0, 50));
    else if (ilce) q = sb.from("geo_mahalle").select("k,name,exact,kind,c,geom").eq("ilce", ilce);
    else return NextResponse.json({ features: [] });
  }
  const { data, error } = await q;
  if (error) return NextResponse.json({ features: [], error: error.message }, { status: 500 });
  const features = (data ?? []).filter((r) => r.geom).map((r) => ({ type: "Feature", properties: { k: r.k, name: r.name, exact: (r as { exact?: boolean }).exact ?? true, kind: (r as { kind?: string }).kind, c: (r as { c?: number[] }).c }, geometry: r.geom }));
  return NextResponse.json({ type: "FeatureCollection", features }, { headers: { "Cache-Control": "public, max-age=3600, s-maxage=3600" } });
}
