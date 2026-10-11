// Типы планировок (§4.10, §5.5): автотипы по комнатности + м² (+ спецтег дуплекс/терс-дуплекс/триплекс: `getPT` 2961,
// `nextTypeName`, `autoTypeInfo`, `ensureAutoType`, `ptFor`), зеркальные типы `Tip A-L`/`Tip A-R` по контурам (`applyMirrorSplit`),
// изображения/PDF для модалки квартиры (`MM.main` 3739–3750, `modalPdf` 4136).
import { asset, isSpecialType, typeLabel } from "./data";
import { fpKey, unitFloors, type Pt } from "./floorplan";
import { isMirrorPoly } from "./mirror";
import type { PlanType, PlanTypeTag, Project, Unit } from "./types";

const TAG_ORDER: Record<string, number> = { "": 0, duplex: 1, tduplex: 2, triplex: 3 };
const tagKey = (t: string | null | undefined) => t || "";
/** Порядок спецтегов в списках: обычные → дуплекс → терс-дуплекс → триплекс. */
export const ptTagRank = (t: string | null | undefined) => TAG_ORDER[tagKey(t)] ?? 9;
const byRooms = (a: PlanType, b: PlanType) => a.rooms.localeCompare(b.rooms) || (TAG_ORDER[tagKey(a.tag)] ?? 9) - (TAG_ORDER[tagKey(b.tag)] ?? 9) || a.area - b.area;

/** Спецтег юнита, влияющий на тип планировки (`duplex|tduplex|triplex`); прочие теги (kapici/ofis/terrace) — не влияют. */
export const ptTagOf = (u: Pick<Unit, "tag"> | { tag?: string | null }): PlanTypeTag | undefined => (u.tag === "duplex" || u.tag === "tduplex" || u.tag === "triplex" ? u.tag : undefined);
/** Ключ группы типов: комнатность + спецтег (`2+1|duplex`). */
export const ptGroupKey = (x: { rooms: string; tag?: string | null }) => `${x.rooms}|${tagKey(x.tag)}`;
export const parseGroupKey = (k: string): { rooms: string; tag?: PlanTypeTag } => { const [rooms, tag] = k.split("|"); return { rooms, ...(tag ? { tag: tag as PlanTypeTag } : {}) }; };
type LabelDict = { rooms_commercial: string; type_sosyal: string; type_otopark: string; type_teknik: string; pt_dup: string; pt_tdup: string; pt_trip: string };
/** Подпись спецтега: «Дуплекс» / «Терс-дуплекс» / «Триплекс». */
export const ptTagLabel = (tag: string | null | undefined, L: Pick<LabelDict, "pt_dup" | "pt_tdup" | "pt_trip">): string => (tag === "duplex" ? L.pt_dup : tag === "tduplex" ? L.pt_tdup : tag === "triplex" ? L.pt_trip : "");
/** Подпись группы типа: «2+1 · Дуплекс» / «2+1» / «Соц. зона». */
export const ptRoomsLabel = (pt: { rooms: string; tag?: string | null }, L: LabelDict): string => { const tl = ptTagLabel(pt.tag, L); return tl ? `${typeLabel(pt.rooms, L)} · ${tl}` : typeLabel(pt.rooms, L); };
/** Имя типа без суффикса зеркальности (`Tip A-L` → `Tip A`). */
export const ptBaseName = (name: string) => String(name).trim().replace(/-(L|R)$/, "");

