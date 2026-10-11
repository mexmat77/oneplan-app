"use client";

// Демо-уведомления прототипа (сид) — только без аккаунта; реальные — `NtfReal`.

import { useState, type ComponentType } from "react";
import {
  IconBell, IconEye, IconHeart, IconHeartDown, IconHeartExclamation, IconHomePlus, IconHomeSearch, IconLink, IconMessageCircle,
  IconTargetArrow, IconUserPlus, type IconProps,
} from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { markAllRead, useNotifications } from "@/store/ntf";

const ICONS: Record<string, ComponentType<IconProps>> = {
  "ti-eye": IconEye, "ti-heart": IconHeart, "ti-heart-down": IconHeartDown, "ti-heart-exclamation": IconHeartExclamation,
  "ti-home-plus": IconHomePlus, "ti-home-search": IconHomeSearch, "ti-link": IconLink, "ti-message-circle": IconMessageCircle,
  "ti-target-arrow": IconTargetArrow, "ti-user-plus": IconUserPlus,
};
const STEP = 4;

export function NtfDemo() {
  const { t, lang } = useI18n();
  const { items } = useNotifications();
  const [shown, setShown] = useState<Record<string, number>>({});

  const groups = (["today", "yest"] as const).map((d) => ({ key: d, label: d === "today" ? t.ntf.today : t.ntf.yest, list: items.filter((n) => n.day === d) })).filter((g) => g.list.length);
  const more = (lang === "RU" ? "Показать ещё " : lang === "TR" ? "Daha göster: " : "Show ");

  return (
    <div className="mx-auto max-w-[700px]">
      <div className="mb-[18px] flex items-center gap-3">
        <h1 className="flex-1 text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.ntf.title}</h1>
        <button type="button" onClick={markAllRead} className="cursor-pointer text-[13px] font-semibold text-blue hover:text-blue-2">{t.ntf.mark}</button>
      </div>
      {groups.map((g) => {
        const n = shown[g.key] ?? STEP;
        const rest = g.list.length - n;
        return (
          <div key={g.key}>
            <div className="mb-2 mt-[18px] text-[12px] font-bold uppercase tracking-[.06em] text-muted">{g.label}</div>
            <div className="overflow-hidden rounded-[16px] border border-line bg-surface">
              {g.list.slice(0, n).map((x) => {
                const Icon = ICONS[x.icon] ?? IconBell;
                return (
                  <div key={x.id} className={`flex gap-3 border-b border-[#f5f7fb] px-[17px] py-[14px] ${x.unread ? "bg-[#f8faff]" : ""}`}>
                    <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px]" style={{ background: x.bg, color: x.tone }}><Icon size={17} /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold leading-[1.45] text-ink">{x.tx[lang][0]}</div>
                      <div className="mt-[2px] text-[12.5px] text-muted">{x.tx[lang][1]}</div>
                    </div>
                    <span className="flex-none text-[11.5px] text-muted-2">{x.time}</span>
                  </div>
                );
              })}
              {rest > 0 && (
                <button type="button" onClick={() => setShown((s) => ({ ...s, [g.key]: n + STEP }))} className="w-full cursor-pointer bg-[#f8faff] p-[13px] text-center text-[13px] font-bold text-blue-2 hover:bg-blue-tint">
                  {more}{Math.min(rest, STEP)}{lang === "EN" ? " more" : ""} · {g.list.length}
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
