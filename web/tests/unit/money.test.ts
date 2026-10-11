import { describe, expect, it } from "vitest";
import { convert, eqOf, eur, fmtShort, rnd, roundPrice, setRates } from "@/lib/money";

describe("курс и пересчёт", () => {
  setRates({ eur: 55.11, usd: 49.13, date: "09.10.2026" });
  it("₺ → € по курсу ЦБ", () => { expect(eur({ price: 5511000, cur: "TRY" })).toBeCloseTo(100000, 0); });
  it("$ → € через ₺", () => { expect(convert(100, "USD", "EUR")).toBeCloseTo((100 * 49.13) / 55.11, 6); });
  it("одна валюта — без изменений", () => { expect(convert(123, "EUR", "EUR")).toBe(123); });
  it("эквивалент округляется до красивой цифры", () => {
    expect(rnd(241768)).toBe(242000); expect(rnd(5432180)).toBe(5430000); expect(rnd(9876)).toBe(9900);
    expect(eqOf({ price: 13350000, cur: "TRY" })).toBe("≈ 242 000 € · 272 000 $");
  });
  it("цена при смене валюты: ₺ до 1000, €/$ до 100", () => { expect(roundPrice(1234567, "TRY")).toBe(1235000); expect(roundPrice(12345, "EUR")).toBe(12300); });
  it("короткая цена для пина", () => { expect(fmtShort(5430000)).toBe("5.4M ₺"); expect(fmtShort(850000)).toBe("850k ₺"); });
});
