"use client";

// Вкладка «Настройки» (прототип 868–935; данные 4016–4018, 4050, 4153–4155, 4206–4234; спецификация §1.11):
// нумерация этажей, валюта + цвета шахматки, особенности, изображения планировок, публикация, видимость.
import { useParams, useRouter } from "next/navigation";
import { Select } from "@/components/ui/Select";
import { useState } from "react";
import { IconCheck, IconCircle, IconCircleCheck, IconCircleCheckFilled, IconEye, IconEyeOff, IconGripVertical, IconInfoCircle, IconSortAscendingLetters, IconLock, IconPhotoPlus, IconRestore, IconWorld } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { DEFAULT_COLORS, STORDER } from "@/lib/dev/data";
import type { Cur, FScheme, HideReason } from "@/lib/dev/types";
import { mutUnits, setColors, setFeatures, updateProject, useDev } from "@/store/dev";
import { showToast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm";
import { convert, roundPrice, useRates } from "@/lib/rates";
import { SaveChip } from "@/components/dev/object/shared";
import { PlanTypesModal } from "@/components/dev/board/PlanTypesModal";

const FS_PREV: Record<FScheme, string> = { tr: "B1 · Z · 1 · 2 · 3", int: "B1 · G · 1 · 2 · 3", num: "-1 · 0 · 1 · 2 · 3" };
const card = "rounded-[14px] border border-line bg-surface p-[22px]";
const h3 = "mb-2 text-[16px] font-bold text-ink";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const objId = Number(id);
  const { t } = useDevT();
  const router = useRouter();
  const s = useDev();
  const obj = s.projects.find((p) => p.id === objId);
  const [newFeat, setNewFeat] = useState("");
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [dragTo, setDragTo] = useState<number | null>(null);
  const [plOpen, setPlOpen] = useState(false);
  const rates = useRates();
  if (!obj) return null;
  const fmtRate = (n: number) => (Math.round(n * 100) / 100).toString().replace(".", ",");
  const rateNote = (rates.live ? t.cur_rate : t.cur_rate_offline).replace("{d}", new Date(rates.date).toLocaleDateString("ru-RU")).replace("{usd}", fmtRate(rates.rates.USD)).replace("{try}", fmtRate(rates.rates.TRY));
  // Смена валюты: цены хранятся в валюте объекта, поэтому предлагаем пересчитать их по текущему курсу ЕЦБ.
  const changeCur = async (to: Cur) => {
    const from: Cur = obj.cur || "EUR";
    if (to === from) return;
    const priced = (s.units[objId] ?? []).filter((u) => u.price > 0).length;
    if (priced) {
      const k = convert(1, from, to, rates);
      const msg = t.cur_convert.replace(/\{from\}/g, from).replace(/\{to\}/g, to).replace("{rate}", (Math.round(k * 10000) / 10000).toString().replace(".", ","));
      if (await confirmDialog({ text: msg })) {
        mutUnits(objId, (list) => list.map((u) => (u.price > 0 ? { ...u, price: roundPrice(convert(u.price, from, to, rates), to) } : u)));
        showToast(t.cur_converted.replace("{n}", String(priced)));
      }
    }
    updateProject(objId, { cur: to, pricesIn: to });
  };

  const fs = t as unknown as Record<string, string>;
  const status = t.status as Record<string, string>;
  const reasons = t.co.reasons as Record<string, string>;
  const colorsDefault = JSON.stringify(s.colors) === JSON.stringify(DEFAULT_COLORS);
  const archived = !!obj.hidden || obj.stage === "done";
  const isPublic = obj.pubMode === "public";
  // Порядок меток: перетаскивание (как теги в Notion/Linear), ←/→ на выбранной метке, кнопка «А→Я».
  const moveFeat = (from: number, to: number) => { if (from === to) return; const a = [...s.features]; const [x] = a.splice(from, 1); a.splice(to, 0, x); setFeatures(a); };
  const sortFeats = () => setFeatures([...s.features].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base", numeric: true })));
  const addFeat = () => { const v = newFeat.trim(); if (v) { setFeatures([...s.features, v]); setNewFeat(""); } };
  const plOpenModal = () => setPlOpen(true);
  const radio = (on: boolean) => <span className="box-border h-[19px] w-[19px] flex-none rounded-full bg-surface" style={{ border: `5px solid ${on ? "#4d7cfe" : "#cdd6e6"}`, boxShadow: on ? "inset 0 0 0 2px #fff" : undefined }} />;

  return (
    <>
      <div className="mb-[6px] text-[13px] text-text-2">{obj.name} / {t.tab_set}</div>
      <div className="mb-[18px] flex flex-wrap items-center gap-3"><h1 className="m-0 text-[28px] font-extrabold tracking-[-.02em] text-ink">{t.set_title}</h1><SaveChip /></div>

      <div className="mb-[18px] grid gap-[18px]" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))" }}>
        {/* Нумерация этажей (872–881; fsBtns 4153) */}
        <div className={card}>
          <h3 className={h3}>{t.fs_title}</h3>
          <p className="mb-3 text-[13px] text-text-2">{t.fs_desc}</p>
          {(["tr", "int", "num"] as FScheme[]).map((k) => {
            const on = (obj.fScheme || "tr") === k;
            return (
              <div key={k} onClick={() => updateProject(objId, { fScheme: k })} className={`mb-2 flex cursor-pointer items-center gap-[10px] rounded-[12px] border-[1.5px] px-[14px] py-3 ${on ? "border-blue bg-blue-tint" : "border-line bg-surface"}`}>
                <div className="flex-1"><div className="text-[14px] font-bold text-ink">{fs[`fs_${k}`]}</div><div className="mt-[2px] font-mono text-[12px] text-muted">{FS_PREV[k]}</div></div>
                {on ? <IconCircleCheckFilled size={19} className="text-blue" /> : <IconCircle size={19} className="text-[#d5dae2]" />}
              </div>
            );
          })}
        </div>

        {/* Валюта и цвета (882–891; colorRows 3205, applyColors/resetColors 4016–4018) */}
        <div className={card}>
          <div className="mb-[14px] flex items-center gap-[10px] border-b border-dashed border-line pb-[14px]">
            <span className="flex-1 text-[14px] font-bold text-ink">{t.set_cur}</span>
            <Select value={obj.cur || "EUR"} onChange={(v) => void changeCur(v as Cur)} size="sm" menuWidth="auto" className="rounded-[9px] py-2 text-[13px] font-semibold" options={[{ value: "EUR", label: "EUR (€)" }, { value: "USD", label: "USD ($)" }, { value: "TRY", label: "TRY (₺)" }]} />
          </div>
          <p className="-mt-[4px] mb-[14px] text-[12.5px] text-text-2">{rateNote}<br />{t.cur_hint}</p>
          <h3 className={h3}>{t.set_colors}</h3>
          <p className="mb-[10px] text-[13px] text-text-2">{t.set_colors_desc}</p>
          {STORDER.map((k) => (
            <div key={k} className="flex items-center gap-3 border-b border-dashed border-line py-[10px]">
              <input type="color" value={s.colors[k]} onChange={(e) => setColors({ ...s.colors, [k]: e.target.value })} className="h-[34px] w-11 flex-none cursor-pointer rounded-[8px] border border-line bg-none" />
              <span className="flex-1 text-[14px] font-semibold">{status[k]}</span>
            </div>
          ))}
          <div className="mt-3 flex flex-wrap gap-[10px]">
            <button type="button" onClick={() => router.push(`/dev/objects/${objId}/plans?scheme=board`)} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[9px] border border-blue bg-blue px-3 py-2 text-[13px] font-semibold text-white"><IconCheck size={15} /> {t.set_apply}</button>
            <button type="button" onClick={() => setColors(DEFAULT_COLORS)} disabled={colorsDefault} className={`inline-flex items-center gap-[6px] rounded-[9px] border border-line bg-surface px-3 py-2 text-[13px] font-semibold ${colorsDefault ? "pointer-events-none cursor-default text-[#c3cad6]" : "cursor-pointer text-text-2 hover:border-[#c9d6ef] hover:text-ink"}`}><IconRestore size={15} /> {t.set_colors_reset}</button>
          </div>
        </div>

        {/* Особенности квартир (892–897; featChips 3206, addFeat 3000) */}
        <div className={card}>
          <div className="mb-2 flex items-center justify-between gap-3">
            <h3 className="text-[16px] font-bold text-ink">{t.set_feats}</h3>
            {s.features.length > 1 && <button type="button" onClick={sortFeats} className="inline-flex flex-none cursor-pointer items-center gap-[6px] rounded-[8px] border border-line bg-surface px-[10px] py-[6px] text-[12px] font-semibold text-ink-2 hover:border-blue hover:text-blue"><IconSortAscendingLetters size={15} /> {t.set_feat_sort}</button>}
          </div>
          <p className="mb-3 text-[13px] text-text-2">{t.set_feats_desc} {t.set_feat_order_hint}</p>
          <div className="flex flex-wrap gap-2">
            {s.features.map((f, i) => {
              const over = dragTo === i && dragFrom != null && dragFrom !== i;
              return (
                <span
                  key={`${i}-${f}`} draggable tabIndex={0} title={t.set_feat_drag}
                  onDragStart={(e) => { setDragFrom(i); e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", f); }}
                  onDragOver={(e) => { if (dragFrom == null) return; e.preventDefault(); e.dataTransfer.dropEffect = "move"; if (dragTo !== i) setDragTo(i); }}
                  onDrop={(e) => { e.preventDefault(); if (dragFrom != null) moveFeat(dragFrom, i); setDragFrom(null); setDragTo(null); }}
                  onDragEnd={() => { setDragFrom(null); setDragTo(null); }}
                  onKeyDown={(e) => { if (e.key === "ArrowLeft" && i > 0) { e.preventDefault(); moveFeat(i, i - 1); } else if (e.key === "ArrowRight" && i < s.features.length - 1) { e.preventDefault(); moveFeat(i, i + 1); } }}
                  className={`inline-flex cursor-grab items-center gap-[6px] rounded-[8px] py-[7px] pl-[7px] pr-3 text-[13px] font-semibold outline-none transition-[box-shadow,opacity] focus-visible:shadow-[0_0_0_2px_#4d7cfe] active:cursor-grabbing ${dragFrom === i ? "bg-blue-tint opacity-50" : "bg-bg-2"}`}
                  style={over ? { boxShadow: dragFrom! < i ? "3px 0 0 0 #4d7cfe" : "-3px 0 0 0 #4d7cfe" } : undefined}
                >
                  <IconGripVertical size={14} className="flex-none text-[#b3bac6]" />{f} <span onClick={() => setFeatures(s.features.filter((_, j) => j !== i))} className="cursor-pointer text-[#9aa1ac] hover:text-red">&times;</span>
                </span>
              );
            })}
          </div>
          <div className="mt-3 flex gap-2">
            <input value={newFeat} onChange={(e) => setNewFeat(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") addFeat(); }} placeholder={t.set_new_feat} className="flex-1 rounded-[9px] border border-line bg-[#fbfcfe] px-3 py-[9px] text-[14px] outline-none" />
            <button type="button" onClick={addFeat} className="cursor-pointer rounded-[9px] border border-ink bg-ink px-[14px] py-2 text-[13px] font-semibold text-white">{t.btn_add}</button>
          </div>
        </div>
      </div>

      {/* Изображения планировок (899) */}
      <div className={card}>
        <h3 className={h3}>{t.set_plans}</h3>
        <p className="text-[14px] text-text-2">{t.set_plans_desc}</p>
        <button type="button" onClick={plOpenModal} className="mt-[10px] inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] border border-ink bg-ink px-3 py-2 text-[13px] font-semibold text-white"><IconPhotoPlus size={16} /> {t.set_plans_btn}</button>
      </div>

      {/* Публикация объекта (900–921; 4216–4225) */}
      <div className={`${card} mt-[18px]`}>
        <div className="mb-[6px] flex items-center gap-[10px]"><h3 className="m-0 text-[16px] font-bold text-ink">{t.pb.title}</h3><SaveChip /></div>
        <p className="mb-[14px] max-w-[560px] text-[13px] text-text-2 [text-wrap:pretty]">{t.pb.desc}</p>
        <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))" }}>
          {([["closed", <IconLock key="l" size={15} className="mr-[5px] inline" />, t.pb.closed, t.pb.closed_d], ["public", <IconWorld key="w" size={15} className="mr-[5px] inline" />, t.pb.pub, t.pb.pub_d]] as const).map(([mode, icon, title, desc]) => {
            const on = mode === "public" ? isPublic : !isPublic;
            return (
              <div key={mode} onClick={() => updateProject(objId, { pubMode: mode })} className={`cursor-pointer rounded-[13px] border-[1.5px] px-[15px] py-[14px] ${on ? "border-blue bg-blue-tint" : "border-line bg-[#fbfcfe]"}`}>
                <div className="mb-[6px] flex items-center gap-[9px]">{radio(on)}<span className="text-[14.5px] font-bold text-ink">{icon}{title}</span></div>
                <div className="text-[12.5px] leading-[1.45] text-text-2">{desc}</div>
              </div>
            );
          })}
        </div>
        {isPublic && (
          <div className="mt-[14px] rounded-[12px] border border-line bg-[#f7f8fb] px-4 py-[15px]">
            <div onClick={() => updateProject(objId, { pubBeyan: !obj.pubBeyan })} className="mb-3 flex cursor-pointer items-start gap-[10px]">
              <span className={`flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] border-[1.5px] font-extrabold text-white ${obj.pubBeyan ? "border-blue bg-blue" : "border-[#cdd6e6] bg-surface"}`}><IconCheck size={13} /></span>
              <span className="text-[13px] leading-[1.45] text-[#3d4757]">{t.pb.beyan}</span>
            </div>
            <label className="mb-[5px] block text-[12px] text-text-2">{t.pb.eids}</label>
            <input value={obj.eidsRef || ""} onChange={(e) => updateProject(objId, { eidsRef: e.target.value })} placeholder="0000000" className="w-full max-w-[280px] rounded-[10px] border border-line bg-surface px-3 py-[10px] text-[14px] outline-none focus:border-blue" />
            <div className="mt-2 flex max-w-[560px] items-start gap-1 text-[11.5px] leading-[1.45] text-[#9aa1ac]"><IconInfoCircle size={13} className="mt-[2px] flex-none" /> <span>{t.pb.eids_hint}</span></div>
          </div>
        )}
      </div>

      {/* Видимость в кабинете (922–934; 4226–4234) */}
      <div className={`${card} mt-[18px]`}>
        <div className="mb-4 flex flex-wrap items-start gap-3">
          <div className="min-w-[220px] flex-1">
            <h3 className="mb-[6px] text-[16px] font-bold text-ink">{t.co.arch_title}</h3>
            <p className="m-0 max-w-[520px] text-[13px] text-text-2">{t.co.arch_desc}</p>
          </div>
          <span className={`inline-flex items-center gap-[7px] whitespace-nowrap rounded-[20px] border px-[13px] py-[7px] text-[12.5px] font-bold ${archived ? "border-[#f5e3b0] bg-[#fef6e0] text-[#8a5a00]" : "border-[#b9e6cf] bg-green-tint text-[#1c7a4a]"}`}>{archived ? <IconEyeOff size={14} /> : <IconCircleCheck size={14} />} {archived ? t.co.arch_hidden : t.co.arch_active}</span>
        </div>
        <div className="mb-4">
          <label className="mb-2 block text-[13px] text-text-2">{t.co.arch_reason}</label>
          <div className="flex flex-wrap gap-2">
            {(["done", "sold", "paused", "other"] as HideReason[]).map((k) => {
              const on = (obj.hideReason || "other") === k;
              return <span key={k} onClick={() => updateProject(objId, { hideReason: k })} className={`cursor-pointer whitespace-nowrap rounded-[9px] border px-[14px] py-2 text-[13px] font-semibold ${on ? "border-ink bg-ink text-white" : "border-line bg-surface text-text-2"}`}>{reasons[k]}</span>;
            })}
          </div>
        </div>
        <button type="button" onClick={() => updateProject(objId, { hidden: !obj.hidden, hideReason: !obj.hidden && !obj.hideReason ? "other" : obj.hideReason })} className={`inline-flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[10px] border px-[18px] py-[11px] text-[14px] font-bold ${obj.hidden ? "border-[#1c7a4a] bg-[#1c7a4a] text-white" : "border-[#e0574f] bg-surface text-[#d0473f]"}`}>{obj.hidden ? <IconEye size={16} /> : <IconEyeOff size={16} />} {obj.hidden ? t.co.arch_show : t.co.arch_hide}</button>
      </div>
      <PlanTypesModal objId={objId} open={plOpen} onClose={() => setPlOpen(false)} />
    </>
  );
}
