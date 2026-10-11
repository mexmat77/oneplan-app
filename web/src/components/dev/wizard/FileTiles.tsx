"use client";

// Превью выбранных файлов мастера: сетка плиток 96×72 (radius 9, #eef1f5 — как превью типов планировок 1725),
// картинка / тёмная видео-плитка / документ с иконкой и расширением; спиннер пока файл грузится, красная рамка
// при ошибке, бейдж «Обложка» на первой фотографии, крестик удаления, подпись с именем файла.
import { IconAlertTriangle, IconFile, IconFileTypePdf, IconLoader2, IconPlayerPlayFilled, IconPresentation, IconTable, IconX } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import type { WzFile } from "./wizardState";

function DocIcon({ name }: { name: string }) {
  const ext = (name.split(".").pop() || "").toLowerCase();
  if (ext === "pdf") return <IconFileTypePdf size={22} />;
  if (["xls", "xlsx", "csv"].includes(ext)) return <IconTable size={22} />;
  if (["ppt", "pptx"].includes(ext)) return <IconPresentation size={22} />;
  return <IconFile size={22} />;
}

export function FileTiles({ items, onRemove, cover = false }: { items: WzFile[]; onRemove: (id: string) => void; cover?: boolean }) {
  const { t } = useDevT();
  if (!items.length) return null;
  return (
    <div className="mt-3 flex flex-wrap gap-[10px]" onClick={(e) => e.stopPropagation()}>
      {items.map((f, i) => {
        const ext = (f.name.split(".").pop() || "").toUpperCase();
        const busy = f.status === "uploading";
        const err = f.status === "error";
        const src = f.kind === "image" ? (f.url || f.preview) : "";
        return (
          <div key={f.id} className="w-[96px]" title={err ? t.dx.upload_retry : f.name}>
            <div className={`relative h-[72px] w-[96px] overflow-hidden rounded-[9px] bg-[#eef1f5] ${err ? "ring-2 ring-red" : ""}`}>
              {f.kind === "image" && src && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={src} alt="" className="h-full w-full object-cover" />
              )}
              {f.kind === "video" && (
                <div className="flex h-full w-full flex-col items-center justify-center gap-[2px] bg-ink text-white"><IconPlayerPlayFilled size={18} /><span className="text-[9px] font-bold opacity-70">VIDEO</span></div>
              )}
              {f.kind === "doc" && (
                <div className="flex h-full w-full flex-col items-center justify-center gap-[3px] text-muted"><DocIcon name={f.name} /><span className="text-[9.5px] font-extrabold tracking-[.04em]">{ext}</span></div>
              )}
              {busy && (
                <div className="absolute inset-0 flex items-center justify-center bg-[rgba(255,255,255,.62)] text-blue"><IconLoader2 size={20} className="animate-spin" /></div>
              )}
              {err && (
                <div className="absolute inset-0 flex items-center justify-center bg-[rgba(255,255,255,.7)] text-red"><IconAlertTriangle size={20} /></div>
              )}
              {cover && i === 0 && f.kind === "image" && !err && (
                <span className="absolute bottom-[5px] left-[5px] rounded-[20px] bg-[rgba(20,36,63,.85)] px-[7px] py-[2px] text-[9px] font-bold text-white">{t.dx.wz_cover}</span>
              )}
              <span onClick={(e) => { e.stopPropagation(); onRemove(f.id); }} className="absolute right-[4px] top-[4px] flex h-[18px] w-[18px] cursor-pointer items-center justify-center rounded-[6px] bg-[rgba(255,255,255,.92)] text-[#5c6675] hover:text-red"><IconX size={11} /></span>
            </div>
            <div className="mt-1 overflow-hidden text-ellipsis whitespace-nowrap text-[10.5px] text-muted">{busy ? t.dx.uploading : f.name}</div>
          </div>
        );
      })}
    </div>
  );
}
