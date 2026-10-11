"use client";

// Dashed drop-zone of the wizard (prototype lines 1853–1867): click opens a file picker (`pickFiles`, 2809),
// drag-and-drop is accepted too. Shows the number of chosen files under the hint; `onFiles` gets only the
// newly picked files (the step starts their upload and keeps the list).
import { useRef, useState, type ReactNode } from "react";
import { useDevT } from "@/i18n/dev";

export function DropZone({ icon, title, sub, accept, count, onFiles }: { icon: ReactNode; title: string; sub: string; accept: string; count: number; onFiles: (f: File[]) => void }) {
  const { t } = useDevT();
  const inp = useRef<HTMLInputElement>(null);
  const [over, setOver] = useState(false);
  const add = (list: FileList | null) => { if (list && list.length) onFiles(Array.from(list)); };
  return (
    <div
      onClick={() => inp.current?.click()}
      onDragOver={(e) => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); add(e.dataTransfer.files); }}
      className={`cursor-pointer rounded-[16px] border-2 border-dashed px-5 py-8 text-center hover:border-blue hover:bg-[#f5f8ff] ${over ? "border-blue bg-[#f5f8ff]" : "border-[#cdd5e2] bg-[#fbfcfe]"}`}
    >
      <input ref={inp} type="file" multiple accept={accept} className="hidden" onChange={(e) => { add(e.target.files); e.target.value = ""; }} />
      <div className="mx-auto mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-[14px] bg-blue-tint text-[24px] text-blue">{icon}</div>
      <div className="text-[15px] font-semibold text-ink">{title}</div>
      <div className="mt-1 text-[12px] text-muted">{sub}</div>
      {count > 0 && <div className="mt-[10px] inline-flex items-center gap-[6px] rounded-[20px] bg-green-tint px-[10px] py-[3px] text-[12px] font-bold text-green">{count} {t.dx.wz_files}</div>}
    </div>
  );
}
