import { describe, expect, it } from "vitest";
import { countryOf, exampleNational, fitIntlDigits, fitNationalDigits, flagOf, maxNationalLength, phoneInfo, toIntlDigits } from "@/lib/phoneIntl";

describe("международные телефоны (phoneIntl)", () => {
  it("турецкие наборы без «+» → +90 5…", () => {
    expect(toIntlDigits("5051234567")).toBe("+905051234567");
    expect(toIntlDigits("05051234567")).toBe("+905051234567");
    expect(toIntlDigits("905051234567")).toBe("+905051234567");
    expect(toIntlDigits("0090 505 123 45 67")).toBe("+905051234567");
    expect(phoneInfo("505 123 45 67").intl).toBe("+90 505 123 45 67");
    expect(phoneInfo("505 123 45 67").country).toBe("TR");
    expect(phoneInfo("505 123 45 67").valid).toBe(true);
  });
  it("российская привычка «8 9xx» → +7", () => {
    expect(toIntlDigits("89991234567")).toBe("+79991234567");
    expect(phoneInfo("8 999 123 45 67").country).toBe("RU");
    expect(phoneInfo("+7 999 123 45 67").intl).toBe("+7 999 123 45 67");
  });
  it("другие страны по «+» и формат по правилам страны", () => {
    expect(phoneInfo("+44 20 7946 0958").country).toBe("GB");
    expect(phoneInfo("+49 30 123456").country).toBe("DE");
    expect(phoneInfo("+1 202 555 0143").country).toBe("US");
    expect(countryOf("+90 532 000 00 00")).toBe("TR");
  });
  it("невалидный номер — не валиден, страна по коду; флаг — эмодзи", () => {
    expect(phoneInfo("+90 1").valid).toBe(false);
    expect(flagOf("TR")).toBe("🇹🇷");
    expect(flagOf(null)).toBe("🌐");
    expect(phoneInfo("").intl).toBe("");
  });
});

describe("страна по коду для невалидных номеров", () => {
  it("+44 7700 900123 (тестовый диапазон) — всё равно Великобритания", () => {
    expect(countryOf("+44 7700 900123")).toBe("GB");
    expect(phoneInfo("+1 555 0100").country).toBe("US");
  });
});

describe("длина номера по стране и типу — лишние цифры отбрасываются (как в WhatsApp)", () => {
  it("мобильные фиксированной длины: TR 10, RU 10, US 10, UA 9, AZ 9", () => {
    expect(fitNationalDigits("TR", "50512345678")).toBe("5051234567");
    expect(fitNationalDigits("TR", "505123456")).toBe("505123456"); // недобор не трогаем
    expect(fitNationalDigits("RU", "99912345678")).toBe("9991234567");
    expect(fitNationalDigits("US", "20255501431")).toBe("2025550143");
    expect(fitNationalDigits("UA", "5012345678")).toBe("501234567");
    expect(fitNationalDigits("AZ", "5012345678")).toBe("501234567");
  });
  it("переменная длина: немецкий мобильный 10–11, городской — до 15", () => {
    expect(fitNationalDigits("DE", "15112345678")).toBe("15112345678");
    expect(fitNationalDigits("DE", "151123456789")).toBe("15112345678");
    expect(fitNationalDigits("DE", "30123456789")).toBe("30123456789");
    expect(maxNationalLength("DE")).toBe(15);
    expect(maxNationalLength("US")).toBe(10);
  });
  it("международная строка и пример номера для подсказки", () => {
    expect(fitIntlDigits("+9050512345678")).toBe("+905051234567");
    expect(fitIntlDigits("+90505")).toBe("+90505");
    expect(fitIntlDigits("+")).toBe("+");
    expect(exampleNational("TR")).toBe("501 234 56 78");
    expect(exampleNational("US")).toMatch(/^\d{3} \d{3} \d{4}$/);
  });
});
