"use client";

// Top bar — prototype lines 181–221 (topbar, kebab menu, notifications dropdown).
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type ComponentType } from "react";
import {
  IconAddressBook, IconApi, IconBell, IconBookmark, IconBuilding, IconBuildingCommunity, IconFlag, IconFolders, IconGlobe, IconHeart, IconHome2, IconInbox, IconLayoutDashboard, IconMenu2, IconMessageCircle, IconSettings, IconUser, IconUsers, IconX, type IconProps,
} from "@tabler/icons-react";
import { Logo } from "./Logo";
import { UserMenu } from "@/components/ui/UserMenu";
import { createClient } from "@/lib/supabase/client";
import { useCatUi } from "@/store/catalogUi";
import { LangSwitch } from "./LangSwitch";
import { NtfIcon } from "./ntf/NtfIcon";
import { useI18n } from "@/i18n/provider";
import { useBackClose, useEscape, useScrollLock } from "@/hooks/useScrollLock";
import { markAllRead, useNotifications } from "@/store/ntf";
import { renderNtf, useNotifs, type NtfDict } from "@/lib/notifications/client";

type Item = { href: string; label: string; Icon: ComponentType<IconProps>; badge?: number; active: boolean };
export type Workspace = "realtors" | "dev" | "admin";

function Badge({ n }: { n?: number }) {
  if (!n) return null;
  return <span className="ml-[2px] inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] bg-red px-1 text-[10px] font-bold text-white">{n}</span>;
}

// Which nav item is lit on /obj/* depends on where the object was opened from (prototype `prevScreen`).
const noSub = () => () => {};
const readPrev = () => { try { return sessionStorage.getItem("opl-prev-screen") || ""; } catch { return ""; } };
function usePrevScreen(path: string) {
  const prev = useSyncExternalStore(noSub, readPrev, () => "");
  return path.startsWith("/obj/") ? prev : "";
}

