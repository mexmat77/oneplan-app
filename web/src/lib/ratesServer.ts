// Курс валют ЦБ Турции (TCMB) для кабинета риэлтора (цены в ₺ → € / $). Не путать с `lib/rates.ts` — курсы ЕЦБ кабинета застройщика.
//: https://www.tcmb.gov.tr/kurlar/today.xml — публикуется каждый рабочий день ~15:30 по Турции.
// Серверная функция с кэшем Next на 1 час (`revalidate`): сайт всегда показывает актуальный дневной курс. Берём курс ЦБ
// «Döviz Alış» (ForexBuying) — именно его называют «курс ЦБ» (правило пользователя 10.10.2026). При недоступности — последние известные значения.
import "server-only";

export type Rates = { eur: number; usd: number; date: string }; // ₺ за 1 € / 1 $, дата бюллетеня dd.mm.yyyy
const FALLBACK: Rates = { eur: 55.6, usd: 49.17, date: "" };

// Свой кэш на 15 минут вместо `next: { revalidate }` (16.10.2026: прод два дня показывал бюллетень от 13.10 — кэш данных Next
// не обновлялся); при ошибке сети отдаём последний удачный ответ, а не константы.
let memo: { at: number; rates: Rates } | null = null;
export async function getRates(): Promise<Rates> {
  if (memo && Date.now() - memo.at < 15 * 60_000) return memo.rates;
  try {
    const r = await fetch("https://www.tcmb.gov.tr/kurlar/today.xml", { cache: "no-store", headers: { "User-Agent": "OnePlan/1.0 (+https://one-plan.pro)" }, signal: AbortSignal.timeout(8000) });
    if (!r.ok) throw new Error(String(r.status));
    const xml = await r.text();
    const date = /Tarih="([^"]+)"/.exec(xml)?.[1] ?? "";
    const rate = (code: string) => {
      const block = new RegExp(`<Currency[^>]*CurrencyCode="${code}"[^>]*>([\\s\\S]*?)</Currency>`).exec(xml)?.[1] ?? "";
      return parseFloat(/<ForexBuying>([\d.]+)</.exec(block)?.[1] ?? "") || parseFloat(/<ForexSelling>([\d.]+)</.exec(block)?.[1] ?? "") || 0;
    };
    const eur = rate("EUR"), usd = rate("USD");
    if (!eur || !usd) throw new Error("no EUR/USD in TCMB feed");
    const rates = { eur: +eur.toFixed(4), usd: +usd.toFixed(4), date };
    if (memo?.rates.date !== date) console.log("[rates] TCMB bulletin", date, "EUR", rates.eur, "USD", rates.usd);
    memo = { at: Date.now(), rates };
    return rates;
  } catch (e) {
    console.warn("[rates] TCMB:", (e as Error).message);
    if (memo) { memo = { at: Date.now() - 10 * 60_000, rates: memo.rates }; return memo.rates; } // повторим через 5 минут
    return FALLBACK;
  }
}
