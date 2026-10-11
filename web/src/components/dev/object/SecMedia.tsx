"use client";

// `#sec-media` (507–527; данные 3711–3727, 4266–4272): сетка фото minmax(140px,1fr) 4/3 с drag&drop-сортировкой
// (мышь и тач-ручка), бейдж «Обложка», крестик, select категории (#cat= в пути), видео-плитки (vid:),
// кнопка добавления, поля промо-видео и LIVE. Drop файлов на секцию → добавление. Файлы грузятся в Storage
// (`dev/<id>/photos`), пока идёт загрузка — плитка со спиннером; в стор попадает публичный URL с `#cat=`.
import { useRef, useState, type DragEvent, type TouchEvent } from "react";
import { Select } from "@/components/ui/Select";
import { IconBrandYoutube, IconBroadcast, IconDragDrop, IconGripVertical, IconLoader2, IconPhoto, IconPlayerPlayFilled, IconPlus, IconX } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { CAT_OPTS } from "@/lib/dev/data";
import { isImage, isVideo, localPreview, revokePreview, uploadFiles } from "@/lib/upload";
import { showToast } from "@/components/ui/toast";
import { mutate, touch } from "@/store/dev";
import { DEFAULT_PHOTOS, SectionCard, eSet, photoUrl, pickFiles, splitPhoto, type EditObj } from "./shared";

type Pending = { id: string; preview: string; vid: boolean };
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const clearTiles = (sec: HTMLElement | null) => sec?.querySelectorAll<HTMLElement>("[data-oplph]").forEach((x) => { x.style.opacity = ""; x.style.transform = ""; x.style.boxShadow = ""; x.style.zIndex = ""; });

