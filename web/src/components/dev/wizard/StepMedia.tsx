"use client";

// Step 1 «Фото и видео» — prototype lines 1849–1857: two drop-zones (photos / video). The video zone also
// takes a YouTube / Vimeo / LIVE link (goes to `project.video`). Picked files upload to Storage right away
// (`dev/new/<ts>/photos`) and show up as 96×72 tiles under the zone; the first photo becomes the cover.
import { IconBrandYoutube, IconCloudUpload, IconPhoto, IconVideo } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { showToast } from "@/components/ui/toast";
import { DropZone } from "./DropZone";
import { FileTiles } from "./FileTiles";
import { addWzFiles, removeWzFile, type WzFileStepProps } from "./wizardState";

export function StepMedia({ s, set, upd, folder }: WzFileStepProps) {
  const { t } = useDevT();
  const onErr = (n: number) => showToast(`${t.dx.upload_failed}${n}`);
  const add = (key: "photos" | "videos") => (files: File[]) => addWzFiles(files, `${folder}/photos`, (fn) => upd((x) => ({ ...x, [key]: fn(x[key]) })), onErr);
  const remove = (key: "photos" | "videos") => (id: string) => upd((x) => ({ ...x, [key]: removeWzFile(x[key], id) }));
  return (
    <>
      <p className="mb-5 text-[14px] text-text-2">{t.dx.wz_media_hint}</p>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
        <div>
          <label className="mb-2 flex items-center gap-1 text-[13px] font-semibold text-ink"><IconPhoto size={15} /> {t.gallery}</label>
          <DropZone icon={<IconCloudUpload size={24} />} title={t.wz.drop_photos} sub={t.wz.drop_photos_sub} accept="image/*" count={s.photos.length} onFiles={add("photos")} />
          <FileTiles items={s.photos} onRemove={remove("photos")} cover />
        </div>
        <div>
          <label className="mb-2 flex items-center gap-1 text-[13px] font-semibold text-ink"><IconVideo size={15} /> {t.dx.wz_video_lbl}</label>
          <DropZone icon={<IconBrandYoutube size={24} />} title={t.wz.drop_video} sub={t.wz.drop_video_sub} accept="video/*" count={s.videos.length} onFiles={add("videos")} />
          <FileTiles items={s.videos} onRemove={remove("videos")} />
          <input value={s.videoUrl} onChange={(e) => set({ videoUrl: e.target.value })} placeholder={t.dx.wz_video_url} className="mt-[10px] w-full rounded-[11px] border border-line bg-[#fbfcfe] px-[14px] py-3 text-[14px] outline-none focus:border-blue" />
        </div>
      </div>
    </>
  );
}
