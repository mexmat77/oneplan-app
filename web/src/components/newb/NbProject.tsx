"use client";

// New-build project page — prototype markup lines 1079–1267, logic `nbo` (3980–4084).
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  IconArrowLeft, IconBrandTelegram, IconBrandWhatsapp, IconBuilding, IconCalendarDollar, IconCheck, IconChevronRight, IconDoor, IconDots, IconDownload,
  IconFileTypePdf, IconHeart, IconHeartFilled, IconInfoCircle, IconKey, IconLockOpen, IconMapPin, IconMessageCircle, IconPhone,
} from "@tabler/icons-react";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import { eqOf, fmt, useRates } from "@/lib/money";
import { SALES_STYLE, TAG_L, UNIT_ORDER, UNIT_ST, devAvatar, devPhone, minPlanPrice, ukey, type PhotoCat, type Project, type UnitStatus } from "@/lib/newb";
import { useNewbPrefs } from "@/store/newb";
import { ContactsSheet } from "./ContactsSheet";
import { NbGallery } from "./NbGallery";
import { StatusPill, UnitSheet } from "./UnitSheet";

const NbMap = dynamic(() => import("./NbMap"), { ssr: false, loading: () => <div className="h-[280px] rounded-[12px] bg-line-2" /> });

const chipF = (on: boolean) => `cursor-pointer rounded-[18px] border px-[13px] py-[9px] text-[12.5px] transition-[background,border-color] duration-[120ms] hover:bg-line-2 ${on ? "border-[#9db8f5] bg-blue-tint font-bold text-[#2c4a9e]" : "border-line bg-surface font-semibold text-[#3d4a5e]"}`;
const card = "mb-[14px] rounded-[16px] border border-line bg-surface px-[19px] py-[17px]";
const cardT = "text-[15px] font-extrabold text-ink";
const CATS: ("all" | PhotoCat)[] = ["all", "ext", "int", "soc", "pool", "spa", "kids", "park"];

