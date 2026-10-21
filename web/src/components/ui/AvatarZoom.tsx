"use client";

// Аватар с увеличением (21.10.2026, решение пользователя «делай»): как в WhatsApp/Telegram/LinkedIn — тап по фото
// в карточке риэлтора, шапке диалога, команде и подборке клиента открывает его во весь экран. Без фото (инициалы)
// ничего не открывается. Лайтбокс: тёмный фон, фото по центру (круглое, до 92vmin), крестик, Esc, клик по фону,
// «назад» на телефоне (`useBackClose`), свайп вниз закрывает. Шапка сайта (меню аккаунта) и мелкие аватары в списках —
// обычный `Avatar` без увеличения.
import { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/ui/UserMenu";
import { ModalClose } from "@/components/ui/Modal";
import { useBackClose, useEscape, useScrollLock } from "@/hooks/useScrollLock";

export function AvatarZoom({ name, src, size = 34, color, className = "", title }: { name: string; src?: string | null; size?: number; color?: string; className?: string; title?: string }) {
  const [open, setOpen] = useState(false);
  if (!src) return <Avatar name={name} size={size} color={color} className={className} />;
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} title={title ?? name} aria-label={title ?? name} className={`flex-none cursor-zoom-in rounded-full outline-none focus-visible:ring-2 focus-visible:ring-blue ${className}`} style={{ width: size, height: size }}>
        <Avatar name={name} src={src} size={size} color={color} />
      </button>
      {open && <Lightbox src={src} name={name} onClose={() => setOpen(false)} />}
    </>
  );
}

function Lightbox({ src, name, onClose }: { src: string; name: string; onClose: () => void }) {
  useScrollLock(true);
  useEscape(true, onClose);
  useBackClose(true, onClose);
  const start = useRef<{ y: number; id: number } | null>(null);
  const [dy, setDy] = useState(0);
  const [drag, setDrag] = useState(false);
  const onDown = (e: React.PointerEvent) => { if (e.pointerType === "mouse") return; start.current = { y: e.clientY, id: e.pointerId }; setDrag(true); (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); };
  const onMove = (e: React.PointerEvent) => { if (start.current?.id === e.pointerId) setDy(Math.max(0, e.clientY - start.current.y)); };
  const onUp = (e: React.PointerEvent) => { if (start.current?.id !== e.pointerId) return; const d = dy; start.current = null; setDrag(false); setDy(0); if (d > 90) onClose(); };
  return createPortal(
    <div data-overlay="1" className="fixed inset-0 z-[700] flex items-center justify-center" style={{ background: `rgba(5,10,20,${0.92 - Math.min(0.5, dy / 400)})`, animation: "opl-bg .15s ease" }} onClick={onClose}>
      <div className="absolute right-[14px] top-[calc(14px+env(safe-area-inset-top))]" onClick={(e) => e.stopPropagation()}><ModalClose onClick={onClose} /></div>
      <div className="flex flex-col items-center gap-3" style={{ transform: `translateY(${dy}px)`, transition: drag ? "none" : "transform .15s ease" }} onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} onClick={(e) => e.stopPropagation()}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={name} draggable={false} className="select-none rounded-full object-cover shadow-[0_30px_80px_rgba(0,0,0,.5)]" style={{ width: "min(92vmin, 560px)", height: "min(92vmin, 560px)", touchAction: "none" }} />
        <div className="text-[15px] font-semibold text-white/90">{name}</div>
      </div>
    </div>,
    document.body,
  );
}
