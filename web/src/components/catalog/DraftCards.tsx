"use client";

// Unfinished listing drafts on «Мои объекты» — prototype `draftShow/draftCards` (lines 346–363, 3782–3789).
// Several drafts live in `drafts[]` (store `opl-drafts`); «Продолжить» restores that exact snapshot into
// the form via the autosave key `opl-add-autosave` (prototype `dr.resume` sets the whole state).
import { useRouter } from "next/navigation";
import { IconPhotoOff, IconTrash } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { delDraft, setPrevScreen, useDrafts, type DraftSnap } from "@/store/listings";

export const AUTOSAVE_KEY = "opl-add-autosave";

const str = (v: unknown) => (typeof v === "string" ? v : "");

export function DraftCards() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const drafts = useDrafts();
  if (!drafts.length) return null;
  const resume = (dr: DraftSnap) => {
    const cp: Record<string, unknown> = { ...dr };
    delete cp.dcId;
    try { localStorage.setItem(AUTOSAVE_KEY, JSON.stringify(cp)); } catch {}
    setPrevScreen("mine");
    router.push("/add?draft=1"); // явное восстановление автосохранения (форма без параметра открывается чистой)
    window.scrollTo(0, 0);
  };
  return (
    <div className="mb-[14px] grid grid-cols-[repeat(auto-fill,minmax(310px,1fr))] gap-3">
      {drafts.map((dr) => {
        const photos = Array.isArray(dr.photos) ? (dr.photos as string[]) : [];
        const img = photos[0];
        const deal = str(dr.deal) as keyof typeof t.deal, type = str(dr.type) as keyof typeof t.typ;
        const sub = [t.deal[deal], t.typ[type], str(dr.rooms), str(dr.price) ? `${str(dr.price)} ₺` : null].filter(Boolean).join(" · ");
        return (
          <div key={dr.dcId} className="flex items-center gap-3 rounded-[16px] border-[1.5px] border-dashed border-[#d9b64a] bg-[#fffdf4] px-[15px] py-[13px]">
            <div className="flex h-[52px] w-16 flex-none items-center justify-center rounded-[10px] bg-[#f3ecd2] bg-cover bg-center text-[17px] text-[#c98d00]" style={{ backgroundImage: img ? `url(${img})` : "none" }}>{!img && <IconPhotoOff size={17} />}</div>
            <div className="min-w-0 flex-1">
              <div className="mb-[3px]"><span className="rounded-[7px] bg-[#c98d00] px-[7px] py-[2px] text-[9.5px] font-extrabold uppercase tracking-[.05em] text-white">{lang === "RU" ? "Черновик" : lang === "TR" ? "Taslak" : "Draft"}</span></div>
              <div className="truncate text-[13.5px] font-bold text-ink">{str(dr.title) || t.add.untitled}</div>
              <div className="truncate text-[11.5px] text-muted">{sub}</div>
            </div>
            <div className="flex flex-none flex-col items-center gap-[7px]">
              <button type="button" onClick={() => resume(dr)} className="cursor-pointer rounded-[8px] bg-[#c98d00] px-3 py-[7px] text-[12px] font-bold text-white hover:brightness-[.92]">{t.add.draftCont}</button>
              <span onClick={() => delDraft(dr.dcId)} className="cursor-pointer text-[13px] text-[#aab1bd] hover:text-red"><IconTrash size={13} /></span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
