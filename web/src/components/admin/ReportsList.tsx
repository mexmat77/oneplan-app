"use client";

// Список жалоб для админа (разметка — вкладка «Жалобы» прототипа /rls, строки 854–881): карточка объявления по снимку,
// статус Новая/Разобрана, причина + текст, «от кого · дата», «Открыть объявление», «Разобрано / Вернуть».
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useI18n } from "@/i18n/provider";
import { fmt } from "@/lib/money";
import type { Currency } from "@/lib/types";
import { setReportStatus } from "@/app/admin/actions";
import type { ReportRow } from "@/lib/reports";

export function ReportsList({ rows, embedded = false }: { rows: ReportRow[]; embedded?: boolean }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const list = [...rows].sort((a, b) => (a.status === "new" ? 0 : 1) - (b.status === "new" ? 0 : 1));
  const toggle = (r: ReportRow) => { setErr(""); start(async () => { try { await setReportStatus(r.id, r.status === "new" ? "done" : "new"); router.refresh(); } catch (e) { setErr((e as Error).message); } }); };
  const date = (iso: string) => new Date(iso).toLocaleDateString(lang === "RU" ? "ru-RU" : lang === "TR" ? "tr-TR" : "en-GB");

  return (
    <>
      {!embedded && <p className="mb-[14px] text-[13px] text-text-2 [text-wrap:pretty]">{t.rl.rpSub}</p>}
      {err && <div className="mb-3 rounded-[11px] bg-red-tint px-[13px] py-[11px] text-[12.5px] text-red-2">{err}</div>}
      {list.length === 0 && <div className="rounded-[14px] border border-dashed border-[#dfe4ec] bg-surface p-[26px] text-center text-[13px] text-muted">{t.rl.rpEmpty}</div>}
      <div className="flex flex-col gap-[10px]">
        {list.map((r) => {
          const href = r.listing_ref ? `/obj/${r.listing_ref}` : "#";
          const reason = (t.obj.rptR as Record<string, string>)[r.reason] ?? r.reason;
          return (
            <div key={r.id} className="flex flex-wrap items-start gap-[13px] rounded-[14px] border border-line bg-surface px-4 py-[14px]">
              <Link href={href} className="h-14 w-[74px] flex-none rounded-[10px] bg-line-2 bg-cover bg-center hover:brightness-90" style={{ backgroundImage: r.listing_photo ? `url('${r.listing_photo}')` : undefined }} />
              <div className="min-w-[220px] flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  <Link href={href} className="text-[13.5px] font-bold text-ink hover:text-blue-2">{r.listing_title || "—"}</Link>
                  {r.listing_price != null && <span className="text-[12px] text-muted">{fmt(Number(r.listing_price), (r.listing_cur || "TRY") as Currency)}</span>}
                  {r.listing_owner && <span className="text-[12px] text-muted">· {r.listing_owner}</span>}
                  <span className={`flex-none rounded-[8px] px-[9px] py-[3px] text-[10.5px] font-extrabold uppercase tracking-[.04em] ${r.status === "new" ? "bg-red-tint text-red" : "bg-green-tint-2 text-green-4"}`}>{r.status === "new" ? t.rl.rpNew : t.rl.rpDone}</span>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="rounded-[8px] bg-[#fff4e5] px-[9px] py-[3px] text-[11.5px] font-bold text-warn-3">{reason}</span>
                  {r.text && <span className="text-[12.5px] text-text">«{r.text}»</span>}
                </div>
                <div className="mt-[5px] text-[11.5px] text-muted">{r.from_name || "—"} · {date(r.created_at)}{r.handled_at ? ` · ${t.rl.rpDone.toLowerCase()} ${date(r.handled_at)}` : ""}</div>
              </div>
              <div className="flex flex-none items-center gap-2">
                <Link href={href} className="rounded-[9px] border border-line bg-surface px-[13px] py-2 text-[12px] font-bold text-ink hover:border-blue hover:text-blue">{t.reqs.openObj}</Link>
                <button type="button" disabled={pending} onClick={() => toggle(r)} className={`flex-none cursor-pointer rounded-[9px] px-[13px] py-2 text-[12px] font-bold hover:brightness-95 disabled:opacity-60 ${r.status === "new" ? "bg-green-4 text-white" : "border border-line bg-surface text-text"}`}>{r.status === "new" ? t.rl.rpDoneB : t.rl.rpReopen}</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
