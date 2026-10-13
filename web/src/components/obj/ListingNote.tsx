"use client";

// «Моя заметка» на странице объекта (13.10.2026): личный текст риэлтора, виден только ему; автосохранение через 800 мс
// после паузы и при уходе с поля; подсказка «Сохранено».
import { useEffect, useRef, useState } from "react";
import { IconNote } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { setNote, useNote } from "@/store/notes";

export function ListingNote({ id }: { id: string }) {
  const { t } = useI18n();
  const saved = useNote(id);
  const [val, setVal] = useState<{ id: string; text: string } | null>(null); // локальный черновик, пока печатают
  const [flash, setFlash] = useState(false);
  const timer = useRef<number>(0);
  const text = val && val.id === id ? val.text : saved;
  const commit = (v: string) => { setNote(id, v); setFlash(true); window.setTimeout(() => setFlash(false), 1500); };
  const onChange = (v: string) => { setVal({ id, text: v }); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => commit(v), 800); };
  useEffect(() => () => window.clearTimeout(timer.current), []);
  return (
    <div className="rounded-[18px] border border-[#f1e2a8] bg-[#fffbea] p-[18px]">
      <div className="mb-1 flex items-center gap-2 text-[15px] font-extrabold text-ink"><IconNote size={17} className="text-[#c98d00]" /> {t.obj.noteT}{flash && <span className="ml-auto text-[11.5px] font-semibold text-green">{t.obj.noteSaved}</span>}</div>
      <div className="mb-3 text-[12.5px] text-muted">{t.obj.noteS}</div>
      <textarea value={text} onChange={(e) => onChange(e.target.value)} onBlur={() => { window.clearTimeout(timer.current); commit(text); }} placeholder={t.obj.notePh} rows={3} className="w-full resize-y rounded-[12px] border border-[#ecdca0] bg-surface px-[13px] py-[10px] text-[14px] leading-[1.5] text-ink outline-none focus:border-[#c98d00]" />
    </div>
  );
}
