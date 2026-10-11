"use client";

// Favourites — listings grid plus the new-build sections (prototype lines 413–444, logic 3731–3750).
import { Suspense } from "react";
import Link from "next/link";
import { IconHeartFilled } from "@tabler/icons-react";
import { CatalogGrid } from "@/components/catalog/CatalogGrid";
import { useI18n } from "@/i18n/provider";
import { fmt } from "@/lib/money";
import { SALES_STYLE, UNIT_ST, getProjects, minPlanPrice } from "@/lib/newb";
import { useAllListings } from "@/store/listings";
import { useNewbPrefs } from "@/store/newb";
import { usePrefs } from "@/store/prefs";

const row = "flex cursor-pointer items-center gap-3 rounded-[16px] border border-[#edf0f6] bg-surface px-[14px] py-3 shadow-[0_1px_3px_rgba(20,36,63,.05)] hover:shadow-[0_8px_24px_rgba(20,36,63,.1)]";
const pill = "rounded-[7px] px-2 py-[3px] text-[10px] font-extrabold uppercase tracking-[.03em]";
const del = "flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-[9px] text-red hover:bg-red-tint";
const secT = "mb-3 mt-[26px] text-[16px] font-extrabold text-ink";
const grid = "grid grid-cols-[repeat(auto-fill,minmax(min(320px,100%),1fr))] gap-3";

export default function FavsPage() {
  const { t, lang } = useI18n();
  const { favs } = usePrefs();
  const { watch, favU, toggleWatch, toggleFavU } = useNewbPrefs();
  const list = useAllListings().filter((o) => favs.includes(o.id));
  const projects = getProjects();
  const watched = watch.map((k) => projects.find((p) => p.k === k)).filter((p): p is NonNullable<typeof p> => !!p);
  const units = favU.map((id) => { const i = id.lastIndexOf("#"); const p = projects.find((x) => x.k === id.slice(0, i)); const u = p?.unitList.find((x) => x.no === +id.slice(i + 1)); return p && u ? { id, p, u } : null; }).filter((x): x is NonNullable<typeof x> => !!x);

  return (
    <>
      <div className="mb-4">
        <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.fav.title}</h1>
        <p className="mt-[5px] max-w-[640px] text-[14px] text-text-2 [text-wrap:pretty]">{t.fav.sub}</p>
      </div>
      <Suspense><CatalogGrid all={list} mode="favs" favEmpty={favU.length === 0} /></Suspense>

      {watched.length > 0 && (
        <>
          <div className={secT}>{t.newb.favCplxT}</div>
          <div className={grid}>
            {watched.map((p) => {
              const ss = SALES_STYLE[p.sales];
              return (
                <Link key={p.k} href={`/newb?p=${p.k}`} className={row}>
                  <span className="h-[58px] w-[74px] flex-none rounded-[10px] bg-cover bg-center" style={{ backgroundImage: `url('${p.ph[0]?.img}')` }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-[7px]"><span className="truncate text-[14px] font-extrabold text-ink">{p.n}</span><span className={pill} style={{ background: ss.bg, color: ss.fg }}>{t.newb.salesL[p.sales]}</span></span>
                    <span className="mt-[2px] block truncate text-[11.5px] text-muted">{p.geo} · {p.dev}</span>
                    <span className="mt-[3px] block text-[12.5px]"><b className="text-ink">{t.newb.fromM} {fmt(minPlanPrice(p), p.cur)}</b></span>
                  </span>
                  <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleWatch(p.k); }} className={del}><IconHeartFilled size={16} /></span>
                </Link>
              );
            })}
          </div>
        </>
      )}
      {units.length > 0 && (
        <>
          <div className={secT}>{t.newb.favUnitsT}</div>
          <div className={grid}>
            {units.map(({ id, p, u }) => {
              const st = u.st === "na" ? { bg: "#eef1f6", fg: "#aab1bd", l: "—" } : { bg: UNIT_ST[u.st].bg, fg: UNIT_ST[u.st].fg, l: UNIT_ST[u.st].l[lang] };
              return (
                <Link key={id} href={`/newb?p=${p.k}&u=${u.no}`} className={row}>
                  <span className="h-[58px] w-[74px] flex-none rounded-[10px] bg-cover bg-center" style={{ backgroundImage: `url('${p.ph[0]?.img}')` }} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-[7px]"><span className="text-[14px] font-extrabold text-ink">{u.pl[0]} · №{u.no}</span><span className={pill} style={{ background: st.bg, color: st.fg }}>{st.l}</span></span>
                    <span className="mt-[2px] block truncate text-[11.5px] text-muted">{p.n} · {p.geo}</span>
                    <span className="mt-[3px] block text-[12.5px] text-text">{u.gb} / {u.net} м² · <b className="text-ink">{u.st === "sold" || u.st === "na" ? "—" : fmt(u.pl[2], p.cur)}</b></span>
                  </span>
                  <span onClick={(e) => { e.preventDefault(); e.stopPropagation(); toggleFavU(id); }} className={del}><IconHeartFilled size={16} /></span>
                </Link>
              );
            })}
          </div>
        </>
      )}
    </>
  );
}
