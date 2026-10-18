"use client";
import Link from "next/link";
import { fgeo, fgeoBox, ficon, fpill } from "@/components/catalog/fpill";
import { LogoMark } from "@/components/Logo";

// Catalog filter bar + panels — prototype lines 251–336 and handlers 3128–3210.
import { useEffect, useState, type MouseEvent, type ReactNode } from "react";
import {
  IconAdjustmentsHorizontal, IconArrowsSort, IconChevronDown, IconChevronUp, IconLayoutGrid, IconMap2, IconMapPin,
  IconSortAscending, IconSortDescending, IconX,
} from "@tabler/icons-react";
import { useT } from "@/i18n/provider";
import { useBackClose, useScrollLock } from "@/hooks/useScrollLock";
import { EMPTY_FILTERS, LAND_CLEAR, TYPE_CLEAR, extCount, type Filters } from "@/lib/filters";
import { kShort } from "@/lib/money";
import { FEATS, ROOMS_ALL, ROOMS_BASIC, type Deal, type Listing, type PropType, type SortKey } from "@/lib/types";

type Panel = "" | "deal" | "type" | "price" | "rooms" | "furn" | "sort" | "more";

type Props = {
  f: Filters;
  set: (patch: Partial<Filters>) => void;
  scope: Listing[]; // listings the counters are computed from (`scopeAll`)
  resultCount: number;
  view: "list" | "map";
  setView: (v: "list" | "map") => void;
  geoLabel: string;
  onOpenGeo: () => void;
  fabHidden?: boolean; // geo picker / save-search modal open (prototype `viewFabShow`)
};

const inputCls = "min-w-0 rounded-[10px] border border-line px-[11px] py-[9px] text-[13px] outline-none focus:border-blue";
const toggleIn = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);

function Row({ on, label, count, onClick }: { on: boolean; label: string; count?: string; onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full cursor-pointer items-center gap-[11px] rounded-[10px] px-[9px] py-3 text-left text-[13.5px] font-semibold text-ink hover:bg-bg-3">
      <span className={`box-border h-[17px] w-[17px] shrink-0 rounded-full ${on ? "border-[5px] border-blue-2" : "border-2 border-[#c9d0dc]"}`} />
      <span className="flex-1">{label}</span>
      {count !== undefined && count !== "" && <span className="text-[12px] font-semibold text-muted">{count}</span>}
    </button>
  );
}

// Prototype `chipF` (line 3167)
function Chip({ on, label, onClick, center }: { on: boolean; label: string; onClick: () => void; center?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`cursor-pointer rounded-[18px] border text-[12.5px] transition-[background,border-color] duration-[120ms] hover:bg-line-2 ${center ? "inline-flex justify-center px-2 py-[9px] text-center" : "px-[13px] py-[9px]"} ${on ? "border-sel-line bg-blue-tint font-bold text-sel-ink" : "border-line bg-surface font-semibold text-[#3d4a5e]"}`}>
      {label}
    </button>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-2 text-[12px] font-bold uppercase tracking-[.04em] text-muted">{title}</div>
      {children}
    </div>
  );
}

type RangeProps = { a: string; b: string; ka: keyof Filters; kb: keyof Filters; unit?: string; w?: string; set: (patch: Partial<Filters>) => void; fromPh: string; toPh: string };
function Range({ a, b, ka, kb, unit, w, set, fromPh, toPh }: RangeProps) {
  return (
    <div className="flex items-center gap-2">
      <input value={a} onChange={(e) => set({ [ka]: e.target.value } as Partial<Filters>)} placeholder={fromPh} className={`${inputCls} ${w ?? "flex-1"}`} inputMode="numeric" />
      <span className="text-[#c3c9d4]">—</span>
      <input value={b} onChange={(e) => set({ [kb]: e.target.value } as Partial<Filters>)} placeholder={toPh} className={`${inputCls} ${w ?? "flex-1"}`} inputMode="numeric" />
      {unit && <span className="text-[13px] text-muted">{unit}</span>}
    </div>
  );
}

