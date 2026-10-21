"use server";

// Организации и участники (12.10.2026, миграция 0022): одни действия для администратора платформы («Управление»),
// администратора агентства («Моё агентство», CRM → Команда) и администратора компании-застройщика (/dev/users).
// Право: администратор платформы — любая организация; администратор организации — своя (чтение — любой её участник).
// Запись идёт сервисным ключом ПОСЛЕ проверки права (RLS org_members разрешает запись только админу платформы).
import { revalidatePath } from "next/cache";
import { getCurrentUser, type CurrentUser } from "@/lib/auth";
import { sendTemplateMail } from "@/lib/mail";
import { notify } from "@/lib/notify";
import { DEFAULT_ORG_ROLE, isOrgAdminRole, ORG_ROLES, PLATFORM_ROLE_OF, type OrgInfo, type OrgInvite, type OrgKind, type OrgMember, type OrgRole, type OrgView } from "@/lib/org";
import { createAdminClient } from "@/lib/supabase/admin";
import { addMemberFor, orgName } from "@/lib/orgServer";

type Row = Record<string, unknown>;
const TABLE: Record<OrgKind, "agencies" | "developers"> = { agency: "agencies", developer: "developers" };
const INV_COL: Record<OrgKind, "agency_id" | "developer_id"> = { agency: "agency_id", developer: "developer_id" };
const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
const s = (v: unknown) => (v == null ? null : String(v));

async function me(): Promise<CurrentUser> {
  const u = await getCurrentUser();
  if (!u) throw new Error("unauthorized");
  return u;
}
/** Роль пользователя в организации (null — не участник). */
async function roleIn(admin: ReturnType<typeof createAdminClient>, kind: OrgKind, id: string, profileId: string): Promise<OrgRole | null> {
  const { data } = await admin.from("org_members").select("role").eq("org_kind", kind).eq("org_id", id).eq("profile_id", profileId).maybeSingle();
  return (data?.role as OrgRole) ?? null;
}
/** Участие с ролью и филиалом (null — не участник). */
async function memberOf(admin: ReturnType<typeof createAdminClient>, kind: OrgKind, id: string, profileId: string): Promise<{ role: OrgRole; branch: string | null } | null> {
  const { data } = await admin.from("org_members").select("role, branch_id").eq("org_kind", kind).eq("org_id", id).eq("profile_id", profileId).maybeSingle();
  return data ? { role: data.role as OrgRole, branch: s(data.branch_id) } : null;
}
/** Право управлять организацией: админ платформы или её администратор — всё (`full`); с `allowBranch` — ещё и руководитель
 *  филиала агентства, но только в пределах своего филиала (`branch`): добавляет/приглашает риэлторов в свой филиал, принимает
 *  в него риэлторов без филиала, исключает своих риэлторов. Роли и переводы между филиалами — только администратор (13.10.2026). */
async function manager(kind: OrgKind, id: string, allowBranch = false) {
  const u = await me();
  const admin = createAdminClient();
  if (u.role === "admin") return { u, admin, role: null as OrgRole | null, full: true, branch: null as string | null };
  const m = await memberOf(admin, kind, id, u.id);
  if (m && isOrgAdminRole(kind, m.role)) return { u, admin, role: m.role, full: true, branch: null as string | null };
  if (allowBranch && kind === "agency" && m?.role === "manager" && m.branch) return { u, admin, role: m.role, full: false, branch: m.branch };
  throw new Error("forbidden");
}
function assertRole(kind: OrgKind, role: string): asserts role is OrgRole {
  if (!(ORG_ROLES[kind] as string[]).includes(role)) throw new Error("bad-role");
}
async function adminsCount(admin: ReturnType<typeof createAdminClient>, kind: OrgKind, id: string) {
  const { count } = await admin.from("org_members").select("profile_id", { count: "exact", head: true }).eq("org_kind", kind).eq("org_id", id).eq("role", kind === "agency" ? "owner" : "admin");
  return count ?? 0;
}
const pathsOf = (kind: OrgKind, id: string) => ["/admin/users", "/admin/companies", `/admin/companies/${kind}/${id}`, "/team", "/dev/users"];
const touch = (kind: OrgKind, id: string) => pathsOf(kind, id).forEach((p) => revalidatePath(p));

