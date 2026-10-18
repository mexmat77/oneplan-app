"use client";

// Поле ввода чата (16.10.2026, «переносить на вторую/третью строку, как в WhatsApp»): textarea, растёт по содержимому
// от одной до ~6 строк, дальше прокрутка; Enter — отправить, Shift+Enter — новая строка; на тач-устройствах Enter — новая
// строка (как в WhatsApp на телефоне), отправка — кнопкой. Общий для чата риэлторов и чата застройщика.
import { forwardRef, useImperativeHandle, useLayoutEffect, useRef } from "react";

import { isTouch as touch } from "@/lib/touch";

export const ChatInput = forwardRef<HTMLTextAreaElement, { value: string; onChange: (v: string) => void; onSend: () => void; placeholder?: string; className?: string; maxPx?: number }>(
  function ChatInput({ value, onChange, onSend, placeholder, className = "", maxPx = 168 }, ref) {
    const el = useRef<HTMLTextAreaElement>(null);
    useImperativeHandle(ref, () => el.current as HTMLTextAreaElement);
    useLayoutEffect(() => { const t = el.current; if (!t) return; t.style.height = "auto"; t.style.height = `${Math.min(t.scrollHeight, maxPx)}px`; t.style.overflowY = t.scrollHeight > maxPx ? "auto" : "hidden"; }, [value, maxPx]);
    return (
      <textarea ref={el} data-chat-input="1" rows={1} value={value} onChange={(e) => onChange(e.target.value)}
        onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing && !touch()) { e.preventDefault(); onSend(); } }}
        placeholder={placeholder} className={`min-w-0 flex-1 resize-none rounded-[12px] border border-line px-[14px] py-[11px] text-[14px] leading-[1.45] outline-none focus:border-blue ${className}`} />
    );
  },
);
