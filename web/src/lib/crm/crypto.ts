import "server-only";

// Шифрование персональных данных CRM (11.10.2026) — «как у правильных компаний»:
// • конвертное шифрование: мастер-ключ CRM_MASTER_KEY (32 байта, base64) живёт ТОЛЬКО в .env на сервере приложения
//   (Hetzner), в Supabase его нет; у каждого рабочего пространства (риэлтор / компания застройщика) свой ключ данных (DEK),
//   который хранится в crm_keys завёрнутым мастер-ключом. Утечка базы без сервера → шифротекст; ротация мастер-ключа =
//   перезаворачивание DEK без перешифровки данных (key_ver);
// • поля: AES-256-GCM, случайный nonce 96 бит, тег 128 бит, AAD = имя поля + id записи — шифротекст нельзя
//   подставить в другую запись/поле; формат "v1.<nonce b64>.<ciphertext+tag b64>";
// • поиск дублей и входящих заявок — HMAC-SHA256 нормализованного значения ключом, выведенным из мастер-ключа (HKDF,
//   info "crm-hash"), с ws в сообщении: по хэшу нельзя восстановить номер и нельзя связать клиентов разных ws.
// Ключ при запуске сохранить в двух местах вне сервера (менеджер паролей + бумага): без него данные не восстановить.
import { createCipheriv, createDecipheriv, createHmac, hkdfSync, randomBytes } from "node:crypto";

const VER = "v1";
const KEY_VER = 1;

function masterKey(): Buffer {
  const b64 = process.env.CRM_MASTER_KEY;
  if (!b64) throw new Error("CRM_MASTER_KEY is not set");
  const k = Buffer.from(b64, "base64");
  if (k.length !== 32) throw new Error("CRM_MASTER_KEY must be 32 bytes (base64)");
  return k;
}
export const crmCryptoReady = () => !!process.env.CRM_MASTER_KEY;

function seal(key: Buffer, plain: Buffer, aad: string): string {
  const nonce = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, nonce);
  c.setAAD(Buffer.from(aad, "utf8"));
  const ct = Buffer.concat([c.update(plain), c.final(), c.getAuthTag()]);
  return `${VER}.${nonce.toString("base64")}.${ct.toString("base64")}`;
}
function open(key: Buffer, token: string, aad: string): Buffer {
  const [ver, n, c] = token.split(".");
  if (ver !== VER || !n || !c) throw new Error("bad ciphertext");
  const nonce = Buffer.from(n, "base64"), buf = Buffer.from(c, "base64");
  const d = createDecipheriv("aes-256-gcm", key, nonce);
  d.setAAD(Buffer.from(aad, "utf8"));
  d.setAuthTag(buf.subarray(buf.length - 16));
  return Buffer.concat([d.update(buf.subarray(0, buf.length - 16)), d.final()]);
}

/** Новый ключ данных ws, завёрнутый мастер-ключом (для crm_keys.wrapped_key). */
export function newWrappedKey(wsKind: string, wsId: string): { wrapped: string; keyVer: number } {
  return { wrapped: seal(masterKey(), randomBytes(32), `crm-dek:${wsKind}:${wsId}`), keyVer: KEY_VER };
}
export function unwrapKey(wrapped: string, wsKind: string, wsId: string): Buffer {
  return open(masterKey(), wrapped, `crm-dek:${wsKind}:${wsId}`);
}

/** Шифрование поля записи: aad = "<table>.<field>:<rowId>". */
export function encField(dek: Buffer, value: string, aad: string): string {
  return seal(dek, Buffer.from(value, "utf8"), aad);
}
export function decField(dek: Buffer, token: string | null | undefined, aad: string): string {
  if (!token) return "";
  try { return open(dek, token, aad).toString("utf8"); } catch { return "�"; } // повреждено/чужой ключ — не роняем экран
}

/** Хэш для поиска дублей: HMAC(HKDF(master, "crm-hash"), ws|kind|normalized). */
let hashKey: Buffer | null = null;
export function valueHash(wsKind: string, wsId: string, kind: string, normalized: string): string {
  if (!hashKey) hashKey = Buffer.from(hkdfSync("sha256", masterKey(), Buffer.alloc(0), "crm-hash", 32));
  return createHmac("sha256", hashKey).update(`${wsKind}|${wsId}|${kind}|${normalized}`).digest("base64url");
}

/** Нормализация контакта перед хэшированием: телефон → только цифры с кодом страны (TR по умолчанию), e-mail → lower. */
export function normalizeContact(kind: string, raw: string): string {
  const s = raw.trim();
  if (kind === "email") return s.toLowerCase();
  if (kind === "phone" || kind === "whatsapp") {
    let d = s.replace(/\D/g, "");
    if (d.startsWith("00")) d = d.slice(2);
    if (d.length === 11 && d.startsWith("0")) d = "9" + d;        // 05xx… → 905xx…
    if (d.length === 10 && d.startsWith("5")) d = "90" + d;       // 5xx… → 905xx…
    return d;
  }
  if (kind === "telegram") return s.replace(/^@/, "").toLowerCase();
  return s.toLowerCase();
}

/** Токен для входящих заявок внешнего источника: показываем один раз, храним только sha256. */
export function newSourceToken(): { token: string; hash: string } {
  const token = "ops_" + randomBytes(24).toString("base64url");
  return { token, hash: tokenHash(token) };
}
export function tokenHash(token: string): string {
  return createHmac("sha256", "crm-source-token").update(token).digest("base64url");
}
