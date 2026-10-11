// Реестр полей заявки по типу (ТЗ docs/crm-spec.md §3, 0017). Формы и карточки строятся по нему; значения — в
// crm_requests.fields (открытые) и closed_enc (закрытые, зашифрованы). Подписи — i18n `crm.rq.f.<key>`, группы — `crm.rq.g.<group>`,
// варианты — `crm.rq.o.<набор>.<значение>`.
import type { RequestKind } from "./types";

export type FieldType = "text" | "textarea" | "number" | "money" | "cur" | "select" | "multi" | "bool" | "date" | "geo" | "rooms" | "listing" | "clients";
export type ReqGroup = "main" | "finance" | "params" | "must" | "showing" | "owner" | "access" | "legal" | "eids" | "terms" | "tenant";
export type ReqField = { key: string; type: FieldType; group: ReqGroup; opts?: keyof typeof OPTS; closed?: boolean; quick?: boolean };

/** Наборы вариантов (значения — ключи i18n). */
export const OPTS = {
  purpose: ["live", "invest", "citizenship", "residence", "resale", "rentout"],
  propType: ["flat", "villa", "comm", "land", "hotel"],
  payment: ["cash", "mortgage", "installment", "exchange", "aftersale"],
  condition: ["new", "ready", "renovation"],
  yesNoAny: ["yes", "no", "any"],
  features: ["parking", "pool", "security", "elevator", "gas", "seaview", "garden", "balcony", "school", "beach", "center", "gym"],
  decider: ["self", "spouses", "partners"],
  ownerRole: ["owner", "representative", "attorney"],
  urgency: ["high", "normal", "low"],
  sellReason: ["relocation", "upgrade", "money", "invest_exit", "inheritance", "other"],
  occupancy: ["free", "owner_lives", "tenant"],
  access: ["free", "by_appointment", "keys_office"],
  marketing: ["photo", "video", "drone", "social", "portals"],
  contract: ["exclusive", "open"],
  representation: ["owner", "vekalet"],
  lien: ["none", "mortgage", "seizure", "serh"],
  docStatus: ["ok", "missing", "pending"],
  sellStatus: ["prep", "published", "showing", "offer", "deposit", "sold"],
  eids: ["pending", "active", "expired", "revoked"],
  deposit: ["months", "sum"],
  payPeriod: ["monthly", "6m", "12m"],
  aidat: ["included", "separate"],
  usage: ["living", "office", "commerce"],
  pets: ["yes", "no", "discuss"],
  guarantee: ["income", "guarantor", "prepay"],
  furnishedWant: ["required", "any", "none"],
  incomeProof: ["have", "later"],
  entity: ["person", "company"],
  cur: ["TRY", "EUR", "USD"],
} as const;

