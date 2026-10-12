"use client";

// Документы сделки (12.10.2026, «довести до идеала»): список с PDF/Word/файлом и статусом; «Создать документ» — широкое окно:
// слева выбор шаблона (карточки по типу сделки) и набора реквизитов, справа поля по группам с навигацией и счётчиком
// заполненности; «Загрузить файл». Значения предзаполняются реквизитами, клиентом, объектом и прошлыми документами сделки.
import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck, IconDownload, IconFileText, IconFileTypePdf, IconPaperclip, IconPlus, IconSparkles, IconTrash, IconUpload } from "@tabler/icons-react";
import { deleteDoc, docDefaults, docParams, docUrl, generateDoc, listDocs, listTemplates, setDocStatus, uploadDoc, type CompanyProfile, type DocInfo, type TemplateInfo } from "@/app/crm/doc-actions";
import { confirmDialog } from "@/components/ui/confirm";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { DateField } from "@/components/ui/DateRange";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import type { Lang } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { FIELD_MAP, GROUP_LABELS, type DocGroup } from "@/lib/crm/docFields";
import { crmError, btnP, btnS, fmtDate, inp, lbl, useCrm } from "./crmUi";

const tplName = (t: TemplateInfo, lang: Lang) => (typeof t.name === "string" ? t.name : t.name[lang] ?? t.name.RU);
function groupFields(fields: string[]): [string, string[]][] {
  const g = new Map<DocGroup | string, string[]>();
  fields.forEach((k) => { const grp = FIELD_MAP[k]?.group ?? k.split(".")[0]; g.set(grp, [...(g.get(grp) ?? []), k]); });
  return [...g.entries()];
}
const STATUS_COLOR: Record<DocInfo["status"], string> = { draft: "#8a93a2", sent: "#4d7cfe", signed: "#22c15e", void: "#e5484d" };

