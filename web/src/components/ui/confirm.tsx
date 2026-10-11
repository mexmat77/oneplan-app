"use client";

// Фирменное окно подтверждения вместо системного `window.confirm`: `await confirmDialog({...})` → true/false.
// Хост `ConfirmHost` живёт в root layout (как тост). Окно — `Modal` прототипа поверх всего (z 700).
import { useSyncExternalStore } from "react";
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

let pending: Pending | null = null;
const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => { listeners.add(l); return () => { listeners.delete(l); }; };

export function confirmDialog(opts: ConfirmOpts | string): Promise<boolean> {
  const o: ConfirmOpts = typeof opts === "string" ? { text: opts } : opts;
  pending?.resolve(false);
  return new Promise<boolean>((resolve) => { pending = { ...o, resolve }; emit(); });
}

export function ConfirmHost() {
  const p = useSyncExternalStore(subscribe, () => pending, () => null);
  const t = useT();
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