const buy: ReqField[] = [
  { key: "purpose", type: "select", group: "main", opts: "purpose", quick: true },
  { key: "propType", type: "select", group: "main", opts: "propType", quick: true },
  { key: "geo", type: "geo", group: "main", quick: true },
  { key: "budgetMin", type: "money", group: "finance", quick: true }, { key: "budgetMax", type: "money", group: "finance", quick: true }, { key: "cur", type: "cur", group: "finance", quick: true },
  { key: "payment", type: "select", group: "finance", opts: "payment" }, { key: "downPayment", type: "money", group: "finance" }, { key: "monthly", type: "money", group: "finance" },
  { key: "rooms", type: "rooms", group: "params", quick: true }, { key: "areaNet", type: "number", group: "params" }, { key: "areaGross", type: "number", group: "params" },
  { key: "floorMin", type: "number", group: "params" }, { key: "floorMax", type: "number", group: "params" }, { key: "ageMax", type: "number", group: "params" },
  { key: "condition", type: "select", group: "params", opts: "condition" }, { key: "furnished", type: "select", group: "params", opts: "yesNoAny" },
  { key: "must", type: "multi", group: "must", opts: "features" }, { key: "nice", type: "multi", group: "must", opts: "features" },
  { key: "showTime", type: "text", group: "showing" }, { key: "decider", type: "select", group: "showing", opts: "decider" },
  { key: "translator", type: "bool", group: "showing" }, { key: "foreigner", type: "bool", group: "showing" },
];
const ownerBlock: ReqField[] = [
  { key: "listing", type: "listing", group: "main", quick: true },
  { key: "ownerRole", type: "select", group: "owner", opts: "ownerRole", quick: true }, { key: "ownersN", type: "number", group: "owner" }, { key: "coOwners", type: "clients", group: "owner" },
];
const legalBlock: ReqField[] = [
  { key: "contract", type: "select", group: "legal", opts: "contract" }, { key: "yetkiNo", type: "text", group: "legal" }, { key: "yetkiFrom", type: "date", group: "legal" }, { key: "yetkiTo", type: "date", group: "legal" },
  { key: "representation", type: "select", group: "legal", opts: "representation" }, { key: "lien", type: "select", group: "legal", opts: "lien" }, { key: "lienNote", type: "text", group: "legal" },
  { key: "docTapu", type: "select", group: "legal", opts: "docStatus" }, { key: "docIskan", type: "select", group: "legal", opts: "docStatus" }, { key: "docDask", type: "select", group: "legal", opts: "docStatus" },
  { key: "eidsStatus", type: "select", group: "eids", opts: "eids" }, { key: "tasinmazId", type: "text", group: "eids" }, { key: "eidsOwner", type: "text", group: "eids" },
  { key: "eidsTo", type: "date", group: "eids" }, { key: "eidsChecked", type: "date", group: "eids" }, { key: "eidsError", type: "text", group: "eids" }, { key: "portalIds", type: "textarea", group: "eids" },
];
const accessBlock: ReqField[] = [
  { key: "occupancy", type: "select", group: "access", opts: "occupancy" }, { key: "tenantUntil", type: "date", group: "access" }, { key: "access", type: "select", group: "access", opts: "access" },
  { key: "marketing", type: "multi", group: "access", opts: "marketing" },
];
const sell: ReqField[] = [
  ...ownerBlock,
  { key: "priceList", type: "money", group: "finance", quick: true }, { key: "priceWant", type: "money", group: "finance" }, { key: "priceMin", type: "money", group: "finance", closed: true }, { key: "cur", type: "cur", group: "finance", quick: true },
  { key: "commission", type: "text", group: "finance" }, { key: "urgency", type: "select", group: "finance", opts: "urgency" }, { key: "sellReason", type: "select", group: "finance", opts: "sellReason" },
  ...accessBlock, ...legalBlock,
  { key: "sellStatus", type: "select", group: "main", opts: "sellStatus" },
];
const rent_out: ReqField[] = [
  ...ownerBlock,
  { key: "rent", type: "money", group: "finance", quick: true }, { key: "rentMin", type: "money", group: "finance", closed: true }, { key: "cur", type: "cur", group: "finance", quick: true },
  { key: "depositKind", type: "select", group: "finance", opts: "deposit" }, { key: "depositVal", type: "number", group: "finance" }, { key: "payPeriod", type: "select", group: "finance", opts: "payPeriod" },
  { key: "aidat", type: "money", group: "finance" }, { key: "aidatKind", type: "select", group: "finance", opts: "aidat" }, { key: "commission", type: "text", group: "finance" },
  { key: "minTerm", type: "number", group: "terms" }, { key: "freeFrom", type: "date", group: "terms" }, { key: "furnished", type: "select", group: "terms", opts: "yesNoAny" }, { key: "inventory", type: "text", group: "terms" },
  { key: "usage", type: "select", group: "terms", opts: "usage" }, { key: "pets", type: "select", group: "terms", opts: "pets" }, { key: "guarantee", type: "multi", group: "terms", opts: "guarantee" },
  { key: "commercial", type: "textarea", group: "terms" }, { key: "ownerTerms", type: "textarea", group: "terms" }, { key: "keys", type: "text", group: "terms" },
  ...accessBlock, ...legalBlock,
];
const rent_in: ReqField[] = [
  { key: "propType", type: "select", group: "main", opts: "propType", quick: true }, { key: "geo", type: "geo", group: "main", quick: true },
  { key: "rentMax", type: "money", group: "finance", quick: true }, { key: "cur", type: "cur", group: "finance", quick: true }, { key: "aidatMax", type: "money", group: "finance" },
  { key: "rooms", type: "rooms", group: "params", quick: true }, { key: "areaNet", type: "number", group: "params" }, { key: "furnished", type: "select", group: "params", opts: "furnishedWant" },
  { key: "moveIn", type: "date", group: "terms" }, { key: "term", type: "number", group: "terms" }, { key: "residents", type: "number", group: "terms" }, { key: "pets", type: "text", group: "terms" },
  { key: "work", type: "text", group: "tenant" }, { key: "incomeProof", type: "select", group: "tenant", opts: "incomeProof" }, { key: "guarantor", type: "bool", group: "tenant" },
  { key: "prepayMonths", type: "number", group: "tenant" }, { key: "registration", type: "bool", group: "tenant" }, { key: "entity", type: "select", group: "tenant", opts: "entity" },
  { key: "showTime", type: "text", group: "showing" }, { key: "must", type: "multi", group: "must", opts: "features" },
];

export const REQUEST_FIELDS: Record<RequestKind, ReqField[]> = { buy, sell, rent_out, rent_in };
export const REQUEST_KINDS: RequestKind[] = ["buy", "sell", "rent_out", "rent_in"];
export const GROUP_ORDER: ReqGroup[] = ["main", "finance", "params", "must", "terms", "tenant", "showing", "owner", "access", "legal", "eids"];

/** Роль клиента, которую подразумевает тип заявки. */
export const ROLE_OF_KIND = { buy: "buyer", sell: "seller", rent_out: "landlord", rent_in: "tenant" } as const;

/** Краткая строка заявки для списка/карточки: тип + ключевые цифры (без закрытых полей). */
export function requestSummary(kind: RequestKind, f: Record<string, unknown>, fmtMoney: (v: number, cur: string) => string, geoLabel: (f: Record<string, unknown>) => string): string {
  const cur = (f.cur as string) || "TRY";
  const money = (k: string) => (typeof f[k] === "number" && (f[k] as number) > 0 ? fmtMoney(f[k] as number, cur) : "");
  const parts: string[] = [];
  if (kind === "buy") { const a = money("budgetMin"), b = money("budgetMax"); if (a || b) parts.push(`${a || "…"} – ${b || "…"}`); }
  if (kind === "rent_in") { const m = money("rentMax"); if (m) parts.push(`≤ ${m}`); }
  if (kind === "sell") { const m = money("priceList") || money("priceWant"); if (m) parts.push(m); }
  if (kind === "rent_out") { const m = money("rent"); if (m) parts.push(m); }
  if (Array.isArray(f.rooms) && f.rooms.length) parts.push((f.rooms as string[]).slice(0, 3).join(", "));
  const g = geoLabel(f); if (g) parts.push(g);
  return parts.join(" · ");
}
