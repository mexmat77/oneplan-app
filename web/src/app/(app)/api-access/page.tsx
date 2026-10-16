"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { IconCopy, IconHeadset, IconKey, IconPlugConnected, IconRefresh } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { confirmDialog } from "@/components/ui/confirm";
import { showToast } from "@/components/ui/toast";
import { getAgencyApiKey, getApiKey, rotateAgencyApiKey, rotateApiKey } from "@/app/(app)/api-actions";

const EXAMPLE = `{"total": 12, "count": 12, "realtor": "…", "agency": "…", "items": [
 {"id": "OP-100003", "uuid": "e5dd730c-…", "deal": "sale", "type": "flat", "rooms": "2+1",
  "price": 8640000, "currency": "TRY", "title": {"RU": "…", "EN": "…", "TR": "…"}, "description": {"RU": "…"},
  "location": {"il": "antalya", "il_name": "Antalya", "ilce": "konyaalti", "mahalle": "hurma", "lat": 36.86, "lng": 30.64},
  "area": {"gross": 120, "net": 105}, "floor": 3, "floors_total": 5, "photos": ["https://…/1.jpg"],
  "features": ["pool", "seaview"], "price_history": [{"date": "10.10.2026", "price": 8900000}],
  "url": "https://one-plan.pro/share/obj/e5dd730c-…", "updated_at": "2026-10-13T10:15:00Z"}]}`;

const card = "mb-[14px] rounded-[16px] border border-line bg-surface px-5 py-[18px]";

