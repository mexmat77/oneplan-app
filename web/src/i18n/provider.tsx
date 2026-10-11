"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { DEFAULT_LANG, HTML_LANG, LANG_COOKIE, getDict, type Dict, type Lang } from "./index";

type I18nCtx = { lang: Lang; t: Dict; setLang: (l: Lang) => void };

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang ?? DEFAULT_LANG);

  const setLang = useCallback((l: Lang) => {
    setLangState(l);
    document.cookie = `${LANG_COOKIE}=${l}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = HTML_LANG[l];
  }, []);

  const value = useMemo(() => ({ lang, t: getDict(lang), setLang }), [lang, setLang]);
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18nCtx {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside <I18nProvider>");
  return ctx;
}

export function useT(): Dict {
  return useI18n().t;
}