// ───── картинки «с плана» ─────
// `autoImgs` хранит вырезку каждой обведённой квартиры (ключ `uid|wing|floor`) — это нужно, чтобы удаление одного контура
// не лишало тип картинки. Показываем без дублей: у всех квартир типа одна планировка, поэтому берём вырезки ОДНОЙ
// квартиры-представителя — по одной на уровень (обычная: 1, дуплекс: нижний + верхний, триплекс: 3).
// Представитель — квартира с наибольшим числом уровней, из них — с самой свежей вырезкой (перерисовал контур → тип обновился).
const uidOfKey = (k: string) => +k.split("|")[0];
const floorOfKey = (k: string) => +(k.split("|")[2] ?? 0);
/** Метка времени загрузки из имени файла Storage (`…/1790113374639-xxxx-unit-7.jpg`); 0 — если нет. */
const stampOf = (url: string) => { const m = String(url).match(/\/(\d{13})-[a-z0-9]+-unit-/); return m ? +m[1] : 0; };
/** Сколько уровней (= картинок «с плана») у типа: обычная квартира — 1, дуплекс/терс-дуплекс — 2, триплекс — 3. */
const levelsOf = (pt: { tag?: string | null }) => (pt.tag === "triplex" ? 3 : pt.tag === "duplex" || pt.tag === "tduplex" ? 2 : 1);
/**
 * Вырезки одной квартиры в порядке уровней (нижний первым), не больше числа уровней типа. Лишние записи одной квартиры
 * (старый формат ключа, вырезка с плана другого этажа после переноса квартиры) отбрасываются — остаются самые свежие,
 * поэтому у обычной квартиры всегда одна картинка, а не две одинаковые.
 */
export function unitAutoImgs(pt: Pick<PlanType, "autoImgs" | "tag">, uid: number): string[] {
  const mine = Object.entries(pt.autoImgs ?? {}).filter(([k]) => uidOfKey(k) === uid);
  const keep = mine.length > levelsOf(pt) ? [...mine].sort(([, a], [, b]) => stampOf(b) - stampOf(a)).slice(0, levelsOf(pt)) : mine;
  return keep.sort(([a], [b]) => floorOfKey(a) - floorOfKey(b)).map(([, u]) => u);
}
/** Вырезки «с плана» без дублей: по одной на уровень от квартиры-представителя (см. выше). */
export function autoImgList(pt: Pick<PlanType, "autoImgs" | "tag">): string[] {
  const byUid = new Map<number, string[]>();
  Object.keys(pt.autoImgs ?? {}).forEach((k) => { const uid = uidOfKey(k); if (!byUid.has(uid)) byUid.set(uid, unitAutoImgs(pt, uid)); });
  let best: number | null = null, bestN = 0, bestTs = -1;
  byUid.forEach((urls, uid) => {
    const ts = Math.max(0, ...urls.map(stampOf));
    if (urls.length > bestN || (urls.length === bestN && (ts > bestTs || (ts === bestTs && best != null && uid > best)))) { best = uid; bestN = urls.length; bestTs = ts; }
  });
  return best == null ? [] : byUid.get(best) ?? [];
}
/** Все картинки типа для показа: сначала план (вырезки с поэтажного плана, без дублей), затем загруженные вручную
 * (`imgs` — фото, рендеры, свои планы; общие для всех квартир типа, в заданном порядке). */
export const allImgs = (pt: Pick<PlanType, "imgs" | "autoImgs" | "tag">): string[] => [...autoImgList(pt), ...pt.imgs];
/** Картинки «с плана» в порядке показа `allImgs` (ручные идут первыми) — множество URL для бейджа. */
export const autoImgSet = (pt: Pick<PlanType, "autoImgs">): Set<string> => new Set(Object.values(pt.autoImgs ?? {}));

/** Special types (`sosyal`/`otopark`/`teknik`) are grouped by type only — the area may be 0 — so plan images can be attached; `1*` is skipped. */
export const ptKeyArea = (u: Pick<Unit, "type" | "area">) => (isSpecialType(u.type) ? 0 : +(u.area || 0));
const isPtType = (t: string) => !!t && t !== "1*";
/** Существующий автотип для rooms/area/tag (+ блок для спец-типов; старые спец-типы без `wing` подходят любому блоку, если нет своего).
 * Старые типы без `tag` считаются «без тега». Зеркальные (`mirrorOf`) типы автоподбором не выдаются — только базовый. */
