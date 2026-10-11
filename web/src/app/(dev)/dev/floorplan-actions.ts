"use server";

// ИИ-разметка поэтажного плана: модель получает картинку экспликации и список ожидаемых квартир этажа,
// возвращает нормализованные (0..1) полигоны по контуру каждой квартиры. Это черновик — пользователь
// правит контуры в режиме обводки. Anthropic Messages API через официальный SDK (как в `chat/actions.ts`).
import Anthropic from "@anthropic-ai/sdk";
import { getCurrentUser } from "@/lib/auth";
import { normNum, parsePoly, type Pt } from "@/lib/dev/floorplan";

const MODEL = process.env.ANTHROPIC_FLOORPLAN_MODEL || "claude-sonnet-5";
// Глубина рассуждений при разметке плана: low — быстро (секунды), но контуры грубые; medium — точнее; high — минуты на план.
const EFFORT = (["low", "medium", "high"] as const).find((e) => e === process.env.ANTHROPIC_FLOORPLAN_EFFORT) ?? "medium";
/** Глубина рассуждений на втором проходе (точный контур одной квартиры на крупном фрагменте). */
const REFINE_EFFORT = (["low", "medium", "high"] as const).find((e) => e === process.env.ANTHROPIC_FLOORPLAN_REFINE_EFFORT) ?? "medium";
const MAX_IMAGE_BYTES = 4.5 * 1024 * 1024; // лимит API на одно изображение — 5 МБ

/** `block` — блок квартиры, когда на одном листе показано несколько блоков (номера в блоках могут повторяться). */
export type ExpectedUnit = { uid: number; num: string | number; type: string; area: number; block?: string; /** уровней у квартиры (дуплекс = 2): паспортная площадь — за все уровни */ levels?: number };
/** Картинка плана: публичный URL из Storage (сервер скачает сам) или base64 из браузера (демо-режим с `blob:`). */
export type PlanImage = { url: string } | { data: string; mediaType: string };
export type DetectResult =
  | { ok: true; units: { uid: number; num: string; poly: Pt[]; stairs?: boolean }[]; unmatched: string[]; /** на чертеже напечатаны номера квартир (иначе номера модели — догадка) */ numbered: boolean }
  | { ok: false; reason: "no-key" | "no-session" | "fetch" | "too-big" | "bad-json" | "error"; message?: string };

type ImageMedia = "image/jpeg" | "image/png" | "image/gif" | "image/webp";
const MEDIA: ImageMedia[] = ["image/jpeg", "image/png", "image/gif", "image/webp"];

let client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!client) client = new Anthropic();
  return client;
}

