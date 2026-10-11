"use client";

// Меню пользователя в шапке (как в современных CRM): аватар/инициалы → выпадающая карточка с именем, ролью и почтой,
// пунктами (профиль, уведомления…) и «Выйти». Общее для базы риэлторов (`TopBar`) и кабинета застройщика (`DevShell`).
import Link from "next/link";
import { IconChevronDown, IconLogout } from "@tabler/icons-react";
import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";

export type UserMenuItem = { label: string; href?: string; onClick?: () => void; icon?: ReactNode; badge?: number };

export function Avatar({ name, src, size = 34, color = "#4d7cfe", className = "" }: { name: string; src?: string | null; size?: number; color?: string; className?: string }) {
  const initials = name.trim().split(/\s+/).map((w) => w[0]).join("").toUpperCase().slice(0, 2) || "?";
  // eslint-disable-next-line @next/next/no-img-element
  if (src) return <img src={src} alt="" width={size} height={size} className={`flex-none rounded-full object-cover ${className}`} style={{ width: size, height: size }} />;
  return <span className={`flex flex-none items-center justify-center rounded-full font-bold text-white ${className}`} style={{ width: size, height: size, background: color, fontSize: Math.round(size * 0.36) }}>{initials}</span>;
}

export function UserMenu({ name, sub, email, avatar, color, items, logoutLabel, onLogout, showName = true, className = "" }: {
  name: string; sub?: string; email?: string; avatar?: string | null; color?: string; items: UserMenuItem[]; logoutLabel: string; onLogout: () => void; showName?: boolean; className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; right: number } | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Панель — порталом в body с fixed-позицией: липкие панели страниц (фильтры каталога и т. п.) имеют свой z-index и иначе перекрывали меню.
  const place = () => { const r = box.current?.getBoundingClientRect(); if (r) setPos({ top: r.bottom + 6, right: Math.max(8, window.innerWidth - r.right) }); };
  useLayoutEffect(() => { if (open) place(); }, [open]);
  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => { const t = e.target as Node; if (!box.current?.contains(t) && !panel.current?.contains(t)) setOpen(false); };
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    const esc = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", close); document.addEventListener("keydown", esc);
    return () => { document.removeEventListener("mousedown", close); document.removeEventListener("keydown", esc); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]);
  const row = "flex w-full cursor-pointer items-center gap-[10px] rounded-[10px] px-[10px] py-[9px] text-left text-[13.5px] font-semibold text-ink hover:bg-bg-3";
  return (
    <div ref={box} className={`relative flex-none ${className}`}>
      <button type="button" onClick={() => setOpen((v) => !v)} aria-haspopup="menu" aria-expanded={open} className="flex cursor-pointer items-center gap-2 rounded-[12px] py-1 pl-1 pr-2 hover:bg-bg-2">
        <Avatar name={name} src={avatar} color={color} />
        {showName && <span className="text-left max-[1440px]:hidden"><span className="block text-[13.5px] font-semibold leading-[1.15] text-ink">{name.split(" ")[0]}</span>{sub && <span className="block text-[11.5px] leading-[1.2] text-text-2">{sub}</span>}</span>}
        <IconChevronDown size={14} className={`text-muted transition-transform ${open ? "rotate-180" : ""}`} />
      </button>
      {open && pos && typeof document !== "undefined" && createPortal(
        <div ref={panel} role="menu" className="fixed z-[600] w-[280px] overflow-hidden rounded-[14px] border border-line bg-surface shadow-[0_18px_44px_rgba(20,36,63,.18)]" style={{ top: pos.top, right: pos.right, animation: "opl-bg .12s ease" }}>
          <div className="flex items-center gap-3 border-b border-line-2 px-[14px] py-[13px]">
            <Avatar name={name} src={avatar} color={color} size={42} />
            <div className="min-w-0">
              <div className="truncate text-[14px] font-bold text-ink">{name}</div>
              {sub && <div className="truncate text-[12px] text-text-2">{sub}</div>}
              {email && <div className="truncate text-[12px] text-muted">{email}</div>}
            </div>
          </div>
          <div className="p-[6px]">
            {items.map((it) => it.href
              ? <Link key={it.label} href={it.href} onClick={() => setOpen(false)} className={row}>{it.icon}<span className="flex-1">{it.label}</span>{!!it.badge && <span className="rounded-[9px] bg-red px-[6px] py-[1px] text-[10.5px] font-bold text-white">{it.badge}</span>}</Link>
              : <button key={it.label} type="button" onClick={() => { setOpen(false); it.onClick?.(); }} className={row}>{it.icon}<span className="flex-1">{it.label}</span>{!!it.badge && <span className="rounded-[9px] bg-red px-[6px] py-[1px] text-[10.5px] font-bold text-white">{it.badge}</span>}</button>)}
          </div>
          <div className="border-t border-line-2 p-[6px]">
            <button type="button" onClick={() => { setOpen(false); onLogout(); }} className={`${row} text-red`}><IconLogout size={16} /><span className="flex-1">{logoutLabel}</span></button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
