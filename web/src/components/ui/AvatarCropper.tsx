"use client";

// Кадрирование фото профиля (21.10.2026, просьба пользователя «чтобы аватарку можно было увеличивать, двигать»; образец —
// окно «Выберите область» мобильных приложений): круг на квадратной сцене, фото двигается пальцем/мышью, масштаб — щипком,
// колесом и ползунком, поворот на 90°, «Сбросить». Фото всегда накрывает круг (сдвиг и масштаб ограничены). На выходе —
// квадратный JPEG `out` px (512) с тем, что внутри круга. Окно — общий `Modal` (на телефоне шторка снизу, «назад» закрывает),
// шапка и подвал по стандарту форм (`data-modal-head` / `data-modal-foot`).
import { useEffect, useMemo, useRef, useState } from "react";
import { IconMinus, IconPlus, IconRotateClockwise2 } from "@tabler/icons-react";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { useI18n } from "@/i18n/provider";
import { showToast } from "@/components/ui/toast";

const MAX_ZOOM = 5;
const PAD = 18; // поле вокруг круга на сцене

type Img = { el: HTMLImageElement; url: string };
type View = { z: number; x: number; y: number; rot: number }; // z — множитель поверх «cover», x/y — сдвиг центра в px сцены, rot — 0/90/180/270

/** Загрузка файла в <img> (HEIC декодирует Safari; остальное — все браузеры). Большие снимки сначала уменьшаются до 2000 px. */
async function loadImage(file: File): Promise<Img> {
  const raw = URL.createObjectURL(file);
  const el = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => { URL.revokeObjectURL(raw); rej(new Error("decode")); }; i.src = raw; });
  const k = Math.min(1, 2000 / Math.max(el.naturalWidth, el.naturalHeight));
  if (k === 1) return { el, url: raw };
  const c = document.createElement("canvas"); c.width = Math.round(el.naturalWidth * k); c.height = Math.round(el.naturalHeight * k);
  c.getContext("2d")!.drawImage(el, 0, 0, c.width, c.height);
  const blob = await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.92));
  URL.revokeObjectURL(raw);
  const url = URL.createObjectURL(blob);
  const small = await new Promise<HTMLImageElement>((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = () => rej(new Error("decode")); i.src = url; });
  return { el: small, url };
}

export function AvatarCropper({ file, onDone, onCancel, out = 512 }: { file: File | null; onDone: (f: File) => void; onCancel: () => void; out?: number }) {
  const { t } = useI18n(); const c = t.crop;
  return (
    <Modal open={!!file} onClose={onCancel} width={420} z={650}>
      <div data-modal-head="1" className="mb-4 flex items-center justify-between gap-3">
        <div><div className="text-[18px] font-semibold text-ink">{c.title}</div><div className="text-[12.5px] text-muted">{c.hint}</div></div>
        <ModalClose onClick={onCancel} />
      </div>
      {file && <CropBody key={`${file.name}:${file.size}:${file.lastModified}`} file={file} onDone={onDone} onCancel={onCancel} out={out} />}
    </Modal>
  );
}

