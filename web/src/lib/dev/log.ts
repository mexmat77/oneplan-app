// Журнал изменений объекта — прототип `OnePlan v2.dc.html` 3103–3123, спецификация §1.10 / §5.2.
import type { DevLang, LogEntry, Unit } from "./types";

/** Записей на страницу (`LOGPP`). */
export const LOGPP = 20;

/**
 * Демо-сид при первом открытии журнала (строка 3104): 3 продажи (7/13/19 дней назад), одна бронь (2 дня),
 * одно изменение цены (4 дня, старая = price×0.94, округлённая до сотен). Возвращает новые сверху
 * (в сторе `log[objId]` хранится newest-first, как пишет `addLog`).
 */
export function buildLogSeed(units: Unit[]): LogEntry[] {
  const seed: LogEntry[] = [];
  const day = 864e5;
  const now = Date.now();
  const sold = units.filter((u) => u.status === "sold" && u.num !== "" && u.num != null).slice(0, 3);
  sold.forEach((u, i) => seed.push({ ts: now - day * (6 * (i + 1) + 1), uid: u.uid, num: u.num, f: "status", from: i === 0 ? "booked" : "free", to: "sold" }));
  const booked = units.find((u) => u.status === "booked");
  if (booked) seed.push({ ts: now - day * 2, uid: booked.uid, num: booked.num, f: "status", from: "free", to: "booked" });
  const priced = units.find((u) => u.status === "free" && u.price > 0);
  if (priced) seed.push({ ts: now - day * 4, uid: priced.uid, num: priced.num, f: "price", from: Math.round((priced.price * 0.94) / 100) * 100, to: priced.price });
  return seed.sort((a, b) => b.ts - a.ts);
}

/** Дата записи «19 сент. · 14:05» (`fmtLogD`, 3105) — день/месяц в локали языка, время всегда ru-RU. */
export function fmtLogD(ts: number, lang: DevLang): string {
  const d = new Date(ts);
  const loc = lang === "TR" ? "tr-TR" : lang === "EN" ? "en-GB" : "ru-RU";
  return d.toLocaleDateString(loc, { day: "2-digit", month: "short" }) + " · " + d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}
