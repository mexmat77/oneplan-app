"use client";

// Step 0 «Основное» — prototype lines 1815–1846: developer (locked card or searchable list), name, stage,
// address, purpose chips. `wzMyCoIds` by role: superadmin → all, admin → [1], editor/client → [1, 3] (line 3401).
import { useCallback } from "react";
import { Select } from "@/components/ui/Select";
import { IconBuilding, IconChevronDown, IconLink, IconSearch } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { STAGELIST } from "@/lib/dev/data";
import { fmtCoord, isMapLink, llOf } from "@/lib/dev/geo";
import { LocMapLazy } from "@/components/dev/object/LocMapLazy";
import { AddressSearch } from "@/components/ui/AddressSearch";
import { LinkHint } from "@/components/dev/object/SecLoc";
import { useMapLink, type MapLinkApply } from "@/components/dev/object/useMapLink";
import type { Company, DevRole, PurposeTag, Stage } from "@/lib/dev/types";
import type { WzStepProps } from "./wizardState";
import { getDev } from "@/store/dev";

export function wzMyCompanies(role: DevRole, companies: Company[]): Company[] {
  // Real accounts: the companies the user belongs to (Supabase `developer_members`); prototype demo fallback otherwise.
  const my = getDev().myCoIds;
  const ids = role === "superadmin" ? companies.map((c) => c.id) : my.length ? my : role === "admin" ? [1] : [1, 3];
  return companies.filter((c) => ids.includes(c.id));
}
export function wzSelected(role: DevRole, companies: Company[], client: number | null): Company | null {
  const my = wzMyCompanies(role, companies);
  const locked = role !== "superadmin" && my.length === 1;
  const id = client ?? (locked && my.length ? my[0].id : null);
  return companies.find((c) => c.id === id) ?? null;
}

const input = "w-full rounded-[11px] border border-line bg-[#fbfcfe] px-[14px] py-[13px] text-[15px] outline-none focus:border-blue";
const label = "mb-[7px] block text-[13px] text-text-2";

