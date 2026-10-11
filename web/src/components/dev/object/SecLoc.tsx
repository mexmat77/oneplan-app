"use client";

// `#sec-loc` (535–543; данные 4273–4274): адрес (пишет `loc` объекта), ссылка на карту, долгота, широта,
// настоящая карта (Leaflet/OSM, 280px) вместо заглушки-градиента: клик/перетаскивание маркера → `lng/lat`,
// ссылка Google/Яндекс/Apple/2GIS → координаты + автоадрес (Nominatim), кнопка «Определить адрес по точке».
// Если в `loc` записана ссылка (пользователь вставил её в «Адрес»), при открытии секция сама переводит её в
// координаты и адрес через `updateProject`.
import { useCallback, useEffect, useMemo, useRef } from "react";
import { IconCurrentLocation, IconLink, IconLoader2, IconMapPin } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { displayLoc, fmtCoord, isMapLink, isShortMapLink, llOf, parseMapLink } from "@/lib/dev/geo";
import { LocMapLazy } from "./LocMapLazy";
import { AddressSearch } from "@/components/ui/AddressSearch";
import { Label, SectionCard, eSet, inputCls, type EditObj } from "./shared";
import { useMapLink, type LinkStatus, type MapLinkApply } from "./useMapLink";

export function SecLoc({ obj }: { obj: EditObj }) {
  const { t, lang } = useDevT();
  const id = obj.id;
  const locIsLink = isMapLink(obj.loc);
  // Адрес, который подставил геокодер: пока он не отредактирован вручную, точка на карте может его обновлять.
  const autoAddr = useRef("");
  const apply = useCallback<MapLinkApply>(({ lat, lng, addr }) => { if (addr !== undefined) autoAddr.current = addr; eSet(id, addr !== undefined ? { lng, lat, loc: addr } : { lng, lat }); }, [id]);
  const canSetAddr = useCallback(() => !obj.loc.trim() || isMapLink(obj.loc) || obj.loc === autoAddr.current, [obj.loc]);
  const { link, status, onLink, geocode } = useMapLink({ lang, apply, canSetAddr, initialLink: locIsLink ? obj.loc : "" });

  // Авто-преобразование `loc`-ссылки: координаты → lng/lat, адрес → результат геокодинга (адрес перезаписываем — он был ссылкой).
  useEffect(() => {
    if (!isMapLink(obj.loc)) return;
    const p = parseMapLink(obj.loc);
    if (!p) return;
    eSet(id, { lng: fmtCoord(p.lng), lat: fmtCoord(p.lat) });
    geocode(p.lat, p.lng, true);
  }, [id, obj.loc, geocode]);

  const ll = useMemo(() => llOf(obj.lng, obj.lat), [obj.lng, obj.lat]);
  // Клик по карте / перетаскивание маркера: координаты + адрес по точке (город, район, махалле) — как при вставке ссылки.
  // Адрес, набранный вручную, не затираем: найденный показывается в строке статуса, применить его можно кнопкой.
  const onPick = useCallback((lat: number, lng: number) => { eSet(id, { lng: fmtCoord(lng), lat: fmtCoord(lat) }); geocode(lat, lng, false); }, [id, geocode]);
  // Координаты, набранные руками: то же самое с задержкой, когда ввод закончен
  const typed = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const onCoord = (patch: { lng?: string; lat?: string }) => {
    eSet(id, patch);
    const p = llOf(patch.lng ?? obj.lng, patch.lat ?? obj.lat);
    clearTimeout(typed.current);
    if (p) typed.current = setTimeout(() => geocode(p[0], p[1], false), 900);
  };
  const detect = () => { if (ll) geocode(ll[0], ll[1], true); };
  const busy = status.kind === "geocoding";
  const plate = displayLoc(obj.loc, t.geo.no_addr);
  // Ссылка в `loc`, которую нельзя разобрать (короткая maps.app.goo.gl и т.п.): показываем её в поле и подсказку.
  // Считается на каждом рендере, т.к. при гидрации стор сначала отдаёт SSR-дефолты и стартовое состояние хука пустое.
  const unparsed = locIsLink && !parseMapLink(obj.loc);
  const shownLink = link || (locIsLink ? obj.loc : "");
  const shownStatus: LinkStatus = status.kind === "idle" && unparsed ? { kind: isShortMapLink(obj.loc) ? "short" : "bad" } : status;

  return (
    <SectionCard id="sec-loc" icon={<IconMapPin size={18} />} title={t.edp.nav_loc}>
      <div className="mb-[14px] flex flex-wrap gap-3">
        <div className="flex-[1_1_100%]"><Label mb={6}>{t.fld_addr}</Label><AddressSearch value={locIsLink ? "" : obj.loc} onChange={(v) => (isMapLink(v) ? onLink(v) : eSet(id, { loc: v }))} onPick={(p) => apply({ lat: fmtCoord(p.lat), lng: fmtCoord(p.lng), addr: p.addr })} placeholder={t.dx.wz_ph_addr} className={inputCls} lang={lang} bias={ll} /></div>
        <div className="flex-[1_1_100%]">
          <Label mb={6}>{t.geo.link}</Label>
          <div className="relative">
            <IconLink size={15} className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#9aa1ac]" />
            <input value={shownLink} onChange={(e) => onLink(e.target.value)} placeholder={t.geo.link_ph} className={`${inputCls} pl-[36px]`} />
          </div>
          <LinkHint status={shownStatus} kept={status.kind === "ok" && !!obj.loc.trim() && obj.loc !== status.addr && !isMapLink(obj.loc)} />
        </div>
        <div className="min-w-[110px] flex-1"><Label mb={6}>{t.fld_lng}</Label><input value={obj.lng} onChange={(e) => onCoord({ lng: e.target.value })} inputMode="decimal" className={inputCls} /></div>
        <div className="min-w-[110px] flex-1"><Label mb={6}>{t.fld_lat}</Label><input value={obj.lat} onChange={(e) => onCoord({ lat: e.target.value })} inputMode="decimal" className={inputCls} /></div>
        <div className="flex flex-[1_1_100%] flex-wrap items-center gap-3 max-md:flex-col max-md:items-stretch">
          <button type="button" onClick={detect} disabled={!ll || busy} title={!ll ? t.geo.no_coords : undefined} className="inline-flex cursor-pointer items-center justify-center gap-[6px] whitespace-nowrap rounded-[11px] border border-line bg-surface px-[14px] py-[10px] text-[13px] font-semibold text-ink hover:border-blue hover:text-blue disabled:cursor-default disabled:opacity-50">
            {busy ? <IconLoader2 size={15} className="animate-spin" /> : <IconCurrentLocation size={15} />} {t.geo.detect}
          </button>
          <span className="text-[12px] text-muted">{ll ? t.geo.map_hint : t.geo.no_coords}</span>
        </div>
      </div>
      <div className="relative">
        <LocMapLazy ll={ll} onPick={onPick} height={280} />
        <div className="pointer-events-none absolute bottom-[10px] left-3 z-[1] max-w-[calc(100%-24px)] overflow-hidden text-ellipsis whitespace-nowrap rounded-[9px] bg-surface px-3 py-[6px] text-[12px] font-semibold text-ink shadow-[0_4px_14px_rgba(20,36,63,.12)]">{plate}</div>
      </div>
    </SectionCard>
  );
}

