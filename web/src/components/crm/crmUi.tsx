"use client";

// Общее для экранов CRM: контекст (ws, доступ, этапы, источники, базовый путь кабинета), стили, форматирование.
import { SEMT2ILCE, ilName, ilceName, semtName } from "@/lib/seed";
import { createContext, useContext, useSyncExternalStore } from "react";
import type { Dict, Lang } from "@/i18n";
import type { CrmMe, Source, Stage, TaskKind } from "@/lib/crm/types";

export type CrmTab = { id: string; name: string };
export type CrmCtxT = { me: CrmMe; stages: Stage[]; cstages: Stage[]; sources: Source[]; base: string; refresh: () => void; setStages: (s: Stage[]) => void; setCstages: (s: Stage[]) => void; setSources: (s: Source[]) => void;
  /** вкладки открытых карточек (как в браузере): регистрирует ClientPage, закрывает крестик/удаление */
  openTab?: (id: string, name: string) => void; closeTab?: (id: string) => void;
  /** один поиск в шапке CRM (12.10.2026): на списке клиентов фильтрует живьём, на других разделах Enter ведёт в список */
  q: string; setQ: (v: string) => void;
  /** счётчики бокового меню: страницы, которые их уже получили, обновляют без отдельного вызова */
  setCounts?: (c: { clients: number; deals: number; tasks: number }) => void };

// кэш загруженных списков на время сессии: возврат к разделу рисует прошлые данные сразу, обновление — фоном
const memCache = new Map<string, unknown>();
export const cacheGet = <T,>(key: string): T | undefined => memCache.get(key) as T | undefined;
export const cacheSet = <T,>(key: string, v: T): T => { memCache.set(key, v); return v; };
// запрос в полёте: второй потребитель того же ключа ждёт тот же промис, а не шлёт свой (серверные экшены Next идут по очереди)
const pending = new Map<string, Promise<unknown>>();
export const cachePending = <T,>(key: string): Promise<T> | undefined => pending.get(key) as Promise<T> | undefined;
export function cacheRun<T>(key: string, factory: () => Promise<T>): Promise<T> { const cur = pending.get(key) as Promise<T> | undefined; if (cur) return cur; const p = factory().finally(() => { if (pending.get(key) === p) pending.delete(key); }); pending.set(key, p); return p; }
export const CrmCtx = createContext<CrmCtxT | null>(null);
export function useCrm(): CrmCtxT { const c = useContext(CrmCtx); if (!c) throw new Error("CrmCtx"); return c; }

export const inp = "h-8 w-full rounded-[6px] border border-line bg-surface px-[10px] text-[13px] text-ink outline-none focus:border-blue focus:ring-2 focus:ring-blue/15";
export const lbl = "mb-[4px] block text-[11px] font-semibold uppercase tracking-[.05em] text-muted";
export const card = "rounded-[6px] border border-line bg-surface p-4";
export const btnP = "inline-flex h-8 cursor-pointer items-center gap-[6px] rounded-[6px] bg-blue-2 px-3 text-[13px] font-semibold text-white hover:bg-blue-3 disabled:cursor-default disabled:opacity-50";
export const btnS = "inline-flex h-8 cursor-pointer items-center gap-[6px] rounded-[6px] border border-line bg-surface px-3 text-[13px] font-semibold text-ink hover:bg-bg-3 disabled:cursor-default disabled:opacity-50";
export const btnD = "inline-flex h-8 cursor-pointer items-center gap-[6px] rounded-[6px] px-3 text-[13px] font-semibold text-red hover:bg-red-tint";
export const chip = "inline-flex items-center rounded-[4px] border border-line bg-bg-2 px-[6px] py-[1px] text-[11px] font-medium text-text-2";

