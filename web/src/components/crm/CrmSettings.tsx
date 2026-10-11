"use client";

// Настройки CRM: этапы воронки, источники (с токеном для внешнего сайта), выгрузка CSV, журнал доступа.
import { useEffect, useState } from "react";
import { IconDownload, IconKey, IconPlus, IconTrash } from "@tabler/icons-react";
import { deleteSource, exportClientsCsv, issueSourceToken, listAudit, saveSource, saveStages } from "@/app/crm/actions";
import { deleteTemplate, getCompany, listTemplates, saveCompany, uploadTemplate, type Company, type TemplateInfo } from "@/app/crm/doc-actions";
import { FIELDS, GROUP_LABELS, type DocGroup } from "@/lib/crm/docFields";
import { confirmDialog } from "@/components/ui/confirm";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Source, SourceKind, Stage, StageKind } from "@/lib/crm/types";
import Link from "next/link";
import { btnP, btnS, card, fill, fmtDT, inp, lbl, sourceName, stageName, useCrm } from "./crmUi";

type StRow = { id?: string; key: string; name: Record<string, string>; kind: StageKind; color: string | null };
const COLORS = ["#8a93a2", "#4d7cfe", "#f5a623", "#7b4fd0", "#0ea5a4", "#22c15e", "#e5484d", "#e06aa3"];

