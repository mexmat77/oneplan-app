"use client";

// `#sec-prog` (545–558; данные 3728–3733, 4275–4276): дневник стройки — поле + «Добавить» (запись
// `{d:'07.2026', t, ph:[…]}` в начало), таймлайн: дата, значок видео, крестик, редактируемый текст,
// миниатюры 82×60 (клик → лайтбокс), кнопка добавления медиа. Медиа грузятся в Storage (`dev/<id>/diary`),
// на время загрузки — миниатюра со спиннером.
import { useState } from "react";
import { IconCameraPlus, IconCrane, IconLoader2, IconPlayerPlayFilled, IconPlus, IconVideo, IconX } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import type { ProgressEntry } from "@/lib/dev/types";
import { isImage, isVideo, localPreview, revokePreview, uploadFiles } from "@/lib/upload";
import { showToast } from "@/components/ui/toast";
import { mutate, touch } from "@/store/dev";
import { DEFAULT_PROG, SectionCard, eSet, inputCls, photoUrl, pickFiles, type EditObj } from "./shared";

type Pending = { id: string; entry: number; preview: string; vid: boolean };
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function SecProg({ obj, onLightbox }: { obj: EditObj; onLightbox: (list: string[], idx: number) => void }) {
  const { t } = useDevT();
  const [text, setText] = useState("");
  const prog = obj.prog;
  const setProg = (list: ProgressEntry[]) => eSet(obj.id, { prog: list });
  const addProg = () => { const v = text.trim(); if (!v) return; setProg([{ d: "07.2026", t: v, ph: ["photo-1541888946425-d81bb19240f5"] }, ...prog]); setText(""); };
  const patch = (i: number, p: Partial<ProgressEntry>) => setProg(prog.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const [pending, setPending] = useState<Pending[]>([]);
  const addMedia = async (i: number, fs: File[]) => {
    const media = fs.filter((f) => isImage(f) || isVideo(f));
    if (!media.length) return;
    const items: Pending[] = media.map((f) => ({ id: uid(), entry: i, preview: isVideo(f) ? "" : localPreview(f), vid: isVideo(f) }));
    setPending((p) => [...p, ...items]);
    const res = await uploadFiles(media, `dev/${obj.id}/diary`);
    const add = res.done.map((r) => (r.type.startsWith("video/") ? "vid:" : "") + r.url);
    if (add.length) { mutate((st) => ({ ...st, projects: st.projects.map((p) => (p.id === obj.id ? { ...p, prog: (p.prog ?? DEFAULT_PROG).map((x, j) => (j === i ? { ...x, ph: [...(x.ph || []), ...add] } : x)) } : p)) })); touch(); }
    items.forEach((it) => revokePreview(it.preview));
    setPending((p) => p.filter((x) => !items.some((it) => it.id === x.id)));
    if (res.failed.length) showToast(`${t.dx.upload_failed}${res.failed.length}`);
  };
  return (
    <SectionCard id="sec-prog" icon={<IconCrane size={18} />} title={t.edp.nav_prog} headClass="mb-4" after={<span className="text-[12px] text-muted-2">· {t.dev.reports_hint}</span>}>
      <div className="mb-[18px] flex gap-[10px]">
        <input value={text} onChange={(e) => setText(e.target.value)} placeholder={t.edp.add_ph} className={`${inputCls} min-w-[140px] flex-1`} />
        <button type="button" onClick={addProg} className="inline-flex cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[11px] border border-ink bg-ink px-4 py-[10px] text-[13px] font-semibold text-white"><IconPlus size={15} /> {t.btn_add}</button>
      </div>
      {prog.map((pr, i) => {
        const items = (pr.ph || []).map((id) => { const vid = String(id).startsWith("vid:"); const raw = vid ? id.slice(4) : id; return { vid, src: photoUrl(raw, "?w=200&h=150&fit=crop"), full: photoUrl(raw, "?w=1600&fit=max") }; });
        const imgs = items.filter((x) => !x.vid).map((x) => x.full);
        const busy = pending.filter((x) => x.entry === i);
        return (
          <div key={i} className="flex gap-3">
            <div className="flex w-3 flex-none flex-col items-center"><span className="mt-[5px] h-[11px] w-[11px] flex-none rounded-full bg-blue" />{i < prog.length - 1 && <span className="mt-[3px] w-[2px] flex-1 bg-line" />}</div>
            <div className="flex-1 pb-4">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12px] font-bold text-muted">{pr.d}</span>
                {items.some((x) => x.vid) && <span title="video" className="text-[14px] text-muted"><IconVideo size={14} /></span>}
                <span onClick={() => setProg(prog.filter((_, j) => j !== i))} className="ml-auto cursor-pointer text-[14px] text-[#c3c9d4] hover:text-red"><IconX size={14} /></span>
              </div>
              <input value={pr.t} onChange={(e) => patch(i, { t: e.target.value })} className="ml-[-6px] mt-[2px] w-[calc(100%+6px)] rounded-[8px] border border-transparent bg-transparent px-[6px] py-[3px] font-[inherit] text-[14.5px] text-ink-2 outline-none focus:border-blue focus:bg-surface" />
              {(items.length > 0 || busy.length > 0) && (
                <div className="mt-2 flex flex-wrap gap-[6px]">
                  {items.map((th, k) => th.vid ? (
                    <div key={k} className="flex h-[60px] w-[82px] items-center justify-center rounded-[8px] bg-ink text-white"><IconPlayerPlayFilled size={16} /></div>
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img key={k} src={th.src} loading="lazy" alt="" onClick={() => onLightbox(imgs, imgs.indexOf(th.full))} className="h-[60px] w-[82px] cursor-zoom-in rounded-[8px] object-cover" />
                  ))}
                  {busy.map((pd) => (
                    <div key={pd.id} className="relative h-[60px] w-[82px] overflow-hidden rounded-[8px] bg-[#eee]">
                      {pd.vid ? <div className="flex h-full w-full items-center justify-center bg-ink text-white"><IconPlayerPlayFilled size={16} /></div>
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img src={pd.preview} alt="" className="h-full w-full object-cover" />}
                      <div className="absolute inset-0 flex items-center justify-center bg-[rgba(255,255,255,.62)] text-blue"><IconLoader2 size={18} className="animate-spin" /></div>
                    </div>
                  ))}
                  <div onClick={() => pickFiles("image/*,video/*", (fs) => addMedia(i, fs))} title={t.btn_add_photo} className="flex h-[60px] w-[82px] cursor-pointer items-center justify-center rounded-[8px] border-[1.5px] border-dashed border-[#cdd5e2] text-[16px] text-muted hover:border-blue hover:text-blue"><IconCameraPlus size={16} /></div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </SectionCard>
  );
}
