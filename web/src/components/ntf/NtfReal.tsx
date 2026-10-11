"use client";

// «Уведомления» на реальных данных (таблица notifications): группы Сегодня / Вчера / Ранее, «прочитать все», «очистить»,
// клик по строке отмечает прочитанным и ведёт по ссылке события.
import { confirmDialog } from "@/components/ui/confirm";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { IconBellOff, IconChecks, IconTrash } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { NtfIcon } from "@/components/ntf/NtfIcon";
import { dayOf, renderNtf, useNotifs, type NtfDict } from "@/lib/notifications/client";

const STEP = 8;

export function NtfReal({ me }: { me: string }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { rows, loaded, unread, markRead, markAll, clearAll } = useNotifs(me);
  const [shown, setShown] = useState<Record<string, number>>({});
  const dict = t.ntfk as unknown as NtfDict;
  const items = rows.map((r) => renderNtf(r, dict));
  const groups = (["today", "yest", "earlier"] as const).map((d) => ({ key: d, label: d === "today" ? t.ntf.today : d === "yest" ? t.ntf.yest : t.ntf.earlier, list: items.filter((n) => dayOf(n.at) === d) })).filter((g) => g.list.length);
  const time = (d: Date) => d.toLocaleTimeString(lang === "RU" ? "ru-RU" : lang === "TR" ? "tr-TR" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  const more = lang === "RU" ? "Показать ещё " : lang === "TR" ? "Daha göster: " : "Show ";

  return (
    <div className="mx-auto max-w-[700px]">
      <div className="mb-[18px] flex flex-wrap items-center gap-3">
        <h1 className="flex-1 text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.ntf.title}{unread > 0 && <span className="ml-2 rounded-[9px] bg-red px-2 py-[2px] align-middle text-[12px] font-bold text-white">{unread}</span>}</h1>
        {rows.length > 0 && <button type="button" onClick={() => void markAll()} className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-blue hover:text-blue-2"><IconChecks size={15} /> {t.ntf.mark}</button>}
        {rows.length > 0 && <button type="button" onClick={() => void confirmDialog({ text: t.ntf.clear + "?", ok: t.ntf.clear, danger: true }).then((ok) => { if (ok) void clearAll(); })} className="inline-flex cursor-pointer items-center gap-1 text-[13px] font-semibold text-muted hover:text-red"><IconTrash size={15} /> {t.ntf.clear}</button>}
      </div>
      {loaded && rows.length === 0 && (
        <div className="rounded-[16px] border border-dashed border-[#dfe4ec] bg-surface px-5 py-[34px] text-center text-muted">
          <span className="mx-auto mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-blue-tint text-blue"><IconBellOff size={24} /></span>
          <div className="text-[14px] font-bold text-ink">{t.ntf.empty}</div>
        </div>
      )}
      {groups.map((g) => {
        const n = shown[g.key] ?? STEP;
        const rest = g.list.length - n;
        return (
          <div key={g.key}>
            <div className="mb-2 mt-[18px] text-[12px] font-bold uppercase tracking-[.06em] text-muted">{g.label}</div>
            <div className="overflow-hidden rounded-[16px] border border-line bg-surface">
              {g.list.slice(0, n).map((x) => (
                <div key={x.id} onClick={() => { void markRead([x.id]); if (x.href) router.push(x.href); }} className={`flex cursor-pointer gap-3 border-b border-[#f5f7fb] px-[17px] py-[14px] hover:bg-bg-5 ${x.unread ? "bg-[#f8faff]" : ""}`}>
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: x.bg, color: x.tone }}><NtfIcon icon={x.icon} /></span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] font-semibold leading-[1.45] text-ink">{x.title}</div>
                    {x.sub && <div className="mt-[2px] text-[12.5px] text-muted [overflow-wrap:anywhere]">{x.sub}</div>}
                  </div>
                  <div className="flex flex-none flex-col items-end gap-1"><span className="text-[11.5px] text-muted-2">{time(x.at)}</span>{x.unread && <span className="h-2 w-2 rounded-full bg-blue" />}</div>
                </div>
              ))}
              {rest > 0 && <button type="button" onClick={() => setShown((s) => ({ ...s, [g.key]: n + STEP }))} className="w-full cursor-pointer bg-[#f8faff] p-[13px] text-center text-[13px] font-bold text-blue-2 hover:bg-blue-tint">{more}{Math.min(rest, STEP)}{lang === "EN" ? " more" : ""} · {g.list.length}</button>}
            </div>
          </div>
        );
      })}
    </div>
  );
}
