"use client";

// Документы сделки (12.10.2026, «эталон»: данные вводятся ОДИН раз): «Данные для документов» — одна форма на сделку
// (стороны, объект, условия; реквизиты — выбранный набор), хранится в сделке; «Сформировать документы» — чек-лист шаблонов с
// готовностью (сколько полей заполнено, чего не хватает), недостающие поля вводятся тут же, несколько документов создаются
// за раз. Список документов: PDF / Word / файл, статус, срок. Скачивание — с человеческим именем файла (`saveSigned`).
import { useCallback, useEffect, useRef, useState } from "react";
import { IconCheck, IconDownload, IconFileText, IconFileTypePdf, IconForms, IconPaperclip, IconPlus, IconTrash, IconUpload } from "@tabler/icons-react";
import { deleteDoc, docDefaults, docUrl, generateDocs, listDocs, listTemplates, saveDealDocData, setDocStatus, uploadDoc, type CompanyProfile, type DocInfo, type TemplateInfo } from "@/app/crm/doc-actions";
import { confirmDialog } from "@/components/ui/confirm";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { DateField } from "@/components/ui/DateRange";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import type { Lang } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { FIELD_MAP, GROUP_LABELS, type DocGroup } from "@/lib/crm/docFields";
import { crmError, btnP, btnS, fill, fmtDate, inp, lbl, useCrm } from "./crmUi";

export const tplName = (t: TemplateInfo, lang: Lang) => (typeof t.name === "string" ? t.name : t.name[lang] ?? t.name.RU);
function groupFields(fields: string[]): [string, string[]][] {
  const g = new Map<string, string[]>();
  const order = Object.keys(GROUP_LABELS);
  fields.forEach((k) => { const grp = FIELD_MAP[k]?.group ?? k.split(".")[0]; g.set(grp, [...(g.get(grp) ?? []), k]); });
  return [...g.entries()].sort((a, b) => (order.indexOf(a[0]) === -1 ? 99 : order.indexOf(a[0])) - (order.indexOf(b[0]) === -1 ? 99 : order.indexOf(b[0])));
}
const STATUS_COLOR: Record<DocInfo["status"], string> = { draft: "#8a93a2", sent: "#4d7cfe", signed: "#22c15e", void: "#e5484d" };
const forDeal = (x: TemplateInfo, dealKind: string) => x.for.includes("any") || x.for.includes(dealKind);

/** Скачать подписанную ссылку Storage под человеческим именем (из параметра `download`): браузер иначе показывал
 *  percent-encoded имя (замечание пользователя 12.10.2026). PDF без параметра — открыть во вкладке. */
export async function saveSigned(url: string) {
  const name = new URL(url).searchParams.get("download");
  if (!name) { window.open(url, "_blank", "noopener"); return; }
  try {
    const blob = await (await fetch(url)).blob();
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 10_000);
  } catch { window.open(url, "_blank", "noopener"); }
}

/** Поле документа по реестру (select / дата / многострочное / число / текст). */
function FieldInput({ k, value, onChange, lang }: { k: string; value: string; onChange: (v: string) => void; lang: Lang }) {
  const f = FIELD_MAP[k];
  if (f?.type === "select") return <Select value={value} onChange={onChange} options={[{ value: "", label: "—" }, ...(f.options ?? []).map((o) => ({ value: o, label: o }))]} />;
  if (f?.type === "textarea") return <textarea value={value} onChange={(e) => onChange(e.target.value)} className={`${inp} min-h-[64px] resize-y py-2`} />;
  if (f?.type === "date") return <DateField value={value} onChange={onChange} />;
  return <input inputMode={f?.type === "money" || f?.type === "number" ? "decimal" : /phone/i.test(f?.key ?? "") ? "tel" : /email/i.test(f?.key ?? "") ? "email" : undefined} value={value} onChange={(e) => onChange(e.target.value)} className={inp} placeholder={f?.hint?.[lang]} />;
}

