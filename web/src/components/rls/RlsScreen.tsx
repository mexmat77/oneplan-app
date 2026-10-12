"use client";

// Admin «Риэлторы» — prototype lines 838–959 (markup) and 3585–3620 / 3920–3935 / 4145–4242 (logic).
// Данные: `remote` (Supabase — profiles / agencies / reports / invites, загружает серверная страница `app/(app)/rls/page.tsx`)
// или, без Supabase (UI-режим), демо-стор `store/admin`. Действия в remote-режиме идут через серверные экшены админки
// (`app/admin/actions.ts`) — те же, что в «Управлении», поэтому оба экрана видят одни данные.
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  IconArrowLeft, IconBuilding, IconChevronRight, IconCreditCard, IconFlag, IconFolders, IconHeart, IconHome2, IconMailForward,
  IconPencil, IconPlus, IconSearch, IconTrash, IconUserCheck, IconUserExclamation, IconUserPlus, IconUsers,
} from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { fmt } from "@/lib/money";
import { useAllListings } from "@/store/listings";
import { payState, removeAgency, toggleReport, updateMember, useAdmin, type Agency, type Member } from "@/store/admin";
import { deleteCompany, updateUser } from "@/app/admin/actions";
import { ReportsList } from "@/components/admin/ReportsList";
import type { ReportRow } from "@/lib/reports";
import { useProfile } from "@/store/profile";
import { useRole } from "@/store/role";
import { showToast } from "@/components/ui/toast";
import { AgencyModal } from "@/components/rls/AgencyModal";
import { InviteModal } from "@/components/rls/InviteModal";
import { NEW_KEY, RealtorModal } from "@/components/rls/RealtorModal";

// Prototype `rlTabPSt/ASt` (line 4160) and `rlTabRSt` (4146: #5a6472 off, softer shadow).
const tabCls = (on: boolean, reps = false) => `inline-flex cursor-pointer items-center gap-[7px] rounded-[9px] px-4 py-2 text-[13px] font-bold ${on ? `bg-surface text-ink ${reps ? "shadow-[0_1px_4px_rgba(20,36,63,.08)]" : "shadow-[0_1px_3px_rgba(20,36,63,.1)]"}` : `${reps ? "text-text" : "text-text-2"} hover:bg-line-2`}`;
const input = "w-full rounded-[11px] border border-line bg-surface py-[10px] pl-[34px] pr-[13px] text-[13.5px] outline-none";
const moreRow = "cursor-pointer bg-bg-5 p-[13px] text-center text-[13px] font-bold text-blue-2 hover:bg-blue-tint";
// Prototype `stM` (line 3600) and pay badge palette (line 3612).
const ST_CHIP: Record<Member["status"], [string, string]> = { active: ["#e4f6ee", "#0f9d6b"], paused: ["#f0f2f6", "#6b7688"], pending: ["#fdf5df", "#c98d00"] };
const PAY_CLS = { ok: "bg-green-tint text-green", soon: "bg-warn-tint text-warn-2", exp: "bg-red-tint text-red-2" };
const av = (name: string) => name.split(" ").map((w) => w[0]).join("");

export type RemoteMember = { id: string; name: string; email: string | null; phone: string | null; agency_id: string | null; agency_text: string | null; color: string; city: string | null; langs: string | null; status: "active" | "paused" | "pending"; paid_to: string | null; last_seen: string | null; role: string; agency_role?: string | null };
export type RemoteAgency = { id: string; name: string; addr: string | null; phone: string | null; lic: string | null; scan_path: string | null };
export type RlsRemote = { members: RemoteMember[]; agencies: RemoteAgency[]; reports: ReportRow[]; invitesN: number; meId: string };

