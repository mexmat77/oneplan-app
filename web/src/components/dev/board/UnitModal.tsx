"use client";

// Модалка квартиры (§4.9; разметка 1993–2060, данные 3424–3443, 3739–3750, 4096–4107, 4243–4248).
//   <UnitModal objId={id} uid={modalUid} onClose={() => setModalUid(null)} editOn={editGrid} />              — кабинет
//   <UnitModal objId={id} uid={uid} onClose={…} isPublicModal />                                            — публичная страница
// Пропсы:
//   uid           — uid открытой квартиры (null = закрыта)
//   editOn        — `isEditModal`: поля редактирования (номер/тип/площадь/цена/ширина/ряд/особый тип/тип планировки/метки/триплекс/вилла) + «Удалить»
//   isPublicModal — вместо статусов кнопки «Оставить заявку»/«WhatsApp», без «Сохранить» (`canSetStatus = !isPublicModal`)
// Сохранение (`saveUnit` 2999): пишет поля в стор, создаёт автотип планировки, пишет журнал через `addLog` при смене status/price.
import { IconArrowsMaximize, IconBrandWhatsapp, IconChevronDown, IconChevronLeft, IconChevronRight, IconDoorEnter, IconFileTypePdf, IconLoader2, IconPhotoPlus, IconSend, IconStairsDown, IconTrash, IconX } from "@tabler/icons-react";
import { Select } from "@/components/ui/Select";
import { useRef, useState, type CSSProperties } from "react";
import { fLbl, money, numLabel, SPECIAL_TYPES, STORDER, typeLabel } from "@/lib/dev/data";
import { gDelUnit } from "@/lib/dev/grid";
import { autoTypeInfo, buildAutoTypes, ensureAutoType, ptFor, ptRoomsLabel, ptTagOf, unitImages, unitPdf } from "@/lib/dev/planTypes";
import type { Band, Unit, UnitStatus } from "@/lib/dev/types";
import { useEscape, useScrollLock } from "@/hooks/useScrollLock";
import { showToast } from "@/components/ui/toast";
import { isImage, uploadErrorText, uploadFiles } from "@/lib/upload";
import { useDevT } from "@/i18n/dev";
import { addLog, ensurePlanTypes, mutPlanTypes, mutUnits, touch, useDev } from "@/store/dev";
import { Lightbox } from "./Lightbox";
import { perM2, useIsMobile, useObj } from "./shared";

export type UnitModalProps = { objId: number; uid: number | null; onClose: () => void; editOn?: boolean; isPublicModal?: boolean };

const TYPE_OPTS = ["1+0", "1+1", "1.5+1", "2+0", "2+1", "2.5+1", "2+2", "3+0", "3+1", "3.5+1", "3+2", "3+3", "4+0", "4+1", "4.5+1", "4.5+2", "4+2", "4+3", "4+4", "5+1", "5.5+1", "5+2", "5+3", "5+4", "6+1", "6+2", "6.5+1", "6+3", "6+4", "7+1", "7+2", "7+3", "8+1", "8+2", "8+3", "8+4", "9+1", "9+2", "9+3", "9+4", "9+5", "9+6", "10+1", "10+2", "10 Üzeri", ...SPECIAL_TYPES];
const inp = "w-full rounded-[9px] border border-line bg-[#fbfcfe] px-[11px] py-[9px] text-[14px] outline-none";
const lbl = "mb-1 block text-[11px] font-semibold text-text-2";
const chip = (on: boolean, onCol = "#4d7cfe", onBg = "#eef3ff", onTx = "#4d7cfe"): CSSProperties => ({ border: `1.5px solid ${on ? onCol : "#e6e9f0"}`, background: on ? onBg : "#fff", color: on ? onTx : "#6b7688" });
const SEL_CLS = "w-full rounded-[9px] bg-[#fbfcfe] py-[9px] pl-[11px] pr-[10px] text-[14px]";

