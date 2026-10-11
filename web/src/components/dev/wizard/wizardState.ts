// State of the «Новый объект» wizard (prototype `state.addStep / wzClient / wzCoSearch / awTags / addComm`
// plus the file lists the prototype never kept). Step meta = `wzMeta` (line 3446).
// Files are uploaded to Supabase Storage as soon as they are picked (`dev/new/<ts>/…`, see `@/lib/upload`);
// each entry keeps a local preview while the upload is in flight and the public URL once it is done.
import type { DevDict } from "@/i18n/dev";
import type { PurposeTag, Stage } from "@/lib/dev/types";
import { isImage, isVideo, localPreview, revokePreview, uploadFile } from "@/lib/upload";

export type WzStepKey = "info" | "media" | "plans" | "docs" | "comm" | "done";

export type WzFile = {
  id: string;
  name: string;
  size: number;
  kind: "image" | "video" | "doc";
  /** Local blob URL for the thumbnail while uploading (revoked on remove). */
  preview: string;
  /** Public Storage URL (empty until `status === "done"`). */
  url: string;
  status: "uploading" | "done" | "error";
};

export type WzState = {
  step: number;
  client: number | null;
  coSearch: string;
  name: string;
  needName?: boolean; // «Создать» нажали без названия — подсветить поле на шаге 0
  stage: Stage;
  addr: string;
  mapLink: string;
  lng: string;
  lat: string;
  tags: PurposeTag[];
  photos: WzFile[];
  videos: WzFile[];
  videoUrl: string;
  floorPlans: WzFile[];
  layouts: WzFile[];
  docs: { present: WzFile[]; ruhsat: WzFile[]; price: WzFile[] };
  comm: boolean;
  commCount: string;
};

export const WZ_INITIAL: WzState = {
  step: 0, client: null, coSearch: "", name: "", stage: "project", addr: "", mapLink: "", lng: "", lat: "", tags: [],
  photos: [], videos: [], videoUrl: "", floorPlans: [], layouts: [], docs: { present: [], ruhsat: [], price: [] }, comm: false, commCount: "",
};

export type WzStepProps = { s: WzState; set: (patch: Partial<WzState>) => void };
/** Steps with uploads also get a functional updater (uploads finish asynchronously — a plain `set` would clobber). */
export type WzFileStepProps = WzStepProps & { upd: (fn: (s: WzState) => WzState) => void; folder: string };

export const WZ_KEYS: WzStepKey[] = ["info", "media", "plans", "docs", "comm", "done"];

/** «Folder» name of a step (Google-Drive folder the step replaces); empty for the review step. */
export function wzFolder(t: DevDict, k: WzStepKey): string {
  const dx = t.dx;
  return { info: dx.wz_folder_info, media: dx.wz_folder_media, plans: dx.wz_folder_plans, docs: dx.wz_folder_docs, comm: dx.wz_folder_comm, done: "" }[k];
}
export function wzLabel(t: DevDict, k: WzStepKey): string {
  return (t.wz as unknown as Record<string, string>)[`s_${k}`];
}

/** All file lists of the wizard, flattened. */
export const wzAllFiles = (s: WzState): WzFile[] => [...s.photos, ...s.videos, ...s.floorPlans, ...s.layouts, ...s.docs.present, ...s.docs.ruhsat, ...s.docs.price];

type ListMut = (fn: (list: WzFile[]) => WzFile[]) => void;

/**
 * Add picked files to a list and start uploading them (3 at a time). Entries appear immediately with a local preview
 * and `status: "uploading"`; each one flips to `done` (public URL) or `error`. `onError` gets the failed count once.
 */
export function addWzFiles(files: File[], folder: string, mut: ListMut, onError: (failed: number, message: string) => void) {
  if (!files.length) return;
  const items: WzFile[] = files.map((f) => ({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    name: f.name, size: f.size,
    kind: isImage(f) ? "image" : isVideo(f) ? "video" : "doc",
    preview: isImage(f) || isVideo(f) ? localPreview(f) : "",
    url: "", status: "uploading",
  }));
  mut((list) => [...list, ...items]);
  let next = 0, failed = 0, firstMsg = "";
  const worker = async () => {
    while (next < files.length) {
      const i = next++;
      const it = items[i];
      try {
        const r = await uploadFile(files[i], folder);
        mut((list) => list.map((x) => (x.id === it.id ? { ...x, url: r.url, status: "done" } : x)));
      } catch (e) {
        failed++;
        if (!firstMsg) firstMsg = e instanceof Error ? e.message : String(e);
        mut((list) => list.map((x) => (x.id === it.id ? { ...x, status: "error" } : x)));
      }
    }
  };
  void Promise.all(Array.from({ length: Math.min(3, files.length) }, worker)).then(() => { if (failed) onError(failed, firstMsg); });
}

/** Remove an entry (and free its local preview). */
export function removeWzFile(list: WzFile[], id: string): WzFile[] {
  const it = list.find((x) => x.id === id);
  if (it?.preview) revokePreview(it.preview);
  return list.filter((x) => x.id !== id);
}
