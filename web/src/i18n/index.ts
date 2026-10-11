import ru from "./ru.json";
import en from "./en.json";
import tr from "./tr.json";

export type Lang = "RU" | "EN" | "TR";
export type Dict = typeof ru;

export const LANGS: Lang[] = ["RU", "EN", "TR"];
export const DEFAULT_LANG: Lang = "RU";
export const LANG_COOKIE = "oneplan-lang";

type Tree = Record<string, unknown>;
const isTree = (v: unknown): v is Tree => typeof v === "object" && v !== null && !Array.isArray(v);

// EN/TR in the prototype are partial; RU is the complete source of truth,
// so missing keys fall back to Russian instead of crashing.
function withFallback(base: Tree, over: Tree): Tree {
  const out: Tree = { ...base };
  for (const k of Object.keys(over)) {
    const b = base[k];
    const o = over[k];
    out[k] = isTree(b) && isTree(o) ? withFallback(b, o) : o;
  }
  return out;
}

const dicts: Record<Lang, Dict> = {
  RU: ru,
  EN: withFallback(ru as unknown as Tree, en as unknown as Tree) as unknown as Dict,
  TR: withFallback(ru as unknown as Tree, tr as unknown as Tree) as unknown as Dict,
};

export function getDict(lang: Lang): Dict {
  return dicts[lang] ?? dicts[DEFAULT_LANG];
}

export function isLang(v: unknown): v is Lang {
  return typeof v === "string" && (LANGS as string[]).includes(v);
}

export const HTML_LANG: Record<Lang, string> = { RU: "ru", EN: "en", TR: "tr" };
