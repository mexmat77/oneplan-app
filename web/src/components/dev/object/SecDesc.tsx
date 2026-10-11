"use client";

// `#sec-desc` (529–533; данные 3395, 3986, 4241–4242): чипы языков RU/EN/TR/AR, «Перевести ИИ», textarea описания
// на выбранном языке. Перевод — реальный (Anthropic через серверный экшен); прототип подставлял мок `AITR`.
import { useState } from "react";
import { IconAlignLeft, IconSparkles } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { showToast } from "@/components/ui/toast";
import { translate } from "@/app/(dev)/dev/chat/actions";
import { SectionCard, eSet, type DescLang, type EditObj } from "./shared";

const LANGS: DescLang[] = ["RU", "EN", "TR", "AR"];

export function SecDesc({ obj }: { obj: EditObj }) {
  const { t } = useDevT();
  const [lang, setLang] = useState<DescLang>("RU");
  const [busy, setBusy] = useState(false);
  const aiTranslate = async () => {
    if (lang === "RU" || busy) return;
    // Source = Russian text, or the first other language that has a description.
    const src = (obj.descs.RU || "").trim() || (["EN", "TR", "AR"] as DescLang[]).map((l) => (l === lang ? "" : (obj.descs[l] || "").trim())).find(Boolean) || "";
    if (!src) { showToast(t.edp.ai_empty); return; }
    setBusy(true);
    try {
      const r = await translate(src, lang, "description");
      if (r.fallback) { showToast(r.reason === "no-key" ? t.edp.ai_nokey : r.reason === "no-session" ? t.edp.ai_nosession : t.edp.ai_error); return; }
      eSet(obj.id, { descs: { ...obj.descs, [lang]: r.text } });
    } catch { showToast(t.edp.ai_error); } finally { setBusy(false); }
  };
  return (
    <SectionCard id="sec-desc" icon={<IconAlignLeft size={18} />} title={t.edp.nav_desc} headClass="mb-[14px]"
      after={<>
        <div className="flex-1" />
        <div className="flex flex-wrap gap-[6px]">
          {LANGS.map((l) => <span key={l} onClick={() => setLang(l)} className={`cursor-pointer rounded-[8px] border px-[11px] py-[5px] text-[12px] font-semibold ${l === lang ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-text-2"}`}>{l}</span>)}
        </div>
        {lang !== "RU" && <button type="button" onClick={aiTranslate} className="inline-flex cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[9px] border-none bg-[linear-gradient(135deg,#7b4fd0,#4d7cfe)] px-3 py-[7px] text-[12px] font-bold text-white"><IconSparkles size={14} /> {busy ? "…" : t.edp.ai}</button>}
      </>}>
      {lang !== "RU" && <div className="mb-2 flex items-center gap-1 text-[11.5px] text-muted"><IconSparkles size={13} /> {t.edp.ai_note}</div>}
      <textarea value={obj.descs[lang] || ""} onChange={(e) => eSet(obj.id, { descs: { ...obj.descs, [lang]: e.target.value } })} className="min-h-[110px] w-full resize-y rounded-[12px] border border-transparent bg-[#fbfcfe] px-[14px] py-3 font-[inherit] text-[14.5px] leading-[1.6] text-ink-2 outline-none focus:border-blue focus:bg-surface" />
    </SectionCard>
  );
}
