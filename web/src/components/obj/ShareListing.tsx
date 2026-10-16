"use client";

// «Поделиться» объявлением (16.10.2026): системное окно на телефоне (navigator.share) + меню WhatsApp / Telegram /
// чат OnePlan / копировать ссылку — текст из lib/shareListing (заголовок · цена · адрес + ссылка, превью даёт OG-обложка).
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { IconBrandTelegram, IconBrandWhatsapp, IconCheck, IconCopy, IconMessageCircle, IconShare2, IconShare3 } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { chatShareHref, listingShareText, listingUrl, tgShare, waShare } from "@/lib/shareListing";
import { showToast } from "@/components/ui/toast";
import type { Listing } from "@/lib/types";

export function ShareListing({ o }: { o: Listing }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const h = (e: MouseEvent) => { if (box.current && !box.current.contains(e.target as Node)) setOpen(false); };
    const k = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("mousedown", h); window.addEventListener("keydown", k);
    return () => { document.removeEventListener("mousedown", h); window.removeEventListener("keydown", k); };
  }, [open]);
  const text = listingShareText(o, lang, t), url = listingUrl(o.id);
  const canSys = typeof navigator !== "undefined" && typeof navigator.share === "function";
  const sys = async () => { try { await navigator.share({ title: o.t[lang], text: text.replace(url, "").trim(), url }); setOpen(false); } catch { /* отмена пользователем */ } };
  const copy = async () => {
    try { await navigator.clipboard.writeText(text); } catch { const ta = document.createElement("textarea"); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); ta.remove(); }
    setCopied(true); showToast(t.obj.shareCopied); setTimeout(() => { setCopied(false); setOpen(false); }, 900);
  };
  const row = "flex w-full cursor-pointer items-center gap-[10px] rounded-[10px] px-[10px] py-[9px] text-left text-[13px] font-semibold text-ink hover:bg-bg-2";
  const ic = "flex h-[30px] w-[30px] flex-none items-center justify-center rounded-full text-white";
  return (
    <div ref={box} className="relative">
      <button type="button" onClick={() => setOpen((v) => !v)} className="inline-flex cursor-pointer items-center gap-[6px] text-[12.5px] font-semibold text-muted hover:text-blue" aria-haspopup="menu" aria-expanded={open}>
        <IconShare3 size={15} /> {t.obj.share}
      </button>
      {open && (
        <div role="menu" className="animate-card absolute right-0 top-[calc(100%+8px)] z-[60] w-[268px] rounded-[14px] border border-line bg-surface p-[6px] shadow-[0_18px_50px_rgba(20,36,63,.18)]">
          {canSys && <button type="button" role="menuitem" onClick={sys} className={row}><span className={`${ic} bg-ink`}><IconShare2 size={16} /></span>{t.obj.shareSys}</button>}
          <a role="menuitem" href={waShare(text)} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className={row}><span className={`${ic} bg-[#22c15e]`}><IconBrandWhatsapp size={17} /></span>WhatsApp</a>
          <a role="menuitem" href={tgShare(url, text)} target="_blank" rel="noreferrer" onClick={() => setOpen(false)} className={row}><span className={`${ic} bg-[#229ed9]`}><IconBrandTelegram size={17} /></span>Telegram</a>
          <button type="button" role="menuitem" onClick={() => { setOpen(false); router.push(chatShareHref(text.replace("\n", " "))); }} className={row}><span className={`${ic} bg-[#eef3ff] text-blue`}><IconMessageCircle size={17} /></span>{t.obj.shareChat}</button>
          <button type="button" role="menuitem" onClick={copy} className={row}><span className={`${ic} bg-bg-3 text-ink`}>{copied ? <IconCheck size={16} /> : <IconCopy size={16} />}</span>{copied ? t.obj.shareCopied : t.obj.shareCopy}</button>
        </div>
      )}
    </div>
  );
}
