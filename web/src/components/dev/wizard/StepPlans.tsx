"use client";

// Step 2 «Планировки» — prototype lines 1859–1867: FLOOR PLANS / LAYOUTS drop-zones (`addFile`). Files upload
// to `dev/new/<ts>/plans` immediately and show as 96×72 tiles under each zone.
import { IconHome2, IconLayoutGrid, IconStack2, IconVector } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { showToast } from "@/components/ui/toast";
import { DropZone } from "./DropZone";
import { FileTiles } from "./FileTiles";
import { addWzFiles, removeWzFile, type WzFileStepProps } from "./wizardState";

const DOC_ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*";

export function StepPlans({ s, upd, folder }: WzFileStepProps) {
  const { t } = useDevT();
  const onErr = (n: number) => showToast(`${t.dx.upload_failed}${n}`);
  const add = (key: "floorPlans" | "layouts") => (files: File[]) => addWzFiles(files, `${folder}/plans`, (fn) => upd((x) => ({ ...x, [key]: fn(x[key]) })), onErr);
  const remove = (key: "floorPlans" | "layouts") => (id: string) => upd((x) => ({ ...x, [key]: removeWzFile(x[key], id) }));
  return (
    <>
      <p className="mb-5 text-[14px] text-text-2">{t.wz.plans_hint}</p>
      <div className="grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))" }}>
        <div>
          <label className="mb-2 flex items-center gap-1 text-[13px] font-semibold text-ink"><IconStack2 size={15} /> {t.dx.wz_floor_plans}</label>
          <DropZone icon={<IconLayoutGrid size={24} />} title={t.wz.drop_plans} sub={t.wz.drop_plans_sub} accept={DOC_ACCEPT} count={s.floorPlans.length} onFiles={add("floorPlans")} />
          <FileTiles items={s.floorPlans} onRemove={remove("floorPlans")} />
        </div>
        <div>
          <label className="mb-2 flex items-center gap-1 text-[13px] font-semibold text-ink"><IconVector size={15} /> {t.dx.wz_layouts}</label>
          <DropZone icon={<IconHome2 size={24} />} title={t.wz.drop_layouts} sub={t.wz.drop_layouts_sub} accept={DOC_ACCEPT} count={s.layouts.length} onFiles={add("layouts")} />
          <FileTiles items={s.layouts} onRemove={remove("layouts")} />
        </div>
      </div>
    </>
  );
}