/** Имя этапа: своё (name[lang]) → i18n по ключу → ключ. */
export function stageName(st: Stage | undefined | null, t: Dict, lang: Lang): string {
  if (!st) return t.crm.deal.noStage;
  const own = st.name?.[lang] || st.name?.RU || st.name?.EN || st.name?.TR;
  if (own) return own;
  const dict = t.crm.stages as Record<string, string>;
  return dict[st.key] ?? st.key;
}
/** Имя источника: ключ по умолчанию → i18n, иначе как ввёл пользователь. */
export function sourceName(src: Source | undefined | null, t: Dict): string {
  if (!src) return t.crm.noSource;
  const dict = t.crm.sources as Record<string, string>;
  return dict[src.name] ?? src.name;
}
export const taskKindName = (k: TaskKind, t: Dict) => (t.crm.task.kinds as Record<string, string>)[k] ?? k;

const LOC: Record<Lang, string> = { RU: "ru-RU", EN: "en-GB", TR: "tr-TR" };
export const fmtDate = (iso: string | null | undefined, lang: Lang) => (iso ? new Date(iso).toLocaleDateString(LOC[lang], { day: "2-digit", month: "2-digit", year: "numeric" }) : "");
export const fmtDT = (iso: string | null | undefined, lang: Lang) => (iso ? new Date(iso).toLocaleString(LOC[lang], { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }) : "");
/** Для <input type="datetime-local"> — локальное время без зоны. */
export function toLocalInput(iso: string | null | undefined): string {
  const d = iso ? new Date(iso) : new Date(Date.now() + 3600_000);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}
export const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : new Date().toISOString());

export const fill = (s: string, vars: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(vars[k] ?? ""));
export const initials = (name: string) => name.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";

/** Настройка интерфейса в localStorage (колонки таблицы, режим доски) через useSyncExternalStore — без setState в effect. */
const prefSubs = new Set<() => void>();
const prefCache = new Map<string, string | null>();
function readPref(key: string): string | null {
  if (!prefCache.has(key)) { try { prefCache.set(key, localStorage.getItem(key)); } catch { prefCache.set(key, null); } }
  return prefCache.get(key) ?? null;
}
export const getPref = (key: string): string | null => readPref(key);
export function setPref(key: string, value: string) { prefCache.set(key, value); try { localStorage.setItem(key, value); } catch {} prefSubs.forEach((l) => l()); }
export function usePref(key: string): string | null {
  return useSyncExternalStore((l) => { prefSubs.add(l); return () => { prefSubs.delete(l); }; }, () => readPref(key), () => null);
}
/** Текущее время с точностью до минуты (стабильный снимок для рендера; на сервере 0). */
export function useNow(): number {
  return useSyncExternalStore(() => () => {}, () => Math.floor(Date.now() / 60000) * 60000, () => 0);
}

/** Подпись расположения из пожеланий клиента: «Antalya › Muratpaşa, Konyaaltı › Lara, Güzeloba +2». */
export function wantGeoLabel(w: { il?: string; ilces?: string[]; semts?: string[] } | undefined, anyLabel: string): string {
  if (!w?.il) return anyLabel;
  const parts = [ilName(w.il)];
  const ilces = w.ilces ?? [];
  if (ilces.length) parts.push(ilces.length > 3 ? `${ilces.slice(0, 2).map(ilceName).join(", ")} +${ilces.length - 2}` : ilces.map(ilceName).join(", "));
  const semts = (w.semts ?? []).filter((k) => ilces.includes(SEMT2ILCE[k]));
  if (semts.length) { const names = semts.slice(0, 2).map((k) => semtName(SEMT2ILCE[k], k)); parts.push(semts.length > 2 ? `${names.join(", ")} +${semts.length - 2}` : names.join(", ")); }
  return parts.join(" › ");
}

