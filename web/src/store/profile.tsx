"use client";

// Current user's profile (demo «me» from the prototype, state lines 2516–2517) with edits persisted locally
// until Supabase profiles are wired. Other screens read `areas`, `waOn/tgOn/vbOn/mxOn/wcOn`, `name/phone/agency/email`,
// `tgLogin`, `mxId`, `wcId` — keep this API stable, only add fields.
import { createContext, useContext, useMemo, useSyncExternalStore } from "react";
import { trPhone } from "@/lib/phone";

export type Profile = {
  name: string; agency: string; email: string; phone: string; areas: string[];
  /** Prototype `waFound` / `tgFound` — what the phone lookup found (demo: both true). */
  waFound: boolean; tgFound: boolean;
  /** Prototype `tgAdded` — Telegram added manually by @login when the number is hidden. */
  tgAdded: boolean;
  waOn: boolean; tgOn: boolean; tgLogin: string; vbOn: boolean; mxOn: boolean; mxId: string; wcOn: boolean; wcId: string;
  tfaOn: boolean;
  avatar?: string | null; // фото профиля (у вошедшего — с сервера)
};
const DEFAULT: Profile = {
  name: "Alexander Morozov", agency: "AM Estate", email: "realtor@one-plan.pro", phone: "+90 532 555 10 20", areas: ["antalya"],
  waFound: true, tgFound: true, tgAdded: false,
  waOn: true, tgOn: true, tgLogin: "amorozov", vbOn: true, mxOn: false, mxId: "", wcOn: false, wcId: "", tfaOn: false,
};
const KEY_BASE = "oneplan-profile-v2"; // v2: prototype defaults (vbOn, tgLogin, waFound/tgFound/tgAdded)
// Signed-in user (from Supabase `profiles`). Identity fields come from the server; the rest is stored locally per user.
type ServerProfile = { id: string; name: string; email: string; phone: string; agency: string; avatar?: string | null };
let server: ServerProfile | null = null;
export type ProfilePersist = { name?: string; phone?: string; wa_on?: boolean; tg_on?: boolean; tg_login?: string; viber_on?: boolean; max_on?: boolean; max_id?: string; wechat_on?: boolean; wechat_id?: string };
let onPersist: ((patch: ProfilePersist) => void) | null = null;
const KEY = () => (server ? `${KEY_BASE}:${server.id}` : KEY_BASE);
let snapshot: Profile | null = null;
const listeners = new Set<() => void>();
function read(): Profile {
  if (snapshot) return snapshot;
  let next = DEFAULT;
  let stored = false;
  try { const raw = localStorage.getItem(KEY()); if (raw) { next = { ...DEFAULT, ...JSON.parse(raw) }; stored = true; } } catch {}
  if (server) {
    // Real account: identity from Supabase; channels are self-declared, so they start switched off.
    if (!stored) next = { ...next, waOn: false, tgOn: false, vbOn: false, tgLogin: "", mxOn: false, mxId: "", wcOn: false, wcId: "" };
    next = { ...next, ...identity(server) };
  }
  snapshot = next;
  return next;
}
/** Поля личности реального аккаунта — всегда с сервера, без демо-заглушек прототипа («Alexander Morozov / AM Estate»). */
function identity(me: ServerProfile) {
  return { name: me.name || me.email.split("@")[0] || "", email: me.email, phone: me.phone ? trPhone(me.phone) : "", agency: me.agency, avatar: me.avatar ?? null };
}
/** Снимок для SSR и гидрации: у вошедшего пользователя — его данные (иначе показывались демо-значения до гидрации).
 *  Профиль приходит через контекст `ProfileCtx` (провайдер `ProfileInit` в (app)/layout), а не через модульную переменную:
 *  на сервере модуль общий для всех запросов, и `initProfile` там не вызывается — HTML рендерился с демо-именем, а клиент
 *  при гидрации уже знал настоящее → «Hydration failed» (10.10.2026). Снимок кэшируется на объект профиля. */
export const ProfileCtx = createContext<ServerProfile | null>(null);
const snapCache = new WeakMap<ServerProfile, Profile>();
function serverSnapshotFor(me: ServerProfile | null): Profile {
  if (!me) return DEFAULT;
  let s = snapCache.get(me);
  if (!s) { s = { ...DEFAULT, waOn: false, tgOn: false, vbOn: false, tgLogin: "", ...identity(me) }; snapCache.set(me, s); }
  return s;
}
/** Called by `ProfileInit` with the server-side profile (null in demo mode without Supabase). */
export function initProfile(me: ServerProfile | null) {
  const same = (server?.id ?? "") === (me?.id ?? "") && server?.name === me?.name && server?.phone === me?.phone && server?.agency === me?.agency && server?.email === me?.email && (server?.avatar ?? null) === (me?.avatar ?? null);
  if (same) return;
  server = me;
  snapshot = null;
  listeners.forEach((l) => l());
}
export function setProfilePersist(fn: typeof onPersist) { onPersist = fn; }
export function saveProfile(patch: Partial<Profile>) {
  snapshot = { ...read(), ...patch };
  try { localStorage.setItem(KEY(), JSON.stringify(snapshot)); } catch {}
  listeners.forEach((l) => l());
  if (server && onPersist) {
    const ident: ProfilePersist = {};
    if (patch.name !== undefined) { ident.name = patch.name; server = { ...server, name: patch.name }; }
    if (patch.phone !== undefined) { ident.phone = patch.phone; server = { ...server, phone: patch.phone }; }
    // каналы связи — в profiles: их показывает публичная страница подборки клиенту
    const map: [keyof Profile, keyof ProfilePersist][] = [["waOn", "wa_on"], ["tgOn", "tg_on"], ["tgLogin", "tg_login"], ["vbOn", "viber_on"], ["mxOn", "max_on"], ["mxId", "max_id"], ["wcOn", "wechat_on"], ["wcId", "wechat_id"]];
    for (const [k, col] of map) if (patch[k] !== undefined) (ident as Record<string, unknown>)[col] = patch[k];
    if (Object.keys(ident).length) onPersist(ident);
  }
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };
/** id вошедшего пользователя (uuid профиля) или "me" в демо-режиме без Supabase. */
export const getMeId = () => server?.id ?? "me";
export function useMeId(): string {
  const me = useContext(ProfileCtx);
  const getSrv = useMemo(() => { const id = me?.id ?? "me"; return () => id; }, [me]);
  return useSyncExternalStore(subscribe, getMeId, getSrv);
}
export function useProfile(): Profile {
  const me = useContext(ProfileCtx);
  const getSrv = useMemo(() => { const s = serverSnapshotFor(me); return () => s; }, [me]);
  return useSyncExternalStore(subscribe, read, getSrv);
}