export function SecMedia({ obj }: { obj: EditObj }) {
  const { t } = useDevT();
  const cats = t.cats as Record<string, string>;
  const dragIdx = useRef<number | null>(null);
  const tIdx = useRef<number | null>(null);
  const photos = obj.photos;
  const [pending, setPending] = useState<Pending[]>([]);
  const setPhotos = (arr: string[]) => eSet(obj.id, { photos: arr });
  const addFiles = async (fs: File[]) => {
    const media = fs.filter((f) => isImage(f) || isVideo(f));
    if (!media.length) return;
    const items: Pending[] = media.map((f) => ({ id: uid(), preview: isVideo(f) ? "" : localPreview(f), vid: isVideo(f) }));
    setPending((p) => [...p, ...items]);
    const res = await uploadFiles(media, `dev/${obj.id}/photos`);
    const add = res.done.map((r) => (r.type.startsWith("video/") ? "vid:" : "") + r.url + "#cat=exterior");
    // Append to the *current* list (the user may have reordered while uploading).
    if (add.length) { mutate((st) => ({ ...st, projects: st.projects.map((p) => (p.id === obj.id ? { ...p, photos: [...(p.photos ?? DEFAULT_PHOTOS), ...add] } : p)) })); touch(); }
    items.forEach((it) => revokePreview(it.preview));
    setPending((p) => p.filter((x) => !items.some((it) => it.id === x.id)));
    if (res.failed.length) showToast(`${t.dx.upload_failed}${res.failed.length}`);
  };
  const move = (from: number, to: number) => { const arr = photos.slice(); const [mv] = arr.splice(from, 1); arr.splice(to, 0, mv); setPhotos(arr); };
  const secEl = () => document.getElementById("sec-media");

  const onDragStart = (i: number) => (e: DragEvent<HTMLDivElement>) => {
    dragIdx.current = i;
    const el = e.currentTarget;
    if (e.dataTransfer) { e.dataTransfer.effectAllowed = "move"; try { e.dataTransfer.setData("text/plain", String(i)); } catch {} }
    setTimeout(() => { el.style.opacity = ".35"; el.style.transform = "scale(.94)"; }, 0);
  };
  const onDragOver = (i: number) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = "move";
    if (dragIdx.current != null && dragIdx.current !== i) { const from = dragIdx.current; dragIdx.current = i; move(from, i); }
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => { const el = e.currentTarget; el.style.boxShadow = ""; el.style.transform = ""; el.style.zIndex = ""; };
  const onDragEnd = () => { dragIdx.current = null; clearTiles(secEl()); };
  const onDropTile = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); e.stopPropagation(); dragIdx.current = null; clearTiles(secEl()); };
  const onTouchStart = (i: number) => (e: TouchEvent<HTMLSpanElement>) => {
    tIdx.current = i;
    const tile = e.currentTarget.closest<HTMLElement>("[data-oplph]");
    if (tile) { tile.style.opacity = ".5"; tile.style.transform = "scale(.94)"; }
  };
  const onTouchMove = (e: TouchEvent<HTMLSpanElement>) => {
    if (tIdx.current == null) return;
    const tc = e.touches[0]; if (!tc) return;
    const el = document.elementFromPoint(tc.clientX, tc.clientY);
    const tile = el && el.closest ? el.closest<HTMLElement>("[data-oplph]") : null;
    if (tile) { const j = +(tile.getAttribute("data-oplph") || 0); if (j !== tIdx.current) { const from = tIdx.current; tIdx.current = j; move(from, j); } }
  };
  const onTouchEnd = () => { tIdx.current = null; clearTiles(secEl()); };
  const onSectionDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); addFiles(Array.from(e.dataTransfer?.files || [])); };

  const fieldCls = "flex items-center gap-[10px] rounded-[12px] border border-line py-[6px] pl-[14px] pr-[6px]";
  const fieldInput = "min-w-[120px] flex-1 border-none bg-transparent py-2 text-[14px] outline-none";
  return (
    <SectionCard id="sec-media" icon={<IconPhoto size={18} />} title={t.edp.nav_media} onDrop={onSectionDrop}
      after={<span className="rounded-[20px] bg-bg-2 px-[10px] py-[3px] text-[12px] font-bold text-text-2">{photos.length}</span>}>
      <div className="mb-4 grid gap-[10px]" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(140px,1fr))" }}>
        {photos.map((p, i) => {
          const { vid, raw, cat } = splitPhoto(p);
          const onCat = (v: string) => { const arr = photos.slice(); arr[i] = (vid ? "vid:" : "") + raw + "#cat=" + v; setPhotos(arr); };
          return (
            <div key={`${i}-${raw}`} draggable data-oplph={i} onDragStart={onDragStart(i)} onDragOver={onDragOver(i)} onDragLeave={onDragLeave} onDragEnd={onDragEnd} onDrop={onDropTile}
              className="relative aspect-[4/3] cursor-grab overflow-hidden rounded-[12px] bg-[#eee] transition-[transform,opacity,box-shadow] duration-150 hover:scale-[1.02] hover:shadow-[0_6px_16px_rgba(20,36,63,.18)]">
              <span onTouchStart={onTouchStart(i)} onTouchMove={onTouchMove} onTouchEnd={onTouchEnd} className="absolute bottom-[6px] right-[6px] z-[2] flex h-7 w-7 cursor-grab touch-none items-center justify-center rounded-[8px] bg-[rgba(255,255,255,.92)] text-[#5c6675]"><IconGripVertical size={16} /></span>
              {vid ? (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-ink text-white"><IconPlayerPlayFilled size={22} /><span className="text-[10px] font-bold opacity-70">VIDEO</span></div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={photoUrl(raw)} loading="lazy" alt="" className="h-full w-full object-cover" />
              )}
              {i === 0 && !vid && <span className="absolute left-[7px] top-[7px] rounded-[20px] bg-[rgba(20,36,63,.85)] px-[9px] py-[3px] text-[10px] font-bold text-white">{t.edp.cover}</span>}
              <span onClick={() => setPhotos(photos.filter((_, j) => j !== i))} className="absolute right-[7px] top-[7px] flex h-[22px] w-[22px] cursor-pointer items-center justify-center rounded-[7px] bg-[rgba(255,255,255,.92)] text-[13px] text-[#5c6675] hover:text-red"><IconX size={13} /></span>
              <Select value={cat} onChange={onCat} size="sm" menuWidth="auto" className="absolute bottom-[6px] left-[6px] max-w-[calc(100%-12px)] gap-1 rounded-[7px] border-none bg-[rgba(20,36,63,.78)] px-[6px] py-[3px] text-[10px] font-bold text-white [&_svg]:text-white" options={CAT_OPTS.map((k) => ({ value: k, label: cats[k] || k }))} />
            </div>
          );
        })}
        {pending.map((pd) => (
          <div key={pd.id} className="relative aspect-[4/3] overflow-hidden rounded-[12px] bg-[#eee]">
            {pd.vid ? (
              <div className="flex h-full w-full flex-col items-center justify-center gap-1 bg-ink text-white"><IconPlayerPlayFilled size={22} /><span className="text-[10px] font-bold opacity-70">VIDEO</span></div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={pd.preview} alt="" className="h-full w-full object-cover" />
            )}
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-1 bg-[rgba(255,255,255,.62)] text-blue"><IconLoader2 size={22} className="animate-spin" /><span className="text-[11px] font-semibold">{t.dx.uploading}</span></div>
          </div>
        ))}
        <div onClick={() => pickFiles("image/*,video/*", addFiles)} className="flex aspect-[4/3] cursor-pointer flex-col items-center justify-center gap-[5px] rounded-[12px] border-2 border-dashed border-[#cdd5e2] bg-[#fbfcfe] text-[12px] font-semibold text-blue hover:border-blue hover:bg-[#f5f8ff]"><IconPlus size={20} /> {t.btn_add_photo}</div>
      </div>
      <div className="mb-3 flex items-center gap-1 text-[12px] text-muted-2"><IconDragDrop size={14} /> {t.edp.drophint}</div>
      <div className={fieldCls}><IconBrandYoutube size={20} className="flex-none text-red" /><input value={obj.video || ""} onChange={(e) => eSet(obj.id, { video: e.target.value })} placeholder={t.edp.video_ph} className={fieldInput} /></div>
      <div className="mb-[7px] mt-4 flex items-center gap-2">
        <span className="inline-flex items-center gap-[5px] rounded-[20px] bg-red-tint px-2 py-[2px] text-[10px] font-extrabold text-red"><span className="h-[6px] w-[6px] rounded-full bg-red" />LIVE</span>
        <span className="text-[13px] font-semibold text-ink">{t.edp.live_field}</span>
      </div>
      <div className="mb-2 text-[12px] text-muted-2">{t.edp.live_sub}</div>
      <div className={fieldCls}><IconBroadcast size={20} className="flex-none text-red" /><input value={obj.live || ""} onChange={(e) => eSet(obj.id, { live: e.target.value })} placeholder={t.edp.live_ph} className={fieldInput} /></div>
    </SectionCard>
  );
}
