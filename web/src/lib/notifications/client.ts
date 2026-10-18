"use client";

// Уведомления на клиенте: строки `notifications` текущего пользователя (RLS), realtime + опрос, отметка прочитанного,
// рендер текста по словарю `ntfk` ({name}, {obj} … подставляются из payload). Общее для обоих кабинетов.
import { useEffect, useReducer } from "react";
import type { RealtimeChannel } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";

export type NtfRow = { id: number; kind: string; payload: Record<string, string | number | null>; read_at: string | null; created_at: string };
export type NtfView = { id: number; kind: string; title: string; sub: string; href: string | null; icon: string; tone: string; bg: string; unread: boolean; at: Date; who: string };

/** Текущее время для вычислений в рендере (react-compiler считает Date.now() нечистым прямо в компоненте). */
export const nowMs = () => Date.now();
const defer = (fn: () => unknown) => { queueMicrotask(() => { void fn(); }); };

// ОДНА подписка на пользователя (13.10.2026, «при нажатии "все уведомления" ошибка»): шапка, выпадающий список и страница
// «Все уведомления» — все читают общий кэш; раньше каждый вызов хука создавал канал `ntf-<uid>` заново, а supabase-js
// возвращает уже подписанный канал и падает на `.on()` после `subscribe()`. Строки грузятся один раз, realtime + опрос раз в
// минуту + при возврате на вкладку; отметки прочитанного обновляют кэш сразу (оптимистично) и уходят в базу.
type Entry = { rows: NtfRow[]; loaded: boolean; ls: Set<() => void>; ch: RealtimeChannel | null; iv: number; onVis: (() => void) | null; refs: number };
const entries = new Map<string, Entry>();
const emit = (e: Entry) => e.ls.forEach((l) => l());
const entryFor = (me: string): Entry => { let e = entries.get(me); if (!e) { e = { rows: [], loaded: false, ls: new Set(), ch: null, iv: 0, onVis: null, refs: 0 }; entries.set(me, e); } return e; };
async function loadFor(me: string) {
  const e = entryFor(me);
  const { data } = await createClient().from("notifications").select("id, kind, payload, read_at, created_at").eq("user_id", me).order("created_at", { ascending: false }).limit(200);
  e.rows = (data ?? []) as NtfRow[]; e.loaded = true; emit(e);
}
function attach(me: string, l: () => void): () => void {
  const e = entryFor(me); e.ls.add(l);
  if (e.refs++ === 0) {
    const sb = createClient();
    const tick = () => { if (document.visibilityState === "visible") void loadFor(me); };
    e.ch = sb.channel(`ntf-${me}`).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${me}` }, tick).subscribe();
    e.iv = window.setInterval(tick, 60_000); e.onVis = tick; document.addEventListener("visibilitychange", tick);
    defer(() => loadFor(me));
  }
  return () => {
    e.ls.delete(l);
    if (--e.refs === 0) { clearInterval(e.iv); if (e.onVis) document.removeEventListener("visibilitychange", e.onVis); if (e.ch) void createClient().removeChannel(e.ch); e.ch = null; e.onVis = null; }
  };
}
export function useNotifs(me: string | null) {
  const [, force] = useReducer((x: number) => x + 1, 0);
  useEffect(() => (me ? attach(me, force) : undefined), [me]);
  const e = me ? entries.get(me) : undefined;
  const rows = e?.rows ?? EMPTY_ROWS, loaded = e?.loaded ?? false;
  const load = async () => { if (me) await loadFor(me); };
  const markRead = async (ids: number[]) => {
    if (!me || !ids.length) return;
    const en = entryFor(me); en.rows = en.rows.map((x) => (ids.includes(x.id) ? { ...x, read_at: x.read_at ?? new Date().toISOString() } : x)); emit(en);
    await createClient().from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids).is("read_at", null);
  };
  const markAll = async () => {
    if (!me) return;
    const en = entryFor(me); en.rows = en.rows.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })); emit(en);
    await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", me).is("read_at", null);
  };
  const clearAll = async () => {
    if (!me) return;
    const en = entryFor(me); en.rows = []; emit(en);
    await createClient().from("notifications").delete().eq("user_id", me);
  };
  return { rows, loaded, unread: rows.filter((r) => !r.read_at).length, markRead, markAll, clearAll, reload: load };
}
const EMPTY_ROWS: NtfRow[] = [];

// иконка/цвета по виду события (Tabler-имена как у прототипов)
const STYLE: Record<string, [string, string, string]> = {
  req_new: ["ti-user-plus", "#4d7cfe", "#eef3ff"], req_auto: ["ti-user-check", "#0f9d6b", "#e4f6ee"], lead_new: ["ti-user-plus", "#4d7cfe", "#eef3ff"], unblock_req: ["ti-lock-open", "#d98a1e", "#fdf2e4"],
  report_new: ["ti-flag", "#e5484d", "#fdecef"], join_registered: ["ti-user-check", "#0f9d6b", "#e4f6ee"],
  access_approved: ["ti-circle-check", "#0f9d6b", "#e4f6ee"], access_restored: ["ti-circle-check", "#0f9d6b", "#e4f6ee"], report_resolved: ["ti-flag-check", "#0f9d6b", "#e4f6ee"],
  invite_accepted: ["ti-user-check", "#7b4fd0", "#f2ecfb"], team_added: ["ti-building-community", "#4d7cfe", "#eef3ff"], role_changed: ["ti-shield-check", "#7b4fd0", "#f2ecfb"],
  price_down: ["ti-trending-down", "#0f9d6b", "#e4f6ee"], price_up: ["ti-trending-up", "#d98a1e", "#fdf2e4"],
  dev_status: ["ti-refresh", "#7b4fd0", "#f2ecfb"], dev_price: ["ti-tag", "#4d7cfe", "#eef3ff"], dev_newobj: ["ti-building-plus", "#e5484d", "#fdecef"],
};
const HREF: Record<string, (p: Record<string, string | number | null>) => string | null> = {
  req_new: () => "/admin/requests", req_auto: () => "/admin/users", lead_new: () => "/admin/requests", unblock_req: () => "/admin/requests", report_new: () => "/admin/reports", join_registered: () => "/admin/users",
  access_approved: () => "/catalog", access_restored: () => "/catalog", report_resolved: () => null, invite_accepted: () => "/admin/users", team_added: (p) => (p.href as string) || "/dev", role_changed: (p) => (p.href as string) || "/catalog",
  dev_status: (p) => (p.objId ? `/dev/objects/${p.objId}` : "/dev/objects"), dev_price: (p) => (p.objId ? `/dev/objects/${p.objId}` : "/dev/objects"), dev_newobj: (p) => (p.objId ? `/dev/objects/${p.objId}` : "/dev/objects"),
  crm_lead: (p) => (p.href ? String(p.href) : "/crm"),
  price_down: (p) => (p.id ? `/obj/${p.id}` : "/favs"), price_up: (p) => (p.id ? `/obj/${p.id}` : "/favs"),
  listing_transfer: (p) => (p.id ? `/obj/${p.id}` : "/mine"), client_transfer: (p) => (p.href ? String(p.href) : "/crm/clients"),
};
export type NtfDict = Record<string, { t: string; s: string }>;

// числа ≥ 1000 (цены) — с разделителями групп, как везде в интерфейсе
const fmtV = (v: string | number | null) => (typeof v === "number" && Math.abs(v) >= 1000 ? Math.round(v).toLocaleString("ru-RU").replace(/\u00a0/g, "\u202f") : String(v ?? ""));
const fill = (tpl: string, p: Record<string, string | number | null>) => tpl.replace(/\{(\w+)\}/g, (_m, k) => fmtV(p[k])).replace(/\s+·\s*$/, "").trim();

export function renderNtf(r: NtfRow, dict: NtfDict): NtfView {
  const d = dict[r.kind] ?? { t: r.kind, s: "" };
  const [icon, tone, bg] = STYLE[r.kind] ?? ["ti-bell", "#6b7688", "#f0f2f6"];
  return { id: r.id, kind: r.kind, title: fill(d.t, r.payload), sub: fill(d.s, r.payload), href: HREF[r.kind]?.(r.payload) ?? null, icon, tone, bg, unread: !r.read_at, at: new Date(r.created_at), who: String(r.payload.who ?? r.payload.name ?? "") };
}

export const dayOf = (d: Date): "today" | "yest" | "earlier" => { const now = new Date(); const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(); const t = d.getTime(); return t >= t0 ? "today" : t >= t0 - 864e5 ? "yest" : "earlier"; };
