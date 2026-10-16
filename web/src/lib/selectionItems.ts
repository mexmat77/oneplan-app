// Объекты подборки с учётом судьбы объявления (16.10.2026, «после удаления объявлений в подборке остались серые квадраты»;
// вопрос пользователя «можно написать, что он продан?»): живое объявление → карточка; проданное / снятое → карточка с
// плашкой «Продан» / «Снят с продажи»; удалённое → карточка по снимку `Selection.snap` с плашкой «Снят с продажи»;
// удалённое без снимка (старые подборки) — не показывается. Недоступные идут в конце списка.
import type { Listing, ListingStatus } from "@/lib/types";
import type { SelSnap, Selection } from "@/store/selections";

export type Gone = "sold" | "off" | null;
export type SelItem = { id: string; live: Listing | null; snap: SelSnap | null; gone: Gone };

export const snapOf = (o: Listing): SelSnap => ({ t: o.t, loc: o.loc, img: o.img || o.photos[0] || "", price: o.price, cur: o.cur });
export const goneOf = (st: ListingStatus | undefined): Gone => (st === "sold" ? "sold" : st === "off" ? "off" : null);

export function resolveSelItems(s: Selection, pool: Listing[]): SelItem[] {
  const out: SelItem[] = [];
  for (const id of s.items) {
    const live = pool.find((o) => o.id === id) ?? null;
    const snap = s.snap?.[id] ?? null;
    if (live) out.push({ id, live, snap, gone: goneOf(live.st) });
    else if (snap) out.push({ id, live: null, snap, gone: "off" });
  }
  return [...out.filter((x) => !x.gone), ...out.filter((x) => x.gone)];
}
