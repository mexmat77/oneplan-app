"use client";

// Geo picker — prototype markup lines 2123–2175, logic 3367–3396 and 3885–3907.
// `filter`: multi-select il › ilçe[] › semt[] with counters and the «Показать N» footer (catalogue / new builds).
// `add` / `req`: single pick il › ilçe › semt (listing form / new-request sheet); the caller closes its own modal.
import { useMemo, useState } from "react";
import { IconArrowLeft, IconCheck, IconChevronRight, IconMap, IconMapPin, IconSearch, IconWorld, IconX } from "@tabler/icons-react";
import { useEscape, useScrollLock } from "@/hooks/useScrollLock";
import { useT } from "@/i18n/provider";
import { nbGeoOk, type Project } from "@/lib/newb";
import { GEO, SEMT2ILCE } from "@/lib/seed";
import { useMahalleLoaded } from "@/lib/geo";
import type { Listing } from "@/lib/types";
import { useAllListings } from "@/store/listings";

export type GeoValue = { il: string; ilces: string[]; semts: string[] };
type Step = "il" | "ilce" | "semt";

type Props = {
  mode: "filter" | "add" | "req";
  value: GeoValue;                 // filter: current selection; add/req: {il, ilces:[ilce], semts:[semt]}
  scope?: Listing[];               // counters (prototype `scopeAll`); defaults to all listings
  projects?: Project[];            // new-build catalogue: the footer counts projects by `p.geo` (prototype 3900–3905)
  countLabel?: string;             // "объектов" / "проектов"
  onApply: (v: GeoValue) => void;
  onClose: () => void;
};

const norm = (s: string) => s.toLocaleLowerCase("tr").normalize("NFD").replace(/[̀-ͯ]/g, "");
const ilName = (k: string) => GEO.find((x) => x.k === k)?.n ?? k;
const ilceName = (k: string) => { for (const il of GEO) { const ic = il.ilces.find((x) => x.k === k); if (ic) return ic.n; } return k; };

