// Совпадения сохранённого поиска = выдача каталога по тем же параметрам (13.10.2026: «в базе 65, совпадений 75»).
import { describe, expect, it } from "vitest";
import { EMPTY_FILTERS, matchSearch, passF } from "@/lib/filters";
import { getSeedListings } from "@/lib/seed";

describe("matchSearch", () => {
  const all = getSeedListings();
  const params = { il: "antalya", ilces: [], semts: [], rooms: [], min: "", max: "", deal: "sale" as const, type: "" as const };
  it("считает ровно то, что показывает каталог (без проданных, с типом сделки)", () => {
    const catalog = all.filter((o) => o.st !== "sold" && passF(o, { ...EMPTY_FILTERS, ...params })).length;
    const saved = all.filter((o) => matchSearch(o, params)).length;
    expect(saved).toBe(catalog);
    expect(saved).toBeGreaterThan(0);
  });
  it("аренда не попадает в поиск «Купить», проданные — никуда", () => {
    expect(all.filter((o) => matchSearch(o, params)).some((o) => o.deal !== "sale" || o.st === "sold")).toBe(false);
  });
  it("старый поиск без deal/type считается как каталог по умолчанию", () => {
    const old = { il: "antalya", ilces: [], semts: [], rooms: [], min: "", max: "" };
    expect(all.filter((o) => matchSearch(o, old)).length).toBe(all.filter((o) => matchSearch(o, params)).length);
  });
});
