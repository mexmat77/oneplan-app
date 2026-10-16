"use client";

import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import { IconBookmarkPlus, IconFolderPlus, IconLoader2, IconX } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { fmtShort } from "@/lib/money";
import { EMPTY_FILTERS, passF, sortListings, type Filters } from "@/lib/filters";
import { plural } from "@/lib/plural";
import { GeoPicker, geoLabelOf } from "@/components/GeoPicker";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { showToast } from "@/components/ui/toast";
import { GEO, SEMT2ILCE } from "@/lib/seed";
import { useMahalleLoaded } from "@/lib/geo";
import type { Listing } from "@/lib/types";
import type { MapItem } from "./CatalogMap";
import { saveSearch, useReqs } from "@/store/reqs";
import { useCatUi } from "@/store/catalogUi";
import { FilterBar } from "./FilterBar";
import { ListingCard } from "../ListingCard";

const PAGE = 9;
const CatalogMap = dynamic(() => import("./CatalogMap"), { ssr: false, loading: () => <div className="mx-[calc(50%-50vw)] h-[calc(100dvh-88px)] bg-line-2" /> });

// Hint «folder» is dismissed per browser session (prototype `sessionStorage['opl-hint-closed']`, line 3756).
const HINT_KEY = "opl-hint-closed";
const hintListeners = new Set<() => void>();
const hintClosed = () => { try { return !!sessionStorage.getItem(HINT_KEY); } catch { return false; } };
const closeHint = () => { try { sessionStorage.setItem(HINT_KEY, "1"); } catch {} hintListeners.forEach((l) => l()); };
const subHint = (l: () => void) => { hintListeners.add(l); return () => { hintListeners.delete(l); }; };

// Realtor counter next to the result count = distinct owners of the SHOWN objects (not the whole base).


const ilN = (k: string) => GEO.find((x) => x.k === k)?.n ?? k;
const ilceN = (k: string) => GEO.flatMap((g) => g.ilces).find((x) => x.k === k)?.n ?? k;
const semtN = (k: string) => GEO.flatMap((g) => g.ilces).flatMap((ic) => ic.semts).find((x) => x.k === k)?.n ?? k;

