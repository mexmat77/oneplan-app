// Notification view-model shared by the header dropdown and the «Все уведомления» page (prototype `notifBase`, 3756–3793).
import { NOTIFS, NOTIF_ICON, TEAM } from "./data";
import type { TeamDict } from "@/i18n/dev";

export type NotifView = {
  id: number; type: string; mins: number; who: string; init: string; color: string;
  icon: string; iconFg: string; iconBg: string; ev: string; obj: string; unit: string; extra: string; ago: string; unread: boolean;
};

export function agoText(m: number, tt: TeamDict): string {
  if (m < 1) return tt.ago_now;
  if (m < 60) return `${m} ${tt.ago_min}`;
  if (m < 1440) return `${Math.floor(m / 60)} ${tt.ago_h}`;
  return `${Math.floor(m / 1440)} ${tt.ago_d}`;
}

export function buildNotifs(tt: TeamDict, readIds: number[], cleared: boolean): NotifView[] {
  if (cleared) return [];
  const st = tt.st as Record<string, string>;
  const ev = tt.ev as Record<string, string>;
  return NOTIFS.map((n) => {
    const p = TEAM.find((x) => x.id === n.who) ?? TEAM[0];
    const ic = NOTIF_ICON[n.type];
    let ex = n.extra;
    if (n.type === "status" && ex) ex = st[ex] || ex;
    return {
      id: n.id, type: n.type, mins: n.mins, who: p.name, init: p.init, color: p.color,
      icon: ic[0], iconFg: ic[1], iconBg: ic[2],
      ev: ev[n.type], obj: n.obj, unit: n.unit ? `· ${n.unit}` : "", extra: ex ? ` → ${ex}` : "", ago: agoText(n.mins, tt),
      unread: !readIds.includes(n.id),
    };
  });
}
