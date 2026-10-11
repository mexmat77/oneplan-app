"use server";

// Автоперевод заголовка и описания объявления риэлтора на недостающие языки при публикации (план пользователя 11.10.2026):
// риэлтор пишет на одном языке, остальные два получают ИИ-перевод (Haiku, `translate` из чата застройщика), если риэлтор
// не заполнил/не поправил их сам в форме. Языки с машинным переводом возвращаются в `mt` — страница объекта показывает пометку.
import { translate } from "@/app/(dev)/dev/chat/actions";
import type { Lang } from "@/i18n";

const LANGS: Lang[] = ["RU", "EN", "TR"];
export type FillIn = { base: Lang; title: string; desc: string; titles: Partial<Record<Lang, string>>; descs: Partial<Record<Lang, string>> };
export type FillOut = { t: Record<Lang, string>; desc: Record<Lang, string>; mt: Lang[] };

export async function fillTranslations(inp: FillIn): Promise<FillOut> {
  const title = inp.title.trim(), desc = inp.desc.trim();
  const t = { RU: title, EN: title, TR: title } as Record<Lang, string>;
  const d = { RU: desc, EN: desc, TR: desc } as Record<Lang, string>;
  const mt = new Set<Lang>();
  await Promise.all(LANGS.filter((l) => l !== inp.base).map(async (l) => {
    const ownT = inp.titles[l]?.trim(), ownD = inp.descs[l]?.trim();
    if (ownT) t[l] = ownT;
    else if (title) { const r = await translate(title, l, "title"); if (!r.fallback) { t[l] = r.text; mt.add(l); } }
    if (ownD) d[l] = ownD;
    else if (desc) { const r = await translate(desc, l, "description"); if (!r.fallback) { d[l] = r.text; mt.add(l); } }
  }));
  return { t, desc: d, mt: [...mt] };
}
