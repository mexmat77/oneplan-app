import type { Currency, Listing } from "./types";

import { useSyncExternalStore } from "react";

// Курс валют — дневной курс ЦБ Турции (TCMB), приходит с сервера через `RatesInit` в root layout (`lib/rates.ts`, кэш 1 ч).
// Значения ниже — запасные, пока курс не передан (прототип: 1 € = 48 ₺ — устарел, 10.10.2026).
export type Rates = { eur: number; usd: number; date: string };
let RATES: Rates = { eur: 55.6, usd: 49.17, date: "" };
const subs = new Set<() => void>();
export function setRates(r: Rates, notify = true) { if (r.eur === RATES.eur && r.usd === RATES.usd && r.date === RATES.date) return; RATES = r; if (notify) subs.forEach((f) => f()); }
export const notifyRates = () => subs.forEach((f) => f());
export const getRates = () => RATES;
/** Курс в компонентах (перерисовка при обновлении). */
export const useRates = () => useSyncExternalStore((cb) => { subs.add(cb); return () => { subs.delete(cb); }; }, getRates, getRates);
export const eurTry = () => RATES.eur;
export const usdTry = () => RATES.usd;
/** ₺ за единицу валюты. */
export const tryPer = (cur: Currency, r: Rates = RATES) => (cur === "TRY" ? 1 : cur === "EUR" ? r.eur : r.usd);
/** Перевод суммы между валютами по курсу ЦБ (единое место для всего сайта). */
export const convert = (n: number, from: Currency, to: Currency, r: Rates = RATES): number => (from === to ? n : (n * tryPer(from, r)) / tryPer(to, r));
/** Округление пересчитанной ЦЕНЫ (смена валюты объекта): ₺ — до 1000, € / $ — до 100, чтобы цифра была ровной. */
export const roundPrice = (n: number, cur: Currency): number => { const step = cur === "TRY" ? 1000 : 100; return Math.round(n / step) * step; };

export const sym = (cur: Currency) => (cur === "EUR" ? "€" : cur === "USD" ? "$" : "₺");

export const fmt = (n: number, cur: Currency = "TRY") =>
  n.toLocaleString("ru-RU").replace(/,/g, " ").replace(/ /g, " ") + " " + sym(cur);

export const eur = (o: Pick<Listing, "price" | "cur">) => convert(o.price, o.cur, "EUR");

/** Округление ЭКВИВАЛЕНТА «≈» до красивой цифры: ≥1 млн — до 10 000, ≥10 000 — до 1 000, иначе до 100. */
export const rnd = (v: number) =>
  v >= 1000000 ? Math.round(v / 10000) * 10000 : v >= 10000 ? Math.round(v / 1000) * 1000 : Math.round(v / 100) * 100;

export function eqOf(o: Pick<Listing, "price" | "cur">) {
  const e = eur(o);
  const p: string[] = [];
  if (o.cur !== "EUR") p.push(fmt(rnd(e), "EUR"));
  if (o.cur !== "USD") p.push(fmt(rnd(convert(e, "EUR", "USD")), "USD"));
  if (o.cur !== "TRY") p.push(fmt(rnd(convert(e, "EUR", "TRY")), "TRY"));
  return "≈ " + p.join(" · ");
}

// "5.4M ₺" / "850k ₺" — map pins and compact labels.
export const fmtShort = (p: number) => (p >= 1000000 ? `${Math.round(p / 100000) / 10}M ₺` : `${Math.round(p / 1000)}k ₺`);

export const kShort = (v: string | number) => {
  const n = Number(String(v).replace(/\s/g, ""));
  if (!n) return "";
  return n >= 1000000 ? `${Math.round(n / 100000) / 10}M` : n >= 1000 ? `${Math.round(n / 1000)}k` : String(n);
};
