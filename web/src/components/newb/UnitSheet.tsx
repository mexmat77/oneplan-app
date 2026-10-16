"use client";

// Unit sheet — prototype markup lines 1268–1306 (+ mobile stack 1308–1319), logic `uo` (4049–4073).
import { useState, type ReactNode } from "react";
import {
  IconBuildingCommunity, IconBuildingSkyscraper, IconCalendarDollar, IconChevronLeft, IconChevronRight, IconHeart, IconKey, IconMessageCircle,
  IconPhoto, IconRuler2, IconRulerMeasure, IconStairsUp, IconX,
} from "@tabler/icons-react";
import { useBackClose, useScrollLock } from "@/hooks/useScrollLock";
import { useI18n } from "@/i18n/provider";
import { eqOf, fmt } from "@/lib/money";
import { TAG_L, UNIT_ST, unitPhotos, type Project, type Unit, type UnitStatus } from "@/lib/newb";
import { MobileStack } from "./MobileStack";
import { useSwipe } from "./swipe";

// Solid status pill — prototype `stSt` (4047: table rows 10px / 4067: sheet 10.5px); `na` → grey «—».
export function StatusPill({ st, size = "row" }: { st: UnitStatus; size?: "row" | "sheet" }) {
  const { lang } = useI18n();
  const cls = size === "row" ? "rounded-[7px] px-[7px] py-[3px] text-[10px]" : "rounded-[8px] px-[10px] py-1 text-[10.5px]";
  const style = st === "na" ? { background: "#eef1f6", color: "#aab1bd" } : { background: UNIT_ST[st].dot, color: "#fff" };
  return <span className={`inline-block text-center font-extrabold uppercase tracking-[.03em] ${cls}`} style={style}>{st === "na" ? "—" : UNIT_ST[st].l[lang]}</span>;
}

type Props = { p: Project; u: Unit; fav: boolean; onFav: () => void; onClose: () => void; onReq: () => void };