export function CatalogGrid({
  all,
  mode,
  showSaveSearch = false,
  owner,
  owners,
  favEmpty = true,
}: {
  all: Listing[];
  mode: "catalog" | "mine" | "favs";
  showHint?: boolean; // kept for callers; the hint follows the prototype rule (catalog + mine, not on the map)
  showSaveSearch?: boolean;
  owner?: string; // realtor profile view: only this owner's listings
  owners?: string[]; // agency page: listings of all its realtors
  favEmpty?: boolean; // favs: no favourite units either (prototype `nbFavU.length===0`)
}) {
  useMahalleLoaded();
  const { t, lang } = useI18n();
  const hintHidden = useSyncExternalStore(subHint, hintClosed, () => true);
  const params = useSearchParams();
  const { searches } = useReqs();
  // `/catalog?q=<savedSearchId>` opens the base with that search's filters applied.
  // Обычный каталог держит фильтры и режим в памяти вкладки (`useCatUi`) — «Назад» со страницы объекта возвращает на ту же карту;
  // «Мои», «Избранное» и сохранённый поиск — локальное состояние экрана.
  const persist = mode === "catalog" && !params.get("q");
  const ui = useCatUi();
  const [fLocal, setFLocal] = useState<Filters>(() => {
    const q = params.get("q");
    const saved = q ? searches.find((x) => x.id === q) : null;
    return saved ? { ...EMPTY_FILTERS, ...saved.params } : EMPTY_FILTERS;
  });
  const [ssOpen, setSsOpen] = useState(false);
  const [ssName, setSsName] = useState("");
  const [viewLocal, setViewLocal] = useState<"list" | "map">("list");
  const f = persist ? ui.f : fLocal;
  const view = persist ? ui.view : viewLocal;
  const setView = persist ? ui.setView : setViewLocal;
  const [visN, setVisN] = useState(PAGE);
  const [geoOpen, setGeoOpen] = useState(false);
  const sentinel = useRef<HTMLDivElement>(null);

  const uiSet = ui.set;
  const set = useCallback((patch: Partial<Filters>) => {
    if (persist) uiSet(patch); else setFLocal((prev) => ({ ...prev, ...patch }));
    setVisN(PAGE);
  }, [persist, uiSet]);
  const reset = useCallback(() => set({ ...EMPTY_FILTERS }), [set]);

  // Prototype scopes: counters see everything incl. sold (`scopeAll`); the catalog hides sold, «Мои» shows them, favs are filtered too.
  const scopeAll = useMemo(() => (owner ? all.filter((o) => o.owner === owner) : owners ? all.filter((o) => owners.includes(o.owner)) : all), [all, owner, owners]);
  const filtered = useMemo(() => {
    const base = mode === "catalog" ? scopeAll.filter((o) => o.st !== "sold") : scopeAll;
    return sortListings(base.filter((o) => passF(o, f)), f.sort);
  }, [scopeAll, f, mode]);
  // риэлторов среди ПОКАЗАННЫХ объектов (16.10.2026, «в Hurma 2 объекта от 2 риэлторов, а оба — одного»: раньше считали по всей базе)
  const rlCount = useMemo(() => new Set(filtered.map((o) => o.owner)).size, [filtered]);
  const visible = filtered.slice(0, visN);

  // Infinite scroll: load more once the sentinel is within 600px of the viewport (prototype line 2557)
  useEffect(() => {
    const el = sentinel.current;
    if (!el) return;
    const io = new IntersectionObserver((entries) => {
      if (entries[0].isIntersecting) setTimeout(() => setVisN((n) => n + PAGE), 350);
    }, { rootMargin: "0px 0px 600px 0px" });
    io.observe(el);
    return () => io.disconnect();
  }, [visible.length]);

  const geoLabel = useMemo(() => geoLabelOf({ il: f.il, ilces: f.ilces, semts: f.semts }, t.geo.all), [f.il, f.ilces, f.semts, t]);
  // Prototype `fmtParams` (line 3239) — default name of a saved search
  const fmtParams = (p: Pick<Filters, "il" | "ilces" | "semts" | "min" | "max" | "rooms">) => [
    p.il ? ilN(p.il) + (p.ilces.length ? " · " + p.ilces.map(ilceN).join(", ") : "") + (p.semts.length ? " · " + p.semts.map(semtN).join(", ") : "") : t.geo.all,
    p.rooms.length ? p.rooms.join(", ") : null,
    p.min ? `${t.cat.from} ${(+p.min).toLocaleString("ru-RU")} ₺` : null,
    p.max ? `${t.cat.to} ${(+p.max).toLocaleString("ru-RU")} ₺` : null,
  ].filter(Boolean).join(" · ");
  const ssParams = { il: f.il, ilces: f.ilces, semts: f.semts, min: f.min, max: f.max, rooms: f.rooms };
  const ssSave = () => {
    saveSearch(ssName.trim() || t.geo.all, { ...ssParams, deal: "sale", type: "" });
    setSsOpen(false);
    showToast(t.cat.savedOk);
  };

  // Active-filter chips — same set and order as the prototype (`filterChips`, lines 3255–3290).
  const chips: { label: string; del: () => void }[] = [];
  const rm = <K extends keyof Filters>(key: K, v: string) => set({ [key]: (f[key] as string[]).filter((x) => x !== v) } as Partial<Filters>);
  if (f.il && !f.ilces.length) chips.push({ label: ilN(f.il), del: () => set({ il: "", ilces: [], semts: [] }) });
  f.ilces.forEach((k) => { if (!f.semts.some((x) => SEMT2ILCE[x] === k)) chips.push({ label: ilceN(k), del: () => rm("ilces", k) }); });
  f.semts.forEach((k) => chips.push({ label: semtN(k), del: () => rm("semts", k) }));
  if (f.min || f.max) chips.push({ label: `${t.cat.priceB}${f.min ? ` ${t.cat.fromS} ${(+f.min).toLocaleString("ru-RU")}` : ""}${f.max ? ` ${t.cat.toS} ${(+f.max).toLocaleString("ru-RU")}` : ""} ₺`, del: () => set({ min: "", max: "" }) });
  f.rooms.forEach((r) => chips.push({ label: r, del: () => rm("rooms", r) }));
  if (f.deal !== "sale") chips.push({ label: t.dealF[f.deal], del: () => set({ deal: "sale" }) });
  if (f.type) chips.push({ label: t.typ[f.type], del: () => set({ type: "" }) });
  if (f.abMin || f.abMax) chips.push({ label: `${t.cat.grossL} ${f.abMin || "…"}—${f.abMax || "…"}`, del: () => set({ abMin: "", abMax: "" }) });
  if (f.anMin || f.anMax) chips.push({ label: `${t.cat.netL} ${f.anMin || "…"}—${f.anMax || "…"}`, del: () => set({ anMin: "", anMax: "" }) });
  if (f.furn) chips.push({ label: t.furn[f.furn], del: () => set({ furn: "" }) });
  f.feats.forEach((k) => chips.push({ label: t.feat[k as keyof typeof t.feat], del: () => rm("feats", k) }));
  const flags: [keyof Filters, string][] = [["vnj", t.cat.vnjChip], ["cit", t.cat.citChip], ["lift", t.add.liftL], ["gas", t.add.gasL], ["drop", t.cat.dropB], ["balc", t.cat.balcB]];
  for (const [k, l] of flags) if (f[k]) chips.push({ label: l, del: () => set({ [k]: false } as Partial<Filters>) });
  f.heat.forEach((h) => chips.push({ label: t.heatL[h as keyof typeof t.heatL], del: () => rm("heat", h) }));
  f.bath.forEach((b) => chips.push({ label: `${t.cat.bathT}: ${b === "3" ? "3+" : b}`, del: () => rm("bath", b) }));
  f.age.forEach((a) => chips.push({ label: `${t.cat.ageT}: ${a}`, del: () => rm("age", a) }));
  if (f.flrMin || f.flrMax || f.notFirst || f.notLast) chips.push({ label: `${t.cat.floorT}${f.flrMin ? ` ${t.cat.fromS} ${f.flrMin}` : ""}${f.flrMax ? ` ${t.cat.toS} ${f.flrMax}` : ""}`, del: () => set({ flrMin: "", flrMax: "", notFirst: false, notLast: false }) });
  if (f.bfMin || f.bfMax) chips.push({ label: t.cat.bfT, del: () => set({ bfMin: "", bfMax: "" }) });
  if (f.aidat) chips.push({ label: `${t.cat.aidatB} ≤ ${f.aidat} ₺`, del: () => set({ aidat: "" }) });
  if (f.sea) chips.push({ label: f.sea === "gt5" ? `${t.cat.seaB} > 5 ${t.par.km}` : `${t.cat.seaB} ≤ ${+f.sea >= 1000 ? `${+f.sea / 1000} ${t.par.km}` : `${f.sea} ${t.par.m}`}`, del: () => set({ sea: "" }) });
  if (f.dep) chips.push({ label: `${t.cat.depB} ≤ ${f.dep} ₺`, del: () => set({ dep: "" }) });
  f.imar.forEach((k) => chips.push({ label: t.ext.imarL[k as keyof typeof t.ext.imarL], del: () => rm("imar", k) }));
  f.tapu.forEach((k) => chips.push({ label: t.ext.tapuL[k as keyof typeof t.ext.tapuL], del: () => rm("tapu", k) }));
  f.commT.forEach((k) => chips.push({ label: t.ext.commL[k as keyof typeof t.ext.commL], del: () => rm("commT", k) }));
  f.usage.forEach((k) => chips.push({ label: t.ext.usageL[k as keyof typeof t.ext.usageL], del: () => rm("usage", k) }));
  f.cephe.forEach((k) => chips.push({ label: t.ext.cepheL[k as keyof typeof t.ext.cepheL], del: () => rm("cephe", k) }));
  const flags2: [keyof Filters, string][] = [["kiraci", t.ext.kiraciB], ["devir", t.ext.devirB], ["site", t.ext.siteB], ["credit", t.ext.creditB], ["takas", t.ext.takasB]];
  for (const [k, l] of flags2) if (f[k]) chips.push({ label: l, del: () => set({ [k]: false } as Partial<Filters>) });

  const isMap = view === "map";
  // Пины и всплывашки карты (тот же HTML, что в прототипе `_syncMap`); объект открывается в новой вкладке.
  const mapItems = useMemo<MapItem[]>(() => (!isMap ? [] : filtered.filter((o) => o.ll).map((o) => {
    const mt = (o.rooms ? o.rooms + " · " : "") + o.area + " м²" + (o.fl && o.fl !== "—" ? " · " + o.fl : "") + (o.deal === "rent" ? " · " + t.dealF.rent : o.deal === "daily" ? " · " + t.dealF.daily : "");
    const tip = `<div style="display:flex;gap:10px;width:252px;align-items:stretch"><div style="width:96px;min-height:88px;flex:none;margin:-7px 0 -7px -7px;border-radius:15px 0 0 15px;background-image:url('${o.img}');background-size:cover;background-position:center"></div><div style="min-width:0;padding:2px 0"><div style="font-weight:700;font-size:12.5px;color:#14243f;line-height:1.3;max-height:33px;overflow:hidden">${o.t[lang] || ""}</div><div style="font-size:11px;color:#8a93a2;margin-top:2px">${o.loc[lang] || ""}</div><div style="font-size:11px;color:#5a6472;margin-top:3px">${mt}</div><div style="font-weight:800;font-size:14px;color:#14243f;margin-top:5px">${fmtShort(o.price)}</div></div></div>`;
    return { id: o.id, ll: o.ll as [number, number], price: o.price, il: o.il, ilce: o.ilce, semt: o.semt, st: o.st, pin: fmtShort(o.price), tip, href: `/obj/${o.id}` };
  })), [isMap, filtered, lang, t]);
  const fbarShow = mode !== "favs"; // prototype `fbarShow = catalog || mine`
  const nObj = `${filtered.length} ${plural(lang, filtered.length, t.cat.foundP)}`;
  const countLabel = mode === "catalog" && !owner && !owners ? `${nObj} · ${rlCount} ${plural(lang, rlCount, t.cat.rlsP)}` : nObj;
  const gridEmpty = (mode === "catalog" && filtered.length === 0) || (mode === "favs" && filtered.length === 0 && favEmpty);

  return (
    <>
      {fbarShow && !hintHidden && !isMap && (
        <div className="mb-4 flex items-center gap-[11px] rounded-[13px] border border-sel-tint-2 bg-blue-tint px-4 py-3 text-[13.5px] leading-[1.5] text-sel-ink">
          <IconFolderPlus size={19} className="shrink-0 text-blue" />
          <span className="flex-1">{t.cat.hint}</span>
          <button type="button" onClick={closeHint} className="shrink-0 cursor-pointer text-[#8fa8e8] hover:text-ink" aria-label={t.common.cancel}><IconX size={17} /></button>
        </div>
      )}

      {fbarShow && (
        <FilterBar f={f} set={set} scope={scopeAll} resultCount={filtered.length} view={view} setView={setView} geoLabel={geoLabel} onOpenGeo={() => setGeoOpen(true)} fabHidden={geoOpen || ssOpen} />
      )}
      {geoOpen && (
        <GeoPicker
          mode="filter"
          value={{ il: f.il, ilces: f.ilces, semts: f.semts }}
          scope={scopeAll.filter((o) => o.deal === f.deal)}
          onApply={(v) => { set(v); setGeoOpen(false); }}
          onClose={() => setGeoOpen(false)}
        />
      )}

      {fbarShow && chips.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center gap-[7px]">
          {chips.map((c, i) => (
            <span key={i} className="inline-flex items-center gap-[6px] rounded-[16px] bg-blue-tint py-[7px] pl-[13px] pr-[9px] text-[12.5px] font-semibold text-sel-ink">
              {c.label}
              <button type="button" onClick={c.del} className="cursor-pointer text-[#8fa8e8] hover:text-ink" aria-label={t.common.cancel}><IconX size={13} /></button>
            </span>
          ))}
          <button type="button" onClick={reset} className="ml-1 cursor-pointer text-[12.5px] font-semibold text-red">{t.cat.reset}</button>
        </div>
      )}

      {fbarShow && (
        <div className="mb-[14px] flex flex-wrap items-center gap-[14px]">
          <span className="text-[12.5px] text-muted">{countLabel}</span>
          {showSaveSearch && (
            <button type="button" onClick={() => { setSsName(fmtParams(ssParams)); setSsOpen(true); }} className="inline-flex cursor-pointer items-center gap-[5px] text-[12.5px] font-semibold text-blue hover:text-blue-2">
              <IconBookmarkPlus size={15} /> {t.cat.saveSearch}
            </button>
          )}
        </div>
      )}

      {/* «Название поиска» (prototype lines 1843–1853) */}
      <Modal open={ssOpen} onClose={() => setSsOpen(false)} width={440} z={410}>
        <div className="mb-[6px] flex items-center gap-[10px]"><span className="flex-1 text-[16px] font-extrabold text-ink">{t.cat.ssT}</span><ModalClose onClick={() => setSsOpen(false)} /></div>
        <p className="mb-[14px] text-[12.5px] leading-[1.5] text-text-2 [text-wrap:pretty]">{t.cat.ssH}</p>
        <input value={ssName} onChange={(e) => setSsName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && ssSave()} className="mb-[14px] w-full rounded-[11px] border border-line px-[13px] py-[11px] text-[14px] font-semibold outline-none focus:border-blue" autoFocus />
        <button type="button" onClick={ssSave} className="inline-flex w-full cursor-pointer items-center justify-center gap-[6px] rounded-[12px] bg-blue-2 p-[13px] text-[14px] font-bold text-white hover:bg-blue-3"><IconBookmarkPlus size={16} /> {t.cat.saveSearch}</button>
      </Modal>

      {isMap && fbarShow ? (
        <>
          <CatalogMap items={mapItems} f={f} set={set} hint={t.cat.mapHint} />
        </>
      ) : (
        <>
          <div className="grid grid-cols-[repeat(auto-fill,minmax(min(340px,100%),1fr))] gap-4">
            {visible.map((o) => <ListingCard key={o.id} o={o} />)}
          </div>
          {visible.length < filtered.length && (
            <div ref={sentinel} data-grid-sentinel="1" className="flex items-center justify-center gap-[9px] py-[26px] text-[13px] text-muted">
              <IconLoader2 size={17} className="animate-spin-slow" /> {t.cat.loading}
            </div>
          )}
          {gridEmpty && (
            <div className="rounded-[16px] border border-dashed border-line-3 bg-surface px-5 py-14 text-center text-[14px] text-muted">
              {mode === "favs" ? t.fav.empty : t.cat.empty}
            </div>
          )}
        </>
      )}
    </>
  );
}
