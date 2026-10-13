"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IconFlask, IconX } from "@tabler/icons-react";
import { TopBar, type Workspace } from "./TopBar";
import { usePrefs } from "@/store/prefs";
import { useNotifications } from "@/store/ntf";
import { UNREAD_SEED, useChat } from "@/store/chat";
import { useChatUnread } from "@/lib/chat/client";
import { useNotifs } from "@/lib/notifications/client";
import { useReqs } from "@/store/reqs";
import { useNewbPrefs } from "@/store/newb";
import { initRole, useRole } from "@/store/role";
import { useI18n } from "@/i18n/provider";
import { useProfile } from "@/store/profile";

// Header hide-on-scroll — prototype `_onScroll` (lines 2545–2556): on ≤760 hide while scrolling down (dy>6),
// show on scroll up (dy<-6) or near the top; on desktop hide once the sticky filter bar `[data-fsticky]` is stuck.
function useHdrHide(path: string) {
  const [hide, setHide] = useState(false);
  useEffect(() => {
    let lastY = window.scrollY;
    let cur = false;
    const upd = (v: boolean) => { if (v !== cur) { cur = v; setHide(v); } };
    const onScroll = () => {
      const y = window.scrollY;
      if (window.innerWidth <= 760) {
        const dy = y - lastY; lastY = y;
        let h = cur;
        if (y <= 90) h = false; else if (dy > 6) h = true; else if (dy < -6) h = false;
        upd(h);
      } else {
        const wrap = document.querySelector("[data-fsticky]");
        if (wrap) upd(wrap.getBoundingClientRect().top <= 66 && y > 80);
        else upd(false);
      }
      document.querySelectorAll("[data-fsticky]").forEach((el) => el.setAttribute("data-stuck", cur ? "1" : "0"));
    };
    upd(false);
    window.addEventListener("scroll", onScroll, { passive: true });
    window.addEventListener("resize", onScroll);
    onScroll();
    return () => { window.removeEventListener("scroll", onScroll); window.removeEventListener("resize", onScroll); };
  }, [path]);
  return hide;
}

// Gradient mask + auto-scroll of a clicked chip on every scrollable chip strip (prototype `_chipFade`, line 2621).
// Strips appear/disappear with screens, so a MutationObserver wires up new ones.
function useChipFade() {
  useEffect(() => {
    const wired = new WeakSet<Element>();
    const wire = (el: HTMLElement) => {
      if (wired.has(el)) return;
      wired.add(el);
      const up = () => { el.dataset.fade = el.scrollWidth - el.clientWidth - el.scrollLeft > 8 ? "1" : "0"; };
      el.addEventListener("scroll", up, { passive: true });
      el.addEventListener("click", (ev) => {
        const c = (ev.target as HTMLElement).closest("button,span");
        if (!c || !el.contains(c)) return;
        const r = c.getBoundingClientRect(), er = el.getBoundingClientRect();
        if (r.right > er.right - 34) el.scrollBy({ left: r.right - er.right + 70, behavior: "smooth" });
      });
      up();
    };
    const scan = () => document.querySelectorAll<HTMLElement>("[data-nb-chips],[data-fbar-scroll]").forEach(wire);
    const refresh = () => document.querySelectorAll<HTMLElement>("[data-nb-chips],[data-fbar-scroll]").forEach((el) => { el.dataset.fade = el.scrollWidth - el.clientWidth - el.scrollLeft > 8 ? "1" : "0"; });
    scan();
    const mo = new MutationObserver(() => { scan(); refresh(); });
    mo.observe(document.body, { childList: true, subtree: true });
    window.addEventListener("resize", refresh);
    return () => { mo.disconnect(); window.removeEventListener("resize", refresh); };
  }, []);
}

