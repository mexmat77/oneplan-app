"use client";

// Мастер «Создать планировки» (§5.6; разметка 1645–1709, данные 2615–2685, 4108–4135).
//   <MkModal objId={id} open={mkOpen} onClose={…} onCreated={(editAfter, newIds) => …} />
// Табы «Вставить из прайса» (`mkParse`) / «Сгенерировать сетку» (`mkGen`), вид (Квартиры/Коммерция/Виллы), корпус
// (default `nextBlockWing`), режим Добавить/Заменить. `mkCreate` → `mkApply` пишет юниты и флаги объекта в стор,
// затем `onCreated(editAfter, newIds)` — страница переключает схему на шахматку, сбрасывает фильтры и скроллит к новым плиткам.
import { IconAlertTriangle, IconBuildingCommunity, IconBuildingStore, IconCheck, IconCircleCheck, IconCirclePlus, IconClipboardText, IconHome, IconLayoutGridAdd, IconWand, IconX } from "@tabler/icons-react";
import { useMemo, useState } from "react";
import { fLbl, nf } from "@/lib/dev/data";
import { gRenum, mkApply, mkGen, mkParse, nextBlockWing, type MkKind } from "@/lib/dev/grid";
import { useEscape, useScrollLock } from "@/hooks/useScrollLock";
import { useDevT } from "@/i18n/dev";
import { mutUnits, updateProject } from "@/store/dev";
import { useIsMobile, useObj } from "./shared";

export type MkModalProps = { objId: number; open: boolean; onClose: () => void; onCreated?: (editAfter: boolean, newIds: number[]) => void };

export function MkModal(p: MkModalProps) {
  if (!p.open) return null;
  return <Inner {...p} />;
}

const inp = "rounded-[10px] border border-line bg-[#fbfcfe] px-3 py-[10px] text-[14px] outline-none";
const lbl = "mb-[5px] block text-[12px] text-text-2";
const th = "bg-[#fafbfd] px-3 py-2 text-left font-semibold text-text-2";
const td = "border-t border-[#eef0f4] px-3 py-[7px]";