/** Подсказка под полем ссылки: короткая ссылка / нет координат / точка найдена / геокодинг / адрес не найден. */
export function LinkHint({ status, kept = false }: { status: LinkStatus; kept?: boolean }) {
  const { t } = useDevT();
  if (status.kind === "idle") return <div className="mt-[6px] text-[12px] text-muted">{t.geo.link_hint}</div>;
  if (status.kind === "short") return <div className="mt-[6px] text-[12px] text-warn">{t.geo.short_link}</div>;
  if (status.kind === "expanding") return <div className="mt-[6px] text-[12px] text-muted">{t.geo.link_expanding}</div>;
  if (status.kind === "bad") return <div className="mt-[6px] text-[12px] text-red">{t.geo.bad_link}</div>;
  const pt = `${t.geo.point}: ${fmtCoord(status.lat)}, ${fmtCoord(status.lng)}`;
  if (status.kind === "geocoding") return <div className="mt-[6px] flex items-center gap-[5px] text-[12px] text-text-2"><IconLoader2 size={13} className="animate-spin" /> {pt} · {t.geo.geocoding}</div>;
  if (status.kind === "geo_fail") return <div className="mt-[6px] text-[12px] text-red">{pt} · {t.geo.geocode_fail}</div>;
  return <div className="mt-[6px] text-[12px] text-green">{pt} · {status.addr}{kept && <span className="ml-[6px] text-muted">· {t.geo.manual_keep}</span>}</div>;
}