export function DocsPanel({ dealId, dealKind, onChange }: { dealId: string; dealKind: string; onChange?: () => void }) {
  const { t, lang } = useI18n();
  const c = t.crm.docs;
  const crm = useCrm();
  const ro = crm.me.access !== "full";
  const [docs, setDocs] = useState<DocInfo[] | null>(null);
  const [create, setCreate] = useState<{ open: boolean; fromDoc?: DocInfo } | null>(null);
  const [upload, setUpload] = useState(false);
  const load = useCallback(() => { listDocs({ dealId }).then(setDocs).catch(() => setDocs([])); }, [dealId]);
  useEffect(() => { load(); }, [load]);
  const err = (e: unknown) => crmError(e, c.err, t.crm.errReadonly);
  async function open(d: DocInfo, which: "docx" | "pdf" | "file") { try { window.open(await docUrl(d.id, which), "_blank", "noopener"); } catch (e) { err(e); } }
  async function del(d: DocInfo) { if (!(await confirmDialog({ text: c.delQ, danger: true }))) return; try { await deleteDoc(d.id); load(); } catch (e) { err(e); } }
  async function status(d: DocInfo, st: DocInfo["status"]) { try { await setDocStatus(d.id, st, d.validUntil); load(); } catch (e) { err(e); } }
  const kinds = c.kinds as Record<string, string>;
  const size = (n: number | null) => (n ? (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`) : "");
  return (
    <div className="mt-3 rounded-[6px] border border-line bg-[#fafbfc] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] font-semibold uppercase tracking-[.04em] text-muted">{c.title}{docs ? ` · ${docs.length}` : ""}</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setUpload(true)} disabled={ro} className={`${btnS} h-7 px-2 text-[12px]`}><IconUpload size={13} /> {c.upload}</button>
          <button type="button" onClick={() => setCreate({ open: true })} disabled={ro} className={`${btnP} h-7 px-2 text-[12px]`}><IconPlus size={13} /> {c.create}</button>
        </div>
      </div>
      {docs === null ? <div className="text-[12.5px] text-muted">…</div> : docs.length === 0 ? <div className="text-[12.5px] text-muted">{c.none}</div> : (
        <div className="flex flex-col gap-1">
          {docs.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-[6px] border border-line bg-surface px-3 py-[6px] text-[12.5px]">
              <button type="button" onClick={() => open(d, d.hasPdf ? "pdf" : d.hasDocx ? "docx" : "file")} title={c.open} className="flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-[6px] bg-bg-2 text-ink hover:bg-blue-tint">{d.hasFile ? <IconPaperclip size={16} className="text-muted" /> : d.hasPdf ? <IconFileTypePdf size={17} className="text-red" /> : <IconFileText size={16} className="text-blue-2" />}</button>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => open(d, d.hasPdf ? "pdf" : d.hasDocx ? "docx" : "file")} className="block max-w-full cursor-pointer truncate text-left font-semibold text-ink hover:text-blue-2">{d.title}</button>
                <div className="truncate text-[11.5px] text-muted">{kinds[d.kind] ?? d.kind} · {fmtDate(d.createdAt, lang)}{d.size ? ` · ${size(d.size)}` : ""}{d.validUntil ? ` · ${c.validUntil} ${fmtDate(d.validUntil, lang)}` : ""}</div>
              </div>
              <span className="inline-flex items-center gap-[6px]"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[d.status] }} /><Select value={d.status} onChange={(v) => status(d, v as DocInfo["status"])} options={(["draft", "sent", "signed", "void"] as const).map((k) => ({ value: k, label: c.status[k] }))} size="sm" className="w-[130px]" disabled={ro} /></span>
              {d.hasPdf && <button type="button" onClick={() => open(d, "pdf")} title={c.pdf} className={`${btnS} h-7 px-2 text-[12px]`}><IconFileTypePdf size={14} className="text-red" /> PDF</button>}
              {d.hasDocx && <button type="button" onClick={() => open(d, "docx")} title={c.docx} className={`${btnS} h-7 px-2 text-[12px]`}><IconFileText size={14} className="text-blue-2" /> Word</button>}
              {d.hasFile && <button type="button" onClick={() => open(d, "file")} title={c.download} className={`${btnS} h-7 px-2 text-[12px]`}><IconDownload size={14} /> {c.download}</button>}
              {d.hasDocx && !ro && <button type="button" onClick={() => setCreate({ open: true, fromDoc: d })} title={c.similar} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-bg-2 hover:text-ink"><IconSparkles size={15} /></button>}
              <button type="button" onClick={() => del(d)} disabled={ro} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-red-tint hover:text-red"><IconTrash size={15} /></button>
            </div>
          ))}
        </div>
      )}
      {create?.open && <DocCreateModal dealId={dealId} dealKind={dealKind} fromDoc={create.fromDoc} onClose={() => setCreate(null)} onDone={() => { setCreate(null); load(); onChange?.(); }} />}
      {upload && <DocUploadModal dealId={dealId} onClose={() => setUpload(false)} onDone={() => { setUpload(false); load(); onChange?.(); }} />}
    </div>
  );
}

function DocCreateModal({ dealId, dealKind, fromDoc, onClose, onDone }: { dealId: string; dealKind: string; fromDoc?: DocInfo; onClose: () => void; onDone: () => void }) {
  const { t, lang } = useI18n();
  const c = t.crm.docs;
  const [tpls, setTpls] = useState<TemplateInfo[] | null>(null);
  const [tplId, setTplId] = useState<string>(fromDoc ? (fromDoc.templateKey ? "builtin:" + fromDoc.templateKey : fromDoc.templateId ?? "") : "");
  const [values, setValues] = useState<Record<string, string>>({});
  const [title, setTitle] = useState(fromDoc?.title ?? "");
  const [pdf, setPdf] = useState(true);
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [companyId, setCompanyId] = useState<string>("");
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    Promise.all([listTemplates(), docDefaults(dealId), fromDoc ? docParams(fromDoc.id) : Promise.resolve({})]).then(([ts, d, prev]) => {
      setTpls(ts); setPdf(d.pdf); setValues({ ...d.values, ...prev }); setCompanies(d.companies); setCompanyId((d.companies.find((x) => x.isDefault) ?? d.companies[0])?.id ?? ""); setReady(true);
      if (!fromDoc) { const first = ts.find((x) => x.for.includes(dealKind as "sale") || x.for.includes("any")); if (first) { setTplId(first.id); setTitle(tplName(first, lang)); } }
    }).catch(() => setTpls([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);
  const tpl = tpls?.find((x) => x.id === tplId) ?? null;
  const pickTpl = (id: string) => { setTplId(id); const t2 = tpls?.find((x) => x.id === id); if (t2 && (!title || title === (tpl ? tplName(tpl, lang) : ""))) setTitle(tplName(t2, lang)); };
  async function pickCompany(id: string) {
    setCompanyId(id);
    const d = await docDefaults(dealId, id).catch(() => null);
    if (d) setValues((v) => { const n = { ...v }; for (const k of Object.keys(n)) if (k.startsWith("agency.")) delete n[k]; for (const [k, val] of Object.entries(d.values)) if (k.startsWith("agency.")) n[k] = val; return n; });
  }
  const groups = groupFields(tpl?.fields ?? []);
  const filled = (tpl?.fields ?? []).filter((k) => values[k]?.trim()).length;
  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));
  const jump = (g: string) => formRef.current?.querySelector<HTMLElement>(`[data-group="${g}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  async function go() {
    if (!tpl) return;
    setBusy(true); showToast(c.generating);
    try { const used: Record<string, string> = {}; tpl.fields.forEach((k) => { if (values[k]) used[k] = values[k]; }); await generateDoc({ dealId, templateId: tpl.id, title: title.trim() || tplName(tpl, lang), values: used }); showToast(c.saved); onDone(); }
    catch (e) { crmError(e, c.err, t.crm.errReadonly); }
    finally { setBusy(false); }
  }
  const kinds = c.kinds as Record<string, string>;
  const list = (tpls ?? []).filter((x) => x.for.includes("any") || x.for.includes(dealKind as "sale") || fromDoc);
  return (
    <Modal open onClose={onClose} width={1080} sheet="tall">
      <div data-crm-form="1">
        <div className="mb-3 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{c.create}</div><ModalClose onClick={onClose} /></div>
        <div className="grid grid-cols-[300px_1fr] gap-4 max-md:grid-cols-1">
          {/* ---- слева: шаблон и реквизиты ---- */}
          <div className="flex flex-col gap-3">
            <div>
              <label className={lbl}>{c.template}</label>
              <div className="flex max-h-[46vh] flex-col gap-1 overflow-y-auto pr-1 max-md:max-h-none">
                {!ready ? <div className="text-[12.5px] text-muted">…</div> : list.map((x) => (
                  <button key={x.id} type="button" onClick={() => pickTpl(x.id)} className={`cursor-pointer rounded-[6px] border px-3 py-2 text-left ${tplId === x.id ? "border-sel-line bg-blue-tint" : "border-line bg-surface hover:bg-bg-3"}`}>
                    <div className="flex items-start gap-2"><IconFileText size={15} className={`mt-[2px] flex-none ${tplId === x.id ? "text-sel-ink" : "text-muted"}`} /><div className="min-w-0"><div className={`text-[12.5px] font-medium leading-[1.3] ${tplId === x.id ? "text-sel-ink" : "text-ink"}`}>{tplName(x, lang)}</div><div className="text-[11px] text-muted">{kinds[x.kind] ?? x.kind} · {x.lang} · {x.fields.length} {c.fieldsN}{x.builtin ? "" : ` · ${c.own}`}</div></div></div>
                  </button>
                ))}
              </div>
            </div>
            {companies.length > 1 && <div><label className={lbl}>{c.company}</label><Select value={companyId} onChange={pickCompany} options={companies.map((x) => ({ value: x.id, label: x.label || x.fields.name || "—" }))} /></div>}
            {companies.length === 0 && ready && <div className="rounded-[6px] bg-[#fff8e6] px-3 py-2 text-[12px] text-[#a16207]">{c.noCompanyHint}</div>}
            {tpl && groups.length > 1 && (
              <div>
                <label className={lbl}>{c.sections}</label>
                <div className="flex flex-wrap gap-1">{groups.map(([g, keys]) => { const n = keys.filter((k) => values[k]?.trim()).length; return <button key={g} type="button" onClick={() => jump(String(g))} className="inline-flex h-7 cursor-pointer items-center gap-1 rounded-full border border-line bg-surface px-[10px] text-[11.5px] font-medium text-text hover:bg-bg-3">{GROUP_LABELS[g as DocGroup]?.[lang] ?? g}<span className={`text-[10.5px] ${n === keys.length ? "text-green" : "text-muted"}`}>{n}/{keys.length}</span></button>; })}</div>
              </div>
            )}
          </div>
          {/* ---- справа: название и поля ---- */}
          <div className="min-w-0">
            <div className="grid grid-cols-[1fr_auto] items-end gap-3">
              <div><label className={lbl}>{c.docTitle}</label><input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} /></div>
              <div className="pb-[6px] text-[12px] text-muted">{tpl ? `${c.filled}: ${filled}/${tpl.fields.length}` : ""}{!pdf ? ` · ${c.noPdfShort}` : ""}</div>
            </div>
            <div ref={formRef} className="mt-3 max-h-[56vh] overflow-y-auto pr-1 max-md:max-h-none">
              {groups.map(([g, keys]) => (
                <div key={g} data-group={g} className="mb-4">
                  <div className="mb-2 flex items-center justify-between border-b border-line pb-1"><span className="text-[12px] font-semibold text-ink">{GROUP_LABELS[g as DocGroup]?.[lang] ?? g}</span><span className="text-[11px] text-muted">{keys.filter((k) => values[k]?.trim()).length}/{keys.length}</span></div>
                  <div className="grid grid-cols-3 gap-x-3 gap-y-3 max-[1100px]:grid-cols-2 max-md:grid-cols-1">
                    {keys.map((k) => { const f = FIELD_MAP[k]; const label = f?.label[lang] ?? k; const wide = f?.type === "textarea";
                      return (
                        <div key={k} className={wide ? "col-span-3 max-[1100px]:col-span-2 max-md:col-span-1" : ""}>
                          <label className={lbl}>{label}{f?.required ? <span className="text-red"> *</span> : ""}{values[k]?.trim() ? <IconCheck size={11} className="ml-1 inline text-green" /> : null}</label>
                          {f?.type === "select" ? <Select value={values[k] ?? ""} onChange={(v) => set(k, v)} options={[{ value: "", label: "—" }, ...(f.options ?? []).map((o) => ({ value: o, label: o }))]} />
                            : wide ? <textarea value={values[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={`${inp} min-h-[64px] resize-y py-2`} />
                            : f?.type === "date" ? <DateField value={values[k] ?? ""} onChange={(v) => set(k, v)} />
                            : <input inputMode={f?.type === "money" || f?.type === "number" ? "decimal" : undefined} value={values[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={inp} />}
                        </div>
                      ); })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3"><span className="text-[12px] text-muted">{c.fill}</span><span className="flex gap-2"><button type="button" onClick={onClose} className={btnS}>{t.crm.cancel}</button><button type="button" onClick={go} disabled={busy || !tpl} className={btnP}><IconFileText size={15} /> {busy ? c.generating : c.generate}</button></span></div>
      </div>
    </Modal>
  );
}

function DocUploadModal({ dealId, onClose, onDone }: { dealId: string; onClose: () => void; onDone: () => void }) {
  const { t } = useI18n();
  const c = t.crm.docs;
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState("other");
  const [busy, setBusy] = useState(false);
  async function go() {
    if (!file) return;
    setBusy(true);
    try { const fd = new FormData(); fd.set("file", file); fd.set("dealId", dealId); fd.set("title", title); fd.set("kind", kind); await uploadDoc(fd); onDone(); }
    catch (e) { crmError(e, c.err, t.crm.errReadonly); }
    finally { setBusy(false); }
  }
  const kinds = c.kinds as Record<string, string>;
  return (
    <Modal open onClose={onClose} width={480}>
      <div data-crm-form="1">
        <div className="mb-3 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{c.uploadT}</div><ModalClose onClick={onClose} /></div>
        <label className={`${btnS} mb-3 w-full cursor-pointer justify-center`}><IconUpload size={14} /> {file ? file.name : c.uploadPick}<input type="file" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "")); }} className="hidden" /></label>
        <label className={lbl}>{c.docTitle}</label>
        <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} />
        <label className={`${lbl} mt-3`}>{c.uploadKind}</label>
        <Select value={kind} onChange={setKind} options={["passport", "deed", "receipt", "sale", "rent", "other"].map((k) => ({ value: k, label: kinds[k] ?? k }))} />
        <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className={btnS}>{t.crm.cancel}</button><button type="button" onClick={go} disabled={busy || !file} className={btnP}><IconUpload size={15} /> {c.upload}</button></div>
      </div>
    </Modal>
  );
}