function Inner({ objId, onClose, onCreated }: MkModalProps) {
  const { t } = useDevT();
  const mob = useIsMobile();
  const { obj, units } = useObj(objId);
  const [mode, setMode] = useState<"paste" | "gen">("paste");
  const [kind, setKind] = useState<MkKind>(obj?.villas ? "villa" : "apt");
  const [wing, setWing] = useState(() => (obj?.villas ? "" : nextBlockWing(units)));
  const [replace, setReplace] = useState(false);
  const [text, setText] = useState("");
  const [mkF, setMkF] = useState<string | number>(8);
  const [mkP, setMkP] = useState<string | number>(6);
  const [mkPF, setMkPF] = useState<Record<number, string | number>>({});
  const [mkVN, setMkVN] = useState<string | number>(8);
  useScrollLock(true);
  useEscape(true, onClose);
  const parsed = useMemo(() => (mode === "paste" ? mkParse(text) : []), [mode, text]);
  const genList = useMemo(() => (mode === "gen" ? mkGen({ kind, floors: mkF, per: mkP, perFloor: mkPF, villas: mkVN }) : []), [mode, kind, mkF, mkP, mkPF, mkVN]);
  const genCount = mode === "gen" ? genList.length : 1;
  const can = mode === "paste" ? parsed.length > 0 : genCount > 0;
  const F = Math.max(1, Math.min(40, +mkF || 1));
  const floorRows = mode === "gen" ? Array.from({ length: F }, (_, k) => F - 1 - k) : [];
  const create = () => {
    if (!can || !obj) return;
    const editAfter = mode === "gen";
    const r = mkApply(units, obj, mode === "paste" ? parsed : genList, kind, wing, replace, editAfter);
    if (!r) return;
    mutUnits(objId, () => gRenum(r.units, { genGrid: !!(r.patch.genGrid ?? obj.genGrid), starts: obj.numStart }));
    updateProject(objId, r.patch);
    onClose();
    onCreated?.(editAfter, r.newIds);
  };
  const kinds: [MkKind, React.ReactNode, string][] = [["apt", <IconBuildingCommunity key="a" size={15} />, t.mk.kind_apt], ["com", <IconBuildingStore key="c" size={15} />, t.mk.kind_com], ["villa", <IconHome key="v" size={15} />, t.mk.kind_villa]];
  return (
    <div onClick={onClose} className={`fixed inset-0 z-[110] flex justify-center ${mob ? "items-end" : "items-center p-[18px]"}`} style={{ background: "rgba(8,14,26,.62)", backdropFilter: mob ? undefined : "blur(5px)", animation: "opl-bg .2s ease" }}>
      <div onClick={(e) => e.stopPropagation()} className={`flex flex-col overflow-hidden bg-surface ${mob ? "w-full rounded-t-[18px] shadow-[0_-12px_40px_rgba(0,0,0,.35)]" : "w-[720px] max-w-[96vw] rounded-[20px] shadow-[0_30px_90px_rgba(0,0,0,.45)]"}`} style={{ animation: "opl-card .25s ease", ...(mob ? { height: "calc(100vh - 26px)" } : { maxHeight: "92vh" }) }}>
        <div className="flex items-start gap-3 border-b border-[#eef0f4] px-[22px] pb-[14px] pt-[18px]">
          <div className="flex h-10 w-10 flex-none items-center justify-center rounded-[12px] bg-blue-tint text-[20px] text-blue"><IconWand size={20} /></div>
          <div className="min-w-0 flex-1"><div className="text-[19px] font-extrabold text-ink">{t.mk.title}</div><div className="mt-[2px] text-[13px] text-text-2">{t.mk.sub}</div></div>
          <button type="button" onClick={onClose} className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-full border-none bg-[#f0f2f6] text-[17px] text-[#5c6675] hover:bg-[#e4e8ef]"><IconX size={17} /></button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-[22px] py-[18px]">
          <div className="mb-4 flex gap-[3px] overflow-x-auto rounded-[12px] bg-[#f0f2f6] p-1">
            {([["paste", <IconClipboardText key="p" size={16} />, t.mk.tab_paste], ["gen", <IconLayoutGridAdd key="g" size={16} />, t.mk.tab_gen]] as const).map(([m, icon, label]) => (
              <span key={m} onClick={() => setMode(m)} className={`flex flex-1 flex-none cursor-pointer items-center justify-center gap-[7px] whitespace-nowrap rounded-[10px] px-3 py-[10px] text-[13.5px] font-bold ${mode === m ? "bg-surface text-ink shadow-[0_1px_3px_rgba(20,36,63,.18)]" : "text-text-2"}`}>{icon} {label}</span>
            ))}
          </div>
          <div className="mb-[18px] flex flex-wrap items-end gap-[18px]">
            <div><label className="mb-[6px] block text-[12px] text-text-2">{t.mk.kind}</label>
              <div className="flex max-w-full gap-[6px] overflow-x-auto pb-[2px]">
                {kinds.map(([k, icon, label]) => { const on = kind === k; return <span key={k} onClick={() => setKind(k)} className="inline-flex flex-none cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[20px] px-[13px] py-2 text-[13px] font-semibold" style={{ border: `1.5px solid ${on ? "#4d7cfe" : "#e6e9f0"}`, background: on ? "#eef3ff" : "#fff", color: on ? "#3a63d4" : "#6b7688" }}>{icon} {label}</span>; })}
              </div>
            </div>
            <div><label className="mb-[6px] block text-[12px] text-text-2">{t.mk.wing_lbl}</label><input value={wing} onChange={(e) => setWing(e.target.value)} placeholder={t.mk.wing_ph} className={`${inp} w-[150px] py-[9px]`} /></div>
            <div className="min-w-0 max-w-full"><div className="flex gap-[6px] overflow-x-auto pb-[2px]">
              {([["add", false], ["repl", true]] as const).map(([k, v]) => { const on = replace === v; return <span key={k} onClick={() => setReplace(v)} className="flex-none cursor-pointer whitespace-nowrap rounded-[20px] px-[13px] py-2 text-[13px] font-semibold" style={{ border: `1.5px solid ${on ? (v ? "#b45309" : "#0f9d6b") : "#e6e9f0"}`, background: on ? (v ? "#fdf3e6" : "#e4f6ee") : "#fff", color: on ? (v ? "#b45309" : "#0f9d6b") : "#6b7688" }}>{v ? t.mk.mode_repl : t.mk.mode_add}</span>; })}
            </div>
              <div className="mt-[6px] text-[11.5px] leading-[1.5] text-muted">{t.mk.keep_hint}</div></div>
          </div>
          {mode === "paste" && (
            <>
              <p className="mb-[10px] text-[13.5px] text-text-2">{t.mk.paste_hint}</p>
              <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder={t.mk.paste_ph} className="min-h-[150px] w-full resize-y rounded-[12px] border-[1.5px] border-dashed border-[#cdd5e2] bg-[#fbfcfe] px-[14px] py-3 font-mono text-[13px] outline-none focus:border-blue focus:bg-surface" />
              {parsed.length > 0 && (
                <>
                  <div className="mb-[10px] mt-[14px] inline-flex items-center gap-[7px] rounded-[20px] bg-green-tint px-3 py-[5px] text-[12.5px] font-bold text-green"><IconCircleCheck size={15} /> {t.mk.detected}: {parsed.length} {t.mk.units_w} · {[...new Set(parsed.map((u) => u.floor))].length} {t.mk.floors_w}</div>
                  <div className="overflow-hidden rounded-[12px] border border-line">
                    <table className="w-full border-collapse text-[13px]">
                      <thead><tr><th className={th}>№</th><th className={th}>{t.th_floor}</th><th className={th}>{t.th_type}</th><th className={th}>{t.th_areaShort}</th><th className={th}>{t.th_price}</th><th className={th}>{t.f_status}</th></tr></thead>
                      <tbody>{parsed.slice(0, 6).map((r, i) => <tr key={i}><td className={`${td} font-bold text-ink`}>{r.num}</td><td className={td}>{r.floor}</td><td className={td}>{r.type}</td><td className={td}>{r.area || "—"}</td><td className={`${td} whitespace-nowrap`}>{r.price ? nf(r.price) + " €" : "—"}</td><td className={td}>{t.status[r.status] || r.status}</td></tr>)}</tbody>
                    </table>
                  </div>
                  {parsed.length > 6 && <div className="mt-[6px] text-[11.5px] text-muted">{t.mk.preview_note.replace("{n}", String(parsed.length))}</div>}
                </>
              )}
            </>
          )}
          {mode === "gen" && (
            <>
              <p className="mb-[14px] text-[13.5px] text-text-2">{t.mk.gen_hint}</p>
              {kind !== "villa" ? (
                <>
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
                    <div><label className={lbl}>{t.mk.gen_floors}</label><input type="number" value={mkF} onChange={(e) => setMkF(e.target.value)} className={`${inp} w-full`} /></div>
                    <div><label className={lbl}>{t.mk.gen_per}</label><input type="number" value={mkP} onChange={(e) => setMkP(e.target.value)} className={`${inp} w-full`} /></div>
                  </div>
                  <div className="mt-4">
                    <label className="mb-2 block text-[12px] text-text-2">{t.mk.gen_pf}</label>
                    <div className="grid max-h-[220px] gap-2 overflow-y-auto pr-[2px]" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(128px,1fr))" }}>
                      {floorRows.map((f) => (
                        <div key={f} className="flex items-center gap-2 rounded-[10px] border border-line bg-[#fbfcfe] px-[10px] py-[7px]">
                          <span className="flex-1 whitespace-nowrap text-[12px] font-bold text-text-2">{t.floor_word} {fLbl(f, obj?.fScheme || "tr")}</span>
                          <input type="number" value={mkPF[f] != null ? mkPF[f] : mkP} onChange={(e) => setMkPF((s) => ({ ...s, [f]: e.target.value }))} className="w-[52px] rounded-[8px] border border-line bg-surface p-[6px] text-center text-[13px] outline-none" />
                        </div>
                      ))}
                    </div>
                    <div className="mt-[10px] text-[12.5px] font-bold text-ink">{t.mk.gen_total}: {genCount} {t.mk.units_w}</div>
                  </div>
                </>
              ) : (
                <>
                  <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))" }}>
                    <div><label className={lbl}>{t.mk.villas_n}</label><input type="number" value={mkVN} onChange={(e) => setMkVN(e.target.value)} className={`${inp} w-full`} /></div>
                  </div>
                  <div className="mt-3 text-[12.5px] font-bold text-ink">{t.mk.gen_total}: {genCount} {t.mk.units_w}</div>
                </>
              )}
            </>
          )}
        </div>
        <div className="flex flex-none flex-wrap items-center gap-[10px] border-t border-[#eef0f4] px-5 py-[13px]">
          <span className="inline-flex items-center gap-[6px] text-[12px]" style={{ color: replace ? "#b45309" : "#0f9d6b" }}>{replace ? <IconAlertTriangle size={14} /> : <IconCirclePlus size={14} />} {replace ? t.mk.replace_warn : t.mk.add_note}</span>
          <div className="flex-1" />
          <button type="button" onClick={onClose} className="cursor-pointer rounded-[10px] border border-line bg-surface px-4 py-[10px] text-[14px] font-semibold text-ink-2">{t.mk.cancel}</button>
          <button type="button" onClick={create} disabled={!can} className={`inline-flex items-center gap-[7px] whitespace-nowrap rounded-[11px] border-none px-5 py-[11px] text-[14px] font-bold ${can ? "cursor-pointer bg-green text-white" : "cursor-not-allowed bg-[#e4e8ef] text-muted"}`}><IconCheck size={16} /> {t.mk.create}</button>
        </div>
      </div>
    </div>
  );
}