// Client wrapper that feeds live counters into the top bar and hosts the demo role toggle.
export function AppChrome({ name, isAdmin, workspace, userRole = "realtor", adminN = 0, email, avatar, agency, meId, supportId }: { name: string; isAdmin: boolean; workspace?: Workspace; userRole?: "realtor" | "admin" | "developer"; adminN?: number; email?: string; avatar?: string | null; agency?: string; meId?: string | null; supportId?: string | null }) {
  const path = usePathname();
  const router = useRouter();
  const isDev = userRole === "developer";
  const ws = workspace ?? (isDev || path.startsWith("/dev") ? "dev" : path.startsWith("/admin") ? "admin" : "realtors");
  // Developer accounts live in their cabinet only; realtor screens are not theirs.
  useEffect(() => { if (isDev && !path.startsWith("/dev") && !path.startsWith("/chat") && !path.startsWith("/ntf") && !path.startsWith("/profile")) router.replace("/dev"); }, [isDev, path, router]);
  const { favs } = usePrefs();
  const { favU, watch } = useNewbPrefs();
  const { unreadN: seedUnread } = useNotifications();
  const liveNtf = useNotifs(meId ?? null);
  const unreadN = meId ? liveNtf.unread : seedUnread; // реальные уведомления у вошедшего, демо — без аккаунта
  const { read } = useChat();
  const { searches } = useReqs();
  const role = useRole();
  const profile = useProfile();
  const { t, lang } = useI18n();
  const [demoOpen, setDemoOpen] = useState(false);
  const hidden = useHdrHide(path);
  useChipFade();
  // Role is initialised synchronously so child pages (e.g. /rls guard) see it on their first render.
  if (typeof window !== "undefined") initRole(isAdmin);
  const admin = role.realAdmin ? role.isAdmin : isAdmin;
  const reqsN = searches.reduce((a, s) => a + s.newN, 0);
  const liveUnread = useChatUnread(meId ?? null, supportId ?? "", isAdmin); // реальный чат (Supabase); демо-точка — только без аккаунта
  const chatUnread = meId ? liveUnread > 0 : Object.keys(UNREAD_SEED).some((id) => !read.includes(id));
  const roleBtn = (on: boolean) => `cursor-pointer rounded-[8px] px-[11px] py-[6px] text-[11px] font-bold hover:bg-line-2 hover:text-ink ${on ? "bg-blue-2 text-white" : "bg-dark-2 text-dark-muted"}`;
  return (
    <>
      <TopBar name={profile.name || name} isAdmin={admin} favsN={favs.length + favU.length + watch.length} ntfN={unreadN} reqsN={reqsN} adminN={adminN} chatUnread={chatUnread} workspace={ws} hidden={hidden} email={email || profile.email} avatar={avatar} sub={agency || profile.agency || undefined} meId={meId ?? null} />
      {/* Demo role toggle (prototype `[data-demo]`, lines 1885–1893) — only real admins can preview as a realtor */}
      {role.realAdmin && (
        <div data-demo="1" className="fixed bottom-4 left-4 z-205 flex items-center gap-2">
          <button type="button" onClick={() => setDemoOpen((v) => !v)} title={t.common.demo} className="flex h-10 w-10 flex-none cursor-pointer items-center justify-center rounded-full bg-ink text-[17px] text-dark-muted shadow-[0_10px_30px_rgba(10,16,28,.35)] hover:text-white">
            {demoOpen ? <IconX size={18} /> : <IconFlask size={18} />}
          </button>
          {demoOpen && (
            <div className="flex items-center gap-[9px] rounded-[12px] bg-ink py-[7px] pl-[13px] pr-2 text-white shadow-[0_10px_30px_rgba(20,36,63,.3)]">
              <span className="text-[11px] font-bold text-dark-muted">{t.common.demo}</span>
              <button type="button" className={roleBtn(role.role === "realtor")} onClick={() => role.setRole("realtor")}>{lang === "RU" ? "Риэлтор" : lang === "EN" ? "Realtor" : "Emlakçı"}</button>
              <button type="button" className={roleBtn(role.role === "admin")} onClick={() => role.setRole("admin")}>{lang === "RU" ? "Админ" : lang === "EN" ? "Admin" : "Yönetici"}</button>
            </div>
          )}
        </div>
      )}
    </>
  );
}
