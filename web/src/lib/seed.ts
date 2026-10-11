// Deterministic demo dataset, ported from the design prototype (generation + normalisation).
// Used for UI work before Supabase holds real listings, and later to seed the database.
import geoJson from "@/mock/geo.json";
import geoSeedJson from "@/mock/geo-seed.json";
import objJson from "@/mock/obj.json";
import rJson from "@/mock/r.json";
import { FEATS, type Listing, type L10n, type Realtor } from "./types";

export type GeoSemt = { k: string; n: string; ll?: [number, number]; x?: boolean }; // ll/x — только в GEO_SEED: центр и «точная граница»
export type GeoIlce = { k: string; n: string; semts: GeoSemt[] };
export type GeoIl = { k: string; n: string; ilces: GeoIlce[] };
// Mutable registry (prototype `this.GEO`): Nominatim may add İl/İlçe/Semt that the dictionary lacks (`addGeo`).
// Полный справочник (09.10.2026): 81 il и 973 ilçe статически; махалле (46 тыс.) подгружаются лениво — `lib/geo.ts`.
export const GEO = geoJson as GeoIl[];
// Старый мок-справочник прототипа (10 il / 36 ilçe / 81 semt) — только для генерации демо-объектов (ключи совпадают с полным).
export const GEO_SEED = geoSeedJson as GeoIl[];

export const ILCES: Record<string, GeoIlce> = {};
export const IL_OF: Record<string, string> = {};
export const SEMT2ILCE: Record<string, string> = {};
for (const il of GEO) for (const ic of il.ilces) {
  ILCES[ic.k] = ic;
  IL_OF[ic.k] = il.k;
  for (const sm of ic.semts) SEMT2ILCE[sm.k] = ic.k;
}
// семты демо-объектов известны сразу (до ленивой загрузки махалле)
for (const il of GEO_SEED) for (const ic of il.ilces) { const full = ILCES[ic.k]; if (!full) continue; for (const sm of ic.semts) if (!full.semts.some((x) => x.k === sm.k)) { full.semts.push({ k: sm.k, n: sm.n }); SEMT2ILCE[sm.k] = ic.k; } }

export const nrmGeo = (x: string) => String(x || "").toLocaleLowerCase("tr").normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]/g, "");
const likeGeo = (a: string, b: string) => { const p = nrmGeo(a), q = nrmGeo(b); return p === q || q.indexOf(p) === 0 || p.indexOf(q) === 0; };

/**
 * Resolve raw Nominatim names onto GEO keys, creating `'z'+nrm(name)` entries for unknown ones
 * (prototype lines 2673–2698). Returns '' for a level whose raw name is empty.
 */
export function addGeo(names: { il: string; ilce: string; semt: string }): { il: string; ilce: string; semt: string } {
  const out = { il: "", ilce: "", semt: "" };
  const rawIl = names.il || "";
  let il = GEO.find((g) => nrmGeo(g.n) === nrmGeo(rawIl));
  if (!il && rawIl) { il = { k: "z" + nrmGeo(rawIl), n: rawIl, ilces: [] }; GEO.push(il); }
  if (!il) return out;
  out.il = il.k;
  const rawIc = names.ilce || "";
  let ic = rawIc ? il.ilces.find((x) => likeGeo(x.n, rawIc)) : undefined;
  if (!ic && rawIc) { ic = { k: "z" + nrmGeo(rawIc), n: rawIc, semts: [] }; il.ilces.push(ic); ILCES[ic.k] = ic; IL_OF[ic.k] = il.k; }
  if (!ic) return out;
  out.ilce = ic.k;
  const rawSm = names.semt || "";
  let sm = rawSm ? ic.semts.find((x) => likeGeo(x.n, rawSm)) : undefined;
  if (!sm && rawSm) { sm = { k: "z" + nrmGeo(rawSm), n: rawSm }; ic.semts.push(sm); SEMT2ILCE[sm.k] = ic.k; }
  out.semt = sm ? sm.k : "";
  return out;
}
// Ключи по названиям «İl · İlçe · Mahalle» без создания записей (новостройки хранят гео текстом — `Project.geo`).
export function geoKeysOf(il: string, ilce?: string, semt?: string): { il: string; ilce: string; semt: string } {
  const g = il && nrmGeo(il) ? GEO.find((x) => likeGeo(x.n, il)) : undefined; // пустая нормализация (кириллица) не должна совпадать со всем подряд
  const ic = g && ilce ? g.ilces.find((x) => likeGeo(x.n, ilce)) : undefined;
  const sm = ic && semt ? (ic.semts.find((x) => nrmGeo(x.n) === nrmGeo(semt)) ?? ic.semts.find((x) => likeGeo(x.n, semt))) : undefined;
  return { il: g?.k ?? "", ilce: ic?.k ?? "", semt: sm?.k ?? "" };
}
export const ilName = (k: string) => GEO.find((g) => g.k === k)?.n ?? (k || "");
export const ilceName = (k: string) => ILCES[k]?.n ?? (k || "");
export const semtName = (ilce: string, k: string) => ILCES[ilce]?.semts.find((x) => x.k === k)?.n ?? (k || "");

