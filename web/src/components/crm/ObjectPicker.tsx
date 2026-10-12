"use client";

// Выбор объекта для сделки / заявки (0024, 12.10.2026, решение пользователя «из базы или свободно»):
//   риэлтор  — объявления базы: «Мои» / «Избранное» / поиск по № объявления, заголовку, району (сервер, ≤30 строк);
//   застройщик — свои квартиры: проект → корпус → только свободные, поиск по номеру/типу;
//   любой    — «Другой объект»: свободный текст и ссылка (объект не из OnePlan или не хочется указывать подробно).
// Режим single (сделка: один объект) и multi (заявка покупателя: несколько подобранных вариантов).
import { useEffect, useRef, useState } from "react";
import { IconHome, IconPlus, IconSearch } from "@tabler/icons-react";
import { searchListings, searchUnits, type ListingBrief } from "@/app/crm/actions";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { Segmented } from "@/components/ui/Segmented";
import { Select } from "@/components/ui/Select";
import { useI18n } from "@/i18n/provider";
import { unitKey, type ObjRef, type UnitBrief } from "@/lib/crm/types";
import { ObjCard, type Briefs } from "./ObjCard";
import { btnP, btnS, inp, lbl, useCrm } from "./crmUi";

type Props = { mode: "single" | "multi"; value: ObjRef[]; onChange: (v: ObjRef[]) => void; briefs: Briefs; onBriefs: (add: Briefs) => void; disabled?: boolean };
/** Слить найденные краткие карточки в состояние родителя. */
export const mergeBriefs = (b: Briefs, add: Briefs): Briefs => ({ objs: { ...b.objs, ...add.objs }, units: { ...b.units, ...add.units } });
const same = (a: ObjRef, b: ObjRef) => (a.kind === "listing" && b.kind === "listing" ? a.id === b.id : a.kind === "unit" && b.kind === "unit" ? a.projectId === b.projectId && a.unitUid === b.unitUid : a.kind === "free" && b.kind === "free" ? a.text === b.text : false);

export function ObjectPicker({ mode, value, onChange, briefs, onBriefs, disabled }: Props) {
  const { t } = useI18n();
  const c = t.crm;
  const crm = useCrm();
  const dev = crm.me.ws.kind === "developer";
  const [open, setOpen] = useState(false);
  const [free, setFree] = useState<null | { text: string; url: string }>(null);
  const pick = (r: ObjRef) => {
    if (mode === "single") { onChange([r]); setOpen(false); return; }
    onChange(value.some((x) => same(x, r)) ? value.filter((x) => !same(x, r)) : [...value, r]);
  };
  const remove = (r: ObjRef) => onChange(value.filter((x) => !same(x, r)));
  const canAdd = mode === "multi" || value.length === 0;
  return (
    <div className="flex flex-col gap-2">
      {value.map((r, i) => <ObjCard key={i} r={r} briefs={briefs} compact onRemove={disabled ? undefined : () => remove(r)} />)}
      {free && (
        <div data-crm-form="1" className="grid grid-cols-[1fr_1fr_auto_auto] items-end gap-2 rounded-[6px] border border-sel-line bg-blue-tint/40 p-2 max-md:grid-cols-1">
          <div><label className={lbl}>{c.obj.freeText}</label><input autoFocus value={free.text} onChange={(e) => setFree({ ...free, text: e.target.value })} placeholder={c.obj.freePh} className={inp} /></div>
          <div><label className={lbl}>{c.obj.freeUrl}</label><input value={free.url} onChange={(e) => setFree({ ...free, url: e.target.value })} placeholder="https://…" className={inp} /></div>
          <button type="button" disabled={!free.text.trim()} onClick={() => { pick({ kind: "free", text: free.text.trim(), url: free.url.trim() || undefined }); setFree(null); }} className={btnP}>{c.ev.add}</button>
          <button type="button" onClick={() => setFree(null)} className={btnS}>{c.cancel}</button>
        </div>
      )}
      {canAdd && !free && !disabled && (
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={() => setOpen(true)} className={btnS}><IconSearch size={14} /> {dev ? c.obj.pickUnit : c.obj.pickListing}</button>
          <button type="button" onClick={() => setFree({ text: "", url: "" })} className={btnS}><IconHome size={14} /> {c.obj.other}</button>
        </div>
      )}
      {open && (dev
        ? <UnitsModal onClose={() => setOpen(false)} value={value} onPick={pick} briefs={briefs} onBriefs={onBriefs} mode={mode} />
        : <ListingsModal onClose={() => setOpen(false)} value={value} onPick={pick} briefs={briefs} onBriefs={onBriefs} mode={mode} />)}
    </div>
  );
}

type MProps = { onClose: () => void; value: ObjRef[]; onPick: (r: ObjRef) => void; briefs: Briefs; onBriefs: (add: Briefs) => void; mode: "single" | "multi" };

