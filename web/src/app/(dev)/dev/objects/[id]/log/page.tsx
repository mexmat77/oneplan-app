"use client";

// Вкладка «Журнал» (прототип 835–866; данные 3103–3123; спецификация §1.10, §5.2): демо-сид при первом
// открытии, список newest-first, пагинация по 20, чип «№ num» → вкладка планировок с открытой квартирой.
import { useParams, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconArrowRight, IconChevronLeft, IconChevronRight, IconHistory, IconUser } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { money } from "@/lib/dev/data";
import { LOGPP, buildLogSeed, fmtLogD } from "@/lib/dev/log";
import { seedLog, useDev } from "@/store/dev";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const objId = Number(id);
  const { t, lang } = useDevT();
  const router = useRouter();
  const s = useDev();
  const obj = s.projects.find((p) => p.id === objId);
  const unitList = s.units[objId];
  const log = s.log[objId];
  const [page, setPage] = useState(0);
  const status = t.status as Record<string, string>;

  // Сид журнала (3104): только при первом заходе и только если есть юниты.
  useEffect(() => { if (log === undefined && unitList?.length) seedLog(objId, buildLogSeed(unitList)); }, [log, unitList, objId]);
  if (!obj) return null;

  const cur = obj.cur || "EUR";
  const all = log ?? [];
  const pages = Math.max(1, Math.ceil(all.length / LOGPP));
  const cp = Math.min(page, pages - 1);
  const from = cp * LOGPP;
  const view = all.slice(from, from + LOGPP);
  const navBtn = (dis: boolean) => `inline-flex h-[34px] w-[34px] items-center justify-center rounded-[9px] border border-line bg-surface ${dis ? "cursor-default text-[#c5cbd6]" : "cursor-pointer text-ink-2"}`;
  const nav = (d: number) => setPage(Math.max(0, Math.min(pages - 1, cp + d)));

  return (
    <>
      <div className="mb-[6px] text-[13px] text-text-2">{obj.name} / {t.tab_log}</div>
      <h1 className="text-[28px] font-extrabold tracking-[-.02em] text-ink">{t.log_title}</h1>
      <div className="mb-[18px] text-[13px] text-text-2">{t.log_sub}</div>
      {all.length === 0 ? (
        <div className="max-w-[720px] rounded-[14px] border border-dashed border-[#cdd5e2] bg-surface p-[38px] text-center text-[14px] text-muted"><IconHistory size={30} className="mx-auto mb-[10px] block" />{t.log_empty}</div>
      ) : (
        <>
          <div className="max-w-[920px] overflow-hidden rounded-[14px] border border-line bg-surface">
            {view.map((e, i) => (
              <div key={`${e.ts}-${e.uid}-${i}`} className="flex flex-wrap items-center gap-[14px] border-b border-bg-2 px-[18px] py-[13px]">
                <span className="w-[118px] flex-none text-[12px] text-muted">{fmtLogD(e.ts, lang)}</span>
                <span onClick={() => router.push(`/dev/objects/${objId}/plans?u=${e.uid}`)} className="flex-none cursor-pointer rounded-[7px] bg-bg-2 px-[10px] py-1 text-[13px] font-extrabold text-ink hover:bg-[#e2e7f0]">№ {e.num}</span>
                <span className={`flex-none rounded-[6px] px-[9px] py-[3px] text-[11px] font-bold ${e.f === "price" ? "bg-[#fef3c7] text-[#b45309]" : "bg-blue-tint text-blue"}`}>{e.f === "price" ? t.log_f_price : t.log_f_status}</span>
                <span className="text-[14px] text-muted line-through">{e.f === "price" ? money(Number(e.from), cur) : status[e.from] || e.from}</span>
                <IconArrowRight size={16} className="text-[#9aa1ac]" />
                <span className="text-[14px] font-bold text-ink">{e.f === "price" ? money(Number(e.to), cur) : status[e.to] || e.to}</span>
                <span className="flex-1" />
                <span className="inline-flex flex-none items-center text-[12px] text-text-2"><IconUser size={13} className="mr-1" />{e.by ?? "Admin"}</span>
              </div>
            ))}
          </div>
          {pages > 1 && (
            <div className="mt-4 flex max-w-[920px] flex-wrap items-center gap-2">
              <span className="mr-auto text-[13px] text-text-2">{from + 1}–{Math.min(from + LOGPP, all.length)} / {all.length}</span>
              <button type="button" onClick={() => nav(-1)} disabled={cp <= 0} className={navBtn(cp <= 0)}><IconChevronLeft size={16} /></button>
              {Array.from({ length: pages }, (_, i) => (
                <button key={i} type="button" onClick={() => setPage(i)} className={`h-[34px] min-w-[34px] cursor-pointer rounded-[9px] border px-2 text-[14px] font-bold ${i === cp ? "border-ink bg-ink text-white" : "border-line bg-surface text-ink-2"}`}>{i + 1}</button>
              ))}
              <button type="button" onClick={() => nav(1)} disabled={cp >= pages - 1} className={navBtn(cp >= pages - 1)}><IconChevronRight size={16} /></button>
            </div>
          )}
        </>
      )}
    </>
  );
}
