"use client";

// Фирменное окно подтверждения вместо системного `window.confirm`: `await confirmDialog({...})` → true/false.
// Хост `ConfirmHost` живёт в root layout (как тост). Окно — `Modal` прототипа поверх всего (z 700).
import { useState, useSyncExternalStore } from "react";
import { kbAutoFocus } from "@/lib/touch";
import { useT } from "@/i18n/provider";
import { Modal } from "./Modal";

export type ConfirmOpts = {
  text: string;
  title?: string;
  ok?: string;       // подпись кнопки подтверждения (по умолчанию «ОК»)
  cancel?: string;   // подпись отмены
  danger?: boolean;  // красная кнопка подтверждения (удаление)
};
type Pending = ConfirmOpts & { resolve: (v: boolean) => void };

/** Фирменное окно ввода строки вместо системного `window.prompt` (19.10.2026, «почему системное окно, а не по дизайну?»):
 *  `await promptDialog({ title, placeholder, options })` → строка или null (отмена). `options` — быстрые варианты чипами
 *  (например, причины отказа из настроек), клик подставляет текст в поле. */
export type PromptOpts = { title: string; text?: string; placeholder?: string; value?: string; ok?: string; cancel?: string; options?: string[]; required?: boolean };
type PendingPrompt = PromptOpts & { kind: "prompt"; resolve: (v: string | null) => void };
let pendingPrompt: PendingPrompt | null = null;

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function confirmDialog(opts: ConfirmOpts | string): Promise<boolean> {
  const o: ConfirmOpts = typeof opts === "string" ? { text: opts } : opts;
  pending?.resolve(false);
  return new Promise<boolean>((resolve) => { pending = { ...o, resolve }; emit(); });
}

export function promptDialog(opts: PromptOpts): Promise<string | null> {
  pendingPrompt?.resolve(null);
  return new Promise<string | null>((resolve) => { pendingPrompt = { ...opts, kind: "prompt", resolve }; emit(); });
}

function PromptBox({ p }: { p: PendingPrompt }) {
  const t = useT();
  const [v, setV] = useState(p.value ?? "");
  const done = (val: string | null) => { p.resolve(val); pendingPrompt = null; emit(); };
  const ok = () => { const s = v.trim(); if (p.required !== false && !s) return; done(s); };
  return (
    <Modal open onClose={() => done(null)} width={460} z={700} padding="24px 26px 22px">
      <div className="text-[18px] font-extrabold tracking-[-0.01em] text-ink">{p.title}</div>
      {p.text && <div className="mt-[8px] text-[14px] leading-[1.5] text-text">{p.text}</div>}
      {!!p.options?.length && <div className="mt-[12px] flex flex-wrap gap-[6px]">{p.options.map((o) => <button key={o} type="button" onClick={() => setV(o)} className={`cursor-pointer rounded-full border px-3 py-[6px] text-[13px] ${v === o ? "border-blue bg-blue-tint font-semibold text-sel-ink" : "border-line bg-surface text-text hover:border-blue"}`}>{o}</button>)}</div>}
      <input value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") ok(); }} placeholder={p.placeholder} autoFocus={kbAutoFocus()} className="mt-[12px] h-11 w-full rounded-[10px] border border-line bg-surface px-3 text-[14px] text-ink outline-none focus:border-blue" />
      <div className="mt-[18px] flex justify-end gap-[10px] max-md:flex-col-reverse">
        <button type="button" onClick={() => done(null)} className="cursor-pointer rounded-[11px] border border-line bg-surface px-[18px] py-[11px] text-[14px] font-semibold text-ink hover:bg-bg-2">{p.cancel ?? t.common.cancel}</button>
        <button type="button" onClick={ok} disabled={p.required !== false && !v.trim()} className="cursor-pointer rounded-[11px] border border-blue bg-blue px-[18px] py-[11px] text-[14px] font-bold text-white hover:bg-[#3a63d4] disabled:cursor-default disabled:opacity-50">{p.ok ?? t.common.ok}</button>
      </div>
    </Modal>
  );
}

export function ConfirmHost() {
  const p = useSyncExternalStore(subscribe, () => pending, () => null);
  const pp = useSyncExternalStore(subscribe, () => pendingPrompt, () => null);
  const t = useT();
  if (pp) return <PromptBox key={pp.title} p={pp} />;
  if (!p) return null;
  const done = (v: boolean) => { p.resolve(v); pending = null; emit(); };
  return (
    <Modal open onClose={() => done(false)} width={440} z={700} padding="24px 26px 22px">
      <div className="text-[18px] font-extrabold tracking-[-0.01em] text-ink">{p.title ?? t.common.confirmTitle}</div>
      <div className="mt-[10px] text-[14.5px] leading-[1.55] text-text">{p.text}</div>
      <div className="mt-[22px] flex justify-end gap-[10px] max-md:flex-col-reverse">
        <button type="button" autoFocus onClick={() => done(false)} className="cursor-pointer rounded-[11px] border border-line bg-surface px-[18px] py-[11px] text-[14px] font-semibold text-ink hover:bg-bg-2">{p.cancel ?? t.common.cancel}</button>
        <button type="button" onClick={() => done(true)} className={`cursor-pointer rounded-[11px] border px-[18px] py-[11px] text-[14px] font-bold text-white ${p.danger ? "border-red bg-red hover:bg-red-2" : "border-blue bg-blue hover:bg-[#3a63d4]"}`}>{p.ok ?? t.common.ok}</button>
      </div>
    </Modal>
  );
}
