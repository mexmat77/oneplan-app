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
  if (!bypass) {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Требуется вход в аккаунт");
  }
  const admin = createAdminClient();
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
