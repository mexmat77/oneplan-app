// Загрузка справочника географии в Supabase (таблицы geo_il / geo_ilce / geo_mahalle, миграция 0011):
//   node scripts/geo-upload.mjs <путь к out/keyed.json из стенда geo> [<tr/il_polys.geojson>]
// keyed.json строит scratchpad/geo/merge.mjs (ключи согласованы с web/src/mock/geo.json и public/geo/mahalle.json).
import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
const [keyedPath, ilPolysPath] = process.argv.slice(2);
const env = Object.fromEntries(readFileSync(".env.local", "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const keyed = JSON.parse(readFileSync(keyedPath, "utf8"));
const ilPolys = ilPolysPath ? JSON.parse(readFileSync(ilPolysPath, "utf8")).features : [];
const bboxOf = (g) => { let x0 = 180, y0 = 90, x1 = -180, y1 = -90; const walk = (c) => { if (typeof c[0] === "number") { if (c[0] < x0) x0 = c[0]; if (c[0] > x1) x1 = c[0]; if (c[1] < y0) y0 = c[1]; if (c[1] > y1) y1 = c[1]; } else c.forEach(walk); }; walk(g.coordinates); return [x0, y0, x1, y1].map((v) => +v.toFixed(5)); };
const rowsIl = keyed.il.map((r) => { const p = ilPolys.find((f) => f.properties.name === r.name); return { k: r.k, name: r.name, bbox: p ? bboxOf(p.geometry) : null, geom: p ? p.geometry : null }; });
const rowsIlce = keyed.ilce.map((r) => ({ k: r.k, il: r.il, name: r.name, bbox: r.bbox ?? (r.geom ? bboxOf(r.geom) : null), geom: r.geom }));
const rowsMah = keyed.mahalle.map((r) => ({ k: r.k, il: r.il, ilce: r.ilce, name: r.name, kind: r.kind, exact: !!r.exact, c: r.c, bbox: r.geom ? bboxOf(r.geom) : null, geom: r.geom }));
console.log("il", rowsIl.length, "ilce", rowsIlce.length, "mahalle", rowsMah.length, "exact", rowsMah.filter((r) => r.exact).length);
const up = async (table, rows, batch) => { for (let i = 0; i < rows.length; i += batch) { const { error } = await sb.from(table).upsert(rows.slice(i, i + batch), { onConflict: "k" }); if (error) { console.error(table, i, error.message); process.exit(1); } if (i % (batch * 20) === 0) process.stdout.write(`${table} ${i}/${rows.length}\r`); } console.log(`${table} ok (${rows.length})`); };
await up("geo_il", rowsIl, 50); await up("geo_ilce", rowsIlce, 100); await up("geo_mahalle", rowsMah, 100);
// Записи, которых больше нет в справочнике (например, OSM-«хутора», вытесненные официальными границами), удаляются.
const keep = new Set(rowsMah.map((r) => r.k)); const stale = [];
for (let from = 0; ; from += 1000) { const { data, error } = await sb.from("geo_mahalle").select("k").range(from, from + 999); if (error) { console.error(error.message); break; } (data ?? []).forEach((r) => { if (!keep.has(r.k)) stale.push(r.k); }); if (!data || data.length < 1000) break; }
for (let i = 0; i < stale.length; i += 200) { const { error } = await sb.from("geo_mahalle").delete().in("k", stale.slice(i, i + 200)); if (error) console.error("delete:", error.message); }
console.log("stale mahalle removed", stale.length);
