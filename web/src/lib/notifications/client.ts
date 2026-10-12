"use client";

// Уведомления на клиенте: строки `notifications` текущего пользователя (RLS), realtime + опрос, отметка прочитанного,
// рендер текста по словарю `ntfk` ({name}, {obj} … подставляются из payload). Общее для обоих кабинетов.
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export type NtfRow = { id: number; kind: string; payload: Record<string, string | number | null>; read_at: string | null; created_at: string };
export type NtfView = { id: number; kind: string; title: string; sub: string; href: string | null; icon: string; tone: string; bg: string; unread: boolean; at: Date; who: string };

/** Текущее время для вычислений в рендере (react-compiler считает Date.now() нечистым прямо в компоненте). */
export const nowMs = () => Date.now();
const defer = (fn: () => unknown) => { queueMicrotask(() => { void fn(); }); };

export function useNotifs(me: string | null) {
  const [rows, setRows] = useState<NtfRow[]>([]);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    if (!me) return;
    const { data } = await createClient().from("notifications").select("id, kind, payload, read_at, created_at").eq("user_id", me).order("created_at", { ascending: false }).limit(200);
    setRows((data ?? []) as NtfRow[]); setLoaded(true);
  }, [me]);
  useEffect(() => { defer(load); }, [load]);
  useEffect(() => {
    if (!me) return;
    const sb = createClient();
    const tick = () => { if (document.visibilityState === "visible") void load(); };
    const ch = sb.channel(`ntf-${me}`).on("postgres_changes", { event: "*", schema: "public", table: "notifications", filter: `user_id=eq.${me}` }, tick).subscribe();
    const iv = setInterval(tick, 60_000);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(iv); document.removeEventListener("visibilitychange", tick); sb.removeChannel(ch); };
  }, [me, load]);
  const markRead = useCallback(async (ids: number[]) => {
    if (!me || !ids.length) return;
    setRows((r) => r.map((x) => (ids.includes(x.id) ? { ...x, read_at: x.read_at ?? new Date().toISOString() } : x)));
    await createClient().from("notifications").update({ read_at: new Date().toISOString() }).in("id", ids).is("read_at", null);
  }, [me]);
  const markAll = useCallback(async () => {
    if (!me) return;
    setRows((r) => r.map((x) => ({ ...x, read_at: x.read_at ?? new Date().toISOString() })));
    await createClient().from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", me).is("read_at", null);
  }, [me]);
  const clearAll = useCallback(async () => {
    if (!me) return;
    setRows([]);
    await createClient().from("notifications").delete().eq("user_id", me);
  }, [me]);
  return { rows, loaded, unread: rows.filter((r) => !r.read_at).length, markRead, markAll, clearAll, reload: load };
}

// иконка/цвета по виду события (Tabler-имена как у прототипов)
const STYLE: Record<string, [string, string, string]> = {
  req_new: ["ti-user-plus", "#4d7cfe", "#eef3ff"], lead_new: ["ti-user-plus", "#4d7cfe", "#eef3ff"], unblock_req: ["ti-lock-open", "#d98a1e", "#fdf2e4"],
  report_new: ["ti-flag", "#e5484d", "#fdecef"], join_registered: ["ti-user-check", "#0f9d6b", "#e4f6ee"],
  access_approved: ["ti-circle-check", "#0f9d6b", "#e4f6ee"], access_restored: ["ti-circle-check", "#0f9d6b", "#e4f6ee"], report_resolved: ["ti-flag-check", "#0f9d6b", "#e4f6ee"],
  invite_accepted: ["ti-user-check", "#7b4fd0", "#f2ecfb"], team_added: ["ti-building-community", "#4d7cfe", "#eef3ff"], role_changed: ["ti-shield-check", "#7b4fd0", "#f2ecfb"],
  dev_status: ["ti-refresh", "#7b4fd0", "#f2ecfb"], dev_price: ["ti-tag", "#4d7cfe", "#eef3ff"], dev_newobj: ["ti-building-plus", "#e5484d", "#fdecef"],
};
const HREF: Record<string, (p: Record<string, string | number | null>) => string | null> = {
  req_new: () => "/admin/requests", lead_new: () => "/admin/requests", unblock_req: () => "/admin/requests", report_new: () => "/admin/reports", join_registered: () => "/admin/users",
  access_approved: () => "/catalog", access_restored: () => "/catalog", report_resolved: () => null, invite_accepted: () => "/admin/users", team_added: (p) => (p.href as string) || "/dev", role_changed: (p) => (p.href as string) || "/catalog",
  dev_status: (p) => (p.objId ? `/dev/objects/${p.objId}` : "/dev/objects"), dev_price: (p) => (p.objId ? `/dev/objects/${p.objId}` : "/dev/objects"), dev_newobj: (p) => (p.objId ? `/dev/objects/${p.objId}` : "/dev/objects"),
  crm_lead: (p) => (p.href ? String(p.href) : "/crm"),
  listing_transfer: (p) => (p.id ? `/obj/${p.id}` : "/mine"), client_transfer: (p) => (p.href ? String(p.href) : "/crm/clients"),
};
export type NtfDict = Record<string, { t: string; s: string }>;

const fill = (tpl: string, p: Record<string, string | number | null>) => tpl.replace(/\{(\w+)\}/g, (_m, k) => String(p[k] ?? "")).replace(/\s+·\s*$/, "").trim();

export function renderNtf(r: NtfRow, dict: NtfDict): NtfView {
  const d = dict[r.kind] ?? { t: r.kind, s: "" };
  const [icon, tone, bg] = STYLE[r.kind] ?? ["ti-bell", "#6b7688", "#f0f2f6"];
  return { id: r.id, kind: r.kind, title: fill(d.t, r.payload), sub: fill(d.s, r.payload), href: HREF[r.kind]?.(r.payload) ?? null, icon, tone, bg, unread: !r.read_at, at: new Date(r.created_at), who: String(r.payload.who ?? r.payload.name ?? "") };
}

export const dayOf = (d: Date): "today" | "yest" | "earlier" => { const now = new Date(); const t0 = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime(); const t = d.getTime(); return t >= t0 ? "today" : t >= t0 - 864e5 ? "yest" : "earlier"; };
