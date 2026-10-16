"use client";

// Настройки CRM: этапы воронки, источники (с токеном для внешнего сайта), выгрузка CSV, журнал доступа.
import { useEffect, useState } from "react";
import { IconDownload, IconKey, IconPlus, IconTrash } from "@tabler/icons-react";
import { deleteBranch, deleteSource, exportClientsCsv, issueSourceToken, listAudit, listTeam, saveBranch, saveLostReasons, saveSource } from "@/app/crm/actions";
import { StageEditor } from "./StageEditor";
import type { Branch, CrmMember } from "@/lib/crm/types";
import { CompanySettings, TemplateSettings } from "./DocSettings";
import { confirmDialog } from "@/components/ui/confirm";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Source, SourceKind } from "@/lib/crm/types";
import Link from "next/link";
import { crmError, btnS, card, fill, fmtDT, inp, lbl, sourceName, useCrm } from "./crmUi";
import { OrgTeam } from "@/components/org/OrgTeam";


export function CrmSettings({ sub }: { sub?: string }) {
  const tab = (sub && ["pipeline", "sources", "team", "company", "templates", "data"].includes(sub) ? sub : "pipeline") as "pipeline" | "sources" | "team" | "company" | "templates" | "data";
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const ro = crm.me.access !== "full";
  const [src, setSrc] = useState<{ name: string; kind: SourceKind }>({ name: "", kind: "manual" });
  const [token, setToken] = useState<{ id: string; token: string } | null>(null);
  const [audit, setAudit] = useState<Awaited<ReturnType<typeof listAudit>> | null>(null);
  useEffect(() => { if (crm.me.isAdmin) listAudit().then(setAudit).catch(() => setAudit([])); }, [crm.me.isAdmin]);

  const err = (e: unknown) => crmError(e, c.errSave, c.errReadonly);

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

  const nav: [typeof tab, string][] = [["pipeline", c.setNav.pipeline], ["sources", c.setNav.sources], ["team", c.setNav.team], ["company", c.setNav.company], ["templates", c.setNav.templates], ["data", c.setNav.data]];
  // ---- команда и филиалы (0017) ----
  const [team, setTeam] = useState<{ members: CrmMember[]; branches: Branch[] } | null>(null);
  useEffect(() => { if (tab === "team") listTeam().then(setTeam).catch(() => setTeam({ members: [], branches: [] })); }, [tab]);
  const [nb, setNb] = useState({ name: "", city: "" });
  const [reasons, setReasons] = useState<string[]>(() => crm.me.lostReasons);
  const [newReason, setNewReason] = useState("");
  const isOwner = crm.me.role === "owner";
  const teamErr = (e: unknown) => { const m = (e as Error).message; showToast(m === "last-owner" ? c.team.lastOwner : m === "forbidden" ? c.team.forbidden : m === "readonly" ? c.errReadonly : c.errSave); };
  async function addBranch() { if (!nb.name.trim()) return; try { const branches = await saveBranch({ name: nb.name, city: nb.city, headId: null }); setTeam((v) => (v ? { ...v, branches } : v)); setNb({ name: "", city: "" }); crm.refresh(); } catch (e) { teamErr(e); } }
  async function branchHead(b: Branch, headId: string | null) { try { const branches = await saveBranch({ id: b.id, name: b.name, city: b.city ?? "", headId }); setTeam((v) => (v ? { ...v, branches } : v)); } catch (e) { teamErr(e); } }
  async function delBranch(b: Branch) { if (!(await confirmDialog({ text: `${b.name}?`, danger: true }))) return; try { const branches = await deleteBranch(b.id); setTeam((v) => (v ? { ...v, branches } : v)); crm.refresh(); } catch (e) { teamErr(e); } }
  async function saveReasons(list: string[]) { try { setReasons(await saveLostReasons(list)); crm.refresh(); } catch (e) { teamErr(e); } }
  const show = (k: typeof tab) => tab === k;
  return (
    <div data-crm-form="1" className="grid grid-cols-[200px_1fr] gap-5 max-md:grid-cols-1">
      <nav className="flex flex-col gap-[2px] self-start max-md:flex-row max-md:overflow-x-auto">
        {nav.map(([k, l]) => <Link key={k} href={`${crm.base}/settings/${k}`} className={`whitespace-nowrap rounded-[10px] px-3 py-[8px] text-[13px] font-semibold ${tab === k ? "bg-blue-tint text-sel-ink" : "text-text hover:bg-bg-3"}`}>{l}</Link>)}
      </nav>
    <div className="flex min-w-0 flex-col gap-4">
      {show("pipeline") && <div className={card}>
        <div className="text-[15px] font-semibold text-ink">{c.set.clientStagesT}</div>
        <p className="mb-3 mt-1 text-[12.5px] text-muted">{c.set.clientStagesS}</p>
        <StageEditor key={"c" + crm.cstages.map((x) => x.id).join()} scope="client" stages={crm.cstages} onSaved={crm.setCstages} />
      </div>}
      {show("pipeline") && <div className={card}>
        <div className="text-[15px] font-semibold text-ink">{c.set.stagesT}</div>
        <p className="mb-3 mt-1 text-[12.5px] text-muted">{c.set.stagesS}</p>
        <StageEditor key={"d" + crm.stages.map((x) => x.id).join()} scope="deal" stages={crm.stages} onSaved={crm.setStages} />
      </div>}

      {show("sources") && <div className={card}>
        <div className="text-[15px] font-semibold text-ink">{c.set.sourcesT}</div>
        <p className="mb-3 mt-1 text-[12.5px] text-muted">{c.set.sourcesS} <a href="/api/docs#crm-inbound" target="_blank" rel="noreferrer" className="font-semibold text-blue-2 hover:underline">{c.set.sourcesDoc}</a></p>
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

      {show("team") && <div className={card}>
        <div className="text-[15px] font-semibold text-ink">{c.team.title}</div>
        <p className="mb-3 mt-1 text-[12.5px] text-muted">{c.team.sub}</p>
        {!team ? <div className="text-[13px] text-muted">…</div> : crm.me.ws.kind === "realtor" ? <div className="text-[13px] text-muted">{c.team.solo}</div> : (
          <>
            <OrgTeam kind={crm.me.ws.kind as "agency" | "developer"} id={crm.me.ws.id} compact onChange={() => { crm.refresh(); listTeam().then(setTeam).catch(() => undefined); }} />
            <div className="mb-2 mt-5 text-[12px] font-semibold uppercase tracking-[.05em] text-muted">{c.team.branches} · {team.branches.length}</div>
            {team.branches.length === 0 && <div className="mb-2 text-[12.5px] text-muted">{c.team.noBranches}</div>}
            <div className="flex flex-col gap-1">
              {team.branches.map((b) => (
                <div key={b.id} className="grid grid-cols-[1fr_140px_190px_auto] items-center gap-2 rounded-[6px] border border-line px-3 py-[6px] max-md:grid-cols-1">
                  <span className="truncate text-[13px] font-medium text-ink">{b.name}</span>
                  <span className="truncate text-[12.5px] text-muted">{b.city ?? "—"}</span>
                  <Select value={b.headId ?? ""} onChange={(v) => branchHead(b, v || null)} placeholder={c.team.branchHead} options={[{ value: "", label: c.team.branchHead }, ...team.members.map((m) => ({ value: m.id, label: m.name }))]} size="sm" disabled={!isOwner || ro} />
                  <button type="button" disabled={!isOwner || ro} onClick={() => delBranch(b)} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-red-tint hover:text-red disabled:opacity-30"><IconTrash size={14} /></button>
                </div>
              ))}
            </div>
            {isOwner && <div className="mt-2 grid grid-cols-[1fr_140px_auto] gap-2"><input value={nb.name} onChange={(e) => setNb({ ...nb, name: e.target.value })} placeholder={c.team.branchName} disabled={ro} className={inp} /><input value={nb.city} onChange={(e) => setNb({ ...nb, city: e.target.value })} placeholder={c.team.branchCity} disabled={ro} className={inp} /><button type="button" disabled={ro || !nb.name.trim()} onClick={addBranch} className={btnS}><IconPlus size={14} /> {c.team.addBranch}</button></div>}
          </>
        )}
      </div>}

      {show("sources") && <div className={card}>
        <div className="text-[15px] font-semibold text-ink">{c.team.lostT}</div>
        <p className="mb-3 mt-1 text-[12.5px] text-muted">{c.team.lostS}</p>
        <div className="flex flex-wrap gap-[6px]">{reasons.map((r) => <span key={r} className="inline-flex h-7 items-center gap-1 rounded-full border border-line bg-bg-2 pl-3 pr-1 text-[12.5px] text-ink">{r}{isOwner && !ro && <button type="button" onClick={() => saveReasons(reasons.filter((x) => x !== r))} className="h-5 w-5 cursor-pointer rounded-full text-muted hover:text-red">×</button>}</span>)}</div>
        {isOwner && <div className="mt-2 flex gap-2"><input value={newReason} onChange={(e) => setNewReason(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && newReason.trim()) { saveReasons([...reasons, newReason]); setNewReason(""); } }} placeholder={c.team.lostAdd} disabled={ro} className={`${inp} w-[260px]`} /><button type="button" disabled={ro || !newReason.trim()} onClick={() => { saveReasons([...reasons, newReason]); setNewReason(""); }} className={btnS}><IconPlus size={14} /></button></div>}
      </div>}

      {show("company") && <CompanySettings />}

      {show("templates") && <TemplateSettings />}

      {show("data") && <div className={card}>
        <div className="text-[15px] font-semibold text-ink">{c.set.exportT}</div>
        <p className="mb-3 mt-1 text-[12.5px] text-muted">{c.set.exportS}</p>
        <button type="button" onClick={doExport} className={btnS}><IconDownload size={15} /> {c.set.export}</button>
      </div>}

      {show("data") && crm.me.isAdmin && (
        <div className={card}>
          <div className="text-[15px] font-semibold text-ink">{c.set.auditT}</div>
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
