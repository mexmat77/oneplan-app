// View helpers for the object page (ported from the prototype's `_detail` and `mObj`).
import type { Dict, Lang } from "@/i18n";
import { fmt } from "./money";
import { GEO, IL_OF } from "./seed";
import { oldPrice, type Listing } from "./types";

export type Tile = { icon: "rooms" | "area" | "year" | "bath" | "sea"; v: string; l: string };
export type Row = { l: string; v: string };

const INT_KEYS = ["shut", "terr", "sea", "depot"];
const featLabel = (t: Dict, k: string) => t.feat[k as keyof Dict["feat"]] ?? k;

const seaText = (t: Dict, m: number) => (m < 1000 ? `${m} ${t.par.m}` : `${m / 1000} ${t.par.km}`);

export function detail(o: Listing, t: Dict) {
  const featsL = o.type === "land"
    ? []
    : [...o.feats.filter((k) => INT_KEYS.includes(k)).map((k) => featLabel(t, k)), ...(o.balcony && o.type !== "comm" ? [t.cat.balcB] : [])];
  const infraL = o.type === "land" ? [] : o.feats.filter((k) => !INT_KEYS.includes(k)).map((k) => featLabel(t, k));

  const tiles: Tile[] = o.type === "land"
    ? [{ icon: "area", v: `${o.area} м²`, l: t.cat.areaB }, { icon: "sea", v: seaText(t, o.seaDist), l: t.par.sea }]
    : [
        ...(o.rooms ? [{ icon: "rooms" as const, v: o.rooms, l: t.obj.roomsL }] : []),
        { icon: "area", v: `${Math.round(o.area * 1.12)} / ${o.area} м²`, l: t.obj.grossL },
        { icon: "year", v: String(new Date().getFullYear() - (o.age || 0)), l: t.obj.yearL },
        { icon: "bath", v: String(o.bath || 1), l: t.obj.bathsL },
      ];

  const yn = (b: boolean | undefined) => (b ? t.common.yes : t.common.no);
  const rows: [string, string][] = [];
  const seaRow: [string, string] = [t.par.sea, seaText(t, o.seaDist)];
  if (o.type === "land") {
    rows.push([t.ext.imarT, (o.imar && t.ext.imarL[o.imar]) || "—"]);
    rows.push([t.ext.emsalP, o.emsal !== undefined ? o.emsal.toFixed(2) : "—"]);
    rows.push([t.ext.adaP, o.adaParsel || "—"]);
    rows.push([t.ext.tapuT, t.ext.tapuL[o.tapu] || "—"]);
    rows.push(seaRow);
    if (o.deal === "sale") { rows.push([t.ext.creditB, yn(o.credit)]); if (o.takas) rows.push([t.ext.takasB, t.common.yes]); }
  } else {
    if (o.type === "house") rows.push([t.cat.bfT, String(o.floorsTotal || 2)]);
    else rows.push([t.par.floor, o.fl === "—" ? "—" : o.fl]);
    rows.push([t.par.age, o.age <= 5 ? "0-5" : o.age <= 10 ? "5-10" : o.age <= 20 ? "10-20" : "20+"]);
    rows.push([t.par.bath, String(o.bath)]);
    rows.push([t.par.heat, o.heat.map((h) => t.heatL[h]).filter(Boolean).join(" · ") || t.heatL.none]);
    rows.push([t.ext.tapuT, t.ext.tapuL[o.tapu] || "—"]);
    if (o.type === "comm") {
      rows.push([t.ext.commT, (o.commType && t.ext.commL[o.commType]) || "—"]);
      rows.push([t.ext.kiraciB, yn(o.kiraci)]);
      if (o.devir) rows.push([t.ext.devirB, t.common.yes]);
    }
    if (o.type === "house" && o.garden) rows.push([t.ext.gardenP, `${o.garden} м²`]);
    if (o.usage) rows.push([t.ext.usageT, t.ext.usageL[o.usage]]);
    rows.push([t.ext.siteB, yn(o.inSite)]);
    if (o.deal === "sale") { rows.push([t.ext.creditB, yn(o.credit)]); if (o.takas) rows.push([t.ext.takasB, t.common.yes]); }
    if (o.type !== "comm") { rows.push([t.par.balc, yn(o.balcony)]); rows.push([t.par.furnL, o.furn ? t.furn.yes : t.furn.no]); }
    if (o.type === "flat") rows.push([t.par.aidat, o.aidat ? `${o.aidat.toLocaleString("ru-RU")} ₺` : "—"]);
    rows.push(seaRow);
    if (o.deal === "rent") rows.push([t.par.dep, fmt(o.deposit || 0, "TRY")]);
  }
  return { featsL, infraL, tiles, paramRows: rows.map(([l, v]) => ({ l, v })) as Row[] };
}

export function geoAddr(o: Listing, lang: Lang): string {
  const il = GEO.find((x) => x.k === (o.il || IL_OF[o.ilce || ""]));
  const ic = il?.ilces.find((x) => x.k === o.ilce);
  if (!il || !ic) return o.loc[lang];
  const sm = ic.semts.find((x) => x.k === o.semt);
  if (lang === "RU") return `${il.n}, район ${ic.n}${sm ? `, махалле ${sm.n}` : ""}`;
  if (lang === "TR") return `${il.n}, ${ic.n}${sm ? `, ${sm.n}` : ""}`;
  return `${il.n}, ${ic.n} district${sm ? `, ${sm.n}` : ""}`;
}

export function metaDates(o: Listing, t: Dict): string {
  return `${t.par.no} OP-${o.id.toUpperCase()} · ${t.par.created} ${o.created || "—"} · ${t.par.upd} ${o.updated || o.created || "—"}`;
}

export function priceLabel(o: Listing, t: Dict): string {
  return fmt(o.price, o.cur) + (o.deal === "rent" ? t.cat.perMo : o.deal === "daily" ? t.cat.perDay : "");
}

export type PhRow = { d: string; p: string; now: boolean; delta: string; down: boolean };
export function priceHistory(o: Listing, lang: Lang): PhRow[] {
  const nowL = lang === "RU" ? "Сейчас" : lang === "EN" ? "Now" : "Şimdi";
  const hist: [string | null, number][] = (o.ph || [])
    .filter((r, i, arr) => i === 0 || r[1] !== arr[i - 1][1])
    .filter((r, i, arr) => !(i === arr.length - 1 && r[1] === o.price));
  const all: [string | null, number][] = [...hist, [null, o.price]];
  return all.map((r, i) => {
    const prev = i > 0 ? all[i - 1][1] : null;
    const diff = prev ? r[1] - prev : 0;
    return {
      d: r[0] === null ? nowL : r[0],
      p: fmt(r[1], o.cur),
      now: r[0] === null,
      delta: prev && diff !== 0 ? (diff > 0 ? "+" : "−") + fmt(Math.abs(diff), o.cur) : "",
      down: diff < 0,
    };
  });
}

export function similar(o: Listing, all: Listing[]): Listing[] {
  return all.filter((x) => x.id !== o.id && x.st === "active" && x.deal === o.deal && (x.ilce === o.ilce || x.rooms === o.rooms)).slice(0, 3);
}

export const hasDrop = (o: Listing) => { const old = oldPrice(o); return !!old && old > o.price && o.st === "active"; };

export const ST_STYLE: Record<Listing["st"], { bg: string; c: string }> = {
  active: { bg: "#e4f6ee", c: "#0f9d6b" },
  reserved: { bg: "#fdf5df", c: "#c98d00" },
  sold: { bg: "#f0f2f6", c: "#6b7688" },
  off: { bg: "#fdecec", c: "#e5484d" },
};
