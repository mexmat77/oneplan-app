"use client";

// Синхронизация кабинета застройщика с Supabase (таблицы `dev_objects`, `dev_settings`; миграция 0006).
// Стор `store/dev.tsx` остаётся прежним (экраны его не замечают); этот модуль:
//   • при входе в кабинет (`startDevSync`) забирает объекты компаний пользователя и кладёт их в стор поверх локальных;
//   • локальные объекты реальных компаний, которых ещё нет в базе (данные, созданные до переезда), выгружает один раз;
//   • после каждого изменения стора (`setWriteHook`) с задержкой 1,2 с пишет изменённые объекты в базу (последняя запись побеждает);
//   • удаление объекта в кабинете удаляет строку в базе; цвета/особенности компании — в `dev_settings`;
//   • при возврате на вкладку перечитывает объекты (изменения коллег).
// Демо-объекты прототипа (компании без uuid) в базу не попадают и остаются в браузере. Без сессии (DEV_AUTH_BYPASS) — только localStorage.
import { specialStatus } from "@/lib/dev/grid";
import { showToast } from "@/components/ui/toast";
import { PROJECTS_SEED, slugOf } from "@/lib/dev/data";
import type { LogEntry, PlanType, Project, Unit } from "@/lib/dev/types";
import { createClient, hasSupabaseEnv } from "@/lib/supabase/client";
import { notifyDevEvents, type DevEvent } from "@/app/(dev)/dev/notify-actions";
import { getDev, mutate, setRemoteActive, setWriteHook, type DevState } from "./dev";

export type DevObjectRow = { id: number; developer_id: string; slug: string; data: Project; units: Unit[]; plan_types: PlanType[]; log: LogEntry[]; updated_at?: string };
type Sb = ReturnType<typeof createClient>;

const SEED_IDS = new Set(PROJECTS_SEED.map((p) => p.id));
let sb: Sb | null = null;
let scope: string[] | "all" = "all";
let userId: string | null = null;
let started = false;
const remoteIds = new Set<number>();
const stamp: Record<number, string> = {};
const timers = new Map<number, ReturnType<typeof setTimeout>>();
let settingsTimer: ReturnType<typeof setTimeout> | undefined;

/** uuid компании объекта (по имени компании → numeric id → uuid); null — демо-компания прототипа. */
function uuidOf(s: DevState, p: Project): string | null {
  const co = s.companies.find((c) => c.name === p.client);
  return co ? (s.coUuid[co.id] ?? null) : null;
}
const inScope = (uuid: string) => scope === "all" || scope.includes(uuid);
const rowOf = (s: DevState, p: Project, uuid: string): DevObjectRow & { updated_by: string | null } => ({
  id: p.id, developer_id: uuid, slug: slugOf(p.name), data: p, units: s.units[p.id] ?? [], plan_types: s.planTypes[p.id] ?? [], log: s.log[p.id] ?? [],
  updated_at: new Date().toISOString(), updated_by: userId,
});

/** Положить строки базы в стор (объекты базы — источник истины). Не трогает объекты с несохранёнными правками. */
export function applyRows(rows: DevObjectRow[]) {
  const fresh = rows.filter((r) => !timers.has(r.id) && stamp[r.id] !== (r.updated_at ?? ""));
  if (!fresh.length) return;
  mutate((s) => {
    const projects = [...s.projects], units = { ...s.units }, planTypes = { ...s.planTypes }, log = { ...s.log };
    for (const r of fresh) {
      const p: Project = { ...r.data, id: r.id };
      const i = projects.findIndex((x) => x.id === r.id);
      if (i >= 0) projects[i] = p; else projects.push(p);
      units[r.id] = (r.units ?? []).map((u) => { const st = specialStatus(u.type, u.status); return st === u.status ? u : { ...u, status: st }; });
      planTypes[r.id] = r.plan_types ?? [];
      log[r.id] = r.log ?? [];
      remoteIds.add(r.id);
      stamp[r.id] = r.updated_at ?? "";
    }
    return { ...s, projects, units, planTypes, log };
  });
}

async function fetchRows(): Promise<DevObjectRow[] | null> {
  if (!sb) return null;
  let q = sb.from("dev_objects").select("*");
  if (scope !== "all") q = q.in("developer_id", scope);
  const { data, error } = await q;
  if (error) { console.warn("[dev sync] load:", error.message); return null; }
  return (data ?? []) as DevObjectRow[];
}

/** Один раз: локальные объекты реальных компаний, которых нет в базе, выгрузить (данные, накопленные до переезда). */
async function migrateLocal(remote: DevObjectRow[]) {
  const s = getDev();
  const have = new Set(remote.map((r) => r.id));
  for (const p of s.projects) {
    if (SEED_IDS.has(p.id) || have.has(p.id)) continue;
    const uuid = uuidOf(s, p);
    if (!uuid || !inScope(uuid)) continue;
    const ok = await upsert(p.id);
    if (!ok) {
      // id занят объектом другой компании (локальные id в разных браузерах совпадают) — перенумеровать и повторить
      const nid = Date.now() + Math.floor(Math.random() * 1000);
      mutate((st) => {
        const re = <T,>(m: Record<string, T>) => { const o = { ...m }; if (o[p.id] !== undefined) { o[nid] = o[p.id]; delete o[p.id]; } return o; };
        return { ...st, projects: st.projects.map((x) => (x.id === p.id ? { ...x, id: nid } : x)), units: re(st.units), planTypes: re(st.planTypes), log: re(st.log) };
      });
      await upsert(nid);
    }
  }
}

