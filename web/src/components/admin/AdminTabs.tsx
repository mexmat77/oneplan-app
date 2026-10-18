"use client";

import { useI18n } from "@/i18n/provider";

/** `reqsN` — необработанные заявки (бейдж на вкладке «Заявки»), считает `countPendingRequests` в layout. */
/** Заголовок раздела «Управление». Вкладки разделов убраны (18.10.2026): они дублировали навигацию в шапке и мобильное меню,
 *  где теперь живут Пользователи · Заявки · Организации · Жалобы (см. `adminItems` в TopBar). */
export function AdminTabs() {
  const { lang } = useI18n();
  const L = (ru: string, en: string, tr: string) => (lang === "RU" ? ru : lang === "TR" ? tr : en);
  return (
    <>
      <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{L("Управление", "Administration", "Yönetim")}</h1>
      <p className="mb-[18px] mt-[5px] max-w-[640px] text-[14px] text-text-2">{L("Пользователи, доступ, компании и модерация — для администратора.", "Users, access, companies and moderation — for the administrator.", "Kullanıcılar, erişim, şirketler ve moderasyon — yönetici için.")}</p>
    </>
  );
}
