"use client";

// Передаёт курс ЦБ с сервера в модуль `lib/money` до рендера страницы (ставится в root layout перед children).
// Во время рендера — без оповещения подписчиков (иначе React ругается на setState в чужом рендере), оповещение — в эффекте.
import { useEffect } from "react";
import { notifyRates, setRates } from "@/lib/money";

export function RatesInit({ eur, usd, date }: { eur: number; usd: number; date: string }) {
  setRates({ eur, usd, date }, false); // SSR и гидрация считают по одному курсу
  useEffect(() => { setRates({ eur, usd, date }, false); notifyRates(); }, [eur, usd, date]);
  return null;
}