export function findAutoType(list: PlanType[], rooms: string, area: number, wing?: string, tag?: PlanTypeTag | null): PlanType | undefined {
  if (!isSpecialType(rooms)) {
    const k = tagKey(tag);
    const hit = (x: PlanType) => x.rooms === rooms && +x.area === area && tagKey(x.tag) === k;
    return list.find((x) => hit(x) && !x.mirrorOf && x.shape == null) || list.find((x) => hit(x) && !x.mirrorOf) || list.find(hit);
  }
  const w = wing || "";
  return list.find((x) => x.rooms === rooms && !x.manual && (x.wing || "") === w && x.wing !== undefined) || list.find((x) => x.rooms === rooms && !x.manual && x.wing === undefined);
}
/** Дописывает в список автотипы, которых ещё нет (новые комнатности/площади/теги/спец-типы по блокам) — список не пересобирается. */
export function syncAutoTypes(list: PlanType[], units: Unit[]): PlanType[] {
  let out = list;
  units.forEach((u) => {
    if (!isPtType(u.type) || u.ptId) return;
    const a = ptKeyArea(u), w = isSpecialType(u.type) ? (u.wing || "") : undefined, tag = ptTagOf(u);
    if (findAutoType(out, u.type, a, w, tag)) return;
    out = ensureAutoType(out, u.type, u.area, w, tag).list;
  });
  return relocateAutoImgs(out, units);
}
/**
 * Вырезки «с плана» должны лежать в типе своей квартиры. Они могут оказаться в чужом: квартиру обвели, когда её точного типа
 * ещё не было (вырезка ушла в первый тип той же комнатности), или потом поменяли комнаты/площадь/тег. Переносит такие записи
 * в актуальный тип (`ptFor`); вырезки удалённых квартир убирает. Возвращает тот же список, если менять нечего.
 */
