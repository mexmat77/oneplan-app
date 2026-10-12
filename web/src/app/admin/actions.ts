"use server";

import { revalidatePath } from "next/cache";
import { sendTemplateMail } from "@/lib/mail";
import { notify, notifyAdmins } from "@/lib/notify";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

export type Role = "admin" | "realtor" | "developer";
export type Status = "pending" | "active" | "paused";
export type UserInput = {
  email: string; password?: string; name: string; phone?: string; role: Role; status?: Status;
  agency_id?: string | null; agency_text?: string | null; developer_id?: string | null; dev_role?: string | null; paid_to?: string | null;
  developer_ids?: string[]; platform_staff?: boolean;
  agency_role?: "owner" | "manager" | "agent" | null; // роль в CRM агентства (crm_members, 0017)
  lang?: "RU" | "EN" | "TR"; // язык письма-приглашения (user metadata `lang`, читают шаблоны Supabase Auth)
};

async function requireAdmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Не авторизован");
  const { data: p } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  if (p?.role !== "admin") throw new Error("Нет прав администратора");
  return user;
}

function profilePatch(i: Partial<UserInput>) {
  const patch: Record<string, unknown> = {};
  for (const k of ["name", "phone", "role", "status", "agency_id", "agency_text", "developer_id", "dev_role", "paid_to", "platform_staff"] as const) {
    if (k in i) patch[k] = (i as Record<string, unknown>)[k] ?? null;
  }
  if ("paid_to" in patch && !patch.paid_to) patch.paid_to = null;
  if (i.developer_ids) patch.developer_id = i.developer_ids[0] ?? null; // primary company
  return patch;
}

// Multi-company access for developer staff (editors/managers may work with several developers).
async function syncMembers(admin: ReturnType<typeof createAdminClient>, id: string, ids?: string[]) {
  if (!ids) return;
  await admin.from("developer_members").delete().eq("profile_id", id);
  if (ids.length) {
    const { error } = await admin.from("developer_members").insert(ids.map((developer_id) => ({ profile_id: id, developer_id })));
    if (error) throw new Error(error.message);
  }
}

/** Роль риэлтора в CRM агентства (владелец / руководитель филиала / агент) — crm_members для ws агентства. */
async function syncAgencyRole(admin: ReturnType<typeof createAdminClient>, id: string, agencyId: string | null, role: "owner" | "manager" | "agent" | null) {
  if (!agencyId) { await admin.from("crm_members").delete().eq("profile_id", id).eq("ws_kind", "agency"); return; }
  await admin.from("crm_members").delete().eq("profile_id", id).eq("ws_kind", "agency").neq("ws_id", agencyId);
  if (!role) return;
  const { error } = await admin.from("crm_members").upsert({ ws_kind: "agency", ws_id: agencyId, profile_id: id, role }, { onConflict: "ws_kind,ws_id,profile_id" });
  if (error) throw new Error(error.message);
}

const siteUrl = () => process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

// Create an account directly (with a password) or send Supabase's invite e-mail (user sets the password from the link).
export async function createUser(input: UserInput): Promise<{ id: string }> {
  await requireAdmin();
  const admin = createAdminClient();
  const meta = { name: input.name, phone: input.phone ?? "", lang: input.lang ?? "RU" };
  let id: string;
  if (input.password) {
    const { data, error } = await admin.auth.admin.createUser({ email: input.email, password: input.password, email_confirm: true, user_metadata: meta });
    if (error) throw new Error(error.message);
    id = data.user.id;
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(input.email, { data: meta, redirectTo: `${siteUrl()}/auth/callback` });
    if (error) throw new Error(error.message);
    id = data.user.id;
  }
  const { error } = await admin.from("profiles").upsert({ id, email: input.email, ...profilePatch({ ...input, status: input.status ?? "active" }) });
  if (error) throw new Error(error.message);
  await syncMembers(admin, id, input.role === "developer" ? input.developer_ids : []);
  revalidatePath("/admin/users");
  if (input.agency_role !== undefined) await syncAgencyRole(admin, id, input.agency_id ?? null, input.agency_role);
  return { id };
}

export async function updateUser(id: string, patch: Partial<UserInput>) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: before } = patch.status ? await admin.from("profiles").select("status").eq("id", id).maybeSingle() : { data: null };
  const { error } = await admin.from("profiles").update(profilePatch(patch)).eq("id", id);
  if (!error && patch.agency_role !== undefined) await syncAgencyRole(admin, id, patch.agency_id ?? null, patch.agency_role);
  if (error) throw new Error(error.message);
  if (patch.status === "active" && before && before.status !== "active") void notify([id], "access_restored");
  if (patch.role === "developer" && patch.developer_ids?.length) {
    const { data: co } = await admin.from("developers").select("name").eq("id", patch.developer_ids[0]).maybeSingle();
    void notify([id], "team_added", { company: (co?.name as string) ?? "" });
  }
  await syncMembers(admin, id, patch.role === "developer" ? patch.developer_ids : patch.role ? [] : undefined);
  if (patch.email) {
    // Touch Auth only when the address actually changed (the Admin API needs the service_role key).
    const { data: cur } = await admin.from("profiles").select("email").eq("id", id).maybeSingle();
    if ((cur?.email ?? "").toLowerCase() !== patch.email.toLowerCase()) {
      const { error: e2 } = await admin.auth.admin.updateUserById(id, { email: patch.email, email_confirm: true });
      if (e2) throw new Error(e2.message === "User not allowed" ? "Auth API отклонил запрос: в .env.local в SUPABASE_SERVICE_ROLE_KEY должен быть ключ service_role (сейчас — anon)" : e2.message);
      await admin.from("profiles").update({ email: patch.email }).eq("id", id);
    }
  }
  revalidatePath("/admin/users");
}

