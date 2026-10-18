"use client";

import { kbAutoFocus } from "@/lib/touch";
// Мастер «Объект из файлов» (вариант по умолчанию при добавлении объекта; ручной мастер прототипа — `NewObjectWizard`,
// ссылка «Заполнить вручную»). Идея: у застройщика уже есть прайс-лист и планы этажей — объект собирается из них сам,
// человек только проверяет результат.
//   1. Объект   — название, застройщик, валюта
//   2. Прайс    — Excel/CSV разбираются локально (`priceFromAoa`), PDF/скан/фото и «кривые» таблицы — ИИ (`extractPrice`)
//   3. Планы    — PDF (все листы) или картинки; ИИ (`classifyPlanPage`) подсказывает блок и этаж каждого листа, можно поправить
//   4. Сборка   — объект → шахматка (`mkApply`) → планы в Storage → ИИ-разметка квартир → вырезки → типы (левые/правые)
//   5. Проверка — `ObjectIssues`: что требует внимания, с переходом к каждой проблеме
import { IconArrowLeft, IconArrowRight, IconCheck, IconFileSpreadsheet, IconLoader2, IconMap2, IconPencil, IconSparkles, IconTrash, IconWand, IconX } from "@tabler/icons-react";
import { Select } from "@/components/ui/Select";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState } from "react";
import { classifyPlanPage } from "@/app/(dev)/dev/floorplan-actions";
import { extractPrice } from "@/app/(dev)/dev/import-actions";
import { ObjectIssues } from "@/components/dev/object/ObjectIssues";
import { showToast } from "@/components/ui/toast";
import { useEscape, useScrollLock } from "@/hooks/useScrollLock";
import { useDevT } from "@/i18n/dev";
import { aiMarkSheet, copyPlanAreas } from "@/lib/dev/aiMark";
import { CUR_INFO, fLbl, isSpecialType, money, STAGEPCT, typeLabel } from "@/lib/dev/data";
import { fpUnits } from "@/lib/dev/floorplan";
import { mkApply } from "@/lib/dev/grid";
import { basementFloor, blockFloors, evenCuts, groundGapBlocks, groundToFirst, priceFromAi, priceFromAoa, priceFromText, priceQuality, resolveFloors, wingFromFileName, wingSpan, mergePrices, type PageKind, type PlanPage, type Price, type PricePart } from "@/lib/dev/importObject";
import { cropFileX, fileToPayload, imageSize, pdfToPageFiles } from "@/lib/dev/pdfPages";
import { runMirrorSplit, syncAllCrops } from "@/lib/dev/planCrop";
import { buildAutoTypes, syncAutoTypes } from "@/lib/dev/planTypes";
import type { Cur, Project, Unit } from "@/lib/dev/types";
import { readImportFile } from "@/lib/dev/xlsx";
import { uploadFile } from "@/lib/upload";
import { addProject, ensurePlanTypes, getDev, mutPlanTypes, nextProjectId, setFloorPlan, setUnits, updateCompany, updateProject, useDev } from "@/store/dev";
import { DropZone } from "./DropZone";
import { wzMyCompanies, wzSelected } from "./StepInfo";

type Part = PricePart & { src: "local" | "ai" };
type Task = { key: string; label: string; state: "wait" | "run" | "done" | "warn"; note?: string };
const STEPS = ["obj", "price", "plans", "build", "check"] as const;
const input = "w-full rounded-[11px] border border-line bg-[#fbfcfe] px-[14px] py-[13px] text-[15px] outline-none focus:border-blue";
const label = "mb-[7px] block text-[13px] text-text-2";
const fileB64 = (file: File) => new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(String(r.result).split(",")[1] || ""); r.onerror = () => rej(new Error("read")); r.readAsDataURL(file); });