export const REALTORS: Record<string, Realtor> = Object.fromEntries(
  Object.entries(rJson as Record<string, Omit<Realtor, "id">>).map(([id, r]) => [id, { id, ...r }]),
);

const IMG = [
  "https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=600&h=380&fit=crop",
  "https://images.unsplash.com/photo-1545324418-cc1a3fa10c00?w=600&h=380&fit=crop",
  "https://images.unsplash.com/photo-1512917774080-9991f1c4c750?w=600&h=380&fit=crop",
  "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=600&h=380&fit=crop",
  "https://images.unsplash.com/photo-1493809842364-78817add7ffb?w=600&h=380&fit=crop",
  "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?w=600&h=380&fit=crop",
];
const LIMG = [
  "https://images.unsplash.com/photo-1500382017468-9049fed747ef?w=600&h=380&fit=crop",
  "https://images.unsplash.com/photo-1444858291040-58f756a3bdd6?w=600&h=380&fit=crop",
  "https://images.unsplash.com/photo-1500534314209-a25ddb2bd429?w=600&h=380&fit=crop",
];
const CIMG = [
  "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=600&h=380&fit=crop",
  "https://images.unsplash.com/photo-1497366216548-37526070297c?w=600&h=380&fit=crop",
  "https://images.unsplash.com/photo-1556740738-b6a63e27c4df?w=600&h=380&fit=crop",
];
export const NO_PHOTO =
  "data:image/svg+xml;charset=utf-8," +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" width="600" height="380"><rect width="600" height="380" fill="#e8ecf3"/><g stroke="#aab4c4" stroke-width="5" fill="none"><rect x="255" y="150" width="90" height="66" rx="6"/><circle cx="283" cy="172" r="8"/><path d="M262 208l24-26 16 17 12-12 26 21"/></g><text x="300" y="258" font-family="Arial" font-size="18" fill="#8a93a2" text-anchor="middle">OnePlan</text></svg>',
  );

export const DESCS: L10n[] = [
  { RU: "Просторная квартира с видом на море, до пляжа 300 метров. Дом сдан, мебель и техника остаются.", EN: "Spacious apartment with sea view, 300 m to the beach. Building completed, furniture and appliances included.", TR: "Deniz manzaralı ferah daire, plaja 300 m. Bina teslim edildi, mobilya ve beyaz eşya dahil." },
  { RU: "Новый комплекс с бассейном и охраной. Отдельная кухня, две ванные, большой балкон.", EN: "New complex with pool and security. Separate kitchen, two bathrooms, large balcony.", TR: "Havuzlu ve güvenlikli yeni site. Ayrı mutfak, iki banyo, geniş balkon." },
  { RU: "Идеально под инвестиции и ВНЖ: развитая инфраструктура, школы и рынок рядом.", EN: "Ideal for investment and residence permit: developed infrastructure, schools and market nearby.", TR: "Yatırım ve ikamet izni için ideal: gelişmiş altyapı, okullar ve pazar yakında." },
  { RU: "Тихий район, панорамные окна, паркинг. Возможен торг при быстрой сделке.", EN: "Quiet area, panoramic windows, parking. Price negotiable for a quick deal.", TR: "Sakin bölge, panoramik pencereler, otopark. Hızlı satışta pazarlık payı var." },
];

