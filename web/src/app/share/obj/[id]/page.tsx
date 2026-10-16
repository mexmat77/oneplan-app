import type { Metadata } from "next";
import Link from "next/link";
import { LogoMark } from "@/components/Logo";
import { fmtPrice, listingSummary, loadPublicListing } from "@/lib/listingPublic";

// Публичная «обложка» объекта для превью ссылки в мессенджерах (16.10.2026): боты (Telegram, WhatsApp…) с /obj/<id>
// переписываются сюда в proxy.ts; человек по этой же ссылке видит карточку-приглашение и кнопку «Войти и открыть».
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ id: string }> }): Promise<Metadata> {
  const { id } = await params;
  const o = await loadPublicListing(id);
  if (!o) return { title: "OnePlan — объект", robots: { index: false } };
  const s = listingSummary(o);
  return {
    title: s.title, description: s.description, robots: { index: false, follow: false },
    openGraph: { title: s.title, description: s.description, type: "website", siteName: "OnePlan", url: `/obj/${id}`, images: [{ url: `/share/obj/${id}/opengraph-image`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: s.title, description: s.description, images: [`/share/obj/${id}/opengraph-image`] },
  };
}

export default async function ShareObjPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const o = await loadPublicListing(id);
  return (
    <div className="flex min-h-screen items-center justify-center bg-bg px-4 py-10">
      <div className="w-full max-w-[520px] overflow-hidden rounded-[20px] border border-line bg-surface shadow-[0_18px_50px_rgba(20,36,63,.08)]">
        {o?.photos[0] && <div className="aspect-[16/9] bg-cover bg-center" style={{ backgroundImage: `url('${o.photos[0]}')` }} />}
        <div className="p-[26px]">
          <div className="mb-[14px] flex items-center gap-[9px] text-[19px] font-extrabold text-ink"><LogoMark size={26} /> OnePlan</div>
          {o ? (
            <>
              <div className="text-[20px] font-extrabold leading-[1.25] text-ink">{o.title}</div>
              <div className="mt-1 text-[22px] font-extrabold text-blue">{fmtPrice(o.price, o.cur)}</div>
              <div className="mt-1 text-[13.5px] text-text-2">{[o.rooms, o.area ? `${o.area} м²` : "", o.place].filter(Boolean).join(" · ")}</div>
              {o.realtor && <div className="mt-3 text-[13px] text-muted">{o.realtor}{o.agency ? ` · ${o.agency}` : ""}</div>}
            </>
          ) : <div className="text-[15px] font-bold text-ink">Объект не найден или снят с продажи</div>}
          <p className="mt-4 text-[13px] leading-[1.5] text-muted">Это закрытая база для риэлторов: фото, описание и контакты доступны участникам после входа.</p>
          <Link href={`/login?next=${encodeURIComponent(`/obj/${id}`)}`} className="mt-4 inline-flex w-full items-center justify-center rounded-[12px] bg-blue py-3 text-[14px] font-bold text-white hover:bg-blue-2">Войти и открыть объект</Link>
        </div>
      </div>
    </div>
  );
}
