"use client";

// Схема «Поэтажный план» (778–815):
//   <FloorPlan objId onOpenUnit readOnly? />
// Akropolis (`obj.akro`, id 10) — демо-планы с зонами из прототипа (`fpZones` 3991–3998) — оставлены как есть.
// Остальные объекты — реальные экспликации: `Project.floorPlans[fpKey(wing, floor)]` (картинка из Storage +
// полигоны квартир в нормализованных координатах). Слева — корпуса и этажи из юнитов, по центру — просмотр
// (`FloorPlanView`) или режим обводки (`FloorPlanEditor`), справа — квартиры, ещё не отмеченные на плане.
// «Разметить ИИ» — серверный экшен `detectFloorAreas` (черновые контуры, правятся в режиме обводки).
// «Обновить планировки с плана» — вырезки всех обведённых квартир этажа в их типы планировок (`lib/dev/planCrop`, прогресс «3 / 12»);
// после ИИ/копирования с этажа вырезки ставятся в очередь автоматически, удаление плана снимает картинки «с плана».
import { IconCheck, IconCopy, IconLoader2, IconPencil, IconPhotoScan, IconSparkles, IconTrash, IconUpload, IconWand, IconZoomIn } from "@tabler/icons-react";
import { Select } from "@/components/ui/Select";
import { useEffect, useRef, useState } from "react";
import { showToast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm";
import { useDevT } from "@/i18n/dev";
import { asset, fLbl, money, numLabel, typeLabel } from "@/lib/dev/data";
import { fpFloors, fpHasAny, fpKey, fpUnits, fpWings, isBlankUnit, levelOf, unitFloors } from "@/lib/dev/floorplan";
import { aiMarkSheet, fitPlanToWalls } from "@/lib/dev/aiMark";
import { dropUnitCrop, scheduleUnitCrop, syncAllCrops, useCropBusy } from "@/lib/dev/planCrop";
import type { FloorPlan as FloorPlanT, Unit, UnitStatus } from "@/lib/dev/types";
import { uploadFile } from "@/lib/upload";
import { pdfFirstPageToFile } from "@/lib/pdfToImage";
import { getDev, removeFloorPlan, setFloorPlan } from "@/store/dev";
import { FloorPlanEditor } from "./FloorPlanEditor";
import { FloorPlanView } from "./FloorPlanView";
import { Legend } from "./Legend";
import { useObj } from "./shared";

type Zone = [string, number, number];
const PLANS: Record<string, { img: string; wing: string; rk: string; y: [number, number]; zones: Zone[] }> = {
  a0: { img: "akropolis-photos/floor-a-zemin.png", wing: "A", rk: "GO", y: [38, 24], zones: [["KAPICI", 5.3, 8.7], ["1", 14, 10], ["2", 24, 16], ["3", 40, 23.5], ["4", 63.5, 16.5], ["5", 80, 16.3]] },
  b1: { img: "akropolis-photos/floor-b-1.png", wing: "B", rk: "1", y: [41.5, 14], zones: [["36", 5.9, 4.55], ["35", 10.45, 4.55], ["34", 15, 4.55], ["33", 19.55, 4.55], ["32", 24.1, 4.55], ["31", 28.65, 4.55], ["30", 33.2, 4.55], ["29", 37.75, 4.55], ["28", 42.3, 4.55], ["27", 52.6, 4.9], ["26", 57.5, 4.9], ["25", 62.4, 4.9], ["24", 67.3, 4.9], ["23", 72.2, 4.9], ["22", 77.1, 4.9], ["21", 82, 4.9], ["20", 86.9, 4.9], ["19", 91.8, 4.9]] },
};

/** `legendTop` — отступ липкой ленты статусов над планом (58 в кабинете, 114 на публичной странице). */
export function FloorPlan({ objId, onOpenUnit, readOnly = false, legendTop }: { objId: number; onOpenUnit: (uid: number) => void; readOnly?: boolean; legendTop?: number }) {
  const { obj } = useObj(objId);
  if (obj?.akro) return <FloorPlanReal objId={objId} onOpenUnit={onOpenUnit} />;
  return <FloorPlanMain objId={objId} onOpenUnit={onOpenUnit} readOnly={readOnly} legendTop={legendTop} />;
}

function FloorPlanReal({ objId, onOpenUnit }: { objId: number; onOpenUnit: (uid: number) => void }) {
  const { t } = useDevT();
  const { units, colors } = useObj(objId);
  const [plan, setPlan] = useState<"a0" | "b1">("a0");
  const P = PLANS[plan];
  const tabs: ["a0" | "b1", string][] = [["a0", t.board.fp_tab_a], ["b1", t.board.fp_tab_b]];
  return (
    <>
      <div className="mb-[14px] flex flex-wrap items-center gap-2">
        {tabs.map(([k, label]) => <span key={k} onClick={() => setPlan(k)} className={`flex-none cursor-pointer whitespace-nowrap rounded-[9px] border px-[14px] py-2 text-[13px] font-semibold ${plan === k ? "border-ink bg-ink text-white" : "border-line bg-surface text-text-2"}`}>{label}</span>)}
        <span className="text-[12px] text-muted">{t.fp_real_hint}</span>
      </div>
      <div className="rounded-[16px] border border-line bg-surface p-3">
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={asset(P.img)} loading="lazy" alt="" className="block w-full rounded-[10px]" />
          {P.zones.map((z) => {
            const nm = z[0];
            const u = nm === "KAPICI" ? null : units.find((x) => x.wing === P.wing && (P.rk === "GO" ? x.floor === 0 && (x.band || "out") !== "ins" : P.rk === "GI" ? x.floor === 0 && x.band === "ins" : String(x.floor) === P.rk) && String(x.num).replace(/\*/g, "") === nm);
            const col = u ? colors[u.status] || "#9aa1ac" : "#9aa1ac";
            const base: React.CSSProperties = { position: "absolute", left: `${z[1]}%`, width: `${z[2]}%`, top: `${P.y[0]}%`, height: `${P.y[1]}%`, borderRadius: 6 };
            if (!u) return <div key={nm} style={{ ...base, border: "2px dashed #b7bcc6", background: "rgba(150,160,175,.12)" }}><span style={{ position: "absolute", left: 4, top: 4, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: "rgba(255,255,255,.9)", color: "#6b7688" }}>{nm === "KAPICI" ? t.board.kapici : `№${nm}`}</span></div>;
            return (
              <div key={nm} onClick={() => onOpenUnit(u.uid)} title={`${u.area} м²`} className="cursor-pointer hover:brightness-[1.08]" style={{ ...base, border: `2px solid ${col}`, background: col + "33" }}>
                <span style={{ position: "absolute", left: 4, top: 4, fontSize: 10, fontWeight: 700, padding: "1px 6px", borderRadius: 10, background: "rgba(255,255,255,.94)", color: col }}>№{String(u.num).replace(/\*/g, "")} · {u.type}</span>
              </div>
            );
          })}
        </div>
      </div>
    </>
  );
}


// ---------------------------------------------------------------------------------------------------------
// Реальные поэтажные планы


/** Размеры картинки файла (через objectURL). */
function imageSize(file: File): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const im = new Image();
    im.onload = () => { resolve({ w: im.naturalWidth, h: im.naturalHeight }); URL.revokeObjectURL(url); };
    im.onerror = () => { URL.revokeObjectURL(url); reject(new Error("bad image")); };
    im.src = url;
  });
}
/** `blob:`-план → base64 (уменьшенный JPEG), чтобы серверный экшен мог отдать его модели. */