export const CITY_LL: Record<string, [number, number]> = {
  antalya: [36.89, 30.71], alanya: [36.54, 32.0], belek: [36.86, 31.06],
  istanbul: [41.02, 28.98], ankara: [39.92, 32.85], mersin: [36.8, 34.63],
};
const ILL: Record<string, [number, number]> = {
  adana: [37.0, 35.32], ankara: [39.92, 32.85], antalya: [36.89, 30.71], aydin: [37.85, 27.26], bursa: [40.19, 29.06],
  istanbul: [41.02, 28.98], izmir: [38.42, 27.14], mersin: [36.8, 34.63], mugla: [37.03, 27.43], trabzon: [41.0, 39.72],
};
const SEED_LL: Record<string, [number, number]> = {};
for (const il of GEO_SEED) for (const ic of il.ilces) for (const sm of ic.semts) if (sm.ll) SEED_LL[`${ic.k}/${sm.k}`] = sm.ll;
const GMAP: Record<string, [string, string]> = {
  o1: ["muratpasa", "guzeloba"], o2: ["alanya", "mahmutlar"], o3: ["konyaalti", "liman"], o4: ["serik", "belek"],
  o5: ["kepez", "goksu-kepez"], o6: ["muratpasa", "sirinyali-muratpasa"], o7: ["konyaalti", "uncali"], o8: ["alanya", "oba"],
  o9: ["muratpasa", "guzeloba"], m1: ["muratpasa", "sirinyali-muratpasa"], m2: ["konyaalti", "hurma"], m3: ["konyaalti", "hurma"],
  o10: ["kadikoy", "moda"], o11: ["besiktas", "levent"], o12: ["cankaya", "kizilay"],
};

type Raw = Partial<Listing> & { id: string; owner: string; t: L10n; price: number; cur: string; rooms: string; area: number; fl: string; cityKey: string; loc: L10n; img: string; desc: L10n; base: string };

function buildRaw(): Raw[] {
  const raw: Raw[] = [...(objJson as Raw[])];
  raw.push(
    { id: "o10", owner: "r5", t: { RU: "2+1 Мода, Кадыкёй", EN: "2+1 Moda, Kadıköy", TR: "Kadıköy Moda 2+1" }, price: 12500000, cur: "TRY", rooms: "2+1", area: 95, fl: "3/6", cityKey: "istanbul", loc: { RU: "Стамбул · Мода", EN: "İstanbul · Moda", TR: "İstanbul · Moda" }, img: IMG[1], desc: DESCS[0], base: "TR", badge: "new" },
    { id: "o11", owner: "r5", t: { RU: "3+1 Левент, новый дом", EN: "3+1 Levent, new building", TR: "Levent 3+1, yeni bina" }, price: 24500000, cur: "TRY", rooms: "3+1", area: 150, fl: "8/20", cityKey: "istanbul", loc: { RU: "Стамбул · Левент", EN: "İstanbul · Levent", TR: "İstanbul · Levent" }, img: IMG[2], desc: DESCS[1], base: "TR" },
    { id: "o12", owner: "r3", t: { RU: "2+1 Кызылай, центр", EN: "2+1 Kızılay, center", TR: "Kızılay merkez 2+1" }, price: 6200000, cur: "TRY", rooms: "2+1", area: 88, fl: "4/9", cityKey: "ankara", loc: { RU: "Анкара · Кызылай", EN: "Ankara · Kızılay", TR: "Ankara · Kızılay" }, img: IMG[5], desc: DESCS[2], base: "TR" },
  );

  let gi = 0;
  const GROOMS = ["1+1", "2+1", "3+1", "4+1"];
  const MULT: Record<string, number> = { istanbul: 2.4, mugla: 2.0, izmir: 1.5, antalya: 1.25, bursa: 1.1, aydin: 1.3 };
  for (const il of GEO_SEED) for (const ic of il.ilces) for (const sm of ic.semts) {
    const nn = 1 + (gi % 2);
    for (let j = 0; j < nn; j++) {
      gi++;
      const ri = (gi + j) % 4, r = GROOMS[ri], area = [52, 78, 115, 170][ri] + ((gi * 7) % 22);
      const mult = MULT[il.k] || 1;
      const deal = gi % 8 === 3 ? "rent" : gi % 19 === 7 ? "daily" : "sale";
      let price = Math.round(([32, 48, 72, 115][ri] * mult * (100 + ((gi * 13) % 45))) / 100) * 100000;
      if (deal === "rent") price = Math.round(price / 220000) * 1000;
      if (deal === "daily") price = Math.round(price / 2200000) * 100;
      const type = gi % 11 === 5 ? "comm" : gi % 17 === 9 ? "land" : ri === 3 && gi % 3 === 0 ? "house" : "flat";
      const areaV = type === "land" ? area * 8 : area;
      const tt: L10n =
        type === "comm" ? { RU: `Коммерция ${sm.n}, ${area} м²`, EN: `Commercial ${sm.n}, ${area} m²`, TR: `${sm.n} ticari, ${area} m²` }
        : type === "land" ? { RU: `Участок ${sm.n}, ${areaV} м²`, EN: `Land plot ${sm.n}, ${areaV} m²`, TR: `${sm.n} arsa, ${areaV} m²` }
        : type === "house" ? { RU: `Вилла ${r} ${sm.n}`, EN: `Villa ${r} ${sm.n}`, TR: `${sm.n} ${r} villa` }
        : { RU: `${r} ${sm.n}`, EN: `${r} ${sm.n}`, TR: `${sm.n} ${r}` };
      // координаты — у центра реальной махалле (±~250 м), чтобы демо-объекты лежали внутри своих полигонов (09.10.2026)
      const b = sm.ll ?? ILL[il.k] ?? [39, 35];
      const sx = sm.ll ? 0.00012 : 0.006, sy = sm.ll ? 0.00015 : 0.008;
      raw.push({
        id: `g${gi}_${j}`, owner: ["r1", "r2", "r3", "r4", "r5", "r7"][gi % 6], t: tt, price, cur: "TRY",
        rooms: type === "land" ? "" : r, area: areaV,
        fl: type === "house" || type === "land" ? "—" : `${(gi % 8) + 1}/${(gi % 8) + 3}`,
        cityKey: il.k, loc: { RU: `${il.n} · ${sm.n}`, EN: `${il.n} · ${sm.n}`, TR: `${il.n} · ${sm.n}` },
        img: type === "land" ? LIMG[gi % 3] : type === "comm" ? CIMG[gi % 3] : IMG[gi % 6],
        desc: DESCS[gi % 4], base: "TR", deal, type, furn: gi % 2 === 0,
        feats: FEATS.filter((_, fi) => (gi * 7 + fi * 5) % 19 < 8),
        badge: gi % 9 === 2 ? "new" : undefined,
        il: il.k, ilce: ic.k, semt: sm.k,
        ll: [b[0] + (((gi * 37) % 40) - 20) * sx, b[1] + (((gi * 53) % 40) - 20) * sy],
      });
    }
  }
  return raw;
}

