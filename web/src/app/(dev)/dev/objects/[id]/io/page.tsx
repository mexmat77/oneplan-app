"use client";

// Вкладка «Экспорт-импорт» (прототип 818–833; данные 4004–4009; спецификация §1.9, §5.1).
import { useParams } from "next/navigation";
import { useState } from "react";
import { IconBulb, IconFileSpreadsheet, IconUpload } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { buildExportRows, downloadXls, impBuild, readImportFile } from "@/lib/dev/xlsx";
import { applyImport, useDev } from "@/store/dev";
import { ImportPreviewModal, type ImportState } from "@/components/dev/object/ImportPreviewModal";

export default function Page() {
  const { id } = useParams<{ id: string }>();
  const objId = Number(id);
  const { t } = useDevT();
  const s = useDev();
  const obj = s.projects.find((p) => p.id === objId);
  const units = s.units[objId] ?? [];
  const [imp, setImp] = useState<ImportState | null>(null);
  if (!obj) return null;
  const cur = obj.cur || "EUR";

  const exportExcel = () => downloadXls(buildExportRows(units, obj, t), obj, t, cur);
  // `impPick` (3066): input .csv/.xls/.xlsx → чтение → `impBuild` → модалка предпросмотра.
  const onImport = () => {
    const inp = document.createElement("input");
    inp.type = "file"; inp.accept = ".csv,.xls,.xlsx,text/csv";
    inp.onchange = async () => { const f = inp.files?.[0]; if (!f) return; const aoa = await readImportFile(f); setImp({ file: f.name, rows: impBuild(aoa, units) }); };
    inp.click();
  };

  return (
    <>
      <div className="mb-[6px] text-[13px] text-text-2">{obj.name} / {t.tab_io}</div>
      <h1 className="mb-[18px] text-[28px] font-extrabold tracking-[-.02em] text-ink">{t.io_title}</h1>
      <div className="max-w-[720px] rounded-[14px] border border-line bg-surface p-[22px]">
        <div className="mb-5 flex items-start gap-[10px] rounded-[12px] border border-[#fde3c2] bg-[#fff7ed] px-[15px] py-[13px]"><IconBulb size={17} className="mt-[1px] flex-none text-[#c2740c]" /><p className="m-0 text-[13px] leading-[1.55] text-[#9a5b12]">{t.io_reco}</p></div>
        <h3 className="mb-2 text-[16px] font-bold text-ink">{t.io_export}</h3>
        <div className="mb-[14px] flex flex-wrap items-center gap-[10px]">
          <button type="button" onClick={exportExcel} className="inline-flex cursor-pointer items-center gap-[7px] rounded-[10px] border border-[#137a4d] bg-[#137a4d] px-4 py-[10px] text-[14px] font-semibold text-white hover:bg-[#0f6b43]"><IconFileSpreadsheet size={17} /> {t.io_export_btn}</button>
          <span className="text-[13px] text-text-2">{t.set_cur}: <b>{cur}</b></span>
        </div>
        <h3 className="mb-2 mt-[22px] text-[16px] font-bold text-ink">{t.io_import}</h3>
        <p className="mb-3 text-[14px] text-text-2">{t.io_import_desc}</p>
        <button type="button" onClick={onImport} className="inline-flex cursor-pointer items-center gap-[7px] rounded-[10px] border border-ink bg-ink px-4 py-[10px] text-[14px] font-semibold text-white hover:bg-[#1e3763]"><IconUpload size={17} /> {t.io_import_btn}</button>
        <div className="mt-4 text-[13px] text-text-2">{t.io_fields}</div>
      </div>
      {imp && <ImportPreviewModal imp={imp} cur={cur} onClose={() => setImp(null)} onApply={() => { applyImport(objId, imp.rows || []); setImp(null); }} />}
    </>
  );
}