export function relocateAutoImgs(list: PlanType[], units: Unit[]): PlanType[] {
  const byUid = new Map(units.map((u) => [u.uid, u]));
  const moves: { from: number; to: number | null; key: string; url: string }[] = [];
  list.forEach((pt) => Object.entries(pt.autoImgs ?? {}).forEach(([key, url]) => {
    const u = byUid.get(uidOfKey(key));
    const home = u ? ptFor(list, u) : null;
    if (!home || home.id !== pt.id) moves.push({ from: pt.id, to: home ? home.id : null, key, url });
  }));
  if (!moves.length) return list;
  return list.map((pt) => {
    const out = moves.filter((m) => m.from === pt.id), inc = moves.filter((m) => m.to === pt.id);
    if (!out.length && !inc.length) return pt;
    const a = { ...(pt.autoImgs ?? {}) };
    out.forEach((m) => { delete a[m.key]; });
    inc.forEach((m) => { a[m.key] = m.url; });
    return { ...pt, autoImgs: a };
  });
}
/** Автосписок при первом обращении: группировка `type|tag|area` (кроме `1*`; спец-типы — только по типу), имена `Tip A/B/…` внутри `type|tag`. */
export function buildAutoTypes(units: Unit[]): PlanType[] {
  const groups: Record<string, { rooms: string; area: number; wing?: string; tag?: PlanTypeTag }> = {};
  units.forEach((u) => { const t = isPtType(u.type) ? u.type : null; if (!t) return; const a = ptKeyArea(u); const sp = isSpecialType(t); const w = sp ? (u.wing || "") : undefined; const tag = sp ? undefined : ptTagOf(u); const k = t + "|" + tagKey(tag) + "|" + a + (w !== undefined ? "|" + w : ""); if (!groups[k]) groups[k] = { rooms: t, area: a, wing: w, tag }; });
  const arr = Object.values(groups).sort((a, b) => a.rooms.localeCompare(b.rooms) || (TAG_ORDER[tagKey(a.tag)] ?? 9) - (TAG_ORDER[tagKey(b.tag)] ?? 9) || a.area - b.area || (a.wing || "").localeCompare(b.wing || ""));
  const cnt: Record<string, number> = {};
  let id = 1;
  // Спец-типы (соц. зона, паркинг…) — свои в каждом блоке: «Blok A», «Blok B».
  return arr.map((g) => { const gk = ptGroupKey(g); cnt[gk] = (cnt[gk] || 0) + 1; const name = g.wing !== undefined ? (g.wing ? `Blok ${g.wing}` : "Tip A") : "Tip " + String.fromCharCode(64 + cnt[gk]); return { id: id++, name, rooms: g.rooms, area: g.area, imgs: [], ...(g.wing !== undefined ? { wing: g.wing } : {}), ...(g.tag ? { tag: g.tag } : {}) }; });
}
/** Следующее свободное имя `Tip A/B/…` внутри комнатности + тега (`Tip A-L`/`Tip A-R` занимают «Tip A»). */
export function nextTypeName(list: PlanType[], rooms: string, tag?: PlanTypeTag | null): string {
  const k = tagKey(tag);
  const used = list.filter((x) => x.rooms === rooms && tagKey(x.tag) === k).map((x) => ptBaseName(x.name));
  let i = 0, name: string;
  do { name = "Tip " + String.fromCharCode(65 + i); i++; } while (used.includes(name) && i < 26);
  return name;
}
export function autoTypeInfo(list: PlanType[], rooms: string, area: number, wing?: string, tag?: PlanTypeTag | null): { type: PlanType | null; isNew: boolean; name: string } {
  area = ptKeyArea({ type: rooms, area });
  const ex = findAutoType(list, rooms, area, wing, tag);
  if (ex) return { type: ex, isNew: false, name: ex.name };
  return { type: null, isNew: true, name: nextTypeName(list, rooms, tag) };
}
/** Создаёт автотип при сохранении квартиры (2985). Возвращает новый список (или тот же, если тип есть). */
export function ensureAutoType(list: PlanType[], rooms: string, area: number, wing?: string, tag?: PlanTypeTag | null): { list: PlanType[]; type: PlanType } {
  area = ptKeyArea({ type: rooms, area });
  const ex = findAutoType(list, rooms, area, wing, tag);
  if (ex) return { list, type: ex };
  const special = isSpecialType(rooms);
  const type: PlanType = { id: Math.max(0, ...list.map((x) => x.id)) + 1, name: special ? (wing ? `Blok ${wing}` : "Tip A") : nextTypeName(list, rooms, tag), rooms, area, imgs: [], ...(special ? { wing: wing || "" } : {}), ...(!special && tag ? { tag } : {}) };
  return { list: [...list, type].sort(byRooms), type };
}
/** Тип для юнита (2993): `ptId` → точное совпадение rooms+area+tag → первое совпадение rooms+tag (юнит с тегом ищет только типы с тем же тегом). */
export function ptFor(list: PlanType[], u: Unit): PlanType | null {
  if (u.ptId) { const p = list.find((x) => x.id === u.ptId); if (p) return p; }
  if (!isPtType(u.type)) return null;
  if (isSpecialType(u.type)) return findAutoType(list, u.type, 0, u.wing) || null;
  const k = tagKey(ptTagOf(u));
  return findAutoType(list, u.type, ptKeyArea(u), undefined, ptTagOf(u)) || list.find((x) => x.rooms === u.type && tagKey(x.tag) === k && !x.mirrorOf) || list.find((x) => x.rooms === u.type && tagKey(x.tag) === k) || null;
}
/** Сколько квартир привязано к каждому типу. */
export function ptCounts(list: PlanType[], units: Unit[]): Record<number, number> {
  const cnt: Record<number, number> = {};
  units.forEach((u) => { const p = ptFor(list, u); if (p) cnt[p.id] = (cnt[p.id] || 0) + 1; });
  return cnt;
}
/** Новый ручной тип `Tip X` для комнатности (+ спецтега) (`ptAdd` 4045). */
export function addManualType(list: PlanType[], rooms: string, tag?: PlanTypeTag | null): { list: PlanType[]; id: number } {
  const k = tagKey(tag);
  const grp = list.filter((x) => x.rooms === rooms && tagKey(x.tag) === k);
  const nid = Math.max(0, ...list.map((x) => x.id)) + 1;
  const used = new Set(grp.map((x) => ptBaseName(x.name)));
  let li = grp.length;
  while (used.has("Tip " + String.fromCharCode(65 + li)) && li < 25) li++;
  return { list: [...list, { id: nid, name: "Tip " + String.fromCharCode(65 + li), rooms, area: 0, imgs: [], manual: true, ...(tag && !isSpecialType(rooms) ? { tag } : {}) }], id: nid };
}
/** Комнатности объекта для чипов/селектов (все `type`, кроме `1*`; спец-типы — после квартир). */
export const roomsOf = (units: Unit[]) => {
  const all = [...new Set(units.map((u) => u.type).filter(isPtType))];
  return [...all.filter((t) => !isSpecialType(t)).sort(), ...all.filter(isSpecialType).sort()];
};
/** Группы типов объекта для чипов модалки: комнатность + спецтег («2+1», «2+1 · Дуплекс»); спец-типы — после квартир. */
export function ptGroupsOf(units: Unit[], list: PlanType[] = []): { rooms: string; tag?: PlanTypeTag }[] {
  const seen = new Map<string, { rooms: string; tag?: PlanTypeTag }>();
  const add = (rooms: string, tag?: PlanTypeTag) => { if (!isPtType(rooms)) return; const g = { rooms, ...(tag && !isSpecialType(rooms) ? { tag } : {}) }; const k = ptGroupKey(g); if (!seen.has(k)) seen.set(k, g); };
  units.forEach((u) => add(u.type, ptTagOf(u)));
  list.forEach((pt) => { if (pt.manual) add(pt.rooms, pt.tag); });
  const arr = [...seen.values()];
  const cmp = (a: { rooms: string; tag?: string }, b: { rooms: string; tag?: string }) => a.rooms.localeCompare(b.rooms) || (TAG_ORDER[tagKey(a.tag)] ?? 9) - (TAG_ORDER[tagKey(b.tag)] ?? 9);
  return [...arr.filter((g) => !isSpecialType(g.rooms)).sort(cmp), ...arr.filter((g) => isSpecialType(g.rooms)).sort(cmp)];
}

