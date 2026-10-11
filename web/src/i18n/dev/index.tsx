"use client";

// Developer-cabinet dictionaries: `t` = prototype `I18N` (RU complete; EN/TR deep-merged onto RU), `tt` = `TEAMI18N`.
import { useMemo } from "react";
import { useI18n } from "@/i18n/provider";
import ru from "./ru.json";
import en from "./en.json";
import tr from "./tr.json";
import teamJson from "@/mock/dev/teami18n.json";

type Tree = Record<string, unknown>;
function merge(base: Tree, over: Tree): Tree {
  const out: Tree = { ...base };
  for (const k of Object.keys(over)) {
    const b = base[k], o = over[k];
    out[k] = b && o && typeof b === "object" && typeof o === "object" && !Array.isArray(b) ? merge(b as Tree, o as Tree) : o;
  }
  return out;
}
export type DevDict = typeof ru;
export type TeamDict = (typeof teamJson)["RU"];
const T: Record<string, DevDict> = { RU: ru, EN: merge(ru as unknown as Tree, en as unknown as Tree) as unknown as DevDict, TR: merge(ru as unknown as Tree, tr as unknown as Tree) as unknown as DevDict };
const TT = teamJson as Record<string, TeamDict>;

export function useDevT() {
  const { lang, setLang } = useI18n();
  return useMemo(() => ({ t: T[lang] ?? T.RU, tt: TT[lang] ?? TT.RU, lang, setLang }), [lang, setLang]);
}
