"use client";

// Публичные страницы (/p/<slug>, /d/<slug>) получают объекты из Supabase на сервере и перед показом кладут их в стор кабинета
// (`applyRows`), чтобы `ObjectPublic` / `DevPublic` работали как прежде — они читают `useDev()`. Пока стор не наполнен — ничего не рисуем.
import { useEffect, useSyncExternalStore, type ReactNode } from "react";
import { getDev, subscribeDev, syncRealCompanies, type RealCompany } from "@/store/dev";
import { applyRows, type DevObjectRow } from "@/store/devRemote";

export function DevSeed({ rows, companies, children }: { rows: DevObjectRow[]; companies: RealCompany[]; children: ReactNode }) {
  const seeded = useSyncExternalStore(
    subscribeDev,
    () => { const s = getDev(); return rows.every((r) => s.projects.some((p) => p.id === r.id)) && companies.every((c) => s.companies.some((x) => x.name === c.name)); },
    () => false,
  );
  useEffect(() => { if (!seeded) { if (companies.length) syncRealCompanies(companies, null); applyRows(rows); } }, [seeded, rows, companies]);
  if (!seeded) return null;
  return <>{children}</>;
}
