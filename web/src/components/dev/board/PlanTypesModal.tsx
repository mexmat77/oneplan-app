"use client";

// Модалка «Планировки по типам» (§5.5; разметка 1711–1762, данные 4019–4048). Открывается из «Настроек» и из карточки объекта.
//   <PlanTypesModal objId={id} open={plOpen} onClose={() => setPlOpen(false)} />
// Список типов из стора (`planTypes[objId]`, автосписок при первом открытии): чипы комнатности, группы, превью 96×72,
// select комнатности / имя / площадь / счётчик квартир / «Загрузить» (input file → Storage `dev/<id>/plans`, спиннер на превью) / удалить;
// миниатюры 52px с drag-сортировкой, клик = главная, крестик; «Добавить тип» (ручной, подсветка 1.9 с) и «Готово». Изменения → `touch()`.
// Картинки «с плана» (`pt.autoImgs`, вырезки квартир с поэтажного плана) показываются после ручных с бейджем и без крестика —
// они удаляются вместе с контуром квартиры; ручные `imgs` — как раньше (загрузка, порядок, удаление, главная).
// Группы чипов/заголовков — комнатность + спецтег («2+1», «2+1 · Дуплекс»: `ptGroupsOf`/`ptRoomsLabel`); зеркальные типы
// (`mirrorOf`) помечены бейджем «зеркальный», кнопка «Найти зеркальные» → `runMirrorSplit` по контурам планов.
import { IconArrowsLeftRight, IconChevronDown, IconCloud, IconCloudCheck, IconInfoCircle, IconLoader2, IconPhotoPlus, IconPlus, IconTrash, IconVector, IconX } from "@tabler/icons-react";
import { Select } from "@/components/ui/Select";
import { useEffect, useRef, useState } from "react";
import { isSpecialType, numLabel, typeLabel } from "@/lib/dev/data";
import { runMirrorSplit } from "@/lib/dev/planCrop";
import { addManualType, allImgs, buildAutoTypes, parseGroupKey, ptCounts, ptGroupKey, ptGroupsOf, ptRoomsLabel, ptTagRank, roomsOf, syncAutoTypes, ptFor } from "@/lib/dev/planTypes";
import type { PlanType, Unit } from "@/lib/dev/types";
import { useEscape, useScrollLock } from "@/hooks/useScrollLock";
import { useDevT } from "@/i18n/dev";
import { uploadFiles } from "@/lib/upload";
import { showToast } from "@/components/ui/toast";
import { ensurePlanTypes, mutPlanTypes, touch, useDev } from "@/store/dev";
import { useIsMobile, useObj } from "./shared";