export function UnitModal(p: UnitModalProps) {
  const s = useDev();
  if (p.uid == null) return null;
  const found = (s.units[p.objId] ?? []).some((u) => u.uid === p.uid);
  // key = uid + «юнит найден»: форма пересобирается, когда юниты Megapolis/Akropolis догрузятся из rows.json
  return <Inner key={`${p.uid}:${found ? 1 : 0}`} {...p} uid={p.uid} />;
}

type Form = { mPt: number; mStatus: UnitStatus; mFeats: string[]; mNum: string; mType: string; mArea: string; mPrice: string; mLa: string; mVt: string; mTag: string; mFt: ("terrace" | "garden")[]; mEntry: number[]; mTd: 0 | 1 | 2; mWidth: 1 | 2 | 3; mBand: Band };

function Inner({ objId, uid, onClose, editOn = false, isPublicModal = false }: UnitModalProps & { uid: number }) {
  const { t } = useDevT();
  const mob = useIsMobile();
  const { obj, units, colors, features, planTypes, cur, genGrid } = useObj(objId);
  const u = units.find((x) => x.uid === uid);
  const [f, setF] = useState<Form>(() => ({
    mPt: u?.ptId || 0, mStatus: u?.status || "free", mFeats: [...(u?.feats || [])], mNum: String(u?.num ?? ""), mType: u?.type || "", mArea: String(u?.area ?? ""), mPrice: String(u?.price ?? ""),
    mLa: u?.la != null ? String(u.la) : "", mVt: u?.vt != null ? String(u.vt) : "", mTag: (u?.tag === "terrace" ? "" : u?.tag) || "", mFt: [...(u?.ft || (u?.tag === "terrace" ? ["terrace" as const] : []))],
    mEntry: [...(u?.entry || [])], mTd: (u?.td || 0) as 0 | 1 | 2, mWidth: (u?.w || 1) as 1 | 2 | 3, mBand: u?.band || "out",
  }));
  // фото/рендеры: грузятся в ТИП планировки квартиры (`PlanType.imgs`) — общие для всех квартир типа, сохраняются сразу
  const photoRef = useRef<HTMLInputElement>(null);
  const [upBusy, setUpBusy] = useState(false);
  const [phDrag, setPhDrag] = useState<number | null>(null);
  const [phOver, setPhOver] = useState<number | null>(null);
  const [fileOver, setFileOver] = useState(false); // над блоком держат файлы с компьютера
  const [galIdx, setGalIdx] = useState(0);
  const [light, setLight] = useState(false);
  useScrollLock(true);
  useEscape(!light, onClose);
  if (!u || !obj) return null;
  const set = (patch: Partial<Form>) => setF((s) => ({ ...s, ...patch }));
  const isVilla = !!(u.vl || obj.villas);
  const canSetStatus = !isPublicModal;
  // Публичная карточка помещения «Не продаётся» — без «Оставить заявку»/WhatsApp.
  const pubActions = isPublicModal && u.status !== "na";
  const lvT = editOn && f.mType ? f.mType : u.type;
  const lvA = editOn && f.mArea !== "" && +f.mArea ? +f.mArea : u.area;
  const lvLa = editOn && f.mLa !== "" ? +f.mLa : u.la;
  const lvVt = editOn && f.mVt !== "" ? f.mVt : u.vt;
  const lvP = editOn && f.mPrice !== "" && +f.mPrice ? +f.mPrice : u.price;
  const num = editOn && f.mNum ? f.mNum : u.num;
  const sub = isVilla
    ? `${t.villa_word}${lvVt ? ` · ${t.vt_short} ${lvVt}` : ""} · ${lvT} · ${t.villa_house} ${lvA} м²${lvLa ? ` · ${t.villa_land} ${lvLa} м²` : ""}`
    : `${obj.name} · ${t.word_floor} ${fLbl(u.floor, obj.fScheme || "tr")} · ${typeLabel(lvT, t)}`;
  const curPt = ptFor(planTypes, u);
  const list = unitImages(obj, u, curPt, u.photos, planTypes);
  const ptPhotos = curPt?.imgs ?? [];
  const ptUnits = curPt ? units.filter((x) => ptFor(planTypes, x)?.id === curPt.id).length : 0;
  /** тип квартиры в сторе (создаёт автотип, если списка типов ещё нет) */
  const typeId = (): number | null => {
    if (!u.type || u.type === "1*") return null;
    ensurePlanTypes(objId, buildAutoTypes);
    let id: number | null = null;
    mutPlanTypes(objId, (l) => { const ex = ptFor(l, u); if (ex) { id = ex.id; return l; } const r = ensureAutoType(l, u.type, u.area, u.wing, ptTagOf(u)); id = r.type.id; return r.list; });
    return id;
  };
  const setPtPhotos = (fn: (a: string[]) => string[]) => { const id = typeId(); if (id == null) return; mutPlanTypes(objId, (l) => l.map((x) => (x.id === id ? { ...x, imgs: fn(x.imgs) } : x))); touch(); };
  const addPhotos = async (files: FileList | File[] | null) => {
    const fs = Array.from(files || []).filter(isImage);
    if (photoRef.current) photoRef.current.value = "";
    if (!fs.length) return;
    if (typeId() == null) { showToast(t.unit_photos_need_type); return; }
    setUpBusy(true);
    try {
      const res = await uploadFiles(fs, `dev/${objId}/plans`);
      if (res.done.length) setPtPhotos((a) => [...a, ...res.done.map((d) => d.url)]);
      if (res.failed.length) showToast(`${t.up_err}${uploadErrorText(res) ? ": " + uploadErrorText(res) : ""}`, 4000);
    } finally { setUpBusy(false); }
  };
  const movePhoto = (from: number, to: number) => { if (from === to) return; setPtPhotos((a0) => { const a = [...a0]; const [x] = a.splice(from, 1); a.splice(to, 0, x); return a; }); };
  const idx = Math.min(galIdx, list.length - 1);
  const main = list[idx];
  const pdf = unitPdf(obj, u);
  const ra = +(lvA || 0);
  // Спецтег (дуплекс/терс-дуплекс/триплекс) — своя группа типов: чипы показывают только типы с тем же тегом.
  const lvTag = ptTagOf({ tag: editOn ? f.mTag : u.tag });
  const ptChips = !lvT || lvT === "1*" ? [] : (() => {
    const same = planTypes.filter((x) => x.rooms === lvT && (x.tag || "") === (lvTag || "") && (+x.area === ra || +x.area === 0));
    const ai = autoTypeInfo(planTypes, lvT, ra, u.wing, lvTag);
    return [{ id: 0, name: `${t.pt_auto} → ${ai.name}${ai.isNew ? ` (${t.pt_new})` : ""}` }, ...same];
  })();
  const ptGroupLabel = ptRoomsLabel({ rooms: lvT, tag: lvTag }, t);

  const save = () => {
    const nu: Unit = {
      ...u, ptId: f.mPt || undefined, status: f.mStatus, feats: [...f.mFeats], num: f.mNum || u.num, numManual: u.numManual || (!!f.mNum && String(f.mNum) !== String(u.num)) || undefined, type: f.mType || u.type, area: +f.mArea || u.area, price: +f.mPrice || u.price,
      la: f.mLa !== "" ? +f.mLa : u.la, vt: u.vl ? (f.mVt !== "" ? (isNaN(+f.mVt) ? f.mVt : +f.mVt) : undefined) : u.vt,
      tag: (f.mTag || null) as Unit["tag"], ft: f.mFt.length ? [...f.mFt] : undefined,
      entry: f.mTag === "triplex" ? (f.mEntry.length ? [...f.mEntry].sort() : [1]) : undefined, td: f.mTag === "triplex" ? f.mTd : undefined,
      w: f.mWidth > 1 ? f.mWidth : undefined, band: f.mBand ?? u.band,
    };
    if (u.status !== nu.status) addLog(objId, { ts: Date.now(), uid: u.uid, num: nu.num, f: "status", from: u.status, to: nu.status });
    if (+u.price !== +nu.price) addLog(objId, { ts: Date.now(), uid: u.uid, num: nu.num, f: "price", from: u.price, to: nu.price });
    mutUnits(objId, (us) => us.map((x) => (x.uid === uid ? nu : x)));
    if (!f.mPt && nu.type && nu.type !== "1*") { ensurePlanTypes(objId, buildAutoTypes); mutPlanTypes(objId, (l) => ensureAutoType(l, nu.type, nu.area, nu.wing, ptTagOf(nu)).list); }
    onClose();
  };
  const del = () => { mutUnits(objId, (us) => gDelUnit(us, uid, genGrid)); onClose(); };
  const thumbs = list.length > 1;
  const closeBtn = <button type="button" onClick={onClose} className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-[#f0f2f6] text-[17px] text-[#5c6675] hover:bg-[#e4e8ef]"><IconX size={17} /></button>;
  const navBtn = (side: "left" | "right", onClick: () => void) => (
    <button type="button" onClick={(e) => { e.stopPropagation(); onClick(); }} className="absolute top-1/2 flex h-10 w-10 -translate-y-1/2 cursor-pointer items-center justify-center rounded-full border-none text-[18px] text-ink shadow-[0_4px_16px_rgba(0,0,0,.35)] hover:bg-white" style={{ [side]: 12, background: "rgba(255,255,255,.94)" }}>{side === "left" ? <IconChevronLeft size={18} /> : <IconChevronRight size={18} />}</button>
  );
  const segChip = (label: string, on: boolean, onClick: () => void, extra?: CSSProperties, icon?: React.ReactNode) => (
    <span key={label} onClick={onClick} className="inline-flex cursor-pointer items-center gap-[5px] whitespace-nowrap rounded-[18px] px-[11px] py-[6px] text-[12px] font-semibold" style={{ ...chip(on), ...extra }}>{icon}{label}</span>
  );

  return (
    <>
      <div onClick={onClose} className={`fixed inset-0 z-[90] flex justify-center ${mob ? "items-end p-0" : "items-center p-6"}`} style={{ background: "rgba(8,14,26,.62)", backdropFilter: "blur(5px)", animation: "opl-bg .2s ease" }}>
        <div onClick={(e) => e.stopPropagation()} className={`flex overflow-hidden bg-surface ${mob ? "w-full flex-col rounded-t-[22px]" : "flex-row rounded-[22px]"}`} style={{ boxShadow: "0 30px 90px rgba(0,0,0,.45)", animation: "opl-card .25s ease", ...(mob ? { height: "calc(100% - 30px)" } : { width: "min(1060px,96vw)", height: "min(690px,92vh)" }) }}>
          {/* медиа */}
          <div className="relative flex min-w-0 flex-col bg-[#0d1524]" style={mob ? { height: "37%", flex: "none" } : { flex: 1.25 }}>
            <div onClick={() => setLight(true)} className="relative flex min-h-0 flex-1 cursor-zoom-in items-center justify-center p-4">
              <div className="h-full w-full" style={{ backgroundImage: `url('${main}')`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }} />
              <span className="pointer-events-none absolute right-[14px] top-[14px] flex h-9 w-9 items-center justify-center rounded-[11px] text-[16px] text-white" style={{ background: "rgba(255,255,255,.16)" }}><IconArrowsMaximize size={16} /></span>
              {thumbs && (
                <>
                  <span className="absolute left-[14px] top-[14px] rounded-[20px] px-3 py-1 text-[12px] font-bold text-white" style={{ background: "rgba(0,0,0,.5)" }}>{idx + 1} / {list.length}</span>
                  {navBtn("left", () => setGalIdx((idx - 1 + list.length) % list.length))}
                  {navBtn("right", () => setGalIdx((idx + 1) % list.length))}
                </>
              )}
            </div>
            {thumbs && (
              <div className="flex flex-none gap-2 overflow-x-auto px-[14px] py-[10px]" style={{ background: "rgba(255,255,255,.05)" }}>
                {list.map((src, i) => <div key={i} onClick={(e) => { e.stopPropagation(); setGalIdx(i); }} className="h-[58px] w-[58px] flex-none cursor-pointer rounded-[9px]" style={{ backgroundImage: `url('${src}')`, backgroundSize: "cover", backgroundPosition: "center", border: `2.5px solid ${i === idx ? "#4d7cfe" : "transparent"}`, opacity: i === idx ? 1 : 0.72 }} />)}
              </div>
            )}
          </div>
          {/* инфо */}
          <div className="flex min-w-0 flex-col bg-surface" style={mob ? { flex: 1, minHeight: 0 } : { width: 430, flex: "none" }}>
            <div className="flex flex-none items-start gap-3 border-b border-[#eef0f4] px-[22px] pb-[13px] pt-[18px]">
              <div className="min-w-0 flex-1"><div className="text-[23px] font-extrabold tracking-[-.02em] text-ink">{numLabel(num, " ")}</div><div className="mt-[3px] text-[13px] text-text-2">{sub}</div></div>
              {closeBtn}
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-[22px] py-4">
              <div className="mb-3 flex flex-wrap items-baseline gap-[10px]"><span className="text-[28px] font-extrabold tracking-[-.02em] text-ink">{lvP ? money(lvP, cur) : "—"}</span><span className="text-[13px] text-muted">{lvP ? perM2(lvP, lvA, cur) : "—"}</span></div>
              <div className="mb-[6px] grid grid-cols-2 gap-2">
                <div className="rounded-[11px] bg-[#f7f8fb] px-[13px] py-[10px]"><div className="mb-[2px] text-[11px] text-muted">{isVilla ? t.f_rooms : t.m_type}</div><div className="text-[15px] font-bold text-ink">{typeLabel(lvT, t)}</div></div>
                <div className="rounded-[11px] bg-[#f7f8fb] px-[13px] py-[10px]"><div className="mb-[2px] text-[11px] text-muted">{t.m_area}</div><div className="text-[15px] font-bold text-ink">{lvA} м²</div></div>
              </div>
              {pdf && <a href={pdf.url} target="_blank" rel="noreferrer" className="flex items-center gap-2 py-[9px] text-[14px] font-semibold text-blue"><IconFileTypePdf size={18} /> {t.m_layout} — {pdf.villa ? `${t.villa_word} ${pdf.title}` : pdf.title}</a>}
              {editOn && (
                <div className="mt-[14px] grid grid-cols-2 gap-[10px]">
                  <div><label className={lbl}>{t.ed.num}</label><input value={f.mNum} onChange={(e) => set({ mNum: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>{isVilla ? t.f_rooms : t.ed.type}</label><Select value={f.mType} onChange={(v) => set({ mType: v })} className={SEL_CLS} options={[{ value: "", label: "—" }, ...TYPE_OPTS.map((v) => ({ value: v, label: typeLabel(v, t) }))]} /></div>
                  <div><label className={lbl}>{t.ed.area}</label><input type="number" value={f.mArea} onChange={(e) => set({ mArea: e.target.value })} className={inp} /></div>
                  <div><label className={lbl}>{t.ed.price}</label><input type="number" value={f.mPrice} onChange={(e) => set({ mPrice: e.target.value })} className={inp} /></div>
                  {!obj.villas && (
                    <div className="col-span-full"><label className={lbl}>{t.board.width_cap}</label>
                      <div className="flex gap-[6px]">{([1, 2, 3] as const).map((v) => <span key={v} onClick={() => set({ mWidth: v })} className="flex-1 cursor-pointer rounded-[9px] py-[9px] text-center text-[14px] font-bold" style={chip(f.mWidth === v)}>{v}</span>)}</div>
                      <div className="mt-[5px] text-[11px] text-muted">{t.board.width_hint}</div>
                    </div>
                  )}
                  {u.lx == null && !isVilla && (
                    <div className="col-span-full"><label className={lbl}>{t.board.band_cap}</label>
                      <div className="flex gap-[6px]">{(["out", "ins"] as Band[]).map((b) => <span key={b} onClick={() => set({ mBand: b })} className="flex-1 cursor-pointer rounded-[9px] py-[9px] text-center text-[13px] font-bold" style={chip(f.mBand === b)}>{b === "out" ? t.board.band_out : t.board.band_ins}</span>)}</div>
                      <div className="mt-[5px] text-[11px] text-muted">{t.board.band_hint}</div>
                    </div>
                  )}
                  <div className="col-span-full">
                    <label className={lbl}>{t.ed.tag}</label>
                    <Select value={f.mTag} onChange={(v) => set({ mTag: v })} className={SEL_CLS} options={[{ value: "", label: t.ed.tag_none }, { value: "duplex", label: t.badge_duplex }, { value: "tduplex", label: t.badge_tduplex }, { value: "triplex", label: t.badge_triplex }, { value: "kapici", label: t.badge_kapici }]} />
                    {ptChips.length > 0 && (
                      <div className="mt-[10px]"><label className="mb-[5px] block text-[11px] font-semibold text-text-2">{t.pt_select} · {ptGroupLabel}</label>
                        <div className="flex flex-wrap gap-[6px]">{ptChips.map((pc) => <span key={pc.id} onClick={() => set({ mPt: pc.id })} className="cursor-pointer whitespace-nowrap rounded-[9px] px-3 py-[7px] text-[12px] font-bold" style={chip((f.mPt || 0) === pc.id, "#4d7cfe", "#eef3ff", "#2f5fe0")}>{pc.name}</span>)}</div>
                        <div className="mt-[5px] text-[11px] text-muted">{t.pt_pick_hint}</div>
                      </div>
                    )}
                  </div>
                  <div className="col-span-full"><label className={lbl}>{t.ftags}</label>
                    <div className="flex flex-wrap gap-[6px]">
                      {(["terrace", "garden"] as const).map((kk) => segChip(kk === "terrace" ? t.badge_terrace : t.badge_garden, f.mFt.includes(kk), () => set({ mFt: f.mFt.includes(kk) ? f.mFt.filter((x) => x !== kk) : [...f.mFt, kk] }), f.mFt.includes(kk) ? (kk === "terrace" ? { borderColor: "#0284c7", background: "#e0f2fe", color: "#0284c7" } : { borderColor: "#15803d", background: "#dcfce7", color: "#15803d" }) : undefined))}
                    </div>
                  </div>
                  {f.mTag === "triplex" && (
                    <>
                      <div className="col-span-full"><label className={lbl}>{t.ed.entry}</label>
                        <div className="flex flex-wrap gap-[6px]">{[2, 1, 0].map((lv) => segChip([t.ed.lvl_bottom, t.ed.lvl_mid, t.ed.lvl_top][lv], f.mEntry.includes(lv), () => set({ mEntry: f.mEntry.includes(lv) ? f.mEntry.filter((x) => x !== lv) : [...f.mEntry, lv] }), f.mEntry.includes(lv) ? { borderColor: "#0f766e", background: "#e6fffa", color: "#0f766e" } : undefined, <IconDoorEnter size={13} />))}</div>
                      </div>
                      <div className="col-span-full"><label className={lbl}>{t.ed.tri_lvl}</label>
                        <div className="flex flex-wrap gap-[6px]">{([0, 1, 2] as const).map((v) => segChip(t.ed[`td${v}` as "td0"], f.mTd === v, () => set({ mTd: v }), f.mTd === v ? { borderColor: "#0f766e", background: "#e6fffa", color: "#0f766e" } : undefined, <IconStairsDown size={13} />))}</div>
                      </div>
                    </>
                  )}
                  <div
                    onDragOver={(e) => { if (phDrag != null || !Array.from(e.dataTransfer.types).includes("Files")) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (!fileOver) setFileOver(true); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setFileOver(false); }}
                    onDrop={(e) => { if (phDrag != null || !e.dataTransfer.files.length) return; e.preventDefault(); setFileOver(false); void addPhotos(Array.from(e.dataTransfer.files)); }}
                    className={`relative col-span-full rounded-[11px] ${fileOver ? "outline-dashed outline-2 outline-offset-[6px] outline-blue" : ""}`}>
                    {fileOver && <div className="pointer-events-none absolute -inset-[6px] z-[2] flex items-center justify-center gap-2 rounded-[11px] bg-[rgba(238,243,255,.92)] text-[13px] font-bold text-[#2f5fe0]"><IconPhotoPlus size={18} /> {t.unit_photo_drop}</div>}
                    <label className={lbl}>{t.unit_photos}{curPt ? ` · ${curPt.name}` : ""}{ptUnits > 1 ? ` · ${t.unit_photos_shared.replace("{n}", String(ptUnits))}` : ""}</label>
                    <input ref={photoRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => addPhotos(e.target.files)} />
                    <div className="flex flex-wrap gap-[8px]">
                      {ptPhotos.map((src, i) => (
                        <div
                          key={src} draggable
                          onDragStart={(e) => { setPhDrag(i); e.dataTransfer.effectAllowed = "move"; }}
                          onDragOver={(e) => { if (phDrag == null) return; e.preventDefault(); if (phOver !== i) setPhOver(i); }}
                          onDrop={(e) => { e.preventDefault(); if (phDrag != null) movePhoto(phDrag, i); setPhDrag(null); setPhOver(null); }}
                          onDragEnd={() => { setPhDrag(null); setPhOver(null); }}
                          className={`group relative h-[64px] w-[64px] flex-none cursor-grab overflow-hidden rounded-[10px] border bg-[#f0f2f6] active:cursor-grabbing ${phDrag === i ? "opacity-50" : ""} ${phOver === i && phDrag != null && phDrag !== i ? "border-blue shadow-[0_0_0_2px_#4d7cfe]" : "border-line"}`}
                          style={{ backgroundImage: `url('${src}')`, backgroundSize: "cover", backgroundPosition: "center" }}
                        >
                          <button type="button" title={t.unit_photo_del} onClick={() => setPtPhotos((a) => a.filter((_, j) => j !== i))} className="absolute right-[3px] top-[3px] flex h-[20px] w-[20px] cursor-pointer items-center justify-center rounded-full border-none bg-[rgba(13,21,36,.72)] text-white hover:bg-red"><IconX size={12} /></button>
                        </div>
                      ))}
                      <button type="button" disabled={upBusy} onClick={() => photoRef.current?.click()} className="flex h-[64px] min-w-[64px] flex-none cursor-pointer flex-col items-center justify-center gap-[3px] rounded-[10px] border border-dashed border-[#b9c6e6] bg-blue-tint px-[10px] text-[11px] font-semibold text-[#3a63d4] hover:border-blue disabled:cursor-default disabled:opacity-60">
                        {upBusy ? <IconLoader2 size={18} className="animate-spin" /> : <IconPhotoPlus size={18} />}{upBusy ? t.unit_photo_busy : t.unit_photo_add}
                      </button>
                    </div>
                    <div className="mt-[5px] text-[11px] text-muted">{t.unit_photos_hint}</div>
                  </div>
                  {isVilla && (
                    <>
                      <div><label className={lbl}>{t.villa_land}, м²</label><input type="number" value={f.mLa} onChange={(e) => set({ mLa: e.target.value })} className={inp} /></div>
                      <div><label className={lbl}>{t.vt_word}</label><input value={f.mVt} onChange={(e) => set({ mVt: e.target.value })} placeholder="1" className={inp} /></div>
                    </>
                  )}
                </div>
              )}
              {canSetStatus && (
                <>
                  <label className="mb-2 mt-[14px] block text-[12px] font-semibold text-text-2">{t.m_status}</label>
                  <div className="grid grid-cols-2 gap-[7px]">
                    {STORDER.map((k) => (
                      <button key={k} type="button" onClick={() => set({ mStatus: k })} className="flex cursor-pointer items-center justify-start gap-[6px] rounded-[9px] bg-surface p-[9px] text-[13px] font-semibold" style={{ border: k === f.mStatus ? `2px solid ${colors[k]}` : "1px solid #e6e9f0", color: k === f.mStatus ? "#14243f" : "#6b7688" }}>
                        <span className="h-[10px] w-[10px] flex-none rounded-[3px]" style={{ background: colors[k] }} />{t.status[k]}
                      </button>
                    ))}
                  </div>
                </>
              )}
              {pubActions && (
                <div className="mt-4 flex flex-col gap-2">
                  <button type="button" className="flex w-full cursor-pointer items-center justify-center gap-[7px] rounded-[11px] border-none bg-blue p-3 text-[14px] font-bold text-white hover:bg-blue-2"><IconSend size={16} /> {t.pub.request}</button>
                  <button type="button" className="flex w-full cursor-pointer items-center justify-center gap-[7px] rounded-[11px] border-none bg-[#22c15e] p-3 text-[14px] font-bold text-white hover:bg-[#1ba852]"><IconBrandWhatsapp size={16} /> {t.pub.wa}</button>
                </div>
              )}
              <label className="mb-2 mt-4 block text-[12px] font-semibold text-text-2">{t.m_feats}</label>
              <div className="flex flex-wrap gap-[6px]">
                {features.map((ft) => <span key={ft} onClick={() => set({ mFeats: f.mFeats.includes(ft) ? f.mFeats.filter((x) => x !== ft) : [...f.mFeats, ft] })} className="cursor-pointer rounded-[18px] px-[11px] py-[6px] text-[12px] font-semibold" style={{ border: `1px solid ${f.mFeats.includes(ft) ? "#4d7cfe" : "#e6e9f0"}`, background: f.mFeats.includes(ft) ? "#eef3ff" : "#fff", color: f.mFeats.includes(ft) ? "#4d7cfe" : "#6b7688" }}>{ft}</span>)}
              </div>
            </div>
            <div className="flex flex-none items-center gap-[10px] border-t border-[#eef0f4] px-5 py-[13px]">
              {editOn && <button type="button" onClick={del} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] border border-red bg-surface px-[14px] py-[10px] text-[13px] font-semibold text-red hover:bg-[#fdecef]"><IconTrash size={15} /> {t.ed.del_unit}</button>}
              <div className="flex-1" />
              <button type="button" onClick={onClose} className="cursor-pointer rounded-[10px] border border-line bg-surface px-4 py-[10px] text-[14px] font-semibold text-ink-2">{t.m_cancel}</button>
              {canSetStatus && <button type="button" onClick={save} className="cursor-pointer rounded-[11px] border border-blue bg-blue px-5 py-[11px] text-[14px] font-bold text-white hover:bg-blue-2">{t.m_save}</button>}
            </div>
          </div>
        </div>
      </div>
      {light && <Lightbox list={list} idx={idx} onClose={() => setLight(false)} />}
    </>
  );
}
