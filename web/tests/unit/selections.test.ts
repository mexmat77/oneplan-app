import { describe, expect, it } from "vitest";
import { slugOf, findBySlug, likedCount } from "@/store/selections";

describe("подборки", () => {
  it("slug — 6 последних символов id в верхнем регистре", () => { expect(slugOf("s1791234567890")).toBe("567890"); expect(slugOf("3f2a1c9e-1111-2222-3333-aabbccddeeff")).toBe("DDEEFF"); });
  it("поиск по slug или id", () => {
    const s = { id: "s12", slug: "S12", title: "", name: "", note: "", items: [], cm: {}, status: "sent" as const, views: 0, reacts: { a: "like" as const, b: "no" as const }, createdAt: "", updatedAt: "" };
    expect(findBySlug([s], "S12")).toBe(s); expect(findBySlug([s], "s12")).toBe(s); expect(findBySlug([s], "x")).toBeUndefined();
    expect(likedCount(s)).toBe(1);
  });
});
