"use client";

// «Новый объект» — prototype lines 448–629 (markup), 2516–2517 (defaults), 2579–2581 (autosave),
// 2671–2724 (pin / Nominatim / fly-to-area), 3086–3125 (buttons, photos), 3292–3298 (duplicates),
// 3620–3672 (translate cards, required pairs, publish), 3760–3814 (labels, preview, drafts, geo find).
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import type { Lang } from "@/i18n";
import {
  IconAdjustmentsHorizontal, IconAlertTriangle, IconArrowLeft, IconArrowsMove, IconBuildingEstate, IconChevronDown, IconChevronUp,
  IconCircleCheck, IconCloudUpload, IconDeviceFloppy, IconEye, IconFileText, IconMapPin, IconPhoto, IconSearch, IconSparkles, IconUpload, IconX,
} from "@tabler/icons-react";
import { GeoPicker } from "@/components/GeoPicker";
import { reverseGeocode } from "@/components/obj/AddMap";
import { AUTOSAVE_KEY } from "@/components/catalog/DraftCards";
import { showToast } from "@/components/ui/toast";
import { AddressSearch, type GPlace } from "@/components/ui/AddressSearch";
import { translate, type TranslateResult } from "@/app/(dev)/dev/chat/actions";
import { fillTranslations } from "@/app/listing-translate-actions";
import { expandMapLink } from "@/app/geo-actions";
import { isMapLink, parseMapLink } from "@/lib/dev/geo";
import { shrinkImage } from "@/lib/photos";
import { useI18n } from "@/i18n/provider";
import { useMahalleLoaded } from "@/lib/geo";
import { eur, fmt, useRates } from "@/lib/money";
import { CITY_LL, DESCS, GEO, ILCES, IL_OF, NO_PHOTO, REALTORS, ilName, ilceName, semtName } from "@/lib/seed";
import { FEATS, ROOMS_ALL, ROOMS_BASIC, type Badge, type CommType, type Deal, type Heat, type Imar, type Listing, type PropType, type Usage } from "@/lib/types";
import { delDraft, geoOf, matchGeo, putDraft, setPrevScreen, upsertLocalListing, useAllListings } from "@/store/listings";
import { usePrefs } from "@/store/prefs";
import { getMeId } from "@/store/profile";

import AddMap from "@/components/obj/AddMap";

// TODO: current user from Supabase.

type Form = {
  deal: Deal; type: PropType;
  il: string; ilce: string; semt: string; addr: string; ll: [number, number] | null; link: string;
  rooms: string; area: string; net: string; garden: string; floor: string; floors: string; year: string;
  emsal: string; ada: string; sea: string; aidat: string; dep: string;
  heat: Heat[]; bath: string; furn: "" | "yes" | "no";
  balc: boolean; lift: boolean; gas: boolean; site: boolean; vnj: boolean; cit: boolean; credit: boolean; takas: boolean; own5: boolean;
  badge: "" | Badge; usage: Usage; commType: CommType; kiraci: boolean; devir: boolean; imar: Imar; tapu: "mustakil" | "hisseli";
  feats: string[]; photos: string[];
  price: string; title: string; desc: string;
  descs: Partial<Record<Lang, string>>; // переводы описания на остальные языки (ИИ или правка вручную)
  titles: Partial<Record<Lang, string>>; // переводы заголовка (то же)
  aDraftId: string;
};

// Prototype initial state (line 2516–2517).
const EMPTY: Form = {
  deal: "sale", type: "flat", il: "antalya", ilce: "", semt: "", addr: "", ll: null, link: "", // по умолчанию только Анталия (решение пользователя 07.10.2026; в прототипе Muratpaşa › Lara)
  rooms: "2+1", area: "", net: "", garden: "", floor: "", floors: "", year: "", emsal: "", ada: "", sea: "", aidat: "", dep: "",
  heat: ["kombi"], bath: "2", furn: "", balc: true, lift: true, gas: true, site: true, vnj: true, cit: false, credit: true, takas: false, own5: false,
  badge: "", usage: "empty", commType: "shop", kiraci: false, devir: false, imar: "konut", tapu: "mustakil", feats: ["pool", "opark", "sec"], photos: [],
  price: "", title: "", desc: "", descs: {}, titles: {}, aDraftId: "",
};

const digits = (s: string) => s.replace(/\D/g, "");
const MAX_PHOTOS = 40; // лимит фото в объявлении (22.10.2026: было 20; при превышении — понятное предупреждение, не «ошибка»)
const fmtIn = (s: string) => { const d = digits(s).slice(0, 12); return d ? (+d).toLocaleString("ru-RU").replace(/ /g, " ") : ""; };

function fromListing(o: Listing, lang: Lang): Form {
  return {
    ...EMPTY, deal: o.deal, type: o.type, il: o.il ?? "", ilce: o.ilce ?? "", semt: o.semt ?? "", ll: o.ll, rooms: o.rooms || "2+1",
    area: String(o.type === "land" ? o.area : Math.round(o.area * 1.12)), net: String(o.area), garden: o.garden ? String(o.garden) : "",
    floor: o.floorN ? String(o.floorN) : "", floors: o.floorsTotal ? String(o.floorsTotal) : "", year: String(new Date().getFullYear() - (o.age || 0)),
    emsal: o.emsal !== undefined ? String(o.emsal) : "", ada: o.adaParsel ?? "", sea: o.seaDist ? String(o.seaDist) : "", aidat: o.aidat ? String(o.aidat) : "",
    dep: o.deposit ? fmtIn(String(o.deposit)) : "", heat: o.heat.length ? o.heat.slice() : ["none"], bath: String(o.bath || 2), furn: o.furn ? "yes" : "no",
    balc: o.balcony, lift: o.lift, gas: o.gasline, site: o.inSite, vnj: o.vnj, cit: o.cit, credit: o.credit, takas: o.takas, own5: !!o.own5,
    badge: o.badge ?? "", usage: o.usage ?? "empty", commType: o.commType ?? "shop", kiraci: !!o.kiraci, devir: !!o.devir,
    imar: o.imar ?? "konut", tapu: o.tapu === "hisseli" ? "hisseli" : "mustakil", feats: o.feats.slice(), photos: o.photos.slice(0, MAX_PHOTOS),
    price: fmtIn(String(o.price)), title: o.t[lang], desc: o.desc[lang],
    descs: Object.fromEntries((["RU", "EN", "TR"] as Lang[]).filter((l) => l !== lang && o.desc[l] && o.desc[l] !== o.desc[lang]).map((l) => [l, o.desc[l]])),
    titles: Object.fromEntries((["RU", "EN", "TR"] as Lang[]).filter((l) => l !== lang && o.t[l] && o.t[l] !== o.t[lang]).map((l) => [l, o.t[l]])),
  };
}
// Вынесено из компонента: react-compiler считает `Date.now()` в теле компонента нечистым вызовом при рендере.
const nowId = () => Date.now();
type Saved = Partial<Form> & { editId?: string | null };
function readAutosave(): Saved | null {
  try { const j = JSON.parse(localStorage.getItem(AUTOSAVE_KEY) || "null"); if (j && typeof j === "object" && j.title !== undefined) return j as Saved; } catch {}
  return null;
}
// Прототип восстанавливал `opl-add-autosave` при каждом открытии формы (строка 2579). Отклонение (07.10.2026): новая форма
// всегда чистая, автосохранение подхватывается только по явному `?draft=1` (карточка черновика «Продолжить») — иначе
// показываем баннер «У вас есть незаконченный черновик» с кнопками «Продолжить / Удалить». Редактирование — как раньше.
function initialForm(editId: string | null, all: Listing[], lang: Lang, restoreDraft: boolean): Form {
  const saved = readAutosave();
  if (editId) {
    if (saved && saved.editId === editId) return { ...EMPTY, ...saved, editId: undefined } as Form;
    const o = all.find((x) => x.id === editId);
    return o ? fromListing(o, lang) : EMPTY;
  }
  if (restoreDraft && saved && !saved.editId) { const { editId: _e, ...rest } = saved; void _e; return { ...EMPTY, ...rest }; }
  return EMPTY;
}

