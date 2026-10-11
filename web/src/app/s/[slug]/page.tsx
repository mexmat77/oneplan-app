import { ClientView } from "@/components/sel/ClientView";
import { loadPublicSelection } from "@/lib/selectionsPublic";

// Публичная страница подборки: данные из базы грузит сервер (без входа); если подборки в базе нет (демо-режим, локальные
// подборки до переезда) — клиент ищет её в своём сторе, как раньше. `?preview=1` — предпросмотр риэлтора.
export const dynamic = "force-dynamic";

export default async function SelectionPublicPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ preview?: string }> }) {
  const { slug } = await params;
  const sp = await searchParams;
  const data = await loadPublicSelection(slug);
  return <ClientView slug={slug} preview={sp.preview === "1"} data={data} />;
}
