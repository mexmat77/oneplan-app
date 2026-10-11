// Catalog filters — a 1:1 port of the prototype's `passF` (OnePlan Риэлторы.dc.html, lines 3026–3075).
import { convert, eur } from "./money";
import { SEMT2ILCE } from "./seed";
import type { Deal, Listing, PropType, SortKey } from "./types";

export type Filters = {
  deal: Deal;
  type: PropType | "";
  min: string; max: string;                 // price, ₺
  rooms: string[];
  furn: "" | "yes" | "no";
  abMin: string; abMax: string;             // gross m² (land: plot)
  anMin: string; anMax: string;             // net m²
  feats: string[];
  vnj: boolean; cit: boolean; lift: boolean; gas: boolean; drop: boolean; balc: boolean;
  site: boolean; credit: boolean; takas: boolean;
  heat: string[]; bath: string[]; age: string[];
  flrMin: string; flrMax: string; notFirst: boolean; notLast: boolean;
  bfMin: string; bfMax: string;             // floors in building
  aidat: string; sea: string; dep: string;
  imar: string[]; tapu: string[]; commT: string[]; kiraci: boolean; devir: boolean;
  usage: string[]; cephe: string[]; garMin: string; garMax: string;
  il: string; ilces: string[]; semts: string[];
  sort: SortKey;
};

export const EMPTY_FILTERS: Filters = {
  deal: "sale", type: "", min: "", max: "", rooms: [], furn: "",
  abMin: "", abMax: "", anMin: "", anMax: "", feats: [],
  vnj: false, cit: false, lift: false, gas: false, drop: false, balc: false, site: false, credit: false, takas: false,
  heat: [], bath: [], age: [], flrMin: "", flrMax: "", notFirst: false, notLast: false, bfMin: "", bfMax: "",
  aidat: "", sea: "", dep: "", imar: [], tapu: [], commT: [], kiraci: false, devir: false, usage: [], cephe: [], garMin: "", garMax: "",
  il: "", ilces: [], semts: [], sort: "new",
};

// Cleared when the property type changes / when «land» is chosen (prototype `typeClear` / `landClear`).
export const TYPE_CLEAR: Partial<Filters> = { imar: [], tapu: [], commT: [], usage: [], cephe: [], kiraci: false, devir: false, garMin: "", garMax: "" };
export const LAND_CLEAR: Partial<Filters> = { rooms: [], flrMin: "", flrMax: "", notFirst: false, notLast: false, bfMin: "", bfMax: "", bath: [], heat: [], balc: false, furn: "", feats: [], aidat: "", age: [], site: false };

const num = (s: string) => Number(String(s).replace(/\s/g, "")) || 0;
export const ageBand = (age: number) => (age <= 5 ? "0-5" : age <= 10 ? "5-10" : age <= 20 ? "10-20" : "20+");

