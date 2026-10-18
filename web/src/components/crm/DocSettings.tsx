"use client";

import { kbAutoFocus } from "@/lib/touch";
// Настройки документов CRM (12.10.2026, «довести до идеала»): наборы реквизитов (несколько юрлиц/филиалов, основной,
// карточка реквизитов DOCX/PDF для контрагента) и шаблоны (таблица, предпросмотр PDF с образцами, скачать DOCX, поля,
// переименование и тип своих шаблонов, загрузка своего).
import { useEffect, useState } from "react";
import { IconBuilding, IconChevronDown, IconCodeDots, IconDownload, IconEye, IconFileTypePdf, IconPencil, IconPlus, IconStar, IconStarFilled, IconTrash, IconUpload } from "@tabler/icons-react";
import { Switch } from "@/components/ui/Switch";
import { companyCardUrl, deleteCompanyProfile, deleteTemplate, getCompanies, listTemplates, previewTemplate, saveCompanyProfile, templateUrl, updateTemplate, uploadTemplate, type Company, type CompanyProfile, type TemplateInfo, setTemplateEnabled, setAllBuiltinEnabled } from "@/app/crm/doc-actions";
import { confirmDialog } from "@/components/ui/confirm";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import type { Lang } from "@/i18n";
import { useI18n } from "@/i18n/provider";
import { FIELDS, FIELD_MAP, GROUP_LABELS, type DocGroup } from "@/lib/crm/docFields";
import { crmError, btnP, btnS, card, chip, inp, lbl, useCrm } from "./crmUi";
import { saveSigned } from "./DocsPanel";

const tplName = (t: TemplateInfo, lang: Lang) => (typeof t.name === "string" ? t.name : t.name[lang] ?? t.name.RU);
const COMPANY_GROUPS: [string, string[]][] = [["company", ["name", "taxNo", "taxOffice", "mersis", "registryNo", "licenseNo"]], ["contacts", ["representative", "phone", "email", "address"]], ["bank", ["bank", "iban"]]];
const KINDS = ["sale", "rent", "deposit", "viewing", "handover", "consent", "other"];

