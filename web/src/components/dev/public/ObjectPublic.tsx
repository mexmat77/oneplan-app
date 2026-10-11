"use client";

// Public object page `/p/[slug]` — prototype `OnePlan v2.dc.html` lines 1319–1529 (`isPublic`), data 3679–3690, 3728, 3418,
// 4189–4213, 4279; spec §1.19 / §5.7. Sticky header, hidden stub (`pubHiddenView`), hero (cover, play, tags, LIVE, chips),
// stats, sticky anchors, gallery with category chips + lightbox, unit selection (`PubUnits`), diary, documents, files,
// location stub, footer with legal documents.
import { RichText } from "./RichText";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconArrowBackUp, IconArrowRight, IconDownload, IconEyeOff, IconFileDownload, IconFileText, IconLayoutGrid, IconMapPin, IconMapPinFilled, IconPhoto, IconPlayerPlayFilled, IconTimelineEvent, IconVideo } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { MEGA_INFO, STAGECOLOR, TAGCOLOR, asset, embedUrl, slugOf } from "@/lib/dev/data";
import { useDev } from "@/store/dev";
import { LiveModal } from "@/components/dev/media/LiveModal";
import { VideoModal } from "@/components/dev/media/VideoModal";
import { heroCover, photoUrl, splitPhoto, withDefaults } from "@/components/dev/object/shared";
import { LocMapLazy } from "@/components/dev/object/LocMapLazy";
import { displayLoc, llOf } from "@/lib/dev/geo";
import { useEnsureUnits } from "@/components/dev/board/shared";
import { PubLightbox, type LbState } from "./Lightbox";
import { PubUnits } from "./PubUnits";
import { DSTAT, Dots, LangSwitch, PubFooter, WaButton, useLegal } from "./shared";

const H2 = "mb-[14px] mt-[34px] scroll-mt-[120px] text-[22px] font-extrabold tracking-[-.02em] text-ink";
const chipBase = { fontSize: 11, fontWeight: 700, padding: "4px 11px", borderRadius: 20, whiteSpace: "nowrap" as const };

