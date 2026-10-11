import { describe, expect, it } from "vitest";
import { GEO, GEO_SEED, ILCES, SEMT2ILCE, geoKeysOf, getSeedListings } from "@/lib/seed";

describe("справочник географии", () => {
  it("81 провинция и все районы с ключами", () => { expect(GEO.length).toBe(81); expect(Object.keys(ILCES).length).toBeGreaterThan(900); });
  it("ключи по названиям, с турецкими буквами в любом регистре", () => {
    expect(geoKeysOf("Antalya", "Konyaaltı", "Liman")).toEqual({ il: "antalya", ilce: "konyaalti", semt: "liman" });
    expect(geoKeysOf("ANTALYA", "Alanya", "").ilce).toBe("alanya");
    expect(geoKeysOf("Нет такой").il).toBe("");
  });
  it("демо-объекты лежат в своих махалле и ссылаются на известные ключи", () => {
    const list = getSeedListings();
    expect(list.length).toBeGreaterThan(100);
    for (const o of list) { expect(o.ilce && ILCES[o.ilce], `ilçe ${o.ilce}`).toBeTruthy(); if (o.semt) expect(SEMT2ILCE[o.semt], `semt ${o.semt}`).toBe(o.ilce); }
    for (const il of GEO_SEED) for (const ic of il.ilces) for (const sm of ic.semts) expect(sm.ll, `${ic.k}/${sm.k} без координат`).toBeTruthy();
  });
});
