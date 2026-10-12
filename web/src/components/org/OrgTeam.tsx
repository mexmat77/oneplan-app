"use client";

// Команда организации (12.10.2026, модель «Организации и участники», миграция 0022) — ОДИН компонент для всех мест:
// «Управление → Организации → карточка» (админ платформы), «Моё агентство» (/team, администратор агентства),
// CRM → Настройки → Команда, кабинет застройщика /dev/users. Участники с ролями, филиалы (агентство), приглашения.
import { useEffect, useState, useTransition } from "react";
import { IconCopy, IconLink, IconMailForward, IconPlus, IconTrash, IconUserPlus, IconX } from "@tabler/icons-react";
import { addOrgMember, cancelInvite, getOrg, inviteToOrg, removeOrgMember, setOrgBranch, setOrgRole } from "@/app/org/actions";
import { confirmDialog } from "@/components/ui/confirm";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { showToast } from "@/components/ui/toast";
import { Avatar } from "@/components/ui/UserMenu";
import { useI18n } from "@/i18n/provider";
import { validMail } from "@/lib/phone";
import { isOrgAdminRole, ORG_ROLES, type OrgKind, type OrgRole, type OrgView } from "@/lib/org";

const btnP = "inline-flex h-9 cursor-pointer items-center gap-[6px] rounded-[10px] bg-blue-2 px-[14px] text-[13px] font-bold text-white hover:bg-blue-3 disabled:opacity-50";
const btnS = "inline-flex h-9 cursor-pointer items-center gap-[6px] rounded-[10px] border border-line bg-surface px-[12px] text-[13px] font-semibold text-ink hover:bg-bg-3 disabled:opacity-50";
const inp = "h-10 w-full rounded-[10px] border border-line bg-surface px-3 text-[14px] outline-none focus:border-blue";
const lbl = "mb-[5px] block text-[12px] font-semibold text-text-2";
const ST: Record<string, [string, string]> = { active: ["#e4f6ee", "#0f9d6b"], paused: ["#fdf5df", "#c98d00"], pending: ["#eef3ff", "#4d7cfe"] };

type Props = { kind: OrgKind; id: string; initial?: OrgView; compact?: boolean; onChange?: (v: OrgView) => void };