const BADGE_C: Record<string, string> = { "": "#6b7688", new: "#22c15e", hot: "#e5484d", exc: "#7b4fd0" };
const BADGE_L = { new: { RU: "Новый", EN: "New", TR: "Yeni" }, hot: { RU: "Горячее", EN: "Hot", TR: "Fırsat" }, exc: { RU: "Эксклюзив", EN: "Exclusive", TR: "Özel" } };

type PreviewProps = { big?: boolean; photo?: string; badge: "" | Badge; lang: Lang; title: string; price: string; meta: string; chips: boolean; vnj: boolean; cit: boolean; t: { vnjChip: string; citChip: string } };
// `data-aprev` card (lines 596–606) and the FAB overlay card (lines 584–594).
function Preview({ big, photo, badge, lang, title, price, meta, chips, vnj, cit, t }: PreviewProps) {
  return (
    <div className={big ? "w-[320px] max-w-[94vw] overflow-hidden rounded-[18px] bg-surface shadow-[0_30px_80px_rgba(0,0,0,.4)]" : "max-w-[320px] overflow-hidden rounded-[16px] border border-line bg-surface shadow-[0_4px_14px_rgba(20,36,63,.08)]"}>
      <div className="relative bg-line-2 bg-cover bg-center" style={{ height: big ? 180 : 170, backgroundImage: photo ? `url(${photo})` : "none" }}>
        {badge && <span className="absolute left-[10px] top-[10px] rounded-[8px] px-[10px] py-1 text-[10.5px] font-bold text-white" style={{ background: BADGE_C[badge] }}>{BADGE_L[badge][lang]}</span>}
      </div>
      <div className={big ? "px-4 py-[14px]" : "px-[14px] py-3"}>
        <div className={big ? "text-[14.5px] font-bold text-ink" : "truncate text-[14px] font-bold text-ink"}>{title}</div>
        <div className={big ? "my-[3px] text-[17px] font-extrabold text-blue" : "my-[2px] text-[16.5px] font-extrabold text-blue"}>{price}</div>
        {chips && (
          <div className={`flex flex-wrap gap-[6px] ${big ? "mb-[6px] mt-[2px]" : "mb-[5px] mt-[1px]"}`}>
            {vnj && <span className="rounded-[10px] bg-[#e7f0fd] px-[9px] py-[3px] text-[10.5px] font-bold text-[#1565c0]">{t.vnjChip}</span>}
            {cit && <span className="rounded-[10px] bg-[#efe7fb] px-[9px] py-[3px] text-[10.5px] font-bold text-[#7b4fd0]">{t.citChip}</span>}
          </div>
        )}
        <div className={big ? "text-[12px] text-muted" : "text-[11.5px] text-muted"}>{meta}</div>
      </div>
    </div>
  );
}

// `chipF` (prototype) — chips for single/bool choices.
const chipCls = (on: boolean) =>
  `cursor-pointer rounded-[18px] border px-[13px] py-[9px] text-[12.5px] transition-[background,border-color] duration-[120ms] hover:bg-[#eef1f6] ${on ? "border-[#9db8f5] bg-blue-tint font-bold text-[#2c4a9e]" : "border-line bg-surface font-semibold text-[#3d4a5e]"}`;
// `roomBtn` (prototype 3086) — square-ish room buttons.
const roomCls = (on: boolean) =>
  `cursor-pointer rounded-[9px] border px-3 py-[9px] text-[12.5px] transition-[background,border-color] duration-[120ms] hover:bg-[#eef1f6] ${on ? "border-[#9db8f5] bg-blue-tint font-bold text-[#2c4a9e]" : "border-line bg-surface font-semibold text-text"}`;
const Chip = ({ on, label, onClick, cls = chipCls }: { on: boolean; label: string; onClick: () => void; cls?: (on: boolean) => string }) => <span onClick={onClick} className={cls(on)}>{label}</span>;
// `aLbl` (prototype 3801): filled fields get a bold dark label; `filled === undefined` keeps the static grey label.
const Label = ({ children, req, filled, style }: { children: ReactNode; req?: boolean; filled?: boolean; style?: CSSProperties }) => (
  <label
    className="mb-[6px] block text-[12.5px] transition-[color] duration-200"
    style={filled === undefined ? { fontWeight: 600, color: "#6b7688", ...style } : { fontWeight: filled ? 700 : 600, color: filled ? "#14243f" : "#8a93a2", ...style }}
  >
    {children} {req && <span className="text-red">*</span>}
  </label>
);
const inputCls = (miss?: boolean) => `w-full rounded-[10px] border px-[11px] py-[10px] text-[13.5px] outline-none ${miss ? "border-red" : "border-line"}`;
const Section = ({ icon, title, children, className = "" }: { icon: ReactNode; title: string; children: ReactNode; className?: string }) => (
  <section className={`rounded-[16px] border border-line bg-surface p-[22px] ${className}`}>
    <div className="mb-[14px] flex items-center gap-[10px]">
      <span className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] bg-blue-tint text-[16px] text-blue-2">{icon}</span>
      <span className="text-[15px] font-extrabold text-ink">{title}</span>
    </div>
    {children}
  </section>
);
const filledS = (v: string) => !!String(v || "").trim();

