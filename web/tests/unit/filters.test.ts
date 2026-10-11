import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, passF, sortListings } from "@/lib/filters";
import { eur } from "@/lib/money";
import { getSeedListings } from "@/lib/seed";

describe("фильтры каталога", () => {
  const all = getSeedListings();
  it("пустой фильтр пропускает все активные объекты продажи", () => {
    const n = all.filter((o) => passF(o, EMPTY_FILTERS)).length;
    expect(n).toBeGreaterThan(50); expect(n).toBeLessThanOrEqual(all.length);
  });
  it("провинция и район сужают выборку, цена и комнаты работают вместе", () => {
    const ant = all.filter((o) => passF(o, { ...EMPTY_FILTERS, il: "antalya" }));
    const alanya = all.filter((o) => passF(o, { ...EMPTY_FILTERS, il: "antalya", ilces: ["alanya"] }));
    expect(alanya.length).toBeGreaterThan(0); expect(alanya.length).toBeLessThan(ant.length);
    expect(alanya.every((o) => o.ilce === "alanya")).toBe(true);
    const cheap = all.filter((o) => passF(o, { ...EMPTY_FILTERS, max: "5000000", rooms: ["1+1"] }));
    expect(cheap.every((o) => o.price <= 5000000 && o.rooms === "1+1")).toBe(true);
  });
  it("сортировка по цене", () => {
    const s = sortListings(all.filter((o) => passF(o, EMPTY_FILTERS)), "cheap");
    for (let i = 1; i < s.length; i++) expect(eur(s[i])).toBeGreaterThanOrEqual(eur(s[i - 1]) - 1e-6); // цены в разных валютах сравниваются в €
  });
});
