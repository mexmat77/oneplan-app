"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { IconBuilding, IconFlag, IconInbox, IconUsers } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";

/** `reqsN` — необработанные заявки (бейдж на вкладке «Заявки»), считает `countPendingRequests` в layout. */
export function AdminTabs({ reqsN = 0, reportsN = 0 }: { reqsN?: number; reportsN?: number }) {
  const { lang } = useI18n();
  const path = usePathname();
  const L = (ru: string, en: string, tr: string) => (lang === "RU" ? ru : lang === "TR" ? tr : en);
  const tabs = [
    { href: "/admin/users", label: L("Пользователи", "Users", "Kullanıcılar"), Icon: IconUsers },
    { href: "/admin/requests", label: L("Заявки", "Requests", "Başvurular"), Icon: IconInbox, badge: reqsN },
    { href: "/admin/companies", label: L("Организации", "Organizations", "Kuruluşlar"), Icon: IconBuilding },
    { href: "/admin/reports", label: L("Жалобы", "Reports", "Şikayetler"), Icon: IconFlag, badge: reportsN }, // раньше вело на /rls (демо-экран прототипа) — интерфейс «прыгал»
  ];
  return (
    <>
      <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{L("Управление", "Administration", "Yönetim")}</h1>
      <p className="mb-4 mt-[5px] max-w-[640px] text-[14px] text-text-2">{L("Пользователи, доступ, компании и модерация — для администратора.", "Users, access, companies and moderation — admin only.", "Kullanıcılar, erişim, şirketler ve moderasyon — yalnızca yönetici.")}</p>
      <div className="mb-[18px] flex w-fit max-w-full flex-wrap gap-[6px] rounded-[12px] bg-line-2 p-1">
        {tabs.map(({ href, label, Icon, badge }: { href: string; label: string; Icon: typeof IconInbox; badge?: number }) => {
          const on = path === href || path.startsWith(href + "/");
          return (
            <Link key={href} href={href} className={`inline-flex items-center gap-[6px] rounded-[9px] px-[14px] py-[7px] text-[13px] font-semibold ${on ? "bg-surface text-ink shadow-[0_1px_3px_rgba(20,36,63,.12)]" : "text-muted hover:bg-line-2"}`}>
              <Icon size={15} /> {label}
              {!!badge && <span className="ml-[2px] inline-flex h-[17px] min-w-[17px] items-center justify-center rounded-[9px] bg-red px-1 text-[10px] font-bold text-white">{badge}</span>}
            </Link>
          );
        })}
      </div>
    </>
  );
}
