"use client";

// Модалка предпросмотра импорта (`impOpen`, 1764–1789; данные 4006–4009): имя файла, ошибка чтения,
// «изменений нет», либо список «№ num: поле from → to» и кнопка «Применить · N».
import { IconAlertTriangle, IconArrowRight, IconChecks, IconFileSpreadsheet, IconX } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { useEscape, useScrollLock } from "@/hooks/useScrollLock";
import { money } from "@/lib/dev/data";
import type { Cur } from "@/lib/dev/types";
import type { ImportRow } from "@/lib/dev/xlsx";

export type ImportState = { file: string; rows: ImportRow[] | null }; // rows null = ошибка чтения

export function ImportPreviewModal({ imp, cur, onApply, onClose }: { imp: ImportState; cur: Cur; onApply: () => void; onClose: () => void }) {
  const { t } = useDevT();
  useScrollLock(true);
  useEscape(true, onClose);
  const status = t.status as Record<string, string>;
  const err = imp.rows === null;
  const rows = imp.rows || [];
  const fmt = (f: ImportRow["ch"][number]["f"], v: number | string) => (f === "status" ? status[v] || String(v) : f === "price" ? money(Number(v), cur) : String(v));
  const label = (f: ImportRow["ch"][number]["f"]) => (f === "price" ? t.f_price : f === "area" ? t.f_area : f === "type" ? t.f_rooms : t.f_status);
  return (
    <div onClick={onClose} className="fixed inset-0 z-[95] flex items-center justify-center bg-[rgba(15,23,42,.55)] p-[14px]">
      <div onClick={(e) => e.stopPropagation()} className="flex max-h-[88vh] w-[560px] max-w-[96vw] flex-col overflow-hidden rounded-[18px] bg-surface">
        <div className="flex flex-none items-center gap-[10px] border-b border-[#eef0f4] px-[22px] pb-[13px] pt-4">
          <div className="min-w-0 flex-1">
            <h3 className="text-[19px] font-extrabold text-ink">{t.io_preview_title}</h3>
            <div className="flex items-center gap-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-muted"><IconFileSpreadsheet size={14} className="flex-none" />{imp.file}</div>
          </div>
          <span onClick={onClose} className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[10px] bg-bg-2 text-text-2"><IconX size={17} /></span>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-[22px] py-4">
          {err && (
            <div className="flex items-start gap-[10px] rounded-[11px] border border-[#f5c6c6] bg-red-tint px-[15px] py-[13px]"><IconAlertTriangle size={17} className="mt-[1px] flex-none text-[#c53030]" /><p className="m-0 text-[13.5px] leading-[1.5] text-[#a12626]">{t.io_preview_err}</p></div>
          )}
          {!err && rows.length === 0 && (
            <div className="px-[10px] py-[30px] text-center text-[14px] text-muted"><IconChecks size={26} className="mx-auto mb-2 block text-[#b6bdc8]" />{t.io_preview_none}</div>
          )}
          {rows.length > 0 && (
            <>
              <div className="mb-3 text-[13px] text-text-2">{t.io_preview_sub}</div>
              {rows.map((r) => (
                <div key={r.uid} className="mb-2 rounded-[11px] border border-line px-[13px] py-[10px]">
                  <div className="mb-1 text-[14px] font-extrabold text-ink">№ {r.num}</div>
                  {r.ch.map((c) => (
                    <div key={c.f} className="mt-[3px] flex flex-wrap items-center gap-2 text-[13px]">
                      <span className="min-w-[80px] text-muted">{label(c.f)}</span>
                      <span className="text-[#c53030] line-through">{fmt(c.f, c.from)}</span>
                      <IconArrowRight size={12} className="text-[#9aa1ac]" />
                      <span className="font-bold text-green">{fmt(c.f, c.to)}</span>
                    </div>
                  ))}
                </div>
              ))}
            </>
          )}
        </div>
        <div className="flex flex-none justify-end gap-[10px] border-t border-[#eef0f4] px-[22px] py-[13px]">
          <button type="button" onClick={onClose} className="cursor-pointer rounded-[10px] border border-line bg-surface px-[18px] py-[11px] text-[14px] font-bold text-ink-2">{t.m_cancel}</button>
          {rows.length > 0 && <button type="button" onClick={onApply} className="cursor-pointer rounded-[10px] border-none bg-green px-5 py-[11px] text-[14px] font-bold text-white">{t.io_apply} · {rows.length}</button>}
        </div>
      </div>
    </div>
  );
}
