"use client";

// Developer-cabinet state (prototype kept everything in memory + `forceUpdate`; here: one external store,
// persisted to localStorage and — for real companies — synced to Supabase by `store/devRemote.ts` (`setWriteHook`).
// Screens read via `useDev()` and mutate via the exported actions.
import { useSyncExternalStore } from "react";
import { COMPANIES_SEED, DEFAULT_COLORS, DEFAULT_FEATURES, DEFAULT_NOTIF_READ, DM_SEED, PROJECTS_SEED, UNITS_SEED } from "@/lib/dev/data";
import { LEGACY_RATES } from "@/lib/rates";
import { ptFor } from "@/lib/dev/planTypes";
import type { Company, DevRole, DevUser, DM, FloorPlan, FloorPlanArea, LogEntry, PlanType, Project, StatusColors, Unit } from "@/lib/dev/types";
import { USERS_SEED } from "@/lib/dev/data";

export type DevState = {
  projects: Project[];
  units: Record<string, Unit[]>;
  planTypes: Record<string, PlanType[]>;
  log: Record<string, LogEntry[]>;
  colors: StatusColors;
  features: string[];
  notifReadIds: number[];
  notifCleared: boolean;
  dm: Record<string, DM[]>;
  dmOpened: string[];          // peers whose seed unread was seen
  companies: Company[];
  users: DevUser[];
  showHidden: boolean;
  showInactiveCo: boolean;
  viewRole: DevRole;
  boardZoom: number;
  /** Real Supabase developers mapped to numeric ids (uuid → id ≥ 1000) and the signed-in user's companies. */
  coUuid: Record<string, string>;
  myCoIds: number[];
  save: "" | "saving" | string; // autosave indicator: '' | 'saving' | 'HH:MM'
};

const KEY = "oneplan-dev-v2"; // v2: company contacts in seed
const DEFAULT: DevState = {
  projects: PROJECTS_SEED,
  units: UNITS_SEED,
  planTypes: {},
  log: {},
  colors: DEFAULT_COLORS,
  features: DEFAULT_FEATURES,
  notifReadIds: DEFAULT_NOTIF_READ,
  notifCleared: false,
  dm: DM_SEED,
  dmOpened: [],
  companies: COMPANIES_SEED,
  users: USERS_SEED,
  showHidden: false,
  showInactiveCo: false,
  viewRole: "superadmin",
  boardZoom: 1,
  coUuid: {},
  myCoIds: [],
  save: "",
};