const isoToRu = (d: string | null) => { if (!d) return ""; const [y, m, dd] = d.slice(0, 10).split("-"); return `${dd}.${m}.${y}`; };
/** Профиль Supabase → строка экрана прототипа (`Member`). Счётчики объектов/подборок/реакций — из локальных объявлений (пока они не в базе). */
function toMember(p: RemoteMember, agencies: RemoteAgency[], lang: string, objs: number): Member {
  const ag = agencies.find((a) => a.id === p.agency_id)?.name ?? p.agency_text ?? "";
  const seen = p.last_seen ? new Date(p.last_seen) : null;
  const online = !!seen && Date.now() - seen.getTime() < 5 * 60e3;
  const laTxt = seen ? seen.toLocaleDateString(lang === "RU" ? "ru-RU" : lang === "TR" ? "tr-TR" : "en-GB") : "—";
  const city = p.city ?? "";
  return { id: p.id, name: p.name || p.email || "—", ag, color: p.color || "#4d7cfe", phone: p.phone ?? "", city: { RU: city, EN: city, TR: city }, langs: p.langs ?? "",
    online, objs, sels: 0, likes: 0, la: { RU: laTxt, EN: laTxt, TR: laTxt }, pending: p.status === "pending", status: p.status, paidTo: isoToRu(p.paid_to), mail: p.email ?? "" };
}

