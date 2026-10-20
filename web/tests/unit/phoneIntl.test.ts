import { describe, expect, it } from "vitest";
import { countryOf, flagOf, phoneInfo, toIntlDigits } from "@/lib/phoneIntl";

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