export function GeoPicker({ mode, value, scope, projects, countLabel, onApply, onClose }: Props) {
  const t = useT();
  useMahalleLoaded(); // махалле подгружаются лениво; после загрузки список семтов перерисуется
  const all = useAllListings();
  const scopeAll = scope ?? all;
  const isAdd = mode !== "filter";   // prototype `gAdd = add || req`
  const [step, setStep] = useState<Step>(value.il ? "ilce" : "il");
  const [il, setIl] = useState(value.il);
  const [ilces, setIlces] = useState<string[]>(isAdd ? [] : value.ilces);
  const [semts, setSemts] = useState<string[]>(isAdd ? [] : value.semts);
  const [focus, setFocus] = useState(isAdd ? value.ilces[0] ?? "" : "");
  const [q, setQ] = useState("");
  useScrollLock(true);
  useEscape(true, onClose);

  const cnt = useMemo(() => {
    const byIl: Record<string, number> = {}, byIlce: Record<string, number> = {}, bySemt: Record<string, number> = {};
    for (const o of scopeAll) {
      if (o.il) byIl[o.il] = (byIl[o.il] || 0) + 1;
      if (o.ilce) byIlce[o.ilce] = (byIlce[o.ilce] || 0) + 1;
      if (o.ilce && o.semt) bySemt[`${o.ilce}/${o.semt}`] = (bySemt[`${o.ilce}/${o.semt}`] || 0) + 1;
    }
    return { byIl, byIlce, bySemt };
  }, [scopeAll]);
  const gIl = GEO.find((x) => x.k === il);
  const match = (name: string) => !q.trim() || norm(name).includes(norm(q.trim()));
  const selIl = isAdd ? value.il : il;      // highlighted province row (prototype 3377)
  const selIlce = value.ilces[0] ?? "", selSemt = value.semts[0] ?? "";

  const finishAdd = (ilK: string, ilceK: string, semtK: string) => onApply({ il: ilK, ilces: ilceK ? [ilceK] : [], semts: semtK ? [semtK] : [] });

  // Prototype `geoTmpN` (3391–3396): semts only narrow the ilçe they belong to.
  const resultN = useMemo(() => scopeAll.filter((o) => {
    if (il && o.il !== il) return false;
    if (ilces.length) {
      if (!o.ilce || !ilces.includes(o.ilce)) return false;
      const ss = semts.filter((k) => SEMT2ILCE[k] === o.ilce);
      if (ss.length && (!o.semt || !ss.includes(o.semt))) return false;
    }
    return true;
  }).length, [scopeAll, il, ilces, semts]);
  const showLabel = projects
    ? `${t.geo.show} ${projects.filter((p) => nbGeoOk(p, { il, ilces, semts })).length} ${countLabel ?? t.geo.obj}`
    : `${t.geo.show} ${resultN} ${countLabel ?? t.geo.obj}`;

  const title = step === "il" ? t.geo.loc : step === "ilce" ? ilName(il) : isAdd ? ilceName(focus) : t.geo.semtT;
  const crumb = step === "il" ? `Türkiye · ${t.geo.il}` : step === "ilce" ? `Türkiye › ${ilName(il)} · ${t.geo.ilce}` : `Türkiye › ${ilName(il)} › ${isAdd ? ilceName(focus) : ilces.map(ilceName).join(", ")} · ${t.geo.semt}`;
  const row = "flex w-full cursor-pointer items-center gap-[11px] border-b border-[#f5f7fb] px-[18px] py-[14px] text-left text-[14px] text-ink hover:bg-bg-3";
  const blueRow = "flex w-full cursor-pointer items-center gap-[10px] border-b border-[#f5f7fb] px-[18px] py-[14px] text-left text-[14px] font-bold text-blue hover:bg-bg-3";
  const chk = (on: boolean) => `flex h-[20px] w-[20px] flex-none items-center justify-center rounded-[6px] text-[13px] ${on ? "bg-blue-2 text-white" : "border border-[#d5dce6] text-transparent"}`;
  const count = "text-[12px] font-semibold text-muted";

  const semtGroups = (isAdd ? (gIl?.ilces.filter((ic) => ic.k === focus) ?? []) : (gIl?.ilces.filter((ic) => ilces.includes(ic.k)) ?? []))
    .map((ic) => ({ ic, rows: ic.semts.filter((sm) => match(sm.n) && (isAdd || (cnt.bySemt[`${ic.k}/${sm.k}`] || 0) > 0)) }))
    .filter((g) => g.rows.length);
  // В поиске показываем только районы/махалле с объектами; при добавлении — все (правило пользователя 09.10.2026).
  const ilceRows = gIl?.ilces.filter((ic) => match(ic.n) && (isAdd || (cnt.byIlce[ic.k] || 0) > 0)) ?? [];

  return (
    <>
      <div className="animate-bg fixed inset-0 z-330 bg-[rgba(10,16,28,.45)]" onClick={onClose} />
      <div data-geo-panel="1" className="animate-fade fixed left-1/2 top-1/2 z-340 flex h-[min(620px,86vh)] w-[520px] max-w-[calc(100vw-24px)] -translate-x-1/2 -translate-y-1/2 flex-col overflow-hidden rounded-[18px] bg-surface shadow-[0_30px_80px_rgba(0,0,0,.35)]">
        <div className="flex items-center gap-[10px] border-b border-[#f2f4f8] px-[18px] py-[15px]">
          {step !== "il" && (
            <button type="button" onClick={() => { setStep(step === "semt" ? "ilce" : "il"); setQ(""); }} className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-line text-[16px] text-text hover:border-blue hover:text-blue"><IconArrowLeft size={16} /></button>
          )}
          <div className="min-w-0 flex-1">
            <div className="text-[16px] font-extrabold text-ink">{title}</div>
            <div className="mt-[1px] text-[11.5px] text-muted">{crumb}</div>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer p-[2px] text-[#aab1bd] hover:text-ink"><IconX size={22} /></button>
        </div>
        <div className="border-b border-[#f2f4f8] px-[18px] py-[10px]">
          <div className="relative">
            <IconSearch size={14} className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.geo.search} className="w-full rounded-[10px] border border-line py-[9px] pl-8 pr-[11px] text-[13.5px] outline-none focus:border-blue" />
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">
          {step === "il" && (
            <>
              {!isAdd && (
                <button type="button" onClick={() => onApply({ il: "", ilces: [], semts: [] })} className={blueRow}>
                  <IconWorld size={17} /> {t.geo.all} <span className={`ml-auto ${count}`}>{scopeAll.length}</span>
                </button>
              )}
              {GEO.filter((g) => match(g.n) && (isAdd || (cnt.byIl[g.k] || 0) > 0)).map((g) => (
                <button
                  key={g.k}
                  type="button"
                  onClick={() => { if (il !== g.k) { setIlces([]); setSemts([]); } setIl(g.k); setQ(""); setStep("ilce"); }}
                  className={`${row} ${selIl === g.k ? "bg-blue-tint" : ""}`}
                >
                  <span className="min-w-0 flex-1">{g.n}</span>
                  <span className={count}>{isAdd ? "" : cnt.byIl[g.k] || 0}</span>
                  <IconChevronRight size={16} className="text-[#c3c9d4]" />
                </button>
              ))}
            </>
          )}
          {step === "ilce" && (
            <>
              {isAdd && ilceRows.length === 0 && (
                <div className="px-5 py-6 text-center text-[13px] leading-[1.6] text-text-2">
                  <IconMapPin size={24} className="mx-auto text-blue" />
                  <div className="mt-[6px]">{t.geo.addEmpty}</div>
                  <button type="button" onClick={() => finishAdd(il || value.il, "", "")} className="mt-3 inline-block cursor-pointer rounded-[10px] bg-blue-2 px-4 py-[10px] text-[13px] font-bold text-white hover:bg-blue-3">{t.geo.pickIl}</button>
                </div>
              )}
              {ilceRows.map((ic) => {
                const on = isAdd ? selIlce === ic.k : ilces.includes(ic.k);
                const selSemts = isAdd ? [] : semts.filter((k) => SEMT2ILCE[k] === ic.k);
                const sub = selSemts.length ? selSemts.map((k) => ic.semts.find((s) => s.k === k)?.n ?? k).join(", ") : on ? t.geo.wholeSub : "";
                return (
                  <button
                    key={ic.k}
                    type="button"
                    onClick={() => {
                      if (isAdd) { setFocus(ic.k); setQ(""); setStep("semt"); return; }
                      setIlces(on ? ilces.filter((x) => x !== ic.k) : [...ilces, ic.k]);
                      if (on) setSemts(semts.filter((k) => SEMT2ILCE[k] !== ic.k));
                    }}
                    className={row}
                  >
                    {!isAdd && <span className={chk(on)}><IconCheck size={13} stroke={3} /></span>}
                    <span className="min-w-0 flex-1">
                      <span className="block">{ic.n}</span>
                      {sub && <span className="mt-[1px] block truncate text-[11.5px] text-blue">{sub}</span>}
                    </span>
                    <span className={count}>{isAdd ? "" : cnt.byIlce[ic.k] || 0}</span>
                  </button>
                );
              })}
            </>
          )}
          {step === "semt" && (
            <>
              {isAdd && (
                <button type="button" onClick={() => finishAdd(il || value.il, focus, "")} className={blueRow}>
                  <IconMap size={17} /> {t.geo.whole} <span className={`ml-auto ${count}`}>{focus ? cnt.byIlce[focus] || 0 : 0}</span>
                </button>
              )}
              {semtGroups.map(({ ic, rows }) => (
                <div key={ic.k}>
                  <div className="border-b border-[#f5f7fb] bg-[#fafbfd] px-[18px] pb-[7px] pt-3 text-[11px] font-extrabold uppercase tracking-[.07em] text-muted">{ic.n}</div>
                  {rows.map((sm) => {
                    const on = isAdd ? selSemt === sm.k && selIlce === ic.k : semts.includes(sm.k);
                    return (
                      <button key={sm.k} type="button" onClick={() => (isAdd ? finishAdd(il || value.il, ic.k, sm.k) : setSemts(on ? semts.filter((x) => x !== sm.k) : [...semts, sm.k]))} className={row}>
                        {!isAdd && <span className={chk(on)}><IconCheck size={13} stroke={3} /></span>}
                        <span className="min-w-0 flex-1">{sm.n}</span>
                        <span className={count}>{isAdd ? "" : cnt.bySemt[`${ic.k}/${sm.k}`] || 0}</span>
                      </button>
                    );
                  })}
                </div>
              ))}
            </>
          )}
        </div>
        {!isAdd && step !== "il" && (
          <div className="flex gap-2 border-t border-[#f2f4f8] px-[18px] py-3">
            {step === "ilce" && ilces.length > 0 && (
              <button type="button" onClick={() => { setFocus(""); setQ(""); setStep("semt"); }} className="flex flex-1 cursor-pointer items-center justify-center gap-1 whitespace-nowrap rounded-[12px] border border-[#d8e3ff] bg-blue-tint px-[10px] py-[13px] text-[13.5px] font-bold text-blue hover:bg-[#e2ebff]">
                {t.geo.next} <IconChevronRight size={15} />
              </button>
            )}
            <button type="button" onClick={() => onApply({ il, ilces, semts })} className="flex-[1.3] cursor-pointer rounded-[12px] bg-blue-2 py-[13px] text-[14px] font-bold text-white hover:bg-blue-3">
              {showLabel}
            </button>
          </div>
        )}
      </div>
    </>
  );
}

export function geoLabelOf(v: GeoValue, all: string): string {
  if (!v.il) return all;
  const il = GEO.find((x) => x.k === v.il);
  if (!il) return all;
  const parts = [il.n];
  const ilceNames = il.ilces.filter((x) => v.ilces.includes(x.k)).map((x) => x.n);
  if (ilceNames.length) parts.push(ilceNames.join(", "));
  const semtNames = il.ilces.flatMap((ic) => ic.semts.filter((s) => v.semts.includes(s.k)).map((s) => s.n));
  if (semtNames.length) parts.push(semtNames.join(", "));
  return parts.join(" · ");
}
