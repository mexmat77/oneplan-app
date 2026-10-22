import { describe, expect, it } from "vitest";
import { seenInfo } from "@/lib/seen";

const D = { online: "Онлайн", never: "Ещё не заходил(а)" };
const now = new Date("2026-10-22T12:00:00Z").getTime();
const ago = (ms: number) => new Date(now - ms).toISOString();

describe("активность пользователя (seenInfo)", () => {
  it("онлайн — меньше 5 минут", () => {
    expect(seenInfo(ago(2 * 60e3), "RU", now, D)).toMatchObject({ online: true, label: "Онлайн" });
  });
  it("относительное время по локали", () => {
    expect(seenInfo(ago(25 * 60e3), "RU", now, D).label).toMatch(/25/);
    expect(seenInfo(ago(3 * 3600e3), "EN", now, D).label).toBe("3 hours ago");
    expect(seenInfo(ago(26 * 3600e3), "EN", now, D).label).toBe("yesterday");
    expect(seenInfo(ago(3 * 86400e3), "TR", now, D).label).toMatch(/3 gün/);
  });
  it("старше недели — дата; пусто — «ещё не заходил»", () => {
    expect(seenInfo(ago(20 * 86400e3), "RU", now, D).label).toBe("02.10.2026");
    expect(seenInfo(null, "RU", now, D)).toMatchObject({ online: false, ms: null, label: D.never });
  });
});
