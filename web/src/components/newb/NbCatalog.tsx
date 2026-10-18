"use client";

// New-build catalogue — prototype markup lines 961–1077, logic 3953–3979, 3868–3881 and 4087–4140.
// Filter state lives in `useNbUi()` (memory only, like the prototype) so it survives the dev-page / project routes.
import dynamic from "next/dynamic";
import Link from "next/link";
import { useState, type MouseEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import {
  IconAdjustmentsHorizontal, IconArrowLeft, IconBuildingCommunity, IconCalendarDollar, IconChevronDown, IconCrane, IconLayoutGrid, IconMap2, IconMapPin, IconSearch, IconX,
} from "@tabler/icons-react";
import { GeoPicker, geoLabelOf } from "@/components/GeoPicker";
import { fgeo, fgeoBox, ficon, fpill } from "@/components/catalog/fpill";
import { LogoMark } from "@/components/Logo";
import { useBackClose, useEscape, useScrollLock } from "@/hooks/useScrollLock";
import { useI18n } from "@/i18n/provider";
import { fmt, fmtShort } from "@/lib/money";
import { GEO, SEMT2ILCE, geoKeysOf } from "@/lib/seed";
import { useMahalleLoaded } from "@/lib/geo";
import type { MapItem } from "@/components/catalog/CatalogMap";
import { SALES_STYLE, curSym, filterProjects, minPlanPrice, nbMoreN, nbResetActive, pinShort, type NbFilter, type NbType, type Project } from "@/lib/newb";
import { FEATS } from "@/lib/types";
import { useNbUi } from "@/store/newb";

const CatalogMap = dynamic(() => import("@/components/catalog/CatalogMap"), { ssr: false, loading: () => <div className="mx-[calc(50%-50vw)] h-[calc(100dvh-88px)] bg-line-2" /> });

// Prototype `chipF` (filter chips) and the shared label style of the «Ещё» panel groups.
const chipF = (on: boolean) => `cursor-pointer rounded-[18px] border px-[13px] py-[9px] text-[12.5px] transition-[background,border-color] duration-[120ms] hover:bg-line-2 ${on ? "border-[#9db8f5] bg-blue-tint font-bold text-[#2c4a9e]" : "border-line bg-surface font-semibold text-[#3d4a5e]"}`;
const groupL = "mb-2 text-[12px] font-bold uppercase tracking-[.04em] text-muted";
const inp = "min-w-0 rounded-[10px] border border-line px-[11px] py-[9px] text-[13px] outline-none focus:border-blue";
const ROOMS = ["1+0", "1+1", "2+1", "3+1", "4+1", "4+2"];
type Panel = "" | "type" | "rooms" | "price" | "area" | "more";

export function NbCatalog({ projects, dev }: { projects: Project[]; dev: string | null }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { f, vm, set, reset, setVm } = useNbUi();
  const mahalleReady = useMahalleLoaded(); // ключи махалле для карты появляются после загрузки справочника
  const [panel, setPanel] = useState<Panel>("");
  const [pLeft, setPLeft] = useState(0);
  const [geoOpen, setGeoOpen] = useState(false);
  const rows = filterProjects(projects, f, dev);
  const moreN = nbMoreN(f);
  const geoLabel = geoLabelOf({ il: f.il, ilces: f.ilces, semts: f.semts }, t.geo.all);
  const hrefOf = (p: Project) => `/newb?p=${p.k}${dev ? `&dev=${encodeURIComponent(dev)}` : ""}`;
  // Та же карта с полигонами, что у вторички: проект → пункт карты (ключи il/ilçe/mahalle из текста `geo`).
  const mapItems: MapItem[] = vm !== "map" ? [] : rows.map((p) => {
    const [il, ilce, semt] = p.geo.split("·").map((x) => x.trim());
    const g = geoKeysOf(il, ilce, semt);
    const price = minPlanPrice(p);
    const tip = `<div style="display:flex;gap:10px;width:252px;align-items:stretch"><div style="width:96px;min-height:88px;flex:none;margin:-7px 0 -7px -7px;border-radius:15px 0 0 15px;background-image:url('${p.ph[0]?.img ?? ""}');background-size:cover;background-position:center"></div><div style="min-width:0;padding:2px 0"><div style="font-weight:700;font-size:12.5px;color:#14243f;line-height:1.3;max-height:33px;overflow:hidden">${p.n}</div><div style="font-size:11px;color:#8a93a2;margin-top:2px">${p.geo}</div><div style="font-size:11px;color:#5a6472;margin-top:3px">${p.dev} · ${p.dlv}</div><div style="font-weight:800;font-size:14px;color:#14243f;margin-top:5px">${t.newb.fromM} ${fmtShort(price)} ${curSym(p.cur)}</div></div></div>`;
    return { id: p.k, ll: p.ll, price, il: g.il, ilce: g.ilce, semt: g.semt, pin: `${t.newb.fromM} ${pinShort(price)} ${curSym(p.cur)}`, tip, href: hrefOf(p) };
  });
  void mahalleReady; void lang;
  const closePanel = () => setPanel("");
  useBackClose(!!panel, closePanel);
  useScrollLock(panel === "more");
  useScrollLock(!!panel && panel !== "more", true);
  useEscape(!!panel, closePanel);

  // Prototype `nbFBtns[].open` (4095–4097): the quick panel opens under the pressed pill, clamped to the bar width − 440.
  const openQuick = (k: Panel) => (e: MouseEvent<HTMLElement>) => {
    const el = e.currentTarget;
    const sc = el.closest<HTMLElement>("[data-fbar-scroll]"), bar = el.closest<HTMLElement>("[data-fbar]");
    const ww = bar ? bar.clientWidth : 1200;
    setPLeft(Math.max(0, Math.min(el.offsetLeft - (sc ? sc.scrollLeft : 0), ww - 440 - 10)));
    setPanel(panel === k ? "" : k);
  };
  const toggleArr = (key: "rooms" | "feats", v: string) => set({ [key]: f[key].includes(v) ? f[key].filter((x) => x !== v) : [...f[key], v] } as Partial<NbFilter>);
  const pills: { k: Panel; label: string; on: boolean }[] = [
    { k: "type", label: t.cat.typeT + (f.type ? " · ✓" : ""), on: !!f.type },
    { k: "rooms", label: t.cat.roomsT + (f.rooms.length ? ` · ${f.rooms.length}` : ""), on: f.rooms.length > 0 },
    { k: "price", label: t.cat.priceT + (f.min || f.max ? " · ✓" : ""), on: !!(f.min || f.max) },
    { k: "area", label: t.cat.areaT + (f.abMin || f.abMax ? " · ✓" : ""), on: !!(f.abMin || f.abMax) },
  ];
  // Prototype `nbFilterChips` (4121–4131).
  const chips: { l: string; del: () => void }[] = [];
  // расположение — первыми, как во вторичке (`CatalogGrid`)
  const rmG = (key: "ilces" | "semts", v: string) => set({ [key]: f[key].filter((x) => x !== v) });
  if (f.il && !f.ilces.length) chips.push({ l: GEO.find((x) => x.k === f.il)?.n ?? f.il, del: () => set({ il: "", ilces: [], semts: [] }) });
  f.ilces.forEach((k) => { if (!f.semts.some((x) => SEMT2ILCE[x] === k)) chips.push({ l: GEO.flatMap((g) => g.ilces).find((x) => x.k === k)?.n ?? k, del: () => rmG("ilces", k) }); });
  f.semts.forEach((k) => chips.push({ l: GEO.flatMap((g) => g.ilces).flatMap((ic) => ic.semts).find((x) => x.k === k)?.n ?? k, del: () => rmG("semts", k) }));
  if (f.type) chips.push({ l: t.typ[f.type], del: () => set({ type: "" }) });
  f.rooms.forEach((r) => chips.push({ l: r, del: () => toggleArr("rooms", r) }));
  if (f.min || f.max) chips.push({ l: `${t.cat.priceT} ${f.min || "0"}—${f.max || "∞"}`, del: () => set({ min: "", max: "" }) });
  if (f.abMin || f.abMax) chips.push({ l: `${t.cat.areaT} ${f.abMin || "0"}—${f.abMax || "∞"}`, del: () => set({ abMin: "", abMax: "" }) });
  if (f.dlv) chips.push({ l: `${t.newb.dlvT} ${f.dlv}`, del: () => set({ dlv: "" }) });
  if (f.inst) chips.push({ l: t.newb.instB, del: () => set({ inst: false }) });
  if (f.salesOpen) chips.push({ l: t.newb.salesL.open, del: () => set({ salesOpen: false }) });
  f.feats.forEach((k) => chips.push({ l: t.feat[k as keyof typeof t.feat] ?? k, del: () => toggleArr("feats", k) }));
  if (f.q) chips.push({ l: `«${f.q}»`, del: () => set({ q: "" }) });

  const pActive = panel === "type" ? !!f.type : panel === "rooms" ? f.rooms.length > 0 : panel === "price" ? !!(f.min || f.max) : panel === "area" ? !!(f.abMin || f.abMax) : false;
  const pReset = () => { if (panel === "type") set({ type: "" }); else if (panel === "rooms") set({ rooms: [] }); else if (panel === "price") set({ min: "", max: "" }); else if (panel === "area") set({ abMin: "", abMax: "" }); };
  const resetBtn = (act: boolean, fn: () => void) => <button type="button" onClick={fn} className={`flex-none cursor-pointer rounded-[10px] px-[14px] py-[10px] text-[12.5px] font-bold hover:text-red ${act ? "bg-red-tint text-red" : "bg-transparent text-[#aab1bd]"}`}>{t.cat.resetBtn}</button>;
  const showBtn = <button type="button" onClick={closePanel} className="flex-none cursor-pointer rounded-[10px] bg-blue-2 px-5 py-[10px] text-[13px] font-bold text-white hover:bg-blue-3">{t.geo.show} {rows.length}</button>;
  const typeChips = <div className="flex flex-wrap gap-[7px]">{([["", t.cat.anyL], ["flat", t.typ.flat], ["house", t.typ.house], ["comm", t.typ.comm]] as [NbType, string][]).map(([k, l]) => <span key={k} onClick={() => set({ type: k })} className={chipF(f.type === k)}>{l}</span>)}</div>;
  const roomChips = <div className="flex flex-wrap gap-[7px]">{ROOMS.map((r) => <span key={r} onClick={() => toggleArr("rooms", r)} className={chipF(f.rooms.includes(r))}>{r}</span>)}</div>;
  const geoBtn = (
    <div onClick={() => setGeoOpen(true)} className={`w-full ${fgeoBox(!!f.il)}`}>
      <IconMapPin size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${ficon(!!f.il)}`} />{geoLabel}<IconChevronDown size={14} className={`absolute right-[11px] top-1/2 -translate-y-1/2 ${ficon(!!f.il)}`} />
    </div>
  );
  const panelBody: Record<Exclude<Panel, "">, ReactNode> = {
    rooms: roomChips,
    area: <div className="flex items-center gap-2"><input value={f.abMin} onChange={(e) => set({ abMin: e.target.value })} placeholder={t.cat.fromS} className={`${inp} flex-1`} inputMode="numeric" /><span className="text-[#c3c9d4]">—</span><input value={f.abMax} onChange={(e) => set({ abMax: e.target.value })} placeholder={t.cat.toS} className={`${inp} flex-1`} inputMode="numeric" /><span className="text-[13px] text-muted">м²</span></div>,
    price: <div className="flex items-center gap-2"><input value={f.min} onChange={(e) => set({ min: e.target.value })} placeholder={t.cat.fromS} className={`${inp} flex-1`} inputMode="numeric" /><span className="text-[#c3c9d4]">—</span><input value={f.max} onChange={(e) => set({ max: e.target.value })} placeholder={t.cat.toS} className={`${inp} flex-1`} inputMode="numeric" /><span className="text-[13px] text-muted">млн ₺</span></div>,
    type: typeChips,
    more: (
      <>
        <div data-nb-morebody="1" className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto pr-[6px]">
          <div><div className={groupL}>{t.geo.loc} · İl / İlçe / Mahalle</div>{geoBtn}</div>
          <div data-mob-panel="1" className="hidden"><div className={groupL}>{t.newb.q}</div><div className="relative"><IconSearch size={14} className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted" /><input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t.newb.q} className={`${inp} w-full py-[10px] pl-8`} /></div></div>
          <div><div className={groupL}>{t.cat.priceT}</div><div className="flex items-center gap-2"><input value={f.min} onChange={(e) => set({ min: e.target.value })} placeholder={t.newb.fromMln} className={`${inp} w-[120px] flex-none`} inputMode="numeric" /><span className="text-[#c3c9d4]">—</span><input value={f.max} onChange={(e) => set({ max: e.target.value })} placeholder={t.cat.toS} className={`${inp} w-[120px] flex-none`} inputMode="numeric" /></div></div>
          <div><div className={groupL}>{t.cat.typeT}</div>{typeChips}</div>
          <div><div className={groupL}>{t.cat.roomsT}</div>{roomChips}</div>
          <div><div className={groupL}>{t.cat.areaT}</div><div className="flex items-center gap-2"><input value={f.abMin} onChange={(e) => set({ abMin: e.target.value })} placeholder={t.cat.fromS} className={`${inp} w-[120px] flex-none`} inputMode="numeric" /><span className="text-[#c3c9d4]">—</span><input value={f.abMax} onChange={(e) => set({ abMax: e.target.value })} placeholder={t.cat.toS} className={`${inp} w-[120px] flex-none`} inputMode="numeric" /></div></div>
          <div><div className={groupL}>{t.newb.dlvT}</div><div className="flex flex-wrap gap-[7px]">{[["", t.cat.anyL], ["2026", "2026"], ["2027", "2027"]].map(([k, l]) => <span key={k} onClick={() => set({ dlv: k })} className={chipF(f.dlv === k)}>{l}</span>)}</div></div>
          <div><div className={groupL}>{t.cat.quickT}</div><div className="flex flex-wrap gap-[7px]"><span onClick={() => set({ inst: !f.inst })} className={chipF(f.inst)}>{t.newb.instB}</span><span onClick={() => set({ salesOpen: !f.salesOpen })} className={chipF(f.salesOpen)}>{t.newb.salesL.open}</span></div></div>
          <div><div className={groupL}>{t.cat.featT}</div><div className="flex flex-wrap gap-[7px]">{FEATS.map((k) => <span key={k} onClick={() => toggleArr("feats", k)} className={chipF(f.feats.includes(k))}>{t.feat[k]}</span>)}</div></div>
        </div>
        <div data-nb-foot="1" className="mt-auto flex flex-none items-center justify-between gap-2 border-t border-[#eef1f6] bg-surface pb-[max(2px,env(safe-area-inset-bottom))] pt-3">{resetBtn(nbResetActive(f), reset)}{showBtn}</div>
      </>
    ),
  };
  const panelTitle = panel === "rooms" ? t.cat.roomsT : panel === "type" ? t.cat.typeT : panel === "more" ? t.cat.moreT : panel === "area" ? t.cat.areaT : t.cat.priceT;
  const vmBtn = (on: boolean) => `flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[8px] hover:bg-line-2 ${on ? "bg-surface text-ink shadow-[0_1px_3px_rgba(20,36,63,.12)]" : "text-muted"}`;
  const moreBadge = (cls: string) => moreN > 0 && <span className={cls}>{moreN}</span>;

  return (
    <>
      <div className="mb-3 flex w-fit gap-[6px] rounded-[12px] bg-line-2 p-1">
        <Link href="/catalog" className="rounded-[9px] px-[14px] py-[7px] text-[12.5px] font-bold text-text-2 hover:bg-line-2">{t.newb.resale}</Link>
        <span className="rounded-[9px] bg-surface px-[14px] py-[7px] text-[12.5px] font-bold text-ink shadow-[0_1px_3px_rgba(20,36,63,.1)]">{t.newb.title}</span>
      </div>
      {dev ? (
        <>
          <Link href="/newb" className="mb-[10px] inline-flex items-center gap-[6px] text-[13.5px] font-semibold text-text hover:text-ink"><IconArrowLeft size={16} /> {t.newb.allL}</Link>
          <div className="mb-4 flex items-center gap-[13px]">
            <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-full bg-blue-2 text-[17px] font-bold text-white"><IconBuildingCommunity size={22} /></span>
            <div><h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{dev}</h1><div className="text-[13px] text-muted">{t.newb.dev} · {rows.length} {t.newb.projN}</div></div>
          </div>
        </>
      ) : (
        <>
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.newb.title}</h1>
          <p className="mb-4 mt-[5px] max-w-[640px] text-[14px] text-text-2 [text-wrap:pretty]">{t.newb.sub}</p>
        </>
      )}

      <div data-fsticky="1" className="sticky top-0 z-150 mb-[14px]">
        <div data-fbar="1" className="flex flex-nowrap items-center rounded-[16px] border border-line bg-surface px-[6px] py-[5px] shadow-[0_1px_3px_rgba(20,36,63,.05)]">
          <Link href="/catalog" data-fbar-logo="1" aria-label="OnePlan" className="hidden h-[42px] w-[42px] flex-none items-center justify-center rounded-[10px] hover:bg-bg-3"><LogoMark size={26} /></Link>
          <div data-fbar-scroll="1" className="flex min-w-0 flex-1 items-center overflow-x-auto">
            <span data-fmore="1" onClick={() => setPanel(panel === "more" ? "" : "more")} title={t.cat.moreT} className={`${fpill(moreN > 0, panel === "more")} rounded-l-[10px]`}>
              <IconAdjustmentsHorizontal size={17} /><span data-more-label="1"> {t.cat.moreB}</span>{moreBadge("inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] bg-blue-2 px-1 text-[10px] font-bold text-white")}
            </span>
            <div data-fgeo="1" onClick={() => setGeoOpen(true)} className={fgeo(!!f.il)}>
              <IconMapPin size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${ficon(!!f.il)}`} />{geoLabel}<IconChevronDown size={14} className={`absolute right-[11px] top-1/2 -translate-y-1/2 ${ficon(!!f.il)}`} />
            </div>
            {pills.map((b) => (
              <span key={b.k} data-fbtn="1" onClick={openQuick(b.k)} className={fpill(b.on, panel === b.k)}>{b.label} <IconChevronDown size={12} className={ficon(b.on)} /></span>
            ))}
            <div data-fdesk="1" className="relative min-w-[190px] max-w-[460px] flex-1">
              <IconSearch size={14} className="absolute left-[10px] top-1/2 -translate-y-1/2 text-muted" />
              <input value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder={t.newb.q} className="w-full bg-transparent py-3 pl-[30px] pr-[6px] text-[13px] font-semibold text-ink outline-none" />
            </div>
          </div>
          <span data-mob-more="1" onClick={() => setPanel(panel === "more" ? "" : "more")} className="relative hidden h-[42px] w-[42px] flex-none cursor-pointer items-center justify-center rounded-[10px] text-ink">
            <IconAdjustmentsHorizontal size={19} />{moreBadge("absolute right-[1px] top-[2px] inline-flex h-4 min-w-4 items-center justify-center rounded-lg bg-blue-2 px-1 text-[9.5px] font-bold text-white")}
          </span>
          <div data-viewsw="1" className="flex flex-none gap-[3px] rounded-[10px] bg-[#f0f2f6] p-[3px]">
            <span onClick={() => setVm("list")} className={vmBtn(vm === "list")}><IconLayoutGrid size={16} /></span>
            <span onClick={() => setVm("map")} className={vmBtn(vm === "map")}><IconMap2 size={16} /></span>
          </div>
        </div>
        {!panel && !geoOpen && (
          <span data-view-fab="1" onClick={() => setVm(vm === "map" ? "list" : "map")} className="fixed bottom-[calc(20px+env(safe-area-inset-bottom))] right-[14px] z-640 hidden h-[54px] w-[54px] cursor-pointer items-center justify-center rounded-full bg-ink text-white shadow-[0_10px_30px_rgba(20,36,63,.4)]">
            {vm === "map" ? <IconLayoutGrid size={23} /> : <IconMap2 size={23} />}
          </span>
        )}
        {panel && (
          <>
            <div onClick={closePanel} data-f-dim="1" className={`fixed inset-0 ${panel === "more" ? "z-335 bg-[rgba(10,16,28,.45)]" : "z-151"}`} />
            <div
              data-f-sheet="1"
              data-sheet-tall={panel === "more" ? "1" : "0"}
              className={panel === "more"
                ? "fixed left-1/2 top-[4vh] z-340 flex h-[90vh] w-[min(96vw,980px)] -translate-x-1/2 flex-col rounded-[18px] bg-surface px-[22px] py-[18px] shadow-[0_30px_80px_rgba(10,16,28,.35)]"
                : "absolute top-[calc(100%+8px)] z-152 w-[min(430px,100%)] rounded-[16px] border border-line bg-surface px-[18px] py-4 shadow-[0_18px_50px_rgba(20,36,63,.16)]"}
              style={panel === "more" ? undefined : { left: pLeft }}
            >
              <div className="mb-[10px] flex items-center gap-2"><span className="flex-1 text-[14.5px] font-extrabold text-ink">{panelTitle}</span><span onClick={closePanel} className="cursor-pointer p-[2px] text-[#aab1bd] hover:text-ink"><IconX size={22} /></span></div>
              {panelBody[panel]}
              {panel !== "more" && <div className="mt-[14px] flex items-center justify-between gap-2 border-t border-[#eef1f6] pt-3">{resetBtn(pActive, pReset)}{showBtn}</div>}
            </div>
          </>
        )}
      </div>
      {chips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-[7px]">
          {chips.map((c, i) => <span key={i} className="inline-flex items-center gap-[6px] rounded-[16px] bg-blue-tint py-[7px] pl-[13px] pr-[9px] text-[12.5px] font-semibold text-[#2c4a9e]">{c.l}<IconX size={13} onClick={c.del} className="cursor-pointer text-[#8fa8e8] hover:text-ink" /></span>)}
          <span onClick={reset} className="ml-1 cursor-pointer text-[12.5px] font-semibold text-red">{t.cat.reset}</span>
        </div>
      )}
      {vm === "map" && <CatalogMap items={mapItems} f={{ il: f.il, ilces: f.ilces, semts: f.semts }} set={(p) => set(p)} hint={t.cat.mapHint} />}
      {vm === "list" && (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-4">
            {rows.map((p) => {
              const ss = SALES_STYLE[p.sales];
              return (
                <article key={p.k} className="flex flex-col overflow-hidden rounded-[18px] border border-[#edf0f6] bg-surface shadow-[0_1px_3px_rgba(20,36,63,.05)] transition-shadow hover:shadow-[0_12px_32px_rgba(20,36,63,.10)]">
                  <Link href={hrefOf(p)} className="relative block h-[210px] flex-none bg-cover bg-center hover:brightness-[.96]" style={{ backgroundImage: `url('${p.ph[0]?.img}')` }}>
                    <span className="absolute left-[10px] top-[10px] rounded-[8px] bg-ink px-[9px] py-1 text-[10.5px] font-extrabold uppercase tracking-[.04em] text-white">{t.newb.dlvT} {p.dlv}</span>
                    <span className="absolute right-[10px] top-[10px] rounded-[8px] px-[9px] py-1 text-[10.5px] font-extrabold uppercase tracking-[.04em]" style={{ background: ss.bg, color: ss.fg }}>{t.newb.salesL[p.sales]}</span>
                    {p.inst && <span className="absolute bottom-[10px] left-[10px] inline-flex items-center gap-1 rounded-[8px] bg-[rgba(255,255,255,.92)] px-[9px] py-1 text-[10.5px] font-extrabold text-blue-2"><IconCalendarDollar size={12} /> {t.newb.instB}</span>}
                  </Link>
                  <div onClick={() => router.push(hrefOf(p))} className="flex flex-1 cursor-pointer flex-col px-[15px] py-[13px]">
                    <div className="truncate text-[14.5px] font-bold text-ink">{p.n}</div>
                    <div className="mb-[9px] mt-[3px] flex items-center gap-1 text-[12px] text-muted"><IconMapPin size={12} /> {p.geo}</div>
                    <div className="flex flex-col border-t border-[#f2f4f8]">
                      {p.plans.map((pl, i) => (
                        <div key={i} className="flex items-center gap-2 border-b border-[#f5f7fb] py-[6px] text-[12.5px]">
                          <span className="min-w-9 font-extrabold text-ink">{pl[0]}</span><span className="flex-1 text-muted">{t.newb.fromM} {pl[1]} м²</span><span className="font-extrabold text-blue">{t.newb.fromM} {fmt(pl[2], p.cur)}</span>
                        </div>
                      ))}
                    </div>
                    <Link href={`/newb?dev=${encodeURIComponent(p.dev)}`} onClick={(e) => e.stopPropagation()} className="mt-auto flex items-center gap-2 pt-[10px] hover:brightness-90">
                      <span className="flex h-6 w-6 flex-none items-center justify-center rounded-full bg-blue-2 text-white"><IconBuildingCommunity size={12} /></span>
                      <span className="truncate text-[12.5px] font-semibold text-blue-2">{p.dev}</span>
                    </Link>
                  </div>
                </article>
              );
            })}
          </div>
          {rows.length === 0 && <div className="rounded-[16px] border border-dashed border-[#d5dce6] bg-surface px-5 py-10 text-center text-[13.5px] text-muted">{t.newb.emptyL}</div>}
        </>
      )}
      {vm !== "map" && (
      <div className="mt-[18px] flex items-start gap-[9px] rounded-[12px] bg-bg-3 px-[14px] py-3 text-[12.5px] leading-[1.5] text-text"><IconCrane size={16} className="mt-[1px] flex-none text-blue" /><span>{t.newb.soon}</span></div>
      )}
      {geoOpen && (
        <GeoPicker
          mode="filter"
          value={{ il: f.il, ilces: f.ilces, semts: f.semts }}
          projects={projects}
          countLabel={t.newb.projN}
          onApply={(v) => { set(v); setGeoOpen(false); }}
          onClose={() => setGeoOpen(false)}
        />
      )}
    </>
  );
}
