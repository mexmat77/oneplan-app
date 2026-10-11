"use client";

// Настройки CRM: этапы воронки, источники (с токеном для внешнего сайта), выгрузка CSV, журнал доступа.
import { useEffect, useState } from "react";
import { IconChevronDown, IconChevronUp, IconDownload, IconKey, IconPlus, IconTrash } from "@tabler/icons-react";
import { deleteBranch, deleteSource, exportClientsCsv, issueSourceToken, listAudit, listTeam, saveBranch, saveLostReasons, saveSource, saveStages, setMember } from "@/app/crm/actions";
import type { Branch, CrmMember, MemberRole } from "@/lib/crm/types";
import { CompanySettings, TemplateSettings } from "./DocSettings";
import { confirmDialog } from "@/components/ui/confirm";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Source, SourceKind, Stage, StageKind } from "@/lib/crm/types";
import Link from "next/link";
import { btnP, btnS, card, fill, fmtDT, inp, lbl, sourceName, stageName, useCrm } from "./crmUi";

type StRow = { id?: string; key: string; name: Record<string, string>; kind: StageKind; color: string | null };
// палитра этапов (как в Pipedrive/HubSpot) + произвольный цвет через системный выбор (замечание пользователя 11.10.2026)
const COLORS = ["#8a93a2", "#4d7cfe", "#2563eb", "#0ea5a4", "#14b8a6", "#22c15e", "#84cc16", "#f5a623", "#f97316", "#e5484d", "#dc2626", "#e06aa3", "#d946ef", "#7b4fd0", "#6366f1", "#475569"];

