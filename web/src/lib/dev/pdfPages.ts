"use client";

// Все страницы PDF → JPEG-файлы (pdf.js на клиенте; worker лежит в /public). JPEG, а не PNG: страница чертежа должна
// укладываться в лимит 5 МБ для ИИ-разметки. Обычные картинки возвращаются как есть.
// `maxW` 5000: лист всего здания (30+ квартир) при 2400px давал «мыльные» вырезки — квартира занимала ~60px.
// В ИИ при этом уходит уменьшенная копия (`planPayload`), так что на стоимость разметки размер не влияет.
export async function pdfToPageFiles(file: File, maxW = 5000): Promise<File[]> {
  const pdfjs = await import("pdfjs-dist");
  pdfjs.GlobalWorkerOptions.workerSrc = "/pdf.worker.min.mjs";
  const doc = await pdfjs.getDocument({ data: await file.arrayBuffer() }).promise;
  const base = file.name.replace(/\.pdf$/i, "");
  const out: File[] = [];
  for (let n = 1; n <= Math.min(doc.numPages, 40); n++) {
    const page = await doc.getPage(n);
    const vp0 = page.getViewport({ scale: 1 });
    const vp = page.getViewport({ scale: Math.min(8, Math.max(1, maxW / vp0.width)) });
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(vp.width); canvas.height = Math.round(vp.height);
    const ctx = canvas.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    await page.render({ canvasContext: ctx, viewport: vp }).promise;
    const blob = await new Promise<Blob>((res, rej) => canvas.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.9));
    out.push(new File([blob], `${base}${doc.numPages > 1 ? `-p${n}` : ""}.jpg`, { type: "image/jpeg" }));
  }
  return out;
}
/** Размер картинки в пикселях. */
export function imageSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { resolve({ w: img.naturalWidth, h: img.naturalHeight }); URL.revokeObjectURL(url); };
    img.onerror = () => { reject(new Error("image")); URL.revokeObjectURL(url); };
    img.src = url;
  });
}
/** Файл картинки → base64 для серверного экшена (уменьшает до `maxSide` и перекодирует в JPEG, чтобы уложиться в лимит). */
export async function fileToPayload(file: File, maxSide = 1800): Promise<{ data: string; mediaType: string }> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("image")); i.src = url; });
    const k = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const cv = document.createElement("canvas");
    cv.width = Math.round(img.naturalWidth * k); cv.height = Math.round(img.naturalHeight * k);
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, 0, 0, cv.width, cv.height);
    return { data: cv.toDataURL("image/jpeg", 0.85).split(",")[1], mediaType: "image/jpeg" };
  } finally { URL.revokeObjectURL(url); }
}

/** Вырезать вертикальную полосу картинки [x0..x1] (доли ширины) в JPEG-файл — часть общего листа для одного блока. */
export async function cropFileX(file: File, x0: number, x1: number, suffix: string): Promise<File> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("image")); i.src = url; });
    const sx = Math.round(img.naturalWidth * Math.max(0, x0)), sw = Math.round(img.naturalWidth * Math.min(1, x1)) - sx;
    const cv = document.createElement("canvas");
    cv.width = Math.max(1, sw); cv.height = img.naturalHeight;
    const ctx = cv.getContext("2d")!;
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, cv.width, cv.height);
    ctx.drawImage(img, sx, 0, sw, img.naturalHeight, 0, 0, sw, img.naturalHeight);
    const blob = await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.9));
    return new File([blob], file.name.replace(/\.(jpe?g|png|webp)$/i, "") + `-${suffix}.jpg`, { type: "image/jpeg" });
  } finally { URL.revokeObjectURL(url); }
}
