// Типы CRM (общие для сервера и клиента). Контакты/заметки приходят на клиент уже расшифрованными сервером (actions).
import type { Lang } from "@/i18n";

export type WsKind = "realtor" | "agency" | "developer";   // agency (0017): все риэлторы агентства в одной CRM
export type Ws = { kind: WsKind; id: string };

export type CrmAccess = "full" | "readonly" | "none";
export type MemberRole = "owner" | "manager" | "agent";
export type Branch = { id: string; name: string; city: string | null; headId: string | null; sort: number };
export type CrmMe = { ws: Ws; access: CrmAccess; trialUntil: string | null; paidTo: string | null; isAdmin: boolean; meId: string; role: MemberRole; branchId: string | null; members: CrmMember[]; branches: Branch[]; lostReasons: string[] };
export type CrmMember = { id: string; name: string; color: string; role: MemberRole; branchId: string | null };

export type SourceKind = "manual" | "site" | "phone" | "portal" | "referral" | "social" | "partner" | "other";
export type Source = { id: string; name: string; kind: SourceKind; active: boolean; sort: number; hasToken: boolean };

export type StageKind = "open" | "won" | "lost";
export type StageScope = "deal" | "client";
export type Stage = { id: string; key: string; name: Record<Lang, string>; kind: StageKind; color: string | null; sort: number; scope: StageScope };

export type ContactKind = "phone" | "email" | "whatsapp" | "telegram" | "other";
export type Contact = { id: string; kind: ContactKind; value: string; label: string | null; isMain: boolean };

export type RefKind = "none" | "realtor" | "agency" | "client" | "text";
export type Want = { deal?: string; type?: string; rooms?: string[]; il?: string; ilces?: string[]; semts?: string[] };

export type ClientRole = "buyer" | "seller" | "landlord" | "tenant";
/** Ключ этапа воронки клиента (crm_stages scope=client; наборы по умолчанию — DEFAULT_CLIENT_STAGES). */
export type ClientStage = string;
export type Priority = "hot" | "warm" | "cold";
export type Channel = "call" | "whatsapp" | "telegram" | "email";
/** KVKK: информирование (Aydınlatma Metni) и согласие (Açık Rıza) — раздельно. */
export type Kvkk = {
  info?: { at?: string; method?: "verbal" | "whatsapp" | "email" | "site" | "paper"; version?: string };
  consent?: { call?: boolean; sms?: boolean; whatsapp?: boolean; email?: boolean; at?: string; revokedAt?: string; basis?: "consent" | "contract" | "interest"; source?: string; retainMonths?: number; deleteAt?: string };
};
export type Client = {
  id: string; ownerId: string | null; name: string; lang: Lang; sourceId: string | null;
  kind: "person" | "company"; company: string | null; roles: ClientRole[]; stage: ClientStage; priority: Priority | null;
  country: string | null; citizenship: string | null; channel: Channel | null; contactTime: string | null; campaign: string | null;
  refKind: RefKind; refProfileId: string | null; refAgencyId: string | null; refClientId: string | null; refText: string | null;
  branchId: string | null; kvkk: Kvkk; boardPos: number | null;
  budgetMin: number | null; budgetMax: number | null; cur: string; want: Want;
  notes: string; tags: string[]; consent: boolean; consentAt: string | null;
  status: "active" | "archived"; createdAt: string; updatedAt: string;
  /** последняя реальная активность (события ленты, задачи) — сортировка списка по умолчанию (0023) */
  lastActivityAt: string;
  contacts: Contact[];
  /** заявки клиента (кратко, для списка/карточки) */
  requests: RequestBrief[];
  /** сводка для списка */
  dealsN: number; openDealsN: number; nextTask: { id: string; title: string; dueAt: string; kind: TaskKind } | null;
};

export type Deal = {
  id: string; clientId: string; clientName: string; ownerId: string | null; stageId: string | null; title: string; deal: string;
  amount: number | null; cur: string; listingId: string | null; projectId: string | null; unitUid: number | null; selectionId: string | null;
  sourceId: string | null; lostReason: string | null; closedAt: string | null; createdAt: string; updatedAt: string;
  requestId: string | null; branchId: string | null; commission: number | null; commissionKind: "pct" | "sum" | null; deposit: number | null; depositAt: string | null; boardPos: number | null;
};

// ---------- заявки (0017): одна потребность клиента; поля по типу — реестр lib/crm/requestFields.ts ----------
export type RequestKind = "buy" | "sell" | "rent_out" | "rent_in";
export type RequestStatus = "active" | "matching" | "showing" | "negotiation" | "paused" | "closed";
export type RequestBrief = { id: string; kind: RequestKind; status: RequestStatus; priority: Priority | null; fields: Record<string, unknown> };
export type CrmRequest = {
  id: string; clientId: string; kind: RequestKind; status: RequestStatus; ownerId: string | null; branchId: string | null;
  listingId: string | null; projectId: string | null; unitUid: number | null; priority: Priority | null; deadline: "asap" | "1m" | "3m" | "later" | null;
  fields: Record<string, unknown>; closed: Record<string, unknown>; createdAt: string; updatedAt: string;
};
export type RequestInput = {
  clientId: string; kind: RequestKind; status: RequestStatus; ownerId: string | null; branchId: string | null; listingId: string | null;
  priority: Priority | null; deadline: CrmRequest["deadline"]; fields: Record<string, unknown>; closed: Record<string, unknown>;
};

