"use client";

import { LANGS } from "@/i18n";
import { useI18n } from "@/i18n/provider";

// Language switch — prototype `langBtnStyle` (11.5px/700, padding 5px 10px, radius 7; active white with shadow).
export function LangSwitch({ stretch = false, className = "", ...rest }: { stretch?: boolean; className?: string; "data-kebab-lang"?: string; "data-lang-sw"?: string }) {
  const { lang, setLang } = useI18n();
  return (
    <div data-lang-sw="1" {...rest} className={`flex shrink-0 gap-1 rounded-[9px] bg-bg-2 p-[3px] ${className}`}>
      {LANGS.map((l) => {
        const on = l === lang;
        return (
          <button
            key={l}
            type="button"
            onClick={() => setLang(l)}
            className={`cursor-pointer rounded-[7px] px-[10px] py-[5px] text-[11.5px] font-bold transition ${on ? "bg-surface text-ink shadow-[0_1px_3px_rgba(20,36,63,.12)]" : "text-muted hover:bg-line-2"} ${stretch ? "flex-1 text-center" : ""}`}
          >
            {l}
          </button>
        );
      })}
    </div>
  );
}
