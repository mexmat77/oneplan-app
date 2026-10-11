// New-build projects (demo data from the prototype) + unit list generator + catalogue filter (prototype lines 3953–3979).
import newbJson from "@/mock/newb.json";
import type { Lang } from "@/i18n";
import { GEO, SEMT2ILCE, getSeedListings } from "./seed";
import type { Currency, L10n } from "./types";

export type SalesStatus = "none" | "start" | "open" | "sold";
export type KeysStatus = "not" | "started" | "done";
export type UnitStatus = "free" | "hold" | "proc" | "res" | "sold" | "na";
export type PhotoCat = "ext" | "int" | "soc" | "pool" | "spa" | "kids" | "park";
export type Plan = [string, number, number, string?]; // rooms, m², price, tag
export type Unit = { no: number; bl: number; f: number; pl: Plan; gb: number; net: number; tag: "" | "ter" | "dup" | "villa"; st: UnitStatus };
export type Project = {
  k: string; n: string; type: "flat" | "house"; cur: Currency; geo: string; ll: [number, number]; dev: string; dlv: string;
  sales: SalesStatus; keys: KeysStatus; units: number; fl: number; bl: number; inst: boolean; feats: string[]; plans: Plan[];
  ph: { img: string; cat: PhotoCat }[]; desc: L10n; diary: { d: string; tx: L10n; img?: string }[]; docs: string[]; unitList: Unit[];
};

// Prototype photos are indexes into real listing images ("/img/nb/N.jpg" placeholder from the extraction).
function realImg(src: string): string {
  const real = getSeedListings().filter((o) => o.img && !o.img.startsWith("data:"));
  const m = /\/img\/nb\/(\d+)\.jpg$/.exec(src);
  return m ? real[+m[1] % real.length].img : src;
}

function genUnits(p: Omit<Project, "unitList">): Unit[] {
  const list: Unit[] = [];
  const perFl = Math.min(6, Math.ceil(p.units / p.fl));
  let no = 1;
  for (let b = 1; b <= p.bl; b++) for (let f = 1; f <= p.fl; f++) for (let u = 0; u < perFl; u++) {
    if (list.length >= p.units) break;
    const h = (f * 7 + u * 13 + b * 5 + p.n.length) % 20;
    const pl = p.plans[(f + u + b) % p.plans.length];
    const gb = pl[1] + ((u + f) % 3) * 2;
    list.push({
      no: no++, bl: b, f, pl, gb, net: Math.round(gb * 0.82),
      tag: pl[3] === "villa" ? "villa" : f === p.fl && u % 3 === 0 ? "ter" : f === 1 && u % 5 === 2 ? "dup" : "",
      st: p.sales === "none" ? "na" : p.sales === "sold" ? "sold" : h < 6 ? "sold" : h < 8 ? "hold" : h < 10 ? "proc" : h < 12 ? "res" : "free",
    });
  }
  return list;
}

let cache: Project[] | null = null;
export function getProjects(): Project[] {
  if (cache) return cache;
  cache = (newbJson as Omit<Project, "unitList">[]).map((p) => {
    const base = { ...p, ph: p.ph.map((x) => ({ ...x, img: realImg(x.img) })), diary: p.diary.map((d) => ({ ...d, img: d.img ? realImg(d.img) : undefined })) };
    return { ...base, unitList: genUnits(base) };
  });
  return cache;
}

// Unit statuses — prototype `V2` (line 4020).
export const UNIT_ST: Record<Exclude<UnitStatus, "na">, { l: L10n; dot: string; bg: string; fg: string }> = {
  free: { l: { RU: "Свободно", EN: "Available", TR: "Müsait" }, dot: "#12996b", bg: "#e7f6ec", fg: "#1f7a44" },
  hold: { l: { RU: "Бронь", EN: "Hold", TR: "Opsiyon" }, dot: "#f0ad00", bg: "#fdf5df", fg: "#9a7100" },
  proc: { l: { RU: "Оформление", EN: "Processing", TR: "Sözleşme" }, dot: "#4d7cfe", bg: "#eef3ff", fg: "#3b5fd6" },
  sold: { l: { RU: "Продано", EN: "Sold", TR: "Satıldı" }, dot: "#6b7a90", bg: "#eef1f6", fg: "#5a6472" },
  res: { l: { RU: "Резерв", EN: "Reserve", TR: "Rezerve" }, dot: "#8b5cf6", bg: "#f1ebff", fg: "#6d3fd8" },
};
export const UNIT_ORDER: Exclude<UnitStatus, "na">[] = ["free", "hold", "proc", "sold", "res"];
// Sales-status badge colours — prototype `salesBg` (line 3957).
export const SALES_STYLE: Record<SalesStatus, { bg: string; fg: string }> = {
  none: { bg: "#eef1f6", fg: "#5a6472" }, start: { bg: "#fdf5df", fg: "#b96b00" }, open: { bg: "#e7f6ec", fg: "#2f9e5b" }, sold: { bg: "#fdecec", fg: "#e5484d" },
};
export const TAG_L: Record<string, L10n> = { ter: { RU: "Терраса", EN: "Terrace", TR: "Teras" }, dup: { RU: "Дуплекс", EN: "Duplex", TR: "Dubleks" }, villa: { RU: "Вилла", EN: "Villa", TR: "Villa" } };
export const unitLabel = (st: UnitStatus, lang: Lang) => (st === "na" ? "—" : UNIT_ST[st].l[lang]);