export function PlanTypesModal({ objId, open, onClose }: { objId: number; open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <Inner objId={objId} onClose={onClose} />;
}

function Inner({ objId, onClose }: { objId: number; onClose: () => void }) {
  const { t } = useDevT();
  const mob = useIsMobile();
  const { units, planTypes } = useObj(objId);
  const { save } = useDev();
  const [room, setRoom] = useState("");
  const [flash, setFlash] = useState<number | null>(null);
  const [busy, setBusy] = useState<Record<number, number>>({});
  const [dropId, setDropId] = useState<number | null>(null); // тип, над которым держат перетаскиваемые файлы
  const [moreId, setMoreId] = useState<number | null>(null); // тип с развёрнутым списком квартир
  const body = useRef<HTMLDivElement>(null);
  const flashT = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const thDrag = useRef<{ id: number; i: number } | null>(null);
  useScrollLock(true);
  useEscape(true, onClose);
  // Список создаётся один раз, поэтому новые типы (спец-помещения по блокам, новые площади) дописываются при открытии.
  // Затем — левые/правые: квартиры, обведённые после разделения типа на -L/-R, распределяются по контуру (идемпотентно).
  useEffect(() => { ensurePlanTypes(objId, buildAutoTypes); mutPlanTypes(objId, (l) => syncAutoTypes(l, units)); runMirrorSplit(objId); }, [objId, units]);
  const rooms = roomsOf(units);
  const groups = ptGroupsOf(units, planTypes);
  const cnt = ptCounts(planTypes, units);
  let list = planTypes.filter((pt) => (cnt[pt.id] || 0) > 0 || pt.manual);
  if (room) list = list.filter((x) => ptGroupKey(x) === room);
  list = list.slice().sort((a, b) => (a.rooms < b.rooms ? -1 : a.rooms > b.rooms ? 1 : 0) || ptTagRank(a.tag) - ptTagRank(b.tag));
  const mut = (fn: (l: PlanType[]) => PlanType[]) => { ensurePlanTypes(objId, buildAutoTypes); mutPlanTypes(objId, fn); touch(); };
  const patch = (id: number, p: Partial<PlanType>) => mut((l) => l.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const scrollToRow = (id: number) => {
    setTimeout(() => { const el = document.querySelector(`[data-ptrow="${id}"]`); const b = body.current; if (!el || !b) return; b.scrollTop = Math.max(0, b.scrollTop + (el.getBoundingClientRect().top - b.getBoundingClientRect().top) - 10); }, 80);
    setFlash(id); clearTimeout(flashT.current); flashT.current = setTimeout(() => setFlash(null), 1900);
  };
  // Загрузка картинок в тип: из диалога выбора файлов или перетаскиванием файлов на карточку типа.
  const uploadTo = async (pt: PlanType, files: File[]) => {
    const fs = files.filter((x) => x.type.startsWith("image/"));
    if (!fs.length) { if (files.length) showToast(t.pt_drop_only_img); return; }
    setBusy((b) => ({ ...b, [pt.id]: (b[pt.id] || 0) + fs.length }));
    const res = await uploadFiles(fs, `dev/${objId}/plans`);
    const add = res.done.map((r) => r.url);
    // Append to the current list of this type (the user may have reordered / removed images while uploading).
    if (add.length) mut((l) => l.map((x) => (x.id === pt.id ? { ...x, imgs: [...x.imgs, ...add] } : x)));
    setBusy((b) => { const n = (b[pt.id] || 0) - fs.length; const nb = { ...b }; if (n > 0) nb[pt.id] = n; else delete nb[pt.id]; return nb; });
    if (res.failed.length) showToast(`${t.dx.upload_failed}${res.failed.length}`);
  };
  const pick = (pt: PlanType) => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = "image/*"; inp.multiple = true;
    inp.onchange = () => { void uploadTo(pt, [...(inp.files || [])]); };
    inp.click();
  };
  const hasFiles = (e: React.DragEvent) => Array.from(e.dataTransfer?.types || []).includes("Files");
  // Квартиры каждого типа (для подписи «какие это квартиры»): по блоку и номеру.
  const unitsOf: Record<number, Unit[]> = {};
  units.forEach((u) => { const p = ptFor(planTypes, u); if (p) (unitsOf[p.id] ||= []).push(u); });
  Object.values(unitsOf).forEach((a) => a.sort((x, y) => (x.wing || "").localeCompare(y.wing || "") || String(x.num).localeCompare(String(y.num), undefined, { numeric: true })));
  const ptAdd = () => {
    const g = room ? parseGroupKey(room) : groups[0] || { rooms: "2+1" };
    let nid = 0;
    mut((l) => { const r = addManualType(l, g.rooms, g.tag); nid = r.id; return r.list; });
    scrollToRow(nid);
  };
  const findMirror = () => {
    ensurePlanTypes(objId, buildAutoTypes);
    const r = runMirrorSplit(objId);
    showToast(r.total ? t.pt_mirror_found.replace("{n}", String(r.total)) : t.pt_mirror_none, 3600);
  };
  const chipCls = (on: boolean) => `cursor-pointer whitespace-nowrap rounded-[9px] border-[1.5px] px-[13px] py-[6px] text-[12.5px] font-bold ${on ? "border-blue bg-blue-tint text-[#2f5fe0]" : "border-line bg-surface text-text-2"}`;
  // `epSave` (3698): Автосохранение / Сохранение… / Сохранено · HH:MM
  const saveChip = save === "saving" ? { icon: <IconLoader2 size={14} className="animate-[opl-spin_1s_linear_infinite]" />, label: t.edp.saving, cls: "bg-[#f0f2f6] text-muted" } : save ? { icon: <IconCloudCheck size={14} />, label: `${t.edp.saved} · ${save}`, cls: "bg-green-tint text-green" } : { icon: <IconCloud size={14} />, label: t.edp.autosave, cls: "bg-[#f0f2f6] text-muted" };
  return (
    <div onClick={onClose} className={`fixed inset-0 z-[90] flex justify-center ${mob ? "items-end p-0" : "items-center p-[14px]"}`} style={{ background: "rgba(15,23,42,.55)", animation: "opl-bg .15s ease" }}>
      <div onClick={(e) => e.stopPropagation()} className={`flex flex-col overflow-hidden bg-surface ${mob ? "w-full max-w-full rounded-t-[18px]" : "w-[640px] max-w-[96vw] rounded-[18px]"}`} style={{ maxHeight: mob ? "92vh" : "88vh", animation: "opl-card .2s ease" }}>
        <div className="flex flex-none items-center gap-[10px] border-b border-[#eef0f4] bg-surface px-[22px] pb-[13px] pt-4">
          <h3 className="min-w-0 flex-1 truncate text-[19px] font-extrabold text-ink">{t.pl_title}</h3>
          <span className={`inline-flex items-center gap-[6px] whitespace-nowrap rounded-[20px] px-3 py-[7px] text-[12px] font-semibold ${saveChip.cls}`}>{saveChip.icon} {saveChip.label}</span>
          <span onClick={onClose} className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[10px] bg-[#f0f2f6] text-text-2"><IconX size={16} /></span>
        </div>
        <div ref={body} data-plbody="1" className="min-h-0 flex-1 overflow-y-auto px-[22px] py-4">
          <p className="mb-[6px] text-[13px] leading-[1.5] text-text-2">{t.pl_sub}</p>
          <p className="mb-1 text-[12px] leading-[1.5] text-muted"><IconInfoCircle size={13} className="mr-1 inline align-[-2px]" />{t.pl_multi_hint}</p>
          <p className="mb-1 text-[12px] leading-[1.5] text-muted"><IconArrowsLeftRight size={13} className="mr-1 inline align-[-2px]" />{t.pt_mirror_hint}</p>
          <p className="mb-4 text-[12px] leading-[1.5] text-muted"><IconVector size={13} className="mr-1 inline align-[-2px]" />{t.fp.auto_imgs_hint}</p>
          <div className="mb-[14px] flex flex-wrap gap-[6px]">
            <span onClick={() => { setRoom(""); setTimeout(() => { if (body.current) body.current.scrollTop = 0; }, 60); }} className={chipCls(room === "")}>{t.opt_all}</span>
            {groups.map((g) => { const k = ptGroupKey(g); return <span key={k} onClick={() => { setRoom(k); setTimeout(() => { if (body.current) body.current.scrollTop = 0; }, 60); }} className={chipCls(room === k)}>{ptRoomsLabel(g, t)}</span>; })}
          </div>
          <div className="mb-[18px] flex flex-col gap-[10px]">
            {list.map((pt, i) => {
              const gl = !room && (i === 0 || ptGroupKey(list[i - 1]) !== ptGroupKey(pt)) ? ptRoomsLabel(pt, t) : "";
              const arr = allImgs(pt); const nAuto = arr.length - pt.imgs.length; const on = flash === pt.id;
              return (
                <div key={pt.id} data-ptrow={pt.id}>
                  {gl && <div className="mb-[2px] mt-2 flex items-center gap-2 text-[13px] font-extrabold text-ink"><span className="rounded-[8px] bg-blue-tint px-[10px] py-[3px] text-[#2f5fe0]">{gl}</span><span className="h-px flex-1 bg-[#edf0f5]" /></div>}
                  <div
                    onDragOver={(e) => { if (!hasFiles(e)) return; e.preventDefault(); e.dataTransfer.dropEffect = "copy"; if (dropId !== pt.id) setDropId(pt.id); }}
                    onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setDropId((c) => (c === pt.id ? null : c)); }}
                    onDrop={(e) => { if (!hasFiles(e)) return; e.preventDefault(); setDropId(null); void uploadTo(pt, Array.from(e.dataTransfer.files)); }}
                    className="relative flex items-start gap-3 rounded-[13px] px-3 py-[10px]" style={{ border: `1px ${dropId === pt.id ? "dashed" : "solid"} ${on || dropId === pt.id ? "#4d7cfe" : "#e6e9f0"}`, background: on || dropId === pt.id ? "#eef3ff" : "#fbfcfe", transition: "background .6s,border-color .6s", boxShadow: on || dropId === pt.id ? "0 0 0 3px rgba(77,124,254,.18)" : undefined }}>
                    {dropId === pt.id && <div className="pointer-events-none absolute inset-0 z-[2] flex items-center justify-center gap-2 rounded-[13px] bg-[rgba(238,243,255,.92)] text-[13px] font-bold text-[#2f5fe0]"><IconPhotoPlus size={18} /> {t.pt_drop_here.replace("{name}", pt.name)}</div>}
                    <div onClick={() => pick(pt)} className="relative flex h-[72px] w-[96px] flex-none cursor-pointer items-center justify-center overflow-hidden rounded-[9px] bg-[#eef1f5]">
                      {arr.length ? (
                        <>
                          <div className="h-full w-full bg-white" style={{ backgroundImage: `url('${arr[0]}')`, backgroundSize: "contain", backgroundRepeat: "no-repeat", backgroundPosition: "center" }} />
                          {arr.length > 1 && <span className="absolute bottom-1 right-1 rounded-[9px] px-[7px] py-px text-[10.5px] font-extrabold text-white" style={{ background: "rgba(20,36,63,.85)" }}>+{arr.length - 1}</span>}
                        </>
                      ) : <span className="inline-flex flex-col items-center gap-[3px] text-[11px] text-muted-2"><IconPhotoPlus size={17} /></span>}
                      {busy[pt.id] > 0 && <div className="absolute inset-0 flex items-center justify-center bg-[rgba(255,255,255,.62)] text-blue"><IconLoader2 size={20} className="animate-spin" /></div>}
                    </div>
                    <div className="flex min-w-0 flex-1 flex-col gap-2">
                      <div className="flex flex-wrap items-center gap-[6px]">
                        <div className="relative flex-none">
                          <Select value={pt.rooms} size="sm" menuWidth="auto" onChange={(nr) => { patch(pt.id, { rooms: nr }); if (room) setRoom(ptGroupKey({ rooms: nr, tag: pt.tag })); scrollToRow(pt.id); }} className="w-auto rounded-[8px] py-[7px] pl-[9px] pr-[8px] text-[12.5px] font-bold" options={rooms.map((rm) => ({ value: rm, label: typeLabel(rm, t) }))} />
                          <IconChevronDown size={11} className="pointer-events-none absolute right-[6px] top-1/2 -translate-y-1/2 text-muted" />
                        </div>
                        <input value={pt.name} onChange={(e) => patch(pt.id, { name: e.target.value })} className="box-border w-[110px] flex-none rounded-[8px] border border-line bg-surface px-[9px] py-[7px] text-[13px] font-bold text-ink outline-none focus:border-blue" />
                        <div className="relative flex-none"><input type="number" value={pt.area || ""} onChange={(e) => patch(pt.id, { area: +e.target.value || 0 })} className="box-border w-[74px] rounded-[8px] border border-line bg-surface py-[7px] pl-2 pr-[26px] text-[13px] outline-none focus:border-blue" /><span className="pointer-events-none absolute right-[7px] top-1/2 -translate-y-1/2 text-[11px] text-muted">{t.pt_area}</span></div>
                        {pt.mirrorOf != null && <span title={t.pt_mirror_hint} className="inline-flex flex-none items-center gap-[3px] rounded-[7px] border border-[#cdd5e2] bg-[#f0f2f6] px-[7px] py-[3px] text-[10.5px] font-bold text-text-2"><IconArrowsLeftRight size={11} />{t.pt_mirror}</span>}
                        <span className="flex-none text-[11.5px] text-muted">{cnt[pt.id] || 0} {t.pt_units_bound}</span>
                        <span className="flex-1" />
                        <button type="button" disabled={busy[pt.id] > 0} onClick={() => pick(pt)} className="flex-none cursor-pointer whitespace-nowrap rounded-[8px] border border-blue bg-blue-tint px-[10px] py-[6px] text-[12px] font-bold text-[#2f5fe0] disabled:cursor-default disabled:opacity-60">{busy[pt.id] > 0 ? t.dx.uploading : arr.length ? t.pl_add_more : t.pl_upload}</button>
                        <span onClick={() => mut((l) => l.filter((x) => x.id !== pt.id))} title={t.pt_del} className="flex h-[27px] w-[27px] flex-none cursor-pointer items-center justify-center rounded-[8px] border border-[#f3d4d4] bg-surface text-[#c53030]"><IconTrash size={13} /></span>
                      </div>
                      {(() => {
                        const us = unitsOf[pt.id] || [];
                        if (!us.length) return null;
                        const open = moreId === pt.id, shown = open ? us : us.slice(0, 8);
                        const multiWing = new Set(units.map((u) => u.wing || "")).size > 1;
                        return (
                          <div className="flex flex-wrap items-center gap-[5px] text-[11.5px] text-text-2">
                            <span className="text-muted">{t.pt_units_list}</span>
                            {shown.map((u) => (
                              <a key={u.uid} href={`/dev/objects/${objId}/plans?u=${u.uid}`} title={`${t.open_card}: ${numLabel(u.num)} · ${u.area || "—"} м²`} className="whitespace-nowrap rounded-[6px] border border-line bg-surface px-[6px] py-[2px] font-semibold text-ink-2 hover:border-blue hover:text-blue">{multiWing && u.wing ? `${u.wing} · ` : ""}{numLabel(String(u.num).replace(/\*/g, ""))}</a>
                            ))}
                            {us.length > 8 && <button type="button" onClick={() => setMoreId(open ? null : pt.id)} className="cursor-pointer rounded-[6px] border-none bg-transparent px-[4px] py-[2px] font-semibold text-blue">{open ? t.pt_units_less : `+${us.length - 8}`}</button>}
                            {!pt.area && !isSpecialType(pt.rooms) && <span className="text-[#b45309]">· {t.pt_no_area}</span>}
                            {!arr.length && <span className="text-[#b45309]">· {t.pt_no_plan}</span>}
                          </div>
                        );
                      })()}
                      {arr.length > 0 && (
                        <div className="flex gap-[6px] overflow-x-auto pb-[2px]">
                          {arr.map((src, ai) => {
                            // сначала вырезки «с плана» (не двигаются и не удаляются), затем ручные; `i` — индекс в `pt.imgs`
                            const auto = ai < nAuto;
                            const i = ai - nAuto;
                            const man = pt.imgs;
                            return (
                              <div key={src + ai} draggable={!auto} onDragStart={(e) => { if (auto) { e.preventDefault(); return; } thDrag.current = { id: pt.id, i }; if (e.dataTransfer) e.dataTransfer.effectAllowed = "move"; }} onDragOver={(e) => { if (!auto) e.preventDefault(); }}
                                onDrop={(e) => { e.preventDefault(); const d = thDrag.current; if (auto || !d || d.id !== pt.id || d.i === i) return; const a = man.slice(); const [mv] = a.splice(d.i, 1); a.splice(i, 0, mv); thDrag.current = null; patch(pt.id, { imgs: a }); }}
                                onClick={(e) => { e.stopPropagation(); if (!auto && i > 0) { const a = man.slice(); a.splice(i, 1); a.unshift(src); patch(pt.id, { imgs: a }); } }} title={auto ? t.pt_from_plan : ai === 0 ? t.pl_main : ""}
                                className={`relative h-[52px] w-[52px] flex-none overflow-hidden rounded-[8px] ${auto ? "cursor-default" : "cursor-grab"}`} style={{ border: `2px solid ${ai === 0 ? "#4d7cfe" : auto ? "#cdd5e2" : "#e6e9f0"}`, backgroundImage: `url('${src}')`, backgroundSize: auto ? "contain" : "cover", backgroundRepeat: "no-repeat", backgroundColor: "#fff", backgroundPosition: "center" }}>
                                {ai === 0 && <span className="absolute bottom-0 left-0 right-0 py-px text-center text-[8.5px] font-extrabold text-white" style={{ background: "rgba(77,124,254,.9)" }}>{t.pl_main}</span>}
                                {auto && <span className="absolute left-0 right-0 top-0 py-px text-center text-[8px] font-extrabold uppercase tracking-[.02em] text-white" style={{ background: "rgba(20,36,63,.72)" }}>{t.pt_from_plan}</span>}
                                {!auto && <span onClick={(e) => { e.stopPropagation(); patch(pt.id, { imgs: man.filter((_, j) => j !== i) }); }} className="absolute right-0 top-0 flex h-[17px] w-[17px] items-center justify-center rounded-bl-[8px] text-[10px] text-white" style={{ background: "rgba(20,36,63,.8)" }}><IconX size={10} /></span>}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        <div className="flex flex-none flex-wrap justify-between gap-[10px] border-t border-[#eef0f4] bg-surface px-[22px] py-[13px]">
          <span className="flex flex-wrap gap-[8px]">
            <button type="button" onClick={ptAdd} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] border border-dashed border-blue bg-surface px-4 py-[11px] text-[13px] font-bold text-[#2f5fe0]"><IconPlus size={15} /> {t.pt_add}</button>
            <button type="button" onClick={findMirror} title={t.pt_mirror_hint} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] border border-line bg-surface px-4 py-[11px] text-[13px] font-bold text-text-2"><IconArrowsLeftRight size={15} /> {t.pt_find_mirror}</button>
          </span>
          <button type="button" onClick={onClose} className="cursor-pointer rounded-[10px] border-none bg-ink px-5 py-[11px] text-[14px] font-bold text-white">{t.pl_done}</button>
        </div>
      </div>
    </div>
  );
}
