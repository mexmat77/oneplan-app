"use client";

// Карточка объекта — вкладка «Объект» (прототип `OnePlan v2.dc.html` 456–583; данные 3691–3737, 4236–4283;
// спецификация §1.7). Hero + левая навигация + секции; все правки через `eSet` → `updateProject` + `touch()`.
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { IconTrash } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { deleteProject } from "@/store/dev";
import { Lightbox } from "@/components/dev/object/Lightbox";
import { ObjectHero } from "@/components/dev/object/ObjectHero";
import { ObjectIssues } from "@/components/dev/object/ObjectIssues";
import { ObjectNav, objChecks, objPct } from "@/components/dev/object/ObjectNav";
import { SecBasic } from "@/components/dev/object/SecBasic";
import { SecDesc } from "@/components/dev/object/SecDesc";
import { SecDocs } from "@/components/dev/object/SecDocs";
import { SecLoc } from "@/components/dev/object/SecLoc";
import { SecMedia } from "@/components/dev/object/SecMedia";
import { SecProg } from "@/components/dev/object/SecProg";
import { useEditObj } from "@/components/dev/object/shared";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const objId = Number(id);
  const { t } = useDevT();
  const router = useRouter();
  const obj = useEditObj(objId);
  const [lb, setLb] = useState<{ list: string[]; idx: number } | null>(null);

  if (!obj) {
    return (
      <div className="rounded-[20px] border border-dashed border-line-3 bg-surface px-6 py-14 text-center">
        <h1 className="text-[22px] font-extrabold tracking-[-0.02em] text-ink">{t.obj_title}</h1>
        <Link href="/dev/objects" className="mt-3 inline-block text-[14px] font-semibold text-blue">← {t.back_objects}</Link>
      </div>
    );
  }
  const checks = objChecks(obj);
  // `delObj` (4283): удаляет объект и его юниты без подтверждения → список объектов.
  const delObj = () => { deleteProject(objId); router.push("/dev/objects"); };

  return (
    <>
      <ObjectHero obj={obj} pct={objPct(checks)} />
      {/* «Требует внимания»: квартиры без комнат/площади/цены, необведённые на плане, этажи без плана, типы без картинки */}
      <div className="mt-[14px] empty:hidden"><ObjectIssues objId={objId} /></div>
      <div className="mt-[2px] flex flex-wrap items-start gap-[22px]">
        <ObjectNav checks={checks} />
        <div className="flex min-w-[300px] flex-1 flex-col gap-4">
          <SecBasic obj={obj} />
          <SecMedia obj={obj} />
          <SecDesc obj={obj} />
          <SecLoc obj={obj} />
          <SecProg obj={obj} onLightbox={(list, idx) => setLb({ list, idx })} />
          <SecDocs obj={obj} />
          <div className="flex flex-wrap items-center gap-3 px-[6px] py-1">
            <span onClick={delObj} className="inline-flex cursor-pointer items-center gap-[6px] text-[13px] font-semibold text-red"><IconTrash size={15} /> {t.btn_delete_obj}</span>
            <span className="text-[12px] text-muted-2">{t.edp.del_hint}</span>
          </div>
        </div>
      </div>
      {lb && <Lightbox list={lb.list} idx={lb.idx} onClose={() => setLb(null)} />}
    </>
  );
}
