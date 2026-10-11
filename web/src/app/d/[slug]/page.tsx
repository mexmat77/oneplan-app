// Публичная страница застройщика — docs/prototype-developer-spec.md §1.18 (клиентский компонент `DevPublic`).
// Объекты компании берутся из Supabase на сервере и кладутся в стор (`DevSeed`).
import { DevPublic } from "@/components/dev/public/DevPublic";
import { DevSeed } from "@/components/dev/public/DevSeed";
import { loadPublicDeveloper } from "@/lib/dev/publicData";

export const dynamic = "force-dynamic";

export default async function Page({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { rows, companies } = await loadPublicDeveloper(slug);
  return <DevSeed rows={rows} companies={companies}><DevPublic slug={slug} /></DevSeed>;
}
