"use client";

// `#sec-basic` (493–505; данные 3702–3709): стадия (8 чипов, авто-скролл к активному), слайдер готовности,
// продажи, выдача ключей, назначение (мультивыбор).
import { useEffect, useRef } from "react";
import { IconCircleCheckFilled, IconCirclePlus, IconClipboardText } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { STAGELIST, STAGEPCT } from "@/lib/dev/data";
import type { OccSt, PurposeTag, SalesSt } from "@/lib/dev/types";
import { Label, SectionCard, eSet, type EditObj } from "./shared";

const SALES: [SalesSt, string, string][] = [["notsale", "#6b7280", "#f0f2f6"], ["start", "#b7791f", "#fdf3d7"], ["open", "#0f9d6b", "#e4f6ee"], ["sold", "#8a93a2", "#eef1f5"]];
const OCC: [OccSt, string, string][] = [["none", "#8a93a2", "#eef1f5"], ["started", "#0284c7", "#e0f2fe"], ["full", "#7b4fd0", "#efe7fb"]];
const seg = (on: boolean, ac: string, ab: string) => (on ? { borderColor: ac, background: ab, color: ac } : { borderColor: "#e6e9f0", background: "#fff", color: "#6b7688" });
const rowCls = "flex flex-nowrap gap-[7px] overflow-x-auto [-webkit-overflow-scrolling:touch]";
const chipCls = "flex-none cursor-pointer whitespace-nowrap rounded-[20px] border-[1.5px] px-[13px] py-2 text-[13px] font-semibold";

export function SecBasic({ obj }: { obj: EditObj }) {
  const { t } = useDevT();
  const row = useRef<HTMLDivElement>(null);
  // Авто-скролл ленты стадий к активному чипу (3702): через 350 мс, если лента шире контейнера.
  useEffect(() => {
    const id = setTimeout(() => { const r = row.current; if (!r) return; const a = r.querySelector<HTMLElement>('[data-oplon="1"]'); if (a && r.scrollWidth > r.clientWidth) r.scrollTo({ left: Math.max(0, a.offsetLeft - 70) }); }, 350);
    return () => clearTimeout(id);
  }, [obj.id, obj.stage]);
  const togglePurp = (k: PurposeTag) => eSet(obj.id, { tags: obj.tags.includes(k) ? obj.tags.filter((x) => x !== k) : [...obj.tags, k] });
  return (
    <SectionCard id="sec-basic" icon={<IconClipboardText size={18} />} title={t.edp.nav_basic}>
      <Label>{t.fld_stage}</Label>
      <div ref={row} className={`${rowCls} mx-[-22px] mb-[18px] px-[22px] pb-1`}>
        {STAGELIST.map((k, i) => {
          const on = obj.stage === k;
          return <span key={k} data-oplon={on ? "1" : ""} onClick={() => eSet(obj.id, { stage: k, ready: STAGEPCT[k] })} className={`${chipCls} px-[14px]`} style={on ? { borderColor: "#14243f", background: "#14243f", color: "#fff" } : { borderColor: "#e6e9f0", background: "#fff", color: "#6b7688" }}>{i + 1} · {t.stages[k]}</span>;
        })}
      </div>
      <Label>{t.dev.ready} · <b className="text-green">{obj.ready}%</b> <span className="text-muted-2">· {t.ready_hint}</span></Label>
      <div className="mb-[18px] flex max-w-[480px] items-center gap-3"><input type="range" min={0} max={100} value={obj.ready} onChange={(e) => eSet(obj.id, { ready: +e.target.value })} className="flex-1 cursor-pointer accent-green" /></div>
      <div className="mb-[18px] flex flex-col gap-[14px]">
        <div><Label>{t.sales.label}</Label><div className={`${rowCls} mx-[-22px] px-[22px] pb-[2px]`}>{SALES.map(([k, ac, ab]) => <span key={k} onClick={() => eSet(obj.id, { salesSt: k })} className={chipCls} style={seg(obj.salesSt === k, ac, ab)}>{t.sales[k]}</span>)}</div></div>
        <div><Label>{t.occ.label}</Label><div className={`${rowCls} mx-[-22px] px-[22px] pb-[2px]`}>{OCC.map(([k, ac, ab]) => <span key={k} onClick={() => eSet(obj.id, { occSt: k })} className={chipCls} style={seg(obj.occSt === k, ac, ab)}>{t.occ[k]}</span>)}</div></div>
      </div>
      <Label>{t.fld_purpose}</Label>
      <div className={`${rowCls} mx-[-22px] gap-2 px-[22px] pb-1`}>
        {(["cit", "res", "com"] as PurposeTag[]).map((k) => {
          const on = obj.tags.includes(k);
          return <span key={k} onClick={() => togglePurp(k)} className="inline-flex flex-none cursor-pointer items-center gap-[7px] rounded-[20px] border-[1.5px] px-[15px] py-[9px] text-[13px] font-semibold" style={on ? { borderColor: "#4d7cfe", background: "#eef3ff", color: "#3a63d4" } : { borderColor: "#e6e9f0", background: "#fff", color: "#6b7688" }}>{on ? <IconCircleCheckFilled size={15} /> : <IconCirclePlus size={15} />} {t.purpose[k]}</span>;
        })}
      </div>
    </SectionCard>
  );
}
