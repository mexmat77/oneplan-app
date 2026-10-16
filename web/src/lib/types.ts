import type { Lang } from "@/i18n";

export type L10n = Record<Lang, string>;

export type Deal = "sale" | "rent" | "daily";
export type PropType = "flat" | "house" | "comm" | "land";
export type ListingStatus = "active" | "reserved" | "sold" | "off";
export type Badge = "new" | "hot" | "exc";
export type Currency = "TRY" | "EUR" | "USD";
export type Heat = "none" | "kombi" | "central" | "ac" | "floor";
export type Tapu = "mulkiyet" | "irtifak" | "mustakil" | "hisseli";
export type Imar = "konut" | "ticari" | "tarla" | "imarsiz";
export type CommType = "shop" | "office" | "depot" | "rest";
export type Usage = "empty" | "owner" | "tenant";
export type Cephe = "guney" | "kuzey" | "dogu" | "bati";
export type SortKey = "new" | "cheap" | "exp";

export const FEATS = [
  "pool", "ipool", "opark", "upark", "play", "gym", "cctv", "sec", "sauna", "hamam",
  "gen", "gazebo", "bbq", "tennis", "basket", "depot", "shut", "terr", "sea",
] as const;
export type Feat = (typeof FEATS)[number];

export const ROOMS_BASIC = ["1+1", "2+1", "3+1", "4+1"];
export const ROOMS_ALL = [
  "1+0", "1+1", "1.5+1", "2+0", "2+1", "2.5+1", "2+2", "3+0", "3+1", "3.5+1", "3+2", "3+3",
  "4+0", "4+1", "4.5+1", "4.5+2", "4+2", "4+3", "4+4", "5+1", "5.5+1", "5+2", "5+3", "5+4",
  "6+1", "6+2", "6.5+1", "6+3", "6+4", "7+1", "7+2", "7+3", "8+1", "8+2", "8+3", "8+4", "9+1", "9+2", "9+3",
];

export type RealtorChannels = { wa: boolean; tg: boolean; tgLogin: string; vb: boolean; mx: boolean; mxId: string; wc: boolean; wcId: string };
export type Realtor = {
  id: string;
  name: string;
  ag: string;
  color: string;
  phone: string;
  ch?: RealtorChannels; // каналы связи из profiles (wa_on, tg_on…); у демо-риэлторов нет — показываются все (16.10.2026)
  city: L10n;
  langs: string;
  online: boolean;
  objs: number;
  sels: number;
  likes: number;
  la: L10n;
  pending?: boolean;
};

export type Listing = {
  id: string;
  owner: string;
  t: L10n;
  price: number; // always TRY
  cur: Currency;
  deal: Deal;
  type: PropType;
  rooms: string; // '' for land
  area: number; // net m² (land: plot m²)
  fl: string; // "3/5" or "—"
  floorN: number;
  floorsTotal: number;
  cityKey: string;
  il?: string;
  ilce?: string;
  semt?: string;
  loc: L10n;
  ll: [number, number];
  img: string;
  photos: string[];
  desc: L10n;
  base: Lang;
  mt?: Lang[]; // языки, где заголовок/описание — машинный перевод (`fillTranslations`), пометка на странице объекта
  badge?: Badge;
  st: ListingStatus;
  comm: number;
  furn: boolean;
  feats: string[];
  bath: number;
  age: number;
  heat: Heat[]; // multi-select from the form; [] for land
  balcony: boolean;
  lift: boolean;
  gasline: boolean;
  own5: boolean; // owned 5+ years (sale only)
  inSite: boolean;
  credit: boolean;
  takas: boolean;
  aidat: number;
  seaDist: number;
  deposit?: number;
  ph?: [string, number][]; // price history [date dd.mm.yyyy, price]
  relistedFrom?: string; // выставлено повторно после продажи — id прежнего объявления (0024)
  no?: number; // короткий номер объявления из базы (listings.short_id) — показывается как «OP-9»; id — технический uuid
  created: string;
  updated: string;
  usage?: Usage;
  cephe?: Cephe;
  tapu: Tapu;
  imar?: Imar;
  emsal?: number;
  adaParsel?: string;
  garden?: number;
  commType?: CommType;
  kiraci?: boolean;
  devir?: boolean;
  vnj: boolean;
  cit: boolean;
};

export const grossArea = (o: Listing) => (o.type === "land" ? o.area : Math.round(o.area * 1.12));
export const oldPrice = (o: Listing) => (o.ph && o.ph.length ? o.ph[0][1] : null);