// ───── зеркальные планировки (Tip A-L / Tip A-R) ─────
/** Контур юнита с поэтажного плана в пикселях плана (первый найденный этаж; для дуплекса/триплекса — нижний уровень). */
export function unitPoly(project: Pick<Project, "floorPlans">, u: Unit): Pt[] | undefined {
  const fps = project.floorPlans;
  if (!fps) return undefined;
  for (const f of unitFloors(u)) {
    const plan = fps[fpKey(u.wing || "", f)];
    const a = plan?.areas.find((x) => x.uid === u.uid);
    if (plan && a && a.poly.length >= 3) return a.poly.map(([x, y]) => [x * (plan.w || 1), y * (plan.h || 1)] as Pt);
  }
  return undefined;
}
export type MirrorSplitResult = { list: PlanType[]; units: Unit[]; created: number; moved: number };
/** Контур юнита + ключ плана и X центроида (0..1) — для определения «левая/правая» по положению на плане. */
function unitPolyInfo(project: Pick<Project, "floorPlans">, u: Unit): { poly: Pt[]; key: string; cx: number } | undefined {
  const fps = project.floorPlans;
  if (!fps) return undefined;
  for (const f of unitFloors(u)) {
    const key = fpKey(u.wing || "", f), plan = fps[key];
    const a = plan?.areas.find((x) => x.uid === u.uid);
    if (plan && a && a.poly.length >= 3) return { poly: a.poly.map(([x, y]) => [x * (plan.w || 1), y * (plan.h || 1)] as Pt), key, cx: a.poly.reduce((s, p) => s + p[0], 0) / a.poly.length };
  }
  return undefined;
}
/**
 * Раскладка квартир одного автотипа (комнаты + площадь + тег) по ФОРМЕ контура на поэтажном плане. Идемпотентно.
 *  • зеркальные → пара `Tip A-L` / `Tip A-R` (`mirrorOf`); «L» — та ориентация, что на плане стоит левее своей зеркальной пары;
 *  • другая планировка при тех же комнатах и площади (например, в другом блоке), если таких квартир ≥ 2 → отдельный тип
 *    (`shape` = id исходного типа; со своей парой -L/-R, если есть обе ориентации);
 *  • квартиры, обведённые позже, сравниваются с эталонами уже созданных типов (квартиры с `ptId`) и попадают в нужный;
 *  • вырезки `autoImgs` переезжают вместе с квартирой. Ручные и спец-типы, а также квартиры с `ptId` не трогаются.
 * `created` — сколько типов создано, `moved` — сколько квартир получили другой тип.
 */