export function ImportWizard() {
  const { t } = useDevT();
  const L = t.imp;
  const router = useRouter();
  const dev = useDev();
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  const [client, setClient] = useState<number | null>(null);
  const [cur, setCur] = useState<Cur>("EUR");
  const [price, setPrice] = useState<Price | null>(null);
  const [priceSrc, setPriceSrc] = useState<"local" | "ai">("local");
  const [priceBusy, setPriceBusy] = useState<"" | "read" | "ai">("");
  const [priceNote, setPriceNote] = useState("");
  const [paste, setPaste] = useState("");
  const [priceProg, setPriceProg] = useState("");
  const lastFiles = useRef<File[]>([]);
  const lastText = useRef("");
  const partsRef = useRef<Part[]>([]);
  const addInp = useRef<HTMLInputElement>(null);
  const [pages, setPages] = useState<PlanPage[]>([]);
  const [rendering, setRendering] = useState(false);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [building, setBuilding] = useState(false);
  const [objId, setObjId] = useState<number | null>(null);
  const close = () => router.push(objId ? `/dev/objects/${objId}` : "/dev/objects");
  useScrollLock(true);
  useEscape(!building, close);

  const my = wzMyCompanies(dev.viewRole, dev.companies);
  const co = wzSelected(dev.viewRole, dev.companies, client);
  const total = price?.total ?? 0;
  const floorsN = price ? new Set(price.blocks.flatMap((b) => b.rows.map((r) => `${b.wing}|${r.floor}`))).size : 0;
  // листы, добавленные до появления поля `wings` (горячая перезагрузка кода посреди мастера), приводим к новому виду
  const pgs: PlanPage[] = pages.map((p) => (Array.isArray(p.wings) && Array.isArray(p.cuts) ? p : { ...p, wings: Array.isArray(p.wings) ? p.wings : [(p as unknown as { wing?: string }).wing ?? ""], cuts: Array.isArray(p.cuts) ? p.cuts : [] }));
  // Подвальные листы, которым в прайсе нет строки: паркинг (или неизвестное содержимое) — этаж из заголовка листа
  // («2. BODRUM» → −2, иначе −1) со служебным помещением «Паркинг»; соцзона без строки «sosyal» — «Соц. зона» на этом этаже.
  // Служебные помещения не продаются, ИИ такие этажи не размечает. Соцзона со строкой в прайсе ложится на её этаж (см. resolveFloors).
  const priceX: Price | null = price ? { ...price, blocks: price.blocks.map((b) => {
    const mine = pgs.filter((pg) => pg.use && pg.kind === "basement" && (pg.wings.includes(b.wing) || price.blocks.length <= 1));
    if (!mine.length) return b;
    const rows = [...b.rows];
    mine.forEach((pg) => {
      const f = basementFloor(pg);
      if (pg.content === "social") { if (!rows.some((r) => r.type === "sosyal")) rows.push({ num: L.social_num, floor: f, type: "sosyal", area: 0, price: 0, status: "na" as const }); }
      else if (!rows.some((r) => r.floor === f)) rows.push({ num: L.parking_num, floor: f, type: "otopark", area: 0, price: 0, status: "na" as const });
    });
    return rows.length === b.rows.length ? b : { ...b, rows };
  }) } : null;
  const resolved = priceX ? resolveFloors(pgs, priceX) : {};
  const usedPages = pgs.filter((p) => p.use && (resolved[p.id]?.length ?? 0) > 0);
  const placeText = (id: string) => (resolved[id] ?? []).map((x) => `${x.wing ? `${t.block} ${x.wing}: ` : ""}${[...x.floors].sort((a, b) => a - b).map((f) => fLbl(f, "tr")).join(", ")}`).join(" · ");

  // ───── прайс ─────
  // ИИ по одному источнику (PDF/скан/фото или текст таблицы); причины отказа — в `notes` с префиксом файла
  const aiOnce = async (src: { file?: File; text?: string }, notes: string[], pre: string): Promise<Price | null> => {
    const f = src.file;
    const res = await extractPrice(
      f && (f.type === "application/pdf" || /\.pdf$/i.test(f.name)) ? { kind: "pdf", data: await fileB64(f) }
        : f && f.type.startsWith("image/") ? { kind: "image", ...(await fileToPayload(f, 2400)) }
          : { kind: "text", text: src.text ?? "" },
    );
    if (!res.ok) { notes.push(pre + (res.reason === "no-key" ? L.p_nokey : res.reason === "too-big" ? L.p_toobig : res.reason === "empty" ? L.p_empty : `${L.p_err}${res.message ? ": " + res.message : ""}`)); return null; }
    if (res.currency) { setCur(res.currency); const n = L.p_cur.replace("{c}", res.currency); if (!notes.includes(n)) notes.push(n); }
    if (res.truncated) notes.push(pre + L.p_trunc);
    return priceFromAi(res.rows);
  };
  // Один файл → прайс: Excel/CSV локально (при плохом качестве — текст таблицы ИИ), PDF/скан/фото — ИИ
  const parseFile = async (f: File, notes: string[], forceAi: boolean, pre: string): Promise<{ price: Price; src: "local" | "ai" } | null> => {
    if (/\.(xlsx?|csv|tsv|txt)$/i.test(f.name)) {
      setPriceBusy("read");
      const aoa = await readImportFile(f);
      const local = priceFromAoa(aoa);
      const text = (aoa || []).map((r) => (r || []).map((c) => String(c ?? "").replace(/[\t\n\r]+/g, " ")).join("\t")).join("\n");
      // таблица понята — берём локальный разбор; иначе отдаём её текст ИИ (другой порядок колонок, шапки, объединённые ячейки)
      if (!forceAi && local.total >= 2 && priceQuality(local) >= 0.6) return { price: local, src: "local" };
      setPriceBusy("ai");
      const ai = await aiOnce({ text }, notes, pre);
      return ai ? { price: ai, src: "ai" } : local.total ? { price: local, src: "local" } : null;
    }
    setPriceBusy("ai");
    const ai = await aiOnce({ file: f }, notes, pre);
    return ai ? { price: ai, src: "ai" } : null;
  };
  // Файлы прайса (можно несколько — по одному на блок): разбираем по очереди и склеиваем (`mergePrices`),
  // буква блока без имени берётся из названия файла. `append` — добавить к уже разобранным, `forceAi` — заново через ИИ.
  const runFiles = async (files: File[], opts: { append?: boolean; forceAi?: boolean } = {}) => {
    if (!files.length) return;
    lastText.current = "";
    const parts: Part[] = opts.append ? [...partsRef.current] : [];
    lastFiles.current = opts.append ? [...lastFiles.current, ...files] : files;
    setPrice(null); setPriceNote(""); setPriceProg("");
    const notes: string[] = [];
    const many = files.length > 1 || parts.length > 0;
    try {
      for (let i = 0; i < files.length; i++) {
        const f = files[i];
        if (many) setPriceProg(L.p_file_of.replace("{i}", String(i + 1)).replace("{n}", String(files.length)).replace("{name}", f.name));
        const r = await parseFile(f, notes, !!opts.forceAi, many ? `${f.name}: ` : "");
        if (r) parts.push({ ...r, hint: wingFromFileName(f.name), name: f.name });
      }
      partsRef.current = parts;
      if (parts.length) {
        const { price: merged, renamed } = mergePrices(parts);
        renamed.forEach((r) => notes.push((r.from ? L.p_wing_renamed.replace("{from}", r.from) : L.p_wing_name).replace("{to}", r.to).replace("{name}", r.name)));
        setPrice(merged); setPriceSrc(parts.some((x) => x.src === "ai") ? "ai" : "local");
      }
      setPriceNote(notes.join(" "));
    } catch (e) { setPriceNote(`${L.p_err}${e instanceof Error && e.message ? ": " + e.message : ""}`); }
    finally { setPriceBusy(""); setPriceProg(""); }
  };
  const onPriceFile = (files: File[]) => void runFiles(files);
  const onAddFiles = (files: File[]) => void runFiles(files, { append: true });
  const resetPrice = () => { setPrice(null); setPriceNote(""); partsRef.current = []; lastFiles.current = []; lastText.current = ""; };
  // вставка из Excel — табличный текст: разбираем как таблицу (с колонкой блока), иначе как свободный текст; плохое качество — ИИ
  const runText = async (text: string, forceAi: boolean) => {
    partsRef.current = []; lastFiles.current = []; lastText.current = text;
    setPrice(null); setPriceNote("");
    const local = text.includes("\t") ? priceFromAoa(text.split(/\n+/).map((ln) => ln.split("\t"))) : priceFromText(text);
    if (!forceAi && local.total >= 2 && priceQuality(local) >= 0.6) { setPrice(local); setPriceSrc("local"); return; }
    const notes: string[] = [];
    setPriceBusy("ai");
    try {
      const ai = await aiOnce({ text }, notes, "");
      if (ai) { setPrice(ai); setPriceSrc("ai"); } else if (local.total) { setPrice(local); setPriceSrc("local"); }
      setPriceNote(notes.join(" "));
    } catch (e) { setPriceNote(`${L.p_err}${e instanceof Error && e.message ? ": " + e.message : ""}`); }
    finally { setPriceBusy(""); }
  };
  const onPaste = () => { const text = paste.trim(); if (text) void runText(text, false); };
  const retryAi = () => { if (lastFiles.current.length) void runFiles(lastFiles.current, { forceAi: true }); else if (lastText.current) void runText(lastText.current, true); };

  // ───── планы ─────
  const patchPage = (id: string, p: Partial<PlanPage>) => setPages((list) => list.map((x) => (x.id === id ? { ...x, ...p } : x)));
  const wings = price?.blocks.map((b) => b.wing) ?? [];
  const onPlanFiles = async (files: File[]) => {
    setRendering(true);
    const fresh: PlanPage[] = [];
    try {
      for (const f of files) {
        const isPdf = f.type === "application/pdf" || /\.pdf$/i.test(f.name);
        if (!isPdf && !f.type.startsWith("image/")) continue;
        const imgs = isPdf ? await pdfToPageFiles(f) : [f];
        for (const img of imgs) {
          const { w, h } = await imageSize(img);
          fresh.push({ id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, name: img.name, file: img, thumb: URL.createObjectURL(img), w, h, wings: wings.length ? [...wings] : [""], kind: "typical", floors: [], title: "", busy: true, use: true, cuts: evenCuts(wings.length || 1) });
        }
      }
    } catch { showToast(t.fp.pdf_hint, 3600); }
    setRendering(false);
    if (!fresh.length) return;
    setPages((list) => [...list, ...fresh]);
    // ИИ подсказывает блок и этаж по штампу листа — по одному, чтобы не упереться в лимиты
    for (const p of fresh) {
      try {
        const res = await classifyPlanPage(await fileToPayload(p.file, 1600));
        if (res.ok) {
          // блоки листа: названные на нём; если блок не назван, а в прайсе блоков несколько — лист показывает здание целиком (все блоки)
          const named = res.blocks.filter((b) => wings.includes(b));
          const pw = wings.length <= 1 ? [wings[0] ?? ""] : named.length ? named : [...wings];
          patchPage(p.id, { busy: false, wings: pw, cuts: evenCuts(pw.length), kind: res.kind, floors: res.floors, title: res.title, content: res.content, use: res.kind !== "other" });
        } else patchPage(p.id, { busy: false });
      } catch { patchPage(p.id, { busy: false }); }
    }
  };
  const removePage = (id: string) => setPages((list) => { const p = list.find((x) => x.id === id); if (p) URL.revokeObjectURL(p.thumb); return list.filter((x) => x.id !== id); });

  // ───── сборка ─────
  const build = async () => {
    if (!price || !co || building) return;
    setBuilding(true);
    const list: Task[] = [
      { key: "create", label: L.b_create, state: "run" },
      { key: "grid", label: L.b_grid.replace("{n}", String(price.total)), state: "wait" },
      ...(usedPages.length ? [
        { key: "upload", label: L.b_upload.replace("{i}", "0").replace("{n}", String(usedPages.length)), state: "wait" as const },
        { key: "ai", label: L.b_ai.replace("{i}", "0").replace("{n}", String(usedPages.length)), state: "wait" as const },
        { key: "crop", label: L.b_crop.replace("{i}", "0").replace("{n}", "…"), state: "wait" as const },
      ] : []),
      { key: "types", label: L.b_types, state: "wait" },
    ];
    setTasks(list);
    const upd = (key: string, p: Partial<Task>) => setTasks((ts) => ts.map((x) => (x.key === key ? { ...x, ...p } : x)));
    try {
      // 1) объект
      const id = nextProjectId();
      const p: Project = { id, name: name.trim(), loc: "", stage: "project", ready: STAGEPCT.project ?? 0, iskan: false, salesSt: "open", occSt: "none", client: co.name, tags: [], cover: "", photos: [], files: [], cur, pricesIn: cur, genGrid: false };
      addProject(p, []);
      updateCompany(co.id, { objIds: [...co.objIds, id] });
      setObjId(id);
      upd("create", { state: "done" }); upd("grid", { state: "run" });
      // 2) шахматка
      let units: Unit[] = [];
      let patch = {};
      (priceX ?? price).blocks.forEach((b) => { const r = mkApply(units, { ...p, ...patch }, b.rows, "apt", b.wing, false, false); if (r) { units = r.units; patch = { ...patch, ...r.patch }; } });
      // номера из прайса — источник истины: помечаем как заданные вручную, автонумерация шахматки их не трогает
      setUnits(id, units.map((u) => ({ ...u, numManual: true })));
      if (Object.keys(patch).length) updateProject(id, patch);
      upd("grid", { state: "done" });
      // 3) планы → Storage → этажи
      if (usedPages.length) {
        upd("upload", { state: "run" });
        const placed: { places: { wing: string; floors: number[] }[] }[] = [];
        for (let i = 0; i < usedPages.length; i++) {
          const pg = usedPages[i];
          upd("upload", { label: L.b_upload.replace("{i}", String(i + 1)).replace("{n}", String(usedPages.length)) });
          try {
            const places = resolved[pg.id].map((x) => ({ wing: x.wing, floors: [...x.floors].sort((a, b) => a - b) }));
            if (pg.wings.length > 1) {
              // лист на несколько блоков режется по границам: каждому блоку — своя часть листа (крупнее, без чужих квартир)
              for (const x of places) {
                const [x0, x1] = wingSpan(pg, pg.wings.indexOf(x.wing));
                const part = await cropFileX(pg.file, x0, x1, x.wing || "all");
                const { w, h } = await imageSize(part);
                const up = await uploadFile(part, `dev/${id}/floorplans`);
                x.floors.forEach((f) => setFloorPlan(id, `${x.wing || ""}|${f}`, { img: up.url, w, h }));
              }
            } else {
              const up = await uploadFile(pg.file, `dev/${id}/floorplans`);
              places.forEach((x) => x.floors.forEach((f) => setFloorPlan(id, `${x.wing || ""}|${f}`, { img: up.url, w: pg.w, h: pg.h })));
            }
            placed.push({ places });
          } catch (e) { upd("upload", { note: e instanceof Error ? e.message : "" }); }
        }
        upd("upload", { state: placed.length === usedPages.length ? "done" : "warn" });
        // 4) ИИ-разметка: один раз на лист (первый этаж с квартирами), на остальные этажи листа контуры копируются
        upd("ai", { state: "run" });
        // листы размечаются параллельно (до 4 сразу): один лист — 2–3 минуты, подряд это было бы слишком долго
        let aiOff = "", found = 0, of = 0, fin = 0;
        upd("ai", { label: L.b_ai.replace("{i}", "0").replace("{n}", String(placed.length)), note: L.b_ai_wait });
        const markOne = async (pl: { places: { wing: string; floors: number[] }[] }) => {
          const us = getDev().units[id] ?? [];
          // лист размечается один раз — на первом этаже, где есть квартиры (по всем его блокам сразу), на остальные этажи контуры копируются
          const allFloors = [...new Set(pl.places.flatMap((x) => x.floors))].sort((a, b) => a - b);
          const f0 = allFloors.find((f) => pl.places.some((x) => x.floors.includes(f) && fpUnits(us, x.wing, f).some((u) => !isSpecialType(u.type)))); // паркинг/соцзону ИИ не размечает
          if (f0 != null && !aiOff) {
            // у каждого блока своя картинка (часть листа) — размечаем блоки по отдельности
            for (const x of pl.places.filter((x) => x.floors.includes(f0))) {
              if (aiOff) break;
              const res = await aiMarkSheet(id, [x.wing], f0).catch((e): { ok: false; reason: string } => ({ ok: false, reason: e instanceof Error ? e.message : "error" }));
              if (!res.ok) { if (["no-key", "no-session"].includes(res.reason)) aiOff = res.reason; continue; }
              found += res.found; of += res.of;
              x.floors.filter((f) => f !== f0).forEach((f) => { const n = copyPlanAreas(id, x.wing, f0, f); found += n; of += fpUnits(us, x.wing, f).length; });
            }
          }
          fin++;
          upd("ai", { label: L.b_ai.replace("{i}", String(fin)).replace("{n}", String(placed.length)) });
        };
        const queue = [...placed];
        await Promise.all(Array.from({ length: Math.min(4, queue.length) }, async () => { for (let pl = queue.shift(); pl; pl = queue.shift()) await markOne(pl); }));
        upd("ai", aiOff ? { state: "warn", note: L.b_ai_skip.replace("{r}", aiOff) } : { state: found < of ? "warn" : "done", note: L.b_ai_part.replace("{a}", String(found)).replace("{b}", String(of)) });
        // 5) вырезки планировок
        upd("crop", { state: "run" });
        const keys = Object.entries(getDev().projects.find((x) => x.id === id)?.floorPlans ?? {}).filter(([, v]) => v.areas.length > 0).map(([k]) => k);
        const all = keys.reduce((s, k) => s + (getDev().projects.find((x) => x.id === id)?.floorPlans?.[k]?.areas.length ?? 0), 0);
        let done = 0, errs = 0;
        for (const k of keys) {
          const base = done;
          const r = await syncAllCrops(id, k, (i) => upd("crop", { label: L.b_crop.replace("{i}", String(base + i)).replace("{n}", String(all)) }));
          done += getDev().projects.find((x) => x.id === id)?.floorPlans?.[k]?.areas.length ?? 0;
          errs += r.errors.length;
        }
        upd("crop", { state: errs ? "warn" : "done", label: L.b_crop.replace("{i}", String(all - errs)).replace("{n}", String(all)) });
      }
      // 6) типы планировок (+ левые/правые по контурам)
      upd("types", { state: "run" });
      ensurePlanTypes(id, buildAutoTypes);
      mutPlanTypes(id, (l) => syncAutoTypes(l, getDev().units[id] ?? []));
      runMirrorSplit(id);
      upd("types", { state: "done" });
      setStep(4);
    } catch (e) {
      showToast(`${L.b_fail}${e instanceof Error && e.message ? ": " + e.message : ""}`, 5000);
    } finally { setBuilding(false); }
  };

  const next = () => {
    if (step === 0) { if (!name.trim()) { showToast(L.need_name); return; } if (!co) { showToast(L.need_co); return; } }
    if (step === 1 && !price?.total) { showToast(L.p_need); return; }
    setStep((s) => Math.min(STEPS.length - 1, s + 1));
  };
  const stepLabel = [L.s_obj, L.s_price, L.s_plans, L.s_build, L.s_check];
  const kinds: [PageKind, string][] = [["typical", L.f_typical], ["ground", L.f_ground], ["basement", L.f_basement], ["floor", L.f_floor], ["attic", L.f_attic], ["other", L.f_other]];
  const btn = "cursor-pointer rounded-[11px] border px-[18px] py-3 text-[14px] font-semibold";
  const preview = price ? price.blocks.flatMap((b) => b.rows.map((r) => ({ ...r, wing: b.wing }))) : [];
  const blank = preview.filter((r) => !r.type).length, noPrice = preview.filter((r) => r.status === "free" && !r.price && !["sosyal", "otopark", "teknik"].includes(r.type)).length;
  const locked = building || objId != null; // после сборки назад не возвращаемся — объект уже создан

  return (
    <div className="fixed inset-0 z-[121] flex flex-col bg-bg" style={{ animation: "opl-bg .2s ease" }}>
      <div className="flex flex-none flex-wrap items-center gap-4 border-b border-line bg-surface px-[clamp(16px,4vw,32px)] py-[14px]">
        <div className="flex min-w-[200px] flex-1 items-center gap-[10px]">
          <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] bg-blue text-white"><IconWand size={20} /></div>
          <div className="min-w-0">
            <div className="text-[18px] font-extrabold leading-[1.1] text-ink">{L.title}</div>
            <div className="mt-[3px] text-[12px] text-text-2">{L.sub}</div>
          </div>
        </div>
        {!locked && <Link href="/dev/objects/new?manual=1" className="inline-flex flex-none items-center gap-[6px] whitespace-nowrap rounded-[10px] border border-line bg-surface px-[12px] py-[8px] text-[13px] font-semibold text-ink-2 hover:border-blue hover:text-blue"><IconPencil size={15} /> {L.manual}</Link>}
        <button type="button" disabled={building} onClick={close} className="h-[38px] w-[38px] flex-none cursor-pointer rounded-[10px] border border-line bg-surface text-[20px] text-muted hover:bg-[#f5f6f9] disabled:opacity-50">&times;</button>
      </div>
      {/* шаги */}
      <div className="flex flex-none items-center gap-[6px] overflow-x-auto border-b border-line bg-surface px-[clamp(16px,4vw,32px)] py-[10px]">
        {stepLabel.map((s, i) => (
          <span key={s} className="flex flex-none items-center gap-[6px]">
            <span className={`flex h-[24px] w-[24px] items-center justify-center rounded-full text-[12px] font-bold ${i < step ? "bg-green text-white" : i === step ? "bg-blue text-white" : "bg-[#eef0f4] text-muted"}`}>{i < step ? <IconCheck size={14} /> : i + 1}</span>
            <span className={`whitespace-nowrap text-[13px] ${i === step ? "font-bold text-ink" : "text-text-2"}`}>{s}</span>
            {i < stepLabel.length - 1 && <span className="mx-[6px] h-px w-[28px] bg-line max-md:w-[12px]" />}
          </span>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[920px] px-[clamp(16px,4vw,32px)] py-[clamp(18px,3vw,30px)]">
          {step === 0 && (
            <div className="flex flex-col gap-[18px]">
              <div><label className={label}>{L.name_lbl}</label><input autoFocus={kbAutoFocus()} value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") next(); }} placeholder={L.name_ph} className={input} /></div>
              {(dev.viewRole === "superadmin" || my.length > 1) && (
                <div><label className={label}>{L.co_lbl}</label>
                  <Select value={String(co?.id ?? "")} onChange={(v) => setClient(v ? +v : null)} options={[{ value: "", label: "—" }, ...my.map((c) => ({ value: String(c.id), label: c.name }))]} />
                </div>
              )}
              <div><label className={label}>{L.cur_lbl}</label>
                <div className="flex gap-2">{(["EUR", "USD", "TRY"] as Cur[]).map((c) => <button key={c} type="button" onClick={() => setCur(c)} className={`cursor-pointer rounded-[10px] border px-[18px] py-[10px] text-[14px] font-bold ${cur === c ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-text-2"}`}>{c} {CUR_INFO[c].sym}</button>)}</div>
              </div>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-[16px]">
              {!price && !priceBusy && (
                <>
                  <DropZone icon={<IconFileSpreadsheet size={24} />} title={L.p_drop} sub={`${L.p_drop_sub}. ${L.p_replace_sub}`} accept=".xlsx,.xls,.csv,.tsv,.txt,.pdf,image/*" count={0} onFiles={onPriceFile} />
                  <div><label className={label}>{L.p_paste}</label>
                    <textarea value={paste} onChange={(e) => setPaste(e.target.value)} placeholder={L.p_paste_ph} rows={4} className={`${input} resize-y font-mono text-[13px]`} />
                    {paste.trim() && <button type="button" onClick={onPaste} className="mt-2 cursor-pointer rounded-[10px] border border-ink bg-ink px-4 py-[9px] text-[13px] font-semibold text-white">{L.p_paste_btn}</button>}
                  </div>
                </>
              )}
              {priceBusy && <div className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-5 py-6 text-[14px] font-semibold text-ink"><IconLoader2 size={20} className="animate-spin text-blue" /> <span className="flex-1">{priceBusy === "ai" ? L.p_ai : L.p_reading}{priceProg && <span className="mt-1 block text-[12.5px] font-normal text-text-2">{priceProg}</span>}</span></div>}
              {priceNote && <div className="rounded-[12px] border border-[#f3d9a4] bg-[#fffaf0] px-4 py-3 text-[13px] text-[#8a5a00]">{priceNote}</div>}
              {price && !priceBusy && (
                <>
                  <div className="flex flex-wrap items-center gap-[10px] rounded-[14px] border border-[#cdeedd] bg-[#eefaf3] px-[18px] py-[14px]">
                    <IconCheck size={20} className="flex-none text-green" />
                    <span className="flex-1 text-[14px] font-bold text-ink">{L.p_found.replace("{n}", String(total)).replace("{b}", price.blocks.length > 1 || price.blocks[0]?.wing ? price.blocks.map((b) => b.wing).join(", ") : L.p_no_block).replace("{f}", String(floorsN))}
                      <span className="ml-2 inline-flex items-center gap-1 rounded-[20px] bg-surface px-2 py-[2px] text-[11px] font-semibold text-text-2">{priceSrc === "ai" && <IconSparkles size={12} />}{priceSrc === "ai" ? L.p_src_ai : L.p_src_local}</span>
                    </span>
                    {priceSrc === "local" && <button type="button" onClick={retryAi} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[9px] border border-blue bg-blue-tint px-3 py-[7px] text-[12px] font-bold text-[#3a63d4]"><IconSparkles size={14} /> {L.p_retry_ai}</button>}
                    <button type="button" onClick={() => addInp.current?.click()} className="cursor-pointer rounded-[9px] border border-line bg-surface px-3 py-[7px] text-[12px] font-semibold text-ink-2">{L.p_add}</button>
                    <button type="button" onClick={resetPrice} className="cursor-pointer rounded-[9px] border border-line bg-surface px-3 py-[7px] text-[12px] font-semibold text-ink-2">{L.p_replace}</button>
                    <input ref={addInp} type="file" multiple accept=".xlsx,.xls,.csv,.tsv,.txt,.pdf,image/*" className="hidden" onChange={(e) => { const fs = Array.from(e.target.files ?? []); e.target.value = ""; onAddFiles(fs); }} />
                  </div>
                  {/* этажи по блокам — чтобы сразу было видно, как распознан прайс */}
                  <div className="text-[12.5px] text-text-2">{price.blocks.map((b) => `${b.wing ? `${t.block} ${b.wing}: ` : ""}${L.p_floors} ${[...blockFloors(b)].sort((x, y) => x - y).map((f) => fLbl(f, "tr")).join(", ")}`).join(" · ")}</div>
                  {groundGapBlocks(price).length > 0 && (
                    <div className="flex flex-wrap items-center gap-[10px] rounded-[12px] border border-[#f3d9a4] bg-[#fffaf0] px-4 py-3 text-[13px] text-[#8a5a00]">
                      <span className="min-w-[220px] flex-1">{L.p_gap}</span>
                      <button type="button" onClick={() => setPrice(groundToFirst(price))} className="cursor-pointer whitespace-nowrap rounded-[9px] border border-[#e0b65c] bg-surface px-3 py-[7px] text-[12.5px] font-bold text-[#8a5a00] hover:bg-[#fff3d6]">{L.p_gap_fix}</button>
                    </div>
                  )}
                  {(blank > 0 || noPrice > 0) && <div className="text-[12.5px] text-[#8a5a00]">{[blank > 0 ? L.p_blank.replace("{n}", String(blank)) : "", noPrice > 0 ? L.p_noprice.replace("{n}", String(noPrice)) : ""].filter(Boolean).join(" · ")}</div>}
                  <div className="overflow-x-auto rounded-[14px] border border-line bg-surface">
                    <table className="w-full min-w-[560px] border-separate border-spacing-0 text-[13px]">
                      <thead><tr>{[...(price.blocks.length > 1 ? [L.c_block] : []), L.c_num, L.c_floor, L.c_type, L.c_area, L.c_price, L.c_status].map((h) => <th key={h} className="border-b border-line bg-[#fafbfd] px-3 py-[9px] text-left text-[12px] font-semibold text-text-2">{h}</th>)}</tr></thead>
                      <tbody>
                        {preview.slice(0, 12).map((r, i) => (
                          <tr key={i}>
                            {price.blocks.length > 1 && <td className="border-b border-line px-3 py-[8px]">{r.wing}</td>}
                            <td className="border-b border-line px-3 py-[8px] font-bold text-ink">{r.num}</td>
                            <td className="whitespace-nowrap border-b border-line px-3 py-[8px]">{fLbl(r.floor, "tr")}{r.band ? <span className="ml-[6px] text-[11.5px] text-text-2">{r.band === "ins" ? t.board.band_ins : t.board.band_out}</span> : null}</td>
                            <td className="border-b border-line px-3 py-[8px]">{typeLabel(r.type, t, "—")}</td>
                            <td className="border-b border-line px-3 py-[8px]">{r.area || "—"}</td>
                            <td className="whitespace-nowrap border-b border-line px-3 py-[8px]">{r.price ? money(r.price, cur) : "—"}</td>
                            <td className="border-b border-line px-3 py-[8px]">{t.status[r.status]}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                    {preview.length > 12 && <div className="px-3 py-[9px] text-[12px] text-muted">{L.p_more.replace("{n}", String(preview.length - 12))}</div>}
                  </div>
                </>
              )}
            </div>
          )}

          {step === 2 && (
            <div className="flex flex-col gap-[14px]">
              <DropZone icon={<IconMap2 size={24} />} title={L.f_drop} sub={L.f_drop_sub} accept=".pdf,image/*" count={0} onFiles={onPlanFiles} />
              {rendering && <div className="flex items-center gap-2 text-[13px] font-semibold text-blue"><IconLoader2 size={16} className="animate-spin" /> {L.f_render}</div>}
              {!pages.length && !rendering && <div className="text-[13px] text-text-2">{L.f_skip}</div>}
              {pages.length > 0 && <div className="text-[13px] font-semibold text-ink">{L.f_count.replace("{n}", String(pages.length)).replace("{u}", String(usedPages.length))}</div>}
              {pgs.map((p) => {
                const fl = resolved[p.id] ?? [];
                // этажи для выбора — объединение этажей выбранных блоков листа
                const pageFloors = [...new Set((price?.blocks ?? []).filter((x) => p.wings.includes(x.wing) || (price?.blocks.length ?? 0) <= 1).flatMap(blockFloors))].sort((x, y) => y - x);
                return (
                  <div key={p.id} className={`flex flex-wrap gap-[14px] rounded-[14px] border bg-surface p-[12px] ${p.use && fl.length ? "border-line" : "border-dashed border-[#d5dae2]"}`}>
                    <div className="flex flex-none flex-col gap-[6px]">
                      <div className="relative h-[110px] w-[160px] overflow-hidden rounded-[9px] border border-line bg-white">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.thumb} alt="" className="h-full w-full object-contain" />
                        {p.wings.length > 1 && p.wings.map((w, i) => { const [x0, x1] = wingSpan(p, i); return <span key={w} className="pointer-events-none absolute top-0 flex h-full items-end justify-center border-l-2 border-dashed border-blue/70 bg-blue/10 pb-[3px] text-[11px] font-extrabold text-blue first:border-l-0" style={{ left: `${x0 * 100}%`, width: `${(x1 - x0) * 100}%` }}>{w}</span>; })}
                      </div>
                      {p.wings.length > 1 && (
                        <div className="flex flex-col gap-[2px]" title={L.f_cut_hint}>
                          {p.wings.slice(0, -1).map((w, i) => (
                            <input key={w} type="range" min={5} max={95} value={Math.round((p.cuts[i] ?? evenCuts(p.wings.length)[i]) * 100)} onChange={(e) => { const cuts = p.cuts.length === p.wings.length - 1 ? [...p.cuts] : evenCuts(p.wings.length); cuts[i] = +e.target.value / 100; patchPage(p.id, { cuts: cuts.map((c, j) => (j < i ? Math.min(c, cuts[i] - 0.03) : j > i ? Math.max(c, cuts[i] + 0.03) : c)) }); }} className="w-[160px] cursor-pointer accent-[#4d7cfe]" />
                          ))}
                          <span className="text-[10.5px] text-muted">{L.f_cut}</span>
                        </div>
                      )}
                    </div>
                    <div className="flex min-w-[240px] flex-1 flex-col gap-[8px]">
                      <div className="flex items-center gap-2">
                        <span className="min-w-0 flex-1 truncate text-[13.5px] font-bold text-ink">{p.title || p.name}</span>
                        {p.busy && <span className="inline-flex items-center gap-1 text-[12px] text-blue"><IconLoader2 size={13} className="animate-spin" /> {L.f_class}</span>}
                        <button type="button" title={L.f_remove} onClick={() => removePage(p.id)} className="flex h-[28px] w-[28px] flex-none cursor-pointer items-center justify-center rounded-[8px] border border-line bg-surface text-muted hover:border-red hover:text-red"><IconTrash size={14} /></button>
                      </div>
                      <div className="flex flex-wrap items-center gap-[8px]">
                        {wings.length > 1 && (
                          <span className="inline-flex items-center gap-[5px]" title={L.f_blocks_hint}>
                            {wings.map((w) => { const on = p.wings.includes(w); return <button key={w} type="button" onClick={() => { const nw = on ? p.wings.filter((x) => x !== w) : [...p.wings, w].sort(); if (nw.length) patchPage(p.id, { wings: nw, cuts: evenCuts(nw.length) }); }} className={`cursor-pointer rounded-[9px] border px-[11px] py-[7px] text-[13px] font-bold ${on ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-text-2"}`}>{t.block} {w}</button>; })}
                          </span>
                        )}
                        <Select value={p.use ? p.kind : "other"} size="sm" menuWidth="auto" onChange={(v) => { const k = v as PageKind; patchPage(p.id, { kind: k, use: k !== "other" }); }} className="w-auto rounded-[9px] bg-[#fbfcfe] px-[10px] py-[7px] text-[13px] font-semibold" options={kinds.map(([k, lb]) => ({ value: k, label: lb }))} />
                      </div>
                      {p.use && p.kind === "floor" && pageFloors.length > 0 && (
                        <div className="flex flex-wrap gap-[5px]">{pageFloors.map((f) => { const on = p.floors.includes(f); return <span key={f} onClick={() => patchPage(p.id, { floors: on ? p.floors.filter((x) => x !== f) : [...p.floors, f] })} className={`cursor-pointer rounded-[8px] border px-[10px] py-[5px] text-[12px] font-bold ${on ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-text-2"}`}>{fLbl(f, "tr")}</span>; })}</div>
                      )}
                      <div className={`text-[12.5px] ${p.use && fl.length ? "text-green" : "text-[#8a5a00]"}`}>{p.kind === "attic" ? (fl.length ? L.f_attic_res.replace("{f}", placeText(p.id)) : L.f_attic_hint) : p.use && fl.length ? L.f_res.replace("{f}", placeText(p.id)) : p.use && p.kind === "floor" && p.floors.length ? L.f_nofloor.replace("{f}", p.floors.map((f) => fLbl(f, "tr")).join(", ")) : L.f_none}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {step === 3 && (
            <div className="flex flex-col gap-[16px]">
              {!tasks.length && <div className="rounded-[14px] border border-line bg-surface px-[20px] py-[18px] text-[14px] text-ink">{L.b_hint.replace("{name}", name.trim()).replace("{n}", String(total)).replace("{p}", String(usedPages.length))}</div>}
              {tasks.length > 0 && (
                <div className="flex flex-col gap-[2px] rounded-[14px] border border-line bg-surface px-[18px] py-[12px]">
                  {tasks.map((k) => (
                    <div key={k.key} className="flex items-center gap-[10px] py-[8px]">
                      <span className="flex h-[24px] w-[24px] flex-none items-center justify-center">
                        {k.state === "run" ? <IconLoader2 size={18} className="animate-spin text-blue" /> : k.state === "done" ? <IconCheck size={18} className="text-green" /> : k.state === "warn" ? <IconX size={18} className="text-[#b45309]" /> : <span className="h-[8px] w-[8px] rounded-full bg-[#d5dae2]" />}
                      </span>
                      <span className={`text-[14px] ${k.state === "wait" ? "text-muted" : "font-semibold text-ink"}`}>{k.label}</span>
                      {k.note && <span className="text-[12.5px] text-text-2">· {k.note}</span>}
                    </div>
                  ))}
                </div>
              )}
              {!building && objId == null && <button type="button" onClick={build} className="inline-flex cursor-pointer items-center justify-center gap-[8px] self-start rounded-[12px] border border-green bg-green px-[26px] py-[14px] text-[15px] font-bold text-white hover:bg-[#0c8a5e]"><IconWand size={18} /> {L.b_start}</button>}
            </div>
          )}

          {step === 4 && objId != null && (
            <div className="flex flex-col gap-[16px]">
              <div className="flex items-center gap-[10px] text-[20px] font-extrabold text-ink"><IconCheck size={24} className="text-green" /> {L.b_done}: {name.trim()}</div>
              <ObjectIssues objId={objId} showOk defaultOpen />
              {usedPages.length > 0 && <div className="text-[13px] text-text-2">{L.k_hint}</div>}
              <div className="flex flex-wrap gap-[10px]">
                <Link href={`/dev/objects/${objId}/plans`} className="inline-flex items-center gap-[7px] rounded-[11px] border border-blue bg-blue px-[22px] py-3 text-[14px] font-bold text-white hover:bg-[#3a63d4]">{L.k_board} <IconArrowRight size={16} /></Link>
                <Link href={`/dev/objects/${objId}`} className="inline-flex items-center gap-[7px] rounded-[11px] border border-line bg-surface px-[22px] py-3 text-[14px] font-semibold text-ink hover:bg-[#f5f6f9]">{L.k_open}</Link>
              </div>
            </div>
          )}
        </div>
      </div>

      {step < 3 && (
        <div className="flex flex-none items-center gap-3 border-t border-line bg-surface px-[clamp(16px,4vw,32px)] py-[14px]">
          <button type="button" onClick={close} className={`${btn} border-line bg-surface text-text-2`}>{t.wz.cancel}</button>
          <div className="flex-1" />
          {step > 0 && <button type="button" onClick={() => setStep((s) => Math.max(0, s - 1))} className={`${btn} inline-flex items-center gap-[7px] border-line bg-surface text-ink hover:bg-[#f5f6f9]`}><IconArrowLeft size={16} /> {t.wz.back}</button>}
          <button type="button" disabled={!!priceBusy || rendering || pages.some((p) => p.busy)} onClick={next} className="inline-flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[11px] border border-blue bg-blue px-[22px] py-3 text-[14px] font-bold text-white hover:bg-[#3a63d4] disabled:cursor-default disabled:opacity-60">{t.wz.next} <IconArrowRight size={16} /></button>
        </div>
      )}
      {step === 3 && !building && objId == null && (
        <div className="flex flex-none items-center gap-3 border-t border-line bg-surface px-[clamp(16px,4vw,32px)] py-[14px]">
          <button type="button" onClick={() => setStep(2)} className={`${btn} inline-flex items-center gap-[7px] border-line bg-surface text-ink hover:bg-[#f5f6f9]`}><IconArrowLeft size={16} /> {t.wz.back}</button>
        </div>
      )}
    </div>
  );
}
