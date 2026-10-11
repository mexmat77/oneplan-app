"use client";

// Developer contacts bottom-sheet — prototype `nbo.ctsOpen` (lines 1255–1267).
import type { ReactNode } from "react";
import { IconBrandTelegram, IconBrandWechat, IconBrandWhatsapp, IconChevronRight, IconMessageCircle, IconPhone, IconX } from "@tabler/icons-react";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useI18n } from "@/i18n/provider";

export function ContactsSheet({ dev, phone, onClose, onChat }: { dev: string; phone: string; onClose: () => void; onChat: () => void }) {
  const { t } = useI18n();
  useScrollLock(true);
  const row = "flex cursor-pointer items-center gap-3 border-b border-[#f2f4f8] px-[2px] py-3";
  const rows: [string, ReactNode, string, ReactNode][] = [
    ["#22c15e", <IconBrandWhatsapp key="w" size={17} />, "WhatsApp", <IconChevronRight key="c" size={16} className="text-[#c3c9d4]" />],
    ["#229ed9", <IconBrandTelegram key="t" size={17} />, "Telegram", <IconChevronRight key="c" size={16} className="text-[#c3c9d4]" />],
    ["#7360f2", <b key="v" className="text-[15px]">V</b>, "Viber", <IconChevronRight key="c" size={16} className="text-[#c3c9d4]" />],
    ["#7b4fd0", <b key="m" className="text-[11px]">MAX</b>, "MAX", <IconChevronRight key="c" size={16} className="text-[#c3c9d4]" />],
    ["#07c160", <IconBrandWechat key="wc" size={17} />, "WeChat", <IconChevronRight key="c" size={16} className="text-[#c3c9d4]" />],
  ];
  return (
    <>
      <div onClick={onClose} className="animate-bg fixed inset-0 z-320 bg-[rgba(10,16,28,.5)]" />
      <div className="fixed inset-x-0 bottom-0 z-330 rounded-t-[18px] bg-surface px-[18px] pb-[22px] pt-4 shadow-[0_-20px_60px_rgba(10,16,28,.35)]">
        <div className="mb-[6px] flex items-center gap-[10px]">
          <span className="flex-1 text-[15.5px] font-extrabold text-ink">{t.common.contact} · {dev}</span>
          <button type="button" onClick={onClose} className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[11px] bg-[#f0f2f6] text-text hover:brightness-[.96]"><IconX size={20} /></button>
        </div>
        <a href={`tel:${phone.replace(/\s/g, "")}`} className={row}>
          <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-blue-2 text-white"><IconPhone size={17} /></span>
          <span className="flex-1 text-[14px] font-semibold text-ink">{t.obj.callL}</span>
          <span className="text-[13px] font-bold text-ink">{phone}</span>
        </a>
        {rows.map(([bg, icon, label, right]) => (
          <div key={label} className={row}>
            <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full font-extrabold text-white" style={{ background: bg }}>{icon}</span>
            <span className="flex-1 text-[14px] font-semibold text-ink">{label}</span>
            {right}
          </div>
        ))}
        <div onClick={onChat} className="flex cursor-pointer items-center gap-3 px-[2px] py-3 hover:brightness-[.96]">
          <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-blue-tint text-blue-2"><IconMessageCircle size={17} /></span>
          <span className="flex-1 text-[14px] font-semibold text-ink">{t.obj.chat}</span>
          <IconChevronRight size={16} className="text-[#c3c9d4]" />
        </div>
      </div>
    </>
  );
}