// Developer phone / avatar — prototype line 4011.
export const devPhone = (p: Pick<Project, "n" | "fl">) => `+90 242 324 ${10 + p.n.length} ${20 + p.fl}`;
export const devAvatar = (dev: string) => dev.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();

// Currency helpers — prototype `toTry` (line 3956) and the map-pin short form (line 2644).
export const toTry = (v: number, cur: Currency) => (cur === "EUR" ? v * 48 : cur === "USD" ? v * 43.2 : v);
export const minPlanPrice = (p: Project) => Math.min(...p.plans.map((pl) => pl[2]));
export const curSym = (cur: Currency) => (cur === "USD" ? "$" : cur === "EUR" ? "€" : "₺");
export const pinShort = (mn: number) => (mn >= 1000000 ? `${Math.round(mn / 100000) / 10}M` : `${Math.round(mn / 1000)}K`);
// Room-chip key for the unit table — prototype `ukey` (line 4031).
export const ukey = (u: Unit) => (u.tag === "villa" ? "villa" : u.pl[0] + (u.tag === "dup" ? " Duplex" : ""));
// Photos shown in the unit sheet — prototype line 4052.
export const unitPhotos = (p: Project, u: Unit) => [0, 1, 2, 3].map((j) => p.ph[(u.no + j) % p.ph.length]?.img).filter((x): x is string => !!x);

// Catalogue filter state — prototype `nb*` state (line 2524) + `fIl/fIlces/fSemts` shared with the geo picker.
export type NbType = "" | "flat" | "house" | "comm";
export type NbFilter = {
  q: string; type: NbType; rooms: string[]; min: string; max: string; abMin: string; abMax: string;
  dlv: string; inst: boolean; salesOpen: boolean; feats: string[]; il: string; ilces: string[]; semts: string[];
};
export const EMPTY_NB_FILTER: NbFilter = { q: "", type: "", rooms: [], min: "", max: "", abMin: "", abMax: "", dlv: "", inst: false, salesOpen: false, feats: [], il: "", ilces: [], semts: [] };
export const nbHasAny = (f: NbFilter) => !!(f.inst || f.salesOpen || f.rooms.length || f.min || f.max || f.q || f.il || f.ilces.length || f.semts.length || f.type || f.feats.length || f.dlv || f.abMin || f.abMax);
// «Ещё» badge — prototype `nbMoreN` (line 4103): type / feats / dlv / area.
export const nbMoreN = (f: NbFilter) => (f.type ? 1 : 0) + (f.feats.length ? 1 : 0) + (f.dlv ? 1 : 0) + (f.abMin || f.abMax ? 1 : 0);
// Reset-button "active" state of the panel — prototype `nbResetBtnSt` (line 3873) (geo is not counted).
export const nbResetActive = (f: NbFilter) => !!(f.inst || f.salesOpen || f.rooms.length || f.min || f.max || f.q || f.type || f.feats.length || f.dlv || f.abMin || f.abMax);

const digits = (s: string) => +String(s).replace(/\D/g, "");
export const mlnOf = (s: string) => { const n = digits(s); return n ? n * (n < 1000 ? 1000000 : 1) : 0; };

// Geo filter by substring of `p.geo` — prototype `nbGeoOk` (lines 3958–3962) and the picker's `gOk` (3900–3904).
export function nbGeoOk(p: Pick<Project, "geo">, g: { il: string; ilces: string[]; semts: string[] }): boolean {
  const s = p.geo.toLocaleLowerCase("tr");
  if (g.semts.length) return g.semts.some((k) => { const ic = ilceOf(SEMT2ILCE[k]); const sm = ic?.semts.find((x) => x.k === k); return !!sm && s.includes(sm.n.toLocaleLowerCase("tr")); });
  if (g.ilces.length) return g.ilces.some((k) => { const ic = ilceOf(k); return !!ic && s.includes(ic.n.toLocaleLowerCase("tr")); });
  if (g.il) { const il = GEO.find((x) => x.k === g.il); return !!il && s.includes(il.n.toLocaleLowerCase("tr")); }
  return true;
}
function ilceOf(k: string | undefined) {
  if (!k) return undefined;
  for (const il of GEO) { const ic = il.ilces.find((x) => x.k === k); if (ic) return ic; }
  return undefined;
}

// Catalogue list — prototype `nbList` (lines 3963–3979).
export function filterProjects(projects: Project[], f: NbFilter, dev: string | null): Project[] {
  const q = f.q.trim().toLowerCase();
  const am = digits(f.abMin), ax = digits(f.abMax), mn = mlnOf(f.min), mx = mlnOf(f.max);
  return projects.filter((p) => {
    if (q && !`${p.n} ${p.geo} ${p.dev}`.toLowerCase().includes(q)) return false;
    if (dev && p.dev !== dev) return false;
    if (!nbGeoOk(p, f)) return false;
    if (f.inst && !p.inst) return false;
    if (f.salesOpen && p.sales !== "open") return false;
    if (f.type && p.type !== f.type) return false;
    if (f.dlv && !p.dlv.endsWith(f.dlv)) return false;
    if (f.feats.length && !f.feats.every((x) => p.feats.includes(x))) return false;
    if ((am || ax) && !p.plans.some((pl) => (!am || pl[1] >= am) && (!ax || pl[1] <= ax))) return false;
    if (f.rooms.length && !p.plans.some((pl) => f.rooms.includes(pl[0]))) return false;
    const pFrom = toTry(minPlanPrice(p), p.cur);
    if (mn && pFrom < mn) return false;
    if (mx && pFrom > mx) return false;
    return true;
  });
}
