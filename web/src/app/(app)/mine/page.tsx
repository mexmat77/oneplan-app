"use client";

import { Suspense } from "react";
import Link from "next/link";
import { IconPlus } from "@tabler/icons-react";
import { CatalogGrid } from "@/components/catalog/CatalogGrid";
import { DraftCards } from "@/components/catalog/DraftCards";
import { useT } from "@/i18n/provider";
import { useAllListings } from "@/store/listings";
import { useMeId } from "@/store/profile";


export default function MinePage() {
  const t = useT();
  const ME = useMeId();
  const mine = useAllListings().filter((o) => o.owner === ME);
  return (
    <>
      <div className="mb-4 flex flex-wrap items-start gap-4">
        <div className="min-w-[260px] flex-1">
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.mine.title}</h1>
          <p className="mt-[5px] max-w-[640px] text-[14px] text-text-2 [text-wrap:pretty]">{t.mine.sub}</p>
        </div>
        <Link href="/add" className="inline-flex flex-none items-center gap-[7px] rounded-[11px] bg-blue-2 px-[18px] py-[11px] text-[14px] font-bold text-white hover:bg-blue-3">
          <IconPlus size={17} /> {t.mine.add}
        </Link>
      </div>
      <DraftCards />
      <Suspense><CatalogGrid all={mine} mode="mine" /></Suspense>
    </>
  );
}