let snapshot: DevState | null = null;
const listeners = new Set<() => void>();
function read(): DevState {
  if (snapshot) return snapshot;
  let next = DEFAULT;
  try { const raw = localStorage.getItem(KEY); if (raw) { const stored = JSON.parse(raw); next = { ...DEFAULT, ...stored, colors: { ...DEFAULT_COLORS, ...(stored.colors || {}) }, save: "" }; } } catch {}
  // Statuses added later (e.g. `na`) get their default colour even for stores saved before they existed.
  // New seed dialogs (e.g. support) appear for stores saved before they existed.
  next = { ...next, projects: next.projects.map(dropDeadBlobs), dm: { ...DM_SEED, ...next.dm } };
  next = migratePrices(next);
  next = migrateUnitPhotos(next);
  snapshot = next;
  return next;
}
// Фото, загруженные в карточке конкретной квартиры (`Unit.photos`), стали общими для типа планировки: переносим их в `PlanType.imgs`
// типа этой квартиры (если список типов объекта уже создан и тип найден), у квартиры поле очищается.
function migrateUnitPhotos(s: DevState): DevState {
  let changed = false;
  const units = { ...s.units }, planTypes = { ...s.planTypes };
  Object.keys(units).forEach((k) => {
    const list = planTypes[k];
    if (!list || !units[k].some((u) => u.photos?.length)) return;
    let l = list;
    units[k] = units[k].map((u) => {
      if (!u.photos?.length) return u;
      const pt = ptFor(l, u);
      if (!pt) return u;
      const add = u.photos.filter((x) => !pt.imgs.includes(x));
      if (add.length) l = l.map((x) => (x.id === pt.id ? { ...x, imgs: [...x.imgs, ...add] } : x));
      changed = true;
      return { ...u, photos: undefined };
    });
    planTypes[k] = l;
  });
  return changed ? { ...s, units, planTypes } : s;
}
// Цены: раньше (как в прототипе) хранились в € и умножались на курс при показе; теперь — в валюте объекта.
// Объекты без `pricesIn` переводятся один раз по курсам прототипа (USD 1.09, TRY 35), чтобы цифры на экране не изменились.
function migratePrices(s: DevState): DevState {
  const todo = s.projects.filter((p) => !p.pricesIn);
  if (!todo.length) return s;
  const units = { ...s.units };
  todo.forEach((p) => {
    const cur = p.cur || "EUR", k = LEGACY_RATES[cur] || 1;
    if (k !== 1 && units[p.id]) units[p.id] = units[p.id].map((u) => (u.price ? { ...u, price: Math.round(u.price * k) } : u));
  });
  return { ...s, units, projects: s.projects.map((p) => (p.pricesIn ? p : { ...p, pricesIn: p.cur || "EUR" })) };
}
// `blob:` URLs only live in the tab that created them — anything saved that way before Storage is unusable.
const dead = (u: string) => typeof u === "string" && u.startsWith("blob:");
function dropDeadBlobs(p: Project): Project {
  if (!dead(p.cover) && !(p.photos || []).some((x) => dead(x.replace(/^vid:/, ""))) && !(p.files || []).some((f) => dead(f.u)) && !(p.prog || []).some((e) => (e.ph || []).some(dead))) return p;
  return {
    ...p,
    cover: dead(p.cover) ? "" : p.cover,
    photos: (p.photos || []).filter((x) => !dead(x.replace(/^vid:/, ""))),
    files: (p.files || []).filter((f) => !dead(f.u)),
    prog: p.prog?.map((e) => ({ ...e, ph: (e.ph || []).filter((u) => !dead(u)) })),
  };
}
// Синхронизация с Supabase (`store/devRemote.ts`): хук получает прошлое и новое состояние после каждой записи.
let writeHook: ((prev: DevState, next: DevState) => void) | null = null;
export function setWriteHook(fn: ((prev: DevState, next: DevState) => void) | null) { writeHook = fn; }
let remoteOn = false;
/** Включено ли хранение в базе: тогда id новых объектов — метка времени (уникальна между браузерами и компаниями). */
export function setRemoteActive(v: boolean) { remoteOn = v; }
function write(next: DevState) {
  const prev = snapshot;
  snapshot = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
  if (writeHook && prev) writeHook(prev, next);
}
const subscribe = (l: () => void) => {
  listeners.add(l);
  // Another tab saved the store — drop the cached snapshot so this tab re-reads it.
  const onStorage = (e: StorageEvent) => { if (e.key === KEY) { snapshot = null; l(); } };
  window.addEventListener("storage", onStorage);
  return () => { listeners.delete(l); window.removeEventListener("storage", onStorage); };
};

export function useDev(): DevState { return useSyncExternalStore(subscribe, read, () => DEFAULT); }
export const subscribeDev = subscribe;
export const getDev = read;

/** Generic mutation: `mutate(s => ({ ...s, x }))`. */
export function mutate(fn: (s: DevState) => DevState) { write(fn(read())); }

