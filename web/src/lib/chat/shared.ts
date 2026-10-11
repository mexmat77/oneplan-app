// Общие типы и чистые функции чата — без "use client", чтобы их могли импортировать и серверные компоненты
// (клиентский модуль при импорте с сервера даёт не значения, а ссылки-заглушки).
/** Кого представляет участник: агентство, застройщик, свободный агент, команда OnePlan */
export type OrgKind = "agency" | "developer" | "free" | "staff";
export type ChatPeer = { id: string; name: string; email: string | null; phone: string | null; color: string; /** название агентства/застройщика */ agency: string; org: OrgKind; online: boolean; lastSeen: string | null; support: boolean };
export type ChatMessage = { id: number; convId: string; senderId: string; senderName?: string; lang: string; text: Record<string, string>; listingId: string | null; readAt: string | null; createdAt: string };
export type Conversation = { id: string; kind: "dm" | "support"; peer: ChatPeer; last: ChatMessage | null; unread: number; /** диалог поддержки другого пользователя (видит админ) */ supportOf?: ChatPeer };
type Rel = { name: string } | { name: string }[] | null | undefined;
export type ProfileRow = { id: string; name: string | null; email: string | null; phone: string | null; color: string | null; last_seen: string | null; role?: string | null; agency_text: string | null; platform_staff: boolean | null; agencies: Rel; developers?: Rel };
export const PROFILE_SEL = "id, name, email, phone, color, last_seen, role, agency_text, platform_staff, agencies(name), developers:developers!profiles_developer_id_fkey(name)";
export const SUPPORT_EMAIL = "support@one-plan.pro";
export const toPeer = (p: ProfileRow, supportId: string): ChatPeer => {
  const rel = (r: Rel) => (Array.isArray(r) ? r[0]?.name : r?.name) || "";
  const seen = p.last_seen ? new Date(p.last_seen).getTime() : 0;
  const isDev = p.role === "developer";
  const agency = p.platform_staff ? "OnePlan" : isDev ? rel(p.developers) : rel(p.agencies) || p.agency_text || "";
  const org: OrgKind = p.platform_staff ? "staff" : isDev ? "developer" : agency ? "agency" : "free";
  return { id: p.id, name: p.name || p.email?.split("@")[0] || "—", email: p.email, phone: p.phone, color: p.color || "#4d7cfe", agency, org, online: Date.now() - seen < 5 * 60e3, lastSeen: p.last_seen, support: p.id === supportId };
};
/** Подпись «кого представляет»: «Агентство · Kaya Emlak», «Застройщик · Miray Invest», «Свободный агент», «Команда OnePlan». */
export type OrgDict = { agency: string; developer: string; free: string; staff: string };
export const orgLabel = (peer: Pick<ChatPeer, "agency" | "org" | "support">, d: OrgDict): string =>
  peer.support ? "" : peer.org === "staff" ? d.staff : peer.org === "free" ? d.free : `${peer.org === "developer" ? d.developer : d.agency} · ${peer.agency}`;
