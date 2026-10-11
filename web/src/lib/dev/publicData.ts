import "server-only";

// Данные для публичных страниц кабинета застройщика — читаются на сервере сервисным ключом (аноним RLS не проходит).
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { slugOf } from "@/lib/dev/data";
import type { RealCompany } from "@/store/dev";
import type { DevObjectRow } from "@/store/devRemote";

type DevRow = { id: string; name: string; director: string | null; active: boolean | null; access_until: string | null };
const toCompany = (d: DevRow): RealCompany => ({ uuid: d.id, name: d.name, director: d.director ?? "", active: d.active !== false, until: d.access_until ?? "" });

/** Объект по slug публичной страницы + его компания. Без сервисного ключа — пусто (остаются демо-данные браузера). */
export async function loadPublicObject(slug: string): Promise<{ rows: DevObjectRow[]; companies: RealCompany[] }> {
  if (!hasServiceRole() || !process.env.NEXT_PUBLIC_SUPABASE_URL) return { rows: [], companies: [] };
  const admin = createAdminClient();
  const { data: rows } = await admin.from("dev_objects").select("*").eq("slug", slug).order("updated_at", { ascending: false });
  const list = (rows ?? []) as DevObjectRow[];
  if (!list.length) return { rows: [], companies: [] };
  const { data: devs } = await admin.from("developers").select("id, name, director, active, access_until").in("id", [...new Set(list.map((r) => r.developer_id))]);
  return { rows: list, companies: ((devs ?? []) as DevRow[]).map(toCompany) };
}

/** Все объекты застройщика по slug его названия. */
export async function loadPublicDeveloper(slug: string): Promise<{ rows: DevObjectRow[]; companies: RealCompany[] }> {
  if (!hasServiceRole() || !process.env.NEXT_PUBLIC_SUPABASE_URL) return { rows: [], companies: [] };
  const admin = createAdminClient();
  const { data: devs } = await admin.from("developers").select("id, name, director, active, access_until");
  const dev = ((devs ?? []) as DevRow[]).find((d) => slugOf(d.name) === slug);
  if (!dev) return { rows: [], companies: [] };
  const { data: rows } = await admin.from("dev_objects").select("*").eq("developer_id", dev.id);
  return { rows: (rows ?? []) as DevObjectRow[], companies: [toCompany(dev)] };
}
