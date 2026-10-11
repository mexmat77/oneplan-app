"use client";

// Legal documents overlay (prototype lines 1547–1596; data 3925–3940): index of `LEGAL` + operator card, or one document.
import { useState } from "react";
import {
  IconArchive, IconArrowLeft, IconClipboardCheck, IconCookie, IconFileCertificate, IconFlag, IconGavel, IconListCheck, IconLock,
  IconMailCog, IconServerCog, IconShieldLock, IconX, type IconProps,
} from "@tabler/icons-react";
import type { ComponentType } from "react";
import { useEscape, useScrollLock } from "@/hooks/useScrollLock";
import { useDevT } from "@/i18n/dev";
import { LEGAL, LEGAL_CO } from "@/lib/dev/data";

const ICONS: Record<string, ComponentType<IconProps>> = {
  "ti-file-certificate": IconFileCertificate, "ti-list-check": IconListCheck, "ti-lock": IconLock, "ti-shield-lock": IconShieldLock,
  "ti-cookie": IconCookie, "ti-clipboard-check": IconClipboardCheck, "ti-flag": IconFlag, "ti-server-cog": IconServerCog,
  "ti-archive": IconArchive, "ti-mail-cog": IconMailCog,
};

export function LegalModal({ initial = "index", onClose }: { initial?: string; onClose: () => void }) {
  const { t, lang, setLang } = useDevT();
  const [doc, setDoc] = useState(initial);
  useScrollLock(true);
  useEscape(true, onClose);
  const view = doc !== "index" ? LEGAL.find((d) => d.id === doc) : undefined;

  return (
    <div className="fixed inset-0 z-[210] flex flex-col bg-bg">
      <div className="flex h-[58px] flex-none items-center gap-3 border-b border-line bg-surface px-[clamp(14px,4vw,28px)]">
        {view && <button type="button" onClick={() => setDoc("index")} className="inline-flex cursor-pointer items-center gap-[6px] text-[13px] text-text-2 hover:text-blue"><IconArrowLeft size={15} /> {t.lg.all_docs}</button>}
        <div className="overflow-hidden text-ellipsis whitespace-nowrap text-[15px] font-extrabold text-ink">{view ? view.title : t.lg.title}</div>
        <div className="flex-1" />
        <div className="flex flex-none gap-1 rounded-[9px] bg-bg-2 p-[3px]">
          {(["RU", "EN", "TR"] as const).map((lg) => (
            <button key={lg} type="button" onClick={() => setLang(lg)} className={`cursor-pointer rounded-[7px] px-[9px] py-[5px] text-[12px] font-bold ${lang === lg ? "bg-surface text-ink shadow-[0_1px_2px_rgba(20,36,63,.12)]" : "text-muted"}`}>{lg}</button>
          ))}
        </div>
        <button type="button" onClick={onClose} className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[9px] border border-line text-muted hover:border-red hover:text-red"><IconX size={17} /></button>
      </div>
      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-[840px] px-[clamp(16px,5vw,32px)] pb-[60px] pt-[clamp(18px,4vw,36px)]">
          {!view ? (
            <>
              <h1 className="mb-1 text-[clamp(24px,4vw,32px)] font-extrabold tracking-[-.02em] text-ink">{t.lg.title}</h1>
              <p className="mb-2 text-[14px] text-text-2 [text-wrap:pretty]">{t.lg.sub}</p>
              <div className="mb-[22px] flex items-start gap-[9px] rounded-[12px] border border-[#f5e3b0] bg-[#fef6e0] px-[15px] py-3 text-[12.5px] leading-[1.5] text-[#8a5a00]"><IconGavel size={17} className="mt-[1px] flex-none" /><span>{t.lg.disclaimer}</span></div>
              <div className="grid gap-3" style={{ gridTemplateColumns: "repeat(auto-fill,minmax(250px,1fr))" }}>
                {LEGAL.map((d) => { const Icon = ICONS[d.icon] ?? IconFileCertificate; return (
                  <div key={d.id} onClick={() => setDoc(d.id)} className="flex cursor-pointer items-start gap-3 rounded-[14px] border border-line bg-surface p-4 hover:border-[#cdd6e6] hover:shadow-[0_8px_22px_rgba(20,36,63,.1)]">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-blue-tint text-[19px] text-blue"><Icon size={19} /></span>
                    <div className="min-w-0"><div className="mb-[5px] text-[14px] font-bold leading-[1.25] text-ink">{d.title}</div><div className="text-[11.5px] text-[#9aa1ac]">{d.ver} · {d.upd}</div></div>
                  </div>
                ); })}
              </div>
              <div className="mt-[26px] rounded-[14px] border border-line bg-surface px-5 py-[18px]">
                <div className="mb-[10px] text-[13px] font-extrabold text-ink">{t.lg.operator}</div>
                <div className="grid gap-x-[22px] gap-y-2 text-[12.5px] leading-[1.5] text-[#4a5567]" style={{ gridTemplateColumns: "repeat(auto-fit,minmax(220px,1fr))" }}>
                  <div><b className="text-ink">{LEGAL_CO.name}</b></div>
                  <div>Vergi No: {LEGAL_CO.vkn}</div>
                  <div>MERSİS: {LEGAL_CO.mersis}</div>
                  <div>Ticaret Sicil No: {LEGAL_CO.sicil}</div>
                  <div>Yetki Belgesi: {LEGAL_CO.yetki}</div>
                  <div>{LEGAL_CO.adres}</div>
                  <div>KVKK: {LEGAL_CO.kvkkMail}</div>
                  <div>Hukuki bildirim: {LEGAL_CO.legalMail}</div>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="mb-[6px] text-[11.5px] font-bold uppercase tracking-[.05em] text-[#9aa1ac]">{view.ver} · {view.upd}</div>
              <h1 className="mb-5 text-[clamp(22px,3.6vw,30px)] font-extrabold tracking-[-.02em] text-ink [text-wrap:pretty]">{view.title}</h1>
              {view.body.map((sec) => (
                <div key={sec.h}>
                  <h2 className="mb-2 mt-[22px] text-[16px] font-extrabold text-ink">{sec.h}</h2>
                  {sec.p.map((p, i) => <p key={i} className="mb-[9px] text-[14px] leading-[1.65] text-[#3d4757] [text-wrap:pretty]">{p}</p>)}
                </div>
              ))}
              <div className="mt-7 border-t border-line pt-4 text-[12px] leading-[1.5] text-[#9aa1ac]">{LEGAL_CO.name} · MERSİS {LEGAL_CO.mersis} · {LEGAL_CO.legalMail}</div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