/** Записать объект в базу. false — конфликт первичного ключа (чужой объект с таким id). */
async function upsert(id: number): Promise<boolean> {
  if (!sb) return true;
  const s = getDev();
  const p = s.projects.find((x) => x.id === id);
  if (!p) return true;
  const uuid = uuidOf(s, p);
  if (!uuid || !inScope(uuid)) return true; // демо-объект или чужая компания — не наше
  const row = rowOf(s, p, uuid);
  const { error } = await sb.from("dev_objects").upsert(row, { onConflict: "id" });
  if (error) {
    if (error.code === "23505" || /duplicate key/i.test(error.message)) return false;
    // RLS/сеть: правка остаётся в браузере, пользователь видит предупреждение
    console.warn("[dev sync] save:", error.message);
    showToast(`Не удалось сохранить на сервер: ${error.message}`, 5000);
    return true;
  }
  remoteIds.add(id);
  stamp[id] = row.updated_at!;
  return true;
}

async function remove(id: number) {
  if (!sb || !remoteIds.has(id)) return;
  const { error } = await sb.from("dev_objects").delete().eq("id", id);
  if (error) { console.warn("[dev sync] delete:", error.message); showToast(`Не удалось удалить на сервере: ${error.message}`, 5000); return; }
  remoteIds.delete(id); delete stamp[id];
}

async function saveSettings() {
  if (!sb || scope === "all" || !scope.length) return;
  const s = getDev();
  const { error } = await sb.from("dev_settings").upsert({ developer_id: scope[0], colors: s.colors, features: s.features, updated_at: new Date().toISOString() });
  if (error) console.warn("[dev sync] settings:", error.message);
}

const schedule = (id: number) => { const old = timers.get(id); if (old) clearTimeout(old); timers.set(id, setTimeout(() => { timers.delete(id); void upsert(id); }, 1200)); };

/** Хук стора: что изменилось между двумя состояниями → очередь на запись. */
// Уведомления коллегам: новые записи журнала (статус/цена) и новые объекты, пачкой раз в 2 с на компанию.
const pendingEvents = new Map<string, DevEvent[]>();
let eventsTimer: ReturnType<typeof setTimeout> | undefined;
function queueEvents(devId: string, evs: DevEvent[]) {
  if (!evs.length) return;
  pendingEvents.set(devId, [...(pendingEvents.get(devId) ?? []), ...evs]);
  clearTimeout(eventsTimer);
  eventsTimer = setTimeout(() => { pendingEvents.forEach((list, id) => { void notifyDevEvents(id, list); }); pendingEvents.clear(); }, 2000);
}

function onWrite(prev: DevState, next: DevState) {
  if (prev === next) return;
  const prevById = new Map(prev.projects.map((p) => [p.id, p]));
  for (const p of next.projects) {
    const q = prevById.get(p.id);
    if (q !== p || prev.units[p.id] !== next.units[p.id] || prev.planTypes[p.id] !== next.planTypes[p.id] || prev.log[p.id] !== next.log[p.id]) schedule(p.id);
    const devId = uuidOf(next, p);
    if (devId && inScope(devId) && !SEED_IDS.has(p.id)) {
      const evs: DevEvent[] = [];
      if (!q) evs.push({ kind: "dev_newobj", obj: p.name, objId: p.id });
      else if (prev.log[p.id] !== next.log[p.id]) {
        const seen = new Set((prev.log[p.id] ?? []).map((e) => e.ts));
        for (const e of (next.log[p.id] ?? []).filter((e) => !seen.has(e.ts)).slice(0, 10)) evs.push({ kind: e.f === "price" ? "dev_price" : "dev_status", obj: p.name, objId: p.id, unit: String(e.num), from: String(e.from), to: String(e.to) });
      }
      queueEvents(devId, evs);
    }
    prevById.delete(p.id);
  }
  prevById.forEach((_, id) => { const t = timers.get(id); if (t) { clearTimeout(t); timers.delete(id); } void remove(id); });
  if (prev.colors !== next.colors || prev.features !== next.features) { clearTimeout(settingsTimer); settingsTimer = setTimeout(() => void saveSettings(), 1200); }
}

/** Запуск синхронизации для кабинета (из `DevShell`, после `syncRealCompanies`). `my` — uuid компаний пользователя или "all" для админа платформы. */
export async function startDevSync(my: string[] | "all") {
  if (!hasSupabaseEnv() || started) return;
  started = true;
  scope = my;
  sb = createClient();
  const { data: { user } } = await sb.auth.getUser();
  if (!user) { started = false; return; } // режим без входа (DEV_AUTH_BYPASS) — только localStorage
  userId = user.id;
  const rows = await fetchRows();
  if (!rows) { started = false; return; }
  applyRows(rows);
  if (scope !== "all" && scope.length) {
    const { data } = await sb.from("dev_settings").select("colors, features").eq("developer_id", scope[0]).maybeSingle();
    if (data) mutate((s) => ({ ...s, colors: { ...s.colors, ...((data.colors as Partial<DevState["colors"]>) ?? {}) }, features: Array.isArray(data.features) ? (data.features as string[]) : s.features }));
  }
  setRemoteActive(true);
  setWriteHook(onWrite);
  await migrateLocal(rows);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible") void fetchRows().then((r) => r && applyRows(r)); });
}
