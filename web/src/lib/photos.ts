"use client";

// Фото объявлений: сжатие в браузере (до 1600 px, JPEG 0.82) и загрузка в Supabase Storage, bucket "photos"
// (публичное чтение, запись только в папку своего uid — политика из миграции 0001). Возвращает публичные URL.
import { createClient } from "@/lib/supabase/client";

export async function shrinkImage(src: string, max = 1600, q = 0.82): Promise<Blob> {
  const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = src; });
  const k = Math.min(1, max / Math.max(img.width, img.height));
  const c = document.createElement("canvas"); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
  c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
  return new Promise((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", q));
}

/** Файл изображения с телефона/компьютера (JPG/PNG/WebP/HEIC — HEIC декодирует Safari) → JPEG не больше `max` px.
 *  Для аватаров: 512 px; размер после сжатия — десятки КБ, лимиты на размер исходника не нужны (12.10.2026, «на телефоне не
 *  добавляется аватар» — iPhone отдаёт HEIC, который раньше отвергался проверкой типа). */
export async function toJpegFile(file: File, max = 512, q = 0.85): Promise<File> {
  const url = URL.createObjectURL(file);
  try { const blob = await shrinkImage(url, max, q); return new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }); }
  finally { URL.revokeObjectURL(url); }
}

/** data:-URL → загрузка; обычные URL (уже в хранилище или демо) возвращаются как есть. */
export async function uploadPhotos(uid: string, listingId: string, photos: string[]): Promise<string[]> {
  const sb = createClient();
  const out: string[] = [];
  for (let i = 0; i < photos.length; i++) {
    const p = photos[i];
    if (!p.startsWith("data:")) { out.push(p); continue; }
    const blob = await shrinkImage(p);
    const path = `${uid}/${listingId}/${Date.now()}-${i}.jpg`;
    const { error } = await sb.storage.from("photos").upload(path, blob, { contentType: "image/jpeg", upsert: true });
    if (error) throw new Error("photo upload: " + error.message);
    out.push(sb.storage.from("photos").getPublicUrl(path).data.publicUrl);
  }
  return out;
}
