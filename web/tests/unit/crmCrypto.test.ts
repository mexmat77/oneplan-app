// Шифрование CRM: конвертный ключ, AES-GCM с привязкой к записи, хэш контактов, нормализация.
import { randomBytes } from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";

process.env.CRM_MASTER_KEY = randomBytes(32).toString("base64");
let crypto: typeof import("@/lib/crm/crypto");
beforeAll(async () => { crypto = await import("@/lib/crm/crypto"); });

describe("crm crypto", () => {
  it("wraps and unwraps a data key per workspace", () => {
    const { wrapped } = crypto.newWrappedKey("realtor", "ws-1");
    const dek = crypto.unwrapKey(wrapped, "realtor", "ws-1");
    expect(dek.length).toBe(32);
    expect(() => crypto.unwrapKey(wrapped, "realtor", "ws-2")).toThrow(); // чужой ws — не разворачивается
  });
  it("encrypts a field bound to its record (AAD)", () => {
    const dek = crypto.unwrapKey(crypto.newWrappedKey("developer", "co").wrapped, "developer", "co");
    const token = crypto.encField(dek, "+90 532 555 10 20", "crm_contacts.value:row-1");
    expect(token.startsWith("v1.")).toBe(true);
    expect(token).not.toContain("532");
    expect(crypto.decField(dek, token, "crm_contacts.value:row-1")).toBe("+90 532 555 10 20");
    expect(crypto.decField(dek, token, "crm_contacts.value:row-2")).toBe("�"); // подставить в другую запись нельзя
    expect(crypto.encField(dek, "x", "a")).not.toBe(crypto.encField(dek, "x", "a")); // случайный nonce
  });
  it("normalizes Turkish phones and e-mails", () => {
    expect(crypto.normalizeContact("phone", "0532 555 10 20")).toBe("905325551020");
    expect(crypto.normalizeContact("phone", "+90 (532) 555-10-20")).toBe("905325551020");
    expect(crypto.normalizeContact("phone", "532 555 10 20")).toBe("905325551020");
    expect(crypto.normalizeContact("phone", "0090 532 555 10 20")).toBe("905325551020");
    expect(crypto.normalizeContact("email", " Ali@Mail.com ")).toBe("ali@mail.com");
    expect(crypto.normalizeContact("telegram", "@Ali_K")).toBe("ali_k");
  });
  it("hashes contacts per workspace, unlinkable across workspaces", () => {
    const a = crypto.valueHash("realtor", "u1", "phone", "905325551020");
    expect(a).toBe(crypto.valueHash("realtor", "u1", "phone", "905325551020"));
    expect(a).not.toBe(crypto.valueHash("realtor", "u2", "phone", "905325551020"));
    expect(a).not.toContain("5551020");
  });
  it("issues one-time source tokens with only a hash to store", () => {
    const { token, hash } = crypto.newSourceToken();
    expect(token.startsWith("ops_")).toBe(true);
    expect(crypto.tokenHash(token)).toBe(hash);
    expect(hash).not.toContain(token.slice(4, 12));
  });
});