export function FilterBar({ f, set, scope, resultCount, view, setView, geoLabel, onOpenGeo, fabHidden = false }: Props) {
  const t = useT();
  const [fp, setFp] = useState<Panel>("");
  const [fpLeft, setFpLeft] = useState(0);
  const [roomsAll, setRoomsAll] = useState(false);
  const isLand = f.type === "land";
  const isComm = f.type === "comm";
  const isHouse = f.type === "house";
  const isResid = !isLand; // prototype `fpShowResid`
  const showFloor = !isLand && !isHouse; // prototype `fpShowFloor` / `fpShowAidat`
  const extN = extCount(f);
  // Body lock: «Ещё» always, any panel on ≤760 (prototype line 2583)
  useScrollLock(fp === "more");
  useScrollLock(!!fp && fp !== "more", true);

  useEffect(() => {
    if (!fp) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setFp("");
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [fp]);

  // Panel opens under the clicked pill (prototype `togglePanel`, line 3129): widths 920 (more) / 340; rooms 480 when expanded
  const toggle = (k: Panel) => (e?: MouseEvent<HTMLElement>) => {
    let left = 0;
    const el = e?.currentTarget;
    if (el) {
      const sc2 = el.closest("[data-fbar-scroll]"), bar = el.closest("[data-fbar]");
      const ww = bar ? bar.clientWidth : 1200;
      const pw = k === "more" ? 920 : 340;
      left = Math.max(0, Math.min(el.offsetLeft - (sc2 ? sc2.scrollLeft : 0), ww - pw - 10));
    }
    setFpLeft(left);
    setFp((cur) => (cur === k ? "" : k));
  };
  const close = () => setFp("");
  useBackClose(!!fp, close); // «назад» на телефоне закрывает панель фильтра (18.10.2026)
  // Prototype `_fTop` (line 2528): after picking a filter scroll the page to the top
  const fTop = () => { if (view !== "map" && window.scrollY > 180) setTimeout(() => window.scrollTo({ top: 0, behavior: "smooth" }), 60); };
  const upd = (patch: Partial<Filters>) => { set(patch); fTop(); };
  const pick = (patch: Partial<Filters>) => { set(patch); close(); fTop(); };
  const rangeProps = { set, fromPh: t.cat.fromS, toPh: t.cat.toS };
  const setDeal = (k: Deal) => upd({ deal: k, dep: k === "rent" ? f.dep : "", vnj: k === "sale" ? f.vnj : false });
  const setType = (k: PropType | "") => upd({ type: k, ...TYPE_CLEAR, ...(k === "land" ? LAND_CLEAR : {}) });

  const priceLabel = f.min && f.max ? `${kShort(f.min)} – ${kShort(f.max)} ₺` : f.min ? `${t.cat.fromS} ${kShort(f.min)} ₺` : f.max ? `${t.cat.toS} ${kShort(f.max)} ₺` : t.cat.priceB;
  const roomsLabel = f.rooms.length ? (f.rooms.length > 3 ? `${f.rooms.slice(0, 3).join(", ")} +${f.rooms.length - 3}` : f.rooms.join(", ")) : t.cat.roomsB;
  const pills: { k: Panel; on: boolean; label: string }[] = [
    { k: "deal", on: f.deal !== "sale", label: t.dealF[f.deal] }, // «Купить» — значение по умолчанию (как «Вся Турция»): не подсвечивается и без чипа
    { k: "type", on: !!f.type, label: f.type ? t.typ[f.type] : t.cat.typeB },
    { k: "price", on: !!(f.min || f.max), label: priceLabel },
    ...(!isLand ? [{ k: "rooms" as Panel, on: f.rooms.length > 0, label: roomsLabel }] : []),
  ];
  const pillsExt: { k: Panel; on: boolean; label: string }[] = !isLand ? [{ k: "furn", on: !!f.furn, label: f.furn ? t.furn[f.furn] : t.cat.furnB }] : [];
  const pillCls = fpill; // общий стиль пилюль (`fpill.ts`): выбранное заметно отличается
  const geoOn = !!f.il;

  const dealCnt = (k: Deal) => scope.filter((o) => o.deal === k).length;
  const typeCnt = (k: PropType | "") => scope.filter((o) => o.deal === f.deal && (!k || o.type === k)).length;
  const roomHas = (r: string) => scope.some((o) => o.deal === f.deal && (!f.type || o.type === f.type) && o.rooms === r);
  const chips = <K extends keyof Filters>(key: K, opts: [string, string][]) =>
    opts.map(([k, l]) => <Chip key={k} on={(f[key] as string[]).includes(k)} label={l} onClick={() => upd({ [key]: toggleIn(f[key] as string[], k) } as Partial<Filters>)} />);
  const bool = (key: keyof Filters, label: string) => <Chip key={key} on={!!f[key]} label={label} onClick={() => upd({ [key]: !f[key] } as Partial<Filters>)} />;

  // Quick filters — same order and conditions as the prototype (`mQuickChips`).
  const quick: ReactNode[] = [];
  if (f.deal === "sale") { quick.push(bool("vnj", t.cat.vnjChip)); quick.push(bool("cit", t.cat.citChip)); }
  if (!isLand) { quick.push(bool("lift", t.add.liftL)); quick.push(bool("gas", t.add.gasL)); }
  quick.push(bool("drop", t.cat.dropB));
  if (!isLand) { quick.push(bool("balc", t.cat.balcB)); quick.push(bool("site", t.ext.siteB)); }
  if (f.deal === "sale") { quick.push(bool("credit", t.ext.creditB)); quick.push(bool("takas", t.ext.takasB)); }

  // Per-panel reset (prototype `fpReset`): rooms → rooms, price → min/max, more → everything except sort
  const resetActive = fp === "rooms" ? f.rooms.length > 0 : fp === "price" ? !!(f.min || f.max) : fp === "more" ? (extN > 0 || f.rooms.length > 0 || !!f.min || !!f.max || !!f.il || f.ilces.length > 0 || f.semts.length > 0) : false;
  const fpReset = () => {
    if (fp === "rooms") set({ rooms: [] });
    else if (fp === "price") set({ min: "", max: "" });
    else if (fp === "more") set({ ...EMPTY_FILTERS, sort: f.sort });
  };

  let title = "";
  let body: ReactNode = null;
  let footer = false;
  if (fp === "deal") {
    title = t.cat.dealT;
    body = (["sale", "rent", "daily"] as Deal[]).filter((k) => dealCnt(k) > 0).map((k) => <Row key={k} on={f.deal === k} label={t.dealF[k]} count={String(dealCnt(k))} onClick={() => { setDeal(k); close(); }} />);
  } else if (fp === "type") {
    title = t.cat.typeT;
    body = ([["", t.cat.anyL], ["flat", t.typ.flat], ["house", t.typ.house], ["comm", t.typ.comm], ["land", t.typ.land]] as [PropType | "", string][])
      .filter(([k]) => !k || typeCnt(k) > 0)
      .map(([k, l]) => <Row key={k} on={f.type === k} label={l} count={String(typeCnt(k))} onClick={() => { setType(k); close(); }} />);
  } else if (fp === "furn") {
    title = t.cat.furnT;
    body = ([["", t.cat.anyL], ["yes", t.furn.yes], ["no", t.furn.no]] as [Filters["furn"], string][]).map(([k, l]) => <Row key={k} on={f.furn === k} label={l} onClick={() => pick({ furn: k })} />);
  } else if (fp === "sort") {
    title = t.cat.sortT;
    body = ([["new", t.cat.sortNew], ["cheap", t.cat.sortCheap], ["exp", t.cat.sortExp]] as [SortKey, string][]).map(([k, l]) => <Row key={k} on={f.sort === k} label={l} onClick={() => pick({ sort: k })} />);
  } else if (fp === "price") {
    title = t.cat.priceT; footer = true;
    body = (
      <div className="flex items-center gap-2">
        <input value={f.min} onChange={(e) => set({ min: e.target.value })} placeholder={t.cat.from} className={`${inputCls} min-w-[100px] flex-1 px-3 py-[11px] text-[13.5px]`} inputMode="numeric" />
        <span className="text-[#c3c9d4]">—</span>
        <input value={f.max} onChange={(e) => set({ max: e.target.value })} placeholder={t.cat.to} className={`${inputCls} min-w-[100px] flex-1 px-3 py-[11px] text-[13.5px]`} inputMode="numeric" />
        <span className="text-[13.5px] text-muted">₺</span>
      </div>
    );
  } else if (fp === "rooms") {
    title = t.cat.roomsT; footer = true;
    const list = roomsAll ? ROOMS_ALL.filter((r) => roomHas(r) || f.rooms.includes(r)) : [...ROOMS_BASIC.filter((r) => roomHas(r) || f.rooms.includes(r)), ...f.rooms.filter((r) => !ROOMS_BASIC.includes(r))];
    body = (
      <>
        <div className="flex max-h-[min(46vh,340px)] flex-wrap gap-[7px] overflow-y-auto">{list.map((r) => <Chip key={r} on={f.rooms.includes(r)} label={r} center onClick={() => upd({ rooms: toggleIn(f.rooms, r) })} />)}</div>
        <button type="button" onClick={() => setRoomsAll((v) => !v)} className="mt-[11px] inline-flex cursor-pointer items-center gap-[5px] text-[12.5px] font-semibold text-blue-2 hover:brightness-95">{roomsAll ? t.cat.roomsBasic : t.cat.roomsAll} {roomsAll ? <IconChevronUp size={13} /> : <IconChevronDown size={13} />}</button>
      </>
    );
  } else if (fp === "more") {
    title = t.cat.moreT; footer = true;
    body = (
      <div className="flex min-h-0 flex-1 flex-col gap-[18px] overflow-y-auto pr-[6px]">
        <Group title={`${t.geo.loc} · İl / İlçe / Mahalle`}>
          <button type="button" onClick={onOpenGeo} className={`w-[min(440px,100%)] ${fgeoBox(geoOn)}`}>
            <IconMapPin size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${ficon(geoOn)}`} />{geoLabel}<IconChevronDown size={14} className={`absolute right-[11px] top-1/2 -translate-y-1/2 ${ficon(geoOn)}`} />
          </button>
        </Group>
        <Group title={t.cat.priceT}><Range a={f.min} b={f.max} ka="min" kb="max" unit="₺" w="w-[140px] shrink-0" {...rangeProps} /></Group>
        <Group title={t.cat.dealT}><div className="flex flex-wrap gap-[7px]">{(["sale", "rent", "daily"] as Deal[]).filter((k) => scope.some((o) => o.deal === k)).map((k) => <Chip key={k} on={f.deal === k} label={t.dealF[k]} onClick={() => setDeal(k)} />)}</div></Group>
        <Group title={t.cat.typeT}><div className="flex flex-wrap gap-[7px]">{(["flat", "house", "comm", "land"] as PropType[]).filter((k) => scope.some((o) => o.deal === f.deal && o.type === k)).map((k) => <Chip key={k} on={f.type === k} label={t.typ[k]} onClick={() => setType(f.type === k ? "" : k)} />)}</div></Group>
        <Group title={t.cat.areaT}>
          <div className="mb-[9px]"><div className="mb-[6px] text-[12.5px] text-text-2">{isLand ? t.cat.plotL : t.cat.grossL}</div><Range a={f.abMin} b={f.abMax} ka="abMin" kb="abMax" {...rangeProps} /></div>
          {isResid && <div><div className="mb-[6px] text-[12.5px] text-text-2">{t.cat.netL}</div><Range a={f.anMin} b={f.anMax} ka="anMin" kb="anMax" {...rangeProps} /></div>}
          {isHouse && <div className="mt-[9px]"><div className="mb-[6px] text-[12.5px] text-text-2">{t.ext.gardenP}, m²</div><Range a={f.garMin} b={f.garMax} ka="garMin" kb="garMax" {...rangeProps} /></div>}
        </Group>
        {isResid && <Group title={t.cat.furnT}><div className="flex flex-wrap gap-[7px]">{(["yes", "no"] as const).map((k) => <Chip key={k} on={f.furn === k} label={t.furn[k]} onClick={() => upd({ furn: f.furn === k ? "" : k })} />)}</div></Group>}
        <Group title={t.cat.quickT}><div className="flex flex-wrap gap-[7px]">{quick}</div></Group>
        {showFloor && (
          <Group title={t.cat.floorT}>
            <div className="flex flex-wrap items-center gap-2">
              <Range a={f.flrMin} b={f.flrMax} ka="flrMin" kb="flrMax" w="w-[90px] shrink-0" {...rangeProps} />
              {bool("notFirst", t.cat.notFirst)}{bool("notLast", t.cat.notLast)}
            </div>
          </Group>
        )}
        {isResid && <Group title={t.cat.bfT}><input value={f.bfMin} onChange={(e) => set({ bfMin: e.target.value, bfMax: e.target.value })} placeholder="3" className={`${inputCls} w-[90px] shrink-0`} inputMode="numeric" /></Group>}
        {isResid && <Group title={t.cat.ageT}><div className="flex flex-wrap gap-[7px]">{chips("age", [["0-5", "0-5"], ["5-10", "5-10"], ["10-20", "10-20"], ["20+", "20+"]])}</div></Group>}
        {isResid && <Group title={t.cat.bathT}><div className="flex flex-wrap gap-[7px]">{chips("bath", [["1", "1"], ["2", "2"], ["3", "3+"]])}</div></Group>}
        {isResid && <Group title={t.cat.heatT}><div className="flex flex-wrap gap-[7px]">{chips("heat", (["none", "kombi", "central", "ac", "floor"] as const).map((k) => [k, t.heatL[k]]))}</div></Group>}
        {isLand && (
          <>
            <Group title={t.ext.imarT}><div className="flex flex-wrap gap-[7px]">{chips("imar", (["konut", "ticari", "tarla", "imarsiz"] as const).map((k) => [k, t.ext.imarL[k]]))}</div></Group>
            <Group title={t.ext.tapuT}><div className="flex flex-wrap gap-[7px]">{chips("tapu", (["mustakil", "hisseli"] as const).map((k) => [k, t.ext.tapuL[k]]))}</div></Group>
          </>
        )}
        {isComm && (
          <Group title={t.ext.commT}>
            <div className="flex flex-wrap gap-[7px]">{chips("commT", (["shop", "office", "depot", "rest"] as const).map((k) => [k, t.ext.commL[k]]))}</div>
            <div className="mt-2 flex flex-wrap gap-[7px]">{bool("kiraci", t.ext.kiraciB)}{bool("devir", t.ext.devirB)}</div>
          </Group>
        )}
        {isResid && !isComm && f.deal === "sale" && (
          <Group title={isHouse ? t.ext.usageTH : t.ext.usageT}><div className="flex flex-wrap gap-[7px]">{(["empty", "owner", "tenant"] as const).map((k) => <Chip key={k} on={f.usage.includes(k)} label={t.ext.usageL[k]} onClick={() => upd({ usage: f.usage.includes(k) ? [] : [k] })} />)}</div></Group>
        )}
        <div className="flex flex-wrap gap-[26px]">
          {showFloor && <Group title={t.cat.aidatT}><input value={f.aidat} onChange={(e) => set({ aidat: e.target.value })} placeholder={t.cat.toS} className={`${inputCls} w-[120px] shrink-0`} inputMode="numeric" /></Group>}
          <Group title={t.cat.seaT}><div className="flex flex-wrap gap-[7px]">{([["300", t.cat.sea300], ["1000", t.cat.sea1], ["3000", t.cat.sea3], ["5000", t.cat.sea5], ["gt5", t.cat.sea5p]] as [string, string][]).map(([v, l]) => <Chip key={v} on={f.sea === v} label={l} onClick={() => upd({ sea: f.sea === v ? "" : v })} />)}</div></Group>
          {f.deal === "rent" && <Group title={t.cat.depT}><input value={f.dep} onChange={(e) => set({ dep: e.target.value })} placeholder={t.cat.toS} className={`${inputCls} w-[120px] shrink-0`} inputMode="numeric" /></Group>}
        </div>
        {isResid && (
          <>
            <Group title={t.cat.roomsT}><div className="grid grid-cols-[repeat(auto-fill,minmax(64px,1fr))] gap-[6px]">{ROOMS_ALL.filter((r) => roomHas(r) || f.rooms.includes(r)).map((r) => <Chip key={r} on={f.rooms.includes(r)} label={r} center onClick={() => upd({ rooms: toggleIn(f.rooms, r) })} />)}</div></Group>
            <Group title={t.cat.featT}><div className="flex flex-wrap gap-[7px]">{chips("feats", FEATS.map((k) => [k, t.feat[k]]))}</div></Group>
          </>
        )}
      </div>
    );
  }

  const sortIcon = f.sort === "cheap" ? <IconSortAscending size={16} /> : f.sort === "exp" ? <IconSortDescending size={16} /> : <IconArrowsSort size={16} />;
  const fpw = fp === "rooms" && roomsAll ? 480 : 340;

  return (
    <div data-fsticky="1" data-stuck="0" className="sticky top-0 z-150 mb-[14px]">
      <div data-fbar="1" className="flex items-center gap-0 rounded-[16px] border border-line bg-surface px-[6px] py-[5px] shadow-[0_1px_3px_rgba(20,36,63,.05)]">
        {/* логотип-«кругляшок» показывается только когда панель закреплена и шапка скрыта — ведёт на главную */}
        <Link href="/catalog" data-fbar-logo="1" aria-label="OnePlan" className="hidden h-[42px] w-[42px] flex-none items-center justify-center rounded-[10px] hover:bg-bg-3"><LogoMark size={26} /></Link>
        <div data-fbar-scroll="1" className="flex min-w-0 flex-1 items-center gap-0 overflow-x-auto">
          <button type="button" data-fmore="1" onClick={toggle("more")} title={t.cat.moreT} className={`${pillCls(extN > 0, fp === "more")} rounded-l-[10px]`}>
            <IconAdjustmentsHorizontal size={17} /><span data-more-label="1">{t.cat.moreB}</span>
            {extN > 0 && <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] bg-blue-2 px-1 text-[10px] font-bold text-white">{extN}</span>}
          </button>
          <button type="button" data-fgeo="1" onClick={onOpenGeo} className={fgeo(geoOn)}>
            <IconMapPin size={15} className={`absolute left-3 top-1/2 -translate-y-1/2 ${ficon(geoOn)}`} />{geoLabel}<IconChevronDown size={14} className={`absolute right-[11px] top-1/2 -translate-y-1/2 ${ficon(geoOn)}`} />
          </button>
          {pills.map((p) => <button key={p.k} type="button" data-fbtn="1" onClick={toggle(p.k)} className={pillCls(p.on, fp === p.k)}>{p.label} <IconChevronDown size={12} className={ficon(p.on)} /></button>)}
          {pillsExt.map((p) => <button key={p.k} type="button" data-fext="1" onClick={toggle(p.k)} className={pillCls(p.on, fp === p.k)}>{p.label} <IconChevronDown size={12} className={ficon(p.on)} /></button>)}
        </div>
        <button type="button" data-mob-more="1" onClick={toggle("more")} className="relative hidden h-[42px] w-[42px] shrink-0 cursor-pointer items-center justify-center rounded-[10px] text-[19px] text-ink">
          <IconAdjustmentsHorizontal size={19} />
          {extN > 0 && <span className="absolute right-[1px] top-[2px] inline-flex h-4 min-w-4 items-center justify-center rounded-lg bg-blue-2 px-1 text-[9.5px] font-bold text-white">{extN}</span>}
        </button>
        <button type="button" onClick={toggle("sort")} className={`${pillCls(false, fp === "sort")} rounded-[10px] border-r-0`}>
          <span className={f.sort === "new" ? "text-blue-2" : "text-ink"}>{sortIcon}</span>
          <span data-sort-label="1">{f.sort === "new" ? t.cat.sortNew : f.sort === "cheap" ? t.cat.sortCheap : t.cat.sortExp}</span>
        </button>
        <div data-viewsw="1" className="flex shrink-0 gap-[3px] rounded-[10px] bg-bg-2 p-[3px]">
          {(["list", "map"] as const).map((v) => (
            <button key={v} type="button" title={v === "list" ? t.cat.list : t.cat.map} onClick={() => setView(v)} className={`flex h-[32px] w-[34px] cursor-pointer items-center justify-center rounded-[8px] text-[16px] ${view === v ? "bg-surface text-ink shadow-[0_1px_3px_rgba(20,36,63,.12)]" : "text-muted hover:bg-line-2"}`}>{v === "list" ? <IconLayoutGrid size={17} /> : <IconMap2 size={17} />}</button>
          ))}
        </div>
      </div>
      {/* Mobile FAB: list ⇄ map (prototype `[data-view-fab]`, hidden while a panel/modal is open) */}
      {!fp && !fabHidden && (
        <button type="button" data-view-fab="1" onClick={() => setView(view === "list" ? "map" : "list")} className="fixed bottom-[calc(20px+env(safe-area-inset-bottom))] right-[14px] z-640 hidden h-[54px] w-[54px] cursor-pointer items-center justify-center rounded-full bg-ink text-white shadow-[0_10px_30px_rgba(20,36,63,.4)]">{view === "list" ? <IconMap2 size={23} /> : <IconLayoutGrid size={23} />}</button>
      )}

      {fp && (
        <>
          <div data-f-dim="1" onClick={close} className={`fixed inset-0 ${fp === "more" ? "z-335 bg-[rgba(10,16,28,.45)]" : "z-180"}`} />
          <div
            data-f-sheet="1"
            data-sheet-tall={fp === "more" ? "1" : undefined}
            className={`animate-card flex flex-col bg-surface ${fp === "more"
              ? "fixed left-1/2 top-[4vh] z-340 max-h-[90vh] w-[min(96vw,980px)] -translate-x-1/2 rounded-[18px] px-[22px] py-[18px] shadow-[0_30px_80px_rgba(10,16,28,.35)]"
              : "absolute top-[calc(100%+6px)] z-190 rounded-[16px] border border-line p-4 shadow-[0_18px_50px_rgba(20,36,63,.16)]"}`}
            style={fp === "more" ? undefined : { left: fpLeft, width: fpw, maxWidth: `min(96vw, ${fpw}px)` }}
          >
            <div className="mb-[10px] flex items-center gap-2"><span className="flex-1 text-[14.5px] font-extrabold text-ink">{title}</span><button type="button" onClick={close} className="cursor-pointer p-[2px] text-[22px] text-muted-2 hover:text-ink" aria-label={t.common.cancel}><IconX size={20} /></button></div>
            <div className={`flex min-h-0 flex-col ${fp === "more" ? "flex-1" : ""}`}>{body}</div>
            {footer && (
              <div className={`mt-[14px] flex items-center justify-between gap-2 border-t border-line-2 pt-3 ${fp === "more" ? "max-md:pb-[max(2px,env(safe-area-inset-bottom))]" : ""}`}>
                <button type="button" onClick={fpReset} className={`flex-none cursor-pointer rounded-[10px] px-[14px] py-[10px] text-[12.5px] font-bold ${resetActive ? "bg-red-tint text-red" : "text-muted"}`}>{t.cat.resetBtn}</button>
                <button type="button" onClick={close} className="flex-none cursor-pointer rounded-[10px] bg-blue-2 px-5 py-[10px] text-[13px] font-bold text-white hover:bg-blue-3">{t.geo.show} {resultCount}</button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
