"use client";

// Prototype modal shell: dim overlay (`opl-bg`), centred window (`opl-card`), body scroll-lock, Esc.
// `sheet="fit"` reproduces `data-sheet="fit"` — on ≤760px the window becomes a bottom sheet
// (rules live in globals.css). Markup inside is left to the caller so each modal matches its prototype.
import type { CSSProperties, ReactNode } from "react";
import { useBackClose, useEscape, useScrollLock } from "@/hooks/useScrollLock";

type Props = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  width?: number;                 // px, default 460
  z?: number;                     // overlay z-index, default 410
  overlay?: number;               // dim opacity, default .55
  sheet?: "fit" | "tall" | false; // mobile bottom-sheet mode
  anim?: string;                  // window animation, default "opl-card .2s ease"
  padding?: string;               // default "22px 24px"
  className?: string;
  style?: CSSProperties;
  lock?: boolean;                 // body scroll-lock (default true)
  "data-testid"?: string;
};

export function Modal({ open, onClose, children, width = 460, z = 410, overlay = 0.55, sheet = "fit", anim = "opl-card .2s ease", padding = "22px 24px", className = "", style, lock = true }: Props) {
  useScrollLock(open && lock);
  useBackClose(open, onClose); // «назад» закрывает окно, а не уходит со страницы (18.10.2026)
  useEscape(open, onClose);
  if (!open) return null;
  return (
    <div className="fixed inset-0 flex items-center justify-center" style={{ zIndex: z, background: `rgba(10,16,28,${overlay})`, animation: "opl-bg .15s ease" }} onClick={onClose}>
      <div
        data-sheet={sheet || undefined}
        className={`relative max-h-[92vh] w-full overflow-y-auto rounded-[18px] bg-surface shadow-[0_30px_80px_rgba(0,0,0,.4)] ${className}`}
        style={{ maxWidth: width, padding, animation: anim, ...style }}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  );
}

/** 36×36 close button with the prototype's grey background (`#f0f2f6`, radius 11). */
export function ModalClose({ onClick, size = 36 }: { onClick: () => void; size?: number }) {
  return (
    <button type="button" onClick={onClick} aria-label="close" className="flex flex-none cursor-pointer items-center justify-center rounded-[11px] bg-bg-2 text-ink hover:bg-line" style={{ width: size, height: size }}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M18 6 6 18M6 6l12 12" /></svg>
    </button>
  );
}
