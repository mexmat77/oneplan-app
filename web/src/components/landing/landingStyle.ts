// Хелперы сгенерированной разметки лендинга (`LandingView.jsx`).
import type { CSSProperties } from "react";

const cache = new Map<string, CSSProperties>();
const camel = (k: string) => (k.startsWith("-webkit-") ? "Webkit" + k.slice(8).replace(/(^|-)([a-z])/g, (_, __, c: string) => c.toUpperCase()) : k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase()));

/**
 * CSS-строка прототипа («font-size:14px;color:#fff») → объект стилей React. Результат кэшируется по строке.
 * Шрифт `Manrope` из прототипа подменяется переменной `next/font` (имя семейства у него хешированное).
 */
export function S(css: string): CSSProperties {
  const hit = cache.get(css);
  if (hit) return hit;
  const out: Record<string, string> = {};
  for (const decl of css.split(";")) {
    const i = decl.indexOf(":");
    if (i < 0) continue;
    const k = decl.slice(0, i).trim(), v = decl.slice(i + 1).trim();
    if (!k || !v) continue;
    out[camel(k)] = k === "font-family" && /manrope/i.test(v) ? "var(--font-lp-manrope), sans-serif" : v;
  }
  cache.set(css, out as CSSProperties);
  return out as CSSProperties;
}

/** Путь ассета прототипа → файл в `public/landing/` (в прототипе пути относительные: `megapolis-photos/web-front.jpg`). */
export const A = (p: string) => `/landing/${p}`;
