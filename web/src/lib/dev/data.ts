// Developer cabinet — reference data and helpers ported from the v2 prototype (spec §3.11, §5.7, §4.8).
import projectsJson from "@/mock/dev/projects.json";
import unitsJson from "@/mock/dev/unitstore.json";
import companiesJson from "@/mock/dev/companies.json";
import usersJson from "@/mock/dev/users.json";
import teamJson from "@/mock/dev/team.json";
import notifsJson from "@/mock/dev/notifs.json";
import notifIconJson from "@/mock/dev/notificon.json";
import dmSeedJson from "@/mock/dev/dm_seed.json";
import dmUnreadJson from "@/mock/dev/dm_unread.json";
import legalJson from "@/mock/dev/legal.json";
import legalCoJson from "@/mock/dev/legalco.json";
import stageListJson from "@/mock/dev/stagelist.json";
import stageColorJson from "@/mock/dev/stagecolor.json";
import stagePctJson from "@/mock/dev/stagepct.json";
import tagColorJson from "@/mock/dev/tagcolor.json";
import roleColorJson from "@/mock/dev/rolecolor.json";
import stOrderJson from "@/mock/dev/storder.json";
import megaInfoJson from "@/mock/dev/mega_info.json";
import aitrJson from "@/mock/dev/aitr.json";
import defaultsJson from "@/mock/dev/defaults.json";
import type { Company, Cur, DevUser, DM, LegalDoc, Notif, NotifType, Project, Stage, StatusColors, TeamMember, Unit, UnitStatus, FScheme } from "./types";

export const PROJECTS_SEED = projectsJson as Project[];
export const UNITS_SEED = unitsJson as Record<string, Unit[]>;
export const COMPANIES_SEED = companiesJson as Company[];
export const USERS_SEED = usersJson as DevUser[];
/** OnePlan support — pinned first in every chat list (as in the realtors app). */
export const SUPPORT_PEER: TeamMember = { id: 0, name: "OnePlan Support", init: "OP", color: "#14243f", role: "support" };
export const TEAM = teamJson as TeamMember[];
/** All chat peers: support first, then the team. */
export const CHAT_PEERS: TeamMember[] = [SUPPORT_PEER, ...TEAM];
export const NOTIFS = notifsJson as Notif[];
export const NOTIF_ICON = notifIconJson as Record<NotifType, [string, string, string]>; // [ti-icon, fg, bg]
export const DM_SEED = dmSeedJson as Record<string, DM[]>;
export const DM_UNREAD = dmUnreadJson as Record<string, number>;
export const LEGAL = legalJson as LegalDoc[];
export const LEGAL_CO = legalCoJson as { name: string; vkn: string; mersis: string; sicil: string; yetki: string; adres: string; kvkkMail: string; legalMail: string };
export const STAGELIST = stageListJson as Stage[];
export const STAGECOLOR = stageColorJson as Record<Stage, string>;
export const STAGEPCT = stagePctJson as Record<Stage, number>;
export const TAGCOLOR = tagColorJson as Record<"cit" | "res" | "com", [string, string]>;
export const ROLECOLOR = roleColorJson as Record<"admin" | "editor" | "client", [string, string]>;
export const STORDER = stOrderJson as UnitStatus[];
export const MEGA_INFO = megaInfoJson as [string, string][];
export const AITR = aitrJson as Record<"EN" | "TR" | "AR", string>;
export const DEFAULT_COLORS = defaultsJson.colors as StatusColors;
export const DEFAULT_FEATURES = defaultsJson.features as string[];
export const DEFAULT_NOTIF_READ = defaultsJson.notifReadIds as number[];
export const BOOKED_TEXT = "#78350F";
/** Text colour on «Не продаётся» tiles (light grey background). */
export const NA_TEXT = "#334155";

/** Prototype assets are served from `public/proto` (symlink to the design folder). */
export const asset = (p: string) => (/^(https?:|blob:|data:|\/)/.test(p) ? p : `/proto/${p}`);
/** Cover image URL: `cover`, otherwise the first photo (blob: URLs from before Storage are dead and skipped). */
export function coverOf(p: Pick<Project, "cover" | "photos">): string {
  const ok = (u: string) => !!u && !u.startsWith("blob:");
  if (ok(p.cover)) return asset(p.cover);
  const first = (p.photos || []).map(photoMeta).find((m) => !m.video && ok(m.url));
  return first ? first.url : "";
}
/** Photo entry → { url, cat, video } (`#cat=` suffix, `vid:` prefix). */
export function photoMeta(p: string): { url: string; cat: string; video: boolean } {
  const video = p.startsWith("vid:");
  const raw = video ? p.slice(4) : p;
  const [path, q] = raw.split("#cat=");
  return { url: asset(path), cat: q || "exterior", video };
}

