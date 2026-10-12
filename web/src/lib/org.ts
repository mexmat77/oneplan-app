// Организации и участники (12.10.2026, миграция 0022) — единая модель для админки платформы, кабинета агентства,
// CRM и кабинета застройщика. Чистые типы и справочники (без серверных зависимостей).
//
//   Пользователь (profiles.role): realtor | developer | admin (администратор платформы).
//   Организация: агентство (agencies) или застройщик (developers).
//   Участие (org_members): пользователь ∈ организация с ролью в ней:
//     агентство   — owner «Администратор агентства», manager «Руководитель филиала», agent «Риэлтор»;
//     застройщик  — admin «Администратор», editor «Редактор», manager «Менеджер продаж».
//   Приглашение (invites): ссылка /join/<code> с организацией и ролью; принятие создаёт аккаунт и участие.

export type OrgKind = "agency" | "developer";
export type AgencyRole = "owner" | "manager" | "agent";
export type DevOrgRole = "admin" | "editor" | "manager";
export type OrgRole = AgencyRole | DevOrgRole;

export const ORG_ROLES: Record<OrgKind, OrgRole[]> = { agency: ["owner", "manager", "agent"], developer: ["admin", "editor", "manager"] };
/** Роль по умолчанию для нового участника. */
export const DEFAULT_ORG_ROLE: Record<OrgKind, OrgRole> = { agency: "agent", developer: "editor" };
/** Администратор организации (управляет участниками и приглашениями). */
export const isOrgAdminRole = (kind: OrgKind, role: string | null | undefined) => (kind === "agency" ? role === "owner" : role === "admin");
/** Тип пользователя платформы, который может состоять в организации этого вида. */
export const PLATFORM_ROLE_OF: Record<OrgKind, "realtor" | "developer"> = { agency: "realtor", developer: "developer" };

export type OrgInfo = {
  kind: OrgKind; id: string; name: string; phone: string | null; addr: string | null; lic: string | null;
  director: string | null; active: boolean; until: string | null; // director/active/until — только у застройщика
};
export type OrgMember = {
  id: string; name: string; email: string | null; phone: string | null; color: string; status: "active" | "paused" | "pending";
  role: OrgRole; branchId: string | null; lastSeen: string | null; paidTo: string | null; platformStaff: boolean; joinedAt: string;
};
export type OrgInvite = { code: string; email: string | null; name: string | null; role: OrgRole; createdAt: string; url: string };
export type OrgBranch = { id: string; name: string };
export type OrgView = {
  org: OrgInfo; members: OrgMember[]; invites: OrgInvite[]; branches: OrgBranch[];
  canManage: boolean; // администратор платформы или администратор организации
  meId: string | null;
};
