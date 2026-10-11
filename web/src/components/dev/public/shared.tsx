"use client";

// Shared pieces of the public pages (prototype `OnePlan v2.dc.html` 1268–1529): logo dots, language switch
// (`langBtns.navStyle`, 3098), WhatsApp button, «Работает на OnePlan» strip + legal footer, legal modal state.
import { useState } from "react";
import { IconBrandWhatsapp } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { LegalFooter, type LegalDocId } from "@/components/dev/legal/LegalFooter";
import { LegalModal } from "@/components/dev/profile/LegalModal";
import { LogoMark } from "@/components/Logo";

// Знак OnePlan — фирменные «лепестки» (`LogoMark`), а не точки прототипа v2 (решение пользователя 07.10.2026: один логотип везде).
export function Dots({ size = 10 }: { size?: number }) {
  return <LogoMark size={Math.round(size * 2.2)} />;
}

const LANGS = ["RU", "EN", "TR"] as const;
export function LangSwitch() {
  const { lang, setLang } = useDevT();
  return (
    <div className="flex flex-none gap-1 rounded-[9px] bg-bg-2 p-[3px]">
      {LANGS.map((lg) => <span key={lg} onClick={() => setLang(lg)} className={`cursor-pointer rounded-[7px] px-[9px] py-[5px] text-[12px] font-bold ${lang === lg ? "bg-surface text-ink shadow-[0_1px_2px_rgba(20,36,63,.12)]" : "bg-transparent text-muted"}`}>{lg}</span>)}
    </div>
  );
}

/** Green WhatsApp button; links to `wa.me` when the company has a phone (prototype had no handler). */
export function WaButton({ phone }: { phone?: string }) {
  const { t } = useDevT();
  const cls = "inline-flex flex-none cursor-pointer items-center gap-[6px] rounded-[10px] border-0 bg-green-3 px-[14px] py-[9px] text-[13px] font-bold text-white hover:bg-[#1ba852]";
  const digits = (phone || "").replace(/\D/g, "");
  if (digits) return <a href={`https://wa.me/${digits}`} target="_blank" rel="noopener" title={t.px.wa_title} className={cls}><IconBrandWhatsapp size={16} /> {t.pub.wa}</a>;
  return <button type="button" className={cls}><IconBrandWhatsapp size={16} /> {t.pub.wa}</button>;
}

/** Legal modal state for a page: `const legal = useLegal(); … {legal.node}` (prototype `legalDoc`). */
export function useLegal() {
  const [doc, setDoc] = useState<LegalDocId | null>(null);
  const node = doc !== null ? <LegalModal key={doc} initial={doc} onClose={() => setDoc(null)} /> : null;
  return { open: (id: LegalDocId) => setDoc(id), node };
}

export function PubFooter({ onLegal }: { onLegal: (id: LegalDocId) => void }) {
  const { t } = useDevT();
  return (
    <>
      <div className="flex items-center justify-center gap-[9px] border-t border-line p-[22px] text-[13px] font-semibold text-muted"><Dots size={10} />{t.pub.made}</div>
      <LegalFooter onOpen={onLegal} />
    </>
  );
}

/** Document status chip colours (prototype `dstat`, line 2690). */
export const DSTAT: Record<string, [string, string]> = { ok: ["#e4f6ee", "#0f9d6b"], wait: ["#fdf3d7", "#b7791f"], soon: ["#eef1f5", "#8a93a2"] };
