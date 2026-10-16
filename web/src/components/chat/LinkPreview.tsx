"use client";

// Карточка-превью ссылки OnePlan в сообщении чата (16.10.2026): маленькое фото, заголовок, строка описания, домен — как в
// WhatsApp. Данные — серверный экшен `linkPreview` (только наши ссылки), кэш на сессию по URL.
import { useEffect, useState } from "react";
import { linkPreview, type LinkPreview } from "@/app/link-preview-actions";

const cache = new Map<string, Promise<LinkPreview | null>>();
const OPL = /^https?:\/\/(?:www\.|ai\.)?(?:one-plan\.pro|localhost(?::\d+)?)\/(?:obj\/[0-9a-f-]{36}|s\/[A-Za-z0-9-]{1,40})\/?$/i;
/** Первая ссылка OnePlan (объект или подборка) в тексте сообщения — для неё рисуется карточка. */
export function firstOplLink(urls: string[]): string | null { return urls.find((u) => OPL.test(u)) ?? null; }

export function LinkCard({ url, mine }: { url: string; mine: boolean }) {
  const [p, setP] = useState<LinkPreview | null | undefined>(undefined);
  useEffect(() => {
    let alive = true;
    if (!cache.has(url)) cache.set(url, linkPreview(url).catch(() => null));
    void cache.get(url)!.then((v) => { if (alive) setP(v); });
    return () => { alive = false; };
  }, [url]);
  if (!p) return null;
  const host = url.replace(/^https?:\/\//, "").split("/")[0];
  return (
    <a href={url} target="_blank" rel="noreferrer" className={`mt-[8px] flex gap-[10px] overflow-hidden rounded-[10px] border p-[8px] no-underline hover:brightness-[.97] ${mine ? "border-[rgba(255,255,255,.25)] bg-[rgba(255,255,255,.14)] text-white" : "border-line bg-bg-2 text-ink"}`}>
      {p.img && <span className="h-[56px] w-[56px] flex-none rounded-[7px] bg-cover bg-center" style={{ backgroundImage: `url('${p.img}')` }} />}
      <span className="min-w-0 flex-1">
        <span className="block truncate text-[12.5px] font-bold leading-[1.3]">{p.title}</span>
        <span className={`block truncate text-[11.5px] leading-[1.35] ${mine ? "text-[rgba(255,255,255,.8)]" : "text-text-2"}`}>{p.desc}</span>
        <span className={`block truncate text-[10.5px] ${mine ? "text-[rgba(255,255,255,.6)]" : "text-muted"}`}>{host}</span>
      </span>
    </a>
  );
}
