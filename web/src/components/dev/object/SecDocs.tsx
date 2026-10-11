"use client";

// `#sec-docs` (560–575; данные 3735–3737, 4279–4280): 4 статуса документов (клик — ok↔wait; İskan синхронизирован
// с `p.iskan`), файлы: имя, подпись, «Скачать», крестик, «Добавить документ»; drop файлов на секцию.
// Файлы грузятся в Storage (`dev/<id>/files`); на время загрузки — строка со спиннером; `u` = публичный URL.
import { useState, type DragEvent } from "react";
import { IconCertificate, IconFileDownload, IconFiles, IconLoader2, IconUpload, IconX } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { asset } from "@/lib/dev/data";
import type { DocStatus, ProjectFile } from "@/lib/dev/types";
import { fileLabel, uploadFiles } from "@/lib/upload";
import { showToast } from "@/components/ui/toast";
import { mutate, touch } from "@/store/dev";
import { DEFAULT_FILES, SectionCard, eSet, pickFiles, type Docs, type EditObj } from "./shared";

type Pending = { id: string; n: string; s: string };
const uid = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const DOCS: [string, keyof Docs][] = [["Yapı Ruhsatı", "yapi"], ["İskan", "iskan"], ["Tapu · Kat İrtifakı", "tapu"], ["DASK", "dask"]];
const CYC: Record<DocStatus, DocStatus> = { ok: "wait", wait: "ok", soon: "ok" };
/** `dstat` (2690). */
const DSTAT: Record<DocStatus, [string, string]> = { ok: ["#e4f6ee", "#0f9d6b"], wait: ["#fdf3d7", "#b7791f"], soon: ["#eef1f5", "#8a93a2"] };
const ACCEPT = ".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*";

export function SecDocs({ obj }: { obj: EditObj }) {
  const { t } = useDevT();
  const docsub = t.docsub as Record<string, string>;
  const docstatus = t.docstatus as Record<string, string>;
  const toggle = (k: keyof Docs) => {
    const nv = CYC[obj.docs[k]];
    if (k === "iskan") eSet(obj.id, { iskan: nv === "ok", docs: { ...obj.docs, iskan: nv } });
    else eSet(obj.id, { docs: { ...obj.docs, [k]: nv } });
  };
  const [pending, setPending] = useState<Pending[]>([]);
  const addFiles = async (fs: File[]) => {
    if (!fs.length) return;
    const items: Pending[] = fs.map((f) => ({ id: uid(), n: f.name, s: fileLabel(f.name, f.size) }));
    setPending((p) => [...p, ...items]);
    const res = await uploadFiles(fs, `dev/${obj.id}/files`);
    const add: ProjectFile[] = res.done.map((r) => ({ n: r.name, s: fileLabel(r.name, r.size), u: r.url }));
    if (add.length) { mutate((st) => ({ ...st, projects: st.projects.map((p) => (p.id === obj.id ? { ...p, files: [...(p.files ?? DEFAULT_FILES), ...add] } : p)) })); touch(); }
    setPending((p) => p.filter((x) => !items.some((it) => it.id === x.id)));
    if (res.failed.length) showToast(`${t.dx.upload_failed}${res.failed.length}`);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); addFiles(Array.from(e.dataTransfer?.files || [])); };
  return (
    <SectionCard id="sec-docs" icon={<IconFiles size={18} />} title={t.edp.nav_docs} headClass="mb-4" onDrop={onDrop} after={<span className="text-[12px] text-muted-2">· {t.edp.docs_hint}</span>}>
      <div className="mb-[18px] grid gap-[10px]" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))" }}>
        {DOCS.map(([title, k]) => {
          const st = obj.docs[k];
          return (
            <div key={k} className="flex items-center gap-[11px] rounded-[12px] border border-line px-[14px] py-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-[#fdf3e6] text-[#b45309]"><IconCertificate size={18} /></div>
              <div className="min-w-0 flex-1"><div className="text-[14px] font-semibold text-ink">{title}</div><div className="text-[12px] text-text-2">{docsub[k]}</div></div>
              <span onClick={() => toggle(k)} className="flex-none cursor-pointer whitespace-nowrap rounded-[7px] px-[9px] py-1 text-[11px] font-semibold" style={{ background: DSTAT[st][0], color: DSTAT[st][1] }}>{docstatus[st]}</span>
            </div>
          );
        })}
      </div>
      <div className="border-t border-dashed border-line pt-4">
        <div className="mb-3 flex flex-wrap items-center gap-[10px]">
          <button type="button" onClick={() => pickFiles(ACCEPT, addFiles)} className="inline-flex cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[10px] border border-ink bg-ink px-[13px] py-2 text-[13px] font-semibold text-white"><IconUpload size={15} /> {t.btn_add_doc}</button>
          <span className="text-[12px] text-muted-2">{t.dev.files_hint}</span>
        </div>
        <div className="grid gap-[10px]" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(250px,1fr))" }}>
          {obj.files.map((f, i) => (
            <div key={`${i}-${f.n}`} className="flex items-center gap-[11px] rounded-[12px] border border-line px-[13px] py-[11px]">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-blue-tint text-blue"><IconFileDownload size={18} /></div>
              <div className="min-w-0 flex-1"><div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-semibold text-ink">{f.n}</div><div className="text-[12px] text-text-2">{f.s}</div></div>
              <a href={f.u ? asset(f.u) : undefined} target="_blank" rel="noopener" className="flex-none cursor-pointer whitespace-nowrap rounded-[7px] bg-green-tint px-[9px] py-1 text-[11px] font-semibold text-green">{t.btn_download}</a>
              <span onClick={() => eSet(obj.id, { files: obj.files.filter((_, j) => j !== i) })} className="flex-none cursor-pointer text-[#c3c9d4] hover:text-red"><IconX size={16} /></span>
            </div>
          ))}
          {pending.map((pd) => (
            <div key={pd.id} className="flex items-center gap-[11px] rounded-[12px] border border-dashed border-line px-[13px] py-[11px] opacity-80">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-blue-tint text-blue"><IconLoader2 size={18} className="animate-spin" /></div>
              <div className="min-w-0 flex-1"><div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-semibold text-ink">{pd.n}</div><div className="text-[12px] text-text-2">{pd.s}</div></div>
              <span className="flex-none whitespace-nowrap rounded-[7px] bg-bg-2 px-[9px] py-1 text-[11px] font-semibold text-muted">{t.dx.uploading}</span>
            </div>
          ))}
        </div>
      </div>
    </SectionCard>
  );
}
