"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { IconCheck, IconFolderPlus, IconHeart, IconHeartFilled, IconLayoutGrid, IconMapPin, IconRuler, IconStairs, IconWorldUpload } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { eqOf, fmt } from "@/lib/money";
import { useRealtor } from "@/store/realtors";
import { useMeId } from "@/store/profile";
import { oldPrice, type Listing } from "@/lib/types";
import { ExportModal, PORTALS, expCount } from "@/components/obj/ExportModal";
import { prevScreenFromPath, setPrevScreen, useListingMeta } from "@/store/listings";
import { usePrefs } from "@/store/prefs";

const BADGE = {
  new: { c: "#22c15e", l: { RU: "Новый", EN: "New", TR: "Yeni" } },
  hot: { c: "#e5484d", l: { RU: "Горячее", EN: "Hot", TR: "Fırsat" } },
  exc: { c: "#7b4fd0", l: { RU: "Эксклюзив", EN: "Exclusive", TR: "Özel" } },
} as const;
const ST_BADGE: Record<string, string> = { reserved: "#f0ad00", sold: "#8a93a2", off: "#e5484d" };

export function ListingCard({ o, currentUser }: { o: Listing; currentUser?: string }) {
  const { t, lang } = useI18n();
  const meId = useMeId();
  const realtorOf = useRealtor();
  const { favs, sel, toggleFav, toggleSel } = usePrefs();
  const { expMap } = useListingMeta();
  const path = usePathname();
  const [expOpen, setExpOpen] = useState(false);
  const inSel = sel.includes(o.id);
  const fav = favs.includes(o.id);
  const owner = realtorOf(o.owner);
  const isMine = o.owner === (currentUser ?? meId);
  const st = o.st;
  const badge = o.badge ? BADGE[o.badge] : null;
  const old = oldPrice(o);
  const hasOld = !!old && old > o.price && st === "active";
  const price = fmt(o.price, o.cur) + (o.deal === "rent" ? t.cat.perMo : o.deal === "daily" ? t.cat.perDay : "");
  const href = `/obj/${o.id}`;
  // Prototype `open`: remember the screen we came from so «Назад» on the object returns here.
  const remember = () => { const ps = prevScreenFromPath(path); if (ps) setPrevScreen(ps); };
  // Prototype `expShow`: portal export button only on «Мои объекты» for own listings.
  const expShow = isMine && path.startsWith("/mine");

  const iconBtn = "absolute right-[10px] flex h-[31px] w-[31px] cursor-pointer items-center justify-center rounded-[9px] text-[15px] transition"; // hover — у каждого состояния свой (12.10.2026: общий hover:bg-line-2 красил активную синюю кнопку в белый)

  return (
    <article
      className={`relative overflow-hidden rounded-[16px] bg-surface transition-shadow hover:shadow-[0_12px_32px_rgba(20,36,63,.10)] ${
        inSel ? "border border-blue shadow-[0_0_0_1px_#4d7cfe]" : "border border-line"
      }`}
    >
      <Link href={href} onClick={remember} className="relative block h-[210px] bg-cover bg-center hover:brightness-95" style={{ backgroundImage: `url('${o.img}')` }}>
        {(badge || st !== "active") && (
          <span
            className="absolute left-[10px] top-[10px] rounded-[7px] px-[10px] py-1 text-[10.5px] font-bold text-white"
            style={{ background: st !== "active" ? ST_BADGE[st] : badge!.c }}
          >
            {st !== "active" ? t.stt[st] : badge!.l[lang]}
          </span>
        )}
        {inSel && (
          <span className="absolute bottom-[10px] left-[10px] inline-flex items-center gap-1 rounded-[7px] bg-blue-2 px-[10px] py-1 text-[10.5px] font-bold text-white">
            <IconCheck size={11} stroke={3} /> {t.sel.inSel}
          </span>
        )}
      </Link>
      <button
        type="button"
        title={t.cat.fav}
        onClick={() => toggleFav(o.id)}
        className={`${iconBtn} top-[10px] bg-[rgba(255,255,255,.94)] hover:bg-line-2 ${fav ? "text-red" : "text-muted"}`}
      >
        {fav ? <IconHeartFilled size={15} /> : <IconHeart size={15} />}
      </button>
      <button
        type="button"
        title={inSel ? t.obj.inSel : t.obj.addSel}
        onClick={() => toggleSel(o.id)}
        className={`${iconBtn} top-[47px] ${inSel ? "bg-blue-2 text-white hover:bg-[#e5484d]" : "bg-[rgba(255,255,255,.94)] text-text hover:bg-line-2"}`}
      >
        {inSel ? <IconCheck size={15} stroke={2.5} /> : <IconFolderPlus size={15} />}
      </button>

      <Link href={href} onClick={remember} className="block px-[15px] py-[13px] hover:brightness-95">
        <div className="truncate text-[14.5px] font-bold text-ink">{o.t[lang]}</div>
        <div className="my-[3px] mb-[2px] flex flex-wrap items-baseline gap-2">
          <span className="text-[18.5px] font-extrabold text-blue">{price}</span>
          {hasOld && (
            <>
              <span className="text-[12.5px] text-muted-2 line-through">{fmt(old!, o.cur)}</span>
              <span className="rounded-[10px] bg-green-tint px-[7px] py-[2px] text-[10.5px] font-bold text-green">−{fmt(old! - o.price, o.cur)}</span>
            </>
          )}
        </div>
        <div className="mb-[9px] text-[11.5px] text-muted">{eqOf(o)}</div>
        {o.vnj && st === "active" && (
          <div className="-mt-[3px] mb-[9px] flex flex-wrap gap-[6px]">
            <span className="rounded-[10px] bg-[#e7f0fd] px-[9px] py-[3px] text-[10.5px] font-bold text-[#1565c0]">{t.cat.vnjChip}</span>
            {o.cit && <span className="rounded-[10px] bg-[#efe7fb] px-[9px] py-[3px] text-[10.5px] font-bold text-[#7b4fd0]">{t.cat.citChip}</span>}
          </div>
        )}
        <div className="flex flex-wrap gap-[10px] text-[12px] text-muted">
          {o.rooms && <span className="inline-flex items-center gap-1"><IconLayoutGrid size={13} /> {o.rooms}</span>}
          <span className="inline-flex items-center gap-1"><IconRuler size={13} /> {o.area} м²</span>
          {o.fl && o.fl !== "—" && <span className="inline-flex items-center gap-1"><IconStairs size={13} /> {o.fl}</span>}
          <span className="inline-flex items-center gap-1"><IconMapPin size={13} /> {o.loc[lang]}</span>
        </div>
        <div className="mt-[11px] flex items-center gap-2 border-t border-[#f2f4f8] pt-[10px]">
          {!isMine && owner && (
            <>
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[9px] font-bold text-white" style={{ background: owner.color }}>
                {owner.name.split(" ").map((w) => w[0]).join("")}
              </span>
              <span className="truncate text-[12.5px] text-text">{owner.name}</span>
            </>
          )}
          {isMine && <span className="rounded-[14px] bg-green-tint px-[9px] py-[3px] text-[11px] font-bold text-green">{t.obj.mineTag}</span>}
          <div className="flex-1" />
          {expShow && (
            <span
              onClick={(e) => { e.preventDefault(); e.stopPropagation(); setExpOpen(true); }}
              className="inline-flex cursor-pointer items-center gap-[5px] rounded-[14px] border border-line px-[10px] py-1 text-[11.5px] font-bold text-text hover:border-blue hover:text-blue"
            >
              <IconWorldUpload size={13} /> {expCount(expMap[o.id])}/{PORTALS.length}
            </span>
          )}
        </div>
      </Link>
      {expShow && <ExportModal id={o.id} open={expOpen} onClose={() => setExpOpen(false)} />}
    </article>
  );
}