export function NbProject({ p, dev, initialUnit }: { p: Project; dev: string | null; initialUnit: number | null }) {
  const { t, lang } = useI18n();
  const rates = useRates();
  const router = useRouter();
  const { watch, favU, toggleWatch, toggleFavU } = useNewbPrefs();
  const [cat, setCat] = useState<"all" | PhotoCat>("all");
  const [ust, setUst] = useState<"" | UnitStatus>("free");
  const [urm, setUrm] = useState("");
  const [uN, setUN] = useState(20);
  const [unitNo, setUnitNo] = useState<number | null>(initialUnit);
  const [cts, setCts] = useState(false);
  const phs = (cat === "all" ? p.ph : p.ph.filter((x) => x.cat === cat)).map((x) => x.img);
  const ss = SALES_STYLE[p.sales];
  const salesBadge = <span className="rounded-[8px] px-[10px] py-1 text-[11px] font-extrabold uppercase tracking-[.04em]" style={{ background: ss.bg, color: ss.fg }}>{t.newb.salesL[p.sales]}</span>;
  const minPrice = minPlanPrice(p);
  const cnt = (k: UnitStatus) => p.unitList.filter((u) => u.st === k).length;
  const rooms = [...new Set(p.unitList.filter((u) => u.tag !== "villa").map(ukey))].sort();
  if (p.unitList.some((u) => u.tag === "villa")) rooms.push("villa");
  const units = p.unitList.filter((u) => (!ust || u.st === ust) && (!urm || (urm === "villa" ? u.tag === "villa" : ukey(u) === urm)));
  const unit = unitNo == null ? null : p.unitList.find((u) => u.no === unitNo) ?? null;
  const watching = watch.includes(p.k);
  const phone = devPhone(p);
  const av = devAvatar(p.dev);
  const paramRows: [ReactNode, string, string][] = [
    [<IconKey key="1" size={20} />, t.newb.dlvT, p.dlv], [<IconLockOpen key="2" size={20} />, t.newb.keysT, t.newb.keysL[p.keys]],
    [<IconDoor key="3" size={20} />, t.newb.unitsT, String(p.units)], [<IconBuilding key="4" size={20} />, `${t.newb.flT} / ${t.newb.blT}`, `${p.fl} / ${p.bl}`],
    ...(p.inst ? [[<IconCalendarDollar key="5" size={20} />, t.newb.instB, t.newb.yesL] as [ReactNode, string, string]] : []),
  ];
  const rateD = rates.date ? new Date(rates.date.split(".").reverse().join("-")) : new Date(); // дата бюллетеня ЦБ dd.mm.yyyy
  const rateNote = `${t.obj.rate} ${rateD.toLocaleDateString(lang === "RU" ? "ru-RU" : lang === "TR" ? "tr-TR" : "en-GB")}`;
  const toChat = () => router.push("/chat?with=sup");
  const onWatch = () => { toggleWatch(p.k); showToast(watching ? t.newb.watchOff : t.newb.watchOn); };
  const stChips: ["" | Exclude<UnitStatus, "na">, string, number][] = [["", t.newb.totalL, p.unitList.length], ...UNIT_ORDER.map((k) => [k, UNIT_ST[k].l[lang], cnt(k)] as ["" | Exclude<UnitStatus, "na">, string, number])];
  const roundBtn = (bg: string, icon: ReactNode, label: string, href?: string, onClick?: () => void) => {
    const inner = <><span className="flex h-[46px] w-[46px] items-center justify-center rounded-full text-white" style={{ background: bg }}>{icon}</span><span className="text-[10.5px] font-semibold text-text-2">{label}</span></>;
    const cls = "flex w-[54px] cursor-pointer flex-col items-center gap-[5px] hover:brightness-95";
    return href ? <a key={label} href={href} className={cls}>{inner}</a> : <span key={label} onClick={onClick} className={cls}>{inner}</span>;
  };

  return (
    <>
      <div className="mb-3 flex w-fit gap-[6px] rounded-[12px] bg-line-2 p-1">
        <Link href="/catalog" className="rounded-[9px] px-[14px] py-[7px] text-[12.5px] font-bold text-text-2 hover:bg-line-2">{t.newb.resale}</Link>
        <span className="rounded-[9px] bg-surface px-[14px] py-[7px] text-[12.5px] font-bold text-ink shadow-[0_1px_3px_rgba(20,36,63,.1)]">{t.newb.title}</span>
      </div>
      <Link href={dev ? `/newb?dev=${encodeURIComponent(dev)}` : "/newb"} className="mb-[14px] inline-flex items-center gap-[6px] text-[13.5px] font-semibold text-text hover:text-ink"><IconArrowLeft size={16} /> {t.common.back}</Link>
      <div data-nb-chips="1" className="mb-3 flex flex-wrap gap-[7px]">
        {CATS.filter((c) => c === "all" || p.ph.some((x) => x.cat === c)).map((c) => <span key={c} onClick={() => setCat(c)} className={chipF(cat === c)}>{t.newb.cats[c]}</span>)}
      </div>
      <div data-nb-cols="1" className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5">
        <div className="min-w-0">
          <NbGallery
            key={cat}
            photos={phs.length ? phs : [p.ph[0].img]}
            title={p.n}
            badge={<span className="absolute left-[14px] top-[14px] rounded-[8px] bg-ink px-[9px] py-1 text-[10.5px] font-extrabold uppercase tracking-[.04em] text-white">{t.newb.dlvT} {p.dlv}</span>}
            watch={<span onClick={(e) => { e.stopPropagation(); onWatch(); }} className={`absolute right-[14px] top-[14px] z-[2] flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-[12px] bg-[rgba(255,255,255,.95)] shadow-[0_4px_14px_rgba(20,36,63,.18)] hover:brightness-[.96] ${watching ? "text-red" : "text-ink"}`}>{watching ? <IconHeartFilled size={20} /> : <IconHeart size={20} />}</span>}
          />
          <div className="mb-4 mt-[14px]">
            <div className="mb-1 flex flex-wrap items-center gap-[10px]"><h1 className="text-[25px] font-extrabold tracking-[-0.02em] text-ink">{p.n}</h1>{salesBadge}</div>
            <div className="flex items-center gap-1 text-[13.5px] text-text-2"><IconMapPin size={14} /> {p.geo} · {t.newb.dev}: <b className="text-ink">{p.dev}</b></div>
          </div>
          <section data-nb-card="1" className={card}>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-[10px]">
              {paramRows.map(([ic, k, v], i) => (
                <div key={i} className="flex items-start gap-[11px] rounded-[14px] bg-bg-3 px-[14px] py-[13px]"><span className="mt-[1px] flex-none text-blue">{ic}</span><span className="min-w-0"><span className="block text-[15px] font-extrabold text-ink">{v}</span><span className="mt-[1px] block text-[12px] text-muted">{k}</span></span></div>
              ))}
            </div>
          </section>
          <section data-nb-card="1" className={card}>
            <div className={`mb-[10px] ${cardT}`}>{t.newb.plansT}</div>
            {p.plans.map((pl, i) => (
              <div key={i} className="flex flex-wrap items-center gap-[10px] border-b border-[#f5f7fb] py-[9px] text-[13.5px]">
                <span className="min-w-11 font-extrabold text-ink">{pl[0]}</span><span className="flex-1 text-muted">{t.newb.fromM} {pl[1]} м²</span><span className="text-[11.5px] text-muted">{eqOf({ price: pl[2], cur: p.cur })}</span><span className="font-extrabold text-blue-2">{t.newb.fromM} {fmt(pl[2], p.cur)}</span>
              </div>
            ))}
          </section>
          <section data-nb-card="1" className={card}>
            <div className="mb-[11px] flex flex-wrap items-center gap-[10px]"><div className={`flex-1 ${cardT}`}>{t.newb.listT} <span className="text-[12px] font-semibold text-muted">· {units.length} / {p.unitList.length}</span></div></div>
            <div data-nb-chips="1" className="mb-[9px] flex flex-wrap gap-[7px]">
              {stChips.map(([k, l, c]) => (
                <span key={k} onClick={() => { setUst(k === ust ? "" : k); setUN(20); }} className={`inline-flex cursor-pointer items-center gap-[7px] rounded-[16px] px-[13px] py-2 text-[12.5px] font-bold hover:brightness-[.96] ${(k ? ust === k : !ust) ? "bg-ink text-white" : "bg-bg-3 text-ink"}`}>
                  <span className="h-[9px] w-[9px] rounded-[3px]" style={{ background: k ? UNIT_ST[k].dot : "#14243f" }} />{l} <b>{c}</b>
                </span>
              ))}
            </div>
            <div data-nb-chips="1" className="mb-3 flex flex-wrap gap-[7px]">
              {rooms.map((r) => <span key={r} onClick={() => { setUrm(urm === r ? "" : r); setUN(20); }} className={chipF(urm === r)}>{r === "villa" ? "Villa" : r}</span>)}
            </div>
            <div data-unit-tbl="1" className="overflow-x-auto">
              <div data-umin="1" className="min-w-[620px]">
                <div data-uhead="1" className="grid grid-cols-[52px_44px_54px_110px_1fr_1fr_1.3fr_96px] gap-2 px-[10px] pb-2 pt-1 text-[10.5px] font-extrabold uppercase tracking-[.05em] text-muted">
                  <span>№</span><span>{t.newb.head.bl}</span><span>{t.newb.head.fl}</span><span>{t.newb.head.tp}</span><span>{t.newb.head.gb}</span><span>{t.newb.head.nt}</span><span>{t.cat.priceT}</span><span />
                </div>
                <div className="flex flex-col gap-[3px]">
                  {units.slice(0, uN).map((u) => {
                    const fav = favU.includes(`${p.k}#${u.no}`);
                    const bg = u.st === "na" ? undefined : UNIT_ST[u.st].bg.replace("#eef1f6", "#f7f8fb");
                    return (
                      <div key={u.no} data-urow="1" onClick={() => setUnitNo(u.no)} className={`grid cursor-pointer grid-cols-[52px_44px_54px_110px_1fr_1fr_1.3fr_96px] items-center gap-2 rounded-[9px] px-[10px] py-2 text-[12.5px] hover:brightness-[.97] ${u.st === "sold" ? "opacity-55" : ""}`} style={{ background: bg }}>
                        <span data-u="no" className="inline-flex items-center gap-[5px] font-bold text-muted">{fav && <IconHeartFilled size={12} className="text-red" />}№{u.no}</span>
                        <span data-u="bl" className="text-text">{p.bl > 1 ? `B${u.bl}` : "—"}</span>
                        <span data-u="f" className="text-text">{u.tag === "villa" ? "Villa" : u.f}</span>
                        <span data-u="tp" className="flex min-w-0 items-center gap-[6px]"><b className="text-ink">{u.pl[0]}</b>{u.tag && <span className="whitespace-nowrap rounded-[6px] bg-blue-tint px-[6px] py-[2px] text-[9.5px] font-bold text-blue-2">{TAG_L[u.tag][lang]}</span>}</span>
                        <span data-u="gb" className="text-text">{u.gb} м²</span>
                        <span data-u="nt" className="text-text">{u.net} м²</span>
                        <span data-u="pr" className="whitespace-nowrap font-extrabold text-ink">{u.st === "sold" || u.st === "na" ? "—" : fmt(u.pl[2], p.cur)}</span>
                        <span data-u="st"><StatusPill st={u.st} /></span>
                        <span data-u="br" className="hidden" />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
            {units.length > uN && <div onClick={() => setUN(uN + 20)} className="mt-[10px] cursor-pointer rounded-[10px] bg-[#f8faff] p-[11px] text-center text-[13px] font-bold text-blue-2 hover:bg-blue-tint">{t.common.showMore.replace("{n}", String(Math.min(units.length - uN, 20)))} · {units.length}</div>}
          </section>
          <section data-nb-card="1" className={card}>
            <div className={`mb-[9px] ${cardT}`}>{t.newb.infraT}</div>
            <div className="flex flex-wrap gap-[7px]">{p.feats.filter((k) => k in t.feat).map((k) => <span key={k} className="inline-flex items-center gap-1 rounded-[16px] bg-bg-3 px-[13px] py-2 text-[12.5px] font-semibold text-ink"><IconCheck size={14} className="text-[#2f9e5b]" /> {t.feat[k as keyof typeof t.feat]}</span>)}</div>
          </section>
          <section data-nb-card="1" className={card}><div className={`mb-[9px] ${cardT}`}>{t.newb.descT}</div><p className="whitespace-pre-line text-[13.5px] leading-[1.65] text-[#3d4757] [text-wrap:pretty]">{p.desc[lang]}</p></section>
          <section data-nb-card="1" className={card}><div className={`mb-[11px] ${cardT}`}>{t.newb.locT}</div><NbMap ll={p.ll} label={p.n} /></section>
          <section data-nb-card="1" className={card}>
            <div className={`mb-3 ${cardT}`}>{t.newb.diaryT}</div>
            <div className="flex flex-col gap-[13px]">
              {p.diary.map((d, i) => (
                <div key={i} className="flex items-start gap-[13px]">
                  {d.img && <span className="h-[62px] w-[86px] flex-none rounded-[10px] bg-cover bg-center" style={{ backgroundImage: `url('${d.img}')` }} />}
                  <div><div className="text-[11.5px] font-extrabold text-blue">{d.d}</div><div className="mt-[3px] text-[13px] leading-[1.5] text-[#3d4757]">{d.tx[lang]}</div></div>
                </div>
              ))}
            </div>
          </section>
          <section data-nb-card="1" className={card}>
            <div className={`mb-[10px] ${cardT}`}>{t.newb.docsT}</div>
            {p.docs.map((d) => (
              <div key={d} className="flex items-center gap-[11px] border-b border-[#f5f7fb] py-[9px]"><IconFileTypePdf size={19} className="flex-none text-red" /><span className="flex-1 text-[13px] font-semibold text-ink">{d}</span><span onClick={() => showToast(`⬇ ${d}`)} className="inline-flex cursor-pointer items-center gap-1 text-[12px] font-bold text-blue-2"><IconDownload size={13} /> {t.newb.dlB}</span></div>
            ))}
          </section>
        </div>

        <div data-nb-side="1" className="sticky top-[78px] flex flex-col gap-4">
          <div className="rounded-[20px] border border-[#edf0f6] bg-surface p-6 shadow-[0_1px_3px_rgba(20,36,63,.05)]">
            <div className="flex flex-wrap items-baseline gap-[10px]"><span className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.newb.fromM} {fmt(minPrice, p.cur)}</span></div>
            <div className="mt-[3px] text-[13px] font-semibold text-text">{eqOf({ price: minPrice, cur: p.cur })}</div>
            <div className="mt-[5px] flex items-center gap-1 text-[11px] text-muted"><IconInfoCircle size={12} /> {rateNote}</div>
            <div className="mt-[9px]">{salesBadge}</div>
            <div className="mb-1 mt-[15px] border-t border-[#f2f4f8]" />
            {([[t.newb.dlvT, p.dlv], [t.newb.keysT, t.newb.keysL[p.keys]], [t.newb.unitsT, String(p.units)]] as [string, string][]).map(([l, v]) => (
              <div key={l} className="flex justify-between gap-3 py-[7px] text-[13.5px]"><span className="text-text-2">{l}</span><span className="font-bold text-ink">{v}</span></div>
            ))}
            <button type="button" onClick={toChat} className="mt-3 flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-blue-2 py-[13px] text-[14px] font-bold text-white hover:bg-[#3453bd]"><IconMessageCircle size={17} /> {t.newb.reqB}</button>
          </div>
          <div className="rounded-[20px] border border-[#edf0f6] bg-surface px-6 py-[22px] shadow-[0_1px_3px_rgba(20,36,63,.05)]">
            <div className="mb-[13px] text-[12px] font-bold uppercase tracking-[.06em] text-muted">{t.newb.dev}</div>
            <Link href={`/newb?dev=${encodeURIComponent(p.dev)}`} className="-mx-2 mb-[13px] flex items-center gap-3 rounded-[12px] px-2 py-[6px] hover:bg-bg-3">
              <span className="flex h-12 w-12 flex-none items-center justify-center rounded-full bg-blue-2 text-[15px] font-bold text-white">{av}</span>
              <span className="min-w-0 flex-1"><span className="block text-[15px] font-extrabold text-ink">{p.dev}</span><span className="block text-[12px] text-muted">{p.geo}</span></span>
              <IconChevronRight size={16} className="text-[#aab1bd]" />
            </Link>
            <div className="mb-[13px] text-[18px] font-extrabold tracking-[.01em] text-ink">{phone}</div>
            <div className="flex flex-wrap gap-[14px]">
              {roundBtn("#3b5fd6", <IconPhone size={20} />, t.obj.callL, `tel:${phone.replace(/\s/g, "")}`)}
              {roundBtn("#22c15e", <IconBrandWhatsapp size={20} />, "WhatsApp", `https://wa.me/${phone.replace(/\D/g, "")}`)}
              {roundBtn("#229ed9", <IconBrandTelegram size={20} />, "Telegram", "#")}
              <span onClick={toChat} className="flex w-[54px] cursor-pointer flex-col items-center gap-[5px] hover:brightness-[.96]"><span className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-blue-tint text-blue hover:bg-[#e2ebff]"><IconMessageCircle size={20} /></span><span className="text-[10.5px] font-semibold text-text-2">{t.nav.chat}</span></span>
            </div>
          </div>
        </div>
      </div>

      <div data-obj-bar="1" className="fixed inset-x-0 bottom-0 z-210 hidden items-center gap-3 rounded-t-[16px] bg-surface px-[14px] pb-[calc(12px+env(safe-area-inset-bottom))] pt-[10px] shadow-[0_-8px_30px_rgba(20,36,63,.16)]">
        <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-blue-2 text-[12px] font-bold text-white">{av}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[14.5px] font-extrabold text-ink">{p.dev}</div>
          <div className="truncate text-[11px] text-muted">{phone}</div>
        </div>
        <div className="flex flex-none gap-[9px]">
          <a href={`tel:${phone.replace(/\s/g, "")}`} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[13px] bg-blue-2 text-white"><IconPhone size={19} /></a>
          <a href={`https://wa.me/${phone.replace(/\D/g, "")}`} className="flex h-11 w-11 cursor-pointer items-center justify-center rounded-[13px] bg-[#22c15e] text-white"><IconBrandWhatsapp size={19} /></a>
          <span onClick={() => setCts((v) => !v)} className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-[13px] bg-[#f0f2f6] text-ink hover:brightness-[.96]">
            <IconDots size={19} /><span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-lg bg-blue-2 px-1 text-[9.5px] font-bold text-white">+5</span>
          </span>
        </div>
      </div>
      {cts && <ContactsSheet dev={p.dev} phone={phone} onClose={() => setCts(false)} onChat={() => { setCts(false); toChat(); }} />}
      {unit && (
        <UnitSheet p={p} u={unit} fav={favU.includes(`${p.k}#${unit.no}`)} onFav={() => toggleFavU(`${p.k}#${unit.no}`)} onClose={() => setUnitNo(null)} onReq={() => { setUnitNo(null); toChat(); }} />
      )}
    </>
  );
}