export function DocsPanel({ dealId, dealKind, onChange }: { dealId: string; dealKind: string; onChange?: () => void }) {
  const { t, lang } = useI18n();
  const c = t.crm.docs;
  const crm = useCrm();
  const ro = crm.me.access !== "full";
  const [docs, setDocs] = useState<DocInfo[] | null>(null);
  const [modal, setModal] = useState<"" | "data" | "generate" | "upload">("");
  const load = useCallback(() => { listDocs({ dealId }).then(setDocs).catch(() => setDocs([])); }, [dealId]);
  useEffect(() => { load(); }, [load]);
  const err = (e: unknown) => crmError(e, c.err, t.crm.errReadonly);
  async function open(d: DocInfo, which: "docx" | "pdf" | "file") { try { await saveSigned(await docUrl(d.id, which)); } catch (e) { err(e); } }
  async function del(d: DocInfo) { if (!(await confirmDialog({ text: c.delQ, danger: true }))) return; try { await deleteDoc(d.id); load(); } catch (e) { err(e); } }
  async function status(d: DocInfo, st: DocInfo["status"]) { try { await setDocStatus(d.id, st, d.validUntil); load(); } catch (e) { err(e); } }
  const kinds = c.kinds as Record<string, string>;
  const size = (n: number | null) => (n ? (n > 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`) : "");
  return (
    <div className="mt-3 rounded-[6px] border border-line bg-[#fafbfc] p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] font-semibold uppercase tracking-[.04em] text-muted">{c.title}{docs ? ` · ${docs.length}` : ""}</div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setModal("data")} disabled={ro} title={c.dataS} className={`${btnS} h-7 px-2 text-[12px]`}><IconForms size={13} /> {c.data}</button>
          <button type="button" onClick={() => setModal("upload")} disabled={ro} className={`${btnS} h-7 px-2 text-[12px]`}><IconUpload size={13} /> {c.upload}</button>
          <button type="button" onClick={() => setModal("generate")} disabled={ro} className={`${btnP} h-7 px-2 text-[12px]`}><IconPlus size={13} /> {c.generateMany}</button>
        </div>
      </div>
      {docs === null ? <div className="text-[12.5px] text-muted">…</div> : docs.length === 0 ? <div className="text-[12.5px] text-muted">{c.none}</div> : (
        <div className="flex flex-col gap-1">
          {docs.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-[6px] border border-line bg-surface px-3 py-[6px] text-[12.5px]">
              <button type="button" onClick={() => open(d, d.hasPdf ? "pdf" : d.hasDocx ? "docx" : "file")} title={c.open} className="flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-[6px] bg-bg-2 text-ink hover:bg-blue-tint">{d.hasFile ? <IconPaperclip size={16} className="text-muted" /> : d.hasPdf ? <IconFileTypePdf size={16} className="text-red" /> : <IconFileText size={16} className="text-blue-2" />}</button>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => open(d, d.hasPdf ? "pdf" : d.hasDocx ? "docx" : "file")} className="block max-w-full cursor-pointer truncate text-left font-semibold text-ink hover:text-blue-2">{d.title}</button>
                <div className="truncate text-[11.5px] text-muted">{kinds[d.kind] ?? d.kind} · {fmtDate(d.createdAt, lang)}{d.size ? ` · ${size(d.size)}` : ""}{d.validUntil ? ` · ${c.validUntil} ${fmtDate(d.validUntil, lang)}` : ""}</div>
              </div>
              <span className="inline-flex items-center gap-[6px]"><span className="h-2 w-2 rounded-full" style={{ background: STATUS_COLOR[d.status] }} /><Select value={d.status} onChange={(v) => status(d, v as DocInfo["status"])} options={(["draft", "sent", "signed", "void"] as const).map((k) => ({ value: k, label: c.status[k] }))} size="sm" menuWidth="auto" disabled={ro} className="w-[140px]" /></span>
              {d.hasPdf && <button type="button" onClick={() => open(d, "pdf")} title={c.pdf} className={`${btnS} h-7 px-2 text-[12px]`}><IconFileTypePdf size={14} className="text-red" /> PDF</button>}
              {d.hasDocx && <button type="button" onClick={() => open(d, "docx")} title={c.docx} className={`${btnS} h-7 px-2 text-[12px]`}><IconFileText size={14} className="text-blue-2" /> Word</button>}
              {d.hasFile && <button type="button" onClick={() => open(d, "file")} title={c.download} className={`${btnS} h-7 px-2 text-[12px]`}><IconDownload size={14} /> {c.download}</button>}
              <button type="button" onClick={() => del(d)} disabled={ro} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-red-tint hover:text-red"><IconTrash size={15} /></button>
            </div>
          ))}
        </div>
      )}
      {modal === "data" && <DealDataModal dealId={dealId} dealKind={dealKind} onClose={() => setModal("")} onDone={() => { setModal(""); onChange?.(); }} />}
      {modal === "generate" && <GenerateModal dealId={dealId} dealKind={dealKind} onClose={() => setModal("")} onDone={() => { setModal(""); load(); onChange?.(); }} onData={() => setModal("data")} />}
      {modal === "upload" && <DocUploadModal dealId={dealId} onClose={() => setModal("")} onDone={() => { setModal(""); load(); onChange?.(); }} />}
    </div>
  );
}

/** Общее состояние обеих модалок: шаблоны этого типа сделки, значения (автоподстановка + сохранённые), наборы реквизитов. */
function useDocData(dealId: string, dealKind: string) {
  const [tpls, setTpls] = useState<TemplateInfo[] | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [companies, setCompanies] = useState<CompanyProfile[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [pdf, setPdf] = useState(true);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let on = true;
    Promise.all([listTemplates(), docDefaults(dealId)]).then(([ts, d]) => { if (!on) return; setTpls(ts.filter((x) => forDeal(x, dealKind))); setValues(d.values); setCompanies(d.companies); setCompanyId(d.companyId ?? ""); setPdf(d.pdf); setReady(true); }).catch(() => { if (on) { setTpls([]); setReady(true); } });
    return () => { on = false; };
  }, [dealId, dealKind]);
  async function pickCompany(id: string) {
    setCompanyId(id);
    const d = await docDefaults(dealId, id).catch(() => null);
    if (d) setValues((v) => { const n = { ...v }; for (const k of Object.keys(n)) if (k.startsWith("agency.")) delete n[k]; for (const [k, val] of Object.entries(d.values)) if (k.startsWith("agency.")) n[k] = val; return n; });
  }
  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));
  return { tpls, values, set, companies, companyId, pickCompany, pdf, ready };
}

/** «Данные для документов»: все поля шаблонов этого типа сделки по группам — заполняются один раз. */
function DealDataModal({ dealId, dealKind, onClose, onDone }: { dealId: string; dealKind: string; onClose: () => void; onDone: () => void }) {
  const { t, lang } = useI18n();
  const c = t.crm.docs;
  const { tpls, values, set, companies, companyId, pickCompany, ready } = useDocData(dealId, dealKind);
  const [busy, setBusy] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);
  const all = [...new Set((tpls ?? []).flatMap((x) => x.fields))].filter((k) => !k.startsWith("agency."));
  const groups = groupFields(all);
  const filled = all.filter((k) => values[k]?.trim()).length;
  const jump = (g: string) => formRef.current?.querySelector<HTMLElement>(`[data-group="${g}"]`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  async function save() {
    setBusy(true);
    try { const used: Record<string, string> = {}; all.forEach((k) => { used[k] = values[k] ?? ""; }); await saveDealDocData(dealId, used, companyId || null); showToast(c.dataSaved); onDone(); }
    catch (e) { crmError(e, c.err, t.crm.errReadonly); }
    finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} width={1080} sheet="tall">
      <div data-crm-form="1">
        <div className="mb-1 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{c.data}</div><ModalClose onClick={onClose} /></div>
        <p className="mb-3 text-[12.5px] text-muted">{c.dataS}</p>
        <div className="grid grid-cols-[260px_1fr] gap-4 max-md:grid-cols-1">
          <div className="flex flex-col gap-3">
            {companies.length > 0 && <div><label className={lbl}>{c.company}</label><Select value={companyId} onChange={pickCompany} options={companies.map((x) => ({ value: x.id, label: x.label || x.fields.name || "—" }))} /></div>}
            {companies.length === 0 && ready && <div className="rounded-[6px] bg-[#fff8e6] px-3 py-2 text-[12px] text-[#a16207]">{c.noCompanyHint}</div>}
            <div>
              <label className={lbl}>{c.sections}</label>
              <div className="flex flex-col gap-1">{groups.map(([g, keys]) => { const n = keys.filter((k) => values[k]?.trim()).length; return <button key={g} type="button" onClick={() => jump(g)} className="flex cursor-pointer items-center justify-between rounded-[6px] border border-line bg-surface px-3 py-[6px] text-left text-[12.5px] text-text hover:bg-bg-3"><span>{GROUP_LABELS[g as DocGroup]?.[lang] ?? g}</span><span className={`text-[11px] ${n === keys.length ? "text-green" : "text-muted"}`}>{n}/{keys.length}</span></button>; })}</div>
            </div>
            <div className="text-[12px] text-muted">{fill(c.filledOf, { a: filled, b: all.length })}</div>
          </div>
          <div ref={formRef} className="max-h-[62vh] min-w-0 overflow-y-auto pr-1 max-md:max-h-none">
            {!ready && <div className="text-[12.5px] text-muted">…</div>}
            {groups.map(([g, keys]) => (
              <div key={g} data-group={g} className="mb-4">
                <div className="mb-2 flex items-center justify-between border-b border-line pb-1"><span className="text-[12px] font-semibold text-ink">{GROUP_LABELS[g as DocGroup]?.[lang] ?? g}</span><span className="text-[11px] text-muted">{keys.filter((k) => values[k]?.trim()).length}/{keys.length}</span></div>
                <div className="grid grid-cols-3 gap-x-3 gap-y-3 max-[1100px]:grid-cols-2 max-md:grid-cols-1">
                  {keys.map((k) => { const f = FIELD_MAP[k]; const wide = f?.type === "textarea"; return (
                    <div key={k} className={wide ? "col-span-3 max-[1100px]:col-span-2 max-md:col-span-1" : ""}>
                      <label className={lbl}>{f?.label[lang] ?? k}{f?.required ? <span className="text-red"> *</span> : ""}{values[k]?.trim() ? <IconCheck size={11} className="ml-1 inline text-green" /> : null}</label>
                      <FieldInput k={k} value={values[k] ?? ""} onChange={(v) => set(k, v)} lang={lang} />
                    </div>); })}
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="mt-3 flex justify-end gap-2 border-t border-line pt-3"><button type="button" onClick={onClose} className={btnS}>{t.crm.cancel}</button><button type="button" onClick={save} disabled={busy || !ready} className={btnP}><IconCheck size={15} /> {c.dataSave}</button></div>
      </div>
    </Modal>
  );
}

/** «Сформировать документы»: чек-лист шаблонов с готовностью; недостающие поля выбранных — тут же; несколько за раз. */
function GenerateModal({ dealId, dealKind, onClose, onDone, onData }: { dealId: string; dealKind: string; onClose: () => void; onDone: () => void; onData: () => void }) {
  const { t, lang } = useI18n();
  const c = t.crm.docs;
  const { tpls, values, set, pdf, ready } = useDocData(dealId, dealKind);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const kinds = c.kinds as Record<string, string>;
  const missingOf = (x: TemplateInfo) => x.fields.filter((k) => !values[k]?.trim());
  const picked = (tpls ?? []).filter((x) => sel.has(x.id));
  const missing = [...new Set(picked.flatMap(missingOf))];
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  async function go() {
    if (!picked.length) return;
    setBusy(true); showToast(c.generating);
    try { const r = await generateDocs(dealId, picked.map((x) => x.id), values); showToast(fill(c.generatedN, { n: r.length })); onDone(); }
    catch (e) { crmError(e, c.err, t.crm.errReadonly); }
    finally { setBusy(false); }
  }
  return (
    <Modal open onClose={onClose} width={820} sheet="tall">
      <div data-crm-form="1">
        <div className="mb-1 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{c.generateMany}</div><ModalClose onClick={onClose} /></div>
        <p className="mb-3 text-[12.5px] text-muted">{c.pickTpls}{!pdf ? ` · ${c.noPdfShort}` : ""}</p>
        {!ready && <div className="text-[12.5px] text-muted">…</div>}
        {ready && (tpls ?? []).length === 0 && <div className="rounded-[6px] bg-[#fff8e6] px-3 py-2 text-[12.5px] text-[#a16207]">{c.noTpls}</div>}
        <div className="flex max-h-[42vh] flex-col gap-1 overflow-y-auto pr-1">
          {(tpls ?? []).map((x) => { const miss = missingOf(x); const on = sel.has(x.id); const okAll = miss.length === 0; return (
            <label key={x.id} className={`flex cursor-pointer items-center gap-3 rounded-[6px] border px-3 py-2 ${on ? "border-sel-line bg-blue-tint" : "border-line bg-surface hover:bg-bg-3"}`}>
              <input type="checkbox" checked={on} onChange={() => toggle(x.id)} />
              <IconFileText size={16} className={on ? "text-sel-ink" : "text-muted"} />
              <span className="min-w-0 flex-1"><span className="block truncate text-[13px] font-medium text-ink">{tplName(x, lang)}</span><span className="block text-[11.5px] text-muted">{kinds[x.kind] ?? x.kind} · {x.lang}{x.builtin ? "" : ` · ${c.own}`}</span></span>
              <span className={`whitespace-nowrap rounded-[4px] px-2 py-[2px] text-[11px] font-semibold ${okAll ? "bg-green-tint text-green" : "bg-[#fff8e6] text-[#a16207]"}`}>{okAll ? c.ready : fill(c.missingN, { n: miss.length })}</span>
            </label>); })}
        </div>
        {picked.length > 0 && missing.length > 0 && (
          <div className="mt-3 rounded-[6px] border border-line bg-[#fafbfc] p-3">
            <div className="mb-2 flex items-center justify-between"><span className="text-[12px] font-semibold text-ink">{c.missingFields} · {missing.length}</span><button type="button" onClick={onData} className="cursor-pointer text-[12px] font-semibold text-blue-2 hover:underline">{c.data}</button></div>
            <div className="grid max-h-[30vh] grid-cols-3 gap-x-3 gap-y-3 overflow-y-auto pr-1 max-[1100px]:grid-cols-2 max-md:grid-cols-1">
              {missing.map((k) => { const f = FIELD_MAP[k]; const wide = f?.type === "textarea"; return (
                <div key={k} className={wide ? "col-span-3 max-[1100px]:col-span-2 max-md:col-span-1" : ""}>
                  <label className={lbl}>{GROUP_LABELS[(f?.group ?? k.split(".")[0]) as DocGroup]?.[lang] ?? ""} · {f?.label[lang] ?? k}</label>
                  <FieldInput k={k} value={values[k] ?? ""} onChange={(v) => set(k, v)} lang={lang} />
                </div>); })}
            </div>
          </div>
        )}
        <div className="mt-3 flex items-center justify-between gap-2 border-t border-line pt-3">
          <span className="text-[12px] text-muted">{c.fill}</span>
          <span className="flex gap-2"><button type="button" onClick={onClose} className={btnS}>{t.crm.cancel}</button><button type="button" onClick={go} disabled={busy || !picked.length} className={btnP}><IconFileText size={15} /> {fill(c.generateN, { n: picked.length })}</button></span>
        </div>
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
