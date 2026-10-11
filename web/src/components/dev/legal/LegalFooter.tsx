"use client";

// Footer links of the public pages (prototype `legalFooter`, line 3940): five Turkish document titles + «Все документы».
// The overlay itself is `@/components/dev/profile/LegalModal` (`initial` = document id or "index").
import { useDevT } from "@/i18n/dev";

export type LegalDocId = "index" | string;

export function LegalFooter({ onOpen }: { onOpen: (id: LegalDocId) => void }) {
  const { t } = useDevT();
  const items: [LegalDocId, string][] = [["uyelik", t.px.lf_uyelik], ["kosullar", t.px.lf_kosullar], ["kvkk", t.px.lf_kvkk], ["gizlilik", t.px.lf_gizlilik], ["cerez", t.px.lf_cerez], ["index", t.lg.all_docs]];
  return (
    <div className="flex flex-wrap items-center justify-center gap-x-4 gap-y-[6px] border-t border-line-2 px-[22px] pb-[26px] pt-[14px]">
      {items.map(([id, label]) => <a key={id} onClick={() => onOpen(id)} className="cursor-pointer text-[12px] text-muted no-underline hover:text-blue">{label}</a>)}
    </div>
  );
}