function ListingsModal({ onClose, value, onPick, briefs, onBriefs, mode }: MProps) {
  const { t } = useI18n();
  const c = t.crm;
  const [scope, setScope] = useState<"mine" | "favs" | "all">("mine");
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<ListingBrief[] | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    const my = ++seq.current;
    const h = setTimeout(() => { searchListings(q, scope).then((r) => { if (seq.current === my) setRows(r); }).catch(() => { if (seq.current === my) setRows([]); }); }, q ? 300 : 0);
    return () => clearTimeout(h);
  }, [q, scope]);
  const b: Briefs = { objs: { ...briefs.objs, ...Object.fromEntries((rows ?? []).map((r) => [r.id, r])) }, units: briefs.units };
  const isSel = (id: string) => value.some((x) => x.kind === "listing" && x.id === id);
  return (
    <Modal open onClose={onClose} width={760}>
      <div data-crm-form="1">
        <div className="mb-3 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{c.obj.pickListing}</div><ModalClose onClick={onClose} /></div>
        <div className="mb-1 flex flex-wrap items-center gap-2">
          <Segmented value={scope} onChange={setScope} size="sm" options={[{ value: "mine", label: c.obj.scopeMine }, { value: "favs", label: c.obj.scopeFavs }, { value: "all", label: c.obj.scopeAll }]} />
          <div className="relative min-w-[240px] flex-1"><IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.obj.searchPh} className={`${inp} pl-9`} /></div>
        </div>
        <p className="mb-3 text-[12px] text-muted">{(c.obj.scopeHint as Record<string, string>)[scope]}</p>
        <div className="flex max-h-[60vh] flex-col gap-[6px] overflow-y-auto">
          {rows === null && <div className="py-6 text-center text-[13px] text-muted">…</div>}
          {rows?.length === 0 && <div className="py-6 text-center text-[13px] text-muted">{q ? c.obj.nothing : (c.obj.empty as Record<string, string>)[scope]}</div>}
          {rows?.map((r) => <ObjCard key={r.id} r={{ kind: "listing", id: r.id }} briefs={b} selected={isSel(r.id)} onClick={() => { onBriefs({ objs: { [r.id]: r }, units: {} }); onPick({ kind: "listing", id: r.id }); }} />)}
        </div>
        {mode === "multi" && <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted"><span>{c.obj.selectedN.replace("{n}", String(value.length))}</span><button type="button" onClick={onClose} className={btnP}>{c.obj.done}</button></div>}
      </div>
    </Modal>
  );
}

function UnitsModal({ onClose, value, onPick, briefs, onBriefs, mode }: MProps) {
  const { t } = useI18n();
  const c = t.crm;
  const [projects, setProjects] = useState<{ id: number; name: string; wings: string[] }[]>([]);
  const [pid, setPid] = useState<number | null>(null);
  const [wing, setWing] = useState("");
  const [onlyFree, setOnlyFree] = useState(true);
  const [q, setQ] = useState("");
  const [rows, setRows] = useState<UnitBrief[] | null>(null);
  const seq = useRef(0);
  useEffect(() => {
    const my = ++seq.current;
    const h = setTimeout(() => { searchUnits(q, { projectId: pid, wing: wing || null, onlyFree }).then((r) => { if (seq.current !== my) return; setProjects(r.projects); setRows(r.units); }).catch(() => { if (seq.current === my) setRows([]); }); }, q ? 300 : 0);
    return () => clearTimeout(h);
  }, [q, pid, wing, onlyFree]);
  const wings = projects.find((p) => p.id === pid)?.wings ?? [];
  const b: Briefs = { objs: briefs.objs, units: { ...briefs.units, ...Object.fromEntries((rows ?? []).map((u) => [unitKey(u.projectId, u.uid), u])) } };
  const isSel = (u: UnitBrief) => value.some((x) => x.kind === "unit" && x.projectId === u.projectId && x.unitUid === u.uid);
  return (
    <Modal open onClose={onClose} width={820}>
      <div data-crm-form="1">
        <div className="mb-3 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{c.obj.pickUnit}</div><ModalClose onClick={onClose} /></div>
        <div className="mb-3 grid grid-cols-[1fr_150px_auto_1fr] items-center gap-2 max-md:grid-cols-1">
          <Select value={pid != null ? String(pid) : ""} onChange={(v) => { setPid(v ? Number(v) : null); setWing(""); }} options={[{ value: "", label: c.obj.allProjects }, ...projects.map((p) => ({ value: String(p.id), label: p.name }))]} searchable />
          <Select value={wing} onChange={setWing} options={[{ value: "", label: c.obj.allWings }, ...wings.map((w) => ({ value: w, label: `${c.obj.wing} ${w}` }))]} disabled={!wings.length} />
          <label className="flex h-9 items-center gap-2 whitespace-nowrap text-[13px] text-text"><input type="checkbox" checked={onlyFree} onChange={(e) => setOnlyFree(e.target.checked)} /> {c.obj.onlyFree}</label>
          <div className="relative"><IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={c.obj.unitSearchPh} className={`${inp} pl-9`} /></div>
        </div>
        <div className="flex max-h-[60vh] flex-col gap-[6px] overflow-y-auto">
          {rows === null && <div className="py-6 text-center text-[13px] text-muted">…</div>}
          {rows?.length === 0 && <div className="py-6 text-center text-[13px] text-muted">{c.obj.nothing}</div>}
          {rows?.map((u) => <ObjCard key={unitKey(u.projectId, u.uid)} r={{ kind: "unit", projectId: u.projectId, unitUid: u.uid }} briefs={b} selected={isSel(u)} onClick={() => { onBriefs({ objs: {}, units: { [unitKey(u.projectId, u.uid)]: u } }); onPick({ kind: "unit", projectId: u.projectId, unitUid: u.uid }); }} />)}
        </div>
        {mode === "multi" && <div className="mt-3 flex items-center justify-between text-[12.5px] text-muted"><span>{c.obj.selectedN.replace("{n}", String(value.length))}</span><button type="button" onClick={onClose} className={btnP}><IconPlus size={14} /> {c.obj.done}</button></div>}
      </div>
    </Modal>
  );
}