function normalise(raw: Raw[]): Listing[] {
  const out = raw.map((r, i) => {
    const o = { ...r } as Listing & Raw;
    const pool = o.type === "land" ? LIMG : o.type === "comm" ? CIMG : IMG;
    o.photos = i % 3 === 0
      ? [o.img, ...[1, 2, 3, 4, 5, 6, 7, 8, 9].map((j) => pool[(i + j) % pool.length] + (j >= 6 ? "&crop=" + ["top", "bottom", "left", "right"][j - 6] : ""))]
      : [o.img, pool[(i + 2) % pool.length], pool[(i + 4) % pool.length]];
    if (!o.ll) { const b = CITY_LL[o.cityKey] || CITY_LL.antalya; o.ll = [b[0] + (((i * 37) % 20) - 10) * 0.004, b[1] + (((i * 53) % 20) - 10) * 0.005]; }
    const g = GMAP[o.id]; if (g) { o.ilce = g[0]; o.semt = g[1]; o.il = IL_OF[g[0]] || "antalya"; }
    const sll = g ? SEED_LL[`${g[0]}/${g[1]}`] : undefined; if (sll) o.ll = [sll[0] + (((i * 37) % 7) - 3) * 0.0004, sll[1] + (((i * 53) % 7) - 3) * 0.0005];
    if (!o.deal) o.deal = "sale";
    if (!o.type) o.type = o.fl === "—" ? "house" : "flat";
    if (o.furn === undefined) o.furn = i % 2 === 0;
    if (!o.feats) o.feats = FEATS.filter((_, fi) => (i * 5 + fi * 3) % 19 < 7);
    const flp = String(o.fl).split("/");
    if (o.floorN === undefined) o.floorN = parseInt(flp[0]) || 0;
    if (o.floorsTotal === undefined) o.floorsTotal = parseInt(flp[1]) || (o.type === "house" ? 2 : 0);
    if (o.bath === undefined) o.bath = parseInt(o.rooms) >= 3 ? (i % 2 ? 2 : 3) : i % 3 === 0 ? 2 : 1;
    if (o.age === undefined) o.age = [1, 3, 7, 12, 18, 25][i % 6];
    if (!o.heat) o.heat = [(["kombi", "ac", "central", "floor"] as const)[i % 4]];
    if (o.balcony === undefined) o.balcony = i % 4 !== 1;
    if (o.aidat === undefined) o.aidat = o.type === "flat" ? [250, 400, 650, 900, 1500, 2500][i % 6] : 0;
    if (o.seaDist === undefined) o.seaDist = [150, 300, 650, 1200, 2500, 4800, 6500, 9000][(i * 3) % 8];
    if (o.type === "land") { o.heat = []; o.bath = 0; o.balcony = false; o.furn = false; o.aidat = 0; o.fl = "—"; o.rooms = ""; o.floorN = 0; o.floorsTotal = 0; }
    if (o.type === "land") {
      if (!o.imar) o.imar = (["konut", "ticari", "tarla", "imarsiz"] as const)[i % 4];
      if (o.emsal === undefined) o.emsal = [0.3, 0.5, 1.2, 1.5][i % 4];
      if (!o.adaParsel) o.adaParsel = `${101 + ((i * 7) % 880)} / ${1 + ((i * 3) % 24)}`;
      if (!o.tapu) o.tapu = i % 5 === 0 ? "hisseli" : "mustakil";
    } else if (!o.tapu) o.tapu = i % 2 === 0 ? "mulkiyet" : "irtifak";
    if (o.type === "house" && o.garden === undefined) o.garden = 300 + ((i * 37) % 900);
    if (o.type === "comm") {
      if (!o.commType) o.commType = (["shop", "office", "depot", "rest"] as const)[i % 4];
      if (o.kiraci === undefined) o.kiraci = i % 4 === 0;
      if (o.devir === undefined) o.devir = i % 7 === 2;
    }
    if ((o.type === "flat" || o.type === "house") && !o.usage) o.usage = (["empty", "owner", "tenant"] as const)[i % 3];
    if (!o.created) { const dd = new Date(2026, 7, 24); dd.setDate(dd.getDate() - (6 + ((i * 13) % 150))); o.created = dd.toLocaleDateString("ru-RU"); }
    if (o.type === "flat" && !o.cephe) o.cephe = (["guney", "kuzey", "dogu", "bati"] as const)[i % 4];
    if (o.inSite === undefined) o.inSite = o.type !== "land" && i % 3 !== 1;
    if (o.credit === undefined) o.credit = o.deal === "sale" && i % 3 !== 2;
    if (o.takas === undefined) o.takas = o.deal === "sale" && i % 6 === 1;
    if (o.lift === undefined) o.lift = o.type === "flat" && i % 3 !== 1;
    if (o.gasline === undefined) o.gasline = (o.type === "flat" || o.type === "house") && i % 2 === 0;
    if (o.own5 === undefined) o.own5 = false;
    o.vnj = o.deal === "sale" && (o.type === "flat" || o.type === "house" || o.type === "land");
    if (o.cit === undefined) o.cit = o.vnj && ((o.cur === "TRY" && o.price >= 17500000) || (o.cur === "EUR" && o.price >= 400000));
    if (o.comm === undefined) o.comm = 0;
    if (!o.st) o.st = "active";
    return o as Listing;
  });

  out.forEach((o, i) => {
    if (o.deal === "rent" && o.deposit === undefined) o.deposit = o.price * 2;
    if (!o.ph && o.deal === "sale" && i % 6 === 2) o.ph = [["10.06.2026", Math.round((o.price * 1.08) / 10000) * 10000], ["22.07.2026", Math.round((o.price * 1.03) / 10000) * 10000]];
  });
  const byId = (id: string) => out.find((o) => o.id === id)!;
  byId("m1").photos = [byId("m1").img];
  byId("m2").photos = [byId("m2").img, IMG[3]];
  byId("m3").img = NO_PHOTO; byId("m3").photos = [NO_PHOTO];
  // All resale prices are stored in TRY.
  for (const o of out) if (o.cur !== "TRY") {
    const r = o.cur === "EUR" ? 48 : 43.2;
    o.price = Math.round((o.price * r) / 10000) * 10000;
    if (o.ph) o.ph = o.ph.map(([d, p]) => [d, Math.round((p * r) / 10000) * 10000]);
    o.cur = "TRY";
  }
  byId("o2").ph = [["12.06.2026", 4850000], ["28.07.2026", 4700000]];
  byId("o4").ph = [["02.05.2026", 19900000], ["15.07.2026", 18900000]];
  byId("m1").ph = [["20.06.2026", 8400000]];
  byId("o5").st = "reserved";
  byId("o9").st = "sold";
  for (const o of out) if (!o.updated) o.updated = o.ph && o.ph.length ? o.ph[o.ph.length - 1][0] : o.created;
  return out;
}

let cache: Listing[] | null = null;
export function getSeedListings(): Listing[] {
  if (!cache) cache = normalise(buildRaw());
  return cache;
}