export function CrmSettings({ sub }: { sub?: string }) {
  const tab = (sub && ["pipeline", "sources", "company", "templates", "data"].includes(sub) ? sub : "pipeline") as "pipeline" | "sources" | "company" | "templates" | "data";
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const ro = crm.me.access !== "full";
  const [st, setSt] = useState<StRow[]>(() => crm.stages.map((s) => ({ id: s.id, key: s.key, name: s.name, kind: s.kind, color: s.color })));
  const [busy, setBusy] = useState(false);
  const [src, setSrc] = useState<{ name: string; kind: SourceKind }>({ name: "", kind: "manual" });
  const [token, setToken] = useState<{ id: string; token: string } | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof listAudit>> | null>(null);
  useEffect(() => { if (crm.me.isAdmin) listAudit().then(setAudit).catch(() => setAudit([])); }, [crm.me.isAdmin]);
  const [company, setCompany] = useState<Company | null>(null);
  const [tpls, setTpls] = useState<TemplateInfo[] | null>(null);
  const [tplFile, setTplFile] = useState<File | null>(null);
  const [tplName, setTplName] = useState("");
  const [tplKind, setTplKind] = useState("other");
  const [showFields, setShowFields] = useState(false);
  useEffect(() => { getCompany().then(setCompany).catch(() => setCompany({})); listTemplates().then(setTpls).catch(() => setTpls([])); }, []);
  const d = c.docs;
  async function saveCo() { if (!company) return; setBusy(true); try { await saveCompany(company); showToast(c.set.saved); } catch (e) { err(e); } finally { setBusy(false); } }
  async function addTpl() {
    if (!tplFile) return; setBusy(true);
    try { const fd = new FormData(); fd.set("file", tplFile); fd.set("name", tplName); fd.set("kind", tplKind); const t2 = await uploadTemplate(fd); setTpls((v) => [...(v ?? []), t2]); setTplFile(null); setTplName(""); showToast(c.set.saved); }
    catch (e) { err(e); } finally { setBusy(false); }
  }
  async function delTpl(t2: TemplateInfo) { if (!(await confirmDialog({ text: `${typeof t2.name === "string" ? t2.name : t2.name[lang]}?`, danger: true }))) return; try { await deleteTemplate(t2.id); setTpls((v) => (v ?? []).filter((x) => x.id !== t2.id)); } catch (e) { err(e); } }
  const err = (e: unknown) => showToast((e as Error).message === "readonly" ? c.errReadonly : c.errSave);

  const setRow = (i: number, p: Partial<StRow>) => setSt((v) => v.map((x, j) => (j === i ? { ...x, ...p } : x)));
  async function saveSt() {
    setBusy(true);
    try { const out = await saveStages(st); crm.setStages(out); setSt(out.map((s) => ({ id: s.id, key: s.key, name: s.name, kind: s.kind, color: s.color }))); showToast(c.set.saved); } catch (e) { err(e); } finally { setBusy(false); }
  }
  async function addSrc() {
    if (!src.name.trim()) return;
    try { crm.setSources(await saveSource({ name: src.name, kind: src.kind, active: true })); setSrc({ name: "", kind: "manual" }); } catch (e) { err(e); }
  }
  async function toggleSrc(s: Source) { try { crm.setSources(await saveSource({ id: s.id, name: s.name, kind: s.kind, active: !s.active })); } catch (e) { err(e); } }
  async function delSrc(s: Source) { if (!(await confirmDialog({ text: `${sourceName(s, t)}?`, danger: true }))) return; try { crm.setSources(await deleteSource(s.id)); } catch (e) { err(e); } }
  async function newToken(s: Source) { try { const tk = await issueSourceToken(s.id); setToken({ id: s.id, token: tk }); crm.setSources(crm.sources.map((x) => (x.id === s.id ? { ...x, hasToken: true } : x))); } catch (e) { err(e); } }
  async function doExport() {
    try {
      const csv = await exportClientsCsv();
      const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })); a.download = `oneplan-crm-${new Date().toISOString().slice(0, 10)}.csv`; a.click();
    } catch (e) { err(e); }
  }
  const inboundUrl = typeof window !== "undefined" ? `${window.location.origin}/api/crm/inbound` : "/api/crm/inbound";
  const auditLabel = (a: string, meta: Record<string, unknown>) => fill((c.audit as Record<string, string>)[a] ?? a, { n: String(meta.n ?? "") });

  const nav: [typeof tab, string][] = [["pipeline", c.setNav.pipeline], ["sources", c.setNav.sources], ["company", c.setNav.company], ["templates", c.setNav.templates], ["data", c.setNav.data]];
  const show = (k: typeof tab) => tab === k;
  return (
    <div className="grid grid-cols-[200px_1fr] gap-5 max-md:grid-cols-1">
      <nav className="flex flex-col gap-[2px] self-start max-md:flex-row max-md:overflow-x-auto">
        {nav.map(([k, l]) => <Link key={k} href={`${crm.base}/settings/${k}`} className={`whitespace-nowrap rounded-[10px] px-3 py-[8px] text-[13px] font-semibold ${tab === k ? "bg-blue-tint text-sel-ink" : "text-text hover:bg-bg-3"}`}>{l}</Link>)}
      </nav>
    <div className="flex min-w-0 flex-col gap-4">
      {show("pipeline") && <div className={card}>
        <div className="text-[15px] font-extrabold text-ink">{c.set.stagesT}</div>
        <p className="mb-3 mt-1 text-[12.5px] text-muted">{c.set.stagesS}</p>
        <div className="flex flex-col gap-2">
          {st.map((s, i) => (
            <div key={s.id ?? i} className="grid grid-cols-[28px_minmax(160px,1fr)_130px_auto] items-center gap-2">
              <button type="button" disabled={ro} onClick={() => setRow(i, { color: COLORS[(COLORS.indexOf(s.color ?? "") + 1) % COLORS.length] })} className="h-6 w-6 cursor-pointer rounded-full border-2 border-surface shadow" style={{ background: s.color ?? "#8a93a2" }} />
              <input value={s.name[lang] ?? ""} onChange={(e) => setRow(i, { name: { ...s.name, [lang]: e.target.value } })} placeholder={stageName({ ...s, id: s.id ?? "", sort: i } as Stage, t, lang)} disabled={ro} className={inp} />
              <Select value={s.kind} onChange={(v) => setRow(i, { kind: v as StageKind })} options={[["open", c.set.kindOpen], ["won", c.set.kindWon], ["lost", c.set.kindLost]].map(([v, l]) => ({ value: v, label: l }))} size="sm" disabled={ro} />
              <button type="button" disabled={ro || st.length <= 2} onClick={() => setSt((v) => v.filter((_, j) => j !== i))} className="flex h-9 w-9 cursor-pointer items-center justify-center rounded-[9px] text-muted hover:bg-red-tint hover:text-red disabled:opacity-30"><IconTrash size={15} /></button>
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={ro} onClick={() => setSt((v) => [...v, { key: `s${Date.now()}`, name: {}, kind: "open", color: COLORS[v.length % COLORS.length] }])} className={btnS}><IconPlus size={14} /> {c.set.addStage}</button>
          <button type="button" disabled={ro || busy} onClick={saveSt} className={btnP}>{c.set.save}</button>
        </div>
      </div>}

      {show("sources") && <div className={card}>
        <div className="text-[15px] font-extrabold text-ink">{c.set.sourcesT}</div>
        <p className="mb-3 mt-1 text-[12.5px] text-muted">{c.set.sourcesS}</p>
        <div className="flex flex-col gap-2">
          {crm.sources.map((s) => (
            <div key={s.id} className="rounded-[12px] border border-line p-2">
              <div className="flex items-center gap-2">
                <label className="flex items-center gap-2"><input type="checkbox" checked={s.active} onChange={() => toggleSrc(s)} disabled={ro} /></label>
                <span className={`flex-1 text-[13.5px] font-semibold ${s.active ? "text-ink" : "text-muted line-through"}`}>{sourceName(s, t)} <span className="text-[11.5px] font-normal text-muted">· {c.srcKinds[s.kind]}</span></span>
                {s.kind === "site" && <button type="button" disabled={ro} onClick={() => newToken(s)} title={c.set.token} className={`${btnS} px-3 py-[6px] text-[12px]`}><IconKey size={13} /> {s.hasToken ? c.set.tokenHave : c.set.tokenNew}</button>}
                <button type="button" disabled={ro} onClick={() => delSrc(s)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[9px] text-muted hover:bg-red-tint hover:text-red"><IconTrash size={14} /></button>
              </div>
              {token?.id === s.id && <div className="mt-2 rounded-[10px] bg-bg-2 p-3 text-[12.5px]"><div className="mb-1 font-bold text-ink">{c.set.tokenShow}</div><code className="block break-all rounded bg-surface px-2 py-1 text-[12px]">{token.token}</code><div className="mt-2 text-muted">{fill(c.set.tokenHow, { url: inboundUrl })}</div></div>}
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-[1fr_140px_auto] gap-2">
          <input value={src.name} onChange={(e) => setSrc({ ...src, name: e.target.value })} placeholder={c.set.srcName} disabled={ro} className={inp} />
          <Select value={src.kind} onChange={(v) => setSrc({ ...src, kind: v as SourceKind })} options={(Object.keys(c.srcKinds) as SourceKind[]).map((k) => ({ value: k, label: c.srcKinds[k] }))} size="sm" disabled={ro} />
          <button type="button" disabled={ro} onClick={addSrc} className={btnS}><IconPlus size={14} /></button>
        </div>
      </div>}

      {show("company") && <div className={card}>
        <div className="text-[15px] font-extrabold text-ink">{d.company}</div>
        <p className="mb-3 mt-1 text-[12.5px] text-muted">{d.companyS}</p>
        {!company ? <div className="text-[13px] text-muted">…</div> : (
          <div className="grid grid-cols-2 gap-2 max-md:grid-cols-1">
            {(Object.keys(d.companyFields) as (keyof typeof d.companyFields)[]).map((k) => (
              <div key={k} className={k === "address" ? "col-span-2 max-md:col-span-1" : ""}><label className="mb-[3px] block text-[11.5px] font-semibold text-muted">{d.companyFields[k]}</label><input value={company[k] ?? ""} onChange={(e) => setCompany({ ...company, [k]: e.target.value })} disabled={ro} className={`${inp} py-2 text-[13px]`} /></div>
            ))}
          </div>
        )}
        <div className="mt-3"><button type="button" disabled={ro || busy || !company} onClick={saveCo} className={btnP}>{c.set.save}</button></div>
      </div>}

      {show("templates") && <div className={card}>
        <div className="text-[15px] font-extrabold text-ink">{d.templates}</div>
        <p className="mb-3 mt-1 text-[12.5px] text-muted">{d.templatesS}</p>
        <div className="flex flex-col gap-1">
          {(tpls ?? []).map((t2) => (
            <div key={t2.id} className="flex items-center gap-2 rounded-[10px] bg-bg-2 px-3 py-2 text-[12.5px]">
              <span className="min-w-0 flex-1 truncate font-semibold text-ink">{typeof t2.name === "string" ? t2.name : t2.name[lang]} <span className="font-normal text-muted">· {(d.kinds as Record<string, string>)[t2.kind] ?? t2.kind} · {t2.lang}{t2.builtin ? ` · ${d.builtin}` : ""}</span></span>
              {!t2.builtin && <button type="button" disabled={ro} onClick={() => delTpl(t2)} title={d.deleteTpl} className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-[7px] text-muted hover:bg-red-tint hover:text-red"><IconTrash size={14} /></button>}
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-[1fr_1fr] gap-2 max-md:grid-cols-1">
          <input type="file" accept=".docx" onChange={(e) => { const f = e.target.files?.[0] ?? null; setTplFile(f); if (f && !tplName) setTplName(f.name.replace(/\.docx$/i, "")); }} disabled={ro} className="block w-full text-[12.5px]" />
          <input value={tplName} onChange={(e) => setTplName(e.target.value)} placeholder={d.tplName} disabled={ro} className={`${inp} py-2 text-[13px]`} />
          <Select value={tplKind} onChange={setTplKind} options={["sale", "rent", "deposit", "viewing", "handover", "consent", "other"].map((k) => ({ value: k, label: (d.kinds as Record<string, string>)[k] }))} size="sm" disabled={ro} />
          <button type="button" disabled={ro || busy || !tplFile} onClick={addTpl} className={btnS}><IconPlus size={14} /> {d.uploadTpl}</button>
        </div>
        <button type="button" onClick={() => setShowFields((v) => !v)} className="mt-3 cursor-pointer text-[12.5px] font-bold text-blue-2 hover:underline">{d.fieldsRef} {showFields ? "▴" : "▾"}</button>
        {showFields && (
          <div className="mt-2 max-h-[260px] overflow-y-auto rounded-[10px] bg-bg-2 p-3 text-[12px]">
            {(Object.keys(GROUP_LABELS) as DocGroup[]).map((g) => (
              <div key={g} className="mb-2"><div className="font-extrabold text-ink">{GROUP_LABELS[g][lang]}</div>{FIELDS.filter((f) => f.group === g).map((f) => <div key={f.key} className="flex gap-2"><code className="text-blue-2">{"{{" + f.key + "}}"}</code><span className="text-muted">{f.label[lang]}</span></div>)}</div>
            ))}
          </div>
        )}
      </div>}

      {show("data") && <div className={card}>
        <div className="text-[15px] font-extrabold text-ink">{c.set.exportT}</div>
        <p className="mb-3 mt-1 text-[12.5px] text-muted">{c.set.exportS}</p>
        <button type="button" onClick={doExport} className={btnS}><IconDownload size={15} /> {c.set.export}</button>
      </div>}

      {show("data") && crm.me.isAdmin && (
        <div className={card}>
          <div className="text-[15px] font-extrabold text-ink">{c.set.auditT}</div>
          <p className="mb-3 mt-1 text-[12.5px] text-muted">{c.set.auditS}</p>
          {!audit ? <div className="text-[13px] text-muted">…</div> : audit.length === 0 ? <div className="text-[13px] text-muted">{c.set.noAudit}</div> : (
            <div className="max-h-[320px] overflow-y-auto">
              {audit.map((a) => <div key={a.id} className="flex gap-3 border-t border-line py-2 text-[12.5px] first:border-t-0"><span className="w-[110px] flex-none text-muted">{fmtDT(a.createdAt, lang)}</span><span className="w-[120px] flex-none truncate text-text">{crm.me.members.find((m) => m.id === a.actorId)?.name ?? "—"}</span><span className="text-ink">{auditLabel(a.action, a.meta)}</span></div>)}
            </div>
          )}
          <label className={`${lbl} mt-3`}>{/* keep token keys referenced for lint */}</label>
        </div>
      )}
    </div>
    </div>
  );
}
