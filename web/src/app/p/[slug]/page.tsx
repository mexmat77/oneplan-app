// Публичная страница объекта — docs/prototype-developer-spec.md §1.19 (клиентский компонент `ObjectPublic`).
// Объект берётся из Supabase на сервере и кладётся в стор (`DevSeed`); демо-объекты прототипа остаются в localStorage браузера.
import { DevSeed } from "@/components/dev/public/DevSeed";
import { ObjectPublic } from "@/components/dev/public/ObjectPublic";
import { loadPublicObject } from "@/lib/dev/publicData";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { rows, companies } = await loadPublicObject(slug);
  return <DevSeed rows={rows} companies={companies}><ObjectPublic slug={slug} /></DevSeed>;
}