/** Моя организация (для кабинета риэлтора / застройщика): агентство из profiles.agency_id, компания из profiles.developer_id. */
export async function myOrg(): Promise<{ kind: OrgKind; id: string; role: OrgRole | null } | null> {
  const u = await me();
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("agency_id, developer_id").eq("id", u.id).maybeSingle();
  const kind: OrgKind | null = u.role === "developer" ? "developer" : u.role === "realtor" ? "agency" : null;
  const id = kind === "developer" ? s(p?.developer_id) : kind === "agency" ? s(p?.agency_id) : null;
  if (!kind || !id) return null;
  return { kind, id, role: await roleIn(admin, kind, id, u.id) };
}

/** Карточка организации: реквизиты, участники с ролями, ожидающие приглашения, филиалы (агентство). */
export async function getOrg(kind: OrgKind, id: string): Promise<OrgView> {
  const u = await me();
  const admin = createAdminClient();
  const myM = u.role === "admin" ? null : await memberOf(admin, kind, id, u.id);
  const myRole = myM?.role ?? null;
  if (u.role !== "admin" && !myRole) throw new Error("forbidden");
  const scoped = kind === "agency" && myM?.role === "manager" && !!myM.branch; // руководитель филиала — управляет своим филиалом
  const canManage = u.role === "admin" || isOrgAdminRole(kind, myRole) || scoped;
  const manageBranch = u.role !== "admin" && !isOrgAdminRole(kind, myRole) && scoped ? myM!.branch : null;
  const [{ data: org }, { data: ms }, { data: inv }, { data: br }] = await Promise.all([
    admin.from(TABLE[kind]).select("*").eq("id", id).maybeSingle(),
    admin.from("org_members").select("profile_id, role, branch_id, created_at, profiles(id, name, email, phone, color, avatar_url, status, last_seen, paid_to, platform_staff)").eq("org_kind", kind).eq("org_id", id),
    admin.from("invites").select("code, email, name, org_role, role, created_at").eq(INV_COL[kind], id).is("used_by", null).order("created_at", { ascending: false }),
    kind === "agency" ? admin.from("crm_branches").select("id, name").eq("ws_kind", "agency").eq("ws_id", id).order("sort").order("name") : Promise.resolve({ data: [] as Row[] }),
  ]);
  if (!org) throw new Error("not-found");
  // объектов в базе у каждого риэлтора агентства (16.10.2026, «показывать сколько объектов у них»)
  const lstBy: Record<string, number> = {};
  if (kind === "agency" && ms?.length) {
    const { data: lst } = await admin.from("listings").select("owner_id").in("owner_id", (ms as Row[]).map((m) => String(m.profile_id))).neq("status", "sold");
    for (const l of lst ?? []) lstBy[l.owner_id as string] = (lstBy[l.owner_id as string] ?? 0) + 1;
  }
  const o = org as Row;
  const info: OrgInfo = { kind, id, name: String(o.name ?? ""), phone: s(o.phone), addr: s(o.addr), lic: s(o.lic), director: s(o.director), active: o.active !== false, until: s(o.access_until) };
  const members: OrgMember[] = ((ms ?? []) as Row[]).map((m) => {
    const p = (Array.isArray(m.profiles) ? m.profiles[0] : m.profiles) as Row | null;
    return {
      id: String(m.profile_id), name: String(p?.name ?? p?.email ?? "—"), email: s(p?.email), phone: s(p?.phone), color: String(p?.color ?? "#4d7cfe"),
      status: ((p?.status as OrgMember["status"]) ?? "active"), role: m.role as OrgRole, branchId: s(m.branch_id), lastSeen: s(p?.last_seen), paidTo: s(p?.paid_to),
      platformStaff: !!p?.platform_staff, joinedAt: String(m.created_at), listings: lstBy[String(m.profile_id)] ?? 0, avatar: s(p?.avatar_url),
    };
  }).sort((a, b) => (isOrgAdminRole(kind, b.role) ? 1 : 0) - (isOrgAdminRole(kind, a.role) ? 1 : 0) || a.name.localeCompare(b.name));
  const invites: OrgInvite[] = ((inv ?? []) as Row[]).map((i) => ({ code: String(i.code), email: s(i.email), name: s(i.name), role: ((i.org_role as OrgRole) ?? DEFAULT_ORG_ROLE[kind]), createdAt: String(i.created_at), url: `${siteUrl()}/join/${i.code}` }));
  return { org: info, members, invites, branches: ((br ?? []) as Row[]).map((b) => ({ id: String(b.id), name: String(b.name) })), canManage, manageBranch, meId: u.id };
}

