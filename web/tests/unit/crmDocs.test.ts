// Документы CRM: суммы прописью TR/EN, форматирование, подготовка данных для шаблона.
import { describe, expect, it } from "vitest";
import { fmtEn, fmtTr, prepareData, wordsEn, wordsTr } from "@/lib/crm/docs";

describe("crm docs", () => {
  it("турецкие суммы прописью", () => {
    expect(wordsTr(17500000)).toBe("on yedi milyon beş yüz bin");
    expect(wordsTr(350000)).toBe("üç yüz elli bin");
    expect(wordsTr(1000)).toBe("bin");
    expect(wordsTr(101)).toBe("yüz bir");
    expect(wordsTr(2100000)).toBe("iki milyon yüz bin");
  });
  it("английские суммы прописью", () => {
    expect(wordsEn(17500000)).toBe("seventeen million five hundred thousand");
    expect(wordsEn(350000)).toBe("three hundred fifty thousand");
    expect(wordsEn(21)).toBe("twenty-one");
  });
  it("форматы чисел", () => { expect(fmtTr(17500000)).toBe("17.500.000"); expect(fmtEn(17500000)).toBe("17,500,000"); });
  it("prepareData: деньги → формат + прописью, даты → дд.мм.гггг, плоские ключи", () => {
    const d = prepareData({ "deal.price": "17500000", "deal.date": "2026-10-11", "buyer.name": "Anna" }, { "deal.price": "money", "deal.date": "date" });
    expect(d["deal.price"]).toBe("17.500.000"); expect(d["deal.priceWordsTr"]).toBe("on yedi milyon beş yüz bin"); expect(d["deal.priceEn"]).toBe("17,500,000");
    expect(d["deal.date"]).toBe("11.10.2026"); expect(d["buyer.name"]).toBe("Anna");
  });
});
