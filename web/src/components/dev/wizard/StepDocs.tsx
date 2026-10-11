"use client";

// Step 3 «Каталог и документы» — prototype lines 1869–1875: three category cards (presentation, Ruhsat,
// price list). The prototype had no handlers; here each card opens a file picker, uploads to
// `dev/new/<ts>/files`, shows the count in the card and 96×72 tiles under it.
import { IconCertificate, IconFileTypePdf, IconTable, IconUpload } from "@tabler/icons-react";
import { useRef, type ReactNode } from "react";
import { useDevT } from "@/i18n/dev";
import { showToast } from "@/components/ui/toast";
import { FileTiles } from "./FileTiles";
import { addWzFiles, removeWzFile, type WzFile, type WzFileStepProps, type WzState } from "./wizardState";

type DocKey = keyof WzState["docs"];

function DocCard({ icon, bg, fg, title, sub, accept, files, onFiles, onRemove, countLabel }: { icon: ReactNode; bg: string; fg: string; title: string; sub: string; accept: string; files: WzFile[]; onFiles: (f: File[]) => void; onRemove: (id: string) => void; countLabel: string }) {
  const inp = useRef<HTMLInputElement>(null);
  return (
    <div>
      <div onClick={() => inp.current?.click()} className="flex cursor-pointer items-center gap-[14px] rounded-[14px] border border-line bg-surface px-[18px] py-4 hover:border-blue">
        <input ref={inp} type="file" multiple accept={accept} className="hidden" onChange={(e) => { if (e.target.files?.length) onFiles(Array.from(e.target.files)); e.target.value = ""; }} />
        <div className="flex h-11 w-11 flex-none items-center justify-center rounded-[12px] text-[20px]" style={{ background: bg, color: fg }}>{icon}</div>
        <div className="flex-1"><div className="text-[15px] font-semibold text-ink">{title}</div><div className="text-[12px] text-muted">{sub}</div></div>
        <span className="inline-flex items-center gap-[6px] text-[13px] font-semibold text-blue">{files.length > 0 && <span className="rounded-[20px] bg-green-tint px-[9px] py-[2px] text-[12px] font-bold text-green">{files.length} {countLabel}</span>}<IconUpload size={16} /></span>
      </div>
      <FileTiles items={files} onRemove={onRemove} />
    </div>
  );
}

export function StepDocs({ s, upd, folder }: WzFileStepProps) {
  const { t } = useDevT();
  const onErr = (n: number) => showToast(`${t.dx.upload_failed}${n}`);
  const add = (k: DocKey) => (files: File[]) => addWzFiles(files, `${folder}/files`, (fn) => upd((x) => ({ ...x, docs: { ...x.docs, [k]: fn(x.docs[k]) } })), onErr);
  const remove = (k: DocKey) => (id: string) => upd((x) => ({ ...x, docs: { ...x.docs, [k]: removeWzFile(x.docs[k], id) } }));
  return (
    <>
      <p className="mb-5 text-[14px] text-text-2">{t.wz.docs_hint}</p>
      <div className="flex flex-col gap-3">
        <DocCard icon={<IconFileTypePdf size={20} />} bg="#eef3ff" fg="#4d7cfe" title={t.wz.cat_present} sub={`${t.wz.cat_present_sub} · ${t.dx.wz_cat_catalog}`} accept=".pdf,.ppt,.pptx,.doc,.docx" files={s.docs.present} onFiles={add("present")} onRemove={remove("present")} countLabel={t.dx.wz_files} />
        <DocCard icon={<IconCertificate size={20} />} bg="#fdf3e6" fg="#b45309" title={t.wz.cat_ruhsat} sub={`${t.wz.cat_ruhsat_sub} · ${t.dx.wz_cat_ruhsat}`} accept=".pdf,image/*" files={s.docs.ruhsat} onFiles={add("ruhsat")} onRemove={remove("ruhsat")} countLabel={t.dx.wz_files} />
        <DocCard icon={<IconTable size={20} />} bg="#e4f6ee" fg="#0f9d6b" title={t.wz.cat_price} sub={`${t.wz.cat_price_sub} · ${t.dx.wz_cat_price}`} accept=".csv,.xls,.xlsx,.pdf" files={s.docs.price} onFiles={add("price")} onRemove={remove("price")} countLabel={t.dx.wz_files} />
      </div>
    </>
  );
}