export function applyMirrorSplit(list: PlanType[], units: Unit[], project: Pick<Project, "floorPlans">): MirrorSplitResult {
  if (!project.floorPlans || !Object.keys(project.floorPlans).length) return { list, units, created: 0, moved: 0 };
  let out = list, us = units, created = 0, moved = 0;
  const info: Record<number, { poly: Pt[]; key: string; cx: number } | undefined> = {};
  units.forEach((u) => { info[u.uid] = unitPolyInfo(project, u); });
  const rel = (a: number, b: number) => { const x = info[a], y = info[b]; return x && y ? isMirrorPoly(x.poly, y.poly) : null; };
  const nextId = () => Math.max(0, ...out.map((x) => x.id)) + 1;
  /** класс A стоит на планах левее класса B? (сравниваем средний X центроидов на общих планах) */
  const leftOf = (A: number[], B: number[]) => {
    const mean = (ids: number[], key: string) => { const xs = ids.map((i) => info[i]).filter((v) => v && v.key === key).map((v) => v!.cx); return xs.length ? xs.reduce((s, x) => s + x, 0) / xs.length : null; };
    let l = 0, r = 0;
    new Set(A.map((i) => info[i]?.key).filter(Boolean) as string[]).forEach((key) => { const a = mean(A, key), b = mean(B, key); if (a == null || b == null) return; if (a < b) l++; else if (a > b) r++; });
    return l >= r;
  };
  /** перевести квартиры в тип `to` (null = вернуть в исходный автотип) вместе с их вырезками */
  const assign = (uids: number[], to: number | null, home: number) => {
    const set = new Set(uids.filter((id) => (us.find((u) => u.uid === id)?.ptId ?? null) !== to));
    if (!set.size) return;
    const target = to ?? home;
    const carry: Record<string, string> = {};
    out = out.map((x) => { if (x.id === target || !x.autoImgs) return x; const keep: Record<string, string> = {}; let hit = false; Object.entries(x.autoImgs).forEach(([k, v]) => { if (set.has(uidOfKey(k))) { carry[k] = v; hit = true; } else keep[k] = v; }); return hit ? { ...x, autoImgs: keep } : x; });
    if (Object.keys(carry).length) out = out.map((x) => (x.id === target ? { ...x, autoImgs: { ...(x.autoImgs ?? {}), ...carry } } : x));
    us = us.map((u) => (set.has(u.uid) ? { ...u, ptId: to ?? undefined } : u));
    moved += set.size;
  };
  /** зеркальный тип для `b` (создаёт `-R` и переименовывает базовый в `-L`, если пары ещё нет) */
  const mirrorTypeOf = (b: PlanType): PlanType => {
    const ex = out.find((x) => x.mirrorOf === b.id);
    if (ex) return ex;
    const base = ptBaseName(b.name);
    const m: PlanType = { id: nextId(), name: `${base}-R`, rooms: b.rooms, area: b.area, imgs: [], mirrorOf: b.id, ...(b.tag ? { tag: b.tag } : {}) };
    out = [...out.map((x) => (x.id === b.id ? { ...x, name: `${base}-L` } : x)), m].sort(byRooms);
    created++;
    return m;
  };
  /** поменять местами имена -L/-R у пары, если «R» на планах стоит левее «L» (только пока имена авто-шаблонные) */
  const orient = (bId: number, Lids: number[], Rids: number[]) => {
    const b = out.find((x) => x.id === bId), m = out.find((x) => x.mirrorOf === bId);
    if (!b || !m || !Lids.length || !Rids.length || leftOf(Lids, Rids)) return;
    const bl = /-L$/.test(b.name) && /-R$/.test(m.name), br = /-R$/.test(b.name) && /-L$/.test(m.name);
    if ((!bl && !br) || ptBaseName(b.name) !== ptBaseName(m.name)) return;
    // «L» должна быть левее: сейчас левее класс Rids — он должен называться -L
    const rIsM = us.some((u) => Rids.includes(u.uid) && u.ptId === m.id);
    const leftType = rIsM ? m.id : b.id;
    const want = (x: PlanType) => `${ptBaseName(x.name)}-${x.id === leftType ? "L" : "R"}`;
    if (want(b) === b.name && want(m) === m.name) return; // уже названы правильно
    out = out.map((x) => (x.id === b.id || x.id === m.id ? { ...x, name: want(x) } : x));
  };

  const roots = list.filter((pt) => !pt.manual && pt.mirrorOf == null && pt.shape == null && !isSpecialType(pt.rooms));
  for (const root of roots) {
    const cands = us.filter((u) => !u.ptId && info[u.uid] && ptFor(out, u)?.id === root.id).map((u) => u.uid);
    if (!cands.length) continue;
    // уже существующие типы этой группы (зеркальный, «другая планировка» и их зеркальные) и их эталоны — квартиры с ptId
    const fams = () => out.filter((x) => x.id !== root.id && (x.mirrorOf === root.id || x.shape === root.id || (x.mirrorOf != null && out.find((b) => b.id === x.mirrorOf)?.shape === root.id)));
    const refsOf = (tid: number) => us.filter((u) => u.ptId === tid && info[u.uid]).slice(0, 4).map((u) => u.uid);
    let pool = [...cands];
    const rootL: number[] = [];
    // 1) сравнение с эталонами существующих типов
    for (const sib of fams()) {
      const refs = refsOf(sib.id);
      if (!refs.length) continue;
      const same: number[] = [], mir: number[] = [];
      pool.forEach((id) => { let sm = 0, mr = 0; refs.forEach((r) => { const v = rel(id, r); if (v?.mirror) mr++; else if (v?.same) sm++; }); if (sm > mr) same.push(id); else if (mr > 0) mir.push(id); });
      if (same.length) { assign(same, sib.id, root.id); pool = pool.filter((id) => !same.includes(id)); }
      if (mir.length) {
        const partnerId = sib.mirrorOf ?? mirrorTypeOf(sib).id;
        if (partnerId === root.id) rootL.push(...mir); else assign(mir, partnerId, root.id);
        pool = pool.filter((id) => !mir.includes(id));
      }
    }
    // 2) корневая планировка: эталон — уже определённые «L» корня, иначе первая квартира пула (пока у корня нет ни одного другого типа)
    if (pool.length && (rootL.length || !fams().some((x) => refsOf(x.id).length))) {
      const ref = rootL.length ? rootL : [pool[0]];
      if (!rootL.length) { rootL.push(pool[0]); pool = pool.slice(1); }
      const same: number[] = [], mir: number[] = [];
      pool.forEach((id) => { let sm = 0, mr = 0; ref.slice(0, 4).forEach((r) => { const v = rel(id, r); if (v?.mirror) mr++; else if (v?.same) sm++; }); if (mr > sm) mir.push(id); else if (sm > 0) same.push(id); });
      rootL.push(...same);
      pool = pool.filter((id) => !same.includes(id) && !mir.includes(id));
      if (mir.length) { const b = out.find((x) => x.id === root.id)!; assign(mir, mirrorTypeOf(b).id, root.id); }
    }
    { const m = out.find((x) => x.mirrorOf === root.id); if (m) orient(root.id, rootL, us.filter((u) => u.ptId === m.id).map((u) => u.uid)); }
    // 3) остаток — другая планировка при тех же комнатах/площади: семейства из ≥ 2 квартир становятся отдельными типами
    while (pool.length >= 2) {
      const ref = pool[0];
      const same = [ref], mir: number[] = [];
      pool.slice(1).forEach((id) => { const v = rel(id, ref); if (v?.mirror) mir.push(id); else if (v?.same) same.push(id); });
      pool = pool.filter((id) => !same.includes(id) && !mir.includes(id));
      if (same.length + mir.length < 2) continue;
      const r0 = out.find((x) => x.id === root.id)!;
      const [Lids, Rids] = !mir.length || leftOf(same, mir) ? [same, mir] : [mir, same];
      const name = nextTypeName(out, r0.rooms, r0.tag);
      const fam: PlanType = { id: nextId(), name: Rids.length ? `${name}-L` : name, rooms: r0.rooms, area: r0.area, imgs: [], shape: root.id, ...(r0.tag ? { tag: r0.tag } : {}) };
      out = [...out, fam].sort(byRooms); created++;
      assign(Lids, fam.id, root.id);
      if (Rids.length) { const fm: PlanType = { id: nextId(), name: `${name}-R`, rooms: r0.rooms, area: r0.area, imgs: [], mirrorOf: fam.id, ...(r0.tag ? { tag: r0.tag } : {}) }; out = [...out, fm].sort(byRooms); created++; assign(Rids, fm.id, root.id); }
    }
  }
  return created || moved || out !== list ? { list: out, units: us, created, moved } : { list, units, created: 0, moved: 0 };
}