/** Тело окна: монтируется на каждый файл заново (key), поэтому состояние вида сбрасывается без setState в эффекте. */
function CropBody({ file, onDone, onCancel, out }: { file: File; onDone: (f: File) => void; onCancel: () => void; out: number }) {
  const { t } = useI18n(); const c = t.crop;
  const [img, setImg] = useState<Img | null>(null);
  const [err, setErr] = useState(false);
  const [view, setView] = useState<View>({ z: 1, x: 0, y: 0, rot: 0 });
  const [busy, setBusy] = useState(false);
  const stage = useRef<HTMLDivElement>(null);
  const [S, setS] = useState(320); // сторона сцены в px (меряется)
  const D = S - PAD * 2;           // диаметр круга

  useEffect(() => {
    let alive = true; let url = "";
    loadImage(file).then((im) => { if (!alive) { URL.revokeObjectURL(im.url); return; } url = im.url; setImg(im); }).catch(() => { if (alive) setErr(true); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [file]);
  useEffect(() => {
    const el = stage.current; if (!el) return;
    const ro = new ResizeObserver(() => setS(Math.round(el.getBoundingClientRect().width)));
    ro.observe(el); return () => ro.disconnect();
  }, [img]);

  // размеры картинки с учётом поворота и базовый масштаб «накрыть круг»
  const dims = useMemo(() => {
    if (!img) return { w: 1, h: 1, base: 1 };
    const sw = view.rot % 180 ? img.el.naturalHeight : img.el.naturalWidth, sh = view.rot % 180 ? img.el.naturalWidth : img.el.naturalHeight;
    return { w: sw, h: sh, base: D / Math.min(sw, sh) };
  }, [img, view.rot, D]);
  const scale = dims.base * view.z;
  /** Сдвиг ограничен так, чтобы круг всегда был внутри картинки. */
  const clamp = (v: View): View => {
    const sw = v.rot % 180 ? (img?.el.naturalHeight ?? 1) : (img?.el.naturalWidth ?? 1), sh = v.rot % 180 ? (img?.el.naturalWidth ?? 1) : (img?.el.naturalHeight ?? 1);
    const s = (D / Math.min(sw, sh)) * v.z;
    const mx = Math.max(0, (sw * s - D) / 2), my = Math.max(0, (sh * s - D) / 2);
    return { ...v, z: Math.min(MAX_ZOOM, Math.max(1, v.z)), x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  };
  const zoomAt = (factor: number, px = 0, py = 0) => setView((v) => {
    const nz = Math.min(MAX_ZOOM, Math.max(1, v.z * factor)); const k = nz / v.z;
    return clamp({ ...v, z: nz, x: px + (v.x - px) * k, y: py + (v.y - py) * k }); // точка под пальцем остаётся на месте
  });

  // жесты: один указатель — сдвиг, два — щипок (масштаб + сдвиг по середине), колесо — масштаб к курсору
  const ptrs = useRef(new Map<number, { x: number; y: number }>());
  const last = useRef<{ x: number; y: number; d: number } | null>(null);
  const center = () => { const r = stage.current!.getBoundingClientRect(); return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; };
  const onDown = (e: React.PointerEvent) => { (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY }); last.current = null; };
  const onMove = (e: React.PointerEvent) => {
    if (!ptrs.current.has(e.pointerId)) return;
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    const pts = [...ptrs.current.values()];
    if (pts.length === 1) {
      const p = pts[0]; const l = last.current;
      if (l) setView((v) => clamp({ ...v, x: v.x + (p.x - l.x), y: v.y + (p.y - l.y) }));
      last.current = { x: p.x, y: p.y, d: 0 };
    } else if (pts.length >= 2) {
      const [a, b] = pts; const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }; const d = Math.hypot(a.x - b.x, a.y - b.y);
      const l = last.current;
      if (l && l.d) {
        const { cx, cy } = center();
        setView((v) => {
          const nz = Math.min(MAX_ZOOM, Math.max(1, v.z * (d / l.d))); const k = nz / v.z; const px = mid.x - cx, py = mid.y - cy;
          return clamp({ ...v, z: nz, x: px + (v.x - px) * k + (mid.x - l.x), y: py + (v.y - py) * k + (mid.y - l.y) });
        });
      }
      last.current = { x: mid.x, y: mid.y, d };
    }
  };
  const onUp = (e: React.PointerEvent) => { ptrs.current.delete(e.pointerId); last.current = null; };
  const onWheel = (e: React.WheelEvent) => { const { cx, cy } = center(); zoomAt(Math.exp(-e.deltaY * 0.0025), e.clientX - cx, e.clientY - cy); }; // плавно, пропорционально прокрутке
  const rotate = () => setView((v) => clamp({ ...v, rot: (v.rot + 90) % 360 }));
  const reset = () => setView({ z: 1, x: 0, y: 0, rot: 0 });

  const done = async () => {
    if (!img) return;
    setBusy(true);
    try {
      const k = out / D; // px сцены → px результата
      const cv = document.createElement("canvas"); cv.width = out; cv.height = out;
      const ctx = cv.getContext("2d")!;
      ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, out, out);
      ctx.translate(out / 2 + view.x * k, out / 2 + view.y * k);
      ctx.rotate((view.rot * Math.PI) / 180);
      ctx.scale(scale * k, scale * k);
      ctx.drawImage(img.el, -img.el.naturalWidth / 2, -img.el.naturalHeight / 2);
      const blob = await new Promise<Blob>((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error("toBlob"))), "image/jpeg", 0.88));
      onDone(new File([blob], file.name.replace(/\.[^.]+$/, "") + ".jpg", { type: "image/jpeg" }));
    } catch { showToast(t.prof.photoErr); } finally { setBusy(false); }
  };

  return (
    <>
      <div ref={stage} className="relative mx-auto aspect-square w-full max-w-[372px] select-none overflow-hidden rounded-[14px] bg-[#0b1220]" style={{ touchAction: "none" }}
        onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onWheel={onWheel}>
        {img && (
          <div className="absolute left-1/2 top-1/2 will-change-transform" style={{ transform: `translate(${view.x}px, ${view.y}px) rotate(${view.rot}deg) scale(${scale})`, width: img.el.naturalWidth, height: img.el.naturalHeight, marginLeft: -img.el.naturalWidth / 2, marginTop: -img.el.naturalHeight / 2 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt="" draggable={false} className="block h-full w-full" />
          </div>
        )}
        {/* маска: тёмное поле с круглым окном */}
        <div className="pointer-events-none absolute rounded-full ring-1 ring-white/70" style={{ left: PAD, top: PAD, width: D, height: D, boxShadow: "0 0 0 9999px rgba(10,16,28,.62)" }} />
        {!img && <div className="absolute inset-0 flex items-center justify-center text-[13px] text-white/70">{err ? t.prof.photoErr : "…"}</div>}
      </div>
      <div className="mt-4 flex items-center gap-2">
        <button type="button" onClick={() => zoomAt(1 / 1.25)} aria-label="−" className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-[9px] border border-line text-ink hover:bg-bg-2"><IconMinus size={16} /></button>
        <input type="range" min={1} max={MAX_ZOOM} step={0.01} value={view.z} aria-label={c.zoom} onChange={(e) => setView((v) => clamp({ ...v, z: Number(e.target.value) }))} className="h-9 min-w-0 flex-1 cursor-pointer accent-blue-2" />
        <button type="button" onClick={() => zoomAt(1.25)} aria-label="+" className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-[9px] border border-line text-ink hover:bg-bg-2"><IconPlus size={16} /></button>
        <button type="button" onClick={rotate} title={c.rotate} aria-label={c.rotate} className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-[9px] border border-line text-ink hover:bg-bg-2"><IconRotateClockwise2 size={17} /></button>
      </div>
      <div data-modal-foot="1" className="mt-5 flex items-center gap-2">
        <button type="button" onClick={reset} disabled={!img} className="mr-auto cursor-pointer text-[12.5px] font-semibold text-muted hover:text-ink disabled:opacity-50 max-md:hidden">{c.reset}</button>
        <button type="button" onClick={onCancel} className="cursor-pointer rounded-[10px] border border-line bg-surface px-4 py-[9px] text-[13px] font-semibold text-text hover:bg-bg-2">{c.cancel}</button>
        <button type="button" onClick={done} disabled={!img || busy} className="cursor-pointer rounded-[10px] bg-blue-2 px-4 py-[9px] text-[13px] font-semibold text-white hover:bg-blue-3 disabled:opacity-60">{busy ? "…" : c.ok}</button>
      </div>
    </>
  );
}