async function loadImage(src: PlanImage): Promise<{ data: string; mediaType: ImageMedia } | DetectResult> {
  if ("data" in src) {
    const mt = (src.mediaType || "image/png").toLowerCase() as ImageMedia;
    if (!MEDIA.includes(mt)) return { ok: false, reason: "fetch", message: `unsupported media type ${mt}` };
    if (src.data.length * 0.75 > MAX_IMAGE_BYTES) return { ok: false, reason: "too-big" };
    return { data: src.data, mediaType: mt };
  }
  if (!/^https?:\/\//.test(src.url)) return { ok: false, reason: "fetch", message: "not an http(s) url" };
  try {
    const res = await fetch(src.url, { cache: "no-store" });
    if (!res.ok) return { ok: false, reason: "fetch", message: `HTTP ${res.status}` };
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.byteLength > MAX_IMAGE_BYTES) return { ok: false, reason: "too-big" };
    let mt = (res.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    if (mt === "image/jpg") mt = "image/jpeg";
    if (!MEDIA.includes(mt as ImageMedia)) {
      const ext = src.url.split("?")[0].split(".").pop()?.toLowerCase();
      mt = ext === "jpg" || ext === "jpeg" ? "image/jpeg" : ext === "webp" ? "image/webp" : ext === "gif" ? "image/gif" : "image/png";
    }
    return { data: buf.toString("base64"), mediaType: mt as ImageMedia };
  } catch (e) {
    return { ok: false, reason: "fetch", message: e instanceof Error ? e.message : String(e) };
  }
}

/** Первый `{…}` из текста модели → объект (модель иногда оборачивает JSON в ```json … ```). */
function extractJson(text: string): unknown {
  const t = text.replace(/```(?:json)?/gi, "").trim();
  const a = t.indexOf("{"), b = t.lastIndexOf("}");
  if (a < 0 || b <= a) throw new Error("no json object");
  return JSON.parse(t.slice(a, b + 1));
}

/**
 * Разметить квартиры этажа на плане. Возвращает полигоны только для квартир из `expected`
 * (сопоставление по номеру, `normNum`); `unmatched` — номера из ответа, которых нет в списке.
 */
export type DetectOpts = {
  /** Картинка — фрагмент большого листа: вернуть только квартиры, которые видны целиком или почти целиком. */
  tile?: boolean;
  /** Дополнительное указание модели (повторный запрос после неудачи: что было не так в прошлый раз). */
  note?: string;
};
export async function detectFloorAreas(image: PlanImage, expected: ExpectedUnit[], opts: DetectOpts = {}): Promise<DetectResult> {
  if (!Array.isArray(expected) || !expected.length) return { ok: true, units: [], unmatched: [], numbered: false };
  // Server Functions доступны прямым POST — тратить токены могут только вошедшие (в dev с DEV_AUTH_BYPASS — как в upload-actions).
  const bypass = process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";
  if (!bypass && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const me = await getCurrentUser();
    if (!me) return { ok: false, reason: "no-session" };
  }
  const api = getClient();
  if (!api) return { ok: false, reason: "no-key" };
  const img = await loadImage(image);
  if ("ok" in img) return img;

  const blocks = [...new Set(expected.map((u) => u.block || "").filter(Boolean))];
  const multi = blocks.length > 1;
  const list = expected.slice(0, 160).map((u) => `- ${multi ? `block: "${u.block || ""}", ` : ""}num: "${String(u.num).replace(/"/g, "")}", type: ${u.type || "-"}, area: ${u.area || "-"} m²${u.area && (u.levels ?? 1) > 1 ? ` in total over ${u.levels} levels (duplex — its footprint on this sheet is only about ${Math.round(u.area / u.levels!)} m²)` : ""}`).join("\n");
  const blockNote = multi ? `\nThis sheet shows ${blocks.length} building blocks at once: ${blocks.join(", ")}. Use the block labels printed on the drawing ("A BLOK", "B BLOK"...); if the blocks are not labelled, assume they go from left to right in the order ${blocks.join(", ")}. Unit numbers may repeat in different blocks, so return the block of every apartment.\n` : "";
  const tileNote = opts.tile ? `\nIMPORTANT: this image is only a PART (a tile) of the whole floor plan sheet. Return ONLY the apartments that are fully or almost fully visible inside this tile; skip apartments cut by the tile edge and skip apartments that are not in this tile at all. Returning nothing is a valid answer.\n` : "";
  const prompt = `This is an architectural floor plan (экспликация этажа) of a residential building${opts.tile ? " (one tile of the sheet)" : ""}. The floor contains exactly these apartments (number, room type, area):
${list}
${blockNote}${tileNote}${opts.note ? `\n${opts.note}\n` : ""}
Locate each apartment on the drawing by its number label (numbers are usually printed inside the apartment; sometimes with a prefix like "D-12" or "No 12") and, where labels are missing, by matching the room type and area. If the drawing shows no apartment numbers at all, the list above still describes exactly the apartments drawn on this sheet: match them by type/area and assign the rest by elimination in reading order (left to right, then top to bottom); an apartment listed with type "-" and area "-" is a real apartment too — it is the one left over after the others are matched. For every apartment you can find, return the polygon of its outer wall contour.

Coordinates: normalized to the image — x from 0 (left edge) to 1 (right edge), y from 0 (top edge) to 1 (bottom edge), 3 decimals. Each polygon: 4–8 vertices in clockwise order (a rough outline is enough — the exact wall geometry is computed afterwards), following the apartment's walls (balconies/terraces belong to the apartment). Polygons must not overlap each other and must not include corridors, stairs or elevator cores. Skip apartments you cannot locate — never guess. Return only apartments from the list above, using exactly the "num" strings given.

Reply with ONLY a JSON object, no prose, no markdown:
{"numbered":true|false,"units":[{${multi ? '"block":"…",' : ""}"num":"…","polygon":[[x,y],[x,y],…],"stairs":true|false}]}
"numbered" is true only when apartment numbers are actually printed on the drawing (inside the apartments or in a legend) and you matched the list by those labels; false when you assigned numbers by room type / area / elimination.
"stairs" is true only when the apartment contains its OWN internal staircase drawn inside its walls (a duplex/maisonette; rooms labelled like "ANTRE+MERDİVEN", "MERDİVEN", "stairs"), not the building's common stairwell or elevator.`;

  try {
    // Адаптивное мышление модели на этой задаче съедало весь лимит токенов (ответ без текста, ~3 минуты на план).
    // Поэтому: ограниченный `effort` (EFFORT) + стриминг с запасом по `max_tokens`; если текста всё равно нет — повтор без мышления.
    const content: Anthropic.ContentBlockParam[] = [
      { type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } },
      { type: "text", text: prompt },
    ];
    const ask = (noThinking: boolean) => api.messages.stream({
      model: MODEL,
      max_tokens: 32000,
      ...(noThinking ? { thinking: { type: "disabled" as const } } : { output_config: { effort: EFFORT } }),
      messages: [{ role: "user", content }],
    }).finalMessage();
    let res = await ask(false);
    if (res.stop_reason === "max_tokens" && !res.content.some((b) => b.type === "text" && b.text.trim())) res = await ask(true);
    if (res.stop_reason === "refusal") return { ok: false, reason: "error", message: "refusal" };
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    let parsed: unknown;
    try { parsed = extractJson(text); } catch { console.warn(`[floorplan/detect] bad json, stop=${res.stop_reason} out=${res.usage.output_tokens}: ${text.slice(0, 300)}`); return { ok: false, reason: "bad-json", message: text.slice(0, 200) }; }
    const raw = (parsed as { units?: unknown })?.units;
    if (!Array.isArray(raw)) return { ok: false, reason: "bad-json", message: "no units[]" };
    const byNum = new Map<string, ExpectedUnit>();
    const keyOf = (block: unknown, num: unknown) => `${multi ? String(block ?? "").trim().toUpperCase().replace(/\s*BLO[CK]K?\s*/i, "") : ""}|${normNum(String(num ?? ""))}`;
    for (const u of expected) { const k = keyOf(u.block, u.num); if (normNum(u.num) && !byNum.has(k)) byNum.set(k, u); }
    const seen = new Set<number>();
    const units: { uid: number; num: string; poly: Pt[]; stairs?: boolean }[] = [];
    const unmatched: string[] = [];
    for (const item of raw) {
      if (!item || typeof item !== "object") continue;
      const o = item as { block?: unknown; num?: unknown; polygon?: unknown; poly?: unknown; stairs?: unknown };
      const poly = parsePoly(o.polygon ?? o.poly);
      const num = String(o.num ?? "");
      const hit = byNum.get(keyOf(o.block, num));
      if (!poly) continue;
      if (!hit || seen.has(hit.uid)) { unmatched.push(num); continue; }
      seen.add(hit.uid);
      units.push({ uid: hit.uid, num: String(hit.num), poly, ...(o.stairs === true ? { stairs: true } : {}) });
    }
    console.log(`[floorplan/detect] stop=${res.stop_reason} in=${res.usage.input_tokens} out=${res.usage.output_tokens} returned=${raw.length} matched=${units.length} unmatched=${unmatched.length}${unmatched.length ? " (" + unmatched.slice(0, 8).join(",") + ")" : ""}${opts.note ? " note" : ""}${opts.tile ? " tile" : ""}${(parsed as { numbered?: unknown }).numbered === true ? " numbered" : " unnumbered"} polys ${units.map((u) => `${u.num}${u.stairs ? "*" : ""}:${u.poly.map((p) => p.map((v) => v.toFixed(2)).join(",")).join(";")}`).join(" | ")}`);
    return { ok: true, units, unmatched, numbered: (parsed as { numbered?: unknown }).numbered === true };
  } catch (e) {
    if (e instanceof Anthropic.APIError) { console.error(`[floorplan/detect] API error ${e.status}: ${e.message}`); return { ok: false, reason: "error", message: `API ${e.status}` }; }
    console.error("[floorplan/detect]", e);
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export type PageClass =
  | { ok: true; block: string; blocks: string[]; kind: "typical" | "ground" | "basement" | "floor" | "attic" | "other"; floors: number[]; title: string; /** что на листе: квартиры, паркинг, соцзона (бассейн, спортзал, сауна), техэтаж */ content: "apartments" | "parking" | "social" | "technical" | "other" }
  | { ok: false; reason: "no-key" | "no-session" | "fetch" | "too-big" | "bad-json" | "error"; message?: string };

/**
 * Что изображено на листе плана: блок и этаж(и) — по штампу/подписи чертежа («B-BLOK NORMAL KAT PLANI», «ZEMİN KAT»,
 * «1. BODRUM», «ÇATI ARASI», «3. KAT»…). Используется мастером «Объект из файлов» для раскладки листов по этажам;
 * результат — подсказка, пользователь может поправить.
 */
export async function classifyPlanPage(image: PlanImage): Promise<PageClass> {
  const bypass = process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";
  if (!bypass && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const me = await getCurrentUser();
    if (!me) return { ok: false, reason: "no-session" };
  }
  const api = getClient();
  if (!api) return { ok: false, reason: "no-key" };
  const img = await loadImage(image);
  if ("ok" in img) return img as PageClass;
  const prompt = `This is one sheet from an architectural drawing set of a residential building (Turkish / Russian / English labels). Read the title block / caption of the sheet and tell which building block and which floor(s) it shows.

Reply with ONLY a JSON object, no prose:
{"blocks":["A"],"kind":"typical","floors":[],"title":"B-BLOK NORMAL KAT PLANI","content":"apartments"}

- "blocks": the block/building letters or numbers this sheet shows, from the title or from labels on the drawing ("A BLOK" -> ["A"]; a sheet of the whole building with both "A BLOK" and "B BLOK" -> ["A","B"]); [] if no block is named anywhere.
- "kind": one of
  "typical"  - a normal/typical floor plan repeated on several floors ("NORMAL KAT", "TİP KAT", "типовой этаж") with no single floor number;
  "ground"   - ground floor ("ZEMİN KAT", "ground floor", "цоколь", "первый наземный");
  "basement" - basement / parking level ("BODRUM", "OTOPARK", "подвал");
  "floor"    - a plan of specific numbered floor(s) ("3. KAT", "2-4. KATLAR") - put the numbers into "floors";
  "attic"    - attic / roof level / upper level of duplexes ("ÇATI ARASI", "ÇATI KATI", "мансарда");
  "other"    - site plan, facade, section, anything that is not a floor plan.
- "floors": floor numbers for kind "floor" (ground = 0) and for kind "basement" ("BODRUM" / "1. BODRUM" = -1, "2. BODRUM" = -2), otherwise [].
- "title": the caption text exactly as printed (max 80 chars), "" if none.
- "content": what the drawing actually shows, regardless of the title: "apartments" (flats with rooms), "parking" (car spaces, ramps, "OTOPARK"), "social" (pool, gym, sauna, lounge, cinema, kids room - a social/amenity floor), "technical" (plant rooms, tanks), "other".`;
  try {
    // чтение штампа листа — простая задача: без мышления, иначе короткий `max_tokens` может уйти на рассуждения
    const res = await api.messages.create({
      model: MODEL,
      max_tokens: 1000,
      thinking: { type: "disabled" },
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } }, { type: "text", text: prompt }] }],
    });
    if (res.stop_reason === "refusal") return { ok: false, reason: "error", message: "refusal" };
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    let o: { block?: unknown; blocks?: unknown; kind?: unknown; floors?: unknown; title?: unknown; content?: unknown };
    try { o = extractJson(text) as typeof o; } catch { return { ok: false, reason: "bad-json", message: text.slice(0, 200) }; }
    const kinds = ["typical", "ground", "basement", "floor", "attic", "other"] as const;
    const kind = kinds.find((k) => k === o.kind) ?? "other";
    const floors = Array.isArray(o.floors) ? o.floors.map((x) => Math.round(Number(x))).filter((x) => Number.isFinite(x) && x > -10 && x < 100) : [];
    const blocks = (Array.isArray(o.blocks) ? o.blocks : o.block ? [o.block] : []).map((x) => String(x ?? "").trim().toUpperCase().slice(0, 3)).filter(Boolean);
    const contents = ["apartments", "parking", "social", "technical", "other"] as const;
    const content = contents.find((c) => c === o.content) ?? "other";
    return { ok: true, block: blocks[0] ?? "", blocks, kind, floors, title: String(o.title ?? "").slice(0, 80), content };
  } catch (e) {
    if (e instanceof Anthropic.APIError) { console.error(`[floorplan/classify] API error ${e.status}: ${e.message}`); return { ok: false, reason: "error", message: `API ${e.status}` }; }
    console.error("[floorplan/classify]", e);
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}

