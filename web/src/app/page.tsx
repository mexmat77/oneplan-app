// Главная one-plan.pro — маркетинговый лендинг для двух продуктов (риэлторы / застройщики) с входом в приложение.
// Прототип: «OnePlan Главная.dc.html» (docs/prototype-other-spec.md §A). Раньше здесь был редирект на /catalog.
import type { Metadata } from "next";
import { Manrope, PT_Sans } from "next/font/google";
import { cookies } from "next/headers";
import { DEFAULT_LANG, LANG_COOKIE, getDict, isLang } from "@/i18n";
import { Landing } from "@/components/landing/Landing";

const manrope = Manrope({ subsets: ["latin", "cyrillic", "latin-ext"], weight: ["500", "600", "700", "800"], variable: "--font-lp-manrope", display: "swap" });
const ptSans = PT_Sans({ subsets: ["latin", "cyrillic", "latin-ext"], weight: ["400", "700"], variable: "--font-lp-pt", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const raw = (await cookies()).get(LANG_COOKIE)?.value;
  const t = getDict(isLang(raw) ? raw : DEFAULT_LANG);
  return { title: t.lp.title, description: t.lp.desc };
}

export default function Home() {
  return <div className={`${manrope.variable} ${ptSans.variable}`}><Landing /></div>;
}
