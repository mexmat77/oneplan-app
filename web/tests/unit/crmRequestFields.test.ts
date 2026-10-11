import { describe, expect, it } from "vitest";
import { GROUP_ORDER, OPTS, REQUEST_FIELDS, REQUEST_KINDS, ROLE_OF_KIND, requestSummary } from "@/lib/crm/requestFields";
import ru from "@/i18n/ru.json";
import en from "@/i18n/en.json";
import tr from "@/i18n/tr.json";

describe("crm request fields registry", () => {
  it("keys are unique within a kind and every option set / group exists", () => {
    for (const k of REQUEST_KINDS) {
      const keys = REQUEST_FIELDS[k].map((f) => f.key);
      expect(new Set(keys).size).toBe(keys.length);
      for (const f of REQUEST_FIELDS[k]) {
        if (f.opts) expect(OPTS[f.opts]).toBeDefined();
        expect(GROUP_ORDER).toContain(f.group);
        if (f.type === "select" || f.type === "multi") expect(f.opts).toBeDefined();
      }
      expect(ROLE_OF_KIND[k]).toBeTruthy();
    }
  });
  it("every field, group, kind and option has a label in RU/EN/TR", () => {
    for (const dict of [ru, en, tr] as unknown as { crm: { rq: { f: Record<string, string>; g: Record<string, string>; kinds: Record<string, string>; o: Record<string, Record<string, string>> } } }[]) {
      const rq = dict.crm.rq;
      for (const k of REQUEST_KINDS) {
        expect(rq.kinds[k]).toBeTruthy();
        for (const f of REQUEST_FIELDS[k]) { expect(rq.f[f.key], f.key).toBeTruthy(); expect(rq.g[f.group], f.group).toBeTruthy(); if (f.opts) for (const o of OPTS[f.opts]) expect(rq.o[f.opts]?.[o], `${f.opts}.${o}`).toBeTruthy(); }
      }
    }
  });
  it("closed fields exist only where the spec puts them (prices of sell / rent_out)", () => {
    const closed = REQUEST_KINDS.flatMap((k) => REQUEST_FIELDS[k].filter((f) => f.closed).map((f) => `${k}.${f.key}`));
    expect(closed.sort()).toEqual(["rent_out.rentMin", "sell.priceMin"]);
  });
  it("summary shows budget, rooms and location, never closed fields", () => {
    const s = requestSummary("buy", { budgetMin: 100000, budgetMax: 200000, cur: "EUR", rooms: ["2+1", "3+1"], geo: { il: "antalya" } }, (v, c) => `${v} ${c}`, () => "Antalya");
    expect(s).toBe("100000 EUR – 200000 EUR · 2+1, 3+1 · Antalya");
    expect(requestSummary("sell", { priceMin: 5, cur: "TRY" }, (v, c) => `${v} ${c}`, () => "")).toBe("");
  });
});