export function CompanySettings() {
  const { t } = useI18n();
  const c = t.crm; const d = c.docs;
  const crm = useCrm();
  const ro = crm.me.access !== "full" || !crm.me.isAdmin; // реквизиты/шаблоны правит администратор агентства, команда видит и использует
  const [list, setList] = useState<CompanyProfile[] | null>(null);
  const [edit, setEdit] = useState<{ open: boolean; pr: CompanyProfile | null }>({ open: false, pr: null });
  useEffect(() => { getCompanies().then(setList).catch(() => setList([])); }, []);
  const err = (e: unknown) => showToast((e as Error).message === "readonly" ? c.errReadonly : (e as Error).message === "no-pdf" ? d.noPdf : c.errSave);
  async function openCard(pr: CompanyProfile, which: "docx" | "pdf") { try { await saveSigned(await companyCardUrl(pr.id, which)); } catch (e) { err(e); } }
  async function makeDefault(pr: CompanyProfile) { try { setList(await saveCompanyProfile({ ...pr, isDefault: true })); } catch (e) { err(e); } }
  async function del(pr: CompanyProfile) { if (!(await confirmDialog({ text: `${pr.label || pr.fields.name}?`, danger: true }))) return; try { setList(await deleteCompanyProfile(pr.id)); } catch (e) { err(e); } }
  return (
    <div className={card}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div><div className="text-[15px] font-semibold text-ink">{d.company}</div><p className="mt-1 text-[12.5px] text-muted">{d.companyS2}{!crm.me.isAdmin && <> <span className="font-semibold text-text">{d.ownerOnly}</span></>}</p></div>
        <button type="button" disabled={ro} onClick={() => setEdit({ open: true, pr: null })} className={btnP}><IconPlus size={14} /> {d.addCompany}</button>
      </div>
      {!list ? <div className="mt-3 text-[13px] text-muted">…</div> : list.length === 0 ? (
        <div className="mt-3 rounded-[6px] border border-dashed border-line px-4 py-6 text-center text-[13px] text-muted">{d.noCompany}</div>
      ) : (
        <div className="mt-3 grid grid-cols-2 gap-3 max-[1100px]:grid-cols-1">
          {list.map((pr) => (
            <div key={pr.id} className={`rounded-[6px] border p-3 ${pr.isDefault ? "border-sel-line bg-blue-tint/30" : "border-line"}`}>
              <div className="flex items-start gap-2">
                <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[6px] bg-bg-2 text-muted"><IconBuilding size={18} /></span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2"><span className="truncate text-[13.5px] font-semibold text-ink">{pr.label || pr.fields.name || "—"}</span>{pr.isDefault && <span className={chip}>{d.defaultCompany}</span>}</div>
                  <div className="truncate text-[12.5px] text-text">{pr.fields.name}</div>
                  <div className="mt-1 grid grid-cols-2 gap-x-3 gap-y-[2px] text-[12px] text-muted">
                    {(["taxNo", "taxOffice", "mersis", "licenseNo", "iban", "representative", "phone", "email"] as const).filter((k) => pr.fields[k]).map((k) => <div key={k} className="truncate"><span className="text-muted-2">{d.companyFields[k]}:</span> <span className="text-text">{pr.fields[k]}</span></div>)}
                    {pr.fields.address && <div className="col-span-2 truncate"><span className="text-muted-2">{d.companyFields.address}:</span> <span className="text-text">{pr.fields.address}</span></div>}
                  </div>
                </div>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-line pt-2">
                <button type="button" onClick={() => openCard(pr, "pdf")} className={`${btnS} h-7 px-2 text-[12px]`}><IconFileTypePdf size={14} className="text-red" /> {d.cardPdf}</button>
                <button type="button" onClick={() => openCard(pr, "docx")} className={`${btnS} h-7 px-2 text-[12px]`}><IconDownload size={14} /> {d.cardDocx}</button>
                <span className="flex-1" />
                <button type="button" disabled={ro || pr.isDefault} onClick={() => makeDefault(pr)} title={d.makeDefault} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] text-[#f5a623] hover:bg-bg-2 disabled:cursor-default">{pr.isDefault ? <IconStarFilled size={15} /> : <IconStar size={15} />}</button>
                <button type="button" disabled={ro} onClick={() => setEdit({ open: true, pr })} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-bg-2 hover:text-ink"><IconPencil size={15} /></button>
                <button type="button" disabled={ro} onClick={() => del(pr)} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-red-tint hover:text-red"><IconTrash size={15} /></button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={edit.open} onClose={() => setEdit({ open: false, pr: null })} width={720} sheet="tall">{edit.open && <CompanyForm key={edit.pr?.id ?? "new"} pr={edit.pr} first={!list?.length} onClose={() => setEdit({ open: false, pr: null })} onSaved={(l) => { setList(l); setEdit({ open: false, pr: null }); }} />}</Modal>
    </div>
  );
}

function CompanyForm({ pr, first, onClose, onSaved }: { pr: CompanyProfile | null; first: boolean; onClose: () => void; onSaved: (l: CompanyProfile[]) => void }) {
  const { t } = useI18n();
  const c = t.crm; const d = c.docs;
  const [label, setLabel] = useState(pr?.label ?? "");
  const [isDefault, setIsDefault] = useState(pr?.isDefault ?? first);
  const [f, setF] = useState<Company>(() => ({ ...(pr?.fields ?? {}) }));
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((x) => ({ ...x, [k]: v }));
  async function submit() {
    if (!f.name?.trim()) { showToast(d.needName); return; }
    setBusy(true);
    try { onSaved(await saveCompanyProfile({ id: pr?.id, label, isDefault, fields: f })); showToast(c.set.saved); }
    catch (e) { crmError(e, c.errSave, c.errReadonly); }
    finally { setBusy(false); }
  }
  return (
    <div data-crm-form="1">
      <div className="mb-4 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{pr ? d.editCompany : d.addCompany}</div><ModalClose onClick={onClose} /></div>
      <div className="max-h-[70vh] overflow-y-auto pr-1 max-md:max-h-none">
        <div className="grid grid-cols-[1fr_auto] items-end gap-3">
          <div><label className={lbl}>{d.companyLabel}</label><input value={label} onChange={(e) => setLabel(e.target.value)} placeholder={d.companyLabelPh} className={inp} /></div>
          <label className="flex h-9 cursor-pointer items-center gap-2 text-[13px] text-text"><input type="checkbox" checked={isDefault} onChange={(e) => setIsDefault(e.target.checked)} /> {d.defaultCompany}</label>
        </div>
        {COMPANY_GROUPS.map(([g, keys]) => (
          <div key={g} className="mt-4">
            <div className="mb-2 border-b border-line pb-1 text-[12px] font-semibold text-ink">{(d.companyGroups as Record<string, string>)[g]}</div>
            <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
              {keys.map((k) => <div key={k} className={k === "address" ? "col-span-2 max-md:col-span-1" : ""}><label className={lbl}>{(d.companyFields as Record<string, string>)[k]}{k === "name" ? " *" : ""}</label>{k === "address" ? <textarea value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={`${inp} min-h-[60px] resize-y py-2`} /> : <input value={f[k] ?? ""} onChange={(e) => set(k, e.target.value)} className={inp} />}</div>)}
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={onClose} className={btnS}>{c.cancel}</button><button type="button" onClick={submit} disabled={busy} className={btnP}>{pr ? c.save : c.create}</button></div>
    </div>
  );
}

export function TemplateSettings() {
  const { t, lang } = useI18n();
  const c = t.crm; const d = c.docs;
  const crm = useCrm();
  const ro = crm.me.access !== "full" || !crm.me.isAdmin; // реквизиты/шаблоны правит администратор агентства, команда видит и использует
  const [tpls, setTpls] = useState<TemplateInfo[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [fieldsOf, setFieldsOf] = useState<string | null>(null);
  const [showRef, setShowRef] = useState(false);
  const [up, setUp] = useState<{ file: File | null; name: string; kind: string }>({ file: null, name: "", kind: "other" });
  const [rename, setRename] = useState<{ id: string; name: string } | null>(null);
  useEffect(() => { listTemplates(true).then(setTpls).catch(() => setTpls([])); }, []);
  async function toggle(t2: TemplateInfo) { try { await setTemplateEnabled(t2.id, !t2.enabled); setTpls((v) => (v ?? []).map((x) => (x.id === t2.id ? { ...x, enabled: !t2.enabled } : x))); } catch (e) { err(e); } }
  // «свой комплект»: все встроенные одним движением; свои шаблоны не трогаем
  async function bulkBuiltin(on: boolean) { setBusy("bulk"); try { await setAllBuiltinEnabled(on); setTpls((v) => (v ?? []).map((x) => (x.builtin ? { ...x, enabled: on } : x))); } catch (e) { err(e); } finally { setBusy(null); } }
  const builtinOn = (tpls ?? []).some((x) => x.builtin && x.enabled);
  const enabledN = (tpls ?? []).filter((x) => x.enabled).length;
  const err = (e: unknown) => showToast((e as Error).message === "readonly" ? c.errReadonly : (e as Error).message === "no-pdf" ? d.noPdf : c.errSave);
  async function preview(t2: TemplateInfo, which: "pdf" | "docx") { setBusy(t2.id); try { window.open(await previewTemplate(t2.id, which), "_blank", "noopener"); } catch (e) { err(e); } finally { setBusy(null); } }
  async function download(t2: TemplateInfo) { try { await saveSigned(await templateUrl(t2.id)); } catch (e) { err(e); } }
  async function del(t2: TemplateInfo) { if (!(await confirmDialog({ text: `${tplName(t2, lang)}?`, danger: true }))) return; try { await deleteTemplate(t2.id); setTpls((v) => (v ?? []).filter((x) => x.id !== t2.id)); } catch (e) { err(e); } }
  async function setKind(t2: TemplateInfo, kind: string) { try { await updateTemplate(t2.id, { kind }); setTpls((v) => (v ?? []).map((x) => (x.id === t2.id ? { ...x, kind } : x))); } catch (e) { err(e); } }
  async function saveRename() { if (!rename) return; try { await updateTemplate(rename.id, { name: rename.name }); setTpls((v) => (v ?? []).map((x) => (x.id === rename.id ? { ...x, name: rename.name } : x))); setRename(null); } catch (e) { err(e); } }
  async function add() {
    if (!up.file) return; setBusy("upload");
    try { const fd = new FormData(); fd.set("file", up.file); fd.set("name", up.name); fd.set("kind", up.kind); const t2 = await uploadTemplate(fd); setTpls((v) => [...(v ?? []), t2]); setUp({ file: null, name: "", kind: "other" }); showToast(c.set.saved); }
    catch (e) { err(e); } finally { setBusy(null); }
  }
  const kinds = d.kinds as Record<string, string>;
  const missing = (t2: TemplateInfo) => t2.fields.filter((k) => !FIELD_MAP[k]);
  return (
    <div className={card}>
      <div className="text-[15px] font-semibold text-ink">{d.templates}</div>
      <p className="mb-3 mt-1 text-[12.5px] text-muted">{d.templatesS2} {d.enabledHint}{!crm.me.isAdmin && <> <span className="font-semibold text-text">{d.ownerOnly}</span></>}</p>
      {tpls && (
        <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
          <span className="text-[12.5px] font-semibold text-text">{d.setSummary.replace("{n}", String(enabledN)).replace("{m}", String(tpls.length))}</span>
          {tpls.some((x) => x.builtin) && <button type="button" disabled={ro || busy === "bulk"} onClick={() => bulkBuiltin(!builtinOn)} className={`${btnS} h-7 px-[10px] text-[12px]`}>{builtinOn ? d.builtinOffAll : d.builtinOnAll}</button>}
        </div>
      )}
      {!tpls ? <div className="text-[13px] text-muted">…</div> : (
        <div className="overflow-x-auto rounded-[6px] border border-line">
          <table data-crm-table="1" className="w-full min-w-[760px] text-[13px]">
            <thead><tr>{[d.tplName, d.tplKind, d.tplLang, d.tplFields, d.inSet, ""].map((h, i) => <th key={i} className="px-3 py-2 text-left text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{h}</th>)}</tr></thead>
            <tbody>
              {tpls.map((t2) => (
                <tr key={t2.id} className={`group hover:bg-[#f7f8fa] ${t2.enabled ? "" : "opacity-60"}`}>
                  <td className="px-3 py-2">
                    {rename?.id === t2.id ? <span className="flex gap-1"><input value={rename.name} onChange={(e) => setRename({ id: t2.id, name: e.target.value })} onKeyDown={(e) => { if (e.key === "Enter") saveRename(); if (e.key === "Escape") setRename(null); }} className={`${inp} h-7`} autoFocus={kbAutoFocus()} /><button type="button" onClick={saveRename} className={`${btnP} h-7 px-2`}>OK</button></span>
                      : <span className="flex items-center gap-2"><span className="font-medium text-ink">{tplName(t2, lang)}</span>{t2.builtin ? <span className={chip}>{d.builtin}</span> : <button type="button" disabled={ro} onClick={() => setRename({ id: t2.id, name: tplName(t2, lang) })} className="cursor-pointer text-muted opacity-0 hover:text-ink group-hover:opacity-100"><IconPencil size={13} /></button>}</span>}
                    {t2.builtin && (t2.for as string[]).length > 0 && <div className="text-[11.5px] text-muted">{d.forDeals}: {(t2.for as string[]).map((k) => (k === "any" ? d.anyDeal : t.deal[k as keyof typeof t.deal])).join(", ")}</div>}
                  </td>
                  <td className="px-3 py-2">{t2.builtin ? <span className="text-text">{kinds[t2.kind] ?? t2.kind}</span> : <Select value={t2.kind} onChange={(v) => setKind(t2, v)} options={KINDS.map((k) => ({ value: k, label: kinds[k] }))} size="sm" className="w-[150px]" disabled={ro} />}</td>
                  <td className="px-3 py-2 text-text">{t2.lang}</td>
                  <td className="px-3 py-2"><button type="button" onClick={() => setFieldsOf(fieldsOf === t2.id ? null : t2.id)} className="cursor-pointer text-[12.5px] font-semibold text-blue-2 hover:underline">{t2.fields.length} {d.fieldsN}</button>{missing(t2).length > 0 && <span className="ml-2 rounded-[4px] bg-[#fff8e6] px-[6px] text-[11px] font-semibold text-[#a16207]" title={missing(t2).join(", ")}>{missing(t2).length} {d.unknownFields}</span>}
                    {fieldsOf === t2.id && <div className="mt-1 flex max-w-[420px] flex-wrap gap-1">{t2.fields.map((k) => <code key={k} className={`rounded-[3px] px-1 text-[11px] ${FIELD_MAP[k] ? "bg-bg-2 text-text" : "bg-[#fff8e6] text-[#a16207]"}`} title={FIELD_MAP[k]?.label[lang]}>{k}</code>)}</div>}</td>
                  <td className="px-3 py-2"><Switch checked={t2.enabled} onChange={() => toggle(t2)} disabled={ro} size="sm" label={t2.enabled ? d.enabled : d.disabled} title={t2.enabled ? d.toggleOff : d.toggleOn} /></td>
                  <td className="px-2 py-2">
                    <span className="flex items-center justify-end gap-1">
                      <button type="button" disabled={busy === t2.id} onClick={() => preview(t2, "pdf")} title={d.previewPdf} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-bg-2 hover:text-ink disabled:opacity-40"><IconEye size={16} /></button>
                      <button type="button" onClick={() => download(t2)} title={d.downloadTpl} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-bg-2 hover:text-ink"><IconDownload size={16} /></button>
                      {!t2.builtin && <button type="button" disabled={ro} onClick={() => del(t2)} title={d.deleteTpl} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-red-tint hover:text-red"><IconTrash size={15} /></button>}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="mt-4 rounded-[6px] border border-dashed border-line p-3">
        <div className="mb-2 text-[12.5px] font-semibold text-ink">{d.uploadTpl}</div>
        <div className="grid grid-cols-[1fr_1fr_160px_auto] items-center gap-2 max-md:grid-cols-1">
          <label className={`${btnS} cursor-pointer justify-center`}><IconUpload size={14} /> {up.file ? up.file.name : d.pickDocx}<input type="file" accept=".docx" onChange={(e) => { const f = e.target.files?.[0] ?? null; setUp((v) => ({ ...v, file: f, name: v.name || (f ? f.name.replace(/\.docx$/i, "") : "") })); }} disabled={ro} className="hidden" /></label>
          <input value={up.name} onChange={(e) => setUp((v) => ({ ...v, name: e.target.value }))} placeholder={d.tplName} disabled={ro} className={inp} />
          <Select value={up.kind} onChange={(v) => setUp((x) => ({ ...x, kind: v }))} options={KINDS.map((k) => ({ value: k, label: kinds[k] }))} size="sm" disabled={ro} />
          <button type="button" disabled={ro || busy === "upload" || !up.file} onClick={add} className={btnP}><IconPlus size={14} /> {d.uploadTpl}</button>
        </div>
        <div className="mt-2 text-[11.5px] text-muted">{d.uploadHint}</div>
      </div>
      {/* справочник полей — полноценный раскрывающийся блок (16.10.2026, «низкая неудобная ссылка») */}
      <div className={`mt-4 rounded-[6px] border border-line ${showRef ? "bg-surface" : "bg-[#fafbfc]"}`}>
        <button type="button" onClick={() => setShowRef((v) => !v)} aria-expanded={showRef} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-[#f7f8fa]">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-[6px] bg-blue-tint text-blue-2"><IconCodeDots size={17} /></span>
          <span className="min-w-0 flex-1"><span className="block text-[13.5px] font-semibold text-ink">{d.fieldsRef}</span><span className="block truncate text-[12px] text-muted">{d.fieldsRefSub.replace("{n}", String(FIELDS.length)).replace("{g}", String(Object.keys(GROUP_LABELS).length))}</span></span>
          <IconChevronDown size={18} className={`flex-none text-muted transition-transform duration-150 ${showRef ? "rotate-180" : ""}`} />
        </button>
      {showRef && (
        <div className="max-h-[520px] overflow-y-auto border-t border-line p-4 text-[12.5px]">
          {(Object.keys(GROUP_LABELS) as DocGroup[]).map((g) => (
            <div key={g} className="mb-3"><div className="mb-1 font-semibold text-ink">{GROUP_LABELS[g][lang]}</div><div className="grid grid-cols-2 gap-x-4 gap-y-[2px] max-md:grid-cols-1">{FIELDS.filter((f) => f.group === g).map((f) => <div key={f.key} className="flex gap-2 truncate"><code className="text-blue-2">{"{{" + f.key + "}}"}</code><span className="truncate text-muted">{f.label[lang]}</span></div>)}</div></div>
          ))}
        </div>
      )}
      </div>
    </div>
  );
}
