"use client";

// Лендинг one-plan.pro (главная, `/`) — прототип «OnePlan Главная.dc.html», спека docs/prototype-other-spec.md §A.
// Разметка и логика сгенерированы из прототипа (`scripts/gen-landing.mjs` → `LandingView.jsx`, `landingLogic.js`);
// здесь — состояние и связь с приложением:
//   • язык — общий с приложением (`useI18n`, cookie), а не отдельный `lang` прототипа;
//   • аудитория (риэлторы / застройщики) — `localStorage['oneplan-lp-prefs']`, как в прототипе;
//   • «Войти» → `/login` (после входа риэлтор попадает в каталог, застройщик — в кабинет);
//   • заявка → серверный экшен `submitLead` (таблица `leads`), в прототипе бэкенда не было.
import { useRouter } from "next/navigation";
import { useEffect, useState, useSyncExternalStore } from "react";
import { submitLead } from "@/app/lead-actions";
import { showToast } from "@/components/ui/toast";
import { useEscape } from "@/hooks/useScrollLock";
import { useI18n, useT } from "@/i18n/provider";
import type { Lang } from "@/i18n";
import ru from "@/i18n/landing/ru.json";
import en from "@/i18n/landing/en.json";
import tr from "@/i18n/landing/tr.json";
import { landingVals } from "./landingLogic";
import { LandingView } from "./LandingView";
import "./landing.css";
import "./landingHover.css";

const I18N = { RU: ru, EN: en, TR: tr };
type Aud = "r" | "d";

// ───── аудитория: localStorage + useSyncExternalStore (SSR отдаёт «r») ─────
const PREFS = "oneplan-lp-prefs";
const subs = new Set<() => void>();
const readAud = (): Aud => { try { return JSON.parse(localStorage.getItem(PREFS) || "{}").aud === "d" ? "d" : "r"; } catch { return "r"; } };
const writeAud = (aud: Aud, lang: string) => { try { localStorage.setItem(PREFS, JSON.stringify({ lang, aud })); } catch { /* приватный режим */ } subs.forEach((l) => l()); };
const subAud = (l: () => void) => { subs.add(l); return () => { subs.delete(l); }; };

type LpState = {
  role: Aud | null; faqOpen: number; tick: number; selUnit: { r: number; c: number }; devTab: "board" | "docs" | "pub"; tabTouchedAt?: number;
  legalDoc: "kvkk" | "priv" | null; leadName: string; leadCo: string; leadPhone: string; leadMail: string; leadMsg: string; leadC: boolean; leadDone: boolean;
};
type Full = Omit<LpState, "role"> & { lang: Lang; aud: Aud; role: Aud };
type Patch = Partial<Full>;
const INITIAL: LpState = { role: null, faqOpen: 0, tick: 0, selUnit: { r: 3, c: 4 }, devTab: "board", legalDoc: null, leadName: "", leadCo: "", leadPhone: "", leadMail: "", leadMsg: "", leadC: false, leadDone: false };

export function Landing() {
  const router = useRouter();
  const { lang, setLang } = useI18n();
  const T = useT();
  const aud = useSyncExternalStore(subAud, readAud, () => "r" as Aud);
  const [st, setSt] = useState<LpState>(INITIAL);
  const [sending, setSending] = useState(false);
  const full: Full = { ...st, lang, aud, role: st.role ?? aud };

  useEscape(st.legalDoc != null, () => setSt((p) => ({ ...p, legalDoc: null }))); // модалка KVKK / политики — в прототипе закрывалась только кликом
  // тик мока: 1800 мс (диалог риэлторов, «бронирование» в шахматке, авто-вкладки застройщика)
  useEffect(() => { const tm = setInterval(() => setSt((p) => ({ ...p, tick: p.tick + 1 })), 1800); return () => clearInterval(tm); }, []);

  /** `setState` прототипа: объект или функция от состояния; `lang` и `aud` уходят в свои хранилища. */
  const setState = (u: Patch | ((s: Full) => Patch)) => {
    // обработчики пересоздаются на каждом рендере, поэтому `full` здесь — актуальное состояние на момент события
    const patch = typeof u === "function" ? u(full) : u;
    const { lang: nl, aud: na, ...rest } = patch;
    if (nl && nl !== lang) setLang(nl);
    if (na && na !== aud) writeAud(na, nl ?? lang);
    if (Object.keys(rest).length) setSt((p) => ({ ...p, ...rest }));
  };

  const submit = async () => {
    if (sending) return;
    const s = full;
    setSending(true);
    const res = await submitLead({ role: s.role, name: s.leadName, company: s.leadCo, phone: s.leadPhone, email: s.leadMail, message: s.leadMsg, lang: s.lang }).catch(() => ({ ok: false as const, reason: "error" as const }));
    setSending(false);
    if (res.ok) setSt((p) => ({ ...p, leadDone: true }));
    else showToast(T.lp.send_err, 5000);
  };

  const v = landingVals({
    state: full,
    props: {},
    setState,
    savePrefs: () => {}, // язык и аудитория сохраняются в `setState`
    i18n: () => I18N,
    gotoApp: () => router.push("/login"),
    submit,
  });
  return <div className="lp-root"><LandingView v={v} /></div>;
}