export async function setUserPassword(id: string, password: string) {
  await requireAdmin();
  const { error } = await createAdminClient().auth.admin.updateUserById(id, { password });
  if (error) throw new Error(error.message);
}

export async function deleteUser(id: string) {
  const me = await requireAdmin();
  if (me.id === id) throw new Error("Нельзя удалить самого себя");
  const { error } = await createAdminClient().auth.admin.deleteUser(id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
}

// Access request → real account (invite e-mail so the person picks a password), request marked accepted.
export async function approveRequest(requestId: string, role: Role = "realtor") {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: r, error } = await admin.from("access_requests").select("*").eq("id", requestId).single();
  if (error || !r) throw new Error(error?.message ?? "Заявка не найдена");
  const { data, error: e1 } = await admin.auth.admin.inviteUserByEmail(r.email, { data: { name: r.name, phone: r.phone, lang: r.lang ?? "RU" }, redirectTo: `${siteUrl()}/auth/callback` });
  if (e1) throw new Error(e1.message);
  await admin.from("profiles").upsert({ id: data.user.id, email: r.email, name: r.name, phone: r.phone, role, status: "active", agency_text: r.agency ?? r.company ?? null });
  await admin.from("access_requests").update({ status: "accepted" }).eq("id", requestId);
  void notify([data.user.id], "access_approved");
  revalidatePath("/admin/requests");
  revalidatePath("/admin/users");
}

// Заявка с главной страницы (таблица `leads`, форма лендинга) → такой же аккаунт с письмом-приглашением; заявка помечается обработанной.
export async function approveLead(leadId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: r, error } = await admin.from("leads").select("*").eq("id", leadId).single();
  if (error || !r) throw new Error(error?.message ?? "Заявка не найдена");
  const role: Role = r.role === "d" ? "developer" : "realtor";
  const { data, error: e1 } = await admin.auth.admin.inviteUserByEmail(r.email, { data: { name: r.name, phone: r.phone, lang: r.lang ?? "RU" }, redirectTo: `${siteUrl()}/auth/callback` });
  if (e1) throw new Error(e1.message);
  await admin.from("profiles").upsert({ id: data.user.id, email: r.email, name: r.name, phone: r.phone, role, status: "active", agency_text: r.company || null });
  await admin.from("leads").update({ handled: true }).eq("id", leadId);
  void notify([data.user.id], "access_approved");
  revalidatePath("/admin/requests");
  revalidatePath("/admin/users");
}

export async function declineLead(leadId: string) {
  await requireAdmin();
  await createAdminClient().from("leads").update({ handled: true }).eq("id", leadId);
  revalidatePath("/admin/requests");
}

// Обращение «Восстановление доступа» (kind = unblock): профиль по почте → статус active, заявка — принята.
export async function restoreAccess(requestId: string) {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: r, error } = await admin.from("access_requests").select("id, email").eq("id", requestId).single();
  if (error || !r) throw new Error(error?.message ?? "Обращение не найдено");
  const { data: p } = await admin.from("profiles").select("id").ilike("email", r.email).maybeSingle();
  if (!p) throw new Error("Пользователь с этой почтой не найден");
  const { error: e2 } = await admin.from("profiles").update({ status: "active" }).eq("id", p.id);
  if (e2) throw new Error(e2.message);
  await admin.from("access_requests").update({ status: "accepted" }).eq("id", requestId);
  void notify([p.id], "access_restored");
  revalidatePath("/admin/requests"); revalidatePath("/admin/users"); revalidatePath("/rls");
}

export async function declineRequest(requestId: string) {
  await requireAdmin();
  await createAdminClient().from("access_requests").update({ status: "rejected" }).eq("id", requestId);
  revalidatePath("/admin/requests");
}

// Ссылка-приглашение /join/<code>; если указана почта — отправляем письмо со ссылкой (Resend) на языке админа.
export async function createInvite(input: { role: Role; email?: string; agency_id?: string | null; developer_id?: string | null; lang?: "RU" | "EN" | "TR" }) {
  const me = await requireAdmin();
  const code = "OPL-" + Math.random().toString(36).slice(2, 8).toUpperCase();
  const { error } = await createAdminClient().from("invites").insert({ code, created_by: me.id, email: input.email ?? null, role: input.role, agency_id: input.agency_id ?? null, developer_id: input.developer_id ?? null });
  if (error) throw new Error(error.message);
  revalidatePath("/admin/users");
  const url = `${siteUrl()}/join/${code}`;
  const mailed = input.email ? await sendTemplateMail("join", input.lang ?? "RU", input.email, { link: url }) : false;
  return { code, url, mailed };
}

