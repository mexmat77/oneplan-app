"use client";

// Общее для экранов CRM: контекст (ws, доступ, этапы, источники, базовый путь кабинета), стили, форматирование.
import { createContext, useContext } from "react";
import type { Dict, Lang } from "@/i18n";
import type { CrmMe, Source, Stage, TaskKind } from "@/lib/crm/types";

export type CrmCtxT = { me: CrmMe; stages: Stage[]; sources: Source[]; base: string; refresh: () => void; setStages: (s: Stage[]) => void; setSources: (s: Source[]) => void };
export const CrmCtx = createContext<CrmCtxT | null>(null);
export function useCrm(): CrmCtxT { const c = useContext(CrmCtx); if (!c) throw new Error("CrmCtx"); return c; }

export const inp = "w-full rounded-[10px] border border-line bg-surface px-3 py-[10px] text-[14px] text-ink outline-none focus:border-blue";
export const lbl = "mb-[6px] block text-[12px] font-bold uppercase tracking-[.04em] text-muted";
export const card = "rounded-[16px] border border-line bg-surface p-[18px] shadow-[0_1px_3px_rgba(20,36,63,.05)]";
export const btnP = "inline-flex cursor-pointer items-center gap-[7px] rounded-[12px] bg-blue-2 px-[18px] py-[10px] text-[13px] font-bold text-white hover:bg-blue-3 disabled:cursor-default disabled:opacity-50";
export const btnS = "inline-flex cursor-pointer items-center gap-[7px] rounded-[12px] border border-line bg-surface px-[16px] py-[10px] text-[13px] font-bold text-ink hover:bg-bg-3 disabled:cursor-default disabled:opacity-50";
export const btnD = "inline-flex cursor-pointer items-center gap-[7px] rounded-[12px] px-[14px] py-[10px] text-[13px] font-bold text-red hover:bg-red-tint";
export const chip = "inline-flex items-center rounded-[14px] bg-bg-2 px-[10px] py-[3px] text-[11.5px] font-semibold text-text-2";

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
