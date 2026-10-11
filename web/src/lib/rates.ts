"use client";

// Курсы валют кабинета застройщика — ТОТ ЖЕ курс ЦБ Турции, что и у риэлторов (`lib/money.ts` ← `RatesInit` в root layout;
// единое место для всего сайта, правило пользователя 10.10.2026). Интерфейс прежний: база € (`rates.TRY` = ₺ за 1 €).
// Цены хранятся в валюте объекта и НЕ пересчитываются при показе (ТЗ п.9); курс нужен для смены валюты объекта и дашборда.
import { getRates as getBase, roundPrice as roundBase, useRates as useBase, type Rates as Base } from "./money";
import type { Cur } from "./dev/types";

export type Rates = { base: "EUR"; date: string; rates: Record<Cur, number>; live: boolean };
const cache = new WeakMap<Base, Rates>();
const toDev = (b: Base): Rates => { let r = cache.get(b); if (!r) { r = { base: "EUR", date: b.date, rates: { EUR: 1, USD: +(b.eur / b.usd).toFixed(4), TRY: b.eur }, live: !!b.date }; cache.set(b, r); } return r; };

/** Запасной снимок (когда курс ещё не передан) — из запасных значений `lib/money`. */
export const DEFAULT_RATES: Rates = toDev(getBase());
/** Курсы прототипа (цены в € × курс при показе) — только для миграции старых данных, см. `store/dev.tsx`. */
export const LEGACY_RATES: Record<Cur, number> = { EUR: 1, USD: 1.09, TRY: 35 };

/** Перевести сумму из валюты `from` в `to`. */
export const convert = (n: number, from: Cur, to: Cur, r: Rates = getRates()): number => (from === to ? n : (n / (r.rates[from] || 1)) * (r.rates[to] || 1));
/** Курс «1 € = X <cur>» для подписи. */
export const rateOf = (cur: Cur, r: Rates = getRates()): number => r.rates[cur] || 1;
/** Округление пересчитанной цены: TRY — до 1000, USD/EUR — до 100. */
export const roundPrice = (n: number, cur: Cur): number => roundBase(n, cur);
/** Актуальный курс с перерисовкой. */
export function useRates(): Rates { return toDev(useBase()); }
/** Текущее значение без подписки (обработчики событий). */
export const getRates = (): Rates => toDev(getBase());
