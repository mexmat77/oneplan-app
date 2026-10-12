import "server-only";

// Служебные помощники организаций (12.10.2026): НЕ в app/org/actions.ts — экспорт из файла "use server" становится
// публичным серверным экшеном без проверки прав. Сюда — только то, что вызывают другие серверные модули.
import type { CurrentUser } from "@/lib/auth";
import { notify } from "@/lib/notify";
import { DEFAULT_ORG_ROLE, ORG_ROLES, type OrgKind, type OrgRole } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;
const TABLE: Record<OrgKind, "agencies" | "developers"> = { agency: "agencies", developer: "developers" };

export async function orgName(admin: Admin, kind: OrgKind, id: string) {
  const { data } = await admin.from(TABLE[kind]).select("name").eq("id", id).maybeSingle();
  return String(data?.name ?? "");
}

/** Участие пользователя в организации (риэлтор — в одном агентстве: прежнее участие снимается). Уведомляет `team_added`. */
export async function addMemberFor(admin: Admin, kind: OrgKind, id: string, profileId: string, role: OrgRole, actor: CurrentUser | null) {
  if (kind === "agency") await admin.from("org_members").delete().eq("org_kind", "agency").eq("profile_id", profileId).neq("org_id", id);
  const { error } = await admin.from("org_members").upsert({ org_kind: kind, org_id: id, profile_id: profileId, role }, { onConflict: "org_kind,org_id,profile_id" });
  if (error) throw new Error(error.message);
  if (!actor || actor.id !== profileId) void notify([profileId], "team_added", { company: await orgName(admin, kind, id), href: kind === "agency" ? "/team" : "/dev" });
  return { profileId };
}

/** Участие при регистрации по приглашению / одобрении заявки (роль по умолчанию, если не задана или неверна). */
export async function attachMember(kind: OrgKind, id: string, profileId: string, role: string | null | undefined) {
  const r = role && (ORG_ROLES[kind] as string[]).includes(role) ? (role as OrgRole) : DEFAULT_ORG_ROLE[kind];
  await addMemberFor(createAdminClient(), kind, id, profileId, r, null);
}