const VPH: Record<string, string> = { 55: "avocado-photos/web-v5556-1.jpg", 56: "avocado-photos/web-v5556-2.jpg", 63: "avocado-photos/web-v63-1.jpg", 72: "avocado-photos/web-v72-1.jpg", 74: "avocado-photos/web-v5556-3.jpg" };
/** Фото виллы для карточки (`villaCards.photo` 4179). */
export function villaPhoto(obj: Project, u: Unit): string | null {
  if (obj.rich && u.vt) return asset(`richmond/web-t${u.vt}-out.jpg`);
  return VPH[String(u.num)] ? asset(VPH[String(u.num)]) : null;
}
/** Галерея модалки квартиры (`MM` 3739–3750). Возвращает абсолютные URL. */
/** Свои вырезки квартиры, где бы они ни лежали (свой тип → иначе любой тип объекта: страховка от «переехавших» квартир). */
export function ownCrops(all: PlanType[] | undefined, pt: PlanType | null, uid: number): string[] {
  const mine = pt ? unitAutoImgs(pt, uid) : [];
  if (mine.length || !all) return mine;
  for (const x of all) { const r = unitAutoImgs({ autoImgs: x.autoImgs, tag: pt?.tag ?? x.tag }, uid); if (r.length) return r; }
  return [];
}
export function unitImages(obj: Project, u: Unit, pt: PlanType | null, photos: string[] | undefined = u.photos, all?: PlanType[]): string[] {
  // Порядок: план (вырезка с поэтажного плана: своя, иначе представительская) → фото/рендеры типа (общие для всех его квартир)
  // → фото, привязанные только к этой квартире (старые данные; новые загрузки идут в тип).
  const mine = (photos || []).filter((x) => !!x && !x.startsWith("blob:")).map(asset);
  const own = ownCrops(all, pt, u.uid);
  const ptImgs = pt ? [...(own.length ? own : autoImgList(pt)), ...pt.imgs] : own;
  if (ptImgs.length) return [...ptImgs.map(asset), ...mine];
  if (obj.diamond) return [asset(u.type === "1+1" ? "diamond-plans/plan-1-1.jpeg" : "diamond-plans/plan-2-1.jpeg"), ...mine];
  if (obj.rich && u.vt) return [...["out", "o2", "o3", "o4", "in", "i2", "i3", "i4", "p1", "p2", "p3", "p4"].map((k) => asset(`richmond/web-t${u.vt}-${k}.jpg`)), ...mine];
  if (mine.length) return mine; // плана нет — показываем фото квартиры вместо общей заглушки
  if (obj.rich) return [asset(String(obj.photos?.[0] || "").split("#")[0])];
  if (obj.villas) return [asset(VPH[String(u.num)] || "avocado-photos/web-plan.jpg")];
  if (obj.mega) return [asset("megapolis-photos/web-vaziyet.jpg")];
  return obj.photos && obj.photos.length ? [asset(String(obj.photos[0]).split("#")[0])] : ["https://images.unsplash.com/photo-1503387762-592deb58ef4e?w=800&h=800&fit=crop"];
}
/** PDF планировки в модалке (4136–4138): Megapolis — `A{num}.pdf` / `dukkan-{num}.pdf`, Avocado — `desc-{num}.pdf` (63/72/74). */
export function unitPdf(obj: Project, u: Unit): { url: string; title: string; villa: boolean } | null {
  if (obj.mega) {
    const n = String(u.num).replace(/[^0-9]/g, "");
    return u.wing === "T" ? { url: asset(`megapolis-ticari/plans/dukkan-${u.num}.pdf`), title: `Dükkan ${u.num}`, villa: false } : { url: asset(`uploads/LAYOUTS/A${n}.pdf`), title: `A${n}`, villa: false };
  }
  if (obj.villas && ["63", "72", "74"].includes(String(u.num))) return { url: asset(`avocado-data/desc-${u.num}.pdf`), title: String(u.num), villa: true };
  return null;
}
