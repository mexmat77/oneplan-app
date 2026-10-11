"use server";

// Мастер «Объект из файлов»: извлечение прайс-листа из произвольного документа с помощью ИИ.
// Excel/CSV обычно разбираются локально (`lib/dev/importObject.ts`); сюда попадают PDF, сканы/фото и таблицы,
// которые локальный разбор не понял. Модель возвращает строки в едином виде: блок, №, этаж, тип, площадь, цена, статус.
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";

const MODEL = process.env.ANTHROPIC_FLOORPLAN_MODEL || "claude-sonnet-5";
const MAX_DOC_BYTES = 20 * 1024 * 1024;
const MAX_IMG_BYTES = 4.5 * 1024 * 1024;

export type PriceInput = { kind: "pdf"; data: string } | { kind: "image"; data: string; mediaType: string } | { kind: "text"; text: string };
export type AiPriceRow = { block: string; num: string; floor: number; type: string; area: number; price: number; status: "free" | "booked" | "process" | "sold" | "reserve" | "na"; band?: "out" | "ins" };
export type PriceResult =
  | { ok: true; rows: AiPriceRow[]; currency: "EUR" | "USD" | "TRY" | null; truncated: boolean }
  | { ok: false; reason: "no-key" | "no-session" | "too-big" | "bad-json" | "empty" | "error"; message?: string };

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

const PROMPT = `You are given a real-estate developer's price list (apartments / units of a residential project). It may be a PDF, a scan, a photo or raw table text, in Turkish, Russian or English, with any column order, merged cells, several blocks and header noise.

Extract EVERY unit row. Reply with ONLY a JSON object, no prose, no markdown:
{"currency":"EUR","rows":[["A","12",3,"2+1",84.5,250000,"free",""], ...]}

The floor (and block) of a unit is often NOT a column: it is a section heading above a group of rows ("GROUND FLOOR", "1 FLOOR", "2. KAT", "A BLOK") and may be followed by a sub-heading ("OUTSIDE" / "INSIDE"). Apply each heading to every row below it until the next heading of the same level.

Each row is an array: [block, number, floor, type, area, price, status, side]
- block: building/block letter or number ("A BLOK" -> "A"); "" if the project has no blocks.
- number: the unit number exactly as printed (keep text like "Sosyal Alan").
- floor: integer, EXACTLY as numbered in the document - never renumber or shift floors. "1" / "1. Kat" / "1. этаж" is 1 (not 0), "3. Kat" is 3. Use 0 ONLY when the document literally calls the floor ground ("Zemin", "Z", "G", "Ground", "цоколь", "0"); basements ("Bodrum", "B1", "-1") are negative. If a unit spans two floors (duplex "4-5") use the LOWER floor.
- type: rooms as "1+1", "2+1", "3.5+1"...; for a duplex / triplex append the word after a space ("3+1 duplex", "4+1 triplex") — also when the duplex mark is NOT in the row itself but in a section heading, a column header, a merged cell or a note covering a group of rows ("DUBLEKS", "ÇATI DUBLEKS", "DUPLEX", "ДУПЛЕКС"): apply it to every row of that group - nothing else may be added to the rooms; for non-apartments use "1*" (commercial/shop/office), "sosyal" (social area), "otopark" (parking), "teknik" (technical). "" if unknown.
- area: gross area in m² as a number (0 if missing).
- price: the list price as a plain number without separators (0 if missing, "sold"/"satıldı" rows have 0).
- status: one of "free", "booked" (reserved for a client / opsiyon / бронь), "process" (deal in progress), "sold", "reserve" (developer's reserve), "na" (not for sale). Default "free".
- side: "ins" when the row is in a part of the floor marked as inside / inner / courtyard side ("INSIDE", "İÇ", "AVLU", "двор", "внутр."), "out" when it is marked outside / street side ("OUTSIDE", "DIŞ", "наружу"), "" when the document makes no such split.
- currency: "EUR", "USD" or "TRY" by the symbols/labels in the document; null if unclear.
Do not invent rows; skip totals, headers and notes.`;

function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no json object");
  return JSON.parse(t.slice(a, b + 1));
}
const STATUSES = ["free", "booked", "process", "sold", "reserve", "na"] as const;

export async function extractPrice(input: PriceInput): Promise<PriceResult> {
  const bypass = process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";
  if (!bypass && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const me = await getCurrentUser();
    if (!me) return { ok: false, reason: "no-session" };
  }
  const api = getClient();
  if (!api) return { ok: false, reason: "no-key" };
  let source: Anthropic.ContentBlockParam;
  if (input.kind === "pdf") {
    if (input.data.length * 0.75 > MAX_DOC_BYTES) return { ok: false, reason: "too-big" };
    source = { type: "document", source: { type: "base64", media_type: "application/pdf", data: input.data } };
  } else if (input.kind === "image") {
    if (input.data.length * 0.75 > MAX_IMG_BYTES) return { ok: false, reason: "too-big" };
    const mt = (["image/jpeg", "image/png", "image/webp", "image/gif"] as const).find((m) => m === input.mediaType) ?? "image/jpeg";
    source = { type: "image", source: { type: "base64", media_type: mt, data: input.data } };
  } else {
    const text = String(input.text || "").slice(0, 400_000);
    if (!text.trim()) return { ok: false, reason: "empty" };
    source = { type: "text", text: `PRICE LIST TABLE (tab-separated):\n${text}` };
  }
  try {
    // средний `effort`: на низком модель путала этажи, заданные заголовками секций («1 FLOOR», «GROUND FLOOR / OUTSIDE / INSIDE»)
    const res = await api.messages.stream({ model: MODEL, max_tokens: 32000, output_config: { effort: "medium" }, messages: [{ role: "user", content: [source, { type: "text", text: PROMPT }] }] }).finalMessage();
    if (res.stop_reason === "refusal") return { ok: false, reason: "error", message: "refusal" };
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    let o: { currency?: unknown; rows?: unknown };
    try { o = extractJson(text) as typeof o; } catch { return { ok: false, reason: "bad-json", message: text.slice(0, 200) }; }
    if (!Array.isArray(o.rows)) return { ok: false, reason: "bad-json", message: "no rows[]" };
    const rows: AiPriceRow[] = [];
    for (const r of o.rows) {
      if (!Array.isArray(r) || r.length < 2) continue;
      const num = String(r[1] ?? "").trim();
      if (!num) continue;
      const n = (v: unknown) => { const x = typeof v === "number" ? v : parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return Number.isFinite(x) ? x : 0; };
      rows.push({
        block: String(r[0] ?? "").trim().toUpperCase().slice(0, 4), num: num.slice(0, 40), floor: Math.round(n(r[2])),
        type: String(r[3] ?? "").trim().slice(0, 24), area: Math.round(n(r[4]) * 100) / 100, price: Math.round(n(r[5])),
        status: STATUSES.find((s) => s === r[6]) ?? "free",
        ...(r[7] === "ins" || r[7] === "out" ? { band: r[7] } : {}),
      });
    }
    if (!rows.length) return { ok: false, reason: "empty" };
    const cur = (["EUR", "USD", "TRY"] as const).find((c) => c === o.currency) ?? null;
    return { ok: true, rows, currency: cur, truncated: res.stop_reason === "max_tokens" };
  } catch (e) {
    if (e instanceof Anthropic.APIError) { console.error(`[import/price] API error ${e.status}: ${e.message}`); return { ok: false, reason: "error", message: `API ${e.status}` }; }
    console.error("[import/price]", e);
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