export function UnitSheet({ p, u, fav, onFav, onClose, onReq }: Props) {
  const { t, lang } = useI18n();
  const up = unitPhotos(p, u);
  const [idx, setIdx] = useState(0);
  const [mg, setMg] = useState(false);
  const ui = Math.min(idx, up.length - 1);
  const go = (d: number) => setIdx((ui + d + up.length) % up.length);
  const swipe = useSwipe((d) => go(d));
  useScrollLock(true);
  useBackClose(true, onClose);
  useBackClose(mg, () => setMg(false));
  const na = u.st === "sold" || u.st === "na";
  const rows: [ReactNode, string, string][] = [
    [<IconBuildingSkyscraper key="b" size={20} />, t.newb.head.bl, p.bl > 1 ? `B${u.bl}` : "—"],
    [<IconStairsUp key="f" size={20} />, t.newb.head.fl, u.tag === "villa" ? "Villa" : String(u.f)],
    [<IconRulerMeasure key="g" size={20} />, t.newb.head.gb, `${u.gb} м²`],
    [<IconRuler2 key="n" size={20} />, t.newb.head.nt, `${u.net} м²`],
    [<IconKey key="d" size={20} />, t.newb.dlvT, p.dlv],
    [<IconCalendarDollar key="i" size={20} />, t.newb.instB, p.inst ? t.newb.yesL : "—"],
  ];
  const arrow = "absolute top-1/2 flex h-9 w-9 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,.95)] text-ink shadow-[0_4px_14px_rgba(20,36,63,.18)] hover:bg-surface";

  return (
    <>
      <div onClick={onClose} className="fixed inset-0 z-690 bg-[rgba(10,16,28,.5)]" />
      <div data-unit-sheet="1" className="fixed left-1/2 top-1/2 z-695 max-h-[90vh] w-[min(920px,94vw)] -translate-x-1/2 -translate-y-1/2 overflow-y-auto rounded-[22px] bg-surface px-[26px] py-6 shadow-[0_24px_70px_rgba(10,16,28,.3)]">
        <div className="mb-1 flex flex-wrap items-center gap-[10px]">
          <span className="text-[21px] font-extrabold tracking-[-0.01em] text-ink">{u.pl[0]} · №{u.no}</span>
          {u.tag && <span className="rounded-[8px] bg-blue-tint px-[9px] py-1 text-[11px] font-bold text-blue-2">{TAG_L[u.tag][lang]}</span>}
          <StatusPill st={u.st} size="sheet" />
          <button type="button" onClick={onClose} className="ml-auto flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-[12px] text-muted hover:bg-bg-3 hover:text-ink"><IconX size={21} /></button>
        </div>
        <div className="mb-4 flex items-center gap-1 text-[12.5px] text-muted"><IconBuildingCommunity size={14} /> {p.n} · {p.geo}</div>
        <div data-unit-cols="1" className="grid grid-cols-[1.35fr_1fr] items-start gap-[22px]">
          <div
            data-uphoto="1"
            onClick={() => { if (window.innerWidth <= 760) setMg(true); else go(1); }}
            {...swipe}
            className="relative aspect-[4/3] cursor-pointer overflow-hidden rounded-[16px] border border-line-2 bg-bg-3 [touch-action:pan-y]"
          >
            <div data-strip="1" className="absolute inset-0 flex transition-transform duration-[350ms] ease-[cubic-bezier(.22,.61,.36,1)]" style={{ transform: `translateX(-${ui * 100}%)` }}>
              {up.map((src, k) => <div key={k} className="h-full w-full flex-none bg-cover bg-center" style={{ backgroundImage: `url('${src}')` }} />)}
            </div>
            {up.length > 1 && (
              <>
                <span data-gal-arr="1" onClick={(e) => { e.stopPropagation(); go(-1); }} className={`${arrow} left-[10px]`}><IconChevronLeft size={16} /></span>
                <span data-gal-arr="1" onClick={(e) => { e.stopPropagation(); go(1); }} className={`${arrow} right-[10px]`}><IconChevronRight size={16} /></span>
                <span className="absolute bottom-[10px] right-[10px] inline-flex items-center gap-1 rounded-[8px] bg-[rgba(10,16,28,.6)] px-[9px] py-1 text-[11px] font-semibold text-white"><IconPhoto size={12} /> {ui + 1} / {up.length}</span>
              </>
            )}
          </div>
          <div>
            <div className="text-[26px] font-extrabold tracking-[-0.02em] text-ink">{na ? "—" : fmt(u.pl[2], p.cur)}</div>
            {!na && <div className="mt-[3px] text-[13.5px] font-semibold text-text">{eqOf({ price: u.pl[2], cur: p.cur })}</div>}
            <div className="my-4 grid grid-cols-2 gap-[9px]">
              {rows.map(([ic, k, v], n) => (
                <div key={n} className="flex items-start gap-[11px] rounded-[14px] bg-bg-3 px-[14px] py-[13px]"><span className="mt-[1px] flex-none text-blue">{ic}</span><span className="min-w-0"><span className="block text-[15px] font-extrabold text-ink">{v}</span><span className="mt-[1px] block text-[12px] text-muted">{k}</span></span></div>
              ))}
            </div>
            <div data-ubtns="1" className="flex gap-[9px]">
              <span onClick={onFav} className={`inline-flex cursor-pointer items-center justify-center gap-[7px] whitespace-nowrap rounded-[11px] border-[1.5px] px-[15px] py-[11px] text-[13px] font-bold hover:brightness-[.97] ${fav ? "border-red bg-red-tint text-red" : "border-line bg-surface text-ink"}`}><IconHeart size={16} /> {fav ? t.newb.favOn : t.newb.favAdd}</span>
              <button type="button" onClick={onReq} className="inline-flex min-w-0 flex-1 cursor-pointer items-center justify-center gap-[6px] whitespace-nowrap rounded-[11px] bg-blue-2 px-[13px] py-[11px] text-[13.5px] font-bold text-white hover:bg-blue-3"><IconMessageCircle size={16} /> {t.newb.reqB}</button>
            </div>
          </div>
        </div>
      </div>
      {mg && <MobileStack title={`${u.pl[0]} · №${u.no}`} photos={up} z={720} onClose={() => setMg(false)} />}
    </>
  );
}
