"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  IconArrowLeft, IconBath, IconBeach, IconBrandTelegram, IconBrandWechat, IconBrandWhatsapp, IconCalendar, IconCheck, IconChevronLeft, IconChevronRight,
  IconEye, IconHeart, IconHome, IconLayoutGrid, IconMapPin, IconMessage2, IconPhone, IconPhoto, IconRuler, IconRuler2, IconShieldLock, IconStairs,
} from "@tabler/icons-react";
import { Logo } from "@/components/Logo";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import { detail, type Tile } from "@/lib/detail";
import { eqOf, fmt } from "@/lib/money";
import { oldPrice, type Listing } from "@/lib/types";
import { useAllListings } from "@/store/listings";
import { useProfile, type Profile } from "@/store/profile";
import { findBySlug, getClientReturn, markViewed, reactTo, useSelections, type Reaction, type SelSnap, type Selection } from "@/store/selections";
import { resolveSelItems, type Gone } from "@/lib/selectionItems";
import { plural } from "@/lib/plural";
import { Gallery } from "@/components/obj/Gallery"; // та же галерея, что на странице объекта (16.10.2026, «как в обычной базе»)
import { reactPublic, viewPublic } from "@/app/s/actions";
import type { PublicSelection } from "@/lib/selectionsPublic";

// Client view of a selection — prototype lines 1919–2102 (markup), 3500–3546 (handlers).
// In the prototype it is a full-screen overlay (`clientView`); here it is the route /s/<slug> (`?preview=1` = the agent's preview).
const TILE_ICON: Record<Tile["icon"], typeof IconRuler2> = { rooms: IconLayoutGrid, area: IconRuler2, year: IconCalendar, bath: IconBath, sea: IconBeach };
const digits = (p: string) => p.replace(/\D/g, "");
const initialsOf = (n: string) => n.split(" ").map((w) => w[0]).join("");

// Messenger channels from the profile toggles (`cliShowWa/Tg/Vb/Mx/Wc`, prototype 1937–1941, 2079–2083).
function channels(p: Profile) {
  const list: { key: string; title: string; bg: string; hover: string; href: string; node: (size: number) => ReactNode }[] = [];
  if (p.waOn) list.push({ key: "wa", title: "WhatsApp", bg: "#22c15e", hover: "#1ba851", href: `https://wa.me/${digits(p.phone)}`, node: (s) => <IconBrandWhatsapp size={s} /> });
  if (p.tgOn) list.push({ key: "tg", title: "Telegram", bg: "#229ed9", hover: "#1b86ba", href: p.tgLogin ? `https://t.me/${p.tgLogin.replace(/^@/, "")}` : "#", node: (s) => <IconBrandTelegram size={s} /> });
  if (p.vbOn) list.push({ key: "vb", title: "Viber", bg: "#7360f2", hover: "#5f4cdd", href: `viber://chat?number=%2B${digits(p.phone)}`, node: (s) => <span className="font-extrabold" style={{ fontSize: s - 3 }}>V</span> });
  if (p.mxOn) list.push({ key: "mx", title: "MAX", bg: "#7b4fd0", hover: "#6a3fbd", href: "#", node: (s) => <span className="font-extrabold" style={{ fontSize: s - 7 }}>MAX</span> });
  if (p.wcOn) list.push({ key: "wc", title: "WeChat", bg: "#07c160", hover: "#06a854", href: "#", node: (s) => <IconBrandWechat size={s} /> });
  return list;
}

