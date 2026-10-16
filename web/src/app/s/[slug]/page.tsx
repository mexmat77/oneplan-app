import { ClientView } from "@/components/sel/ClientView";
import type { Metadata } from "next";
import { headers } from "next/headers";
import { loadPublicSelection, pickSelectionLang, selectionSummary } from "@/lib/selectionsPublic";

// Публичная страница подборки: данные из базы грузит сервер (без входа); если подборки в базе нет (демо-режим, локальные
// подборки до переезда) — клиент ищет её в своём сторе, как раньше. `?preview=1` — предпросмотр риэлтора.
export const dynamic = "force-dynamic";

// Превью ссылки в Telegram/WhatsApp (13.10.2026, «просто ссылки — некрасиво»): заголовок, описание и картинка
// (app/s/[slug]/opengraph-image.tsx — обложка первого объекта, число объектов, цены, риэлтор).
export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicSelection(slug);
  if (!data) return { title: "OnePlan", robots: { index: false } };
  const sum = selectionSummary(data, pickSelectionLang(data, (await headers()).get("accept-language")));
  return {
    title: sum.title,
    description: sum.description,
    robots: { index: false, follow: false }, // персональная ссылка клиента — не для поисковиков
    openGraph: { title: sum.title, description: sum.description, type: "website", siteName: "OnePlan", url: `/s/${slug}`, images: [{ url: `/s/${slug}/opengraph-image`, width: 1200, height: 630 }] },
    twitter: { card: "summary_large_image", title: sum.title, description: sum.description, images: [`/s/${slug}/opengraph-image`] },
  };
}

export default async function SelectionPublicPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await loadPublicSelection(slug);
  // язык страницы: язык подборки → Accept-Language клиента → RU (16.10.2026); без данных (демо) — язык приложения
  const lang = data ? pickSelectionLang(data, (await headers()).get("accept-language")) : undefined;
  return <ClientView slug={slug} preview={sp.preview === "1"} data={data} lang={lang} />;
}