export function StepInfo({ s, set, role, companies }: WzStepProps & { role: DevRole; companies: Company[] }) {
  const { t, lang } = useDevT();
  // «Адрес» + «Ссылка на карту»: ссылка → координаты (`lng/lat` в состоянии мастера) + адрес по Nominatim.
  const apply = useCallback<MapLinkApply>(({ lat, lng, addr }) => set(addr !== undefined ? { lat, lng, addr } : { lat, lng }), [set]);
  const canSetAddr = useCallback(() => !s.addr.trim() || isMapLink(s.addr), [s.addr]);
  const ml = useMapLink({ lang, apply, canSetAddr, initialLink: s.mapLink });
  const onLink = (v: string) => { set({ mapLink: v }); ml.onLink(v); };
  const onAddr = (v: string) => (isMapLink(v) ? onLink(v) : set({ addr: v }));
  const ll = llOf(s.lng, s.lat);
  const onPick = useCallback((lat: number, lng: number) => set({ lat: fmtCoord(lat), lng: fmtCoord(lng) }), [set]);
  const stages = t.stages as Record<string, string>;
  const purpose = t.purpose as Record<string, string>;
  const my = wzMyCompanies(role, companies);
  const locked = role !== "superadmin" && my.length === 1;
  const sel = wzSelected(role, companies, s.client);
  const q = s.coSearch.trim().toLowerCase();
  const opts = my.filter((c) => !q || c.name.toLowerCase().includes(q) || (c.dir || "").toLowerCase().includes(q));

  return (
    <>
      <p className="mb-5 text-[14px] text-text-2">{t.wz.info_hint}</p>
      <div className="rounded-[16px] border border-line bg-surface p-6">
        <div className="mb-[18px] border-b border-bg-2 pb-[18px]">
          <label className="mb-2 block text-[13px] text-text-2">{t.wz.fld_client} <span className="text-red">*</span></label>
          {locked ? (
            <div className="flex items-center gap-[11px] rounded-[12px] border border-line bg-[#f5f6f9] px-[14px] py-3">
              <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] text-[17px] text-white" style={{ background: "linear-gradient(135deg,#4d7cfe,#7b4fd0)" }}><IconBuilding size={17} /></div>
              <div className="min-w-0"><div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14.5px] font-bold text-ink">{sel?.name}</div><div className="text-[11.5px] text-muted">{t.wz.client_locked_hint}</div></div>
            </div>
          ) : (
            <>
              <div className="relative mb-[9px]">
                <IconSearch size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#9aa1ac]" />
                <input value={s.coSearch} onChange={(e) => set({ coSearch: e.target.value })} placeholder={t.wz.client_search} className="w-full rounded-[11px] border border-line bg-[#fbfcfe] py-3 pl-[38px] pr-[14px] text-[14px] outline-none focus:border-blue" />
              </div>
              <div className="flex max-h-[220px] flex-col gap-2 overflow-auto p-[2px]">
                {opts.length === 0 && <div className="px-[10px] py-[18px] text-center text-[13px] text-[#9aa1ac]">{t.wz.client_none}</div>}
                {opts.map((c) => {
                  const on = sel?.id === c.id;
                  return (
                    <div key={c.id} onClick={() => set({ client: c.id })} className="flex cursor-pointer items-center gap-[11px] rounded-[12px] px-[13px] py-[11px]" style={{ border: `1.5px solid ${on ? "#4d7cfe" : "#eef1f6"}`, background: on ? "#eef3ff" : "#fbfcfe" }}>
                      <span className="flex h-[22px] w-[22px] flex-none items-center justify-center rounded-[7px] text-[12px] font-bold text-white" style={{ background: on ? "#4d7cfe" : "#dfe3ea" }}>{on ? "✓" : ""}</span>
                      <div className="min-w-0 flex-1">
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-bold" style={{ color: on ? "#14243f" : "#37414f" }}>{c.name}</div>
                        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[11.5px] text-muted">{c.dir || ""}</div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="mt-2 text-[11.5px] text-muted">{t.wz.client_hint}</div>
            </>
          )}
        </div>
        <div className="mb-4"><label className={label}>{t.fld_name}</label><input value={s.name} onChange={(e) => set({ name: e.target.value, needName: false })} placeholder={t.dx.wz_ph_name} className={input} style={s.needName && !s.name.trim() ? { borderColor: "#dc2626", background: "#fdecec" } : undefined} /></div>
        <div className="mb-4 grid gap-4" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(200px,1fr))" }}>
          <div>
            <label className={label}>{t.fld_stage}</label>
            <Select value={s.stage} onChange={(v) => set({ stage: v as Stage })} className="w-full rounded-[11px] bg-[#fbfcfe] py-[13px] pl-[14px] pr-[12px] text-[15px]" options={STAGELIST.map((k) => ({ value: k, label: stages[k] }))} />
          </div>
          <div><label className={label}>{t.fld_addr}</label><AddressSearch value={isMapLink(s.addr) ? "" : s.addr} onChange={onAddr} onPick={(p) => set({ lat: fmtCoord(p.lat), lng: fmtCoord(p.lng), addr: p.addr })} placeholder={t.dx.wz_ph_addr} className={input} lang={lang} bias={ll} /></div>
        </div>
        <div className="mb-4">
          <label className={label}>{t.geo.link}</label>
          <div className="relative">
            <IconLink size={15} className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-[#9aa1ac]" />
            <input value={ml.link} onChange={(e) => onLink(e.target.value)} placeholder={t.geo.link_ph} className={`${input} pl-[38px]`} />
          </div>
          <LinkHint status={ml.status.kind === "idle" && ll ? { kind: "ok", lat: ll[0], lng: ll[1], addr: s.addr } : ml.status} />
          {ll && (
            <div className="mt-3">
              <LocMapLazy ll={ll} onPick={onPick} height={200} />
              <div className="mt-[6px] text-[12px] text-muted">{t.geo.map_hint}</div>
            </div>
          )}
        </div>
        <label className="mb-2 block text-[13px] text-text-2">{t.fld_purpose}</label>
        <div className="flex flex-wrap gap-2">
          {(["cit", "res", "com"] as PurposeTag[]).map((k) => {
            const on = s.tags.includes(k);
            return (
              <span key={k} onClick={() => set({ tags: on ? s.tags.filter((x) => x !== k) : [...s.tags, k] })} className={`cursor-pointer rounded-[18px] border px-[11px] py-[6px] text-[12px] font-semibold ${on ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-text-2"}`}>{purpose[k]}</span>
            );
          })}
        </div>
      </div>
    </>
  );
}
