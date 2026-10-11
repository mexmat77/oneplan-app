"use client";

// Admin data (members, agencies, reports, invites): demo seed + localStorage until Supabase.
import { useSyncExternalStore } from "react";
import agsJson from "@/mock/ags.json";
import agmetaJson from "@/mock/agmeta.json";
import { REALTORS } from "@/lib/seed";
import type { Realtor } from "@/lib/types";

export type MemberStatus = "active" | "paused" | "pending";
export type Member = Realtor & { status: MemberStatus; paidTo: string; mail: string };
export type Agency = { id?: string; name: string; addr?: string; phone?: string; lic?: string; scan?: string }; // `id` — только у агентств из Supabase
export type ReportReason = "stale" | "sold" | "price" | "dup" | "other";
export type Report = { id: string; listingId: string; reason: ReportReason; text: string; from: string; date: string; st: "new" | "done" };
export type Invite = { code: string; email?: string; createdAt: string };

type State = { overrides: Record<string, Partial<Member>>; created: Member[]; agencies: Agency[]; reports: Report[]; invites: Invite[] };
const KEY = "oneplan-admin-v2"; // v2: prototype seed (3 reports, PDT dates, created members)

/** Fixed «today» of the prototype (line 3599: `new Date(2026,7,24)`) — payment badges ok/soon/exp are computed against it, not `Date.now()`. */
export const TODAY = new Date(2026, 7, 24);
/** `PDT` from the prototype (line 2363). */
const PAID: Record<string, string> = { me: "24.11.2026", r1: "03.09.2026", r2: "28.08.2026", r3: "12.01.2027", r4: "19.09.2026", r5: "02.08.2026", r6: "15.07.2026" };
/** Invite link is fixed in the prototype (line 4239). */
export const INVITE_LINK = "https://one-plan.pro/join/RLT-8F2K";
const AGMETA = agmetaJson as Record<string, Omit<Agency, "name">>;
const DEFAULT: State = {
  overrides: {},
  created: [],
  agencies: (agsJson as string[]).map((name) => ({ name, ...(AGMETA[name] ?? {}) })),
  // Prototype `reports` seed (line 2524).
  reports: [
    { id: "rp1", listingId: "o9", reason: "sold", text: "Объект продан ещё в июле, статус не обновлён", from: "r2", date: "24.08.2026", st: "new" },
    { id: "rp2", listingId: "o3", reason: "price", text: "", from: "r5", date: "22.08.2026", st: "new" },
    { id: "rp3", listingId: "o1", reason: "dup", text: "Дубль с OP-O4", from: "r1", date: "18.08.2026", st: "done" },
  ],
  invites: [{ code: "RLT-8F2K", createdAt: new Date().toISOString() }],
};

let snapshot: State | null = null;
const listeners = new Set<() => void>();
function read(): State {
  if (snapshot) return snapshot;
  let next = DEFAULT;
  try { const raw = localStorage.getItem(KEY); if (raw) next = { ...DEFAULT, ...JSON.parse(raw) }; } catch {}
  snapshot = next;
  return next;
}
function write(next: State) {
  snapshot = next;
  try { localStorage.setItem(KEY, JSON.stringify(next)); } catch {}
  listeners.forEach((l) => l());
}
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

const mailOf = (k: string) => (k === "me" ? "realtor@one-plan.pro" : `${k}@one-plan.pro`);

/** Payment state relative to the prototype's fixed `TODAY`. */
export function payState(paidTo: string, now: Date = TODAY): "ok" | "soon" | "exp" {
  if (!paidTo) return "exp";
  const [d, m, y] = paidTo.split(".").map(Number);
  const days = (new Date(y, m - 1, d).getTime() - now.getTime()) / 864e5;
  return days < 0 ? "exp" : days <= 14 ? "soon" : "ok";
}

function membersOf(s: State): Member[] {
  const base: Member[] = Object.values(REALTORS).map((r) => ({
    ...r, status: r.pending ? "pending" : "active", paidTo: PAID[r.id] ?? "", mail: mailOf(r.id), ...(s.overrides[r.id] ?? {}),
  }));
  return [...base, ...s.created.map((m) => ({ ...m, ...(s.overrides[m.id] ?? {}) }))];
}

export function useAdmin() {
  const s = useSyncExternalStore(subscribe, read, () => DEFAULT);
  return { ...s, members: membersOf(s) };
}
export function updateMember(id: string, patch: Partial<Member>) {
  const cur = read();
  write({ ...cur, overrides: { ...cur.overrides, [id]: { ...(cur.overrides[id] ?? {}), ...patch } } });
}
/** Prototype `rlEditSave` for `__new` (line 4214): a fresh `rn<ts>` realtor. */
export function addMember(m: Omit<Member, "id" | "color" | "city" | "langs" | "online" | "objs" | "sels" | "likes" | "la" | "status">): Member {
  const id = `rn${Date.now()}`;
  const member: Member = {
    id, color: ["#4d7cfe", "#0f9d6b", "#f0ad00", "#7b4fd0"][Date.now() % 4], city: { RU: "", EN: "", TR: "" }, langs: "", online: false, objs: 0, sels: 0, likes: 0,
    la: { RU: "—", EN: "—", TR: "—" }, status: "active", ...m,
  };
  write({ ...read(), created: [...read().created, member] });
  return member;
}
export function saveAgency(prevName: string | null, a: Agency) {
  const cur = read();
  write({ ...cur, agencies: prevName ? cur.agencies.map((x) => (x.name === prevName ? a : x)) : [...cur.agencies, a] });
}
export function removeAgency(name: string) { write({ ...read(), agencies: read().agencies.filter((a) => a.name !== name) }); }
export function addReport(r: Omit<Report, "id" | "date" | "st">) {
  write({ ...read(), reports: [{ ...r, id: `rp${Date.now()}`, date: new Date().toLocaleDateString("ru-RU"), st: "new" }, ...read().reports] });
}
export function toggleReport(id: string) {
  write({ ...read(), reports: read().reports.map((r) => (r.id === id ? { ...r, st: r.st === "new" ? "done" : "new" } : r)) });
}
export function addInvite(email?: string): Invite {
  const code = "RLT-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  const inv = { code, email, createdAt: new Date().toISOString() };
  write({ ...read(), invites: [inv, ...read().invites] });
  return inv;
}