export function passF(o: Listing, f: Filters): boolean {
  if (o.deal !== f.deal) return false;
  if (f.type && o.type !== f.type) return false;
  const grossA = o.type === "land" ? o.area : Math.round(o.area * 1.12);
  if (f.abMin && grossA < num(f.abMin)) return false;
  if (f.abMax && grossA > num(f.abMax)) return false;
  if (f.anMin && o.type !== "land" && o.area < num(f.anMin)) return false;
  if (f.anMax && o.type !== "land" && o.area > num(f.anMax)) return false;
  if (f.furn === "yes" && !o.furn) return false;
  if (f.furn === "no" && o.furn) return false;
  if (f.feats.length && !f.feats.every((x) => o.feats.includes(x))) return false;
  if (f.vnj && !o.vnj) return false;
  if (f.cit && !o.cit) return false;
  if (f.lift && !o.lift) return false;
  if (f.gas && !o.gasline) return false;
  if (f.drop && !(o.ph && o.ph.length && o.ph[0][1] > o.price)) return false;
  if (f.balc && !o.balcony) return false;
  if (f.heat.length) { const oh: string[] = o.heat; if (!f.heat.some((h) => oh.includes(h))) return false; }
  if (f.bath.length) { const b2 = o.bath >= 3 ? "3" : String(o.bath); if (!f.bath.includes(b2)) return false; }
  if (f.age.length && !f.age.includes(ageBand(o.age))) return false;
  if (f.flrMin && o.floorN < num(f.flrMin)) return false;
  if (f.flrMax && o.floorN > num(f.flrMax)) return false;
  if (f.notFirst && o.floorN === 1) return false;
  if (f.notLast && o.floorsTotal > 0 && o.floorN === o.floorsTotal) return false;
  if (f.bfMin && o.floorsTotal < num(f.bfMin)) return false;
  if (f.bfMax && o.floorsTotal > num(f.bfMax)) return false;
  if (f.aidat && o.aidat > num(f.aidat)) return false;
  if (f.sea) { if (f.sea === "gt5") { if (o.seaDist <= 5000) return false; } else if (o.seaDist > num(f.sea)) return false; }
  if (f.dep && o.deal === "rent" && (o.deposit || 0) > num(f.dep)) return false;
  if (f.imar.length && (o.type !== "land" || !f.imar.includes(o.imar ?? ""))) return false;
  if (f.tapu.length && !f.tapu.includes(o.tapu)) return false;
  if (f.commT.length && (o.type !== "comm" || !f.commT.includes(o.commType ?? ""))) return false;
  if (f.kiraci && !o.kiraci) return false;
  if (f.devir && !o.devir) return false;
  if (f.usage.length && !f.usage.includes(o.usage ?? "")) return false;
  if (f.garMin && (!o.garden || o.garden < num(f.garMin))) return false;
  if (f.garMax && (!o.garden || o.garden > num(f.garMax))) return false;
  if (f.site && !o.inSite) return false;
  if (f.cephe.length && !f.cephe.includes(o.cephe ?? "")) return false;
  if (f.credit && !o.credit) return false;
  if (f.takas && !o.takas) return false;
  if (f.il && o.il !== f.il) return false;
  if (f.ilces.length) {
    if (!o.ilce || !f.ilces.includes(o.ilce)) return false;
    const ssf = f.semts.filter((k) => SEMT2ILCE[k] === o.ilce);
    if (ssf.length && (!o.semt || !ssf.includes(o.semt))) return false;
  }
  if (f.rooms.length && !f.rooms.includes(o.rooms)) return false;
  const p = convert(o.price, o.cur, "TRY"); // цена в ₺ по текущему курсу ЦБ (фильтр задаётся в ₺)
  if (f.min && p < num(f.min)) return false;
  if (f.max && p > num(f.max)) return false;
  return true;
}

export function sortListings(list: Listing[], sort: SortKey): Listing[] {
  if (sort === "cheap") return [...list].sort((a, b) => eur(a) - eur(b));
  if (sort === "exp") return [...list].sort((a, b) => eur(b) - eur(a));
  return list;
}

export const areaSet = (f: Filters) => !!(f.abMin || f.abMax || f.anMin || f.anMax);

// Badge on the «Ещё» button (prototype `extN`).
export function extCount(f: Filters): number {
  return (f.type ? 1 : 0) + (areaSet(f) ? 1 : 0) + (f.furn ? 1 : 0) + f.feats.length
    + (f.vnj ? 1 : 0) + (f.drop ? 1 : 0) + (f.balc ? 1 : 0) + f.heat.length + f.bath.length + f.age.length
    + (f.flrMin || f.flrMax || f.notFirst || f.notLast ? 1 : 0) + (f.bfMin || f.bfMax ? 1 : 0) + (f.garMin || f.garMax ? 1 : 0)
    + (f.aidat ? 1 : 0) + (f.sea ? 1 : 0) + (f.dep ? 1 : 0)
    + f.imar.length + f.tapu.length + f.commT.length + f.usage.length + f.cephe.length
    + (f.kiraci ? 1 : 0) + (f.devir ? 1 : 0) + (f.site ? 1 : 0) + (f.credit ? 1 : 0) + (f.takas ? 1 : 0);
}

// Saved-search matching (prototype `matchOf`): only active listings, geo/rooms/price.
export function matchSearch(o: Listing, p: Pick<Filters, "il" | "ilces" | "semts" | "rooms" | "min" | "max">): boolean {
  if (o.st !== "active") return false;
  if (p.il && o.il !== p.il) return false;
  if (p.ilces.length) {
    if (!o.ilce || !p.ilces.includes(o.ilce)) return false;
    const ssm = p.semts.filter((k) => SEMT2ILCE[k] === o.ilce);
    if (ssm.length && (!o.semt || !ssm.includes(o.semt))) return false;
  }
  if (p.rooms.length && !p.rooms.includes(o.rooms)) return false;
  const pr = eur(o) * 48;
  if (p.min && pr < num(p.min)) return false;
  if (p.max && pr > num(p.max)) return false;
  return true;
}
