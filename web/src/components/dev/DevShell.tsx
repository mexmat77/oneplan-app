"use client";

// Developer-cabinet shell — prototype `OnePlan v2.dc.html` lines 183–262 (header, notification dropdown,
// mobile nav sheet, object sub-tabs) and 1251–1264 (demo role switch). Spec: docs/prototype-developer-spec.md §1.4.
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { IconAddressBook,
  IconArrowLeft, IconArrowRight, IconBell, IconBellOff, IconBuildingCommunity, IconChecks, IconLayoutDashboard, IconMenu2,
  IconMessageCircle, IconSettings, IconUser, IconUsers, IconX,
} from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { useEscape, useScrollLock } from "@/hooks/useScrollLock";
import { CHAT_PEERS, DM_UNREAD } from "@/lib/dev/data";
import { agoText, buildNotifs } from "@/lib/dev/notifs";
import { nowMs, renderNtf, useNotifs, type NtfDict } from "@/lib/notifications/client";
import { useI18n } from "@/i18n/provider";
import { NtfIcon } from "@/components/ntf/NtfIcon";
import type { DevRole } from "@/lib/dev/types";
import { initViewRole, markNotifRead, setCurrentUserName, setViewRole, syncRealCompanies, useDev, type RealCompany } from "@/store/dev";
import { startDevSync } from "@/store/devRemote";
import { DevIcon } from "./DevIcon";
import { LogoMark } from "@/components/Logo";
import { UserMenu } from "@/components/ui/UserMenu";
import { useChatUnread } from "@/lib/chat/client";
import { createClient } from "@/lib/supabase/client";

export type DevMe = { name: string; role: DevRole; platformAdmin: boolean; companies: RealCompany[]; myCompanies: string[] | "all"; adminN?: number; email?: string; avatar?: string | null; id?: string | null; supportId?: string | null };

