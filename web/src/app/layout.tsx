import type { Metadata } from "next";
import { Inter } from "next/font/google";
import { cookies } from "next/headers";
import { DEFAULT_LANG, HTML_LANG, LANG_COOKIE, isLang } from "@/i18n";
import { I18nProvider } from "@/i18n/provider";
import { ConfirmHost } from "@/components/ui/confirm";
import { ToastHost } from "@/components/ui/toast";
import { RatesInit } from "@/components/RatesInit";
import { getRates } from "@/lib/ratesServer";
import "./globals.css";

const inter = Inter({
  subsets: ["latin", "cyrillic", "latin-ext"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "OnePlan — Риэлторы",
  description: "Закрытая база риэлторов: объекты, подборки и чат — только для участников.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const raw = (await cookies()).get(LANG_COOKIE)?.value;
  const lang = isLang(raw) ? raw : DEFAULT_LANG;
  const rates = await getRates();
  return (
    <html lang={HTML_LANG[lang]} className={inter.variable}>
      <body>
        <I18nProvider initialLang={lang}><RatesInit {...rates} />{process.env.NEXT_PUBLIC_STAGE === "staging" && <div className="pointer-events-none fixed bottom-3 left-1/2 z-[9999] -translate-x-1/2 rounded-full bg-[#e5484d] px-3 py-1 text-[11px] font-bold uppercase tracking-[.08em] text-white shadow-lg">тестовая версия · staging</div>}{children}<ToastHost /><ConfirmHost /></I18nProvider>
      </body>
    </html>
  );
}