export default function ApiPage() {
  const { t, lang } = useI18n();
  const docs = `/api/docs?lang=${lang.toLowerCase()}`; // документация на языке интерфейса (17.10.2026)
  // Prototype `apiEps` (line 3945).
  const eps: [string, string][] = [["GET /api/v1/listings?key=…", t.api.ep1], ["GET /api/v1/listings/{uuid}?key=…", t.api.ep2], ["GET /api/v1/dictionaries?key=…", t.api.ep5], ["GET /feed/{key}.xml", t.api.ep3], ["POST {your-url} · webhook", t.api.ep4]];
  // ключ агентства (16.10.2026): общая выгрузка всех риэлторов агентства — создаёт администратор агентства
  const [ag, setAg] = useState<{ name: string; key: string | null; canManage: boolean } | null | undefined>(undefined);
  useEffect(() => { let on = true; getAgencyApiKey().then((a) => { if (on) setAg(a); }).catch(() => { if (on) setAg(null); }); return () => { on = false; }; }, []);
  const rotateAg = async () => { if (ag?.key && !(await confirmDialog({ text: t.api.keyRotateQ, ok: t.api.keyRotate, danger: true }))) return; setBusy(true); try { const k = await rotateAgencyApiKey(); setAg((a) => (a ? { ...a, key: k } : a)); showToast(t.api.keyDone); } catch { showToast(t.api.keyErr); } finally { setBusy(false); } };
  // реальный ключ (16.10.2026): показывается владельцу, создаётся/перевыпускается кнопкой
  const [key, setKey] = useState<string | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  useEffect(() => { let on = true; getApiKey().then((k) => { if (on) setKey(k); }).catch(() => { if (on) setKey(null); }); return () => { on = false; }; }, []);
  const rotate = async () => { if (key && !(await confirmDialog({ text: t.api.keyRotateQ, ok: t.api.keyRotate, danger: true }))) return; setBusy(true); try { setKey(await rotateApiKey()); showToast(t.api.keyDone); } catch { showToast(t.api.keyErr); } finally { setBusy(false); } };
  const copy = (s: string) => { try { navigator.clipboard.writeText(s); showToast(t.rl.copied); } catch {} };
  const site = typeof window !== "undefined" ? window.location.origin : "https://one-plan.pro";
  return (
    <div className="mx-auto max-w-[820px]">
      <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.api.title}</h1>
      <p className="mb-[18px] mt-[5px] max-w-[680px] text-[14px] leading-[1.55] text-text-2 [text-wrap:pretty]">{t.api.sub}</p>
      <div className={card}>
        <div className="mb-[9px] text-[12px] font-bold uppercase tracking-[.06em] text-muted">{t.api.keyL}</div>
        {key === undefined ? <div className="text-[13px] text-muted">…</div> : key ? (
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-block rounded-[10px] border border-line bg-bg-3 px-[14px] py-[11px] font-mono text-[13.5px] font-extrabold text-ink [overflow-wrap:anywhere]">{key}</span>
            <button type="button" onClick={() => copy(key)} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] border border-line bg-surface px-[14px] py-[10px] text-[13px] font-semibold text-text hover:bg-bg-3"><IconCopy size={15} /> {t.rl.copy}</button>
            <button type="button" onClick={() => void rotate()} disabled={busy} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] border border-line bg-surface px-[14px] py-[10px] text-[13px] font-semibold text-text hover:bg-bg-3 disabled:opacity-60"><IconRefresh size={15} /> {t.api.keyRotate}</button>
          </div>
        ) : (
          <button type="button" onClick={() => void rotate()} disabled={busy} className="inline-flex cursor-pointer items-center gap-2 rounded-[12px] bg-blue-2 px-[20px] py-[11px] text-[14px] font-bold text-white hover:bg-blue-3 disabled:opacity-60"><IconKey size={17} /> {t.api.keyGen}</button>
        )}
        <p className="mt-[10px] text-[12.5px] leading-[1.5] text-muted">{t.api.keyHint}</p>
        {key && <div className="mt-3 flex flex-col gap-1 font-mono text-[12px] text-[#2c3a52]">
          <a href={`${site}/api/v1/listings?key=${key}`} target="_blank" rel="noreferrer" className="hover:underline [overflow-wrap:anywhere]">{site}/api/v1/listings?key={key}</a>
          <a href={`${site}/feed/${key}.xml`} target="_blank" rel="noreferrer" className="hover:underline [overflow-wrap:anywhere]">{site}/feed/{key}.xml</a>
        </div>}
      </div>
      {ag && (
        <div className={card}>
          <div className="mb-[9px] text-[12px] font-bold uppercase tracking-[.06em] text-muted">{t.api.agKeyL} · {ag.name}</div>
          {!ag.canManage ? <p className="text-[13px] text-muted">{t.api.agKeyOnlyAdmin}</p> : ag.key ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="inline-block rounded-[10px] border border-line bg-bg-3 px-[14px] py-[11px] font-mono text-[13.5px] font-extrabold text-ink [overflow-wrap:anywhere]">{ag.key}</span>
              <button type="button" onClick={() => copy(ag.key!)} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] border border-line bg-surface px-[14px] py-[10px] text-[13px] font-semibold text-text hover:bg-bg-3"><IconCopy size={15} /> {t.rl.copy}</button>
              <button type="button" onClick={() => void rotateAg()} disabled={busy} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] border border-line bg-surface px-[14px] py-[10px] text-[13px] font-semibold text-text hover:bg-bg-3 disabled:opacity-60"><IconRefresh size={15} /> {t.api.keyRotate}</button>
            </div>
          ) : (
            <button type="button" onClick={() => void rotateAg()} disabled={busy} className="inline-flex cursor-pointer items-center gap-2 rounded-[12px] bg-blue-2 px-[20px] py-[11px] text-[14px] font-bold text-white hover:bg-blue-3 disabled:opacity-60"><IconKey size={17} /> {t.api.agKeyGen}</button>
          )}
          <p className="mt-[10px] text-[12.5px] leading-[1.5] text-muted">{t.api.agKeyHint}</p>
          {ag.key && <div className="mt-3 flex flex-col gap-1 font-mono text-[12px] text-[#2c3a52]">
            <a href={`${site}/api/v1/listings?key=${ag.key}`} target="_blank" rel="noreferrer" className="hover:underline [overflow-wrap:anywhere]">{site}/api/v1/listings?key={ag.key}</a>
            <a href={`${site}/feed/${ag.key}.xml`} target="_blank" rel="noreferrer" className="hover:underline [overflow-wrap:anywhere]">{site}/feed/{ag.key}.xml</a>
          </div>}
        </div>
      )}
      <div className={card}>
        <div className="mb-[11px] flex flex-wrap items-center gap-3"><span className="text-[14.5px] font-extrabold text-ink">{t.api.epT}</span><Link href={docs} target="_blank" className="text-[13px] font-semibold text-blue hover:underline">{t.api.docsLink} ↗</Link></div>
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
      <div className={card}>
        <div className="mb-[6px] text-[14.5px] font-extrabold text-ink">{t.api.inT}</div>
        <p className="mb-3 text-[13px] leading-[1.55] text-text-2">{t.api.inS}</p>
        <div className="mb-3 rounded-[11px] border border-line-2 px-[13px] py-[10px] font-mono text-[12.5px] text-[#2c3a52] [overflow-wrap:anywhere]"><span className="font-extrabold text-blue-2">POST</span> https://one-plan.pro/api/crm/inbound · Authorization: Bearer ops_…</div>{/* статичный домен: `site` из window ломал гидрацию */}
        <div className="flex flex-wrap gap-2">
          <Link href="/crm/settings/sources" className="inline-flex items-center gap-[6px] rounded-[10px] bg-blue-2 px-[14px] py-[9px] text-[13px] font-bold text-white hover:bg-blue-3"><IconKey size={15} /> {t.api.inLink}</Link>
          <Link href={`${docs}#crm-inbound`} target="_blank" className="inline-flex items-center gap-[6px] rounded-[10px] border border-line bg-surface px-[14px] py-[9px] text-[13px] font-semibold text-text hover:bg-bg-3">{t.api.inDocs}</Link>
        </div>
      </div>
      <div className="mb-4 flex items-start gap-[9px] rounded-[12px] bg-bg-3 px-[14px] py-3 text-[12.5px] leading-[1.5] text-text"><IconPlugConnected size={16} className="mt-[1px] flex-none text-blue" /><span>{t.exp.apiS}</span></div>
      <Link href="/chat?with=sup" className="inline-flex items-center gap-2 rounded-[12px] bg-blue-2 px-[26px] py-[13px] text-[14px] font-bold text-white hover:bg-blue-3"><IconHeadset size={18} /> {t.api.cta}</Link>
    </div>
  );
}