// ---------- заявки (0017) ----------
import { showToast } from "@/components/ui/toast";
import { requestSummary } from "@/lib/crm/requestFields";
import { fmt as fmtMoney } from "@/lib/money";
import type { Currency } from "@/lib/types";
import type { Priority, RequestKind } from "@/lib/crm/types";
/** Краткая строка заявки для списка/карточки. */
export function reqSummary(kind: RequestKind, fields: Record<string, unknown>): string {
  return requestSummary(kind, fields, (v, cur) => fmtMoney(v, cur as Currency), (f) => { const g = f.geo as { il?: string; ilces?: string[]; semts?: string[] } | undefined; return g?.il ? wantGeoLabel(g, "") : ""; });
}
export const PRIO_COLOR: Record<Priority, string> = { hot: "#e5484d", warm: "#f5a623", cold: "#4d7cfe" };
export const REQ_COLOR: Record<RequestKind, string> = { buy: "#4d7cfe", sell: "#22c15e", rent_out: "#7b4fd0", rent_in: "#0ea5a4" };
/** Цвет типа сделки — как у типа заявки (купить = buy, снять = rent_in, посуточно — оранжевый, переуступка = rent_out). */
export const DEAL_COLOR: Record<string, string> = { sale: "#4d7cfe", rent: "#0ea5a4", daily: "#f5a623", transfer: "#7b4fd0" };
/** Название страны по ISO-2 на языке интерфейса (без справочника — Intl). */
export function countryName(code: string | null | undefined, lang: Lang): string {
  if (!code) return "";
  try { return new Intl.DisplayNames([LOC[lang]], { type: "region" }).of(code) ?? code; } catch { return code; }
}

/** Ошибка серверного экшена → понятный тост: режим чтения, устаревшая вкладка после деплоя (предложить обновить), иначе запасной текст. */
export function crmError(e: unknown, fallback: string, readonlyText: string) {
  const m = (e as Error)?.message ?? "";
  if (m === "readonly") { showToast(readonlyText); return; }
  if (/Server Action|Server Reference|deployment/i.test(m)) { showToast(staleText(), 8000, { label: staleBtn(), onClick: () => window.location.reload() }); return; }
  showToast(fallback);
}
const staleText = () => (typeof navigator !== "undefined" && /^tr/i.test(navigator.language) ? "Uygulama güncellendi — sayfayı yenileyin" : /^en/i.test(typeof navigator !== "undefined" ? navigator.language : "") ? "The app was updated — reload the page" : "Приложение обновилось — обновите страницу");
const staleBtn = () => (typeof navigator !== "undefined" && /^tr/i.test(navigator.language) ? "Yenile" : /^en/i.test(typeof navigator !== "undefined" ? navigator.language : "") ? "Reload" : "Обновить");

// ---------- канбан: ручной порядок карточек (0019) ----------
/** Позиция между соседями (дробная): без соседей 1, только перед → prev+1, только после → next−1. */
export function posBetween(prev: number | null | undefined, next: number | null | undefined): number {
  if (prev == null && next == null) return 1;
  if (prev == null) return (next as number) - 1;
  if (next == null) return prev + 1;
  return (prev + next) / 2;
}
/** Порядок в колонке: с позицией — по ней, без позиции — после, по дате изменения (новее выше). */
export function sortBoard<T extends { boardPos: number | null; updatedAt: string; lastActivityAt?: string }>(list: T[]): T[] {
  const at = (x: T) => x.lastActivityAt ?? x.updatedAt;
  return [...list].sort((a, b) => (a.boardPos != null && b.boardPos != null ? a.boardPos - b.boardPos : a.boardPos != null ? -1 : b.boardPos != null ? 1 : at(b).localeCompare(at(a))));
}
/** Подпись контакта (12.10.2026, «подпись обрезается»): готовые варианты как у HubSpot (личный / рабочий / домашний / другой),
 *  хранится текстом; нестандартное значение остаётся как есть. */
export const CONTACT_LABELS = ["personal", "work", "home", "other"] as const;
export function contactLabelOptions(cur: string, dict: Record<string, string>, none: string) {
  const opts = [{ value: "", label: none }, ...CONTACT_LABELS.map((k) => ({ value: dict[k], label: dict[k] }))];
  if (cur && !opts.some((o) => o.value === cur)) opts.push({ value: cur, label: cur });
  return opts;
}
/** Индекс вставки по положению курсора над карточками колонки (`[data-card]`): до середины карточки — перед ней, иначе после. */
export function dropIndex(e: React.DragEvent, colEl: HTMLElement): number {
  const cards = [...colEl.querySelectorAll<HTMLElement>("[data-card]")];
  for (let i = 0; i < cards.length; i++) { const r = cards[i].getBoundingClientRect(); if (e.clientY < r.top + r.height / 2) return i; }
  return cards.length;
}
