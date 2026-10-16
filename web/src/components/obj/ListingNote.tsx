"use client";

// «Личная заметка» на странице объекта (13.10.2026; доработано 16.10.2026 по документу пользователя): компактное поле на 2 строки,
// растёт по мере ввода; статус справа от заголовка — «Сохраняется…» → «✓ Сохранено, 23:54» → при ошибке «Не удалось сохранить ·
// Повторить» (текст остаётся); сохранение через 800 мс после паузы, при уходе с поля и при уходе со страницы. Кнопки нет.
import { useEffect, useRef, useState } from "react";
import { IconAlertTriangle, IconCheck, IconLoader2, IconNote } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { setNote, useNote } from "@/store/notes";

type St = { kind: "idle" } | { kind: "saving" } | { kind: "saved"; at: Date } | { kind: "error" };

export function ListingNote({ id }: { id: string }) {
  const { t, lang } = useI18n();
  const saved = useNote(id);
  const [draft, setDraft] = useState<{ id: string; text: string } | null>(null); // пока печатают
  const [st, setSt] = useState<St>({ kind: "idle" });
  const timer = useRef<number>(0);
  const ref = useRef<HTMLTextAreaElement>(null);
  const text = draft && draft.id === id ? draft.text : saved;
  const dirty = !!draft && draft.id === id && draft.text.trim() !== saved;
  const latest = useRef({ id, text, dirty });
  useEffect(() => { latest.current = { id, text, dirty }; }, [id, text, dirty]); // снимок для сохранения при размонтировании

  const grow = () => { const el = ref.current; if (!el) return; el.style.height = "auto"; el.style.height = `${Math.min(Math.max(el.scrollHeight, 56), 360)}px`; };
  useEffect(grow, [text]);

  const commit = async (v: string) => {
    window.clearTimeout(timer.current);
    if (v.trim() === saved && st.kind !== "error") return;
    setSt({ kind: "saving" });
    try { await setNote(id, v); setSt({ kind: "saved", at: new Date() }); setDraft(null); }
    catch { setSt({ kind: "error" }); }
  };
  const onChange = (v: string) => { setDraft({ id, text: v }); if (st.kind === "saved" || st.kind === "error") setSt({ kind: "idle" }); window.clearTimeout(timer.current); timer.current = window.setTimeout(() => void commit(v), 800); };
  // уход со страницы / смена объекта: несохранённый текст уезжает в базу
  useEffect(() => () => { window.clearTimeout(timer.current); const l = latest.current; if (l.dirty) void setNote(l.id, l.text); }, []);

  const time = (d: Date) => d.toLocaleTimeString(lang === "RU" ? "ru-RU" : lang === "TR" ? "tr-TR" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  return (
    <div className="rounded-[18px] border border-[#f1e2a8] bg-[#fffbea] px-[18px] py-[14px]">
      <div className="mb-2 flex items-center gap-2 text-[14px] font-extrabold text-ink">
        <IconNote size={16} className="text-[#c98d00]" /> {t.obj.noteT}
        <span className="text-[12px] font-medium text-muted">· {t.obj.noteOnlyYou}</span>
        <span className="ml-auto inline-flex items-center gap-1 text-[12px] font-semibold">
          {st.kind === "saving" && <span className="inline-flex items-center gap-1 text-muted"><IconLoader2 size={13} className="animate-spin" /> {t.obj.noteSaving}</span>}
          {st.kind === "saved" && <span className="inline-flex items-center gap-1 text-green"><IconCheck size={13} /> {t.obj.noteSaved}, {time(st.at)}</span>}
          {st.kind === "error" && <button type="button" onClick={() => void commit(text)} className="inline-flex cursor-pointer items-center gap-1 text-red hover:underline"><IconAlertTriangle size={13} /> {t.obj.noteErr} · {t.obj.noteRetry}</button>}
        </span>
      </div>
      <textarea ref={ref} value={text} onChange={(e) => onChange(e.target.value)} onBlur={() => void commit(text)} placeholder={t.obj.notePh} rows={2} className="block w-full resize-none overflow-hidden rounded-[12px] border border-[#ecdca0] bg-surface px-[13px] py-[9px] text-[14px] leading-[1.5] text-ink outline-none placeholder:text-muted-2 focus:border-[#c98d00]" />
    </div>
  );
}
