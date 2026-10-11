// «Требует внимания»: что мешает объекту быть полностью готовым. Чистая функция — используется на странице объекта
// и на последнем шаге мастера «Объект из файлов».
import { isSpecialType } from "./data";
import { fpFloors, fpKey, fpUnits, fpWings, isBlankUnit, unitFloors } from "./floorplan";
import { allImgs, ptFor } from "./planTypes";
import type { PlanType, Project, Unit } from "./types";

export type IssueKind = "noType" | "noArea" | "noPrice" | "notTraced" | "floorNoPlan" | "typeNoImage";
export type Issue = { kind: IssueKind; units: Unit[]; floors: { wing: string; floor: number }[]; types: PlanType[] };

export function buildIssues(obj: Project, units: Unit[], planTypes: PlanType[]): { list: Issue[]; total: number; ready: number; all: number } {
  const real = units.filter((u) => !isBlankUnit(u) || String(u.num).trim() !== "");
  const apts = real.filter((u) => !u.vl);
  const mk = (kind: IssueKind, us: Unit[] = [], floors: Issue["floors"] = [], types: PlanType[] = []): Issue => ({ kind, units: us, floors, types });
  const plans = obj.floorPlans ?? {};
  const hasPlans = Object.values(plans).some((p) => !!p?.img);
  const noType = real.filter((u) => !u.type);
  const noArea = real.filter((u) => !!u.type && !isSpecialType(u.type) && !u.area);
  const noPrice = real.filter((u) => !!u.type && !isSpecialType(u.type) && u.status !== "sold" && u.status !== "na" && !u.price);
  // квартира не обведена хотя бы на одном своём этаже, где план есть
  const notTraced = hasPlans ? apts.filter((u) => unitFloors(u).some((f) => { const p = plans[fpKey(u.wing || "", f)]; return !!p?.img && !p.areas.some((a) => a.uid === u.uid); })) : [];
  const floorNoPlan: Issue["floors"] = [];
  if (hasPlans) fpWings(units).forEach((w) => fpFloors(units, w).forEach((f) => { if (!plans[fpKey(w, f)]?.img && fpUnits(units, w, f).length) floorNoPlan.push({ wing: w, floor: f }); }));
  const usedTypes = new Set(real.map((u) => ptFor(planTypes, u)?.id).filter((x): x is number => x != null));
  const typeNoImage = planTypes.filter((pt) => usedTypes.has(pt.id) && !allImgs(pt).length);
  const list = [mk("noType", noType), mk("noArea", noArea), mk("noPrice", noPrice), mk("floorNoPlan", [], floorNoPlan), mk("notTraced", notTraced), mk("typeNoImage", [], [], typeNoImage)]
    .filter((i) => i.units.length || i.floors.length || i.types.length);
  const bad = new Set([...noType, ...noArea, ...noPrice, ...notTraced].map((u) => u.uid));
  return { list, total: list.reduce((s, i) => s + i.units.length + i.floors.length + i.types.length, 0), ready: real.length - bad.size, all: real.length };
}
