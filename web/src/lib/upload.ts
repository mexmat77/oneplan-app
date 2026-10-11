"use client";

// Клиентская загрузка файлов кабинета застройщика в Supabase Storage (bucket `media`, публичный).
// Схема: серверный экшен `createUploadUrl(path)` выдаёт подписанный URL → браузер кладёт файл напрямую
// (`uploadToSignedUrl`) → в стор попадает постоянный публичный URL. Без Supabase-env — демо-режим:
// `URL.createObjectURL` (картинка живёт до перезагрузки), чтобы UI не ломался.
import { createUploadUrl } from "@/app/(dev)/dev/upload-actions";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";

export type Uploaded = { url: string; name: string; size: number; type: string };
export type UploadBatch = { done: Uploaded[]; failed: { file: File; error: Error }[] };

const BUCKET = "media";
const CONCURRENCY = 3;

/** Имя файла в Storage: только латиница/цифры/точка/дефис (кириллица и пробелы → `-`), расширение сохраняется. */
export function safeName(name: string): string {
  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot + 1) : "";
  const clean = (s: string) => s.normalize("NFKD").replace(/[^A-Za-z0-9-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);
  const b = clean(base) || "file";
  const e = clean(ext).toLowerCase();
  return e ? `${b}.${e}` : b;
}

const rnd = () => Math.random().toString(36).slice(2, 8);

/** Временный локальный URL для превью (пока файл грузится / демо-режим). */
export const localPreview = (file: File): string => URL.createObjectURL(file);
export const revokePreview = (url: string) => { if (url.startsWith("blob:")) URL.revokeObjectURL(url); };

/** Загрузить один файл в `folder` (например `dev/12/photos`); возвращает публичный URL. */
export async function uploadFile(file: File, folder: string): Promise<Uploaded> {
  const name = file.name;
  const size = file.size;
  const type = file.type;
  if (!hasSupabaseEnv()) return { url: localPreview(file), name, size, type };
  const path = `${folder.replace(/^\/+|\/+$/g, "")}/${Date.now()}-${rnd()}-${safeName(name)}`;
  const ticket = await createUploadUrl(path);
  const supabase = createClient();
  const { error } = await supabase.storage.from(BUCKET).uploadToSignedUrl(ticket.path, ticket.token, file, { contentType: file.type || "application/octet-stream", upsert: false });
  if (error) throw new Error(error.message || "upload failed");
  return { url: ticket.publicUrl, name, size, type };
}

/** Загрузить несколько файлов (до 3 параллельно), порядок результата = порядок `files`. Ошибки не прерывают остальные. */
export async function uploadFiles(files: File[], folder: string, onProgress?: (done: number, total: number) => void): Promise<UploadBatch> {
  const total = files.length;
  const results: (Uploaded | null)[] = new Array(total).fill(null);
  const failed: UploadBatch["failed"] = [];
  let next = 0, finished = 0;
  const worker = async () => {
    while (next < total) {
      const i = next++;
      const file = files[i];
      try { results[i] = await uploadFile(file, folder); }
      catch (e) { failed.push({ file, error: e instanceof Error ? e : new Error(String(e)) }); }
      finished++;
      onProgress?.(finished, total);
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, total) }, worker));
  return { done: results.filter((x): x is Uploaded => x !== null), failed };
}

/** Текст ошибки для тоста: первое сообщение из пачки. */
export const uploadErrorText = (b: UploadBatch): string => b.failed[0]?.error.message || "";

/** Подпись файла в списке документов: `PDF · 1.2 MB` (прототип `addDocFiles`, 2816). */
export const fmtSize = (b: number) => (b >= 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`);
export const fileLabel = (name: string, size: number) => `${(name.split(".").pop() || "").toUpperCase()} · ${fmtSize(size)}`;
export const isImage = (f: File) => f.type.startsWith("image/");
export const isVideo = (f: File) => f.type.startsWith("video/");