// Повторное письмо-приглашение существующему пользователю: ссылка на установку пароля (recovery) через наш домен и Resend.
export async function resendInvite(userId: string, lang?: "RU" | "EN" | "TR") {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: p, error } = await admin.from("profiles").select("email, name").eq("id", userId).single();
  if (error || !p?.email) throw new Error(error?.message ?? "У пользователя нет почты");
  const { data: u } = await admin.auth.admin.getUserById(userId);
  const userLang = (u?.user?.user_metadata?.lang as "RU" | "EN" | "TR" | undefined) ?? lang ?? "RU";
  const { data, error: e2 } = await admin.auth.admin.generateLink({ type: "recovery", email: p.email, options: { redirectTo: `${siteUrl()}/auth/callback` } });
  if (e2) throw new Error(e2.message);
  const link = `${siteUrl()}/auth/callback?token_hash=${data.properties.hashed_token}&type=recovery`;
  const ok = await sendTemplateMail("invite", userLang, p.email, { link, name: p.name ?? "" });
  if (!ok) throw new Error("Письмо не отправлено: проверьте RESEND_API_KEY на сервере");
}

// Жалоба разобрана / возвращена в работу (вкладка «Жалобы» в «Управлении» и на /rls).
export async function setReportStatus(id: string, status: "new" | "done") {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: rep } = await admin.from("reports").select("from_id, listing_title").eq("id", id).maybeSingle();
  const { error } = await admin.from("reports").update({ status, handled_at: status === "done" ? new Date().toISOString() : null }).eq("id", id);
  if (error) throw new Error(error.message);
  if (status === "done" && rep?.from_id) void notify([rep.from_id as string], "report_resolved", { title: (rep.listing_title as string) ?? "" });
  revalidatePath("/admin/reports");
  revalidatePath("/rls");
}

export async function saveCompany(kind: "agencies" | "developers", row: { id?: string; name: string; phone?: string | null; addr?: string | null; lic?: string | null }) {
  await requireAdmin();
  const admin = createAdminClient();
  const { id, ...rest } = row;
  const { error } = id ? await admin.from(kind).update(rest).eq("id", id) : await admin.from(kind).insert(rest);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/companies");
}

export async function deleteCompany(kind: "agencies" | "developers", id: string) {
  await requireAdmin();
  const { error } = await createAdminClient().from(kind).delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/admin/companies");
}

// Public: register through an invite link.
// Публичные данные приглашения для страницы /join/<code>: почта (если письмо ушло на неё — поле фиксируется), роль, компания.
export async function inviteInfo(code: string): Promise<{ ok: boolean; email: string | null; role: Role | null; company: string | null }> {
  const admin = createAdminClient();
  const { data: inv } = await admin.from("invites").select("email, role, used_by, agency_id, developer_id").eq("code", code).maybeSingle();
  if (!inv || inv.used_by) return { ok: false, email: null, role: null, company: null };
  let company: string | null = null;
  if (inv.agency_id) company = (await admin.from("agencies").select("name").eq("id", inv.agency_id).maybeSingle()).data?.name ?? null;
  if (inv.developer_id) company = (await admin.from("developers").select("name").eq("id", inv.developer_id).maybeSingle()).data?.name ?? null;
  return { ok: true, email: inv.email ?? null, role: (inv.role as Role) ?? null, company };
}

export async function registerByInvite(input: { code: string; name: string; phone: string; email: string; password: string; agency?: string; lang?: "RU" | "EN" | "TR" }) {
  const admin = createAdminClient();
  const { data: inv } = await admin.from("invites").select("*").eq("code", input.code).maybeSingle();
  if (!inv || inv.used_by) throw new Error("Приглашение недействительно");
  const email = (inv.email as string | null) || input.email; // письмо ушло на конкретный адрес — регистрируем именно его
  const { data, error } = await admin.auth.admin.createUser({ email, password: input.password, email_confirm: true, user_metadata: { name: input.name, phone: input.phone, lang: input.lang ?? "RU" } });
  if (error) throw new Error(error.message);
  await admin.from("profiles").upsert({ id: data.user.id, email, name: input.name, phone: input.phone, role: inv.role ?? "realtor", status: "active", agency_id: inv.agency_id ?? null, developer_id: inv.developer_id ?? null, agency_text: (input.agency ?? "").trim() || null });
  await admin.from("invites").update({ used_by: data.user.id }).eq("code", input.code);
  void notifyAdmins("join_registered", { name: input.name, email });
  if (inv.created_by) void notify([inv.created_by as string], "invite_accepted", { name: input.name });
  return { ok: true };
}