export function AddForm() {
  const { t, lang } = useI18n();
  const rates = useRates();
  useMahalleLoaded(); // полный список махалле нужен для сопоставления адреса с ключами справочника
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("edit");
  const all = useAllListings();
  const { toggleSel } = usePrefs();
  const restoreDraft = params.get("draft") === "1"; // карточка черновика «Продолжить»
  const [f, setF] = useState<Form>(() => initialForm(editId, all, lang, restoreDraft));
  // Непринятый черновик из автосохранения: баннер «Продолжить / Удалить»; пока он висит, автосохранение не затирает старый черновик.
  const [pendingDraft, setPendingDraft] = useState<Saved | null>(() => { if (editId || restoreDraft) return null; const s = readAutosave(); return s && !s.editId ? s : null; });
  const [miss, setMiss] = useState(false);
  const [dupOk, setDupOk] = useState(false);
  const [dupOpen, setDupOpen] = useState(false);
  const [roomsAll, setRoomsAll] = useState(false);
  const [geo, setGeo] = useState(false);
  const others = (["RU", "EN", "TR"] as const).filter((l) => l !== lang);
  const [translated, setTranslated] = useState(false);
  const [trBusy, setTrBusy] = useState(false);
  // Реальный ИИ-перевод описания на два других языка (тот же серверный экшен, что в кабинете застройщика); прототип подставлял мок DESCS.
  async function aiTranslate() {
    const src = f.desc.trim(), srcT = f.title.trim();
    if (!src && !srcT) { showToast(t.add.trEmpty); return; }
    if (trBusy) return;
    setTrBusy(true);
    try {
      const none: TranslateResult = { text: "", fallback: true };
      const [rd, rt] = await Promise.all([
        Promise.all(others.map((l) => (src ? translate(src, l, "description") : Promise.resolve(none)))),
        Promise.all(others.map((l) => (srcT ? translate(srcT, l, "title") : Promise.resolve(none)))),
      ]);
      if ((src && rd.some((r) => r.fallback)) || (srcT && rt.some((r) => r.fallback))) showToast(t.add.trErr);
      const descs: Partial<Record<Lang, string>> = { ...f.descs }, titles: Partial<Record<Lang, string>> = { ...f.titles };
      others.forEach((l, i) => { if (!rd[i].fallback) descs[l] = rd[i].text; if (!rt[i].fallback) titles[l] = rt[i].text; });
      set({ descs, titles });
      if (rd.some((r) => !r.fallback) || rt.some((r) => !r.fallback)) setTranslated(true);
    } catch { showToast(t.add.trErr); } finally { setTrBusy(false); }
  }
  const [prevOpen, setPrevOpen] = useState(false);
  const [published, setPublished] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const dragFrom = useRef<number | null>(null);

  const set = (patch: Partial<Form>) => setF((p) => ({ ...p, ...patch }));

  // Autosave (800 ms debounce, line 2581): everything except photos; also in edit mode (with `editId`).
  useEffect(() => {
    if (pendingDraft) return; // старый черновик ещё не принят и не удалён — не перезаписываем
    const id = setTimeout(() => {
      try { const { photos: _p, ...snap } = f; void _p; localStorage.setItem(AUTOSAVE_KEY, JSON.stringify({ ...snap, editId: editId || null })); } catch {}
    }, 800);
    return () => clearTimeout(id);
  }, [f, editId, pendingDraft]);

  const isLand = f.type === "land", isFlat = f.type === "flat", isHouse = f.type === "house", isComm = f.type === "comm", isRent = f.deal === "rent";
  const { gIl, gIlce, gSemt } = geoOf(f.il, f.ilce, f.semt);
  // `addGeoLabel` (line 3909): empty until an İl is chosen.
  const geoLabel = f.il ? ilName(f.il) + (f.ilce ? ` › ${ilceName(f.ilce)}` : "") + (f.semt ? ` › ${semtName(f.ilce, f.semt)}` : "") : "";
  const geoNames = useMemo(() => ({ il: gIl?.n ?? "", ilce: gIlce?.n ?? "", semt: gSemt?.n ?? "" }), [gIl, gIlce, gSemt]);

  const priceN = +digits(f.price) || 0;
  // `aReqPairs` (line 3625)
  const req: (keyof Form)[] = ["title", "price", "area", "ll", ...(!isLand ? (["net", "year"] as (keyof Form)[]) : []), ...(isFlat ? (["floor"] as (keyof Form)[]) : []), ...(isRent ? (["dep"] as (keyof Form)[]) : [])];
  const done = req.filter((k) => { const v = f[k]; return v && String(v).trim(); }).length;
  const progress = Math.round((done / req.length) * 100);

  // Duplicates (line 3292): same ilçe + rooms, price within ±12 % in €, up to 3.
  const dupList = useMemo(() => {
    if (!priceN) return [];
    const aEur = eur({ price: priceN, cur: "TRY" });
    return all.filter((o) => o.ilce === f.ilce && o.rooms === f.rooms && o.id !== editId && Math.abs(eur(o) - aEur) / eur(o) < 0.12).slice(0, 3);
  }, [all, priceN, f.ilce, f.rooms, editId]);

  // `_setAddPin` (line 2671): pin → reverse geocode → İl/İlçe/Semt keys (new ones are registered in GEO).
  async function pickPin(ll: [number, number]) {
    set({ ll });
    const g = await reverseGeocode(ll);
    if (!g) return;
    const keys = matchGeo(g);
    const patch: Partial<Form> = { addr: g.addr };
    if (keys.il) { patch.il = keys.il; if (keys.ilce) { patch.ilce = keys.ilce; patch.semt = keys.semt; } }
    set(patch);
  }
  // Подсказка Google выбрана: координаты и İl/İlçe/Mahalle уже известны — без обратного геокодирования.
  function applyPlace(p: GPlace) {
    const keys = matchGeo({ il: p.il, ilce: p.ilce, semt: p.semt });
    const patch: Partial<Form> = { ll: [p.lat, p.lng], addr: p.addr };
    if (keys.il) { patch.il = keys.il; if (keys.ilce) { patch.ilce = keys.ilce; patch.semt = keys.semt; } }
    set(patch);
  }
  // Ссылка/координаты → метка. Полные ссылки Google/Яндекс/Apple/2GIS и «lat, lng» разбирает `parseMapLink`;
  // короткие (maps.app.goo.gl и т. п.) разворачивает сервер (`expandMapLink`) — как в кабинете застройщика.
  async function geoFind() {
    const v = f.link.trim();
    if (!v) { showToast(t.add.linkBad); return; }
    const p = parseMapLink(v);
    if (p) { pickPin([p.lat, p.lng]); return; }
    if (!isMapLink(v)) { showToast(t.add.linkBad); return; }
    showToast(t.add.linkWait);
    const r = await expandMapLink(v);
    if (!r) { showToast(t.add.linkBad); return; }
    pickPin([r.lat, r.lng]);
  }
  // Фото: сжимаем в браузере до 1600 px сразу (29 снимков по 4–8 МБ с iPhone в виде data-URL вешали форму, 16.10.2026),
  // по одному с прогрессом; HEIC/неизвестный тип тоже пробуем (Safari декодирует сам), при ошибке файл пропускаем с сообщением.
  const [photoBusy, setPhotoBusy] = useState<{ done: number; total: number } | null>(null);
  async function addFiles(files: FileList | null) {
    if (!files) return;
    const all = Array.from(files).filter((x) => x.type.startsWith("image/") || /\.(heic|heif|jpe?g|png|webp)$/i.test(x.name));
    if (!all.length) return;
    const room = Math.max(0, MAX_PHOTOS - f.photos.length);
    if (room === 0) { showToast(t.add.photoLimitFull.replace("{max}", String(MAX_PHOTOS))); return; }
    const list = all.slice(0, room);
    if (all.length > room) showToast(t.add.photoLimit.replace("{max}", String(MAX_PHOTOS)).replace("{added}", String(list.length)).replace("{skipped}", String(all.length - room)));
    setPhotoBusy({ done: 0, total: list.length });
    let failed = 0;
    for (let i = 0; i < list.length; i++) {
      const file = list[i];
      try {
        const url = URL.createObjectURL(file);
        let dataUrl: string;
        try {
          const blob = await shrinkImage(url, 1600, 0.82);
          dataUrl = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
        } finally { URL.revokeObjectURL(url); }
        setF((p) => ({ ...p, photos: [...p.photos, dataUrl] }));
      } catch { failed++; }
      setPhotoBusy({ done: i + 1, total: list.length });
    }
    setPhotoBusy(null);
    if (failed) showToast(t.add.photoFail.replace("{n}", String(failed)));
  }
  function genTitle() {
    const p: string[] = [];
    p.push(isFlat || isHouse ? f.rooms : t.typ[f.type]);
    p.push(gSemt?.n ?? gIlce?.n ?? "");
    if (f.net || f.area) p.push(`${f.net || f.area} м²`);
    if (f.sea && +f.sea <= 1000) p.push(lang === "RU" ? `${f.sea} м до моря` : lang === "TR" ? `denize ${f.sea} m` : `${f.sea} m to the sea`);
    set({ title: p.filter(Boolean).join(", ") });
  }

  // `doPublish` object (lines 3644–3664).
  function build(): Listing {
    // id: с входом — uuid (ключ строки в базе), в демо-режиме — как раньше
    const id = editId ?? (getMeId() !== "me" && typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `x${nowId()}`);
    const price = priceN || 5000000;
    const gI = ILCES[f.ilce] || GEO[0].ilces[0];
    const sm = gI.semts.find((x) => x.k === f.semt);
    const locName = gI.n + (sm ? ` · ${sm.n}` : "");
    const title = f.title.trim() || `${f.rooms} ${sm ? sm.n : gI.n}`;
    const descTxt = f.desc.trim();
    // Описание: текст на языке формы + переводы (ИИ/ручные); без перевода остальные языки получают исходный текст.
    const desc = descTxt ? { RU: f.descs.RU || f.desc, EN: f.descs.EN || f.desc, TR: f.descs.TR || f.desc, [lang]: f.desc } : { ...DESCS[1] };
    const today = new Date().toLocaleDateString("ru-RU");
    const prev = editId ? all.find((x) => x.id === editId) : undefined;
    const img = f.photos[0] || NO_PHOTO;
    const ilK = IL_OF[f.ilce] || "antalya";
    const cityKey = ilK !== "antalya" ? ilK : f.ilce === "alanya" ? "alanya" : f.ilce === "serik" ? "belek" : "antalya";
    const base = CITY_LL[cityKey] || CITY_LL.antalya;
    return {
      id, owner: prev?.owner ?? getMeId(), created: prev?.created ?? today, updated: today, deal: f.deal, type: f.type,
      vnj: f.deal === "sale" && f.vnj, cit: f.deal === "sale" && f.cit, badge: f.badge || undefined,
      heat: isLand ? [] : f.heat.slice(), bath: isLand ? 0 : +f.bath || 1,
      age: f.year ? Math.max(0, new Date().getFullYear() - (+f.year || new Date().getFullYear())) : 0,
      lift: f.lift, gasline: f.gas, own5: f.own5, balcony: !isLand && f.balc, furn: !isLand && f.furn === "yes",
      aidat: isFlat ? +f.aidat || 0 : 0, seaDist: +f.sea || 500, inSite: !isLand && f.site,
      credit: f.deal === "sale" && f.credit, takas: f.deal === "sale" && f.takas, feats: isLand ? [] : f.feats.slice(),
      usage: isFlat ? f.usage : undefined, cephe: isFlat ? (prev?.cephe ?? "guney") : undefined,
      imar: isLand ? f.imar : undefined, emsal: isLand ? +f.emsal || 0.5 : undefined, adaParsel: isLand ? f.ada || "—" : undefined, tapu: isLand ? f.tapu : "mulkiyet",
      garden: isHouse ? +f.garden || 0 : undefined, commType: isComm ? f.commType : undefined, kiraci: isComm && f.kiraci, devir: isComm && f.devir,
      deposit: isRent ? +digits(f.dep) || price * 2 : undefined, floorN: +(f.floor || 0) || 0, floorsTotal: +(f.floors || 0) || 0,
      t: { RU: f.titles.RU || title, EN: f.titles.EN || title, TR: f.titles.TR || title, [lang]: title }, price, cur: "TRY", rooms: isFlat || isHouse ? f.rooms : "",
      area: isLand ? +f.area || 400 : +f.net || +f.area || 90, fl: isHouse || isLand ? "—" : `${f.floor || "3"}/${f.floors || "5"}`,
      cityKey, il: f.il || ilK, ilce: gI.k, semt: sm ? sm.k : "", loc: { RU: locName, EN: locName, TR: locName }, img,
      photos: f.photos.length ? f.photos.slice() : [img], ll: f.ll ? [f.ll[0], f.ll[1]] : [base[0] + 0.012, base[1] + 0.012],
      desc, base: lang, comm: prev?.comm ?? 3, st: prev?.st ?? "active", ph: prev?.ph,
    };
  }
  async function publish() {
    if (trBusy) return;
    const missing: string[] = [];
    if (isRent && !f.dep.trim()) missing.push(t.par.dep);
    if (!f.title.trim()) missing.push(t.add.titleL);
    if (!f.price.trim()) missing.push(t.add.price);
    if (!f.area) missing.push(isLand ? t.cat.plotL : t.cat.grossL);
    if (!isLand && !f.net) missing.push(t.cat.netL);
    if (!isLand && !f.year) missing.push(t.add.yearL);
    if (isFlat && !f.floor) missing.push(t.add.floor);
    if (!isLand && !f.furn) missing.push(t.par.furnL);
    if (!f.ll) missing.push(t.add.pinL);
    if (missing.length) { setMiss(true); showToast(`${t.add.reqMiss}: ${missing.join(", ")}`); return; }
    if (dupList.length && !dupOk && !editId) { setDupOk(true); showToast(t.add.dupAsk); return; }
    if (f.aDraftId) delDraft(f.aDraftId);
    const o = build();
    // Автоперевод заголовка и описания на незаполненные языки (план пользователя 11.10.2026); без ключа/сети — одинаковый текст везде.
    if (others.some((l) => !f.titles[l]?.trim() || (f.desc.trim() && !f.descs[l]?.trim()))) showToast(t.add.trWait);
    setTrBusy(true);
    try {
      const r = await fillTranslations({ base: lang, title: f.title, desc: f.desc, titles: f.titles, descs: f.descs });
      o.t = r.t; if (f.desc.trim()) o.desc = r.desc; o.mt = r.mt;
    } catch { showToast(t.add.trErr); } finally { setTrBusy(false); }
    upsertLocalListing(o);
    if (editId) {
      try { localStorage.removeItem(AUTOSAVE_KEY); } catch {}
      showToast(t.add.savedEdit);
      router.push(`/obj/${o.id}`);
      window.scrollTo(0, 0);
      return;
    }
    setPublished(o.id);
    setDupOk(false);
    setTranslated(false);
    set({ aDraftId: "", desc: "", descs: {}, titles: {}, price: "", area: "", floor: "" });
    showToast("✓");
    window.scrollTo(0, 0);
  }
  // `doDraft` (line 3781): snapshot into `drafts[]` under `dcId`, then «Мои объекты».
  function saveDraft() {
    const did = f.aDraftId || `dc${nowId()}`;
    putDraft({ ...f, aDraftId: did, dcId: did });
    set({ aDraftId: did });
    showToast(t.add.draftSaved);
    router.push("/mine");
  }
  const goMine = () => router.push("/mine");

  const heatToggle = (k: Heat) => {
    const cur = f.heat;
    set({ heat: k === "none" ? (cur.includes("none") ? [] : ["none"]) : cur.includes(k) ? cur.filter((x) => x !== k) : [...cur.filter((x) => x !== "none"), k] });
  };
  const roomList = roomsAll ? ROOMS_ALL : [...ROOMS_BASIC, ...(ROOMS_BASIC.includes(f.rooms) ? [] : [f.rooms])];
  const seaOpts: [string, string][] = [["300", t.cat.sea300], ["1000", t.cat.sea1], ["3000", t.cat.sea3], ["5000", t.cat.sea5], ["9000", t.cat.sea5p]];
  const flags: [keyof Form, string][] = [["balc", t.cat.balcB], ["lift", t.add.liftL], ["gas", t.add.gasL], ["site", t.ext.siteB],
    ...(f.deal === "sale" ? ([["vnj", t.cat.vnjChip], ["cit", t.cat.citChip], ["credit", t.ext.creditB], ["takas", t.ext.takasB], ["own5", t.add.own5L]] as [keyof Form, string][]) : [])];
  const anyFlag = f.balc || f.lift || f.gas || f.site || f.vnj || f.cit || f.credit || f.takas || f.own5;
  const priceSuffix = isRent ? t.cat.perMo : f.deal === "daily" ? t.cat.perDay : "";
  const priceEq = `≈ ${Math.round(priceN / rates.eur).toLocaleString("ru-RU")} € · ${Math.round(priceN / rates.usd).toLocaleString("ru-RU")} $`;
  // Preview (lines 3796–3808)
  const previewProps: Omit<PreviewProps, "big"> = {
    photo: f.photos[0], badge: f.badge, lang,
    title: f.title.trim() || t.add.titlePh,
    price: (f.price.trim() ? fmt(priceN, "TRY") : "— ₺") + priceSuffix,
    meta: (isFlat || isHouse ? `${f.rooms} · ` : "") + (f.area ? `${f.area} м² · ` : "") + ilName(f.il) + (f.ilce ? ` · ${ilceName(f.ilce)}` : ""),
    chips: f.deal === "sale" && (f.vnj || f.cit), vnj: f.deal === "sale" && f.vnj, cit: f.deal === "sale" && f.cit,
    t: { vnjChip: t.cat.vnjChip, citChip: t.cat.citChip },
  };

  return (
    <div className="mx-auto max-w-[820px]">
      <button type="button" onClick={goMine} className="mb-[14px] inline-flex cursor-pointer items-center gap-[6px] text-[13px] font-semibold text-text-2 hover:text-blue"><IconArrowLeft size={16} /> {t.nav.mine}</button>
      <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.add.title}</h1>
      <p className="mb-5 mt-[5px] text-[14px] text-text-2 [text-wrap:pretty]">{t.add.sub}</p>
      {pendingDraft && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[12px] border border-[#f3d9a4] bg-[#fff8e8] px-4 py-3 text-[13px] text-ink">
          <IconFileText size={16} className="text-warn" /><span className="flex-1">{t.add.draftRow}</span>
          <button type="button" onClick={() => { const { editId: _e, ...rest } = pendingDraft; void _e; setF({ ...EMPTY, ...rest }); setPendingDraft(null); }} className="cursor-pointer rounded-[9px] bg-blue px-3 py-[7px] text-[12.5px] font-bold text-white">{t.add.draftGo}</button>
          <button type="button" onClick={() => { try { localStorage.removeItem(AUTOSAVE_KEY); } catch {} setPendingDraft(null); }} className="cursor-pointer rounded-[9px] border border-line bg-surface px-3 py-[7px] text-[12.5px] font-semibold text-text-2">{t.sel.del}</button>
        </div>
      )}

      <Section icon={<IconBuildingEstate size={16} />} title={t.add.secMain}>
        <div className="mb-[18px] flex flex-wrap gap-[26px]">
          <div><Label filled>{t.add.dealL}</Label><div className="flex flex-wrap gap-[6px]">{(["sale", "rent", "daily"] as Deal[]).map((k) => <Chip key={k} on={f.deal === k} label={t.deal[k]} onClick={() => set({ deal: k })} />)}</div></div>
          <div><Label filled>{t.add.typeL}</Label><div className="flex flex-wrap gap-[6px]">{(["flat", "house", "comm", "land"] as PropType[]).map((k) => <Chip key={k} on={f.type === k} label={t.typ[k]} onClick={() => set({ type: k })} />)}</div></div>
        </div>
      </Section>

      <Section icon={<IconMapPin size={16} />} title={t.add.secLoc} className="mt-[14px]">
        <div className="mb-4">
          <Label filled={!!f.ilce}>{t.geo.loc} · İl / İlçe / Semt (Mahalle)</Label>
          <div onClick={() => setGeo(true)} className="relative cursor-pointer rounded-[10px] border border-line bg-surface py-[10px] pl-[34px] pr-[30px] text-[13.5px] text-ink hover:border-blue">
            <IconMapPin size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" />{geoLabel || " "}
            <IconChevronDown size={14} className="absolute right-[11px] top-1/2 -translate-y-1/2 text-muted" />
          </div>
        </div>
        <div className="mb-[18px]">
          <Label>{t.add.linkL}</Label>
          <div className="flex gap-2">
            <AddressSearch value={f.link} onChange={(v) => set({ link: v })} onPick={applyPlace} placeholder={t.add.linkPh} className={`${inputCls()} text-[13px]`} lang={lang} bias={f.ll} />
            <button type="button" onClick={geoFind} className="flex flex-none cursor-pointer items-center gap-1 rounded-[10px] border border-[#d8e3ff] bg-blue-tint px-4 py-[10px] text-[13px] font-bold text-blue-2 hover:bg-[#e2ebff]"><IconSearch size={15} /> {t.add.findL}</button>
          </div>
          <Label req filled={!!f.ll} style={{ margin: "12px 0 4px" }}>{t.add.pinL}</Label>
          <div className="mb-2 text-[12px] text-muted">{t.add.pinH}</div>
          {f.addr && <div className="mb-2 flex items-center gap-2 rounded-[10px] bg-blue-tint px-3 py-[9px] text-[12.5px] text-[#2c4a9e]"><IconMapPin size={14} /> {t.add.foundL}: {f.addr}</div>}
          <div className={`rounded-[12px] ${miss && !f.ll ? "ring-2 ring-red" : ""}`}><AddMap ll={f.ll} geo={geoNames} onPick={pickPin} /></div>
        </div>
      </Section>

      <Section icon={<IconAdjustmentsHorizontal size={16} />} title={t.add.secPar} className="mt-[14px]">
        <div className="mb-4 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-[14px]">
          {(isFlat || isHouse) && (
            <div className="col-span-full">
              <Label filled={!!f.rooms}>{t.add.rooms}</Label>
              <div className="flex flex-wrap items-center gap-[5px]">
                {roomList.map((r) => <Chip key={r} on={f.rooms === r} label={r} onClick={() => set({ rooms: r })} cls={roomCls} />)}
                <span onClick={() => setRoomsAll((v) => !v)} className="inline-flex cursor-pointer items-center gap-1 px-[6px] py-[9px] text-[12.5px] font-semibold text-blue-2 hover:bg-[#eef1f6]">
                  {roomsAll ? t.cat.roomsBasic : t.cat.roomsAll} {roomsAll ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
                </span>
              </div>
            </div>
          )}
          <div><Label req filled={filledS(f.area)}>{isLand ? t.cat.plotL : t.cat.grossL}</Label><input value={f.area} onChange={(e) => set({ area: digits(e.target.value) })} placeholder="120" className={inputCls(miss && !f.area)} inputMode="numeric" /></div>
          {!isLand && <div><Label req filled={filledS(f.net)}>{t.cat.netL}</Label><input value={f.net} onChange={(e) => set({ net: digits(e.target.value) })} placeholder="105" className={inputCls(miss && !f.net)} inputMode="numeric" /></div>}
          {isHouse && <div><Label>{t.ext.gardenP}, m²</Label><input value={f.garden} onChange={(e) => set({ garden: digits(e.target.value) })} placeholder="400" className={inputCls()} inputMode="numeric" /></div>}
          {(isFlat || isComm) && <div><Label req filled={filledS(f.floor)}>{t.add.floor}</Label><input value={f.floor} onChange={(e) => set({ floor: digits(e.target.value) })} placeholder="3" className={inputCls(miss && !f.floor)} inputMode="numeric" /></div>}
          {!isLand && (
            <>
              <div><Label filled={filledS(f.floors)}>{t.add.floorsL}</Label><input value={f.floors} onChange={(e) => set({ floors: digits(e.target.value) })} placeholder="5" className={inputCls()} inputMode="numeric" /></div>
              <div><Label req filled={filledS(f.year)}>{t.add.yearL}</Label><input value={f.year} onChange={(e) => set({ year: digits(e.target.value).slice(0, 4) })} placeholder="2021" className={inputCls(miss && !f.year)} inputMode="numeric" /></div>
            </>
          )}
          {isLand && (
            <>
              <div><Label>{t.ext.emsalP}</Label><input value={f.emsal} onChange={(e) => set({ emsal: e.target.value })} placeholder="0.5" className={inputCls()} inputMode="decimal" /></div>
              <div><Label>{t.ext.adaP}</Label><input value={f.ada} onChange={(e) => set({ ada: e.target.value })} placeholder="120 / 4" className={inputCls()} /></div>
            </>
          )}
          <div className="col-span-full"><Label filled={["300", "1000", "3000", "5000", "9000"].includes(f.sea)}>{t.par.sea}</Label><div className="flex flex-wrap gap-[5px]">{seaOpts.map(([v, l]) => <Chip key={v} on={f.sea === v} label={l} onClick={() => set({ sea: v })} />)}</div></div>
          {isFlat && <div><Label filled={filledS(f.aidat)}>{t.par.aidat}, ₺</Label><input value={f.aidat} onChange={(e) => set({ aidat: digits(e.target.value) })} placeholder="500" className={inputCls()} inputMode="numeric" /></div>}
          {isRent && <div><Label req filled={filledS(f.dep)}>{t.par.dep}, ₺</Label><input value={f.dep} onChange={(e) => set({ dep: fmtIn(e.target.value) })} placeholder="—" className={inputCls(miss && !f.dep)} inputMode="numeric" /></div>}
        </div>
        {!isLand && (
          <>
            <div className="mb-[14px]"><Label filled={f.heat.length > 0}>{t.cat.heatT} · {t.par.bath}</Label>
              <div className="flex flex-wrap items-center gap-[6px]">
                {(["none", "kombi", "central", "ac", "floor"] as Heat[]).map((k) => <Chip key={k} on={f.heat.includes(k)} label={t.heatL[k]} onClick={() => heatToggle(k)} />)}
                <span className="mx-1 w-px self-stretch bg-line" />
                {["1", "2", "3"].map((k) => <Chip key={k} on={f.bath === k} label={`${k === "3" ? "3+" : k} WC`} onClick={() => set({ bath: k })} />)}
              </div>
            </div>
            <div className="mb-[14px]"><Label req filled={!!f.furn}>{t.par.furnL}</Label>
              <div className="flex flex-wrap gap-[6px]">{(["yes", "no"] as const).map((k) => <Chip key={k} on={f.furn === k} label={t.furn[k]} onClick={() => set({ furn: k })} />)}</div>
            </div>
            <div className="mb-[14px]"><Label filled={anyFlag}>{t.add.flagsL}</Label>
              <div className="flex flex-wrap gap-[6px]">{flags.map(([k, l]) => <Chip key={k} on={!!f[k]} label={l} onClick={() => set({ [k]: !f[k] } as Partial<Form>)} />)}</div>
            </div>
          </>
        )}
        <div className="mb-[14px]"><Label filled={!!f.badge}>{t.add.badgeL}</Label>
          <div className="flex flex-wrap gap-[6px]">
            {(["", "new", "hot", "exc"] as const).map((k) => {
              const c = BADGE_C[k], on = f.badge === k;
              return <span key={k} onClick={() => set({ badge: k })} className="cursor-pointer rounded-[18px] border px-[14px] py-[9px] text-[12.5px] font-bold hover:bg-[#eef1f6]" style={on ? { borderColor: c, background: c, color: "#fff" } : { borderColor: "#e6e9f0", background: "#fff", color: c }}>{k ? BADGE_L[k][lang] : t.add.badgeNone}</span>;
            })}
          </div>
          <div className="mt-[7px] text-[11.5px] text-muted">{t.add.badgeHint}</div>
        </div>
        {(isFlat || isHouse) && f.deal === "sale" && (
          <div className="mb-[14px]"><Label req filled={!!f.usage}>{isHouse ? t.ext.usageTH : t.ext.usageT}</Label>
            <div className="flex flex-wrap gap-[6px]">{(["empty", "owner", "tenant"] as Usage[]).map((k) => <Chip key={k} on={f.usage === k} label={t.ext.usageL[k]} onClick={() => set({ usage: k })} />)}</div>
          </div>
        )}
        {isComm && (
          <div className="mb-[14px]"><Label filled={!!f.commType}>{t.ext.commT}</Label>
            <div className="flex flex-wrap items-center gap-[6px]">
              {(["shop", "office", "depot", "rest"] as CommType[]).map((k) => <Chip key={k} on={f.commType === k} label={t.ext.commL[k]} onClick={() => set({ commType: k })} />)}
              <span className="mx-1 w-px self-stretch bg-line" />
              <Chip on={f.kiraci} label={t.ext.kiraciB} onClick={() => set({ kiraci: !f.kiraci })} />
              <Chip on={f.devir} label={t.ext.devirB} onClick={() => set({ devir: !f.devir })} />
            </div>
          </div>
        )}
        {isLand && (
          <div className="mb-[14px]"><Label filled={!!f.imar && !!f.tapu}>{t.ext.imarT} · {t.ext.tapuT}</Label>
            <div className="flex flex-wrap items-center gap-[6px]">
              {(["konut", "ticari", "tarla", "imarsiz"] as Imar[]).map((k) => <Chip key={k} on={f.imar === k} label={t.ext.imarL[k]} onClick={() => set({ imar: k })} />)}
              <span className="mx-1 w-px self-stretch bg-line" />
              {(["mustakil", "hisseli"] as const).map((k) => <Chip key={k} on={f.tapu === k} label={t.ext.tapuL[k]} onClick={() => set({ tapu: k })} />)}
            </div>
          </div>
        )}
        {!isLand && (
          <div className="mb-4"><Label filled={f.feats.length > 0}>{t.cat.featT}</Label>
            <div className="flex flex-wrap gap-[6px]">{FEATS.map((k) => <Chip key={k} on={f.feats.includes(k)} label={t.feat[k]} onClick={() => set({ feats: f.feats.includes(k) ? f.feats.filter((x) => x !== k) : [...f.feats, k] })} />)}</div>
          </div>
        )}
        {dupList.length > 0 && (
          <>
            <div className="mb-3 flex flex-wrap items-center gap-[10px] rounded-[12px] border border-[#f3e2ae] bg-[#fdf5df] px-[14px] py-[10px]">
              <IconAlertTriangle size={17} className="text-[#c98d00]" />
              <span className="min-w-[180px] flex-1 text-[12.5px] font-semibold text-[#8a6400]">{t.add.dupT} · {dupList.length}</span>
              <span onClick={() => setDupOpen((v) => !v)} className="cursor-pointer text-[12.5px] font-bold text-[#c98d00] underline hover:bg-[#eef1f6]">{dupOpen ? t.common.back : t.add.dupOpen}</span>
            </div>
            {dupOpen && (
              <div className="mb-4 flex flex-col gap-2">
                {dupList.map((d) => (
                  <div key={d.id} className="flex items-center gap-[10px] rounded-[10px] border border-[#f3e2ae] bg-surface px-[10px] py-2">
                    <span className="h-10 w-10 flex-none rounded-[8px] bg-cover bg-center" style={{ backgroundImage: `url('${d.img}')` }} />
                    <span className="min-w-0 flex-1"><span className="block truncate text-[12.5px] font-bold text-ink">{d.t[lang]}</span><span className="block text-[11.5px] text-muted">{d.rooms} · {fmt(d.price, d.cur)} · {REALTORS[d.owner]?.name ?? ""}</span></span>
                    <Link href={`/obj/${d.id}`} onClick={() => { setPrevScreen("add"); window.scrollTo(0, 0); }} className="flex-none text-[12px] font-semibold text-blue hover:text-blue-2">{t.add.dupOpen}</Link>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      <Section icon={<IconPhoto size={16} />} title={t.add.photos} className="mt-[14px]">
        <div className="mb-[18px]">
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => { e.preventDefault(); addFiles(e.dataTransfer.files); }}
            onClick={() => fileRef.current?.click()}
            className="cursor-pointer rounded-[14px] border-2 border-dashed border-[#c9d3e4] bg-[#fafbfd] px-4 py-6 text-center text-text-2 hover:border-blue"
          >
            <IconCloudUpload size={28} className="mx-auto text-blue" />
            <div className="mt-[6px] text-[13.5px] font-bold text-ink">{t.add.upT}</div>
            <div className="mt-[3px] text-[12px] text-muted">{photoBusy ? t.add.photoBusy.replace("{done}", String(photoBusy.done)).replace("{total}", String(photoBusy.total)) : t.add.upS}</div>
            {f.photos.length > 0 && !photoBusy && <div className={`mt-[6px] inline-block rounded-[8px] px-[8px] py-[2px] text-[11.5px] font-bold ${f.photos.length >= MAX_PHOTOS ? "bg-[#fdf5df] text-[#c98d00]" : "bg-bg-2 text-text-2"}`}>{t.add.photoCount.replace("{n}", String(f.photos.length)).replace("{max}", String(MAX_PHOTOS))}</div>}
          </div>
          <input ref={fileRef} type="file" accept="image/*" multiple id="ph-input" className="hidden" onChange={(e) => { addFiles(e.target.files); e.target.value = ""; }} />
          {f.photos.length > 0 && (
            <>
              <div className="mt-3 grid grid-cols-[repeat(auto-fill,minmax(128px,1fr))] gap-[10px]">
                {f.photos.map((p, i) => (
                  <div
                    key={i}
                    draggable
                    onDragStart={() => { dragFrom.current = i; }}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={(e) => { e.preventDefault(); const from = dragFrom.current; if (from === null || from === i) return; const arr = [...f.photos]; const [m] = arr.splice(from, 1); arr.splice(i, 0, m); set({ photos: arr }); dragFrom.current = null; }}
                    className="relative aspect-[4/3] cursor-grab rounded-[12px] bg-cover bg-center"
                    style={{ backgroundImage: `url(${p})`, border: `2px solid ${i === 0 ? "#3b5fd6" : "#e6e9f0"}` }}
                  >
                    {i === 0 && <span className="absolute left-[6px] top-[6px] rounded-[8px] bg-ink px-2 py-[3px] text-[9.5px] font-bold text-white">{t.add.cover}</span>}
                    <span onClick={(e) => { e.stopPropagation(); set({ photos: f.photos.filter((_, k) => k !== i) }); }} className="absolute right-[6px] top-[6px] flex h-6 w-6 cursor-pointer items-center justify-center rounded-[8px] bg-[rgba(255,255,255,.95)] text-[13px] text-red hover:brightness-[.96]"><IconX size={13} /></span>
                  </div>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-1 text-[11.5px] text-muted"><IconArrowsMove size={13} /> {t.add.reorder}</div>
            </>
          )}
        </div>
      </Section>

      <Section icon={<IconFileText size={16} />} title={t.add.secFin} className="mt-[14px]">
        <div className="mb-4 flex flex-wrap gap-[26px]">
          <div>
            <Label req filled={filledS(f.price)}>{t.add.price}, ₺{priceSuffix}</Label>
            <input value={f.price} onChange={(e) => set({ price: fmtIn(e.target.value) })} placeholder="5 000 000" className={`${inputCls(miss && !f.price)} max-w-[220px]`} inputMode="numeric" />
            {priceN > 0 && <div className="mt-[5px] text-[12px] text-muted">{priceEq}</div>}
          </div>
        </div>
        <div className="mb-4">
          <Label req filled={filledS(f.title)}>{t.add.titleL}</Label>
          <div className="flex gap-2">
            <div className="min-w-0 flex-1"><input value={f.title} onChange={(e) => set({ title: e.target.value })} placeholder={t.add.titlePh} className={`w-full rounded-[10px] border px-3 py-[11px] text-[14px] outline-none ${miss && !f.title.trim() ? "border-red" : "border-line"}`} /></div>
            <button type="button" onClick={genTitle} className="flex flex-none cursor-pointer items-center gap-1 rounded-[10px] border border-[#d8e3ff] bg-blue-tint px-[14px] py-[10px] text-[13px] font-bold text-blue-2 hover:bg-[#e2ebff]"><IconSparkles size={15} /> {t.add.genT}</button>
          </div>
        </div>
        <Label filled={filledS(f.desc)}>{t.add.desc}</Label>
        <textarea value={f.desc} onChange={(e) => set({ desc: e.target.value })} placeholder={t.add.descPh} className="mb-3 min-h-[92px] w-full resize-y rounded-[12px] border border-line px-[13px] py-3 text-[14px] leading-[1.55] outline-none" />
        <button type="button" onClick={aiTranslate} disabled={trBusy} className="inline-flex cursor-pointer items-center gap-[7px] rounded-[11px] border border-[#d8e3ff] bg-blue-tint px-4 py-[11px] text-[13.5px] font-bold text-blue hover:bg-[#e2ebff] disabled:opacity-60"><IconSparkles size={16} className={trBusy ? "animate-pulse" : ""} /> {trBusy ? t.add.trBusy : t.add.tr}</button>
        {(translated || others.some((l) => f.descs[l] || f.titles[l])) && (
          <>
            <div className="mb-[10px] mt-[14px] flex items-center gap-[7px] text-[12.5px] text-green"><IconCircleCheck size={15} /> {t.add.trDone}</div>
            <div className="grid grid-cols-[repeat(auto-fit,minmax(240px,1fr))] gap-[10px]">
              {others.map((l) => (
                <div key={l} className="rounded-[12px] border border-line bg-[#fafbfd] px-[14px] py-[13px]">
                  <div className="mb-[7px] flex items-center gap-[7px]"><span className="text-[11px] font-extrabold text-ink">{l}</span><span className="inline-flex items-center gap-1 rounded-[12px] bg-[#efe7fb] px-2 py-[2px] text-[10px] font-bold text-[#7b4fd0]"><IconSparkles size={10} /> {t.add.ai}</span></div>
                  <input value={f.titles[l] ?? ""} onChange={(e) => set({ titles: { ...f.titles, [l]: e.target.value } })} placeholder={t.add.titleL} className="mb-[6px] w-full rounded-[9px] border border-transparent bg-transparent px-1 py-0 text-[13px] font-bold text-ink outline-none focus:border-line focus:bg-surface" />
                  <textarea value={f.descs[l] ?? ""} onChange={(e) => set({ descs: { ...f.descs, [l]: e.target.value } })} className="min-h-[72px] w-full resize-y rounded-[9px] border border-transparent bg-transparent px-1 py-0 text-[13px] leading-[1.55] text-text outline-none focus:border-line focus:bg-surface" />
                </div>
              ))}
            </div>
          </>
        )}

        {/* FAB (`data-aprev-fab`: shown ≤1499 via globals.css) + overlay preview */}
        <div data-aprev-fab="1" onClick={() => setPrevOpen((v) => !v)} title={t.add.prevL} className="fixed bottom-[96px] right-4 z-[230] hidden h-[52px] w-[52px] cursor-pointer items-center justify-center rounded-full bg-ink text-[22px] text-white shadow-[0_10px_30px_rgba(10,16,28,.35)]"><IconEye size={22} /></div>
        {prevOpen && (
          <div onClick={() => setPrevOpen(false)} className="animate-bg fixed inset-0 z-[340] flex items-center justify-center bg-[rgba(10,16,28,.5)] p-5">
            <div onClick={(e) => e.stopPropagation()}><Preview {...previewProps} big /></div>
          </div>
        )}
        {/* Inline preview (`data-aprev`: fixed beside the form at ≥1500 via globals.css) */}
        <div data-aprev="1" className="mt-5">
          <Label style={{ marginBottom: 8 }}><span className="inline-flex items-center gap-1"><IconEye size={14} /> {t.add.prevL}</span></Label>
          <Preview {...previewProps} />
        </div>

        {published && (
          <div className="animate-bg fixed inset-0 z-[400] flex items-center justify-center bg-[rgba(10,16,28,.55)] p-5">
            <div className="w-[420px] max-w-[94vw] rounded-[18px] bg-surface p-[26px] text-center shadow-[0_30px_80px_rgba(0,0,0,.4)]">
              <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-tint text-[30px] text-green"><IconCircleCheck size={30} /></div>
              <div className="text-[18px] font-extrabold text-ink">{t.add.pubT}</div>
              <div className="mb-[18px] mt-[6px] text-[13px] text-text-2">{t.add.pubS}</div>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => { setPrevScreen("mine"); router.push(`/obj/${published}`); }} className="cursor-pointer rounded-[12px] bg-blue-2 p-3 text-[14px] font-bold text-white hover:brightness-[.92]">{t.add.pubView}</button>
                <button type="button" onClick={() => { toggleSel(published); router.push("/mine"); }} className="cursor-pointer rounded-[12px] border border-[#d8e3ff] bg-blue-tint p-3 text-[13.5px] font-bold text-blue-2 hover:brightness-[.96]">{t.add.pubSel}</button>
                <button type="button" onClick={goMine} className="cursor-pointer rounded-[12px] border border-line bg-surface p-[11px] text-[13.5px] font-semibold text-text hover:brightness-[.96]">{t.add.pubMine}</button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-[22px] flex items-center gap-[10px] border-t border-[#f2f4f8] pt-4">
          <div className="h-2 flex-1 overflow-hidden rounded-[4px] bg-line-2"><div className="h-full rounded-[4px] transition-[width] duration-[250ms]" style={{ width: `${progress}%`, background: done === req.length ? "#22c15e" : "#3b5fd6" }} /></div>
          <span className="flex-none text-[12.5px] font-bold text-text">{done} / {req.length} {t.add.progL}</span>
        </div>
        <div className="mt-[14px] flex flex-wrap gap-[10px]">
          <button type="button" onClick={saveDraft} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[12px] border border-line bg-surface px-[18px] py-3 text-[14px] font-semibold text-text hover:brightness-[.96]"><IconDeviceFloppy size={17} /> {t.add.draftB}</button>
          <button type="button" onClick={publish} disabled={trBusy} className="inline-flex cursor-pointer items-center gap-[7px] rounded-[12px] bg-[#22c15e] px-[22px] py-3 text-[14px] font-bold text-white hover:bg-[#1ba851] disabled:opacity-60"><IconUpload size={17} className={trBusy ? "animate-pulse" : ""} /> {trBusy ? t.add.trBusy : t.add.publish}</button>
          <button type="button" onClick={goMine} className="inline-flex cursor-pointer items-center rounded-[12px] border border-line bg-surface px-[18px] py-3 text-[14px] font-semibold text-text hover:brightness-[.96]">{t.common.cancel}</button>
        </div>
      </Section>

      {geo && (
        <GeoPicker
          mode="add"
          value={{ il: f.il, ilces: f.ilce ? [f.ilce] : [], semts: f.semt ? [f.semt] : [] }}
          onApply={(v) => { set({ il: v.il, ilce: v.ilces[0] ?? "", semt: v.semts[0] ?? "" }); setGeo(false); }}
          onClose={() => setGeo(false)}
        />
      )}
    </div>
  );
}
