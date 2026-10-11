// View-model of the objects list — prototype `projectsV2` (`OnePlan v2.dc.html` 3649–3665).
// Shared by the objects grid and the dashboard (`dvis = projectsV2.filter(p => !p.cabHidden)`).
import { coverOf } from "@/lib/dev/data";
import type { DevDict } from "@/i18n/dev";
import { asset } from "@/lib/dev/data";
import type { Company, Project, Unit } from "@/lib/dev/types";

export type ProjectView = Project & {
  coverUrl: string;
  total: number;
  free: number;
  sold: number;
  pct: number;
  ready: number;
  stageLabel: string;
  hasIskan: boolean;
  hasOcc: boolean;
  hasLive: boolean;
  isHidden: boolean;       // `pubHidden` — «Не опубликовано»
  cabHidden: boolean;      // done || hidden || company inactive — «туман»
  hiddenReason: string;
  companyName: string;
};

export function buildProjectsV2(projects: Project[], units: Record<string, Unit[]>, companies: Company[], t: DevDict): ProjectView[] {
  const inactive = new Set(companies.filter((c) => c.active === false).map((c) => c.name));
  const stages = t.stages as Record<string, string>;
  const reasons = t.co.reasons as Record<string, string>;
  return projects.map((p) => {
    const us = units[p.id] ?? [];
    // «Не продаётся» (соц. зона, паркинг, технические) не входит в «Продано / всего».
    const total = us.filter((u) => u.status !== "na").length;
    const sold = us.filter((u) => u.status === "sold").length;
    const free = us.filter((u) => u.status === "free").length;
    const coInactive = inactive.has(p.client);
    return {
      ...p,
      coverUrl: coverOf(p),
      total, sold, free,
      pct: total ? Math.round((sold / total) * 100) : 0,
      ready: p.ready || 0,
      stageLabel: stages[p.stage] ?? p.stage,
      hasIskan: !!p.iskan,
      hasOcc: !!(p.occSt && p.occSt !== "none"),
      hasLive: !!(p.live && String(p.live).trim()),
      isHidden: !!p.pubHidden,
      cabHidden: p.stage === "done" || !!p.hidden || coInactive,
      hiddenReason: p.hideReason ? reasons[p.hideReason] : coInactive ? reasons.co : p.stage === "done" ? t.co.completed : "",
      companyName: p.client,
    };
  });
}

/** Sales-status chip palette (prototype `salesChip`). */
export const SALES_CHIP: Record<string, [string, string]> = { notsale: ["#f0f2f6", "#6b7280"], start: ["#fdf3d7", "#b7791f"], open: ["#e4f6ee", "#0f9d6b"], sold: ["#eef1f5", "#8a93a2"] };
/** Key-handover chip palette (prototype `occChip`). */
export const OCC_CHIP: Record<string, [string, string]> = { none: ["#eef1f5", "#8a93a2"], started: ["#e0f2fe", "#0284c7"], full: ["#efe7fb", "#7b4fd0"] };
