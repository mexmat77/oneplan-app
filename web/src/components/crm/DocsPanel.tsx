"use client";

// Документы сделки: список (Word / PDF / файл, статус), «Создать документ» из шаблона с формой полей по группам,
// «Загрузить файл». Значения формы предзаполняются реквизитами, клиентом, объектом и прошлыми документами сделки.
import { useCallback, useEffect, useMemo, useState } from "react";
import { IconDownload, IconFileText, IconFileTypePdf, IconPaperclip, IconPlus, IconSparkles, IconTrash, IconUpload } from "@tabler/icons-react";
import { deleteDoc, docDefaults, docParams, docUrl, generateDoc, listDocs, listTemplates, setDocStatus, uploadDoc, type DocInfo, type TemplateInfo } from "@/app/crm/doc-actions";
import { confirmDialog } from "@/components/ui/confirm";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import type { Lang } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { FIELD_MAP, GROUP_LABELS, type DocGroup } from "@/lib/crm/docFields";
import { btnP, btnS, fmtDate, inp, lbl, useCrm } from "./crmUi";

const tplName = (t: TemplateInfo, lang: Lang) => (typeof t.name === "string" ? t.name : t.name[lang] ?? t.name.RU);

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
  const err = (e: unknown) => showToast((e as Error).message === "readonly" ? t.crm.errReadonly : c.err);
  async function open(d: DocInfo, which: "docx" | "pdf" | "file") { try { window.open(await docUrl(d.id, which), "_blank", "noopener"); } catch (e) { err(e); } }
  async function del(d: DocInfo) { if (!(await confirmDialog({ text: c.delQ, danger: true }))) return; try { await deleteDoc(d.id); load(); } catch (e) { err(e); } }
  async function status(d: DocInfo, st: DocInfo["status"]) { try { await setDocStatus(d.id, st, d.validUntil); load(); } catch (e) { err(e); } }
  const kinds = c.kinds as Record<string, string>;
  return (
    <div className="mt-3 rounded-[12px] border border-dashed border-line p-3">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div className="text-[12px] font-extrabold uppercase tracking-[.04em] text-muted">{c.title}{docs ? ` · ${docs.length}` : ""}</div>
        <div className="flex gap-2">
          <button type="button" onClick={() => setUpload(true)} disabled={ro} className={`${btnS} px-3 py-[6px] text-[12px]`}><IconUpload size={13} /> {c.upload}</button>
          <button type="button" onClick={() => setCreate({ open: true })} disabled={ro} className={`${btnP} px-3 py-[6px] text-[12px]`}><IconPlus size={13} /> {c.create}</button>
        </div>
      </div>
      {docs === null ? <div className="text-[12.5px] text-muted">…</div> : docs.length === 0 ? <div className="text-[12.5px] text-muted">{c.none}</div> : (
        <div className="flex flex-col gap-1">
          {docs.map((d) => (
            <div key={d.id} className="flex flex-wrap items-center gap-2 rounded-[10px] bg-bg-2 px-3 py-2 text-[12.5px]">
              {d.hasFile ? <IconPaperclip size={15} className="text-muted" /> : <IconFileText size={15} className="text-blue-2" />}
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{d.title} <span className="font-normal text-muted">· {kinds[d.kind] ?? d.kind} · {fmtDate(d.createdAt, lang)}</span></span>
              <Select value={d.status} onChange={(v) => status(d, v as DocInfo["status"])} options={(["draft", "sent", "signed", "void"] as const).map((k) => ({ value: k, label: c.status[k] }))} size="sm" className="w-[130px]" disabled={ro} />
              {d.hasPdf && <button type="button" onClick={() => open(d, "pdf")} title={c.pdf} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[7px] text-red hover:bg-surface"><IconFileTypePdf size={16} /></button>}
              {d.hasDocx && <button type="button" onClick={() => open(d, "docx")} title={c.docx} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[7px] text-blue-2 hover:bg-surface"><IconFileText size={16} /></button>}
              {d.hasFile && <button type="button" onClick={() => open(d, "file")} title={c.download} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[7px] text-ink hover:bg-surface"><IconDownload size={16} /></button>}
              {d.hasDocx && !ro && <button type="button" onClick={() => setCreate({ open: true, fromDoc: d })} title={c.create} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[7px] text-muted hover:bg-surface hover:text-ink"><IconSparkles size={15} /></button>}
              <button type="button" onClick={() => del(d)} disabled={ro} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[7px] text-muted hover:bg-red-tint hover:text-red"><IconTrash size={15} /></button>
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
  const [busy, setBusy] = useState(false);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    Promise.all([listTemplates(), docDefaults(dealId), fromDoc ? docParams(fromDoc.id) : Promise.resolve({})]).then(([ts, d, prev]) => {
      setTpls(ts); setPdf(d.pdf); setValues({ ...d.values, ...prev }); setReady(true);
      if (!fromDoc) { const first = ts.find((x) => x.for.includes(dealKind as "sale") || x.for.includes("any")); if (first) { setTplId(first.id); setTitle(tplName(first, lang)); } }
    }).catch(() => setTpls([]));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dealId]);
  const tpl = tpls?.find((x) => x.id === tplId) ?? null;
  // смена шаблона подставляет его название в заголовок документа (если пользователь не писал своё)
  const pickTpl = (id: string) => { setTplId(id); const t2 = tpls?.find((x) => x.id === id); if (t2 && (!title || title === (tpl ? tplName(tpl, lang) : ""))) setTitle(tplName(t2, lang)); };
  const groups = useMemo(() => {
    const g = new Map<DocGroup | string, string[]>();
    (tpl?.fields ?? []).forEach((k) => { const grp = FIELD_MAP[k]?.group ?? k.split(".")[0]; g.set(grp, [...(g.get(grp) ?? []), k]); });
    return [...g.entries()];
  }, [tpl]);
  const set = (k: string, v: string) => setValues((p) => ({ ...p, [k]: v }));
  async function go() {
    if (!tpl) return;
    setBusy(true); showToast(c.generating);
    try { const used: Record<string, string> = {}; tpl.fields.forEach((k) => { if (values[k]) used[k] = values[k]; }); await generateDoc({ dealId, templateId: tpl.id, title: title.trim() || tplName(tpl, lang), values: used }); showToast(c.saved); onDone(); }
    catch (e) { showToast((e as Error).message === "readonly" ? t.crm.errReadonly : c.err); }
    finally { setBusy(false); }
  }
  const opts = (tpls ?? []).filter((x) => x.for.includes("any") || x.for.includes(dealKind as "sale") || fromDoc).map((x) => ({ value: x.id, label: `${tplName(x, lang)}${x.builtin ? "" : " · ✎"}` }));
  return (
    <Modal open onClose={onClose} width={720} sheet="tall">
      <div className="mb-3 flex items-center justify-between"><div className="text-[18px] font-extrabold text-ink">{c.create}</div><ModalClose onClick={onClose} /></div>
      <div className="grid grid-cols-[1.2fr_1fr] gap-3 max-md:grid-cols-1">
        <div><label className={lbl}>{c.template}</label><Select value={tplId} onChange={pickTpl} options={opts} searchable disabled={!ready} /></div>
        <div><label className={lbl}>{c.docTitle}</label><input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} /></div>
      </div>
      <p className="mb-2 mt-3 text-[12.5px] text-muted">{c.fill}{!pdf ? ` ${c.noPdf}` : ""}</p>
      <div className="max-h-[52vh] overflow-y-auto pr-1 max-md:max-h-none">
        {groups.map(([g, keys]) => (
          <div key={g} className="mb-3">
            <div className="mb-[6px] text-[12px] font-extrabold uppercase tracking-[.04em] text-ink">{GROUP_LABELS[g as DocGroup]?.[lang] ?? g}</div>
            <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
              {keys.map((k) => { const f = FIELD_MAP[k]; const label = f?.label[lang] ?? k; const wide = f?.type === "textarea";
                return (
                  <div key={k} className={wide ? "col-span-2 max-md:col-span-1" : ""}>
                    <label className="mb-[3px] block text-[11.5px] font-semibold text-muted">{label}{f?.required ? " *" : ""}</label>
                    {f?.type === "select" ? <Select value={values[k] ?? ""} onChange={(v) => set(k, v)} options={[{ value: "", label: "—" }, ...(f.options ?? []).map((o) => ({ value: o, label: o }))]} size="sm" />
                      : wide ? <textarea value={values[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={`${inp} min-h-[60px] resize-y py-2 text-[13px]`} />
                      : <input type={f?.type === "date" ? "date" : "text"} inputMode={f?.type === "money" || f?.type === "number" ? "decimal" : undefined} value={values[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={`${inp} py-2 text-[13px]`} />}
                  </div>
                ); })}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-3 flex justify-end gap-2"><button type="button" onClick={onClose} className={btnS}>{t.crm.cancel}</button><button type="button" onClick={go} disabled={busy || !tpl} className={btnP}><IconFileText size={15} /> {busy ? c.generating : c.generate}</button></div>
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
    catch (e) { showToast((e as Error).message === "readonly" ? t.crm.errReadonly : c.err); }
    finally { setBusy(false); }
  }
  const kinds = c.kinds as Record<string, string>;
  return (
    <Modal open onClose={onClose} width={460}>
      <div className="mb-3 flex items-center justify-between"><div className="text-[18px] font-extrabold text-ink">{c.uploadT}</div><ModalClose onClick={onClose} /></div>
      <label className={lbl}>{c.uploadPick}</label>
      <input type="file" onChange={(e) => { const f = e.target.files?.[0] ?? null; setFile(f); if (f && !title) setTitle(f.name.replace(/\.[^.]+$/, "")); }} className="mb-3 block w-full text-[13px]" />
      <label className={lbl}>{c.docTitle}</label>
      <input value={title} onChange={(e) => setTitle(e.target.value)} className={inp} />
      <label className={`${lbl} mt-3`}>{c.uploadKind}</label>
      <Select value={kind} onChange={setKind} options={["passport", "deed", "receipt", "sale", "rent", "other"].map((k) => ({ value: k, label: kinds[k] ?? k }))} />
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className={btnS}>{t.crm.cancel}</button><button type="button" onClick={go} disabled={busy || !file} className={btnP}><IconUpload size={15} /> {c.upload}</button></div>
    </Modal>
  );
}
