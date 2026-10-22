"use server";

// Загрузка файлов кабинета застройщика в Supabase Storage (публичный bucket `media`).
// Клиент (`@/lib/upload`) просит подписанный URL для конкретного пути, затем кладёт файл напрямую в Storage
// через `uploadToSignedUrl` — сервисный ключ в браузер не попадает. Экшен доступен только вошедшим
// пользователям (в development с `DEV_AUTH_BYPASS=1` — как и `proxy.ts` — проверка сессии пропускается).
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

const BUCKET = "media";
const NET_ERR = "Нет соединения с хранилищем файлов — проверьте интернет и повторите";
const isNetErr = (e: unknown) => { const m = e instanceof Error ? e.message : String(e ?? ""); return /fetch failed|ENOTFOUND|ECONNRESET|ECONNREFUSED|ETIMEDOUT|network|UND_ERR/i.test(m); };
export type UploadTicket = { token: string; path: string; publicUrl: string };

// `dev/<objId|new>/<subfolder>/<file>` — латиница/цифры/точка/дефис/подчёркивание, без `..` и ведущего `/`.
const PATH_RE = /^dev\/[a-z0-9_-]+(?:\/[a-z0-9_-]+){1,2}\/[A-Za-z0-9._-]{1,180}$/;

export async function createUploadUrl(path: string): Promise<UploadTicket> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    throw new Error("Supabase не настроен: заполните NEXT_PUBLIC_SUPABASE_URL и NEXT_PUBLIC_SUPABASE_ANON_KEY в web/.env.local");
  }
  if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Загрузка файлов недоступна: SUPABASE_SERVICE_ROLE_KEY не задан в web/.env.local");
  }
  if (typeof path !== "string" || !PATH_RE.test(path) || path.includes("..")) {
    throw new Error("Недопустимый путь файла");
  }
  const bypass = process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";
  const admin = createAdminClient();
  if (!bypass) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Требуется вход в аккаунт");
    // папка — только своя (аудит 23.10.2026): аватар в dev/avatars/<свой uid>/…, файлы объекта — участнику его компании
    const [, folder, sub] = path.split("/");
    if (folder === "avatars") {
      if (sub !== user.id) throw new Error("Недопустимый путь файла");
    } else if (folder !== "new") {
      const { data: obj } = await admin.from("dev_objects").select("developer_id").eq("id", Number(folder)).maybeSingle();
      const devId = (obj?.developer_id as string | undefined) ?? null;
      const [{ data: prof }, { data: mem }] = await Promise.all([
        admin.from("profiles").select("role, developer_id").eq("id", user.id).maybeSingle(),
        devId ? admin.from("org_members").select("profile_id").eq("org_kind", "developer").eq("org_id", devId).eq("profile_id", user.id).maybeSingle() : Promise.resolve({ data: null }),
      ]);
      const ok = prof?.role === "admin" || (!!devId && (mem || prof?.developer_id === devId)) || (!obj && prof?.role === "developer");
      if (!ok) throw new Error("Нет доступа к этому объекту");
    } else {
      const { data: prof } = await admin.from("profiles").select("role").eq("id", user.id).maybeSingle();
      if (prof?.role !== "developer" && prof?.role !== "admin") throw new Error("Нет доступа");
    }
  }
  let res: Awaited<ReturnType<ReturnType<typeof admin.storage.from>["createSignedUploadUrl"]>>;
  try {
    res = await admin.storage.from(BUCKET).createSignedUploadUrl(path);
  } catch (e) {
    // Сервер не достучался до Supabase (нет интернета, DNS, таймаут) — supabase-js бросает голое «fetch failed».
    throw new Error(isNetErr(e) ? NET_ERR : e instanceof Error && e.message ? e.message : "Не удалось подготовить загрузку");
  }
  const { data, error } = res;
  if (error || !data) throw new Error(isNetErr(error) ? NET_ERR : error?.message || "Не удалось подготовить загрузку");
  const publicUrl = admin.storage.from(BUCKET).getPublicUrl(data.path).data.publicUrl;
  return { token: data.token, path: data.path, publicUrl };
}