export function TopBar({ name, isAdmin = false, favsN = 0, reqsN = 0, ntfN = 0, adminN = 0, adminReqN = 0, adminRepN = 0, chatUnread = false, workspace = "realtors", hidden = false, email, avatar, sub, meId = null }: {
  name: string; isAdmin?: boolean; favsN?: number; reqsN?: number; ntfN?: number; adminN?: number; adminReqN?: number; adminRepN?: number; chatUnread?: boolean; workspace?: Workspace; hidden?: boolean; email?: string; avatar?: string | null; sub?: string; meId?: string | null;
}) {
  const { t, lang } = useI18n();
  const path = usePathname();
  const { setView } = useCatUi(); // «База объектов» в меню всегда открывает список, даже если была карта (16.10.2026)
  const router = useRouter();
  const [menu, setMenu] = useState(false);
  const [ntfOpen, setNtfOpen] = useState(false);
  const { items: ntfItems } = useNotifications(); // демо прототипа — только без аккаунта
  const live = useNotifs(meId); // общая подписка с AppChrome и страницей /ntf
  const prev = usePrevScreen(path);
  const is = (p: string) => path === p || path.startsWith(p + "/");
  useScrollLock(menu || ntfOpen);
  useEscape(menu, () => setMenu(false));
  useBackClose(menu, () => setMenu(false));
  useEscape(ntfOpen, () => setNtfOpen(false));

  const isObj = is("/obj");
  const items: Item[] = [
    { href: "/catalog", label: t.nav.cat, Icon: IconGlobe, active: is("/catalog") || is("/newb") || (isObj && (!prev || prev === "catalog" || prev === "newb")) },
    { href: "/mine", label: t.nav.mine, Icon: IconHome2, active: is("/mine") || is("/add") || (isObj && (prev === "mine" || prev === "add")) },
    { href: "/favs", label: t.nav.favs, Icon: IconHeart, badge: favsN, active: is("/favs") || (isObj && prev === "favs") },
    { href: "/sels", label: t.nav.sels, Icon: IconFolders, active: is("/sels") },
    { href: "/reqs", label: t.nav.reqs, Icon: IconBookmark, badge: reqsN, active: is("/reqs") },
    { href: "/crm", label: t.nav.crm, Icon: IconAddressBook, active: is("/crm") },
    // «Команда и филиалы» — для риэлтора в иконках панели и в меню аватара (13.10.2026: администратор агентства не нашёл раздел,
    // ссылка жила только в меню «⋮»)
    ...(!isAdmin && workspace === "realtors" ? [{ href: "/team", label: t.org.team.title, Icon: IconBuilding, active: is("/team") }] : []),
  ];

  // Admin workspace switcher (platform extension): realtors base · developers cabinet · administration.
  const L = (ru: string, en: string, tr: string) => (lang === "RU" ? ru : lang === "TR" ? tr : en);
  // `badge` у «Управления» — необработанные заявки (новые запросы доступа + заявки с главной), считает сервер (`countPendingRequests`).
  const spaces: { key: Workspace; href: string; label: string; Icon: ComponentType<IconProps>; badge?: number }[] = [
    { key: "realtors", href: "/catalog", label: t.nav.rls, Icon: IconUsers }, // «Риэлторы» обычным регистром: капс (t.common.tag) — только бейдж у логотипа (16.10.2026)
    { key: "dev", href: "/dev", label: L("Застройщики", "Developers", "Geliştiriciler"), Icon: IconBuildingCommunity },
    { key: "admin", href: "/admin/requests", label: L("Управление", "Admin", "Yönetim"), Icon: IconSettings, badge: adminN },
  ];
  const devItems: Item[] = [{ href: "/dev", label: L("Проекты", "Projects", "Projeler"), Icon: IconBuildingCommunity, active: is("/dev") }];
  // разделы «Управления» — в той же навигации и в том же мобильном меню, что у остальных кабинетов (18.10.2026, «если зайти в
  // управление, меню меняется и путается»): раньше для admin navItems был пуст, вкладки жили только на странице
  const adminItems: Item[] = [
    { href: "/admin/users", label: L("Пользователи", "Users", "Kullanıcılar"), Icon: IconUsers, active: is("/admin/users") },
    { href: "/admin/requests", label: L("Заявки", "Requests", "Başvurular"), Icon: IconInbox, badge: adminReqN, active: is("/admin/requests") },
    { href: "/admin/companies", label: L("Организации", "Organizations", "Kuruluşlar"), Icon: IconBuilding, active: is("/admin/companies") },
    { href: "/admin/reports", label: L("Жалобы", "Reports", "Şikayetler"), Icon: IconFlag, badge: adminRepN, active: is("/admin/reports") },
  ];
  const navItems = workspace === "realtors" ? items : workspace === "dev" ? devItems : [];
  // Меню кабинетов (18.10.2026, «из Управления не попасть в Мои объекты и CRM»): как у HubSpot/Shopify переключатель контекста
  // раскрывает разделы своего кабинета — один клик из любого места; на телефоне у админа в «Управлении» все три кабинета группами.
  const devMenu: Item[] = [
    { href: "/dev", label: L("Дашборд", "Dashboard", "Panel"), Icon: IconLayoutDashboard, active: is("/dev") && !is("/dev/") },
    { href: "/dev/objects", label: L("Объекты", "Objects", "Projeler"), Icon: IconBuildingCommunity, active: is("/dev/objects") },
    { href: "/dev/users", label: L("Пользователи", "Users", "Kullanıcılar"), Icon: IconUsers, active: is("/dev/users") },
    { href: "/dev/crm", label: "CRM", Icon: IconAddressBook, active: is("/dev/crm") },
  ];
  const spaceMenu: Record<Workspace, Item[]> = { realtors: items, dev: devMenu, admin: adminItems };
  // Kebab rows — prototype order (line 3753): catalog, mine, favs, sels, reqs, api, billing, then rls for admins.
  // гамбургер = навигация по разделам текущего кабинета; «API и выгрузка» — в меню аватара, кабинеты админа — пилюлями выше
  // (18.10.2026, «два меню путают, пункты дублируются»)
  const kebabRows: Item[] = [...navItems];
  const iconBtn = "relative flex h-[38px] w-[38px] shrink-0 cursor-pointer items-center justify-center rounded-[11px] border border-line bg-surface text-[18px] text-text transition hover:border-blue hover:text-blue";
  const ntfDict = t.ntfk as unknown as NtfDict;
  // с аккаунтом — реальные уведомления (13.10.2026, «давай уберём все тестовые сообщения»), демо — только без Supabase
  const ntfTop = meId
    ? live.rows.slice(0, 5).map((r) => { const v = renderNtf(r, ntfDict); return { id: v.id, unread: v.unread, bg: v.bg, tone: v.tone, icon: v.icon, title: v.title, sub: v.sub, time: v.at.toLocaleTimeString(lang === "RU" ? "ru-RU" : lang === "TR" ? "tr-TR" : "en-GB", { hour: "2-digit", minute: "2-digit" }), href: v.href }; })
    : ntfItems.slice(0, 4).map((n) => ({ id: n.id, unread: n.unread, bg: n.bg, tone: n.tone, icon: n.icon, title: n.tx[lang][0], sub: n.tx[lang][1], time: n.time, href: null as string | null }));
  const ntfMarkAll = () => { if (meId) void live.markAll(); else markAllRead(); };

  return (
    <>
      <header data-topbar="1" data-admin={isAdmin ? "1" : "0"} data-hdr-hidden={hidden ? "1" : "0"} className="sticky top-0 z-100 flex min-h-[62px] flex-wrap items-center gap-[clamp(8px,2vw,16px)] gap-y-[6px] border-b border-line bg-surface px-[clamp(14px,4vw,28px)] py-2">
        <Link href="/catalog" className="flex shrink-0 items-center gap-[9px] hover:brightness-95">
          <Logo />
          {!isAdmin && <span data-brand-tag="1" className="rounded-[16px] bg-blue-tint px-[9px] py-[3px] text-[10.5px] font-bold tracking-[.02em] text-blue">{t.common.tag}</span>}
        </Link>
        {isAdmin && (
          <div className="flex shrink-0 gap-[2px] rounded-[9px] bg-bg-2 p-[3px] max-md:hidden">
            {spaces.map(({ key, href, label, Icon, badge }) => (
              <div key={key} className="group relative">
                <Link href={href} title={label} className={`flex h-[26px] items-center gap-[4px] rounded-[7px] px-[8px] text-[11px] font-extrabold uppercase tracking-[.04em] ${workspace === key ? "bg-surface text-blue shadow-[0_1px_3px_rgba(20,36,63,.12)]" : "text-muted hover:bg-line-2"}`}>
                  <Icon size={13} /><span className="max-[1560px]:hidden">{label}</span><Badge n={badge} />
                </Link>
                {/* разделы кабинета по наведению / фокусу — переход в один клик из любого кабинета */}
                <div className="absolute left-0 top-full z-[120] hidden pt-[6px] group-hover:block group-focus-within:block">
                  <div className="min-w-[210px] rounded-[12px] border border-line bg-surface p-[6px] shadow-[0_14px_40px_rgba(20,36,63,.16)]">
                    <div className="px-[10px] pb-[4px] pt-[6px] text-[10.5px] font-extrabold uppercase tracking-[.08em] text-muted">{label}</div>
                    {spaceMenu[key].map((m) => (
                      <Link key={m.href} href={m.href} onClick={() => { if (m.href === "/catalog") setView("list"); }} className={`flex items-center gap-[9px] rounded-[8px] px-[10px] py-[8px] text-[13px] font-semibold ${m.active && workspace === key ? "bg-blue-tint text-blue-2" : "text-ink hover:bg-bg-2"}`}>
                        <m.Icon size={15} /><span className="flex-1">{m.label}</span><Badge n={m.badge} />
                      </Link>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
        {navItems.map(({ href, label, Icon, badge, active }) => (
          <Link key={href} data-nav-item="1" href={href} title={label} onClick={() => { if (href === "/catalog") setView("list"); }} className={`flex shrink-0 items-center gap-[7px] rounded-[10px] px-[13px] py-[9px] text-[13.5px] font-semibold transition hover:brightness-95 max-md:hidden ${active ? "bg-ink text-white" : "text-text"}`}>
            <Icon size={17} stroke={2} />
            <span data-nav-label="1">{label}</span>
            <Badge n={badge} />
          </Link>
        ))}
        <div className="min-w-2 flex-1" />
        <Link href="/chat" title={t.nav.chat} className={iconBtn}>
          <IconMessageCircle size={18} />
          {chatUnread && <span className="absolute -right-[3px] -top-[3px] h-[10px] w-[10px] rounded-full border-2 border-surface bg-red" />}
        </Link>
        <button type="button" onClick={() => setNtfOpen((v) => !v)} title={t.nav.ntf} className={iconBtn}>
          <IconBell size={18} />
          {ntfN > 0 && <span className="absolute -right-[6px] -top-[6px] flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] border-2 border-surface bg-red px-1 text-[10px] font-bold text-white">{ntfN}</span>}
        </button>
        <LangSwitch className="max-md:hidden" />
        <UserMenu name={name} sub={sub} email={email} avatar={avatar} color="#2f5fe0" logoutLabel={t.prof.out}
          items={[{ label: L("Профиль", "Profile", "Profil"), href: "/profile", icon: <IconUser size={16} /> }, ...(workspace === "realtors" ? [{ label: t.api.title, href: "/api-access", icon: <IconApi size={16} /> }] : [])]} /* меню аватара = аккаунт (профиль, уведомления, API, выход); разделы — в навигации, без дублей (18.10.2026) */
          onLogout={async () => { try { await createClient().auth.signOut(); } catch {} window.location.assign("/login"); }} />
        <button type="button" data-kebab="1" onClick={() => setMenu(true)} className={`${iconBtn} hover:border-line hover:text-text hover:brightness-95 md:hidden`} aria-label={t.common.menu}>
          <IconMenu2 size={19} />
          {reqsN > 0 && <span className="absolute -right-[3px] -top-[3px] h-[10px] w-[10px] rounded-full border-2 border-surface bg-red" />}
        </button>
      </header>

      {/* Notifications dropdown (prototype lines 209–221) */}
      {ntfOpen && (
        <>
          <div className="fixed inset-0 z-190" onClick={() => setNtfOpen(false)} />
          <div className="fixed right-4 top-[70px] z-200 w-[370px] max-w-[calc(100vw-24px)] overflow-hidden rounded-[16px] border border-line bg-surface shadow-[0_24px_60px_rgba(20,36,63,.18)]" style={{ animation: "opl-card .2s ease" }}>
            <div className="flex items-center border-b border-line-2 px-4 py-[14px]">
              <div className="flex-1 text-[14.5px] font-extrabold text-ink">{t.ntf.title}</div>
              <button type="button" onClick={ntfMarkAll} className="cursor-pointer text-[12px] font-semibold text-blue hover:text-blue-2">{t.ntf.mark}</button>
            </div>
            {ntfTop.map((n) => (
              <div key={n.id} onClick={() => { if (meId) { void live.markRead([n.id as number]); if (n.href) { setNtfOpen(false); router.push(n.href); } } }} className={`flex gap-[11px] border-b border-[#f5f7fb] px-4 py-3 ${meId ? "cursor-pointer hover:bg-bg-5" : ""}`} style={{ background: n.unread ? "#f8faff" : "#fff" }}>
                <div className="flex h-[34px] w-[34px] flex-none items-center justify-center rounded-[10px] text-[16px]" style={{ background: n.bg, color: n.tone }}><NtfIcon icon={n.icon} size={16} /></div>
                <div className="min-w-0 flex-1">
                  <div className="text-[13px] font-semibold leading-[1.4] text-ink">{n.title}</div>
                  <div className="mt-[2px] text-[12px] text-muted [overflow-wrap:anywhere]">{n.sub ? `${n.sub} · ` : ""}{n.time}</div>
                </div>
                {n.unread && <span className="mt-[6px] h-2 w-2 flex-none rounded-full bg-blue" />}
              </div>
            ))}
            {meId && live.loaded && live.rows.length === 0 && <div className="px-4 py-6 text-center text-[13px] text-muted">{t.ntf.empty}</div>}
            <button type="button" onClick={() => { setNtfOpen(false); router.push("/ntf"); }} className="w-full cursor-pointer p-3 text-center text-[13px] font-semibold text-blue hover:bg-bg-3">{t.ntf.all}</button>
          </div>
        </>
      )}

      {/* Kebab menu: 252px popover on desktop, full-screen on ≤760 (globals.css `[data-kebab-menu]`) */}
      {menu && (
        <>
          <div className="fixed inset-0 z-290 bg-[rgba(10,16,28,.25)]" onClick={() => setMenu(false)} />
          <div data-kebab-menu="1" className="fixed right-[10px] top-[60px] z-300 w-[252px] rounded-[16px] border border-line bg-surface p-2 shadow-[0_24px_60px_rgba(20,36,63,.2)]" style={{ animation: "opl-card .18s ease" }}>
            <div className="flex items-center gap-2 px-[10px] pb-[10px] pt-1">
              <span className="flex-1 text-[15px] font-extrabold text-ink">{t.common.menu}</span>
              <button type="button" onClick={() => setMenu(false)} className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[11px] bg-bg-2 text-[20px] text-text hover:brightness-95" aria-label={t.common.menu}><IconX size={20} /></button>
            </div>
            {isAdmin && workspace !== "admin" && (
              <div className="mb-[6px] border-b border-line-2 pb-[6px]">
                {spaces.map(({ key, href, label, Icon, badge }) => (
                  <Link key={key} href={href} onClick={() => setMenu(false)} className={`flex items-center gap-[11px] rounded-[10px] px-[10px] py-3 text-[13.5px] font-semibold ${workspace === key ? "bg-blue-tint text-blue-2" : "text-ink"}`}><Icon size={17} /><span className="flex-1">{label}</span><Badge n={badge} /></Link>
                ))}
              </div>
            )}
            {isAdmin && workspace === "admin" && spaces.map(({ key, label }) => (
              <div key={key} className="mb-[6px] border-b border-line-2 pb-[6px]">
                <div className="px-[10px] pb-[2px] pt-[8px] text-[10.5px] font-extrabold uppercase tracking-[.08em] text-muted">{label}</div>
                {spaceMenu[key].map(({ href, label: l2, Icon, badge, active }) => (
                  <Link key={href} href={href} onClick={() => { setMenu(false); if (href === "/catalog") setView("list"); }} className={`flex items-center gap-[11px] rounded-[10px] px-[10px] py-3 text-[13.5px] font-semibold ${active && workspace === key ? "bg-blue-tint text-blue-2" : "text-ink"}`}><Icon size={17} /><span className="flex-1">{l2}</span><Badge n={badge} /></Link>
                ))}
              </div>
            ))}
            <div data-kebab-rows="1">
              {(workspace === "admin" ? kebabRows.filter((r) => !adminItems.some((a) => a.href === r.href)) : kebabRows).map(({ href, label, Icon, badge, active }) => (
                <Link key={href} href={href} onClick={() => { setMenu(false); if (href === "/catalog") setView("list"); }} className={`flex cursor-pointer items-center gap-[11px] rounded-[10px] px-[10px] py-3 text-[13.5px] font-semibold hover:brightness-95 ${active ? "bg-blue-tint text-blue-2" : "text-ink"}`}>
                  <Icon size={17} />
                  <span className="flex-1">{label}</span>
                  {!!badge && <span className="inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] bg-red px-1 text-[10px] font-bold text-white">{badge}</span>}
                </Link>
              ))}
            </div>
            <div className="mx-[2px] my-[6px] border-t border-line-2" />
            <LangSwitch stretch data-kebab-lang="1" className="mx-1 mb-[2px] mt-1 rounded-[11px] p-1" />
          </div>
        </>
      )}
    </>
  );
}