export function ClientView({ slug, preview, data }: { slug: string; preview: boolean; data?: PublicSelection | null }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const all = useAllListings();
  const selections = useSelections();
  const myProfile = useProfile();
  // Подборка из базы (сервер) или из стора браузера (демо/локальные); реакции клиента по подборке из базы — через серверные действия.
  const [reacts, setReacts] = useState<Selection["reacts"] | null>(data ? data.s.reacts : null);
  const stored = findBySlug(selections, slug);
  const s: Selection | undefined = data ? { ...data.s, reacts: reacts ?? data.s.reacts } : stored;
  const p = data ? data.owner : myProfile;
  const [objId, setObjId] = useState<string | null>(null);
  const counted = useRef(false);

  useEffect(() => {
    if (!s || preview || counted.current) return;
    counted.current = true;
    if (data) void viewPublic(slug); else markViewed(s.id);
  }, [s, preview, data, slug]);

  if (!s) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-[14px] text-muted">
        <div><Logo /><div className="mt-4">404</div></div>
      </div>
    );
  }
  const myInitials = initialsOf(p.name);
  const chans = channels(p);
  const pool = data ? [...data.listings, ...all] : all;
  // объекты подборки: живые → карточки; проданные/снятые → с плашкой; удалённые → по снимку (16.10.2026)
  const rows = resolveSelItems(s, pool);
  const items = rows.filter((x) => x.live && !x.gone).map((x) => x.live as Listing);
  const likeN = items.filter((o) => s.reacts[o.id] === "like").length;
  const cities = Array.from(new Set(items.map((o) => String(o.loc[lang]).split("·")[0].trim()).filter(Boolean)));
  const obj = objId ? rows.find((x) => x.id === objId)?.live ?? null : null;
  const today = new Date().toLocaleDateString(lang === "RU" ? "ru-RU" : lang === "TR" ? "tr-TR" : "en-GB");

  const react = (id: string, r: Reaction) => {
    const cur = s.reacts[id];
    const next = cur === r ? null : r;
    if (data) { setReacts((prev) => { const m = { ...(prev ?? data.s.reacts) }; if (next) m[id] = next; else delete m[id]; return m; }); void reactPublic(slug, id, next); }
    else reactTo(s.id, id, next);
    if (r === "like" && cur !== "like") showToast(t.cli.likeT);
  };
  const openObj = (id: string) => { setObjId(id); window.scrollTo(0, 0); };
  const backToSel = () => { setObjId(null); window.scrollTo(0, 0); };
  const mc = "inline-flex items-center gap-[6px] rounded-[16px] border px-[13px] py-[7px] text-[12.5px] font-semibold";
  const card = "rounded-[20px] border border-line-4 bg-surface px-[26px] py-6 shadow-[0_1px_3px_rgba(20,36,63,.05)]";
  const h3 = "mb-[13px] text-[17px] font-extrabold tracking-[-0.01em] text-ink";

  return (
    <div className="min-h-screen bg-bg">
      {preview && (
        <div className="sticky top-0 z-5 flex flex-wrap items-center gap-[10px] bg-ink px-5 py-[10px] text-[12.5px] text-white">
          <span className="flex items-center gap-[7px] text-dark-muted"><IconEye size={15} className="text-blue" /> {t.cli.bar}</span>
          <span className="flex items-center gap-[6px] text-[11.5px] text-dark-muted"><IconShieldLock size={14} className="text-green-3" /> {t.cli.note}</span>
          <button type="button" onClick={() => router.push(getClientReturn())} className="ml-auto inline-flex flex-none cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[9px] bg-dark-2 px-[14px] py-2 text-[12.5px] font-bold text-white hover:bg-dark-3"><IconArrowLeft size={14} /> {t.cli.back}</button>
        </div>
      )}
      <header className="border-b border-line bg-surface">
        <div className="mx-auto flex max-w-[1220px] flex-wrap items-center gap-[14px] px-6 py-[14px]">
          <Logo size={25} textSize={17} />
          <div className="ml-auto flex flex-wrap items-center gap-[11px]">
            <span className="flex h-[42px] w-[42px] items-center justify-center rounded-[12px] bg-blue-2 text-[14px] font-extrabold text-white">{myInitials}</span>
            <div><div className="text-[14px] font-bold text-ink">{p.name}</div><div className="text-[11.5px] text-muted">{t.cli.role}</div></div>
            {chans.map((c) => (
              <a key={c.key} href={c.href} target={c.href === "#" ? undefined : "_blank"} rel="noreferrer" title={c.title} className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-full text-white hover:brightness-95" style={{ background: c.bg }}>{c.node(18)}</a>
            ))}
            <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="text-[12.5px] font-bold text-ink">{p.phone}</a>
          </div>
        </div>
      </header>

      <div data-cli-wrap="1" className="mx-auto max-w-[1220px] px-6 pb-[70px] pt-7">
        {!obj ? (
          <>
            <h1 className="text-[25px] font-extrabold tracking-[-0.02em] text-ink">{t.cli.ttl} {s.name}</h1>
            {s.note && <div className="mt-3 rounded-[11px] border border-line border-l-[3px] border-l-blue bg-surface px-4 py-[13px] text-[13.5px] leading-[1.55] text-[#3d4a5e]">«{s.note}»</div>}
            <div className="mt-[13px] flex flex-wrap gap-2">
              <span className={`${mc} border-line bg-surface text-[#3d4a5e]`}><IconCalendar size={14} /> {t.cli.updL} {today}</span>
              <span className={`${mc} border-line bg-surface text-[#3d4a5e]`}><IconHome size={14} /> {items.length} {plural(lang, items.length, t.sel.objsP)}</span>
              {likeN > 0 && <span className={`${mc} border-[#f6c9cb] bg-red-tint text-red-2`}><IconHeart size={14} /> {likeN} {t.cli.likedL}</span>}
              {cities.map((c) => <span key={c} className={`${mc} border-line bg-surface text-[#3d4a5e]`}><IconMapPin size={14} /> {c}</span>)}
            </div>
            <div className="mt-[22px] grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-4">
              {rows.map((x) => (x.live ? <ClientCard key={x.id} o={x.live} s={s} gone={x.gone} onOpen={() => openObj(x.id)} react={react} /> : <GoneCard key={x.id} id={x.id} snap={x.snap!} s={s} />))}
            </div>
          </>
        ) : (
          <>
            {/* Mobile bottom bar (`data-obj-bar`, shown by globals.css on ≤820) */}
            <div data-obj-bar="1" className="fixed inset-x-0 bottom-0 z-660 hidden items-center gap-3 rounded-t-[16px] bg-surface px-[14px] pb-[calc(12px+env(safe-area-inset-bottom))] pt-[10px] shadow-[0_-8px_30px_rgba(20,36,63,.16)]">
              <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-blue-2 text-[12px] font-bold text-white">{myInitials}</span>
              <div className="min-w-0 flex-1"><div className="truncate text-[15.5px] font-extrabold text-ink">{fmt(obj.price, obj.cur)}</div><div className="truncate text-[11px] text-muted">{eqOf(obj)} · {p.name}</div></div>
              <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="flex h-[42px] w-[42px] flex-none cursor-pointer items-center justify-center rounded-full bg-blue-2 text-white"><IconPhone size={18} /></a>
              <a href={`https://wa.me/${digits(p.phone)}`} target="_blank" rel="noreferrer" className="flex h-[42px] w-[42px] flex-none cursor-pointer items-center justify-center rounded-full bg-green-3 text-white"><IconBrandWhatsapp size={18} /></a>
            </div>
            <div onClick={backToSel} className="mb-4 inline-flex cursor-pointer items-center gap-[7px] text-[13.5px] font-bold text-blue hover:text-blue-2"><IconArrowLeft size={16} /> {t.cli.toSel}</div>
            <div className="flex flex-wrap items-start gap-[18px]">
              <div className="min-w-[300px] flex-[2]">
                <Gallery photos={obj.photos.length ? obj.photos : [obj.img]} title={obj.t[lang]} />
                <h2 className="mt-[18px] text-[22px] font-extrabold tracking-[-0.02em] text-ink">{obj.t[lang]}</h2>
                <div className="mt-1 text-[13.5px] text-muted"><IconMapPin size={14} className="inline align-[-2px]" /> {obj.loc[lang]}</div>
                {s.cm[obj.id] && <div className="mt-[14px] flex items-start gap-[9px] rounded-[11px] border-l-[3px] border-l-blue bg-blue-tint px-[15px] py-3 text-[13.5px] leading-[1.55] text-sel-ink"><IconMessage2 size={15} className="mt-[1px] flex-none" /><span>{s.cm[obj.id]}</span></div>}
                <ObjDetail o={obj} card={card} h3={h3} />
              </div>
              <div className="sticky top-[70px] min-w-[280px] flex-1">
                <div data-card="1" className="rounded-[16px] border border-line bg-surface p-5">
                  <div className="text-[24px] font-extrabold tracking-[-0.01em] text-ink">{fmt(obj.price, obj.cur)}</div>
                  <div className="mt-[3px] text-[12.5px] text-muted">{eqOf(obj)}</div>
                  <div className="mb-[3px] mt-[13px] border-t border-bg-4" />
                  <div className="flex justify-between gap-3 py-[7px] text-[13px]"><span className="text-text-2">{t.obj.typeT}</span><span className="font-bold text-ink">{t.typ[obj.type]}</span></div>
                  <div className="flex justify-between gap-3 py-[7px] text-[13px]"><span className="text-text-2">{t.obj.dealT}</span><span className="font-bold text-ink">{t.deal[obj.deal]}</span></div>
                  <div className="mt-3"><Reacts s={s} id={obj.id} react={react} /></div>
                </div>
                <div data-card="1" className="mt-[14px] rounded-[16px] border border-line bg-surface p-5">
                  <div className="mb-3 text-[11px] font-bold uppercase tracking-[.06em] text-muted">{t.cli.role}</div>
                  <div className="flex items-center gap-[11px]">
                    <span className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] bg-blue-2 text-[14px] font-extrabold text-white">{myInitials}</span>
                    <div><div className="text-[14.5px] font-bold text-ink">{p.name}</div><div className="text-[12px] text-muted">{p.agency}</div></div>
                  </div>
                  <div className="mb-[11px] mt-[13px] text-[16px] font-extrabold tracking-[.01em] text-ink">{p.phone}</div>
                  <div className="flex flex-wrap gap-[14px]">
                    <a href={`tel:${p.phone.replace(/\s/g, "")}`} className="flex w-[54px] cursor-pointer flex-col items-center gap-[5px]">
                      <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full bg-blue-2 text-white hover:bg-blue-3"><IconPhone size={20} /></span>
                      <span className="text-[10.5px] font-semibold text-text-2">{t.obj.callL}</span>
                    </a>
                    {chans.map((c) => (
                      <a key={c.key} href={c.href} target={c.href === "#" ? undefined : "_blank"} rel="noreferrer" className="flex w-[54px] cursor-pointer flex-col items-center gap-[5px]">
                        <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full text-white hover:brightness-95" style={{ background: c.bg }}>{c.node(20)}</span>
                        <span className="text-[10.5px] font-semibold text-text-2">{c.title}</span>
                      </a>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// Reaction buttons (`rbn`, prototype 3508): active «Нравится» green, «Думаю» amber, «Не то» red; heart is always outlined.
function Reacts({ s, id, react }: { s: Selection; id: string; react: (id: string, r: Reaction) => void }) {
  const { t } = useI18n();
  const cur = s.reacts[id];
  const base = "inline-flex flex-1 cursor-pointer items-center justify-center gap-[5px] rounded-[9px] border px-1 py-[9px] text-center text-[12.5px] font-bold hover:bg-line-2";
  const off = "border-line bg-surface text-text-2";
  return (
    <div className="flex gap-[6px]">
      <span onClick={() => react(id, "like")} className={`${base} ${cur === "like" ? "border-green bg-green-tint text-green" : off}`}><IconHeart size={14} /> {t.cli.like}</span>
      <span onClick={() => react(id, "maybe")} className={`${base} ${cur === "maybe" ? "border-warn bg-warn-tint text-warn-2" : off}`}>{t.cli.maybe}</span>
      <span onClick={() => react(id, "no")} className={`${base} ${cur === "no" ? "border-red bg-red-tint text-red" : off}`}>{t.cli.no}</span>
    </div>
  );
}

function GoneBadge({ gone }: { gone: Exclude<Gone, null> }) {
  const { t } = useI18n();
  return <span className="absolute left-[10px] top-[10px] rounded-[8px] bg-[rgba(10,16,28,.78)] px-[10px] py-[5px] text-[11px] font-bold uppercase tracking-[.04em] text-white">{gone === "sold" ? t.cli.soldB : t.cli.offB}</span>;
}
/** Удалённое объявление — карточка по снимку: фото, заголовок, цена на момент подборки, плашка «Снят с продажи». */
function GoneCard({ id, snap, s }: { id: string; snap: SelSnap; s: Selection }) {
  const { t, lang } = useI18n();
  return (
    <div className="overflow-hidden rounded-[16px] border border-line bg-surface opacity-80">
      <div className="relative h-[210px] bg-cover bg-center grayscale" style={{ backgroundImage: `url('${snap.img}')` }}><GoneBadge gone="off" /></div>
      <div className="px-[15px] pt-[13px]">
        <div className="truncate text-[14.5px] font-bold text-ink">{snap.t[lang]}</div>
        <div className="mb-[2px] mt-[3px] text-[18.5px] font-extrabold text-muted line-through">{fmt(snap.price, snap.cur)}</div>
        <div className="mb-[9px] flex items-center gap-1 text-[12px] text-muted"><IconMapPin size={13} /> {snap.loc[lang]}</div>
      </div>
      <div className="px-[15px] pb-[13px]">
        {s.cm[id] && <div className="mt-[4px] flex items-start gap-2 rounded-[9px] border-l-[3px] border-l-line bg-bg-2 px-3 py-[9px] text-[12.5px] leading-[1.5] text-muted"><IconMessage2 size={14} className="mt-[1px] flex-none" /><span>{s.cm[id]}</span></div>}
        <div className="mt-[11px] border-t border-bg-4 pt-[10px] text-[11.5px] text-muted">{t.cli.goneHint}</div>
      </div>
    </div>
  );
}

function ClientCard({ o, s, gone = null, onOpen, react }: { o: Listing; s: Selection; gone?: Gone; onOpen: () => void; react: (id: string, r: Reaction) => void }) {
  const { t, lang } = useI18n();
  const [gi, setGi] = useState(0);
  const photos = o.photos.length ? o.photos : [o.img];
  const n = photos.length;
  const i = ((gi % n) + n) % n;
  const old = oldPrice(o);
  const hasOld = !!old && old > o.price;
  const arrow = "absolute top-1/2 flex h-[30px] w-[30px] -translate-y-1/2 cursor-pointer items-center justify-center rounded-full bg-[rgba(255,255,255,.92)] text-ink hover:brightness-95";
  return (
    <div className={`overflow-hidden rounded-[16px] border border-line bg-surface transition-shadow duration-150 hover:shadow-[0_12px_32px_rgba(20,36,63,.10)] ${gone ? "opacity-80" : ""}`}>
      <div onClick={onOpen} className={`relative h-[210px] cursor-pointer bg-cover bg-center hover:brightness-95 ${gone ? "grayscale" : ""}`} style={{ backgroundImage: `url('${photos[i]}')` }}>
        {gone && <GoneBadge gone={gone} />}
        <span onClick={(e) => { e.stopPropagation(); setGi(i - 1); }} className={`${arrow} left-2`}><IconChevronLeft size={14} /></span>
        <span onClick={(e) => { e.stopPropagation(); setGi(i + 1); }} className={`${arrow} right-2`}><IconChevronRight size={14} /></span>
        <span className="absolute bottom-[9px] right-[10px] inline-flex items-center gap-1 rounded-[8px] bg-[rgba(10,16,28,.6)] px-2 py-[3px] text-[10.5px] font-semibold text-white"><IconPhoto size={12} /> {i + 1} / {n}</span>
      </div>
      <div onClick={onOpen} className="cursor-pointer px-[15px] pt-[13px] hover:brightness-95">
        <div className="truncate text-[14.5px] font-bold text-ink">{o.t[lang]}</div>
        <div className="mb-[2px] mt-[3px] flex flex-wrap items-baseline gap-2">
          <span className="text-[18.5px] font-extrabold text-blue">{fmt(o.price, o.cur)}</span>
          {hasOld && <><span className="text-[12.5px] text-muted-2 line-through">{fmt(old!, o.cur)}</span><span className="rounded-[10px] bg-green-tint px-[7px] py-[2px] text-[10.5px] font-bold text-green">−{fmt(old! - o.price, o.cur)}</span></>}
        </div>
        <div className="mb-[9px] text-[11.5px] text-muted">{eqOf(o)}</div>
        {o.vnj && (
          <div className="-mt-[3px] mb-[9px] flex flex-wrap gap-[6px]">
            <span className="rounded-[10px] bg-[#e7f0fd] px-[9px] py-[3px] text-[10.5px] font-bold text-[#1565c0]">{t.cat.vnjChip}</span>
            {o.cit && <span className="rounded-[10px] bg-[#efe7fb] px-[9px] py-[3px] text-[10.5px] font-bold text-[#7b4fd0]">{t.cat.citChip}</span>}
          </div>
        )}
        <div className="flex flex-wrap gap-[10px] text-[12px] text-muted">
          {o.rooms && <span className="inline-flex items-center gap-1"><IconLayoutGrid size={13} /> {o.rooms}</span>}
          <span className="inline-flex items-center gap-1"><IconRuler size={13} /> {o.area} м²</span>
          {o.fl && o.fl !== "—" && <span className="inline-flex items-center gap-1"><IconStairs size={13} /> {o.fl}</span>}
          <span className="inline-flex items-center gap-1"><IconMapPin size={13} /> {o.loc[lang]}</span>
        </div>
      </div>
      <div className="px-[15px] pb-[13px]">
        {s.cm[o.id] && <div className="mt-[11px] flex items-start gap-2 rounded-[9px] border-l-[3px] border-l-blue bg-blue-tint px-3 py-[9px] text-[12.5px] leading-[1.5] text-sel-ink"><IconMessage2 size={14} className="mt-[1px] flex-none" /><span>{s.cm[o.id]}</span></div>}
        <div className="mt-[11px] border-t border-bg-4 pt-[10px]">{gone ? <span className="text-[11.5px] text-muted">{t.cli.goneHint}</span> : <Reacts s={s} id={o.id} react={react} />}</div>
      </div>
    </div>
  );
}

function ObjDetail({ o, card, h3 }: { o: Listing; card: string; h3: string }) {
  const { t, lang } = useI18n();
  const d = detail(o, t);
  const desc = o.desc ? o.desc[lang] || "" : "";
  return (
    <>
      <div data-card="1" className={`${card} mt-4`}>
        <div className={`${h3} mb-[14px]`}>{t.obj.keyT}</div>
        <div className="flex flex-wrap gap-[10px]">
          {d.tiles.map((k, i) => {
            const Icon = TILE_ICON[k.icon];
            return (
              <div key={i} className="flex min-w-[150px] flex-[1_1_150px] items-center gap-3 rounded-[14px] bg-bg px-4 py-[14px]">
                <Icon size={21} className="flex-none text-blue" />
                <div>
                  <div className="text-[15.5px] font-extrabold text-ink">{k.v}</div>
                  <div className="mt-[1px] text-[11.5px] text-muted">{k.l}</div>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-[14px] grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-x-8 gap-y-0">
          {d.paramRows.map((p, i) => (
            <div key={i} className="flex justify-between gap-3 border-b border-bg-4 px-[2px] py-[9px] text-[13px]"><span className="text-muted">{p.l}</span><span className="text-right font-bold text-ink">{p.v}</span></div>
          ))}
        </div>
      </div>
      {d.featsL.length > 0 && (
        <div data-card="1" className={`${card} mt-[18px]`}>
          <div className={h3}>{t.obj.inT}</div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2">{d.featsL.map((f) => <div key={f} className="flex items-center gap-2 text-[13.5px] text-[#3d4a5e]"><IconCheck size={15} className="text-green" /> {f}</div>)}</div>
        </div>
      )}
      {d.infraL.length > 0 && (
        <div data-card="1" className={`${card} mt-[18px]`}>
          <div className={h3}>{t.obj.infraT}</div>
          <div className="flex flex-wrap gap-2">{d.infraL.map((f) => <span key={f} className="rounded-[16px] bg-blue-tint px-[14px] py-[7px] text-[12.5px] font-semibold text-sel-ink">{f}</span>)}</div>
        </div>
      )}
      {!!o.desc && (
        <div data-card="1" className={`${card} mt-[18px]`}>
          <div className={h3}>{t.obj.descT}</div>
          <div className="whitespace-pre-line text-[14px] leading-[1.65] text-[#3d4a5e] [text-wrap:pretty]">{desc}</div>
        </div>
      )}
    </>
  );
}
