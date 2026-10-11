"use client";

import Link from "next/link";
import { IconHeadset, IconPlugConnected } from "@tabler/icons-react";
import { useT } from "@/i18n/provider";

const EXAMPLE = `{"id": "OP-O3", "deal": "sale", "type": "flat", "rooms": "2+1",
 "price": 8640000, "currency": "TRY",
 "location": {"il": "antalya", "ilce": "konyaalti", "mahalle": "hurma", "lat": 36.86, "lng": 30.64},
 "area": {"gross": 120, "net": 105}, "floor": 3, "photos": ["https://…/1.jpg"],
 "features": ["pool", "seaview"], "updated_at": "2026-08-24T10:15:00Z"}`;

const card = "mb-[14px] rounded-[16px] border border-line bg-surface px-5 py-[18px]";

export default function ApiPage() {
  const t = useT();
  // Prototype `apiEps` (line 3945).
  const eps: [string, string][] = [["GET /api/v1/listings", t.api.ep1], ["GET /api/v1/listings/{id}", t.api.ep2], ["GET /feed/{key}.xml", t.api.ep3], ["POST {your-url} · webhook", t.api.ep4]];
  return (
    <div className="mx-auto max-w-[820px]">
      <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.api.title}</h1>
      <p className="mb-[18px] mt-[5px] max-w-[680px] text-[14px] leading-[1.55] text-text-2 [text-wrap:pretty]">{t.api.sub}</p>
      <div className={card}>
        <div className="mb-[9px] text-[12px] font-bold uppercase tracking-[.06em] text-muted">{t.api.keyL}</div>
        {/* TODO: real per-user key from Supabase */}
        <span className="inline-block rounded-[10px] border border-dashed border-[#c3cad6] bg-bg-3 px-[14px] py-[11px] font-mono text-[14px] font-extrabold text-ink">opl_live_7f3k9q2m</span>
      </div>
      <div className={card}>
        <div className="mb-[11px] text-[14.5px] font-extrabold text-ink">{t.api.epT}</div>
        <div className="flex flex-col gap-[9px]">
          {eps.map(([m, d]) => (
            <div key={m} className="flex flex-wrap items-baseline gap-3 rounded-[11px] border border-line-2 px-[13px] py-[10px]">
              <span className="flex-none font-mono text-[12.5px] font-extrabold text-blue-2">{m}</span>
              <span className="min-w-[200px] flex-1 text-[12.5px] leading-[1.5] text-text">{d}</span>
            </div>
          ))}
        </div>
      </div>
      <div className={card}>
        <div className="mb-[11px] text-[14.5px] font-extrabold text-ink">{t.api.exT}</div>
        <pre className="overflow-x-auto rounded-[11px] bg-bg-3 px-[15px] py-[13px] font-mono text-[11.5px] leading-[1.7] text-[#2c3a52]">{EXAMPLE}</pre>
      </div>
      <div className="mb-4 flex items-start gap-[9px] rounded-[12px] bg-bg-3 px-[14px] py-3 text-[12.5px] leading-[1.5] text-text"><IconPlugConnected size={16} className="mt-[1px] flex-none text-blue" /><span>{t.exp.apiS}</span></div>
      <Link href="/chat?with=sup" className="inline-flex items-center gap-2 rounded-[12px] bg-blue-2 px-[26px] py-[13px] text-[14px] font-bold text-white hover:bg-blue-3"><IconHeadset size={18} /> {t.api.cta}</Link>
    </div>
  );
}