export function OrgTeam({ kind, id, initial, compact, onChange }: Props) {
  const { t, lang } = useI18n();
  const o = t.org;
  const roles = o.roles[kind] as Record<string, string>;
  const [view, setView] = useState<OrgView | null>(initial ?? null);
  const [err, setErr] = useState("");
  const [pending, start] = useTransition();
  const [inv, setInv] = useState<null | { email: string; name: string; role: OrgRole; lang: "RU" | "EN" | "TR"; url?: string; mailed?: boolean }>(null);
  const [add, setAdd] = useState<null | { email: string; role: OrgRole }>(null);
  const [copied, setCopied] = useState("");

  const msg = (e: unknown) => { const m = (e as Error)?.message ?? ""; return (o.err as Record<string, string>)[m] ?? m ?? o.err.generic; };
  async function reload() { try { const v = await getOrg(kind, id); setView(v); onChange?.(v); } catch (e) { setErr(msg(e)); } }
  // первая загрузка без `initial` (CRM → Команда): ответ приходит асинхронно, состояние ставится после await
  useEffect(() => {
    if (initial) return;
    let on = true;
    getOrg(kind, id).then((v) => { if (on) setView(v); }).catch((e) => { if (on) setErr((e as Error)?.message ?? ""); });
    return () => { on = false; };
  }, [kind, id, initial]);
  const run = (fn: () => Promise<unknown>, ok?: string) => { setErr(""); start(async () => { try { await fn(); await reload(); if (ok) showToast(ok); } catch (e) { setErr(msg(e)); } }); };
  const copy = (s: string) => { try { navigator.clipboard.writeText(s); } catch {} setCopied(s); showToast(t.rl.copied); };
  const fmt = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(lang === "RU" ? "ru-RU" : lang === "TR" ? "tr-TR" : "en-GB") : "—");

  if (!view) return <div className="py-8 text-center text-[13px] text-muted">{err || "…"}</div>;
  const { members, invites, branches, canManage } = view;
  const adminsN = members.filter((m) => isOrgAdminRole(kind, m.role)).length;
  const roleOpts = ORG_ROLES[kind].map((r) => ({ value: r, label: roles[r] }));
  const defRole: OrgRole = kind === "agency" ? "agent" : "editor";

  return (
    <div className="flex flex-col gap-4">
      {err && <div className="rounded-[10px] bg-red-tint px-3 py-2 text-[12.5px] text-red-2">{err}</div>}
      <div className="flex flex-wrap items-center gap-2">
        <div className="text-[12px] font-bold uppercase tracking-[.06em] text-muted">{o.members} · {members.length}</div>
        <span className="flex-1" />
        {canManage && <button type="button" onClick={() => setAdd({ email: "", role: defRole })} className={btnS}><IconUserPlus size={15} /> {o.addExisting}</button>}
        {canManage && <button type="button" onClick={() => setInv({ email: "", name: "", role: defRole, lang })} className={btnP}><IconPlus size={15} /> {o.invite}</button>}
      </div>
      {!canManage && <div className="rounded-[10px] bg-bg-2 px-3 py-2 text-[12.5px] text-text-2">{o.readOnly}</div>}
      <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
        {members.length === 0 && <div className="p-5 text-center text-[13px] text-muted">{o.noMembers}</div>}
        {members.map((m) => {
          const st = ST[m.status] ?? ST.active;
          const lastAdmin = isOrgAdminRole(kind, m.role) && adminsN <= 1;
          return (
            <div key={m.id} className={`flex flex-wrap items-center gap-3 border-b border-[#f5f7fb] px-4 ${compact ? "py-2" : "py-3"} last:border-b-0`}>
              <Avatar name={m.name} size={compact ? 32 : 38} color={m.color} />
              <div className="min-w-[180px] flex-1">
                <div className="flex flex-wrap items-center gap-2 text-[13.5px] font-bold text-ink">{m.name}{m.id === view.meId && <span className="text-[11px] font-semibold text-muted">· {o.you}</span>}{m.platformStaff && <span className="rounded-[6px] bg-[#efe7fb] px-[6px] py-[1px] text-[10.5px] font-bold text-[#7b4fd0]">{o.staff}</span>}</div>
                <div className="text-[12px] text-muted">{[m.email, m.phone].filter(Boolean).join(" · ")}</div>
              </div>
              {canManage
                ? <Select value={m.role} onChange={(v) => run(() => setOrgRole(kind, id, m.id, v), o.roleSaved)} options={roleOpts} size="sm" menuWidth="auto" disabled={pending || lastAdmin} className="w-[210px]" title={lastAdmin ? o.err["last-admin"] : undefined} />
                : <span className="rounded-[8px] bg-bg-2 px-[10px] py-1 text-[11.5px] font-bold text-text">{roles[m.role]}</span>}
              {kind === "agency" && branches.length > 0 && (canManage
                ? <Select value={m.branchId ?? ""} onChange={(v) => run(() => setOrgBranch(kind, id, m.id, v || null))} options={[{ value: "", label: o.noBranch }, ...branches.map((b) => ({ value: b.id, label: b.name }))]} size="sm" menuWidth="auto" disabled={pending} className="w-[170px]" />
                : <span className="text-[12px] text-muted">{branches.find((b) => b.id === m.branchId)?.name ?? o.noBranch}</span>)}
              <span className="rounded-[8px] px-[9px] py-[3px] text-[11px] font-bold" style={{ background: st[0], color: st[1] }}>{m.status === "active" ? t.rl.act : m.status === "paused" ? t.rl.pau : t.rl.pen}</span>
              {!compact && <span className="w-[92px] text-[11.5px] text-muted" title={o.lastSeen}>{fmt(m.lastSeen)}</span>}
              {canManage && <button type="button" disabled={pending || lastAdmin} title={o.remove} onClick={() => void confirmDialog({ text: o.removeQ.replace("{name}", m.name) + (kind === "agency" ? `\n${o.removeHintAgency}` : ""), ok: o.remove, danger: true }).then((ok) => ok && run(() => removeOrgMember(kind, id, m.id), o.removed))} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[9px] text-muted hover:bg-red-tint hover:text-red disabled:opacity-30"><IconTrash size={15} /></button>}
            </div>
          );
        })}
      </div>

      {(invites.length > 0 || canManage) && (
        <div>
          <div className="mb-2 text-[12px] font-bold uppercase tracking-[.06em] text-muted">{o.invites} · {invites.length}</div>
          {invites.length === 0 && <div className="rounded-[12px] border border-dashed border-[#dfe4ec] px-4 py-3 text-[12.5px] text-muted">{o.noInvites}</div>}
          {invites.length > 0 && (
            <div className="overflow-hidden rounded-[14px] border border-line bg-surface">
              {invites.map((i) => (
                <div key={i.code} className="flex flex-wrap items-center gap-3 border-b border-[#f5f7fb] px-4 py-2 text-[13px] last:border-b-0">
                  <IconLink size={15} className="text-muted" />
                  <div className="min-w-[180px] flex-1"><span className="font-semibold text-ink">{i.name || i.email || i.code}</span>{i.name && i.email && <span className="text-muted"> · {i.email}</span>}<div className="text-[11.5px] text-muted">{roles[i.role]} · {fmt(i.createdAt)} · {o.pending}</div></div>
                  <button type="button" onClick={() => copy(i.url)} className={btnS}><IconCopy size={14} /> {copied === i.url ? t.rl.copied : o.copyLink}</button>
                  {canManage && <button type="button" disabled={pending} title={o.cancelInvite} onClick={() => run(() => cancelInvite(i.code))} className="flex h-8 w-8 cursor-pointer items-center justify-center rounded-[9px] text-muted hover:bg-red-tint hover:text-red"><IconX size={15} /></button>}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="text-[12px] leading-[1.5] text-muted">{o.roleHint[kind]}</p>

      {inv && (
        <Modal open onClose={() => setInv(null)} width={520}>
          <div className="mb-3 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{o.inviteT}</div><ModalClose onClick={() => setInv(null)} /></div>
          {inv.url ? (
            <>
              <p className="mb-2 text-[13px] text-text">{inv.mailed ? o.mailed.replace("{email}", inv.email) : inv.email ? o.notMailed : o.linkReady}</p>
              <div className="flex gap-2"><input value={inv.url} readOnly className={`${inp} font-mono text-[12px]`} /><button type="button" onClick={() => copy(inv.url!)} className={btnS}><IconCopy size={14} /> {t.rl.copy}</button></div>
              <div className="mt-4 flex justify-end"><button type="button" onClick={() => setInv(null)} className={btnP}>{t.common.ok ?? "OK"}</button></div>
            </>
          ) : (
            <>
              <p className="mb-3 text-[12.5px] text-muted">{o.inviteS}</p>
              <div className="grid grid-cols-2 gap-3 max-md:grid-cols-1">
                <div><label className={lbl}>{o.name}</label><input value={inv.name} onChange={(e) => setInv({ ...inv, name: e.target.value })} className={inp} placeholder="Ad Soyad" /></div>
                <div><label className={lbl}>{o.email}</label><input type="email" value={inv.email} onChange={(e) => setInv({ ...inv, email: e.target.value })} className={inp} placeholder="user@mail.com" /></div>
                <div><label className={lbl}>{o.role}</label><Select value={inv.role} onChange={(v) => setInv({ ...inv, role: v as OrgRole })} options={roleOpts} /></div>
                <div><label className={lbl}>{o.mailLang}</label><Select value={inv.lang} onChange={(v) => setInv({ ...inv, lang: v as "RU" | "EN" | "TR" })} options={(["RU", "EN", "TR"] as const).map((l) => ({ value: l, label: l }))} /></div>
              </div>
              <p className="mt-2 text-[11.5px] text-muted">{o.inviteHint}</p>
              <div className="mt-4 flex justify-end gap-2">
                <button type="button" onClick={() => setInv(null)} className={btnS}>{t.common.cancel}</button>
                <button type="button" disabled={pending || (!!inv.email && !validMail(inv.email))} onClick={() => run(async () => { const r = await inviteToOrg(kind, id, { email: inv.email || undefined, name: inv.name || undefined, role: inv.role, lang: inv.lang }); setInv({ ...inv, url: r.url, mailed: r.mailed }); })} className={btnP}><IconMailForward size={15} /> {inv.email ? o.sendInvite : o.makeLink}</button>
              </div>
            </>
          )}
        </Modal>
      )}
      {add && (
        <Modal open onClose={() => setAdd(null)} width={480}>
          <div className="mb-3 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{o.addExisting}</div><ModalClose onClick={() => setAdd(null)} /></div>
          <p className="mb-3 text-[12.5px] text-muted">{o.addS[kind]}</p>
          <div className="grid grid-cols-[1fr_200px] gap-3 max-md:grid-cols-1">
            <div><label className={lbl}>{o.email}</label><input type="email" value={add.email} onChange={(e) => setAdd({ ...add, email: e.target.value })} className={inp} placeholder="user@mail.com" autoFocus /></div>
            <div><label className={lbl}>{o.role}</label><Select value={add.role} onChange={(v) => setAdd({ ...add, role: v as OrgRole })} options={roleOpts} /></div>
          </div>
          <div className="mt-4 flex justify-end gap-2">
            <button type="button" onClick={() => setAdd(null)} className={btnS}>{t.common.cancel}</button>
            <button type="button" disabled={pending || !validMail(add.email)} onClick={() => run(async () => { await addOrgMember(kind, id, add.email, add.role); setAdd(null); }, o.added)} className={btnP}><IconUserPlus size={15} /> {o.add}</button>
          </div>
        </Modal>
      )}
    </div>
  );
}