export type TaskKind = "call" | "show" | "meeting" | "message" | "other";
export type Task = { id: string; clientId: string | null; clientName: string | null; dealId: string | null; ownerId: string | null; kind: TaskKind; title: string; dueAt: string; doneAt: string | null; createdAt: string };

export type EventKind = "created" | "stage" | "note" | "call" | "show" | "meeting" | "task" | "contact" | "lead" | "merge" | "edit" | "deal" | "doc" | "request" | "transfer";
export type CrmEvent = { id: number; clientId: string | null; dealId: string | null; actorId: string | null; kind: EventKind; payload: Record<string, unknown>; text: string; createdAt: string; tr: Partial<Record<Lang, string>> };

export type ClientInput = {
  name: string; lang: Lang; sourceId: string | null; ownerId: string | null;
  kind: "person" | "company"; company: string; roles: ClientRole[]; stage: ClientStage; priority: Priority | null;
  country: string; citizenship: string; channel: Channel | null; contactTime: string; campaign: string;
  refKind: RefKind; refProfileId: string | null; refAgencyId: string | null; refClientId: string | null; refText: string;
  branchId: string | null; kvkk: Kvkk;
  notes: string; tags: string[];
  contacts: { id?: string; kind: ContactKind; value: string; label: string; isMain: boolean }[];
  /** при создании: первая заявка (тип + ключевые поля), создаётся вместе с клиентом */
  firstRequest?: { kind: RequestKind; fields: Record<string, unknown> } | null;
  /** при создании: первая задача («следующее действие») */
  firstTask?: { kind: TaskKind; dueAt: string; title: string } | null;
};
export type DealInput = { clientId: string; title: string; deal: string; amount: number | null; cur: string; stageId: string | null; ownerId: string | null; listingId: string | null; projectId: string | null; unitUid: number | null; selectionId: string | null; sourceId: string | null; requestId: string | null; commission: number | null; commissionKind: "pct" | "sum" | null; deposit: number | null; depositAt: string | null };
export type TaskInput = { clientId: string | null; dealId: string | null; ownerId: string | null; kind: TaskKind; title: string; dueAt: string };

/** Дубль по контакту: найден существующий клиент с тем же телефоном/e-mail. */
export type DupHit = { clientId: string; name: string; kind: ContactKind; ownerId: string | null };

/** Наборы этапов по умолчанию (ключи — для логики; имена — i18n `crm.stages`). */
export const DEFAULT_STAGES: Record<WsKind, { key: string; kind: StageKind; color: string }[]> = {
  realtor: [
    { key: "new", kind: "open", color: "#8a93a2" }, { key: "work", kind: "open", color: "#4d7cfe" }, { key: "show", kind: "open", color: "#f5a623" },
    { key: "booked", kind: "open", color: "#7b4fd0" }, { key: "won", kind: "won", color: "#22c15e" }, { key: "lost", kind: "lost", color: "#e5484d" },
  ],
  agency: [
    { key: "new", kind: "open", color: "#8a93a2" }, { key: "work", kind: "open", color: "#4d7cfe" }, { key: "show", kind: "open", color: "#f5a623" },
    { key: "booked", kind: "open", color: "#7b4fd0" }, { key: "won", kind: "won", color: "#22c15e" }, { key: "lost", kind: "lost", color: "#e5484d" },
  ],
  developer: [
    { key: "lead", kind: "open", color: "#8a93a2" }, { key: "call", kind: "open", color: "#4d7cfe" }, { key: "visit", kind: "open", color: "#f5a623" },
    { key: "booked", kind: "open", color: "#7b4fd0" }, { key: "contract", kind: "open", color: "#0ea5a4" }, { key: "paid", kind: "won", color: "#22c15e" },
    { key: "lost", kind: "lost", color: "#e5484d" },
  ],
};
/** Воронка клиента по умолчанию (работа менеджера до сделки) — одна для всех видов пространств. */
export const DEFAULT_CLIENT_STAGES: { key: string; kind: StageKind; color: string }[] = [
  { key: "new", kind: "open", color: "#4d7cfe" }, { key: "noanswer", kind: "open", color: "#e5484d" }, { key: "work", kind: "open", color: "#f5a623" },
  { key: "selection", kind: "open", color: "#0ea5a4" }, { key: "visit", kind: "open", color: "#16a34a" }, { key: "show", kind: "open", color: "#7b4fd0" }, { key: "thinking", kind: "open", color: "#8a93a2" },
  { key: "won", kind: "won", color: "#22c15e" }, { key: "lost", kind: "lost", color: "#475569" }, { key: "unqualified", kind: "lost", color: "#c9d0dc" },
];
export const DEFAULT_SOURCES: { key: string; kind: SourceKind }[] = [
  { key: "recommend", kind: "referral" }, { key: "site", kind: "site" }, { key: "phone", kind: "phone" }, { key: "instagram", kind: "social" },
  { key: "sahibinden", kind: "portal" }, { key: "partner", kind: "partner" }, { key: "walkin", kind: "other" },
];