export function CrmSettings({ sub }: { sub?: string }) {
  const tab = (sub && ["pipeline", "sources", "team", "company", "templates", "data"].includes(sub) ? sub : "pipeline") as "pipeline" | "sources" | "team" | "company" | "templates" | "data";
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

  const err = (e: unknown) => showToast((e as Error).message === "readonly" ? c.errReadonly : c.errSave);

  const setRow = (i: number, p: Partial<StRow>) => setSt((v) => v.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const [colorFor, setColorFor] = useState<number | null>(null);
  // порядок этапов = порядок строк (sort при сохранении); стрелки вверх/вниз
  const move = (i: number, d: -1 | 1) => setSt((v) => { const j = i + d; if (j < 0 || j >= v.length) return v; const n = [...v]; [n[i], n[j]] = [n[j], n[i]]; return n; });
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

  const nav: [typeof tab, string][] = [["pipeline", c.setNav.pipeline], ["sources", c.setNav.sources], ["team", c.setNav.team], ["company", c.setNav.company], ["templates", c.setNav.templates], ["data", c.setNav.data]];
  // ---- команда и филиалы (0017) ----
  const [team, setTeam] = useState<{ members: CrmMember[]; branches: Branch[] } | null>(null);
  useEffect(() => { if (tab === "team") listTeam().then(setTeam).catch(() => setTeam({ members: [], branches: [] })); }, [tab]);
  const [nb, setNb] = useState({ name: "", city: "" });
  const [reasons, setReasons] = useState<string[]>(() => crm.me.lostReasons);
  const [newReason, setNewReason] = useState("");
  const isOwner = crm.me.role === "owner";
  const teamErr = (e: unknown) => { const m = (e as Error).message; showToast(m === "last-owner" ? c.team.lastOwner : m === "forbidden" ? c.team.forbidden : m === "readonly" ? c.errReadonly : c.errSave); };
  async function member(id: string, patch: { role?: MemberRole; branchId?: string | null }) {
    const m = team?.members.find((x) => x.id === id); if (!m) return;
    try { await setMember(id, patch.role ?? m.role, patch.branchId === undefined ? m.branchId : patch.branchId); setTeam(await listTeam()); } catch (e) { teamErr(e); }
  }
  async function addBranch() { if (!nb.name.trim()) return; try { const branches = await saveBranch({ name: nb.name, city: nb.city, headId: null }); setTeam((v) => (v ? { ...v, branches } : v)); setNb({ name: "", city: "" }); crm.refresh(); } catch (e) { teamErr(e); } }
  async function branchHead(b: Branch, headId: string | null) { try { const branches = await saveBranch({ id: b.id, name: b.name, city: b.city ?? "", headId }); setTeam((v) => (v ? { ...v, branches } : v)); } catch (e) { teamErr(e); } }
  async function delBranch(b: Branch) { if (!(await confirmDialog({ text: `${b.name}?`, danger: true }))) return; try { const branches = await deleteBranch(b.id); setTeam((v) => (v ? { ...v, branches } : v)); crm.refresh(); } catch (e) { teamErr(e); } }
  async function saveReasons(list: string[]) { try { setReasons(await saveLostReasons(list)); crm.refresh(); } catch (e) { teamErr(e); } }
  const show = (k: typeof tab) => tab === k;
  return (
    <div className="grid grid-cols-[200px_1fr] gap-5 max-md:grid-cols-1">
      <nav className="flex flex-col gap-[2px] self-start max-md:flex-row max-md:overflow-x-auto">
        {nav.map(([k, l]) => <Link key={k} href={`${crm.base}/settings/${k}`} className={`whitespace-nowrap rounded-[10px] px-3 py-[8px] text-[13px] font-semibold ${tab === k ? "bg-blue-tint text-sel-ink" : "text-text hover:bg-bg-3"}`}>{l}</Link>)}
      </nav>
    <div className="flex min-w-0 flex-col gap-4">
      {show("pipeline") && <div className={card}>
        <div className="text-[15px] font-semibold text-ink">{c.set.stagesT}</div>
        <p className="mb-3 mt-1 text-[12.5px] text-muted">{c.set.stagesS}</p>
        <div className="flex flex-col gap-2">
          {st.map((s, i) => (
            <div key={s.id ?? i} className="grid grid-cols-[28px_minmax(160px,1fr)_130px_auto] items-center gap-2">
              <button type="button" disabled={ro} onClick={() => setColorFor(colorFor === i ? null : i)} title={c.set.color} className="h-6 w-6 cursor-pointer rounded-full border-2 border-surface shadow" style={{ background: s.color ?? "#8a93a2" }} />
              <input value={s.name[lang] ?? ""} onChange={(e) => setRow(i, { name: { ...s.name, [lang]: e.target.value } })} placeholder={stageName({ ...s, id: s.id ?? "", sort: i } as Stage, t, lang)} disabled={ro} className={inp} />
              <Select value={s.kind} onChange={(v) => setRow(i, { kind: v as StageKind })} options={[["open", c.set.kindOpen], ["won", c.set.kindWon], ["lost", c.set.kindLost]].map(([v, l]) => ({ value: v, label: l }))} size="sm" disabled={ro} />
              <span className="flex items-center">
                <button type="button" disabled={ro || i === 0} onClick={() => move(i, -1)} title={c.set.up} className="flex h-8 w-7 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-bg-3 hover:text-ink disabled:opacity-30"><IconChevronUp size={15} /></button>
                <button type="button" disabled={ro || i === st.length - 1} onClick={() => move(i, 1)} title={c.set.down} className="flex h-8 w-7 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-bg-3 hover:text-ink disabled:opacity-30"><IconChevronDown size={15} /></button>
                <button type="button" disabled={ro || st.length <= 2} onClick={() => setSt((v) => v.filter((_, j) => j !== i))} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[6px] text-muted hover:bg-red-tint hover:text-red disabled:opacity-30"><IconTrash size={15} /></button>
              </span>
              {colorFor === i && (
                <div className="col-span-4 -mt-1 mb-1 flex flex-wrap items-center gap-[6px] rounded-[6px] border border-line bg-[#fafbfc] px-3 py-2">
                  {COLORS.map((col) => <button key={col} type="button" onClick={() => { setRow(i, { color: col }); setColorFor(null); }} className={`h-6 w-6 cursor-pointer rounded-full border-2 ${s.color === col ? "border-ink" : "border-surface"} shadow`} style={{ background: col }} />)}
                  <label className="ml-2 inline-flex cursor-pointer items-center gap-2 text-[12.5px] text-text"><span className="h-6 w-6 rounded-full border border-line" style={{ background: "conic-gradient(red, yellow, lime, cyan, blue, magenta, red)" }} />{c.set.customColor}<input type="color" value={s.color ?? "#8a93a2"} onChange={(e) => setRow(i, { color: e.target.value })} className="h-0 w-0 opacity-0" /></label>
                </div>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 flex gap-2">
          <button type="button" disabled={ro} onClick={() => setSt((v) => [...v, { key: `s${Date.now()}`, name: {}, kind: "open", color: COLORS[v.length % COLORS.length] }])} className={btnS}><IconPlus size={14} /> {c.set.addStage}</button>
          <button type="button" disabled={ro || busy} onClick={saveSt} className={btnP}>{c.set.save}</button>
        </div>
      </div>}

      {show("sources") && <div className={card}>
        <div className="text-[15px] font-semibold text-ink">{c.set.sourcesT}</div>
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

      {show("team") && <div className={card}>
        <div className="text-[15px] font-semibold text-ink">{c.team.title}</div>
        <p className="mb-3 mt-1 text-[12.5px] text-muted">{c.team.sub}</p>
        {!team ? <div className="text-[13px] text-muted">…</div> : crm.me.ws.kind === "realtor" ? <div className="text-[13px] text-muted">{c.team.solo}</div> : (
          <>
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-[.05em] text-muted">{c.team.members} · {team.members.length}</div>
            <div className="flex flex-col gap-1">
              {team.members.map((m) => (
                <div key={m.id} className="grid grid-cols-[1fr_190px_190px] items-center gap-2 rounded-[6px] border border-line px-3 py-[6px] max-md:grid-cols-1">
                  <span className="flex min-w-0 items-center gap-2"><span className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-[10px] font-bold text-white" style={{ background: m.color }}>{m.name.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2)}</span><span className="truncate text-[13px] font-medium text-ink">{m.name}{m.id === crm.me.meId ? <span className="ml-1 text-[11px] font-normal text-muted">· {c.team.you}</span> : null}</span></span>
                  <Select value={m.role} onChange={(v) => member(m.id, { role: v as MemberRole })} options={(["owner", "manager", "agent"] as MemberRole[]).map((r) => ({ value: r, label: c.team.roles[r] }))} size="sm" disabled={!isOwner || ro} />
                  <Select value={m.branchId ?? ""} onChange={(v) => member(m.id, { branchId: v || null })} options={[{ value: "", label: c.client.noBranch }, ...team.branches.map((b) => ({ value: b.id, label: b.name }))]} size="sm" disabled={!isOwner || ro || team.branches.length === 0} />
                </div>
              ))}
            </div>
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