export type RefineResult = { ok: true; poly: Pt[] | null } | { ok: false; reason: "no-key" | "no-session" | "fetch" | "too-big" | "bad-json" | "error"; message?: string };
/**
 * Второй проход разметки: крупный фрагмент листа вокруг одной квартиры. Модель возвращает точный контур квартиры,
 * которая находится в центре фрагмента (по номеру, если он напечатан, иначе — по положению). Координаты — доли фрагмента.
 */
export async function refineUnitArea(image: PlanImage, unit: ExpectedUnit, roughCenter: [number, number]): Promise<RefineResult> {
  const bypass = process.env.NODE_ENV === "development" && process.env.DEV_AUTH_BYPASS === "1";
  if (!bypass && process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
    const me = await getCurrentUser();
    if (!me) return { ok: false, reason: "no-session" };
  }
  const api = getClient();
  if (!api) return { ok: false, reason: "no-key" };
  const img = await loadImage(image);
  if ("ok" in img) return img as RefineResult;
  const prompt = `This is an enlarged fragment of an architectural floor plan with guide lines drawn on top of it:
- the RED solid outline is a rough, imprecise guess of the target apartment: number "${String(unit.num).replace(/"/g, "")}"${unit.block ? `, block ${unit.block}` : ""}, type ${unit.type || "-"}, area ${unit.area || "-"} m² (its centre is near x=${roughCenter[0].toFixed(3)}, y=${roughCenter[1].toFixed(3)} of the fragment);
- GREY dashed outlines are rough guesses of neighbouring apartments — they are NOT the target.

Correct the red outline so that it follows the apartment's real OUTER walls exactly: the thick exterior and party walls drawn on the plan, including the apartment's balconies and terraces, excluding corridors, stairs, shafts and the neighbouring apartments. Keep the same apartment the red line is on (move it only if the red line clearly sits on the wrong apartment and the printed number proves it). Use 4–16 vertices, clockwise, corners at the actual wall corners. Coordinates: x, y in 0..1 of THIS fragment, 4 decimals.

Reply with ONLY JSON, no prose: {"found":true,"polygon":[[x,y],…]} or {"found":false} if the apartment is not in this fragment.`;
  try {
    const res = await api.messages.stream({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: REFINE_EFFORT },
      messages: [{ role: "user", content: [{ type: "image", source: { type: "base64", media_type: img.mediaType, data: img.data } }, { type: "text", text: prompt }] }],
    }).finalMessage();
    if (res.stop_reason === "refusal") return { ok: false, reason: "error", message: "refusal" };
    const text = res.content.filter((b) => b.type === "text").map((b) => b.text).join("").trim();
    let o: { found?: unknown; polygon?: unknown };
    try { o = extractJson(text) as typeof o; } catch { return { ok: false, reason: "bad-json", message: text.slice(0, 160) }; }
    if (o.found === false) return { ok: true, poly: null };
    return { ok: true, poly: parsePoly(o.polygon) };
  } catch (e) {
    if (e instanceof Anthropic.APIError) { console.error(`[floorplan/refine] API error ${e.status}: ${e.message}`); return { ok: false, reason: "error", message: `API ${e.status}` }; }
    return { ok: false, reason: "error", message: e instanceof Error ? e.message : String(e) };
  }
}
