"use client";

// Shared bits of the «Пользователи» screens (prototype lines 3208–3315): role flags, initials, role chip,
// access-date formatting, autosave badge (`epSave`, 3698), the Companies/People tabs and the row action buttons.
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { IconCloud, IconCloudCheck, IconLoader2, IconPencil, IconUserCheck, IconUserOff } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { ROLECOLOR } from "@/lib/dev/data";
import type { DevLang, DevRole, DevUser } from "@/lib/dev/types";
import { useDev } from "@/store/dev";

/** Company the «admin» role always sees: the user's real company, demo company 1 otherwise (prototype `adminCoId=1`). */
export function useAdminCoId(): number { const { myCoIds } = useDev(); return myCoIds[0] ?? 1; }

/** Derived role flags (spec §2.1). */
export function useRoleFlags() {
  const { viewRole } = useDev();
  const isAdminView = viewRole === "admin";
  return {
    role: viewRole as DevRole,
    isAdminView,
    canManageUsers: viewRole === "superadmin" || viewRole === "admin",
    canEditAccess: viewRole === "superadmin",
    showUsersTabs: viewRole === "superadmin",
    showCoBack: !isAdminView,
    ufShowCompanies: !isAdminView,
    profCanCompany: viewRole === "superadmin" || viewRole === "admin",
  };
}

/** editor/client never see the section — the prototype switches them to «objects» (line 3312). */
export function useUsersGuard() {
  const router = useRouter();
  const { viewRole } = useDev();
  const blocked = viewRole === "editor" || viewRole === "client";
  useEffect(() => { if (blocked) router.replace("/dev/objects"); }, [blocked, router]);
  return blocked;
}

export const inits = (n: string) => (n || "").split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();

/** `fmtUntil` (3221): locale short date by UI language. */
export function fmtUntil(iso: string, lang: DevLang): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(lang === "TR" ? "tr-TR" : lang === "EN" ? "en-GB" : "ru-RU", { day: "2-digit", month: "short", year: "numeric" });
}

export const emailOk = (v: string) => /.+@.+\..+/.test((v || "").trim());

/** Password generator `Xxxx-xxxx12` (prototype `profGen` / `genPass`, 3218 / 3345). */
export function genPassword(): string {
  const cons = "bcdfghjkmnpqrstvwxz", vow = "aeiou", dig = "23456789";
  const pick = (s: string) => s[Math.floor(Math.random() * s.length)];
  let p = "";
  for (let i = 0; i < 2; i++) p += pick(cons) + pick(vow);
  p = p.charAt(0).toUpperCase() + p.slice(1) + "-";
  for (let i = 0; i < 2; i++) p += pick(cons) + pick(vow);
  return p + pick(dig) + pick(dig);
}

export function copyText(v: string) {
  try { if (navigator.clipboard) void navigator.clipboard.writeText(v); } catch {}
}

/** Role chip (`roleStyleF`, 3209). */
export function RoleChip({ role }: { role: DevUser["role"] }) {
  const { t } = useDevT();
  const [fg, bg] = ROLECOLOR[role];
  return <span className="whitespace-nowrap rounded-[6px] px-[9px] py-[3px] text-[12px] font-semibold" style={{ background: bg, color: fg }}>{(t.roles as Record<string, string>)[role]}</span>;
}

export function InactiveBadge({ label }: { label: string }) {
  return <span className="ml-1 rounded-[6px] bg-red-tint px-[7px] py-[2px] text-[11px] font-bold text-[#dc2626]">{label}</span>;
}

/** Row buttons «Изменить» / «Отключить|Включить» (`uActions`, 3226). */
export function UserRowActions({ user, size = 34, onEdit, onToggle }: { user: DevUser; size?: 32 | 34; onEdit: () => void; onToggle: () => void }) {
  const { t } = useDevT();
  const off = user.active === false;
  const base = `inline-flex cursor-pointer items-center justify-center border border-line ${size === 34 ? "h-[34px] w-[34px] rounded-[9px]" : "h-8 w-8 rounded-[8px]"}`;
  return (
    <div className="flex flex-none gap-[6px]">
      <button type="button" onClick={onEdit} title={t.co.edit_user} className={`${base} text-text-2 hover:border-blue hover:text-blue`}><IconPencil size={17} /></button>
      <button type="button" onClick={onToggle} title={off ? t.co.activate : t.co.deactivate} className={`${base} hover:border-[#cdd7ea]`} style={{ color: off ? "#0f9d6b" : "#dc2626" }}>
        {off ? <IconUserCheck size={17} /> : <IconUserOff size={17} />}
      </button>
    </div>
  );
}

/** Companies / People tabs (`usersTabs`, 3300) — superadmin only. */
export function UsersTabs({ active }: { active: "companies" | "people" }) {
  const { t } = useDevT();
  const tab = (key: "companies" | "people", href: string, label: string) => (
    <Link key={key} href={href} className={`cursor-pointer whitespace-nowrap rounded-[9px] border px-4 py-2 text-[13.5px] font-bold ${active === key ? "border-ink bg-ink text-white" : "border-line bg-surface text-text-2"}`}>{label}</Link>
  );
  return <div className="mb-5 flex flex-wrap gap-2">{tab("companies", "/dev/users", t.co.tab_companies)}{tab("people", "/dev/users/people", t.co.tab_people)}</div>;
}

/** Autosave pill (`epSave`, 3698): autosave · saving… · saved · HH:MM. */
export function SaveBadge() {
  const { t } = useDevT();
  const { save } = useDev();
  const saving = save === "saving";
  const saved = !!save && !saving;
  const label = saving ? t.edp.saving : saved ? `${t.edp.saved} · ${save}` : t.edp.autosave;
  return (
    <span className={`inline-flex items-center gap-[6px] whitespace-nowrap rounded-[20px] px-3 py-[7px] text-[12px] font-semibold ${saved ? "bg-green-tint text-green" : "bg-bg-2 text-muted"}`}>
      {saving ? <IconLoader2 size={15} style={{ animation: "opl-spin 1s linear infinite" }} /> : saved ? <IconCloudCheck size={15} /> : <IconCloud size={15} />}{label}
    </span>
  );
}

/** Dark primary button (`#14243f`, radius 11, 11×17 padding). */
export function DarkButton({ onClick, children, small = false }: { onClick: () => void; children: ReactNode; small?: boolean }) {
  return (
    <button type="button" onClick={onClick} className={`inline-flex flex-none cursor-pointer items-center gap-[7px] border border-ink bg-ink font-semibold text-white hover:bg-[#0f1b30] ${small ? "gap-[6px] rounded-[10px] px-[15px] py-[9px] text-[13.5px]" : "rounded-[11px] px-[17px] py-[11px] text-[14px]"}`}>{children}</button>
  );
}

/** Search field with the leading magnifier (list screens). */
export function SearchInput({ value, onChange, placeholder, className = "" }: { value: string; onChange: (v: string) => void; placeholder: string; className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <svg className="pointer-events-none absolute left-[13px] top-1/2 -translate-y-1/2 text-muted" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="10" cy="10" r="7" /><path d="m21 21-6-6" /></svg>
      <input value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} className="w-full rounded-[11px] border border-line bg-surface py-[11px] pl-[38px] pr-[13px] text-[14px] outline-none focus:border-blue" />
    </div>
  );
}