// ---- autosave indicator (prototype `touch()`, line 2692: 'saving' → 700 ms → 'saved HH:MM') ----
let touchTimer: ReturnType<typeof setTimeout> | undefined;
export function touch() {
  write({ ...read(), save: "saving" });
  clearTimeout(touchTimer);
  touchTimer = setTimeout(() => { const d = new Date(); write({ ...read(), save: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}` }); }, 700);
}

// ---- projects ----
export function updateProject(id: number, patch: Partial<Project>) {
  mutate((s) => ({ ...s, projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) }));
  touch();
}
export function addProject(p: Project, units: Unit[] = []) {
  mutate((s) => ({ ...s, projects: [...s.projects, p], units: { ...s.units, [p.id]: units } }));
  touch();
}
export function deleteProject(id: number) {
  mutate((s) => { const units = { ...s.units }; delete units[id]; return { ...s, projects: s.projects.filter((p) => p.id !== id), units }; });
  touch();
}

// ---- units ----
export function setUnits(objId: number, units: Unit[]) { mutate((s) => ({ ...s, units: { ...s.units, [objId]: units } })); }
export function mutUnit(objId: number, uid: number, patch: Partial<Unit>) {
  mutate((s) => ({ ...s, units: { ...s.units, [objId]: (s.units[objId] ?? []).map((u) => (u.uid === uid ? { ...u, ...patch } : u)) } }));
}
export function addUnit(objId: number, u: Unit) { mutate((s) => ({ ...s, units: { ...s.units, [objId]: [...(s.units[objId] ?? []), u] } })); }
export function delUnit(objId: number, uid: number) { mutate((s) => ({ ...s, units: { ...s.units, [objId]: (s.units[objId] ?? []).filter((u) => u.uid !== uid) } })); }
export function nextUid(objId: number): number { const list = read().units[objId] ?? []; return list.reduce((m, u) => Math.max(m, u.uid), objId * 1000) + 1; }

// ---- log (prototype `LOGSTORE`) ----
let currentUserName = "Admin";
/** Name shown as the author of journal entries (set by DevShell from the signed-in account). */
export function setCurrentUserName(n: string) {
  currentUserName = n || "Admin";
  // The journal lives in this browser only, so entries saved before authorship existed were made by this account.
  if (typeof window === "undefined") return;
  const s = read();
  if (Object.values(s.log).some((list) => list.some((e) => !e.by))) {
    const log: typeof s.log = {};
    for (const [k, list] of Object.entries(s.log)) log[k] = list.map((e) => (e.by ? e : { ...e, by: currentUserName }));
    write({ ...s, log });
  }
}
export function addLog(objId: number, e: LogEntry) { const entry = { by: currentUserName, ...e }; mutate((s) => ({ ...s, log: { ...s.log, [objId]: [entry, ...(s.log[objId] ?? [])] } })); }

// ---- plan types ----
export function setPlanTypes(objId: number, list: PlanType[]) { mutate((s) => ({ ...s, planTypes: { ...s.planTypes, [objId]: list } })); }

// ---- settings ----
export function setColors(colors: StatusColors) { mutate((s) => ({ ...s, colors })); touch(); }
export function setFeatures(features: string[]) { mutate((s) => ({ ...s, features })); touch(); }
export function setBoardZoom(z: number) { mutate((s) => ({ ...s, boardZoom: z })); }
export function setShowHidden(v: boolean) { mutate((s) => ({ ...s, showHidden: v })); }
export function setShowInactiveCo(v: boolean) { mutate((s) => ({ ...s, showInactiveCo: v })); }
export function setViewRole(viewRole: DevRole) { mutate((s) => ({ ...s, viewRole })); }
/** Seed the view role from the real account once per session (platform admins keep their demo choice). */
let roleSeeded = false;
export function initViewRole(role: DevRole, platformAdmin: boolean) {
  if (roleSeeded || typeof window === "undefined") return;
  roleSeeded = true;
  if (!platformAdmin && read().viewRole !== role) write({ ...read(), viewRole: role });
}

// ---- notifications ----
export function markNotifRead(ids: number[]) { mutate((s) => ({ ...s, notifReadIds: Array.from(new Set([...s.notifReadIds, ...ids])) })); }
export function clearNotifs() { mutate((s) => ({ ...s, notifCleared: true })); }

// ---- chat ----
export function pushDM(peer: number, m: DM) { mutate((s) => ({ ...s, dm: { ...s.dm, [peer]: [...(s.dm[peer] ?? []), m] } })); }
export function patchDM(peer: number, mid: number, patch: Partial<DM>) {
  mutate((s) => ({ ...s, dm: { ...s.dm, [peer]: (s.dm[peer] ?? []).map((m) => (m.mid === mid ? { ...m, ...patch } : m)) } }));
}
export function openDM(peer: number) { mutate((s) => (s.dmOpened.includes(String(peer)) ? s : { ...s, dmOpened: [...s.dmOpened, String(peer)] })); }

// ---- companies / users ----
export function updateCompany(id: number, patch: Partial<Company>) { mutate((s) => ({ ...s, companies: s.companies.map((c) => (c.id === id ? { ...c, ...patch } : c)) })); touch(); }
export function addCompany(c: Company) { mutate((s) => ({ ...s, companies: [...s.companies, c] })); touch(); }
export function upsertUser(u: DevUser) { mutate((s) => ({ ...s, users: s.users.some((x) => x.id === u.id) ? s.users.map((x) => (x.id === u.id ? u : x)) : [...s.users, u] })); touch(); }
export function removeUser(id: number) { mutate((s) => ({ ...s, users: s.users.filter((x) => x.id !== id) })); touch(); }

// ---- objects list / dashboard / wizard ----
/** Prototype `toggleHidden` (4201): flips `showHidden` and mirrors it into `localStorage.op_showHidden`. */
export function toggleShowHidden() {
  const v = !read().showHidden;
  try { localStorage.setItem("op_showHidden", v ? "1" : "0"); } catch {}
  mutate((s) => ({ ...s, showHidden: v }));
}
/** Next project id for the «Новый объект» wizard: max(id) + 1. */
export function nextProjectId(): number { return remoteOn ? Date.now() : read().projects.reduce((m, p) => Math.max(m, p.id), 0) + 1; }

// ---- users & companies screens (spec §1.12–1.14; prototype `toggleUserActive` 3225, `toggleCoActive` 3281, `createCompany` 3331) ----
export function toggleUserActive(id: number) {
  mutate((s) => ({ ...s, users: s.users.map((u) => (u.id === id ? { ...u, active: !(u.active !== false) } : u)) }));
}
export function toggleCompanyActive(id: number) {
  mutate((s) => ({ ...s, companies: s.companies.map((c) => (c.id === id ? { ...c, active: !(c.active !== false) } : c)) }));
  touch();
}
export function nextCompanyId(): number { return Math.max(0, ...read().companies.map((c) => c.id)) + 1; }
export function nextUserId(): number { return Math.max(100, ...read().users.map((u) => u.id)) + 1; }

// ---- карточка объекта / экспорт-импорт / журнал (агент «Объект») ----
/** Демо-сид журнала при первом открытии (прототип 3104): пишется только если `log[objId]` ещё не создан. */
export function seedLog(objId: number, entries: LogEntry[]) {
  mutate((s) => (s.log[objId] !== undefined ? s : { ...s, log: { ...s.log, [objId]: entries } }));
}
/** `impApply` (3083): применяет изменения предпросмотра импорта к юнитам + `touch()`; в журнал не пишет. */
export function applyImport(objId: number, rows: { uid: number; ch: { f: "price" | "status" | "area" | "type"; to: number | string }[] }[]) {
  if (!rows.length) return;
  mutate((s) => ({
    ...s,
    units: { ...s.units, [objId]: (s.units[objId] ?? []).map((u) => { const r = rows.find((x) => x.uid === u.uid); if (!r) return u; const nu = { ...u } as Record<string, unknown>; r.ch.forEach((c) => { nu[c.f] = c.to; }); return nu as unknown as Unit; }) },
  }));
  touch();
}

// ---- board / plan types (agent «шахматка», §4, §4.10, §5.5) ----
/** Функциональная мутация юнитов объекта (прототип `gMut`): `mutUnits(id, units => gAlign(units, …))`. */
export function mutUnits(objId: number, fn: (units: Unit[]) => Unit[]) {
  mutate((s) => { const cur = s.units[objId] ?? []; const next = fn(cur); return next === cur ? s : { ...s, units: { ...s.units, [objId]: next } }; });
}
/** Список типов планировок объекта; при отсутствии строится автоматически (`getPT`) и записывается в стор. */
export function ensurePlanTypes(objId: number, build: (units: Unit[]) => PlanType[]): PlanType[] {
  const s = read();
  if (s.planTypes[objId]) return s.planTypes[objId];
  const list = build(s.units[objId] ?? []);
  write({ ...s, planTypes: { ...s.planTypes, [objId]: list } });
  return list;
}
export function mutPlanTypes(objId: number, fn: (list: PlanType[]) => PlanType[]) {
  mutate((s) => ({ ...s, planTypes: { ...s.planTypes, [objId]: fn(s.planTypes[objId] ?? []) } }));
}

// ---- real companies from Supabase (`developers` + `org_members`) ----
export type RealCompany = { uuid: string; name: string; director: string; active: boolean; until: string };
/** Merge Supabase developers into the company list (stable numeric ids from 1000) and remember the user's companies. */
export function syncRealCompanies(list: RealCompany[], myUuids: string[] | "all" | null) {
  mutate((s) => {
    const coUuid = { ...s.coUuid };
    const byUuid: Record<string, number> = {};
    for (const [id, u] of Object.entries(coUuid)) byUuid[u] = Number(id);
    let next = Object.keys(coUuid).reduce((m, k) => Math.max(m, Number(k)), 999) + 1;
    const companies = [...s.companies];
    for (const c of list) {
      let id = byUuid[c.uuid];
      if (!id) { id = next++; coUuid[id] = c.uuid; byUuid[c.uuid] = id; }
      const patch = { name: c.name, dir: c.director, active: c.active, until: c.until };
      const i = companies.findIndex((x) => x.id === id);
      if (i >= 0) companies[i] = { ...companies[i], ...patch };
      else companies.push({ id, objIds: [], ...patch });
    }
    // null — только дописать компании (публичная страница), список «моих» не трогать
    const myCoIds = myUuids === null ? s.myCoIds : myUuids === "all" ? companies.map((c) => c.id) : myUuids.map((u) => byUuid[u]).filter((x): x is number => !!x);
    const same = JSON.stringify(myCoIds) === JSON.stringify(s.myCoIds) && JSON.stringify(companies) === JSON.stringify(s.companies) && JSON.stringify(coUuid) === JSON.stringify(s.coUuid);
    return same ? s : { ...s, companies, coUuid, myCoIds };
  });
}

/** Projects visible to the signed-in account: only their companies' objects for developer staff (platform admins see all). */
export function scopedProjects(s: DevState): Project[] {
  if (!s.myCoIds.length || s.myCoIds.length === s.companies.length) return s.projects;
  const names = new Set(s.companies.filter((c) => s.myCoIds.includes(c.id)).map((c) => c.name));
  return s.projects.filter((p) => names.has(p.client));
}
/** The account's own company (first membership), used for «Страница застройщика» and admin views. */
export function myCompany(s: DevState): Company | null {
  return s.companies.find((c) => c.id === s.myCoIds[0]) ?? null;
}

// ---- floor plans / экспликации (agent «Поэтажный план») ----
/** Записать/заменить план этажа `key` (`fpKey(wing, floor)`); существующие полигоны сохраняются, если `plan.areas` не передан. */
export function setFloorPlan(objId: number, key: string, plan: Omit<FloorPlan, "areas"> & { areas?: FloorPlanArea[] }) {
  mutate((s) => ({
    ...s,
    projects: s.projects.map((p) => (p.id === objId ? { ...p, floorPlans: { ...(p.floorPlans ?? {}), [key]: { ...plan, areas: plan.areas ?? p.floorPlans?.[key]?.areas ?? [] } } } : p)),
  }));
  touch();
}
export function removeFloorPlan(objId: number, key: string) {
  mutate((s) => ({
    ...s,
    projects: s.projects.map((p) => { if (p.id !== objId || !p.floorPlans?.[key]) return p; const fp = { ...p.floorPlans }; delete fp[key]; return { ...p, floorPlans: fp }; }),
  }));
  touch();
}
/** Заменить список полигонов плана (функционально или массивом). */
export function setPlanAreas(objId: number, key: string, next: FloorPlanArea[] | ((areas: FloorPlanArea[]) => FloorPlanArea[])) {
  mutate((s) => ({
    ...s,
    projects: s.projects.map((p) => {
      const plan = p.floorPlans?.[key];
      if (p.id !== objId || !plan) return p;
      const areas = typeof next === "function" ? next(plan.areas) : next;
      return areas === plan.areas ? p : { ...p, floorPlans: { ...p.floorPlans, [key]: { ...plan, areas } } };
    }),
  }));
  touch();
}

// ---- авто-картинки типов планировок (вырезки квартир с поэтажного плана; агент «Поэтажный план») ----
/** Записать вырезку квартиры `uid` в тип `ptId` (в других типах запись по этому uid снимается — квартира привязана к одному типу). */
export function setPlanTypeAutoImg(objId: number, ptId: number, uid: number, url: string, planKey = "") {
  const k = `${uid}|${planKey}`;
  const mine = (key: string) => key === k;
  const ofUnit = (key: string) => key === String(uid) || key.startsWith(`${uid}|`);
  mutate((s) => ({
    ...s,
    planTypes: { ...s.planTypes, [objId]: (s.planTypes[objId] ?? []).map((pt) => {
      const a = { ...(pt.autoImgs ?? {}) };
      // the unit's crops live in ONE type: drop them from other types, keep other plans (duplex levels) in this one
      // …and only for multi-level types (duplex/triplex); an ordinary unit has exactly one crop, so stale ones (another floor's plan, old key format) go
      const multi = !!pt.tag;
      Object.keys(a).forEach((key) => { if (ofUnit(key) && (pt.id !== ptId || !multi || mine(key) || key === String(uid))) delete a[key]; });
      if (pt.id === ptId) a[k] = url;
      return Object.keys(a).length || pt.autoImgs ? { ...pt, autoImgs: a } : pt;
    }) },
  }));
  touch();
}
/** Убрать вырезку квартиры `uid` из всех типов объекта (при удалении контура). */
export function removePlanTypeAutoImg(objId: number, uid: number, planKey?: string) {
  const hit = (key: string) => (planKey === undefined ? key === String(uid) || key.startsWith(`${uid}|`) : key === `${uid}|${planKey}`);
  mutate((s) => {
    const list = s.planTypes[objId];
    if (!list || !list.some((pt) => pt.autoImgs && Object.keys(pt.autoImgs).some(hit))) return s;
    return { ...s, planTypes: { ...s.planTypes, [objId]: list.map((pt) => { if (!pt.autoImgs || !Object.keys(pt.autoImgs).some(hit)) return pt; const a = { ...pt.autoImgs }; Object.keys(a).forEach((key) => { if (hit(key)) delete a[key]; }); return { ...pt, autoImgs: a }; }) } };
  });
  touch();
}
