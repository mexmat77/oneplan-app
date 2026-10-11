// Типы CRM (общие для сервера и клиента). Контакты/заметки приходят на клиент уже расшифрованными сервером (actions).
import type { Lang } from "@/i18n";

export type WsKind = "realtor" | "developer";
export type Ws = { kind: WsKind; id: string };

export type CrmAccess = "full" | "readonly" | "none";
export type CrmMe = { ws: Ws; access: CrmAccess; trialUntil: string | null; paidTo: string | null; isAdmin: boolean; meId: string; members: CrmMember[] };
export type CrmMember = { id: string; name: string; color: string };

export type SourceKind = "manual" | "site" | "phone" | "portal" | "referral" | "social" | "partner" | "other";
export type Source = { id: string; name: string; kind: SourceKind; active: boolean; sort: number; hasToken: boolean };

export type StageKind = "open" | "won" | "lost";
export type Stage = { id: string; key: string; name: Record<Lang, string>; kind: StageKind; color: string | null; sort: number };

export type ContactKind = "phone" | "email" | "whatsapp" | "telegram" | "other";
export type Contact = { id: string; kind: ContactKind; value: string; label: string | null; isMain: boolean };

export type RefKind = "none" | "realtor" | "agency" | "text";
export type Want = { deal?: string; type?: string; rooms?: string[]; il?: string; ilces?: string[]; semts?: string[] };

export type Client = {
  id: string; ownerId: string | null; name: string; lang: Lang; sourceId: string | null;
  refKind: RefKind; refProfileId: string | null; refAgencyId: string | null; refText: string | null;
  budgetMin: number | null; budgetMax: number | null; cur: string; want: Want;
  notes: string; tags: string[]; consent: boolean; consentAt: string | null;
  status: "active" | "archived"; createdAt: string; updatedAt: string;
  contacts: Contact[];
  /** сводка для списка */
  dealsN: number; openDealsN: number; nextTask: { id: string; title: string; dueAt: string; kind: TaskKind } | null;
};

export type Deal = {
  id: string; clientId: string; clientName: string; ownerId: string | null; stageId: string | null; title: string; deal: string;
  amount: number | null; cur: string; listingId: string | null; projectId: string | null; unitUid: number | null; selectionId: string | null;
  sourceId: string | null; lostReason: string | null; closedAt: string | null; createdAt: string; updatedAt: string;
};

export type TaskKind = "call" | "show" | "meeting" | "message" | "other";
export type Task = { id: string; clientId: string | null; clientName: string | null; dealId: string | null; ownerId: string | null; kind: TaskKind; title: string; dueAt: string; doneAt: string | null; createdAt: string };

export type EventKind = "created" | "stage" | "note" | "call" | "show" | "meeting" | "task" | "contact" | "lead" | "merge" | "edit" | "deal" | "doc";
export type CrmEvent = { id: number; clientId: string | null; dealId: string | null; actorId: string | null; kind: EventKind; payload: Record<string, unknown>; text: string; createdAt: string; tr: Partial<Record<Lang, string>> };

export type ClientInput = {
  name: string; lang: Lang; sourceId: string | null; ownerId: string | null;
  refKind: RefKind; refProfileId: string | null; refAgencyId: string | null; refText: string;
  budgetMin: number | null; budgetMax: number | null; cur: string; want: Want; notes: string; tags: string[]; consent: boolean;
  contacts: { id?: string; kind: ContactKind; value: string; label: string; isMain: boolean }[];
};
export type DealInput = { clientId: string; title: string; deal: string; amount: number | null; cur: string; stageId: string | null; ownerId: string | null; listingId: string | null; projectId: string | null; unitUid: number | null; selectionId: string | null; sourceId: string | null };
export type TaskInput = { clientId: string | null; dealId: string | null; ownerId: string | null; kind: TaskKind; title: string; dueAt: string };

/** Дубль по контакту: найден существующий клиент с тем же телефоном/e-mail. */
export type DupHit = { clientId: string; name: string; kind: ContactKind; ownerId: string | null };

/** Наборы этапов по умолчанию (ключи — для логики; имена — i18n `crm.stages`). */
export const DEFAULT_STAGES: Record<WsKind, { key: string; kind: StageKind; color: string }[]> = {
  realtor: [
    { key: "new", kind: "open", color: "#8a93a2" }, { key: "work", kind: "open", color: "#4d7cfe" }, { key: "show", kind: "open", color: "#f5a623" },
    { key: "booked", kind: "open", color: "#7b4fd0" }, { key: "won", kind: "won", color: "#22c15e" }, { key: "lost", kind: "lost", color: "#e5484d" },
  ],
  developer: [
    { key: "lead", kind: "open", color: "#8a93a2" }, { key: "call", kind: "open", color: "#4d7cfe" }, { key: "visit", kind: "open", color: "#f5a623" },
    { key: "booked", kind: "open", color: "#7b4fd0" }, { key: "contract", kind: "open", color: "#0ea5a4" }, { key: "paid", kind: "won", color: "#22c15e" },
    { key: "lost", kind: "lost", color: "#e5484d" },
  ],
};
export const DEFAULT_SOURCES: { key: string; kind: SourceKind }[] = [
  { key: "recommend", kind: "referral" }, { key: "site", kind: "site" }, { key: "phone", kind: "phone" }, { key: "instagram", kind: "social" },
  { key: "sahibinden", kind: "portal" }, { key: "partner", kind: "partner" }, { key: "walkin", kind: "other" },
];