export function ObjectPublic({ slug }: { slug: string }) {
  const { t, lang } = useDevT();
  const s = useDev();
  const router = useRouter();
  const legal = useLegal();
  const [galCat, setGalCat] = useState("all");
  const [lb, setLb] = useState<LbState>(null);
  const [liveOpen, setLiveOpen] = useState(false);
  const [vidOpen, setVidOpen] = useState(false);

  const raw = s.projects.find((p) => slugOf(p.name) === slug);
  const obj = raw ? withDefaults(raw) : null;
  const units = raw ? s.units[raw.id] ?? [] : [];
  useEnsureUnits(raw?.id ?? 0, raw, units);
  const co = obj ? s.companies.find((c) => c.name === obj.client) : undefined;
  const coInactive = !!co && co.active === false;
  const stages = t.stages as Record<string, string>;
  const sales = t.sales as Record<string, string>;
  const tags = t.tags as Record<string, string>;
  const cats = t.cats as Record<string, string>;
  const docsub = t.docsub as Record<string, string>;
  const docstatus = t.docstatus as Record<string, string>;
  const tDict = t as unknown as Record<string, string>;
  const pubLoc = displayLoc(obj?.loc, t.geo.no_addr);
  const pubLL = llOf(raw?.lng, raw?.lat);

  const header = (
    <div className="sticky top-0 z-[60] flex h-[60px] items-center gap-[14px] border-b border-line bg-[rgba(255,255,255,.95)] px-[clamp(16px,5vw,40px)] backdrop-blur-[8px]">
      <Dots size={11} />
      <div className="min-w-0"><div className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-extrabold text-ink">{obj ? obj.name : slug}</div><div className="text-[11px] text-text-2">{t.pub.by}{obj ? ` · ${obj.client}` : ""}</div></div>
      <div className="flex-1" />
      {obj && <span onClick={() => router.push(`/d/${slugOf(obj.client)}`)} className="flex-none cursor-pointer whitespace-nowrap text-[13px] font-semibold text-blue">{t.dev.all}</span>}
      <LangSwitch />
      <WaButton phone={co?.phone} />
      <span onClick={() => router.push(obj ? `/dev/objects/${obj.id}` : "/dev/objects")} title={t.pub.back} className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[9px] border border-line text-muted hover:text-ink"><IconArrowBackUp size={17} /></span>
    </div>
  );

  const hidden = !obj || !!obj.pubHidden || obj.stage === "done" || !!obj.hidden || coInactive;
  if (!obj || hidden) {
    return (
      <div className="min-h-screen bg-surface">
        {header}
        <div className="flex min-h-[60vh] items-center justify-center p-[30px]">
          <div className="max-w-[420px] text-center">
            <div className="mx-auto mb-[18px] flex h-[74px] w-[74px] items-center justify-center rounded-[22px] bg-[#eef0f4] text-[34px] text-muted"><IconEyeOff size={34} /></div>
            <div className="mb-2 text-[22px] font-extrabold text-ink">{obj ? obj.name : t.px.obj_not_found}</div>
            {obj && <div className="mb-[22px] text-[14.5px] text-text-2">{t.hub.hidden_msg}</div>}
            {obj && <button type="button" onClick={() => router.push(`/d/${slugOf(obj.client)}`)} className="inline-flex cursor-pointer items-center gap-[7px] rounded-[11px] border-0 bg-blue px-5 py-3 text-[14px] font-bold text-white hover:bg-[#3a63d4]">{t.dev.all} <IconArrowRight size={16} /></button>}
          </div>
        </div>
        <PubFooter onLegal={legal.open} />
        {legal.node}
      </div>
    );
  }

  const isMega = obj.mega === true;
  const freeCount = units.filter((u) => u.status === "free").length;
  const pubStats: [string, string][] = isMega
    ? MEGA_INFO.filter((x) => x[0] !== "tapu").map((x) => [tDict[`mega_${x[0]}`] || x[0], x[1]])
    : [[t.hub.units_total, String(units.length)], [t.status.free, String(freeCount)], [t.dev.ready, `${obj.ready || 0}%`], [t.th_stage, stages[obj.stage]]];
  const liveUrl = (obj.live || "").trim();
  const videoUrl = embedUrl(obj.video || "");
  const cover = heroCover(obj);
  const desc = (obj.descs[lang] || obj.descs.RU || "").trim();

  // Gallery (prototype 3680–3687): categories from `#cat=`, chips when > 1 category; videos are not shown as images.
  const pgAll = obj.photos.map((p) => splitPhoto(p)).filter((g) => !g.vid).map((g) => ({ src: photoUrl(g.raw, "?w=560&h=400&fit=crop"), full: photoUrl(g.raw, "?w=1600&fit=max"), cat: g.cat }));
  const galKeys = Array.from(new Set(pgAll.map((g) => g.cat)));
  const gallery = pgAll.filter((g) => galCat === "all" || g.cat === galCat);
  const galFull = gallery.map((g) => g.full);

  const pubChips: { label: string; style: React.CSSProperties }[] = [
    { label: stages[obj.stage], style: { ...chipBase, color: "#fff", background: STAGECOLOR[obj.stage] || "#4d7cfe" } },
    { label: obj.iskan ? t.dx.iskan_ok : t.px.iskan_no, style: { ...chipBase, ...(obj.iskan ? { background: "rgba(15,157,107,.92)", color: "#fff" } : { background: "rgba(255,255,255,.18)", color: "#e6edf8" }) } },
    { label: sales[obj.salesSt || "open"], style: { ...chipBase, background: "rgba(255,255,255,.18)", color: "#fff" } },
    { label: `${t.dev.ready} ${obj.ready || 0}%`, style: { ...chipBase, background: "rgba(255,255,255,.18)", color: "#9df0cb" } },
  ];
  const docsTr: [string, "yapi" | "iskan" | "tapu" | "dask"][] = [["Yapı Ruhsatı", "yapi"], ["İskan", "iskan"], ["Tapu · Kat İrtifakı", "tapu"], ["DASK", "dask"]];
  const navLink = "flex flex-none items-center whitespace-nowrap rounded-[9px] px-[14px] py-[9px] text-[13px] font-semibold text-[#4a5567] no-underline hover:bg-blue-tint hover:text-blue";

  return (
    <div className="min-h-screen bg-surface">
      {header}

      <div className="relative h-[clamp(240px,36vw,400px)] bg-ink">
        <div className="h-full w-full bg-cover bg-center opacity-[.85]" style={{ backgroundImage: `url('${cover}')` }} />
        <div className="absolute inset-0 bg-[linear-gradient(180deg,rgba(10,18,34,.05)_30%,rgba(10,18,34,.75))]" />
        {videoUrl && (
          <div onClick={() => setVidOpen(true)} className="absolute inset-0 flex cursor-pointer items-center justify-center hover:bg-[rgba(10,18,34,.12)]">
            <span className="flex h-[74px] w-[74px] items-center justify-center rounded-full bg-[rgba(255,255,255,.94)] pl-[5px] text-[30px] text-ink shadow-[0_10px_30px_rgba(0,0,0,.4)] transition-transform hover:scale-[1.06]"><IconPlayerPlayFilled size={30} /></span>
          </div>
        )}
        <div className="pointer-events-none absolute bottom-[54px] left-[clamp(16px,5vw,40px)] right-[clamp(16px,5vw,40px)]">
          <div className="mb-[10px] flex flex-wrap gap-[5px]">{obj.tags.map((k) => <span key={k} className="mr-1 whitespace-nowrap rounded-[6px] px-2 py-[3px] text-[11px] font-semibold" style={{ background: TAGCOLOR[k][1], color: TAGCOLOR[k][0] }}>{tags[k]}</span>)}</div>
          <h1 className="text-[clamp(26px,4.5vw,44px)] font-extrabold leading-[1.05] tracking-[-.02em] text-white">{obj.name}</h1>
          <div className="mt-[6px] flex items-center gap-[6px] text-[15px] text-[#d7e0ef]"><IconMapPin size={16} /> {pubLoc}</div>
          <div className="pointer-events-auto mt-3 flex flex-wrap items-center gap-[6px]">
            {liveUrl && <span onClick={() => setLiveOpen(true)} className="inline-flex cursor-pointer items-center gap-[7px] rounded-[20px] bg-red px-[13px] py-[6px] text-[12px] font-extrabold text-white shadow-[0_4px_14px_rgba(229,72,77,.5)] hover:bg-[#d13b40]"><span className="h-[7px] w-[7px] rounded-full bg-white" style={{ animation: "oplPulse 1.6s infinite" }} />{t.dx.live} · {t.pub.live_watch}</span>}
            {pubChips.map((c) => <span key={c.label} style={c.style}>{c.label}</span>)}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-[clamp(16px,5vw,40px)] pb-[60px]">
        <div className="grid -translate-y-[26px] grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-3">
          {pubStats.map(([label, value]) => <div key={label} className="rounded-[14px] border border-line bg-surface px-4 py-[14px] shadow-[0_10px_26px_rgba(20,36,63,.08)]"><div className="mb-[3px] text-[12px] text-text-2">{label}</div><div className="text-[20px] font-extrabold text-ink">{value}</div></div>)}
        </div>

        <div className="sticky top-[60px] z-20 mb-2 border-b border-line-2 bg-[rgba(255,255,255,.96)] backdrop-blur-[8px]">
          <div className="flex gap-1 overflow-x-auto py-1 [-webkit-overflow-scrolling:touch]">
            <a href="#opl-gallery" className={navLink}><IconPhoto size={15} className="mr-[5px]" />{t.pub.gallery}</a>
            <a href="#opl-units" className={navLink}><IconLayoutGrid size={15} className="mr-[5px]" />{t.pub.choose}</a>
            <a href="#opl-diary" className={navLink}><IconTimelineEvent size={15} className="mr-[5px]" />{t.edp.nav_prog}</a>
            <a href="#opl-docs" className={navLink}><IconFileText size={15} className="mr-[5px]" />{t.pub.docs}</a>
            <a href="#opl-loc" className={navLink}><IconMapPin size={15} className="mr-[5px]" />{t.pub.loc}</a>
          </div>
        </div>

        {desc && (
          <>
            <h2 className="mb-[10px] mt-[26px] text-[22px] font-extrabold tracking-[-.02em] text-ink">{t.pub.about}</h2>
            <RichText text={desc} moreLabel={t.pub.read_more} lessLabel={t.pub.read_less} />
          </>
        )}

        <h2 id="opl-gallery" className="mb-[14px] mt-[26px] scroll-mt-[120px] text-[22px] font-extrabold tracking-[-.02em] text-ink">{t.pub.gallery}</h2>
        {galKeys.length > 1 && (
          <div className="mb-3 flex flex-wrap gap-[7px]">
            {["all", ...galKeys].map((k) => <span key={k} onClick={() => setGalCat(k)} className={`cursor-pointer whitespace-nowrap rounded-[20px] border px-[14px] py-2 text-[12.5px] font-semibold ${galCat === k ? "border-ink bg-ink text-white" : "border-line bg-surface text-text-2"}`}>{k === "all" ? cats.all : cats[k] || k}</span>)}
          </div>
        )}
        <div className="grid auto-cols-[minmax(220px,280px)] grid-flow-col gap-3 overflow-x-auto pb-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          {gallery.map((g, i) => <div key={g.src + i} onClick={() => setLb({ list: galFull, idx: i })} className="aspect-[7/5] cursor-zoom-in overflow-hidden rounded-[14px] bg-[#eee]"><img src={g.src} loading="lazy" alt="" className="h-full w-full object-cover" /></div>)}
        </div>

        <h2 id="opl-units" className="mb-[6px] mt-[34px] scroll-mt-[120px] text-[22px] font-extrabold tracking-[-.02em] text-ink">{t.pub.choose}</h2>
        <PubUnits obj={obj} units={units} />

        <h2 id="opl-diary" className={H2}>{t.edp.nav_prog}</h2>
        <div className="flex flex-col gap-[2px]">
          {obj.prog.map((pr, i) => {
            const items = (pr.ph || []).map((id) => { const v = splitPhoto(id); return { isVid: v.vid, src: photoUrl(v.raw, "?w=200&h=150&fit=crop"), full: photoUrl(v.raw, "?w=1600&fit=max") }; });
            const imgs = items.filter((x) => !x.isVid).map((x) => x.full);
            return (
              <div key={i} className="flex gap-3">
                <div className="flex w-3 flex-none flex-col items-center"><span className="mt-[5px] h-[11px] w-[11px] flex-none rounded-full bg-blue" />{i < obj.prog.length - 1 && <span className="mt-[3px] w-[2px] flex-1 bg-line" />}</div>
                <div className="flex-1 pb-[18px]">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-[12px] font-bold text-muted">{pr.d}</span>{items.some((x) => x.isVid) && <span className="text-[14px] text-muted"><IconVideo size={14} /></span>}</div>
                  <div className="mt-[2px] text-[15px] text-ink-2">{pr.t}</div>
                  {items.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {items.map((th, j) => th.isVid
                        ? <div key={j} className="flex h-[86px] w-[120px] items-center justify-center rounded-[10px] bg-ink text-white"><IconPlayerPlayFilled size={20} /></div>
                        // eslint-disable-next-line @next/next/no-img-element
                        : <img key={j} onClick={() => setLb({ list: imgs, idx: imgs.indexOf(th.full) })} src={th.src} loading="lazy" alt="" className="h-[86px] w-[120px] cursor-zoom-in rounded-[10px] object-cover" />)}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        <h2 id="opl-docs" className={H2}>{t.pub.docs}</h2>
        <div className="mb-[14px] grid grid-cols-[repeat(auto-fit,minmax(260px,1fr))] gap-3">
          {docsTr.map(([title, key]) => {
            const st = obj.docs[key];
            return (
              <div key={key} className="flex items-center gap-[11px] rounded-[12px] border border-line px-[15px] py-[13px]">
                <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px] bg-blue-tint text-blue"><IconFileText size={18} /></div>
                <div className="min-w-0 flex-1"><div className="text-[14px] font-semibold text-ink">{title}</div><div className="text-[12px] text-text-2">{docsub[key]}</div></div>
                <span className="flex-none whitespace-nowrap rounded-[7px] px-[9px] py-1 text-[11px] font-semibold" style={{ background: DSTAT[st][0], color: DSTAT[st][1] }}>{docstatus[st]}</span>
              </div>
            );
          })}
        </div>
        <div className="grid grid-cols-[repeat(auto-fit,minmax(250px,1fr))] gap-[10px]">
          {obj.files.map((f, i) => (
            <div key={i} className="flex items-center gap-[11px] rounded-[12px] border border-line bg-[#fafbfd] px-[14px] py-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-blue-tint text-blue"><IconFileDownload size={18} /></div>
              <div className="min-w-0 flex-1"><div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-semibold text-ink">{f.n}</div><div className="text-[12px] text-text-2">{f.s}</div></div>
              <a href={f.u ? asset(f.u) : undefined} target="_blank" rel="noopener" className="inline-flex flex-none cursor-pointer items-center gap-1 whitespace-nowrap rounded-[8px] bg-blue px-[11px] py-[5px] text-[11px] font-bold text-white"><IconDownload size={13} /> {t.btn_download}</a>
            </div>
          ))}
        </div>

        <h2 id="opl-loc" className={H2}>{t.pub.loc}</h2>
        {/* Карта только для чтения при наличии координат у проекта (без дефолтов прототипа); иначе — заглушка прототипа. */}
        {pubLL ? (
          <div className="relative overflow-hidden rounded-[16px] border border-line">
            <LocMapLazy ll={pubLL} readOnly height={280} className="!rounded-[16px]" />
            <div className="pointer-events-none absolute bottom-[14px] left-4 z-[1] flex max-w-[calc(100%-32px)] items-center gap-1 rounded-[10px] bg-surface px-[14px] py-2 text-[13px] font-semibold text-ink shadow-[0_6px_18px_rgba(20,36,63,.12)]"><IconMapPin size={14} className="flex-none" /> <span className="overflow-hidden text-ellipsis whitespace-nowrap">{pubLoc}</span></div>
          </div>
        ) : (
          <div className="relative h-[220px] rounded-[16px] border border-line bg-[linear-gradient(135deg,#e8eef7,#dde6f2)]">
            <IconMapPinFilled size={40} className="absolute left-1/2 top-[45%] -translate-x-1/2 -translate-y-full text-blue" />
            <div className="absolute bottom-[14px] left-4 flex items-center gap-1 rounded-[10px] bg-surface px-[14px] py-2 text-[13px] font-semibold text-ink shadow-[0_6px_18px_rgba(20,36,63,.12)]"><IconMapPin size={14} /> {pubLoc}</div>
          </div>
        )}
      </div>

      <PubFooter onLegal={legal.open} />
      {legal.node}
      {lb && <PubLightbox list={lb.list} idx={lb.idx} onClose={() => setLb(null)} />}
      {liveOpen && liveUrl && <LiveModal url={liveUrl} title={obj.name} onClose={() => setLiveOpen(false)} />}
      {vidOpen && videoUrl && <VideoModal url={obj.video || ""} title={obj.name} onClose={() => setVidOpen(false)} />}
    </div>
  );
}