export function RlsScreen({ remote }: { remote: RlsRemote | null }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const { isAdmin } = useRole();
  const all = useAllListings();
  const profile = useProfile();
  const mock = useAdmin();
  const members: Member[] = remote ? remote.members.map((p) => toMember(p, remote.agencies, lang, all.filter((o) => o.owner === p.id).length)) : mock.members;
  const agencies: Agency[] = remote ? remote.agencies.map((a) => ({ id: a.id, name: a.name, addr: a.addr ?? "", phone: a.phone ?? "", lic: a.lic ?? "", scan: a.scan_path ?? "" })) : mock.agencies;
  const reports = mock.reports; // демо-жалобы (UI-режим); в remote-режиме вкладка рендерит `ReportsList` по `remote.reports`
  const meId = remote ? remote.meId : "me";
  const now = remote ? new Date() : undefined; // в демо — фиксированное «сегодня» прототипа
  const refresh = () => router.refresh();
  const act = (fn: () => Promise<unknown>, ok?: string) => { fn().then(() => { refresh(); if (ok) showToast(ok); }).catch((e) => showToast((e as Error).message)); };
  const setStatus = (id: string, status: Member["status"], ok?: string) => {
    if (remote) act(() => updateUser(id, { status }), ok);
    else { updateMember(id, { status, pending: status === "pending" }); if (ok) showToast(ok); }
  };
  const [tab, setTab] = useState<"people" | "ags" | "reps">("people");
  const [pg, setPg] = useState<{ rl?: number; ag?: number; rpt?: number }>({});
  const [q, setQ] = useState("");
  const [agQ, setAgQ] = useState("");
  const [agView, setAgView] = useState("");
  const [agEdit, setAgEdit] = useState<string | null>(null); // '' = new, name = edit
  const [editK, setEditK] = useState("");
  const [inv, setInv] = useState(false);

  // Prototype: the screen exists only for admins (`isRls: screen==='rls' && isAdmin`, line 3709 sends a realtor to the catalog).
  // Deferred a tick: AppChrome calls `initRole()` in its own effect, which runs after this child effect on first mount.
  useEffect(() => {
    if (isAdmin) return;
    const id = setTimeout(() => router.replace("/catalog"), 0);
    return () => clearTimeout(id);
  }, [isAdmin, router]);
  if (!isAdmin) return null;

  // Prototype `pgr` (line 2996): «Показать ещё N · total».
  const pgr = <T,>(key: "rl" | "ag" | "rpt", arr: T[], step: number) => {
    const n = pg[key] || step;
    const rest = arr.length - n;
    return { view: arr.slice(0, n), moreShow: rest > 0, moreL: `${t.common.showMore.replace("{n}", String(Math.min(rest, step)))} · ${arr.length}`, more: () => setPg({ ...pg, [key]: n + step }) };
  };
  const stL = { active: t.rl.act, paused: t.rl.pau, pending: t.rl.pen };
  const agNames = agencies.map((a) => a.name);
  const agCount = (name: string) => members.filter((m) => m.ag === name).length;

  const stats = [
    { Icon: IconUsers, bg: "#eef3ff", c: "#4d7cfe", v: String(members.length), l: t.rl.stT },
    { Icon: IconUserCheck, bg: "#e4f6ee", c: "#0f9d6b", v: String(members.filter((m) => m.status === "active").length), l: t.rl.stA },
    { Icon: IconUserExclamation, bg: "#fdf5df", c: "#c98d00", v: String(members.filter((m) => m.status === "pending").length), l: t.rl.stP },
    { Icon: IconMailForward, bg: "#efe7fb", c: "#7b4fd0", v: String(remote ? remote.invitesN : mock.invites.length), l: t.rl.stI },
  ];
  const nq = q.trim().toLowerCase();
  const rlAll = members.filter((m) => !nq || `${m.name} ${m.mail}`.toLowerCase().includes(nq)).sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1));
  const rlP = pgr("rl", rlAll, 5);
  const agAll = agencies.filter((a) => !agQ.trim() || a.name.toLowerCase().includes(agQ.trim().toLowerCase())).sort((x, y) => x.name.localeCompare(y.name));
  const agP = pgr("ag", agAll, 3);
  const rptSorted = [...reports].sort((a, b) => (a.st === "new" ? 0 : 1) - (b.st === "new" ? 0 : 1));
  const rptP = pgr("rpt", rptSorted, 8);
  const newReports = remote ? remote.reports.filter((r) => r.status === "new").length : reports.filter((r) => r.st === "new").length;
  const agV = agView ? agencies.find((x) => x.name === agView) : undefined;
  const agVList = agV ? members.filter((m) => m.ag === agV.name) : [];

  return (
    <div className="mx-auto max-w-[1100px]">
      <div className="mb-[18px] flex flex-wrap items-start gap-4">
        <div className="min-w-[260px] flex-1">
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.rl.title}</h1>
          <p className="mt-[5px] max-w-[620px] text-[14px] text-text-2 [text-wrap:pretty]">{t.rl.sub}</p>
        </div>
        <button type="button" onClick={() => setInv(true)} className="inline-flex flex-none cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[11px] bg-blue-2 px-[18px] py-[11px] text-[14px] font-bold text-white hover:bg-blue-3"><IconUserPlus size={17} /> {t.rl.inv}</button>
      </div>
      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        {stats.map(({ Icon, bg, c, v, l }) => (
          <div key={l} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-[17px] py-[15px]">
            <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px]" style={{ background: bg, color: c }}><Icon size={18} /></span>
            <div><div className="text-[20px] font-extrabold text-ink">{v}</div><div className="text-[12px] text-muted">{l}</div></div>
          </div>
        ))}
      </div>
      <div className="mb-[18px] flex w-fit gap-[6px] rounded-[12px] bg-line-2 p-1">
        <span onClick={() => setTab("people")} className={tabCls(tab === "people")}><IconUsers size={15} /> {t.rl.tabP}</span>
        <span onClick={() => { setTab("ags"); setAgView(""); }} className={tabCls(tab === "ags")}><IconBuilding size={15} /> {t.rl.tabA} <span className="ml-[2px] rounded-[10px] bg-[#dfe4ec] px-[7px] py-[1px] text-[11px] font-extrabold text-text">{agencies.length}</span></span>
        <span onClick={() => setTab("reps")} className={tabCls(tab === "reps", true)}><IconFlag size={15} /> {t.rl.tabR} {newReports > 0 && <span className="ml-[2px] rounded-[10px] bg-red px-[7px] py-[1px] text-[11px] font-extrabold text-white">{newReports}</span>}</span>
      </div>

      {tab === "reps" && remote && <ReportsList rows={remote.reports} />}
      {tab === "reps" && !remote && (
        <>
          <p className="mb-[14px] text-[13px] text-text-2 [text-wrap:pretty]">{t.rl.rpSub}</p>
          {reports.length === 0 && <div className="rounded-[14px] border border-dashed border-[#dfe4ec] bg-surface p-[26px] text-center text-[13px] text-muted">{t.rl.rpEmpty}</div>}
          <div className="flex flex-col gap-[10px]">
            {rptP.view.map((r) => {
              const o = all.find((x) => x.id === r.listingId);
              const fromName = r.from === "me" ? t.rl.you : members.find((m) => m.id === r.from)?.name ?? "";
              const href = o ? `/obj/${o.id}` : "#";
              return (
                <div key={r.id} className="flex flex-wrap items-start gap-[13px] rounded-[14px] border border-line bg-surface px-4 py-[14px]">
                  <Link href={href} className="h-14 w-[74px] flex-none rounded-[10px] bg-line-2 bg-cover bg-center hover:brightness-90" style={{ backgroundImage: o ? `url('${o.img}')` : undefined }} />
                  <div className="min-w-[220px] flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <Link href={href} className="text-[13.5px] font-bold text-ink hover:text-blue-2">{o ? o.t[lang] : "—"}</Link>
                      <span className="text-[12px] text-muted">{o ? fmt(o.price, o.cur) : ""}</span>
                      <span className={`flex-none rounded-[8px] px-[9px] py-[3px] text-[10.5px] font-extrabold uppercase tracking-[.04em] ${r.st === "new" ? "bg-red-tint text-red" : "bg-green-tint-2 text-green-4"}`}>{r.st === "new" ? t.rl.rpNew : t.rl.rpDone}</span>
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-[8px] bg-[#fff4e5] px-[9px] py-[3px] text-[11.5px] font-bold text-warn-3">{t.obj.rptR[r.reason] ?? r.reason}</span>
                      {r.text && <span className="text-[12.5px] text-text">«{r.text}»</span>}
                    </div>
                    <div className="mt-[5px] text-[11.5px] text-muted">{fromName} · {r.date}</div>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <Link href={href} className="rounded-[9px] border border-line bg-surface px-[13px] py-2 text-[12px] font-bold text-ink hover:border-blue hover:text-blue">{t.reqs.openObj}</Link>
                    <button type="button" onClick={() => toggleReport(r.id)} className={`flex-none cursor-pointer rounded-[9px] px-[13px] py-2 text-[12px] font-bold hover:brightness-95 ${r.st === "new" ? "bg-green-4 text-white" : "border border-line bg-surface text-text"}`}>{r.st === "new" ? t.rl.rpDoneB : t.rl.rpReopen}</button>
                  </div>
                </div>
              );
            })}
          </div>
          {rptP.moreShow && <button type="button" onClick={rptP.more} className="mx-auto mt-[14px] block cursor-pointer rounded-[11px] border border-sel-tint-2 bg-blue-tint px-6 py-[11px] text-[13px] font-bold text-blue-2 hover:bg-sel-tint">{rptP.moreL}</button>}
        </>
      )}

      {tab === "ags" && agV && (
        <>
          <button type="button" onClick={() => setAgView("")} className="mb-[14px] inline-flex cursor-pointer items-center gap-[7px] text-[13.5px] font-bold text-blue hover:text-blue-2"><IconArrowLeft size={16} /> {t.rl.agBack}</button>
          <div className="mb-[14px] rounded-[16px] border border-line bg-surface px-[22px] py-5">
            <div className="flex flex-wrap items-center gap-[13px]">
              <span className="flex h-[52px] w-[52px] flex-none items-center justify-center rounded-[14px] bg-blue-tint text-blue-2"><IconBuilding size={23} /></span>
              <div className="min-w-[160px] flex-1">
                <div className="text-[18px] font-extrabold tracking-[-0.01em] text-ink">{agV.name}</div>
                <div className="mt-[2px] text-[12.5px] text-muted">{agVList.length} {t.rl.agCnt}</div>
                <div className="mt-[6px] text-[12px] leading-[1.6] text-text-2">{[agV.addr, agV.phone, agV.lic && `${t.rl.agLicL}: ${agV.lic}`, agV.scan && `✓ ${t.rl.agScanL}`].filter(Boolean).join(" · ") || t.rl.agNoMeta}</div>
              </div>
              <button type="button" onClick={() => setAgEdit(agV.name)} className="inline-flex flex-none cursor-pointer items-center gap-1 rounded-[10px] border border-line bg-surface px-[14px] py-[9px] text-[12.5px] font-bold text-ink hover:border-blue hover:text-blue"><IconPencil size={14} /> {t.rl.editB}</button>
              {agVList.length === 0 && <button type="button" onClick={() => { if (remote && agV.id) act(() => deleteCompany("agencies", agV.id!), t.rl.agDone); else { removeAgency(agV.name); showToast(t.rl.agDone); } setAgView(""); }} className="flex h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-[10px] border border-line text-muted-2 hover:border-red hover:text-red"><IconTrash size={15} /></button>}
            </div>
          </div>
          <div className="overflow-hidden rounded-[16px] border border-line bg-surface">
            {agVList.map((m) => (
              <div key={m.id} className="flex items-center gap-3 border-b border-[#f5f7fb] px-[18px] py-[13px]">
                <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: m.color }}>{av(m.name).slice(0, 2)}</span>
                <div className="min-w-0 flex-1"><div className="text-[13.5px] font-bold text-ink">{m.name}</div><div className="text-[12px] text-muted">{m.phone || "—"} · {m.mail}</div></div>
                <button type="button" onClick={() => setEditK(m.id)} title={t.rl.editB} className="flex h-8 w-8 flex-none cursor-pointer items-center justify-center rounded-[9px] border border-line text-muted hover:border-blue hover:text-blue"><IconPencil size={14} /></button>
              </div>
            ))}
            {agVList.length === 0 && <div className="p-[22px] text-center text-[13px] text-muted">{t.rl.agEmpty}</div>}
          </div>
        </>
      )}
      {tab === "ags" && !agV && (
        <>
          <div className="mb-[14px] flex flex-wrap gap-2">
            <div className="relative min-w-[200px] flex-1"><IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" /><input value={agQ} onChange={(e) => setAgQ(e.target.value)} placeholder={t.rl.agSearch} className={input} /></div>
            <button type="button" onClick={() => setAgEdit("")} className="inline-flex flex-none cursor-pointer items-center gap-1 whitespace-nowrap rounded-[11px] bg-blue-2 px-4 py-[10px] text-[13px] font-bold text-white hover:bg-blue-3"><IconPlus size={15} /> {t.rl.agAdd}</button>
          </div>
          <div className="overflow-hidden rounded-[16px] border border-line bg-surface">
            {agP.view.map((a) => (
              <div key={a.name} onClick={() => setAgView(a.name)} className="flex cursor-pointer items-center gap-3 border-b border-[#f5f7fb] px-[18px] py-[13px] hover:bg-bg-5">
                <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] bg-blue-tint text-blue-2"><IconBuilding size={17} /></span>
                <span className="flex-1 text-[13.5px] font-bold text-ink">{a.name}</span>
                <span className="flex-none text-[12px] text-muted">{agCount(a.name)} {t.rl.agCnt}</span>
                <IconChevronRight size={16} className="flex-none text-[#c3c9d4]" />
              </div>
            ))}
            {agAll.length === 0 && <div className="p-[22px] text-center text-[13px] text-muted">{t.chat.notFound}</div>}
            {agP.moreShow && <div onClick={agP.more} className={moreRow}>{agP.moreL}</div>}
          </div>
          <div className="mt-[10px] text-[11.5px] text-muted-2">{t.rl.agDelH}</div>
        </>
      )}

      {tab === "people" && (
        <>
          <div className="mb-[14px] flex gap-2">
            <div className="relative flex-1"><IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-2" /><input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.rl.rlSearch} className={input} /></div>
            <button type="button" onClick={() => setEditK(NEW_KEY)} className="inline-flex flex-none cursor-pointer items-center gap-1 whitespace-nowrap rounded-[11px] bg-blue-2 px-4 py-[10px] text-[13px] font-bold text-white hover:bg-blue-3"><IconPlus size={15} /> {t.rl.addB}</button>
          </div>
          <div className="overflow-hidden rounded-[16px] border border-line bg-surface">
            {rlAll.length === 0 && <div className="p-[22px] text-center text-[13px] text-muted">{t.chat.notFound}</div>}
            {rlP.view.map((m) => {
              const ps = payState(m.paidTo, now);
              const st = ST_CHIP[m.status];
              return (
                <div key={m.id} className="flex flex-wrap items-center gap-[13px] border-b border-[#f5f7fb] px-[18px] py-[15px]" style={{ background: m.status === "pending" ? "#fffdf5" : "#fff" }}>
                  <span className="relative flex-none">
                    <span className="flex h-[42px] w-[42px] items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: m.color }}>{av(m.name)}</span>
                    {m.online && <span className="absolute bottom-0 right-0 h-[11px] w-[11px] rounded-full border-2 border-surface bg-green-3" />}
                  </span>
                  <div className="min-w-[150px] flex-1"><div className="text-[14px] font-bold text-ink">{m.name}{m.id === meId ? ` · ${t.obj.mineTag.toLowerCase()}` : ""}</div><div className="text-[12px] text-muted">{m.ag} · {m.city[lang]} · {m.langs}</div></div>
                  <div className="flex flex-none flex-wrap gap-[14px] text-[12.5px] text-text-2">
                    <span title={t.rl.objs} className="inline-flex items-center gap-1"><IconHome2 size={14} className="text-muted-2" /> {m.objs}</span>
                    <span title={t.rl.sels} className="inline-flex items-center gap-1"><IconFolders size={14} className="text-muted-2" /> {m.sels}</span>
                    <span title={t.rl.likes} className="inline-flex items-center gap-1 text-red"><IconHeart size={14} /> {m.likes}</span>
                  </div>
                  <span className="min-w-[110px] flex-none text-[11.5px] text-muted-2">{t.rl.la} {m.la[lang]}</span>
                  <span className={`inline-flex flex-none items-center gap-[5px] rounded-[12px] px-[10px] py-[5px] text-[11.5px] font-bold ${PAY_CLS[ps]}`}><IconCreditCard size={13} /> {ps === "ok" ? t.rl.payOk : ps === "soon" ? t.rl.paySoon : t.rl.payExp} {m.paidTo || "—"}</span>
                  <span className="flex-none whitespace-nowrap rounded-[8px] px-[11px] py-[5px] text-[11px] font-bold" style={{ background: st[0], color: st[1] }}>{stL[m.status]}</span>
                  {m.status === "pending" ? (
                    <>
                      <button type="button" onClick={() => setStatus(m.id, "active", t.rl.apprT)} className="flex-none cursor-pointer rounded-[9px] bg-green-3 px-[13px] py-2 text-[12px] font-bold text-white hover:brightness-[.92]">{t.rl.ok}</button>
                      <button type="button" onClick={() => setStatus(m.id, "paused", t.rl.declT)} className="flex-none cursor-pointer rounded-[9px] border border-line bg-surface px-[13px] py-2 text-[12px] font-bold text-red hover:brightness-[.96]">{t.rl.no}</button>
                    </>
                  ) : m.id !== meId ? (
                    <button type="button" onClick={() => setStatus(m.id, m.status === "active" ? "paused" : "active")} className={`flex-none cursor-pointer rounded-[9px] border px-[13px] py-2 text-[12px] font-bold hover:brightness-[.96] ${m.status === "active" ? "border-line bg-surface text-text-2" : "border-green-3 bg-green-3 text-white"}`}>{m.status === "active" ? t.rl.pause : t.rl.resume}</button>
                  ) : null}
                  <button type="button" onClick={() => setEditK(m.id)} title={t.rl.editB} className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-line text-text hover:border-blue hover:text-blue"><IconPencil size={15} /></button>
                </div>
              );
            })}
            {rlP.moreShow && <div onClick={rlP.more} className={moreRow}>{rlP.moreL}</div>}
          </div>
        </>
      )}

      {inv && <InviteModal remote={!!remote} onClose={() => setInv(false)} />}
      {editK && <RealtorModal key={editK} k={editK} members={members} agencies={agNames} remote={remote ? { meId, agencies: remote.agencies.map((a) => ({ id: a.id, name: a.name })), roles: Object.fromEntries(remote.members.map((m) => [m.id, m.agency_role ?? null])) } : undefined} onClose={() => { setEditK(""); if (remote) refresh(); }} />}
      {agEdit !== null && <AgencyModal key={agEdit} edit={agEdit} agencies={agencies} members={members} profileAgency={profile.agency} remote={!!remote} onSaved={(nm, old) => { setAgEdit(null); if (old) setAgView(nm); if (remote) refresh(); }} onClose={() => setAgEdit(null)} />}
    </div>
  );
}
