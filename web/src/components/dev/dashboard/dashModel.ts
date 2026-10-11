// Dashboard formulas — prototype `OnePlan v2.dc.html` lines 3795–3841, spec §5.9.
import type { DevDict } from "@/i18n/dev";
import { convert, DEFAULT_RATES, type Rates } from "@/lib/rates";
import { STORDER, money, nf } from "@/lib/dev/data";
import type { Company, DevUser, Project, Unit, UnitStatus } from "@/lib/dev/types";
import { buildProjectsV2, type ProjectView } from "@/components/dev/objects/projectView";

/** Fixed palette of the status bar (prototype `dpal`, 3814 — the default status colours). */
export const DPAL: Record<UnitStatus, string> = { free: "#059669", booked: "#FBBF24", process: "#3B82F6", sold: "#64748B", reserve: "#8B5CF6", na: "#cbd5e1" };

export type Kpi = { icon: "tag" | "home" | "ruler"; label: string; val: string; tone: string; bg: string };
export type StatusSeg = { key: UnitStatus; label: string; count: string; pct: number; width: number; color: string };
export type ByObj = { id: number; name: string; loc: string; stage: Project["stage"]; stageLabel: string; soldLabel: string; pct: number; ready: number };
export type PubStat = { label: string; val: string; icon: "eye" | "eye-off" | "users" | "building"; tone: string; bg: string };
export type ContentRow = { name: string; tags: string[] };

export type DashModel = {
  dvis: ProjectView[];
  hiddenCount: number;
  kpis: Kpi[];
  statMeta: { icon: "objects" | "units"; val: string; word: string }[];
  segs: StatusSeg[];
  byObj: ByObj[];
  pub: PubStat[];
  content: ContentRow[];
};

export function buildDash(
  t: DevDict,
  projects: Project[], units: Record<string, Unit[]>, companies: Company[], users: DevUser[],
  role: string,
  rates: Rates = DEFAULT_RATES,
): DashModel {
  const L = t.dash;
  const status = t.status as Record<string, string>;
  const stages = t.stages as Record<string, string>;
  const v2 = buildProjectsV2(projects, units, companies, t);
  const dvis = v2.filter((p) => !p.cabHidden);
  const cnt = Object.fromEntries(STORDER.map((k) => [k, 0])) as Record<UnitStatus, number>;
  let dUnits = 0, freeVal = 0, pm2s = 0, pm2n = 0;
  dvis.forEach((p) => {
    const us = units[p.id] ?? [];
    dUnits += us.length;
    // цены хранятся в валюте объекта — сводные суммы приводим к € по курсу ЕЦБ
    const cur = projects.find((x) => x.id === p.id)?.cur || "EUR";
    us.forEach((u) => {
      if (cnt[u.status] != null) cnt[u.status]++;
      if (u.status === "free" && u.price > 0) { const eur = convert(u.price, cur, "EUR", rates); freeVal += eur; if (u.area) { pm2s += eur / u.area; pm2n++; } }
    });
  });
  const avgM2 = pm2n ? Math.round(pm2s / pm2n) : 0;
  const avgUnit = cnt.free ? Math.round(freeVal / cnt.free) : 0;
  const kpis: Kpi[] = [
    { icon: "tag", label: L.k_value, val: money(freeVal), tone: "#4d7cfe", bg: "#eaf1ff" },
    { icon: "home", label: L.k_avgunit, val: money(avgUnit), tone: "#0f9d6b", bg: "#e4f6ee" },
    { icon: "ruler", label: L.k_avgm2, val: money(avgM2), tone: "#7b4fd0", bg: "#efe7fb" },
  ];
  const tot = STORDER.reduce((a, k) => a + cnt[k], 0) || 1;
  const segs: StatusSeg[] = STORDER.filter((k) => cnt[k] > 0).map((k) => ({ key: k, label: status[k], count: nf(cnt[k]), pct: Math.round((cnt[k] / tot) * 100), width: (cnt[k] / tot) * 100, color: DPAL[k] }));
  const statMeta: DashModel["statMeta"] = [{ icon: "objects", val: String(dvis.length), word: L.mw_obj }, { icon: "units", val: nf(dUnits), word: L.mw_unit }];
  const byObj: ByObj[] = dvis.map((p) => ({ id: p.id, name: p.name, loc: p.loc, stage: p.stage, stageLabel: stages[p.stage], soldLabel: `${p.sold} / ${p.total}`, pct: p.pct, ready: p.ready }));
  const hiddenCount = v2.filter((p) => p.cabHidden).length;
  const pub: PubStat[] = [
    { label: L.pub_shown, val: String(dvis.length), icon: "eye", tone: "#0f9d6b", bg: "#e4f6ee" },
    { label: L.pub_hidden, val: String(hiddenCount), icon: "eye-off", tone: "#8a93a2", bg: "#eef1f5" },
    { label: L.pub_users, val: String(users.length), icon: "users", tone: "#4d7cfe", bg: "#eef3ff" },
  ];
  if (role === "superadmin") pub.push({ label: L.pub_companies, val: String(companies.length), icon: "building", tone: "#7b4fd0", bg: "#efe7fb" });
  const content: ContentRow[] = dvis.map((p) => {
    const flags: string[] = [];
    if ((p.photos ?? []).length < 6) flags.push(L.need_photos);
    if ((p.files ?? []).length < 2) flags.push(L.need_docs);
    if (!(p.video && String(p.video).trim())) flags.push(L.need_video);
    return { name: p.name, tags: flags };
  }).filter((x) => x.tags.length > 0);
  return { dvis, hiddenCount, kpis, statMeta, segs, byObj, pub, content };
}
