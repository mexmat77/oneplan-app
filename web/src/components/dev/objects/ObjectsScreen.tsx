"use client";

// Objects list — prototype `OnePlan v2.dc.html` lines 409–454 (`isObjects`), filters 4061–4063 / 4197,
// hidden toggle 4198–4204. Spec §1.6.
import { IconChevronDown, IconEye, IconEyeOff, IconPlus, IconWorld } from "@tabler/icons-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDevT } from "@/i18n/dev";
import { STAGELIST, slugOf } from "@/lib/dev/data";
import { toggleShowHidden, useDev, myCompany, scopedProjects } from "@/store/dev";
import { LiveModal } from "@/components/dev/media/LiveModal";
import { ObjectCard } from "./ObjectCard";
import { PickSheet, type SheetOpt } from "./PickSheet";
import { buildProjectsV2, type ProjectView } from "./projectView";

type Filters = { fStage: string; fIskan: string; fSales: string };
type SheetKey = keyof Filters;

export function ObjectsScreen() {
  const { t } = useDevT();
  const s = useDev();
  const router = useRouter();
  const [f, setF] = useState<Filters>({ fStage: "", fIskan: "", fSales: "" });
  const [sheet, setSheet] = useState<{ title: string; key: SheetKey; opts: SheetOpt[] } | null>(null);
  const [live, setLive] = useState<ProjectView | null>(null);

  const role = s.viewRole;
  const canEdit = role !== "client";
  const stages = t.stages as Record<string, string>;
  const sales = t.sales as Record<string, string>;

  const projectsV2 = buildProjectsV2(scopedProjects(s), s.units, s.companies, t);
  const hiddenCount = projectsV2.filter((p) => p.stage === "done" || !!p.hidden).length;
  const view = projectsV2.filter((p) =>
    (!f.fStage || p.stage === f.fStage) &&
    (!f.fIskan || (f.fIskan === "yes") === !!p.iskan) &&
    (!f.fSales || (p.salesSt || "open") === f.fSales) &&
    (s.showHidden || !(p.stage === "done" || !!p.hidden)),
  );

  // «Страница застройщика» — prototype opens `devpub` for the current object's company (`obj.client`).
  const devCompany = myCompany(s)?.name || (view[0] ?? projectsV2[0])?.client || s.companies[0]?.name || "";

  const fltCls = (on: boolean) => `flex flex-none cursor-pointer items-center gap-2 whitespace-nowrap rounded-[10px] border px-3 py-[9px] text-[14px] ${on ? "border-[rgba(77,124,254,0.45)] bg-[rgba(77,124,254,0.1)] font-medium text-[#2f5fe0]" : "border-line bg-surface text-ink-2"}`;
  const flt = [
    { key: "fStage" as const, on: !!f.fStage, label: f.fStage ? stages[f.fStage] : t.f_all_stages, title: t.fld_stage, opts: [["", t.f_all_stages] as SheetOpt].concat(STAGELIST.map((k) => [k, stages[k]] as SheetOpt)) },
    { key: "fIskan" as const, on: !!f.fIskan, label: f.fIskan ? `İskan · ${(t.iskan as Record<string, string>)[f.fIskan]}` : `İskan · ${t.opt_all}`, title: "İskan", opts: [["", t.opt_all], ["yes", t.iskan.yes], ["no", t.iskan.no]] as SheetOpt[] },
    { key: "fSales" as const, on: !!f.fSales, label: f.fSales ? sales[f.fSales] : `${t.sales.label} · ${t.opt_all}`, title: t.sales.label, opts: [["", t.opt_all], ["notsale", t.sales.notsale], ["start", t.sales.start], ["open", t.sales.open], ["sold", t.sales.sold]] as SheetOpt[] },
  ];

  return (
    <>
      <h1 className="mb-[6px] text-[28px] font-extrabold tracking-[-0.02em] text-ink">{t.obj_title}</h1>
      <div className="mb-[18px] text-[13px] text-text-2">{t.obj_sub} · {s.projects.length}</div>
      <div className="sticky top-0 z-[35] mb-4 flex flex-nowrap items-center gap-[10px] overflow-x-auto bg-bg py-[6px]">
        {flt.map((x) => (
          <div key={x.key} onClick={() => setSheet({ title: x.title, key: x.key, opts: x.opts })} className={fltCls(x.on)}>{x.label} <IconChevronDown size={16} className="text-[#9aa1ac]" /></div>
        ))}
        <div className="min-w-2 flex-1" />
        {hiddenCount > 0 && (
          <button type="button" onClick={toggleShowHidden} className="inline-flex flex-none cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[9px] border px-[13px] py-[9px] text-[13px] font-semibold hover:opacity-[.88]" style={s.showHidden ? { borderColor: "#14243f", background: "#14243f", color: "#fff" } : { borderColor: "#e6e9f0", background: "#fff", color: "#6b7688" }}>
            {s.showHidden ? <IconEyeOff size={15} /> : <IconEye size={15} />} {t.co.show_hidden} · {hiddenCount}
          </button>
        )}
        <button type="button" onClick={() => router.push(`/d/${slugOf(devCompany)}`)} className="inline-flex flex-none cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[9px] border border-line bg-surface px-[13px] py-[9px] text-[13px] font-semibold text-ink hover:border-blue hover:text-blue"><IconWorld size={15} /> {t.dev.page}</button>
        {canEdit && <button type="button" onClick={() => router.push("/dev/objects/new")} className="inline-flex flex-none cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[10px] border border-ink bg-ink px-4 py-[10px] text-[14px] font-semibold text-white hover:bg-[#1e3454]"><IconPlus size={16} /> {t.btn_add_object}</button>}
      </div>
      {!canEdit && <div className="mb-[14px] flex items-center gap-[9px] rounded-[11px] border border-[#f5e3b0] bg-[#fef6e0] px-[14px] py-[10px] text-[13px] font-semibold text-[#8a5a00]"><IconEye size={16} /> {t.co.ro_banner}</div>}
      <div className="grid gap-[18px]" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(290px,1fr))" }}>
        {view.map((p) => <ObjectCard key={p.id} p={p} onLive={setLive} />)}
      </div>

      {sheet && <PickSheet title={sheet.title} value={f[sheet.key]} opts={sheet.opts} onPick={(v) => { setF((x) => ({ ...x, [sheet.key]: v })); setSheet(null); }} onClose={() => setSheet(null)} />}
      {live && <LiveModal url={live.live || ""} title={live.name} onClose={() => setLive(null)} />}
    </>
  );
}
