"use client";

// Пульс присутствия вошедшего пользователя (22.10.2026): при открытии, затем раз в 60 с, пока вкладка видима, и сразу при
// возвращении во вкладку — `touchSeen()` пишет profiles.last_seen. Скрытая вкладка не шлёт (как Slack: «активен» = реально
// смотрит). Подключён в layout риэлтора и в DevShell застройщика.
import { useEffect } from "react";
import { touchSeen } from "@/app/presence-actions";

const EVERY = 60_000;

export function Presence({ meId }: { meId: string | null }) {
  useEffect(() => {
    if (!meId) return;
    let last = 0;
    const ping = () => { if (document.visibilityState !== "visible") return; const n = Date.now(); if (n - last < EVERY - 2000) return; last = n; void touchSeen().catch(() => {}); };
    ping();
    const id = setInterval(ping, EVERY);
    document.addEventListener("visibilitychange", ping);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", ping); };
  }, [meId]);
  return null;
}