export function DevShell({ me, children }: { me: DevMe; children: ReactNode }) {
  const { t, tt, lang, setLang } = useDevT();
  const path = usePathname();
  const router = useRouter();
  const s = useDev();
  const [notifOpen, setNotifOpen] = useState(false);
  const [sheet, setSheet] = useState(false);
  const [demoOpen, setDemoOpen] = useState(false);
  useScrollLock(sheet);
  useEscape(notifOpen, () => setNotifOpen(false));
  useEscape(sheet, () => setSheet(false));
  // Real role from Supabase seeds the view role once; platform admins may switch it with the demo widget.
  // (тоже в эффекте: при первом входе не-админа пишет роль в стор; сам экран роль не-админа берёт из `me.role`, не из стора)
  useEffect(() => { initViewRole(me.role, me.platformAdmin); }, [me.role, me.platformAdmin]);
  // Имя автора записей журнала. В эффекте, а не при рендере: функция дописывает автора в старые записи и уведомляет
  // подписчиков стора — во время отрисовки это давало «Cannot update a component while rendering a different component».
  useEffect(() => { setCurrentUserName(me.name); }, [me.name]);
  // Supabase developers → company list of the cabinet (store mutation, not React state).
  useEffect(() => {
    if (me.companies.length || me.myCompanies !== "all") syncRealCompanies(me.companies, me.myCompanies);
    // объекты компаний пользователя — из Supabase (поверх localStorage); без сессии синхронизация не включается
    void startDevSync(me.myCompanies);
  }, [me.companies, me.myCompanies]);
  const role = me.platformAdmin ? s.viewRole : me.role;
  const canManageUsers = role === "superadmin" || role === "admin";

  const live = useNotifs(me.id ?? null);
  const { t: tr } = useI18n();
  const liveViews = live.rows.map((r) => renderNtf(r, tr.ntfk as unknown as NtfDict));
  // Реальные уведомления (Supabase) у вошедшего пользователя; демо прототипа — только без аккаунта.
  const notifs = me.id
    ? liveViews.map((v) => ({ id: v.id, type: v.kind, mins: Math.floor((nowMs() - v.at.getTime()) / 60000), who: "", init: "", color: "", icon: v.icon, iconFg: v.tone, iconBg: v.bg, ev: v.title, obj: v.sub, unit: "", extra: "", ago: agoText(Math.floor((nowMs() - v.at.getTime()) / 60000), tt), unread: v.unread, href: v.href }))
    : buildNotifs(tt, s.notifReadIds, s.notifCleared).map((n) => ({ ...n, href: null as string | null }));
  const readNotifs = (ids: number[]) => { if (me.id) void live.markRead(ids); else markNotifRead(ids); };
  const unread = notifs.filter((n) => n.unread).length;
  const liveUnread = useChatUnread(me.id ?? null, me.supportId ?? "", me.platformAdmin);
  const dmUnread = me.id ? liveUnread : CHAT_PEERS.reduce((n, p) => n + ((DM_UNREAD[p.id] || 0) && !s.dmOpened.includes(String(p.id)) ? 1 : 0), 0);
  const is = (p: string) => path === p || path.startsWith(p + "/");
  const objMatch = path.match(/^\/dev\/objects\/(\d+)(?:\/(\w+))?/);
  const roles = t.roles as Record<string, string>;

  const navCls = (on: boolean) => `flex flex-none cursor-pointer items-center gap-[7px] whitespace-nowrap border-b-2 py-[6px] text-[15px] ${on ? "border-blue font-semibold text-ink" : "border-transparent font-normal text-ink-2"}`;
  const iconBtn = (on = false) => `relative flex h-[38px] w-[38px] flex-none cursor-pointer items-center justify-center rounded-[11px] border text-[19px] hover:border-blue hover:text-blue ${on ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-text"}`;
  const badge = (n: number) => n > 0 && <span className="absolute -right-[6px] -top-[6px] flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] border-2 border-surface bg-red px-1 text-[11px] font-semibold text-white [font-variant-numeric:tabular-nums]">{n}</span>;
  const langBtn = (lg: "RU" | "EN" | "TR", big = false) => (
    <button key={lg} type="button" onClick={() => setLang(lg)} className={`cursor-pointer rounded-[7px] text-[12px] font-bold ${lang === lg ? "bg-surface text-ink shadow-[0_1px_2px_rgba(20,36,63,.12)]" : "text-muted"} ${big ? "rounded-[11px] bg-bg-2 px-[22px] py-3 text-[15px]" : "px-[9px] py-[5px]"}`}>{lg}</button>
  );
  const logo = (
    <Link href="/dev/objects" className="flex flex-none items-center gap-[9px] text-[18px] font-extrabold text-ink">
      <LogoMark size={26} /> OnePlan
    </Link>
  );
  const go = (href: string) => { setSheet(false); router.push(href); };
  // Переключатель рабочих пространств для админа платформы — тот же, что в шапке риэлторов (`TopBar`): база риэлторов ·
  // кабинет застройщиков · управление. Без него из /dev нельзя было вернуться назад иначе как кнопкой браузера.
  const spaces: { key: "realtors" | "dev" | "admin"; href: string; label: string; Icon: typeof IconUsers; badge?: number }[] = [
    { key: "realtors", href: "/catalog", label: t.ws_realtors, Icon: IconUsers },
    { key: "dev", href: "/dev", label: t.ws_dev, Icon: IconBuildingCommunity },
    { key: "admin", href: "/admin/requests", label: t.ws_admin, Icon: IconSettings, badge: me.adminN },
  ];
  const miniBadge = (n?: number) => !!n && <span className="ml-[2px] inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] bg-red px-1 text-[10px] font-bold text-white">{n}</span>;
  const subtabs: [string, string][] = [["main", t.tab_main], ["plans", t.tab_plans], ["io", t.tab_io], ["log", t.tab_log], ["set", t.tab_set]];
  // мобильное меню — в том же стиле, что у риэлтора (16.10.2026): группа рабочих пространств сверху, строки 13.5px, язык внизу
  const menu: { icon: ReactNode; label: string; badge?: number; active?: boolean; onClick: () => void }[] = [
    { icon: <IconLayoutDashboard size={17} />, label: t.nav_dashboard, active: path === "/dev", onClick: () => go("/dev") },
    { icon: <IconBuildingCommunity size={17} />, label: t.nav_objects, active: is("/dev/objects"), onClick: () => go("/dev/objects") },
    ...(canManageUsers ? [{ icon: <IconUsers size={17} />, label: t.nav_users, active: is("/dev/users"), onClick: () => go("/dev/users") }] : []),
    { icon: <IconAddressBook size={17} />, label: t.nav_crm, active: is("/dev/crm"), onClick: () => go("/dev/crm") },
    { icon: <IconMessageCircle size={17} />, label: tt.chat, badge: dmUnread, active: is("/dev/chat"), onClick: () => go("/dev/chat") },
    { icon: <IconBell size={17} />, label: tt.notif, badge: unread, onClick: () => { setSheet(false); setNotifOpen(true); } },
    { icon: <IconUser size={17} />, label: t.prof_title, active: is("/dev/profile"), onClick: () => go("/dev/profile") },
  ];
  const roleChip = (r: DevRole) => `cursor-pointer whitespace-nowrap rounded-[8px] border px-[11px] py-[6px] text-[12px] font-bold ${s.viewRole === r ? "border-blue bg-blue text-white" : "border-dark-3 bg-transparent text-[#c7d0e0]"}`;

  return (
    <div data-dev="1">
      <header className="flex min-h-[62px] flex-wrap items-center gap-[clamp(10px,3vw,30px)] gap-y-[6px] border-b border-line bg-surface px-[clamp(14px,4vw,28px)] py-2">
        {logo}
        {me.platformAdmin && (
          <div className="flex shrink-0 gap-[2px] rounded-[9px] bg-bg-2 p-[3px] max-md:hidden">
            {spaces.map(({ key, href, label, Icon, badge }) => (
              <Link key={key} href={href} title={label} className={`flex h-[26px] items-center gap-[4px] rounded-[7px] px-[8px] text-[11px] font-extrabold uppercase tracking-[.04em] ${key === "dev" ? "bg-surface text-blue shadow-[0_1px_3px_rgba(20,36,63,.12)]" : "text-muted hover:bg-line-2"}`}>
                <Icon size={13} /><span className="max-[1560px]:hidden">{label}</span>{miniBadge(badge)}
              </Link>
            ))}
          </div>
        )}
        <Link href="/dev" className={`${navCls(path === "/dev")} max-md:hidden`}><IconLayoutDashboard size={17} /> {t.nav_dashboard}</Link>
        <Link href="/dev/objects" className={`${navCls(is("/dev/objects"))} max-md:hidden`}><IconBuildingCommunity size={17} /> {t.nav_objects}</Link>
        {canManageUsers && <Link href="/dev/users" className={`${navCls(is("/dev/users"))} max-md:hidden`}><IconUsers size={17} /> {t.nav_users}</Link>}
        <Link href="/dev/crm" className={`${navCls(is("/dev/crm"))} max-md:hidden`}><IconAddressBook size={17} /> {t.nav_crm}</Link>
        <div className="min-w-2 flex-1" />
        <Link href="/dev/chat" title={tt.chat} className={`${iconBtn(is("/dev/chat"))} max-md:hidden`}><IconMessageCircle size={19} />{badge(dmUnread)}</Link>
        <button type="button" onClick={() => setNotifOpen((v) => !v)} title={tt.notif} className={`${iconBtn()} max-md:h-10 max-md:w-10 max-md:text-ink`}><IconBell size={19} />{badge(unread)}</button>
        <div className="flex flex-none gap-1 rounded-[9px] bg-bg-2 p-[3px] max-md:hidden">{(["RU", "EN", "TR"] as const).map((lg) => langBtn(lg))}</div>
        <UserMenu className="max-md:hidden" name={me.name} sub={roles[role]} email={me.email} avatar={me.avatar} logoutLabel={t.btn_logout}
          items={[{ label: t.prof_title, href: "/dev/profile", icon: <IconUser size={16} /> }, { label: tt.notif, href: "/dev/notifications", icon: <IconBell size={16} />, badge: unread }, { label: tt.chat, href: "/dev/chat", icon: <IconMessageCircle size={16} />, badge: dmUnread }]}
          onLogout={async () => { try { await createClient().auth.signOut(); } catch {} window.location.assign("/login"); }} />
        <button type="button" onClick={() => setSheet(true)} className="flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-[11px] border border-line bg-surface text-[19px] text-ink md:hidden" aria-label={t.nav_objects}><IconMenu2 size={19} /></button>
      </header>

      {/* Object sub-tabs (prototype lines 257–262) */}
      {objMatch && (
        <div className="sticky top-0 z-[49] flex h-[50px] items-center gap-[clamp(14px,2vw,24px)] overflow-x-auto border-b border-line bg-surface px-[clamp(14px,4vw,28px)]">
          <Link href="/dev/objects" className="inline-flex flex-none items-center gap-[6px] text-[13px] text-text-2"><IconArrowLeft size={14} /> {t.back_objects}</Link>
          {subtabs.map(([k, label]) => {
            const href = k === "main" ? `/dev/objects/${objMatch[1]}` : `/dev/objects/${objMatch[1]}/${k}`;
            const on = (objMatch[2] ?? "main") === k;
            return <Link key={k} href={href} className={`flex-none whitespace-nowrap border-b-2 py-[3px] text-[15px] ${on ? "border-blue font-semibold text-ink" : "border-transparent text-ink-2"}`}>{label}</Link>;
          })}
        </div>
      )}

      <main className="mx-auto max-w-[1500px] px-[clamp(14px,4vw,28px)] pb-[60px] pt-[clamp(16px,3vw,26px)] max-md:px-2 max-md:pb-14 max-md:pt-[10px]">{children}</main>

      {/* Notification dropdown (prototype lines 203–240) */}
      {notifOpen && (
        <>
          <div className="fixed inset-0 z-160 bg-[rgba(14,23,42,.14)]" onClick={() => setNotifOpen(false)} />
          <div className="fixed right-[clamp(10px,3vw,26px)] top-[70px] z-161 flex max-h-[78vh] w-[min(392px,94vw)] flex-col overflow-hidden rounded-[16px] border border-line bg-surface shadow-[0_26px_70px_rgba(20,36,63,.24)]" style={{ animation: "opl-bg .16s ease" }}>
            <div className="flex flex-none items-center gap-[9px] border-b border-line-2 px-4 py-[14px]">
              <IconBell size={18} className="text-blue" />
              <div className="text-[15px] font-extrabold text-ink">{tt.notif}</div>
              {unread > 0 && <span className="rounded-[8px] bg-red px-2 py-[2px] text-[11px] font-bold text-white [font-variant-numeric:tabular-nums]">{unread} {tt.notif_new_c}</span>}
              <div className="flex-1" />
              <button type="button" onClick={() => readNotifs(notifs.map((n) => n.id))} title={tt.notif_all} className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-[8px] text-muted hover:bg-blue-tint hover:text-blue"><IconChecks size={17} /></button>
              <button type="button" onClick={() => setNotifOpen(false)} className="flex h-[30px] w-[30px] cursor-pointer items-center justify-center rounded-[8px] text-muted hover:bg-bg-4"><IconX size={17} /></button>
            </div>
            <div className="flex-1 overflow-y-auto p-[6px]">
              {notifs.slice(0, 7).map((n) => (
                <div key={n.id} onClick={() => { readNotifs([n.id]); if (n.href) { setNotifOpen(false); router.push(n.href); } }} className="flex cursor-pointer items-start gap-[11px] rounded-[12px] px-[10px] py-[10px] hover:bg-[#f7f9fc]" style={{ background: n.unread ? "#f5f8ff" : undefined }}>
                  <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] text-[17px]" style={{ background: n.iconBg, color: n.iconFg }}>{me.id ? <NtfIcon icon={n.icon} /> : <DevIcon icon={n.icon} />}</span>
                  <div className="min-w-0 flex-1">
                    <div className="text-[13.5px] leading-[1.45] text-[#3c4759]">{n.who && <b className="text-ink">{n.who} </b>}{n.ev} {n.obj && <b className="text-ink">{n.obj}</b>} {n.unit}{n.extra}</div>
                    <div className="mt-[3px] text-[11.5px] text-[#98a1af]">{n.ago}</div>
                  </div>
                  {n.unread && <span className="mt-[6px] h-2 w-2 flex-none rounded-full bg-blue" />}
                </div>
              ))}
              {notifs.length === 0 && (
                <div className="px-5 py-[34px] text-center text-[#98a1af]">
                  <span className="mx-auto mb-3 flex h-[52px] w-[52px] items-center justify-center rounded-full bg-blue-tint text-[24px] text-blue"><IconBellOff size={24} /></span>
                  <div className="text-[14px] font-bold text-ink">{tt.notif_none}</div>
                </div>
              )}
            </div>
            <div className="flex flex-none items-center gap-2 border-t border-line-2 px-3 py-[9px]">
              <button type="button" onClick={() => readNotifs(notifs.map((n) => n.id))} className="cursor-pointer rounded-[9px] px-[10px] py-[7px] text-[12.5px] font-bold text-muted hover:bg-bg-4 hover:text-ink">{tt.notif_all}</button>
              <div className="flex-1" />
              <button type="button" onClick={() => { setNotifOpen(false); router.push("/dev/notifications"); }} className="inline-flex cursor-pointer items-center gap-[5px] rounded-[9px] px-3 py-[7px] text-[12.5px] font-bold text-blue hover:bg-blue-tint">{tt.notif_show_all} <IconArrowRight size={14} /></button>
            </div>
          </div>
        </>
      )}

      {/* Mobile nav sheet — карточка как у риэлтора (TopBar, kebab) */}
      {sheet && (
        <>
          <div className="fixed inset-0 z-[149] bg-[rgba(10,16,28,.25)]" onClick={() => setSheet(false)} />
          <div data-kebab-menu="1" className="fixed right-[10px] top-[60px] z-150 w-[252px] rounded-[16px] border border-line bg-surface p-2 shadow-[0_24px_60px_rgba(20,36,63,.2)]" style={{ animation: "opl-card .18s ease" }}>
            <div className="flex items-center gap-2 px-[10px] pb-[10px] pt-1">
              <span className="flex-1 text-[15px] font-extrabold text-ink">{tr.common.menu}</span>
              <button type="button" onClick={() => setSheet(false)} className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[11px] bg-bg-2 text-[20px] text-text hover:brightness-95" aria-label="Close"><IconX size={20} /></button>
            </div>
            {me.platformAdmin && (
              <div className="mb-[6px] border-b border-line-2 pb-[6px]">
                {spaces.map(({ key, href, label, Icon, badge }) => (
                  <Link key={key} href={href} onClick={() => setSheet(false)} className={`flex items-center gap-[11px] rounded-[10px] px-[10px] py-3 text-[13.5px] font-semibold ${key === "dev" ? "bg-blue-tint text-blue-2" : "text-ink"}`}><Icon size={17} /><span className="flex-1">{label}</span>{miniBadge(badge)}</Link>
                ))}
              </div>
            )}
            <div data-kebab-rows="1">
              {menu.map((m) => (
                <div key={m.label} onClick={m.onClick} className={`flex cursor-pointer items-center gap-[11px] rounded-[10px] px-[10px] py-3 text-[13.5px] font-semibold hover:brightness-95 ${m.active ? "bg-blue-tint text-blue-2" : "text-ink"}`}>
                  {m.icon}<span className="flex-1">{m.label}</span>
                  {!!m.badge && <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] bg-red px-1 text-[10px] font-bold text-white">{m.badge}</span>}
                </div>
              ))}
            </div>
            <div className="mx-[2px] my-[6px] border-t border-line-2" />
            <div data-kebab-lang="1" className="mx-1 mb-[2px] mt-1 flex gap-1 rounded-[11px] bg-bg-2 p-1">{(["RU", "EN", "TR"] as const).map((lg) => <button key={lg} type="button" onClick={() => setLang(lg)} className={`flex-1 cursor-pointer rounded-[9px] py-[7px] text-[13px] font-bold ${lang === lg ? "bg-surface text-ink shadow-[0_1px_2px_rgba(20,36,63,.12)]" : "text-muted"}`}>{lg}</button>)}</div>
          </div>
        </>
      )}

      {/* Demo role switch (prototype lines 1251–1264) — platform admins only */}
      {me.platformAdmin && (
        <div className="fixed bottom-[14px] left-[14px] z-120 flex flex-col items-start gap-2">
          {demoOpen ? (
            <div className="w-[min(280px,84vw)] rounded-[14px] bg-ink p-[12px_13px] shadow-[0_18px_44px_rgba(20,36,63,.32)]" style={{ padding: "12px 13px" }}>
              <div className="mb-[9px] flex items-center gap-[7px]"><span className="rounded-[5px] bg-red px-[6px] py-[2px] text-[10px] font-extrabold tracking-[.1em] text-white">DEMO</span><span className="text-[12.5px] font-bold text-white">{tt.demo_role}</span><span className="flex-1" /><button type="button" onClick={() => setDemoOpen(false)} className="flex cursor-pointer text-[16px] text-dark-muted"><IconX size={16} /></button></div>
              <div className="flex flex-wrap gap-[5px]">
                {(["superadmin", "admin", "editor", "client"] as DevRole[]).map((r) => (
                  <button key={r} type="button" className={roleChip(r)} onClick={() => { setViewRole(r); if ((r === "editor" || r === "client") && is("/dev/users")) router.push("/dev/objects"); }}>{roles[r]}</button>
                ))}
              </div>
              <div className="mt-[9px] text-[11px] leading-[1.4] text-dark-muted">{tt.demo_hint}</div>
            </div>
          ) : (
            <button type="button" onClick={() => setDemoOpen(true)} title={tt.demo_role} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[11px] bg-ink px-3 py-2 text-[12px] font-bold text-white shadow-[0_12px_30px_rgba(20,36,63,.28)]"><span className="rounded-[4px] bg-red px-[5px] py-[2px] text-[9px] font-extrabold tracking-[.08em]">DEMO</span> {roles[s.viewRole]}</button>
          )}
        </div>
      )}
    </div>
  );
}