/** Non-apartment unit types: `1*` = commercial, `sosyal` = social area, `otopark` = parking, `teknik` = technical / service room. */
export const SPECIAL_TYPES = ["1*", "sosyal", "otopark", "teknik"] as const;
export type SpecialType = (typeof SPECIAL_TYPES)[number];
export const isSpecialType = (t: string | undefined | null): t is SpecialType => (SPECIAL_TYPES as readonly string[]).includes(t || "");
/** Special type from free text («Коммерция», «Sosyal Alan», «parking», «техн.» …); `null` if it is not one. */
export function specialTypeOf(v: string): SpecialType | null {
  const t = String(v || "").trim();
  if (!t) return null;
  if (t === "1*" || /коммерц|commerc|ticari|dükkan|dukkan|shop|ofis|office/i.test(t)) return "1*";
  if (/sosyal|social|соц/i.test(t)) return "sosyal";
  if (/otopark|parking|паркинг|garaj|garage/i.test(t)) return "otopark";
  if (/teknik|technical|техн|служеб/i.test(t)) return "teknik";
  return null;
}
type TypeDict = { rooms_commercial: string; type_sosyal: string; type_otopark: string; type_teknik: string };
/** Human label of `Unit.type`: apartments as-is («2+1»), special types from the dictionary. `empty` — for `""`. */
export function typeLabel(t: string | undefined | null, L: TypeDict, empty = ""): string {
  switch (t) {
    case "1*": return L.rooms_commercial;
    case "sosyal": return L.type_sosyal;
    case "otopark": return L.type_otopark;
    case "teknik": return L.type_teknik;
    default: return t || empty;
  }
}
/** Numbers typed as text («Sosyal Alan», «Parking -1») get no «№» prefix; anything starting with a digit («12», «5-4», «12*», «3A») keeps it. `sep` — between «№» and the number. */
export const isNumericNum = (n: string | number) => /^\d/.test(String(n).trim());
export const numLabel = (n: string | number, sep = "") => (isNumericNum(n) ? `№${sep}${n}` : String(n));
export const TYPE_OPTS = ["1+0", "1+1", "2+1", "2+2", "3+1", "3+2", "4+1", "4+2", "5+1", "5+2", "6+1", "6+2", "7+1", "7+2", "8+1", "8+2", "9+1", "9+2", "10+1", "10+2", "10 Üzeri", ...SPECIAL_TYPES];
export const TAG_OPTS = ["", "duplex", "tduplex", "triplex", "kapici"] as const;
export const CAT_OPTS = ["exterior", "interior", "social", "pool", "spa", "kids", "park"] as const;

/** Currency symbols (prototype `curInfo`, line 2687). Prices are stored in the object currency and shown as-is
 * (ТЗ п.9 — the prototype kept them in EUR and multiplied by a hard-coded rate); live rates live in `lib/rates.ts`. */
export const CUR_INFO: Record<Cur, { sym: string }> = { EUR: { sym: "€" }, USD: { sym: "$" }, TRY: { sym: "₺" } };
export const nf = (n: number) => new Intl.NumberFormat("ru-RU", { maximumFractionDigits: 0 }).format(n);
/** «18 725 000 ₺» — thousands separated by non-breaking spaces so the amount never wraps. */
export const money = (n: number, cur: Cur = "EUR") => `${nf(Math.round(n)).replace(/\s/g, "\u00a0")}\u00a0${CUR_INFO[cur].sym}`;
/** Compact amount for tiles: ≥ 1 000 000 → «18,7 млн ₺» (`mln` — localized suffix), otherwise `money()`. */
export function moneyShort(n: number, cur: Cur, mln: string): string {
  if (Math.abs(n) < 1e6) return money(n, cur);
  const m = n / 1e6;
  const v = m >= 100 ? Math.round(m).toString() : (Math.round(m * 10) / 10).toString().replace(".", ",");
  return `${v}\u00a0${mln}\u00a0${CUR_INFO[cur].sym}`;
}

/** Floor label by numbering scheme (prototype `fLbl`, line 2899). */
export function fLbl(f: number, scheme: FScheme = "tr"): string {
  if (f < 0) return scheme === "num" ? String(f) : `B${-f}`;
  if (f === 0) return scheme === "tr" ? "Z" : scheme === "int" ? "G" : "0";
  return String(f);
}

/** Public URL slug (prototype line 3666). */
export function slugOf(name: string): string {
  return name.replace(/İ/g, "i").replace(/I/g, "i").toLowerCase().replace(/ü/g, "u").replace(/ö/g, "o").replace(/ç/g, "c").replace(/ş/g, "s").replace(/ğ/g, "g").replace(/ı/g, "i").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export const coExpired = (until: string) => !!until && new Date(until).getTime() < Date.now();

/** YouTube/Vimeo → embed url (prototype `embedUrl`). */
export function embedUrl(u: string): string {
  if (!u) return "";
  const yt = u.match(/(?:youtu\.be\/|v=|\/embed\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const vm = u.match(/vimeo\.com\/(\d+)/);
  if (vm) return `https://player.vimeo.com/video/${vm[1]}`;
  return u;
}

export const projectVisibleOnPublic = (p: Project, companyActive = true) => !p.pubHidden && p.stage !== "done" && !p.hidden && companyActive;
