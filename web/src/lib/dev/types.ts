// Developer cabinet (OnePlan v2) — data model, ported from docs/prototype-developer-spec.md §3.

export type Stage = "project" | "siteprep" | "foundation" | "frame" | "facade" | "interior" | "landscape" | "done";
export type SalesSt = "notsale" | "start" | "open" | "sold";
export type OccSt = "none" | "started" | "full";
export type PurposeTag = "cit" | "res" | "com";
export type Cur = "EUR" | "USD" | "TRY";
export type FScheme = "tr" | "int" | "num";
export type HideReason = "done" | "sold" | "paused" | "other";
export type UnitStatus = "free" | "booked" | "process" | "sold" | "reserve" | "na";
export type UnitTag = null | "duplex" | "tduplex" | "triplex" | "kapici" | "ofis" | "terrace";
export type Band = "out" | "ins";
export type DevRole = "superadmin" | "admin" | "editor" | "client";
export type DevLang = "RU" | "EN" | "TR";
export type DocStatus = "ok" | "wait" | "soon";
export type PhotoCat = "exterior" | "interior" | "social" | "pool" | "spa" | "kids" | "park";
export type NotifType = "sold" | "booked" | "price" | "status" | "media" | "doc" | "newobj";

export type ProjectFile = { n: string; s: string; u: string };
export type ProgressEntry = { d: string; t: string; ph: string[]; live?: boolean };

/** Project / object (`this.PROJECTS`, spec §3.1). Photo paths are relative to `/proto/`; `#cat=` suffix = category, `vid:` prefix = video. */
export type Project = {
  id: number;
  name: string;
  loc: string;
  stage: Stage;
  ready: number;
  iskan: boolean;
  salesSt: SalesSt;
  occSt: OccSt;
  sale?: number;
  video?: string;
  live?: string;
  client: string;              // company name (joined by string, as in the prototype)
  editor?: string;
  tags: PurposeTag[];
  access?: string;
  mega?: boolean; diamond?: boolean; akro?: boolean; mixed?: boolean; villas?: boolean; rich?: boolean;
  hidden?: boolean;
  hideReason?: HideReason;
  cover: string;
  photos: string[];
  files: ProjectFile[];
  cur?: Cur;
  /** Валюта, в которой хранятся цены юнитов (= `cur`). Отсутствует у данных прототипа (цены в €) — мигрируется в `store/dev.tsx`. */
  pricesIn?: Cur;
  fScheme?: FScheme;
  pubHidden?: boolean;
  pubMode?: "closed" | "public";
  pubBeyan?: boolean;
  eidsRef?: string;
  genGrid?: boolean;
  /** Per-block start of automatic numbering (default 1 for every block). */
  numStart?: Record<string, number>;
  // Editable fields the prototype kept in `state` (eDescs/eAddr/eLng/eLat/eProg/eDocs) — stored per project here.
  descs?: Partial<Record<DevLang | "AR", string>>;
  addr?: string;
  lng?: string;
  lat?: string;
  prog?: ProgressEntry[];
  docs?: { yapi: DocStatus; iskan: DocStatus; tapu: DocStatus; dask: DocStatus };
  /** Real floor plans (экспликации), key = `${wing}|${floor}` (`wing` = '' for objects without blocks). */
  floorPlans?: Record<string, FloorPlan>;
};

/** Polygon of one unit on a floor plan; coordinates are normalized 0..1 relative to the plan image. */
export type FloorPlanArea = { uid: number; poly: [number, number][] };
/** Uploaded floor plan image (public Storage URL or `blob:` in demo mode) with its pixel size and traced units. */
export type FloorPlan = { img: string; w: number; h: number; areas: FloorPlanArea[] };

/** Unit / помещение (`UNITSTORE[objId]`, spec §3.2). */
export type Unit = {
  uid: number;
  num: string | number;
  floor: number;
  pos: number;
  band: Band;
  wing?: string;
  type: string;                 // '1+1' … '10+2', '1*' = commercial, 'sosyal' | 'otopark' | 'teknik' = special (see SPECIAL_TYPES), '' = empty generated tile
  area: number;
  price: number;
  status: UnitStatus;
  tag: UnitTag;
  ft?: ("terrace" | "garden")[];
  feats: string[];
  entry?: number[];
  td?: 0 | 1 | 2;
  w?: 1 | 2 | 3;
  vl?: boolean;
  vt?: number | string;
  la?: number;
  blok?: string;
  px?: number;
  py?: number;
  lx?: number;
  lw?: number;
  gen?: boolean;
  ptId?: number;
  /** Фото/рендеры именно этой квартиры (публичные URL Storage); в галерее идут после плана типа. */
  photos?: string[];
  /** Number was typed by hand (e.g. «Sosyal Alan») — renumbering leaves it alone. */
  numManual?: boolean;
};

export type Company = {
  id: number; name: string; dir: string; objIds: number[]; until: string; active?: boolean;
  phone?: string; mail?: string; web?: string; addr?: string; vergi?: string;
};

export type DevUser = {
  id: number; companyIds: number[]; role: "admin" | "editor" | "client"; fio: string; mail: string;
  access: "all" | number[]; until: string; active?: boolean; platform?: boolean;
};

export type TeamMember = { id: number; name: string; init: string; color: string; role: string };

export type Notif = { id: number; type: NotifType; who: number; obj: string; unit?: string; extra?: string; mins: number };

export type DM = { who: number | "me"; text: string; mins: number; st?: "sent" | "delivered" | "read"; lang?: DevLang; mid?: number; ts?: number };

export type LogEntry = { ts: number; uid: number; num: string | number; f: "status" | "price"; from: string | number; to: string | number; by?: string };

/** `imgs` — ручные картинки (загрузка/порядок/удаление в модалке); `autoImgs` — вырезки с поэтажного плана по uid квартиры
 * (создаются/удаляются вместе с контуром, в `imgs` не дублируются; для показа — `allImgs(pt)` из `planTypes.ts`). */
/** Спецтег типа планировки: многоуровневые квартиры (дуплекс/терс-дуплекс/триплекс) группируются отдельно от обычных той же комнатности. */
export type PlanTypeTag = "duplex" | "tduplex" | "triplex";
export type PlanType = {
  id: number; name: string; rooms: string; area: number; imgs: string[];
  /** «с плана»: ключ `uid|wing|floor` → url */
  autoImgs?: Record<string, string>;
  manual?: boolean;
  /** спец-типы (соц. зона, паркинг) — свои в каждом блоке */
  wing?: string;
  /** дуплекс/терс-дуплекс/триплекс — отдельная группа «2+1 · Дуплекс»; отсутствует = обычная квартира */
  tag?: PlanTypeTag;
  /** зеркальная планировка (`Tip A-R`): id базового типа `Tip A-L`, см. `applyMirrorSplit` */
  mirrorOf?: number;
  /** «другая планировка» при тех же комнатах и площади (другой блок): id исходного автотипа, см. `applyMirrorSplit` */
  shape?: number;
};

export type LegalDoc = { id: string; icon: string; title: string; ver: string; upd: string; body: { h: string; p: string[] }[] };

export type StatusColors = Record<UnitStatus, string>;