const btn = "inline-flex cursor-pointer items-center gap-[7px] rounded-[10px] border px-4 py-[10px] text-[14px] font-semibold disabled:cursor-default disabled:opacity-60";

function FloorPlanMain({ objId, onOpenUnit, readOnly, legendTop }: { objId: number; onOpenUnit: (uid: number) => void; readOnly: boolean; legendTop?: number }) {
  const { t } = useDevT();
  const [fSt, setFSt] = useState<"" | UnitStatus>("");
  const [aiProg, setAiProg] = useState("");
  const [zoom, setZoom] = useState(1); // масштаб плана: мелкие квартиры на листе всего здания обводить в 100% невозможно // фильтр ленты статусов: остальные квартиры на плане приглушаются
  const { obj, units, colors, cur, planTypes } = useObj(objId);
  const plans = obj?.floorPlans ?? {};
  const fScheme = obj?.fScheme || "tr";
  const hasPlan = (w: string, f: number) => !!plans[fpKey(w, f)]?.img;
  const allWings = fpWings(units);
  const wings = readOnly ? allWings.filter((w) => fpFloors(units, w).some((f) => hasPlan(w, f))) : allWings;
  const [wingSel, setWingSel] = useState<string | null>(null);
  const [floorSel, setFloorSel] = useState<number | null>(null);
  const [mode, setMode] = useState<"view" | "trace">("view");
  const [traceUid, setTraceUid] = useState<number | null>(null);
  const [uploading, setUploading] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [wallBusy, setWallBusy] = useState(false);
  const [syncing, setSyncing] = useState<{ i: number; n: number } | null>(null);
  const cropBusy = useCropBusy();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const wing = wingSel != null && wings.includes(wingSel) ? wingSel : (wings.find((w) => fpFloors(units, w).some((f) => hasPlan(w, f))) ?? wings[0] ?? "");
  const allFloors = fpFloors(units, wing);
  const floors = readOnly ? allFloors.filter((f) => hasPlan(wing, f)) : allFloors;
  const floor = floorSel != null && floors.includes(floorSel) ? floorSel : (floors.find((f) => hasPlan(wing, f)) ?? floors[0]);
  const key = fpKey(wing, floor ?? 0);
  const plan: FloorPlanT | undefined = floor != null ? plans[key] : undefined;
  const floorUnits = floor != null ? fpUnits(units, wing, floor) : [];
  const mapped = new Set((plan?.areas ?? []).map((a) => a.uid));
  const unmapped = floorUnits.filter((u) => !mapped.has(u.uid));
  const lvlText = (u: Unit, f: number) => { const l = levelOf(u, f); return l === "lower" ? t.fp.lvl_lower : l === "upper" ? t.fp.lvl_upper : l === "middle" ? t.fp.lvl_middle : ""; };
  const tracedOn = (u: Unit, f: number) => !!plans[fpKey(wing, f)]?.areas.some((a) => a.uid === u.uid);
  // Дуплексы/триплексы этого этажа, у которых на другом своём этаже контура ещё нет (или там нет плана):
  // без него в типе планировки будет только одна картинка вместо двух.
  const otherLevelMissing = floor == null ? [] : floorUnits
    .filter((u) => mapped.has(u.uid) && unitFloors(u).length > 1)
    .map((u) => ({ u, floors: unitFloors(u).filter((f) => f !== floor && !tracedOn(u, f)) }))
    .filter((x) => x.floors.length > 0);
  const freeIn = (list: Unit[]) => list.filter((u) => u.status === "free").length;
  const wingUnits = (w: string) => units.filter((u) => !u.vl && (u.wing || "") === w && !isBlankUnit(u));

  const cropErr = (e: Error) => showToast(`${t.fp.crop_err}${e.message ? ": " + e.message : ""}`, 4000);
  const cropLater = (uid: number) => scheduleUnitCrop(objId, key, uid, cropErr);
  // Дозагрузка пропущенных вырезок: контур есть, а картинки «с плана» нет (обрыв сети, старые данные) — режем тихо в фоне.
  const missingCrops = readOnly || !plan?.img || plan.img.startsWith("blob:") ? "" : plan.areas
    .filter((a) => { const u = units.find((x) => x.uid === a.uid); return !!u && !!u.type && u.type !== "1*" && !planTypes.some((pt) => pt.autoImgs && pt.autoImgs[`${a.uid}|${key}`]); })
    .map((a) => a.uid).join(",");
  const backfilled = useRef(new Set<string>()); // каждая квартира плана — одна попытка за сессию (без повторов при ошибке)
  useEffect(() => {
    if (!missingCrops) return;
    missingCrops.split(",").filter((id) => !backfilled.current.has(`${key}:${id}`)).forEach((id, i) => { backfilled.current.add(`${key}:${id}`); scheduleUnitCrop(objId, key, +id, undefined, 1200 + i * 150); });
  }, [objId, key, missingCrops]);
  const pickWing = (w: string) => { setWingSel(w); setFloorSel(null); setTraceUid(null); };
  const pickFloor = (f: number) => { setFloorSel(f); setTraceUid(null); };

  const onFile = async (file: File | undefined) => {
    if (fileRef.current) fileRef.current.value = "";
    if (!file || floor == null) return;
    if (file.type === "application/pdf" || /\.pdf$/i.test(file.name)) {
      // PDF → first page as PNG (client-side render), then the normal image flow
      try { file = await pdfFirstPageToFile(file); } catch { showToast(t.fp.pdf_hint, 3600); return; }
    }
    if (!file.type.startsWith("image/")) { showToast(t.fp.not_image); return; }
    setUploading(true);
    try {
      const { w, h } = await imageSize(file);
      const up = await uploadFile(file, `dev/${objId}/floorplans`);
      setFloorPlan(objId, key, { img: up.url, w, h });
      showToast(t.fp.uploaded);
    } catch (e) {
      showToast(`${t.fp.upload_err}${e instanceof Error && e.message ? ": " + e.message : ""}`, 3600);
    } finally { setUploading(false); }
  };
  // Same layout on another floor: copy the plan image and contours, re-bind them to this floor's units
  // by position in the row (pos + band), falling back to order; statuses/prices come from the target units.
  const copySources = floor == null ? [] : fpFloors(units, wing).filter((f) => f !== floor && hasPlan(wing, f));
  const copyFrom = (srcFloor: number) => {
    if (floor == null) return;
    const src = plans[fpKey(wing, srcFloor)];
    if (!src?.img) return;
    const srcUnits = fpUnits(units, wing, srcFloor);
    const used = new Set<number>();
    // Дуплекс/триплекс, занимающий оба этажа, остаётся сам собой — его контур не отдаём соседней квартире.
    const both = new Set(floorUnits.filter((u) => srcUnits.some((x) => x.uid === u.uid)).map((u) => u.uid));
    const byPos = new Map<string, Unit>();
    floorUnits.forEach((u) => { if (both.has(u.uid)) return; const k = `${u.band || "out"}|${u.pos}`; if (!byPos.has(k)) byPos.set(k, u); });
    const areas: { uid: number; poly: [number, number][] }[] = [];
    src.areas.forEach((a) => {
      const su = srcUnits.find((u) => u.uid === a.uid);
      if (!su) return;
      let tu: Unit | undefined = both.has(su.uid) ? su : byPos.get(`${su.band || "out"}|${su.pos}`);
      if (!tu || used.has(tu.uid)) { const idx = srcUnits.indexOf(su); tu = floorUnits[idx]; }
      if (!tu || used.has(tu.uid)) return;
      used.add(tu.uid);
      areas.push({ uid: tu.uid, poly: a.poly.map((pt) => [pt[0], pt[1]] as [number, number]) });
    });
    (plan?.areas ?? []).forEach((a) => { if (!areas.some((b) => b.uid === a.uid)) dropUnitCrop(objId, a.uid, key); });
    setFloorPlan(objId, key, { img: src.img, w: src.w, h: src.h, areas });
    areas.forEach((a) => cropLater(a.uid));
    showToast(t.fp.copied.replace("{n}", String(areas.length)).replace("{m}", String(floorUnits.length)), 4200);
    setMode("trace");
  };
  const onRemove = async () => {
    if (!plan) return;
    if (!(await confirmDialog({ text: t.fp.confirm_remove, ok: t.fp.remove, danger: true }))) return;
    plan.areas.forEach((a) => dropUnitCrop(objId, a.uid, key));
    removeFloorPlan(objId, key);
    setMode("view"); setTraceUid(null);
    showToast(t.fp.removed);
  };
  // ИИ-разметка в два прохода (`aiMarkSheet`: поиск по фрагментам листа → точный контур каждой квартиры). Уже обведённые
  // квартиры по умолчанию не трогаем; по подтверждению — размечаем заново все.
  const runAi = async () => {
    if (!plan || aiBusy) return;
    if (!floorUnits.length) { showToast(t.fp.ai_no_units); return; }
    const existing = new Set(plan.areas.map((a) => a.uid));
    let keep: Set<number> | undefined = existing;
    if (existing.size && (await confirmDialog({ text: t.fp.ai_confirm.replace("{n}", String(existing.size)) }))) keep = undefined;
    if (keep && floorUnits.every((u) => keep!.has(u.uid))) { showToast(t.fp.ai_all_done, 3600); return; }
    setAiBusy(true); setAiProg("");
    try {
      const res = await aiMarkSheet(objId, [wing], floor!, { keep, onProgress: (p) => setAiProg(`${p.phase === "search" ? t.fp.ai_ph_search : t.fp.ai_ph_refine} ${p.i}/${p.n}`) });
      if (!res.ok) {
        const msg = res.reason === "no-key" ? t.fp.ai_no_key : res.reason === "no-session" ? t.fp.ai_no_session : res.reason === "bad-json" ? t.fp.ai_bad : res.reason === "too-big" ? t.fp.ai_too_big : res.reason === "fetch" ? t.fp.ai_fetch_err : `${t.fp.ai_err}: ${res.reason}`;
        showToast(msg, 4000);
        return;
      }
      if (!res.found) { showToast(t.fp.ai_none, 3600); return; }
      const cur = getDev().projects.find((p) => p.id === objId)?.floorPlans?.[key];
      (cur?.areas ?? []).forEach((a) => { if (!keep || !keep.has(a.uid)) cropLater(a.uid); });
      showToast(`${t.fp.ai_done.replace("{n}", String(res.found)).replace("{m}", String(res.of))}${res.walls ? ` · ${t.fp.ai_walls.replace("{n}", String(res.walls))}` : ""}${res.copied?.length ? ` · ${t.fp.copied_to.replace("{f}", res.copied.map((f) => fLbl(f, obj?.fScheme || "tr")).join(", "))}` : ""}${res.duplex ? ` · ${t.fp.duplex_tagged.replace("{n}", String(res.duplex))}` : ""}`, 6000);
      setMode("trace");
    } catch (e) {
      showToast(`${t.fp.ai_err}${e instanceof Error && e.message ? ": " + e.message : ""}`, 4000);
    } finally { setAiBusy(false); setAiProg(""); }
  };

  // Точная подгонка текущих контуров по стенам чертежа (без ИИ, `planWalls`): отправная точка — что уже обведено.
  const runWalls = async () => {
    if (!plan || wallBusy) return;
    if (!plan.areas.length) { showToast(t.fp.walls_noareas, 3600); return; }
    setWallBusy(true);
    try {
      const res = await fitPlanToWalls(objId, wing, floor!);
      if (!res.ok) { showToast(res.reason === "no-areas" ? t.fp.walls_noareas : t.fp.ai_fetch_err, 4000); return; }
      if (!res.fitted) { showToast(t.fp.walls_none, 5000); return; }
      const cur = getDev().projects.find((p) => p.id === objId)?.floorPlans?.[key];
      (cur?.areas ?? []).forEach((a) => cropLater(a.uid));
      showToast(`${t.fp.walls_done.replace("{n}", String(res.fitted)).replace("{m}", String(res.of))}${res.copied.length ? ` · ${t.fp.copied_to.replace("{f}", res.copied.map((f) => fLbl(f, obj?.fScheme || "tr")).join(", "))}` : ""}`, 5000);
      setMode("trace");
    } catch (e) {
      showToast(`${t.fp.ai_err}${e instanceof Error && e.message ? ": " + e.message : ""}`, 4000);
    } finally { setWallBusy(false); }
  };

  const runSync = async () => {
    if (!plan || syncing) return;
    const n = plan.areas.length;
    setSyncing({ i: 0, n });
    try {
      const res = await syncAllCrops(objId, key, (i, total) => setSyncing({ i, n: total }));
      if (res.errors.length) cropErr(res.errors[0]);
      showToast(t.fp.sync_done.replace("{n}", String(res.done)).replace("{m}", String(n)), 4200);
    } finally { setSyncing(null); }
  };

  if (!obj) return null;
  if (readOnly && !fpHasAny(obj)) return null;

  const wingLabel = (w: string) => (w ? `${t.block} ${w}` : t.fp.no_wing);
  const sidebar = (
    <div className="w-[150px] flex-none max-md:w-full">
      {wings.length > 1 && (
        <>
          <div className="mb-[6px] text-center text-[12px] text-text-2">{t.fp.wings}</div>
          <div className="mb-[14px] flex flex-col gap-2 max-md:flex-row max-md:flex-wrap">
            {wings.map((w) => (
              <div key={w || "_"} onClick={() => pickWing(w)} className={`cursor-pointer rounded-[11px] border p-3 text-center max-md:min-w-[120px] max-md:flex-1 ${w === wing ? "border-[#d4e0ff] bg-blue-tint" : "border-line bg-surface text-text-2"}`}>
                <b className={w === wing ? "text-ink" : ""}>{wingLabel(w)}</b>
                <div className={`mt-[2px] text-[13px] ${w === wing ? "text-blue" : ""}`}>{w === wing ? t.active : `${freeIn(wingUnits(w))} ${t.free_suffix}`}</div>
              </div>
            ))}
          </div>
        </>
      )}
      <div className="mb-[6px] text-center text-[12px] text-text-2">{t.floor_word}</div>
      <div className="flex max-h-[420px] flex-col gap-[5px] overflow-auto max-md:max-h-none max-md:flex-row max-md:flex-wrap">
        {floors.map((f) => {
          const on = f === floor, has = hasPlan(wing, f);
          const fu = fpUnits(units, wing, f);
          return (
            <button key={f} type="button" onClick={() => pickFloor(f)} className={`flex w-full cursor-pointer items-center justify-between gap-2 rounded-[9px] border px-[10px] py-2 text-left max-md:w-auto max-md:min-w-[110px] ${on ? "border-ink bg-ink text-white" : "border-line bg-surface text-text-2"}`}>
              <span className="text-[14px] font-semibold">{fLbl(f, fScheme)}</span>
              <span className="flex flex-col items-end leading-[1.15]">
                <span className={`inline-flex items-center gap-1 text-[10px] font-bold uppercase tracking-[.02em] ${on ? "text-white/80" : has ? "text-green" : "text-muted"}`}><span className="h-[6px] w-[6px] rounded-full" style={{ background: has ? "#1c9a5b" : on ? "rgba(255,255,255,.45)" : "#c8cfda" }} />{has ? t.fp.has_plan : t.fp.no_plan}</span>
                <span className={`text-[11px] ${on ? "text-white/70" : "text-text-2"}`}>{freeIn(fu)} {t.free_suffix}</span>
              </span>
            </button>
          );
        })}
        {!floors.length && <div className="p-2 text-center text-[12px] text-muted">{t.fp.no_units}</div>}
      </div>
    </div>
  );

  const canvas = (
    <div data-print-fp="1" className="relative min-w-[280px] flex-1 overflow-hidden rounded-[12px] border border-line bg-[#fbfcfe] p-2">
      {plan ? (
        <div className={zoom > 1 ? "max-h-[78vh] overflow-auto" : ""} style={{ scrollbarWidth: "thin" }}>
          <div style={{ width: `${zoom * 100}%` }}>
            {mode === "trace" && !readOnly
              ? <FloorPlanEditor objId={objId} planKey={key} plan={plan} floor={floor ?? undefined} units={floorUnits} colors={colors} cur={cur} traceUid={traceUid} onTraceDone={() => setTraceUid(null)} zoom={zoom} />
              : <FloorPlanView plan={plan} floor={floor ?? undefined} units={floorUnits} colors={colors} cur={cur} onOpenUnit={onOpenUnit} readOnly={readOnly} filterSt={fSt} />}
          </div>
        </div>
      ) : (
        <div className="flex min-h-[320px] flex-col items-center justify-center rounded-[10px] border-2 border-dashed border-[#cdd5e2] px-6 py-10 text-center">
          <div className="mb-[12px] flex h-[54px] w-[54px] items-center justify-center rounded-[16px] bg-blue-tint text-blue"><IconUpload size={24} /></div>
          <div className="text-[17px] font-extrabold text-ink">{t.fp.empty_title}</div>
          <div className="mx-auto mt-[6px] max-w-[420px] text-[13px] text-text-2">{t.fp.empty_sub}</div>
          {!readOnly && floor != null && <button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className={`${btn} mt-[16px] border-blue bg-blue text-white`}>{uploading ? <IconLoader2 size={16} className="animate-spin" /> : <IconUpload size={16} />} {t.fp_add_floor}</button>}
        </div>
      )}
    </div>
  );

  const side = !readOnly && plan && (
    <div className="w-[210px] flex-none max-md:w-full">
      <div className="mb-[6px] text-[12px] font-bold uppercase tracking-[.03em] text-text-2">{t.fp.unmapped} · {unmapped.length}</div>
      {!floorUnits.length && <div className="text-[12.5px] text-muted">{t.fp.no_units}</div>}
      {!!floorUnits.length && !unmapped.length && <div className="rounded-[10px] border border-[#cdeedd] bg-[#eefaf3] px-3 py-2 text-[12.5px] text-green"><IconCheck size={13} className="mr-1 inline-block align-[-2px]" />{t.fp.all_mapped}</div>}
      <div className="flex max-h-[520px] flex-col gap-[5px] overflow-auto">
        {unmapped.map((u) => (
          <div key={u.uid} className="flex items-center justify-between gap-2 rounded-[9px] border border-line bg-surface px-[10px] py-[7px]">
            <span className="min-w-0 text-[12.5px]"><b className="text-ink">{numLabel(String(u.num).replace(/\*/g, ""))}</b> <span className="text-text-2">· {typeLabel(u.type, t, "—")} · {u.area} м²</span>{floor != null && lvlText(u, floor) && <div className="text-[11px] font-semibold text-blue">{lvlText(u, floor)}</div>}{u.price > 0 && <div className="text-[11px] text-text-2">{money(u.price, cur)}</div>}</span>
            <button type="button" onClick={() => { setTraceUid(u.uid); setMode("trace"); }} className={`inline-flex flex-none cursor-pointer items-center gap-1 rounded-[7px] border px-2 py-[5px] text-[11.5px] font-semibold ${traceUid === u.uid ? "border-blue bg-blue text-white" : "border-line bg-surface text-ink-2 hover:border-blue hover:text-blue"}`}><IconPencil size={12} /> {t.fp.trace_btn}</button>
          </div>
        ))}
      </div>
      {otherLevelMissing.length > 0 && (
        <>
          <div className="mb-[6px] mt-[14px] text-[12px] font-bold uppercase tracking-[.03em] text-text-2">{t.fp.other_lvl} · {otherLevelMissing.length}</div>
          <div className="flex flex-col gap-[5px]">
            {otherLevelMissing.map(({ u, floors: fs }) => (
              <div key={u.uid} className="rounded-[9px] border border-[#f3d9a4] bg-[#fff8e8] px-[10px] py-[7px] text-[12.5px]">
                <b className="text-ink">{numLabel(String(u.num).replace(/\*/g, ""))}</b> <span className="text-text-2">· {typeLabel(u.type, t)}</span>
                {fs.map((f) => (
                  <div key={f} className="mt-[4px] flex items-center justify-between gap-2">
                    <span className="text-[11.5px] text-[#8a5a00]">{(hasPlan(wing, f) ? t.fp.other_lvl_missing : t.fp.other_lvl_noplan).replace("{f}", fLbl(f, fScheme)).replace("{lvl}", lvlText(u, f))}</span>
                    <button type="button" onClick={() => { pickFloor(f); if (hasPlan(wing, f)) { setTraceUid(u.uid); setMode("trace"); } else setMode("view"); }} className="inline-flex flex-none cursor-pointer items-center gap-1 rounded-[7px] border border-line bg-surface px-2 py-[5px] text-[11.5px] font-semibold text-ink-2 hover:border-blue hover:text-blue"><IconPencil size={12} /> {t.fp.other_lvl_go.replace("{f}", fLbl(f, fScheme))}</button>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );

  return (
    <>
      {!readOnly && (
        <div className="mb-[14px] flex flex-wrap items-center gap-3">
          <input ref={fileRef} type="file" accept="image/*,.pdf" className="hidden" onChange={(e) => onFile(e.target.files?.[0])} />
          <button type="button" disabled={uploading || floor == null} onClick={() => fileRef.current?.click()} className={`${btn} border-ink bg-ink text-white`}>{uploading ? <IconLoader2 size={16} className="animate-spin" /> : <IconUpload size={16} />} {plan ? t.fp.replace : t.fp_add_floor}</button>
          {plan && <button type="button" onClick={() => { setMode((m) => (m === "trace" ? "view" : "trace")); setTraceUid(null); }} className={`${btn} ${mode === "trace" ? "border-green bg-green text-white" : "border-line bg-surface text-ink-2"}`}>{mode === "trace" ? <IconCheck size={16} /> : <IconPencil size={16} />} {mode === "trace" ? t.fp.trace_done : t.fp_trace}</button>}
          {plan && <button type="button" disabled={aiBusy} onClick={runAi} className={`${btn} border-blue bg-blue-tint text-[#3a63d4] hover:bg-[#e2ebff]`}>{aiBusy ? <IconLoader2 size={16} className="animate-spin" /> : <IconSparkles size={16} />} {aiBusy ? `${t.fp.ai_busy}${aiProg ? " · " + aiProg : ""}` : t.fp.ai}</button>}
          {plan && plan.areas.length > 0 && <button type="button" disabled={wallBusy || aiBusy} onClick={() => void runWalls()} title={t.fp.walls_hint} className={`${btn} border-blue bg-blue-tint text-[#3a63d4] hover:bg-[#e2ebff]`}>{wallBusy ? <IconLoader2 size={16} className="animate-spin" /> : <IconWand size={16} />} {wallBusy ? t.fp.walls_busy : t.fp.walls}</button>}
          {plan && plan.areas.length > 0 && <button type="button" disabled={!!syncing} onClick={runSync} title={t.fp.auto_imgs_hint} className={`${btn} border-line bg-surface text-ink-2`}>{syncing ? <IconLoader2 size={16} className="animate-spin" /> : <IconPhotoScan size={16} />} {syncing ? t.fp.sync_progress.replace("{i}", String(syncing.i)).replace("{n}", String(syncing.n)) : t.fp.sync_plans}</button>}
          {plan && <button type="button" onClick={() => void onRemove()} className={`${btn} border-line bg-surface text-red hover:border-red`}><IconTrash size={16} /> {t.fp.remove}</button>}
          {copySources.length > 0 && (
            <Select value="" placeholder={t.fp.copy_from} icon={<IconCopy size={16} />} size="sm" menuWidth="auto" className={`${btn} w-auto border-line bg-surface text-ink-2`}
              onChange={(f) => { if (f === "") return; if (!plan) { copyFrom(+f); return; } void confirmDialog({ text: t.fp.copy_confirm }).then((ok) => { if (ok) copyFrom(+f); }); }}
              options={copySources.map((f) => ({ value: String(f), label: t.fp.copy_floor.replace("{f}", fLbl(f, obj?.fScheme || "tr")) }))} />
          )}
          {plan && <span className="inline-flex items-center gap-1" title={t.fp.zoom_hint}><IconZoomIn size={16} className="text-muted" />{[1, 1.5, 2, 3, 4].map((z) => <button key={z} type="button" onClick={() => setZoom(z)} className={`cursor-pointer rounded-[8px] border px-[9px] py-[6px] text-[12px] font-bold ${zoom === z ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-text-2"}`}>{z * 100}%</button>)}</span>}
          <span className="min-w-[200px] flex-1 text-[12px] text-text-2">{mode === "trace" ? t.fp.hint_trace : t.fp_hint}</span>
          {!syncing && cropBusy.length > 0 && <span className="inline-flex items-center gap-[6px] rounded-[8px] bg-blue-tint px-[9px] py-[4px] text-[11.5px] font-semibold text-blue"><IconLoader2 size={13} className="animate-spin" /> {t.fp.crop_busy}</span>}
        </div>
      )}
      {readOnly && (
        <div className="mb-[14px] flex flex-wrap items-center gap-3 text-[12px] text-muted">
          <span className="flex-1">{t.fp_real_hint}</span>
          {plan && <span className="inline-flex items-center gap-1" title={t.fp.zoom_hint}><IconZoomIn size={15} />{[1, 1.5, 2, 3].map((z) => <button key={z} type="button" onClick={() => setZoom(z)} className={`cursor-pointer rounded-[8px] border px-[8px] py-[4px] text-[11.5px] font-bold ${zoom === z ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-text-2"}`}>{z * 100}%</button>)}</span>}
        </div>
      )}
      {/* лента статусов этажа (как у шахматки): счётчики по выбранному блоку и этажу, клик — подсветить статус на плане */}
      {floor != null && floorUnits.length > 0 && <Legend units={floorUnits} fSt={fSt} onChange={setFSt} stickyTop={legendTop} sticky={false} className="mb-[12px]" />}
      <div className="flex flex-wrap items-start gap-[18px] rounded-[14px] border border-line bg-surface p-[22px] max-md:p-[14px]">
        {sidebar}
        {canvas}
        {side}
      </div>
    </>
  );
}