/** Реквизиты организации (создание — только админ платформы; правка — и администратор организации). */
export async function saveOrg(kind: OrgKind, row: { id?: string; name: string; phone?: string | null; addr?: string | null; lic?: string | null; director?: string | null }): Promise<{ id: string }> {
  const u = await me();
  const admin = createAdminClient();
  if (!row.id && u.role !== "admin") throw new Error("forbidden");
  if (row.id) await manager(kind, row.id);
  const name = row.name.trim();
  if (!name) throw new Error("name");
  const base: Row = { name, phone: row.phone?.trim() || null, addr: row.addr?.trim() || null, lic: row.lic?.trim() || null };
  if (kind === "developer") base.director = row.director?.trim() || null;
  if (row.id) {
    const { error } = await admin.from(TABLE[kind]).update(base).eq("id", row.id);
    if (error) throw new Error(error.message);
    touch(kind, row.id);
    return { id: row.id };
  }
  const { data, error } = await admin.from(TABLE[kind]).insert(base).select("id").single();
  if (error) throw new Error(error.message);
  touch(kind, data.id as string);
  return { id: data.id as string };
}

/** Роль участника (последнего администратора снять нельзя). */
export async function setOrgRole(kind: OrgKind, id: string, profileId: string, role: string): Promise<void> {
  assertRole(kind, role);
  const { admin, u } = await manager(kind, id);
  const cur = await roleIn(admin, kind, id, profileId);
  if (!cur) throw new Error("not-member");
  if (isOrgAdminRole(kind, cur) && !isOrgAdminRole(kind, role) && (await adminsCount(admin, kind, id)) <= 1) throw new Error("last-admin");
  const { error } = await admin.from("org_members").update({ role }).eq("org_kind", kind).eq("org_id", id).eq("profile_id", profileId);
  if (error) throw new Error(error.message);
  if (profileId !== u.id) void notify([profileId], "role_changed", { role, org: await orgName(admin, kind, id), href: kind === "agency" ? "/team" : "/dev" });
  touch(kind, id);
}

/** Филиал участника (агентство, CRM). */
export async function setOrgBranch(kind: OrgKind, id: string, profileId: string, branchId: string | null): Promise<void> {
  const { admin, full, branch } = await manager(kind, id, true);
  if (!full) { const cur = await memberOf(admin, kind, id, profileId); if (!cur || cur.role !== "agent" || branchId !== branch || (cur.branch && cur.branch !== branch)) throw new Error("forbidden"); } // руководитель: только принять риэлтора без филиала в свой
  const { error } = await admin.from("org_members").update({ branch_id: branchId }).eq("org_kind", kind).eq("org_id", id).eq("profile_id", profileId);
  if (error) throw new Error(error.message);
  touch(kind, id);
}

/** Исключить из организации: риэлтор становится свободным агентом, сотрудник застройщика теряет доступ к компании. */
export async function removeOrgMember(kind: OrgKind, id: string, profileId: string): Promise<void> {
  const { admin, full, branch } = await manager(kind, id, true);
  const curM = await memberOf(admin, kind, id, profileId);
  if (!curM) return;
  const cur = curM.role;
  if (!full && (cur !== "agent" || curM.branch !== branch)) throw new Error("forbidden"); // руководитель — только риэлторов своего филиала
  if (isOrgAdminRole(kind, cur) && (await adminsCount(admin, kind, id)) <= 1) throw new Error("last-admin");
  const { error } = await admin.from("org_members").delete().eq("org_kind", kind).eq("org_id", id).eq("profile_id", profileId);
  if (error) throw new Error(error.message);
  touch(kind, id);
}

/** Добавить существующего пользователя по почте (риэлтор переходит из прежнего агентства). */
export async function addOrgMember(kind: OrgKind, id: string, email: string, role: string): Promise<{ profileId: string }> {
  assertRole(kind, role);
  const { admin, u, full, branch } = await manager(kind, id, true);
  if (!full && role !== "agent") throw new Error("forbidden"); // руководитель филиала добавляет только риэлторов — в свой филиал
  const { data: p } = await admin.from("profiles").select("id, role, name").ilike("email", email.trim()).maybeSingle();
  if (!p) throw new Error("no-user");
  if (p.role !== PLATFORM_ROLE_OF[kind]) throw new Error("wrong-type");
  const r = await addMemberFor(admin, kind, id, p.id as string, role, u, full ? null : branch);
  touch(kind, id);
  return r;
}
/** Приглашение в организацию: ссылка /join/<code> с ролью; с почтой — письмо через Resend. Для существующего
 *  пользователя — не приглашение, а добавление (`exists`). */
