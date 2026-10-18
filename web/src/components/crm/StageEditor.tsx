"use client";

// Редактор этапов воронки (сделки или клиента, 0018): имя на текущем языке (остальные переводятся при сохранении),
// вид (в работе / успех / отказ), цвет из палитры или свой, порядок стрелками.
import { useState } from "react";
import { IconChevronDown, IconChevronUp, IconPlus, IconTrash } from "@tabler/icons-react";
import { saveStages } from "@/app/crm/actions";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Stage, StageKind, StageScope } from "@/lib/crm/types";
import { crmError, btnP, btnS, inp, stageName, useCrm } from "./crmUi";

type StRow = { id?: string; key: string; name: Record<string, string>; kind: StageKind; color: string | null };
const COLORS = ["#8a93a2", "#4d7cfe", "#2563eb", "#0ea5a4", "#14b8a6", "#22c15e", "#84cc16", "#f5a623", "#f97316", "#e5484d", "#dc2626", "#e06aa3", "#d946ef", "#7b4fd0", "#6366f1", "#475569"];

export function StageEditor({ scope, stages, onSaved }: { scope: StageScope; stages: Stage[]; onSaved: (s: Stage[]) => void }) {
  const { t, lang } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const ro = crm.me.access !== "full";
  const [st, setSt] = useState<StRow[]>(() => stages.map((s) => ({ id: s.id, key: s.key, name: s.name, kind: s.kind, color: s.color })));
  const [busy, setBusy] = useState(false);
  const [colorFor, setColorFor] = useState<number | null>(null);
  const setRow = (i: number, p: Partial<StRow>) => setSt((v) => v.map((x, j) => (j === i ? { ...x, ...p } : x)));
  const move = (i: number, d: -1 | 1) => setSt((v) => { const j = i + d; if (j < 0 || j >= v.length) return v; const n = [...v]; [n[i], n[j]] = [n[j], n[i]]; return n; });
  async function save() {
    setBusy(true);
    try { const out = await saveStages(st, scope); onSaved(out); setSt(out.map((s) => ({ id: s.id, key: s.key, name: s.name, kind: s.kind, color: s.color }))); showToast(c.set.saved); }
    catch (e) { crmError(e, c.errSave, c.errReadonly); } finally { setBusy(false); }
  }
  return (
    <>
      <div className="flex flex-col gap-2">
        {st.map((s, i) => (
          <div key={s.id ?? i} className="grid grid-cols-[28px_minmax(160px,1fr)_130px_auto] items-center gap-2 max-md:grid-cols-[22px_minmax(0,1fr)_104px_auto] max-md:gap-1">
            <button type="button" disabled={ro} onClick={() => setColorFor(colorFor === i ? null : i)} title={c.set.color} className="h-6 w-6 cursor-pointer rounded-full border-2 border-surface shadow" style={{ background: s.color ?? "#8a93a2" }} />
            <input value={s.name[lang] ?? ""} onChange={(e) => setRow(i, { name: { ...s.name, [lang]: e.target.value } })} placeholder={stageName({ ...s, id: s.id ?? "", sort: i, scope } as Stage, t, lang)} disabled={ro} className={inp} />
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
        <button type="button" disabled={ro} onClick={() => setSt((v) => [...v, { key: `s${Date.now()}`, name: {}, kind: "open", color: COLORS[v.length % COLORS.length] }])} className={btnS}><IconPlus size={14} /> {scope === "client" ? c.set.addStatus : c.set.addStage}</button>
        <button type="button" disabled={ro || busy} onClick={save} className={btnP}>{c.set.save}</button>
      </div>
    </>
  );
}
