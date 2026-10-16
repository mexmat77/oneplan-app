// Склонение по числу (16.10.2026): «1 объект · 2 объекта · 5 объектов», EN one/other, TR без форм. Формы — объект в словаре
// (`{ one, few, many }` в RU; EN/TR задают свои и наследуют остальные через fallback словаря), категория — Intl.PluralRules.
export type PluralForms = { one?: string; few?: string; many?: string; other?: string };
const rules: Record<string, Intl.PluralRules> = {};
export function plural(lang: string, n: number, forms: PluralForms): string {
  const loc = lang.toLowerCase();
  const pr = (rules[loc] ??= new Intl.PluralRules(loc));
  const cat = pr.select(n) as keyof PluralForms;
  return forms[cat] ?? forms.other ?? forms.many ?? forms.one ?? "";
}