export async function inviteToOrg(kind: OrgKind, id: string, input: { email?: string; name?: string; role: string; lang?: "RU" | "EN" | "TR" }): Promise<{ code: string; url: string; mailed: boolean }> {
  assertRole(kind, input.role);
  const { admin, u, full, branch } = await manager(kind, id, true);
  if (!full && input.role !== "agent") throw new Error("forbidden");
  const email = input.email?.trim().toLowerCase() || null;
  if (email) {
    const { data: p } = await admin.from("profiles").select("id").ilike("email", email).maybeSingle();
    if (p) throw new Error("exists");
    const { data: old } = await admin.from("invites").select("code").eq(INV_COL[kind], id).ilike("email", email).is("used_by", null).maybeSingle();
    if (old) await admin.from("invites").delete().eq("code", old.code as string);
  }
  const code = "OPL-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const row: Row = { code, created_by: u.id, email, name: input.name?.trim() || null, role: PLATFORM_ROLE_OF[kind], org_role: input.role, [INV_COL[kind]]: id, ...(full ? {} : { branch_id: branch }) }; // филиал приглашения (0030) — колонка только у руководителя филиала, до миграции админов не ломает
  const { error } = await admin.from("invites").insert(row);
  if (error) throw new Error(error.message);
  const url = `${siteUrl()}/join/${code}`;
  const mailed = email ? await sendTemplateMail("join", input.lang ?? "RU", email, { link: url, name: input.name ?? "" }) : false;
  touch(kind, id);
  return { code, url, mailed };
}

export async function cancelInvite(code: string): Promise<void> {
  const u = await me();
  const admin = createAdminClient();
  const { data: inv } = await admin.from("invites").select("*").eq("code", code).maybeSingle();
  if (!inv || inv.used_by) return;
  const kind: OrgKind | null = inv.agency_id ? "agency" : inv.developer_id ? "developer" : null;
  if (u.role !== "admin") { if (!kind) throw new Error("forbidden"); const mm = await manager(kind, (inv.agency_id ?? inv.developer_id) as string, true); if (!mm.full && s(inv.branch_id) !== mm.branch) throw new Error("forbidden"); } // руководитель отзывает только приглашения своего филиала
  await admin.from("invites").delete().eq("code", code);
  if (kind) touch(kind, (inv.agency_id ?? inv.developer_id) as string); else revalidatePath("/admin/users");
}

/** Справочник организаций для выбора (админ платформы). */
export async function listOrgs(): Promise<{ agencies: { id: string; name: string }[]; developers: { id: string; name: string }[] }> {
  await me();
  const admin = createAdminClient();
  const [{ data: a }, { data: d }] = await Promise.all([admin.from("agencies").select("id, name").order("name"), admin.from("developers").select("id, name").order("name")]);
  return { agencies: ((a ?? []) as Row[]).map((x) => ({ id: String(x.id), name: String(x.name) })), developers: ((d ?? []) as Row[]).map((x) => ({ id: String(x.id), name: String(x.name) })) };
}

/** Филиалы агентства (crm_branches): создать / переименовать — администратор агентства или админ платформы (16.10.2026). */
export async function saveOrgBranch(id: string, input: { id?: string; name: string; city?: string }): Promise<void> {
  const { admin } = await manager("agency", id);
  const name = input.name.trim(); if (!name) throw new Error("bad-name");
  const row = { ws_kind: "agency", ws_id: id, name, city: input.city?.trim() || null };
  const { error } = input.id ? await admin.from("crm_branches").update(row).eq("id", input.id).eq("ws_id", id) : await admin.from("crm_branches").insert(row);
  if (error) throw new Error(error.message);
  touch("agency", id);
}
/** Удалить филиал: только пустой (без участников); клиенты/сделки филиала остаются без филиала (FK set null). */
export async function deleteOrgBranch(id: string, branchId: string): Promise<void> {
  const { admin } = await manager("agency", id);
  const { count } = await admin.from("org_members").select("profile_id", { count: "exact", head: true }).eq("org_kind", "agency").eq("org_id", id).eq("branch_id", branchId);
  if (count) throw new Error("branch-has-members");
  const { error } = await admin.from("crm_branches").delete().eq("id", branchId).eq("ws_kind", "agency").eq("ws_id", id);
  if (error) throw new Error(error.message);
  touch("agency", id);
}
