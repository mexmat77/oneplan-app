"use client";

import { Suspense } from "react";
import Link from "next/link";
import { AvatarZoom } from "@/components/ui/AvatarZoom";
import { Avatar } from "@/components/ui/UserMenu";
import { useRouter, useSearchParams } from "next/navigation";
import { IconArrowLeft, IconBrandWhatsapp, IconBuildingSkyscraper, IconMessageCircle, IconPhone } from "@tabler/icons-react";
import { useMemo } from "react";
import { CatalogGrid } from "@/components/catalog/CatalogGrid";
import { useI18n } from "@/i18n/provider";
import { useRealtorList } from "@/store/realtors";
import { useRealtor } from "@/store/realtors";
import { useAdmin } from "@/store/admin";
import { useAllListings } from "@/store/listings";

function CatalogInner() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const all = useAllListings();
  const sp = useSearchParams();
  const owner = sp.get("owner") ?? "";
  const agency = sp.get("agency") ?? "";
  const realtorOf = useRealtor();
  const r = owner ? realtorOf(owner) ?? null : null;
  const count = r ? all.filter((o) => o.owner === owner).length : 0; // prototype `rProf.count` counts sold too
  // Страница агентства: все его риэлторы из базы и их объекты (пока данные тестовые — `REALTORS`; реквизиты из стора админки)
  const realtors = useRealtorList(); // с входом — профили из базы, демо-справочник только без входа
  // на странице агентства — только риэлторы с объектами в базе (16.10.2026, «если 0 квартир — не показывать»)
  const team = useMemo(() => (agency ? realtors.filter((x) => x.ag === agency && all.some((o) => o.owner === x.id)) : []), [agency, realtors, all]);
  const teamIds = useMemo(() => team.map((x) => x.id), [team]);
  const agMeta = useAdmin().agencies.find((a) => a.name === agency);
  const agCount = agency ? all.filter((o) => teamIds.includes(o.owner)).length : 0;
  // агентство — ссылка на его страницу только когда там есть кто-то кроме этого риэлтора (как на странице объекта)
  const agLink = (name: string) => (!name || name === "—" ? <>{t.cat.freeAgent}</> : realtors.filter((x) => x.ag === name).length > 1 ? <Link href={`/catalog?agency=${encodeURIComponent(name)}`} className="font-semibold text-blue hover:text-blue-2">{name}</Link> : <>{name}</>);
  return (
    <>
      {agency ? (
        <>
          <Link href="/catalog" className="mb-[14px] inline-flex items-center gap-[7px] text-[13.5px] font-bold text-blue hover:text-blue-2"><IconArrowLeft size={16} /> {t.cat.profBack}</Link>
          <div data-card="1" className="mb-5 rounded-[20px] border border-line-4 bg-surface px-6 py-[22px] shadow-[0_1px_3px_rgba(20,36,63,.05)]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex h-16 w-16 flex-none items-center justify-center rounded-[18px] bg-blue-tint text-blue"><IconBuildingSkyscraper size={30} /></span>
              <div className="min-w-[200px] flex-1">
                <div className="text-[19px] font-extrabold leading-[1.25] tracking-[-0.01em] text-ink">{agency}</div>
                {(agMeta?.addr || agMeta?.lic) && <div className="mt-[3px] text-[13px] leading-[1.4] text-muted">{[agMeta?.addr, agMeta?.lic ? `${t.cat.agLic} ${agMeta.lic}` : ""].filter(Boolean).join(" · ")}</div>}
                <div className="mt-[2px] text-[12.5px] leading-[1.4] text-text-2"><span className="font-bold text-ink">{team.length}</span> {t.cat.agRls} · <span className="font-bold text-ink">{agCount}</span> {t.cat.agObjs}</div>
              </div>
              {agMeta?.phone && (
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-[15px] font-extrabold text-ink">{agMeta.phone}</span>
                  <a href={`tel:${agMeta.phone.replace(/\s/g, "")}`} title={t.obj.callL} className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-blue-2 text-white hover:bg-blue-3"><IconPhone size={17} /></a>
                  <a href={`https://wa.me/${agMeta.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" title="WhatsApp" className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#22c15e] text-white hover:bg-[#1ba851]"><IconBrandWhatsapp size={17} /></a>
                </div>
              )}
            </div>
            {team.length > 0 && (
              <div className="mt-[18px] border-t border-line-2 pt-4">
                <div className="mb-[10px] text-[12px] font-bold uppercase tracking-[.06em] text-muted">{t.cat.agTeam}</div>
                <div className="flex flex-wrap gap-2">
                  {team.map((x) => (
                    <Link key={x.id} href={`/catalog?owner=${x.id}`} className="flex items-center gap-[9px] rounded-[12px] border border-line bg-surface py-[7px] pl-[7px] pr-[14px] hover:border-blue">
                      <Avatar name={x.name} src={x.av} size={32} color={x.color} />
                      <span className="min-w-0"><span className="block truncate text-[13px] font-bold text-ink">{x.name}</span><span className="block text-[11.5px] text-muted">{all.filter((o) => o.owner === x.id).length} {t.cat.profObjs}</span></span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>
      ) : r ? (
        <>
          <Link href="/catalog" className="mb-[14px] inline-flex items-center gap-[7px] text-[13.5px] font-bold text-blue hover:text-blue-2"><IconArrowLeft size={16} /> {t.cat.profBack}</Link>
          <div data-card="1" className="mb-5 flex flex-wrap items-center gap-4 rounded-[20px] border border-line-4 bg-surface px-6 py-[22px] shadow-[0_1px_3px_rgba(20,36,63,.05)]">
            <AvatarZoom name={r.name} src={r.av} size={64} color={r.color} />
            <div className="min-w-[200px] flex-1">
              <div className="text-[19px] font-extrabold leading-[1.25] tracking-[-0.01em] text-ink">{r.name}</div>
              <div className="mt-[3px] text-[13px] leading-[1.4] text-muted">{agLink(r.ag)}{[r.city?.[lang], r.langs].filter(Boolean).map((x, i) => <span key={i}> · {x}</span>)}</div>
              <div className="mt-[2px] text-[12.5px] leading-[1.4] text-text-2"><span className="font-bold text-ink">{count}</span> {t.cat.profObjs}</div>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <span className="text-[15px] font-extrabold text-ink">{r.phone}</span>
              <a href={`tel:${r.phone.replace(/\s/g, "")}`} title={t.obj.callL} className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-blue-2 text-white hover:bg-blue-3"><IconPhone size={17} /></a>
              <a href={`https://wa.me/${r.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" title="WhatsApp" className="flex h-[38px] w-[38px] items-center justify-center rounded-full bg-[#22c15e] text-white hover:bg-[#1ba851]"><IconBrandWhatsapp size={17} /></a>
              <button type="button" onClick={() => router.push(`/chat?with=${owner}`)} className="inline-flex cursor-pointer items-center gap-[7px] rounded-[10px] border border-line bg-surface px-[15px] py-[10px] text-[13px] font-bold text-ink hover:border-blue hover:text-blue"><IconMessageCircle size={15} /> {t.obj.chat}</button>
            </div>
          </div>
        </>
      ) : (
        <div className="mb-4 flex flex-wrap items-start gap-4">
          <div className="min-w-[260px] flex-1">
            <div className="mb-3 flex w-fit gap-[6px] rounded-[12px] bg-line-2 p-1">
              <span className="rounded-[9px] bg-surface px-[14px] py-[7px] text-[12.5px] font-bold text-ink shadow-[0_1px_3px_rgba(20,36,63,.12)]">{t.newb.resale}</span>
              <Link href="/newb" className="rounded-[9px] px-[14px] py-[7px] text-[12.5px] font-bold text-muted hover:bg-line-2">{t.newb.title}</Link>
            </div>
            <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.cat.title}</h1>
            <p className="mt-[5px] max-w-[640px] text-[14px] text-text-2 [text-wrap:pretty]">{t.cat.sub}</p>
          </div>
        </div>
      )}
      <CatalogGrid all={all} mode="catalog" showSaveSearch={!r && !agency} owner={owner || undefined} owners={agency ? teamIds : undefined} />
    </>
  );
}

export default function CatalogPage() {
  return <Suspense><CatalogInner /></Suspense>;
}
