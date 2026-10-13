"use server";

// AI-перевод сообщений чата (прототип `ensureTr`, строки 2694–2717). В прототипе провайдером был
// `window.claude.complete`; здесь — Anthropic Messages API через официальный SDK. Без `ANTHROPIC_API_KEY`
// возвращаем оригинал с пометкой `fallback: true` — UI показывает текст без подписи «переведено».
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import type { DevLang } from "@/lib/dev/types";

const MODEL = process.env.ANTHROPIC_TRANSLATE_MODEL || "claude-haiku-4-5-20251001";
const NAMES: Record<DevLang | "AR", string> = { RU: "Russian", EN: "English", TR: "Turkish", AR: "Arabic" };

export type TranslateResult = { text: string; fallback: boolean; reason?: "no-key" | "no-session" | "error" };

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

/** Translate a chat message into `to`. Returns the original text (with `fallback: true`) when the API is unavailable. */
// Названия мест (Lara, Ermenek, Muratpaşa) во всех языках — латиницей по-турецки, без кириллической транслитерации (правило пользователя 11.10.2026).
const PLACES = "Turkish place names (cities, districts, neighbourhoods, complexes) must keep their Latin Turkish spelling in every language — Lara, Ermenek, Muratpaşa — never transliterate them into Cyrillic.";

export async function translate(text: string, to: DevLang | "AR", kind: "chat" | "description" | "title" | "label" = "chat"): Promise<TranslateResult> {
  const src = (text || "").trim();
  if (!src) return { text: "", fallback: true };
  // Server Functions are reachable by direct POST — only signed-in users may spend tokens (UI mode without Supabase: allowed).
  if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const me = await getCurrentUser();
    if (!me) return { text: src, fallback: true, reason: "no-session" };
  }
  const api = getClient();
  if (!api) return { text: src, fallback: true, reason: "no-key" };
  const target = NAMES[to] || "Russian";
  try {
    const res = await api.messages.create({
      model: MODEL,
      max_tokens: 1024,
      messages: [{
        role: "user",
        content: kind === "label"
          ? `Translate this short CRM pipeline stage / status label into ${target}. It is a UI label of 1–3 words (e.g. "Бронь" → "Booking" / "Rezervasyon"). Reply with ONLY the translated label — no explanations, no quotes, never refuse.\n\n${src}`
          : kind === "title"
          ? `You are a professional real-estate translator. Translate the property listing title below into ${target}. Keep it short (one line), preserve numbers, units and room formulas like 2+1 exactly. ${PLACES} Reply with ONLY the translation.\n\n${src}`
          : kind === "description"
          ? `You are a professional real-estate copywriter and translator. Translate the property description below into ${target}. Keep the marketing tone, preserve numbers, names and units exactly, keep paragraphs. ${PLACES} Reply with ONLY the translation — no quotes, no notes.\n\nText:\n${src}`
          : `You are a translation engine for a real-estate team chat. Translate the message below into ${target}. Keep the tone casual, preserve emoji, numbers, and property codes (like A-104, B-203) exactly. Reply with ONLY the translation — no quotes, no notes.\n\nMessage:\n${src}`,
      }],
    });
    if (res.stop_reason === "refusal") return { text: src, fallback: true, reason: "error" };
    const out = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim().replace(/^["'«»]+|["'«»]+$/g, "");
    // Короткая подпись (этап/статус): модель иногда вместо перевода пишет отказ-объяснение — в базу он попадать не должен
    // (13.10.2026: у этапа «Бронь» в EN/TR лежало «I cannot provide a translation…»). Длинный или многострочный ответ — фоллбэк.
    if (kind === "label" && (out.includes("\n") || out.length > Math.max(40, src.length * 4) || /cannot|unable|sorry|provide/i.test(out))) return { text: src, fallback: true, reason: "error" };
    return out ? { text: out, fallback: false } : { text: src, fallback: true, reason: "error" };
  } catch (e) {
    if (e instanceof Anthropic.APIError) console.error(`[chat/translate] API error ${e.status}: ${e.message}`);
    else console.error("[chat/translate]", e);
    return { text: src, fallback: true, reason: "error" };
  }
}
