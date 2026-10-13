"use client";

// Object page — prototype lines 1550–1721 (markup), 3420–3460 (mObj), modals 1767–1789 (export),
// 1854–1864 (report), 1602–1614 (contacts sheet), 4304–4315 (back / lightbox handlers).
import dynamic from "next/dynamic";
import Link from "next/link";
import { notFound, useParams, useRouter } from "next/navigation";
import { useState, useSyncExternalStore, type ReactNode } from "react";
import {
  IconUserShare,
  IconTrash,
  IconArrowLeft, IconBath, IconRefresh, IconBeach, IconBrandTelegram, IconBrandWechat, IconBrandWhatsapp, IconCalendar, IconCheck, IconChevronRight,
  IconDots, IconFlag, IconFlagFilled, IconFolderPlus, IconHeart, IconHeartFilled, IconInfoCircle, IconLayoutGrid, IconMapPin, IconMessageCircle,
  IconPencil, IconPhone, IconRuler2, IconShieldCog, IconSparkles, IconWorldUpload, IconX,
} from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { ST_STYLE, detail, geoAddr, hasDrop, metaDates, priceHistory, priceLabel, similar } from "@/lib/detail";
import { eqOf, fmt, useRates } from "@/lib/money";
import { REALTORS } from "@/lib/seed";
import { useRealtor } from "@/store/realtors";
import { useMeId } from "@/store/profile";
import { getPrevScreen, removeListing, setStOver, useAllListings, useListingMeta, useListingsReady } from "@/store/listings";
import { useRole } from "@/store/role";
import { oldPrice, type ListingStatus } from "@/lib/types";
import { Gallery } from "@/components/obj/Gallery";
import { ListingNote } from "@/components/obj/ListingNote";
import { ExportModal, expCount } from "@/components/obj/ExportModal";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { showToast } from "@/components/ui/toast";
import { confirmDialog } from "@/components/ui/confirm";
import { TransferModal } from "@/components/ui/TransferModal";
import { transferListing } from "@/app/(app)/transfer-actions";
import { upsertLocalListing } from "@/store/listings";
import { useScrollLock } from "@/hooks/useScrollLock";
import { usePrefs } from "@/store/prefs";
import { addReport, type ReportReason } from "@/store/admin";
import { hasSupabaseEnv } from "@/lib/supabase/client";
import { submitReport } from "@/app/(app)/report-actions";

const ObjMap = dynamic(() => import("@/components/obj/ObjMap"), { ssr: false, loading: () => <div className="h-[320px] bg-line-2" /> });

const BADGE = {
  new: { c: "#22c15e", l: { RU: "Новый", EN: "New", TR: "Yeni" } },
  hot: { c: "#e5484d", l: { RU: "Горячее", EN: "Hot", TR: "Fırsat" } },
  exc: { c: "#7b4fd0", l: { RU: "Эксклюзив", EN: "Exclusive", TR: "Özel" } },
} as const;

const REASONS: ReportReason[] = ["stale", "sold", "price", "dup", "other"];

const CARD = "rounded-[20px] border border-[#edf0f6] bg-surface shadow-[0_1px_3px_rgba(20,36,63,.05)]";
const Card = ({ children, className = "" }: { children: ReactNode; className?: string }) => (
  <section data-card="1" className={`${CARD} px-[26px] py-6 ${className}`}>{children}</section>
);
const H2 = ({ children, mb = 13 }: { children: ReactNode; mb?: number }) => <h2 className="text-[17px] font-extrabold tracking-[-0.01em] text-ink" style={{ marginBottom: mb }}>{children}</h2>;
const TILE_ICON = { rooms: IconLayoutGrid, area: IconRuler2, year: IconCalendar, bath: IconBath, sea: IconBeach };
const chipF = (on: boolean) =>
  `cursor-pointer rounded-[18px] border px-[13px] py-[9px] text-[12.5px] transition-[background,border-color] duration-[120ms] hover:bg-[#eef1f6] ${on ? "border-[#9db8f5] bg-blue-tint font-bold text-[#2c4a9e]" : "border-line bg-surface font-semibold text-[#3d4a5e]"}`;

const Channel = ({ bg, label, children, onClick }: { bg: string; label: string; children: ReactNode; onClick?: () => void }) => (
  <button type="button" onClick={onClick} className="flex w-[54px] cursor-pointer flex-col items-center gap-[5px] hover:brightness-[.96]">
    <span className="flex h-[46px] w-[46px] items-center justify-center rounded-full text-[20px] font-extrabold text-white" style={{ background: bg }}>{children}</span>
    <span className="text-[10.5px] font-semibold text-text-2">{label}</span>
  </button>
);

const useHydrated = () => useSyncExternalStore(() => () => {}, () => true, () => false);

export default function ObjPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { t, lang } = useI18n();
  const rates = useRates();
  const ME = useMeId();
  const realtorOf = useRealtor();
  const { isAdmin } = useRole();
  const { favs, sel, toggleFav, toggleSel } = usePrefs();
  const { expMap } = useListingMeta();
  const hydrated = useHydrated();
  const [contacts, setContacts] = useState(false);
  const [rpt, setRpt] = useState<null | { reason: "" | ReportReason; text: string; miss?: boolean }>(null);
  const [exp, setExp] = useState(false);
  const [transfer, setTransfer] = useState(false);
  const [trBusy, setTrBusy] = useState(false);
  useScrollLock(contacts);

  const all = useAllListings();
  const ready = useListingsReady(ME);
  const o = all.find((x) => x.id === id);
  // Объявления живут в браузере (демо) или в базе (с входом): «не найдено» — только после гидрации И первой загрузки из базы.
  if (!o) { if (hydrated && ready) notFound(); return null; }
  const d = detail(o, t);
  // владелец: демо-риэлтор или профиль из базы; если профиль ещё не загружен — заглушка без имени
  const owner = realtorOf(o.owner) ?? { id: o.owner, name: "—", ag: "", color: "#8a93a2", phone: "", city: { RU: "", EN: "", TR: "" }, langs: "", online: false, objs: 0, sels: 0, likes: 0, la: { RU: "", EN: "", TR: "" } };
  const isMine = o.owner === ME;
  const canEdit = isMine || isAdmin;
  const fav = favs.includes(o.id);
  const inSel = sel.includes(o.id);
  const badge = o.badge ? BADGE[o.badge] : null;
  const st = ST_STYLE[o.st];
  const old = oldPrice(o);
  const drop = hasDrop(o);
  const sim = similar(o, all);
  const expN = expCount(expMap[o.id]);
  const rateD = rates.date ? new Date(rates.date.split(".").reverse().join("-")) : new Date(); // дата бюллетеня ЦБ dd.mm.yyyy
  const rateNote = `${t.obj.rate} ${rateD.toLocaleDateString(lang === "RU" ? "ru-RU" : lang === "TR" ? "tr-TR" : "en-GB")}`;
  const ownerAv = owner.name.split(" ").map((w) => w[0]).join("");
  const hasAg = !!owner.ag && owner.ag !== "—";
  const agTeamN = hasAg ? Object.values(REALTORS).filter((x: { ag: string }) => x.ag === owner.ag).length : 0;
  const stChip = <span className="flex-none whitespace-nowrap rounded-[8px] px-[11px] py-[5px] text-[11px] font-bold" style={{ background: st.bg, color: st.c }}>{t.stt[o.st]}</span>;
  const chatWith = () => { router.push(`/chat?with=${o.owner}`); };
  const closeObj = () => { router.push(`/${getPrevScreen()}`); };
  // Жалоба уходит в таблицу `reports` (снимок карточки — объявления пока не в базе); без Supabase — демо-хранилище прототипа.
  const rptSend = async () => {
    if (!rpt) return;
    if (!rpt.reason) { setRpt({ ...rpt, miss: true }); showToast(`${t.rl.reqErr}: ${t.obj.rptS}`); return; }
    if (hasSupabaseEnv()) {
      const r = await submitReport({ reason: rpt.reason, text: rpt.text, listing_ref: o.id, listing_title: o.t[lang], listing_price: o.price, listing_cur: o.cur, listing_photo: o.img, listing_owner: owner?.name ?? null });
      if (!r.ok) { showToast(r.error || t.rl.reqErr); return; }
    } else {
      addReport({ listingId: o.id, reason: rpt.reason, text: rpt.text, from: ME });
    }
    setRpt(null);
    showToast(t.obj.rptDone);
  };

  return (
    <div className="animate-card">
      <div className="mb-[14px] flex items-center justify-between gap-[10px]">
        <button type="button" onClick={closeObj} className="inline-flex cursor-pointer items-center gap-[6px] text-[13px] font-semibold text-text-2 hover:text-blue">
          <IconArrowLeft size={16} /> {t.common.back}
        </button>
        {!isMine && (
          <button type="button" onClick={() => setRpt({ reason: "", text: "" })} className="inline-flex cursor-pointer items-center gap-[6px] text-[12.5px] font-semibold text-muted hover:text-red">
            <IconFlagFilled size={14} className="text-red" /> {t.obj.rptB}
          </button>
        )}
      </div>

      <div data-obj-cols="1" className="grid grid-cols-[minmax(0,1fr)_360px] items-start gap-5">
        <div className="min-w-0">
          <Gallery
            photos={o.photos}
            title={o.t[lang]}
            overlay={
              <>
                {badge && <span className="absolute left-[14px] top-[14px] rounded-[8px] px-3 py-[5px] text-[11px] font-bold text-white" style={{ background: badge.c }}>{badge.l[lang]}</span>}
                <span
                  title={t.cat.fav}
                  onClick={(e) => { e.stopPropagation(); toggleFav(o.id); }}
                  className={`absolute right-[14px] top-[14px] flex h-[42px] w-[42px] cursor-pointer items-center justify-center rounded-[12px] bg-[rgba(255,255,255,.95)] text-[19px] shadow-[0_4px_14px_rgba(20,36,63,.18)] hover:bg-line-2 ${fav ? "text-red" : "text-muted"}`}
                >
                  {fav ? <IconHeartFilled size={19} /> : <IconHeart size={19} />}
                </span>
              </>
            }
          />

          <div className="mt-[18px]">
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="min-w-[220px] flex-1 text-[clamp(24px,3vw,31px)] font-extrabold tracking-[-0.02em] text-ink">{o.t[lang]}</h1>
              {o.vnj && o.st === "active" && (
                <>
                  <span className="flex-none rounded-[10px] bg-[#e7f0fd] px-[11px] py-[5px] text-[11.5px] font-bold text-[#1565c0]">{t.cat.vnjChip}</span>
                  {o.cit && <span className="flex-none rounded-[10px] bg-[#efe7fb] px-[11px] py-[5px] text-[11.5px] font-bold text-[#7b4fd0]">{t.cat.citChip}</span>}
                </>
              )}
              {stChip}
            </div>
            <div className="mt-[6px] flex items-center gap-1 text-[13.5px] text-text-2"><IconMapPin size={15} className="text-blue" /> {geoAddr(o, lang)}</div>
            <div className="mt-[5px] text-[12px] text-muted-2">{metaDates(o, t)}</div>
          </div>

          <Card className="mt-[18px]">
            <H2 mb={14}>{t.obj.keyT}</H2>
            <div className="flex flex-wrap gap-[10px]">
              {d.tiles.map((k, i) => {
                const Icon = TILE_ICON[k.icon];
                return (
                  <div key={i} className="flex min-w-[150px] flex-[1_1_150px] items-center gap-3 rounded-[14px] bg-bg px-4 py-[14px]">
                    <Icon size={21} className="text-blue" />
                    <div>
                      <div className="text-[15.5px] font-extrabold text-ink">{k.v}</div>
                      <div className="mt-[1px] text-[11.5px] text-muted">{k.l}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="mt-[14px] grid grid-cols-[repeat(auto-fit,minmax(280px,1fr))] gap-x-8 gap-y-0">
              {d.paramRows.map((p, i) => (
                <div key={i} className="flex justify-between gap-3 border-b border-[#f2f4f8] px-[2px] py-[9px] text-[13px]">
                  <span className="text-muted">{p.l}</span>
                  <span className="text-right font-bold text-ink">{p.v}</span>
                </div>
              ))}
            </div>
          </Card>

          {d.featsL.length > 0 && (
            <Card className="mt-[18px]">
              <H2>{t.obj.inT}</H2>
              <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-2">
                {d.featsL.map((f) => <div key={f} className="flex items-center gap-2 text-[13.5px] text-[#3d4a5e]"><IconCheck size={15} className="text-green" /> {f}</div>)}
              </div>
            </Card>
          )}
          {d.infraL.length > 0 && (
            <Card className="mt-[18px]">
              <H2>{t.obj.infraT}</H2>
              <div className="flex flex-wrap gap-2">
                {d.infraL.map((f) => <span key={f} className="rounded-[16px] bg-blue-tint px-[14px] py-[7px] text-[12.5px] font-semibold text-[#2c4a9e]">{f}</span>)}
              </div>
            </Card>
          )}

          {/* личная заметка риэлтора — видна только ему (13.10.2026) */}
          <div className="mt-[18px]"><ListingNote id={o.id} /></div>

          <Card className="mt-[18px]">
            <H2>{t.obj.descT}</H2>
            <p className="mb-2 whitespace-pre-line text-[14px] leading-[1.65] text-[#3d4a5e] [text-wrap:pretty]">{o.desc[lang]}</p>
            {o.base !== lang && (
              <span className="inline-flex items-center gap-[6px] rounded-[14px] bg-[#efe7fb] px-[11px] py-1 text-[11.5px] font-semibold text-[#7b4fd0]"><IconSparkles size={13} /> {t.obj.aiFrom} {o.base}</span>
            )}
          </Card>

          {o.ph && (
            <Card className="mt-[18px]">
              <H2>{t.obj.ph}</H2>
              <div className="flex flex-col gap-[7px]">
                {priceHistory(o, lang).map((p, i) => (
                  <div key={i} className="flex items-center gap-[10px] text-[13.5px]">
                    <span className="min-w-[96px] text-muted">{p.d}</span>
                    <span className={`font-bold ${p.now ? "text-ink" : "text-muted"}`}>{p.p}</span>
                    {p.delta && <span className={`text-[11.5px] font-bold ${p.down ? "text-green" : "text-[#c98d00]"}`}>{p.delta}</span>}
                  </div>
                ))}
              </div>
            </Card>
          )}

          <section className={`${CARD} relative z-0 mt-[18px] overflow-hidden pt-6 [isolation:isolate]`}>
            <h2 data-card-pad="1" className="mb-[14px] px-[26px] text-[17px] font-extrabold tracking-[-0.01em] text-ink">{t.obj.locT}</h2>
            <ObjMap ll={o.ll} price={o.price} />
          </section>
        </div>

        <aside data-obj-side="1" className="sticky top-[78px] flex flex-col gap-4">
          <div className={`${CARD} p-6`}>
            <div className="flex flex-wrap items-baseline gap-[10px]">
              <span className="text-[31px] font-extrabold tracking-[-0.02em] text-ink">{priceLabel(o, t)}</span>
              {drop && <span className="text-[14px] text-muted-2 line-through">{fmt(old!, o.cur)}</span>}
            </div>
            <div className="mt-1 text-[14.5px] font-semibold text-text">{eqOf(o)}</div>
            {drop && <div className="mt-[9px]"><span className="rounded-[12px] bg-green-tint px-[11px] py-[5px] text-[11.5px] font-bold text-green">−{fmt(old! - o.price, o.cur)} · {t.obj.dropped}</span></div>}
            <div className="mt-2 flex items-center gap-1 text-[11.5px] text-muted"><IconInfoCircle size={13} /> {rateNote}</div>
            <div className="mb-1 mt-[15px] border-t border-[#f2f4f8]" />
            {[[t.obj.typeT, t.typ[o.type]], [t.obj.dealT, t.deal[o.deal]]].map(([l, v]) => (
              <div key={l} className="flex justify-between gap-3 py-[7px] text-[13.5px]"><span className="text-text-2">{l}</span><span className="font-bold text-ink">{v}</span></div>
            ))}
            <div className="flex items-center justify-between gap-3 py-[7px] text-[13.5px]"><span className="text-text-2">{t.obj.statusT}</span>{stChip}</div>
            <button
              type="button"
              onClick={() => toggleSel(o.id)}
              className={`mt-[14px] flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] p-[14px] text-[14px] font-bold hover:brightness-[.96] ${inSel ? "bg-[#e4f6ee] text-[#0f9d6b]" : "bg-blue-2 text-white shadow-[0_6px_16px_rgba(77,124,254,.22)]"}`}
            >
              {inSel ? <IconCheck size={18} /> : <IconFolderPlus size={18} />} {inSel ? t.obj.inSel : t.obj.addSel}
            </button>
          </div>

          {canEdit && (
            <div data-card="1" className={`${CARD} px-6 py-[22px]`}>
              {!isMine && <div className="mb-3 flex items-center gap-[7px] rounded-[9px] bg-[#efe7fb] px-[10px] py-[6px] text-[11.5px] font-bold text-[#7b4fd0]"><IconShieldCog size={14} /> {t.rl.adminEditN}</div>}
              <div className="mb-[11px] text-[12px] font-bold uppercase tracking-[.06em] text-muted">{t.obj.st}</div>
              <div className="mb-[14px] flex flex-wrap gap-[6px]">
                {(["active", "reserved", "sold", "off"] as ListingStatus[]).map((k) => (
                  <span key={k} onClick={() => setStOver(o.id, k)} className={`cursor-pointer rounded-[9px] border px-[13px] py-2 text-[12px] font-bold ${o.st === k ? "border-blue-2 bg-blue-2 text-white" : "border-line bg-surface text-text hover:bg-[#eef1f6]"}`}>{t.stt[k]}</span>
                ))}
              </div>
              {(o.st === "sold" || o.st === "off") && isMine && (
                <button type="button" onClick={() => { const id = crypto.randomUUID(); upsertLocalListing({ ...o, id, st: "active", relistedFrom: o.id, created: new Date().toISOString(), ph: [] }); router.push(`/obj/${id}`); }} className="mb-[10px] flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-[#bfe3cf] bg-green-tint p-3 text-[13.5px] font-bold text-green hover:brightness-95"><IconRefresh size={16} /> {t.obj.relist}</button>
              )}
              <Link href={`/add?edit=${o.id}`} className="mb-[10px] flex w-full items-center justify-center gap-2 rounded-[12px] border border-line bg-surface p-3 text-[13.5px] font-bold text-ink hover:border-blue hover:text-blue"><IconPencil size={16} /> {t.add.editB}</Link>
              <button type="button" onClick={() => setExp(true)} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-line bg-surface p-3 text-[13.5px] font-bold text-ink hover:border-blue hover:text-blue">
                <IconWorldUpload size={16} /> {t.exp.t} {expN > 0 && <span className="rounded-[12px] bg-green-tint px-2 py-[2px] text-[11px] font-bold text-green">{expN}/3</span>}
              </button>
              {/* передать объект другому риэлтору (12.10.2026): функция базы transfer_listing проверяет права */}
              <button type="button" onClick={() => setTransfer(true)} className="mt-[10px] flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] border border-line bg-surface p-3 text-[13.5px] font-bold text-ink hover:border-blue hover:text-blue"><IconUserShare size={16} /> {t.obj.transfer}</button>
              {/* удалить своё объявление (12.10.2026) — необратимо, поэтому с подтверждением */}
              <button type="button" onClick={async () => { if (!(await confirmDialog({ title: t.obj.delT, text: t.obj.delQ, danger: true, ok: t.obj.del }))) return; removeListing(o.id); showToast(t.obj.deleted); router.push("/mine"); }} className="mt-[10px] flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] p-3 text-[13.5px] font-bold text-red hover:bg-red-tint">
                <IconTrash size={16} /> {t.obj.del}
              </button>
            </div>
          )}

          {!isMine && (
            <div data-card="1" className={`${CARD} px-6 py-[22px]`}>
              <div className="mb-[13px] text-[12px] font-bold uppercase tracking-[.06em] text-muted">{t.obj.realtorT}</div>
              <div className="mb-[13px] flex items-center gap-3">
                <Link href={`/catalog?owner=${o.owner}`} className="flex h-14 w-14 flex-none items-center justify-center rounded-full text-[17px] font-bold text-white" style={{ background: owner.color }}>{ownerAv}</Link>
                <span className="min-w-0 flex-1">
                  <Link href={`/catalog?owner=${o.owner}`} className="block truncate text-[15px] font-extrabold leading-[1.3] text-ink hover:text-blue">{owner.name}</Link>
                  {/* агентство — ссылка на его страницу только когда в нём есть кто-то кроме этого риэлтора, иначе просто текст */}
                  {agTeamN > 1
                    ? <Link href={`/catalog?agency=${encodeURIComponent(owner.ag)}`} title={t.cat.agAll} className="group flex w-fit max-w-full items-center gap-[3px] text-[12px] leading-[1.4] text-muted hover:text-blue"><span className="min-w-0 truncate">{owner.ag}</span><IconChevronRight size={11} className="flex-none opacity-60 group-hover:opacity-100" /></Link>
                    : <span className="block truncate text-[12px] leading-[1.4] text-muted">{hasAg ? owner.ag : t.cat.freeAgent}</span>}
                  <Link href={`/catalog?owner=${o.owner}`} className="mt-[3px] flex w-fit items-center gap-[2px] text-[12px] font-bold leading-[1.4] text-blue hover:text-blue-2">{t.obj.allObjs} <IconChevronRight size={11} /></Link>
                </span>
              </div>
              <div className="mb-[13px] text-[18px] font-extrabold tracking-[.01em] text-ink">{owner.phone}</div>
              <div className="flex flex-wrap gap-[14px]">
                <Channel bg="#3b5fd6" label={t.obj.callL}><IconPhone size={20} /></Channel>
                <Channel bg="#22c15e" label="WhatsApp"><IconBrandWhatsapp size={20} /></Channel>
                <Channel bg="#229ed9" label="Telegram"><IconBrandTelegram size={20} /></Channel>
                <Channel bg="#7360f2" label="Viber"><span className="text-[17px]">V</span></Channel>
                <Channel bg="#7b4fd0" label="MAX"><span className="text-[14px]">MAX</span></Channel>
                <Channel bg="#07c160" label="WeChat"><IconBrandWechat size={20} /></Channel>
                <Channel bg="#eef3ff" label={t.nav.chat} onClick={chatWith}><IconMessageCircle size={20} className="text-blue" /></Channel>
              </div>
            </div>
          )}

          {sim.length > 0 && (
            <div data-card="1" className={`${CARD} px-6 py-[22px]`}>
              <div className="mb-[13px] text-[15px] font-extrabold text-ink">{t.obj.similarT}</div>
              <div className="flex flex-col gap-3">
                {sim.map((x) => (
                  <Link key={x.id} href={`/obj/${x.id}`} onClick={() => window.scrollTo(0, 0)} className="flex items-center gap-[11px] hover:brightness-[.96]">
                    <span className="h-12 w-16 flex-none rounded-[9px] bg-cover bg-center" style={{ backgroundImage: `url('${x.img}')` }} />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-semibold leading-[1.35] text-ink">{x.t[lang]}</span>
                      <span className="mt-[2px] block text-[13.5px] font-extrabold text-blue">{priceLabel(x, t)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </div>
          )}
        </aside>
      </div>

      {/* Mobile contact bar (`[data-obj-bar]`, shown ≤820 via globals.css) */}
      <div data-obj-bar="1" className="fixed inset-x-0 bottom-0 z-[210] hidden items-center gap-3 rounded-t-[16px] bg-surface px-[14px] pb-[calc(12px+env(safe-area-inset-bottom))] pt-[10px] shadow-[0_-8px_30px_rgba(20,36,63,.16)]">
        <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full text-[12px] font-bold text-white" style={{ background: owner.color }}>{ownerAv}</span>
        <div className="min-w-0 flex-1">
          <div className="whitespace-nowrap text-[16.5px] font-extrabold text-ink">{priceLabel(o, t)}</div>
          <div className="truncate text-[11px] text-muted">{eqOf(o)} · {owner.name}</div>
        </div>
        <div className="flex flex-none gap-[9px]">
          <a href={`tel:${owner.phone.replace(/\s/g, "")}`} className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-blue-2 text-[19px] text-white"><IconPhone size={19} /></a>
          <a href={`https://wa.me/${owner.phone.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex h-11 w-11 items-center justify-center rounded-[13px] bg-[#22c15e] text-[19px] text-white"><IconBrandWhatsapp size={19} /></a>
          <span onClick={() => setContacts((v) => !v)} className="relative flex h-11 w-11 cursor-pointer items-center justify-center rounded-[13px] bg-bg-2 text-[19px] text-ink hover:brightness-[.96]">
            <IconDots size={19} />
            <span className="absolute -right-1 -top-1 inline-flex h-4 min-w-4 items-center justify-center rounded-lg bg-blue-2 px-1 text-[9.5px] font-bold text-white">+5</span>
          </span>
        </div>
      </div>
      {contacts && (
        <>
          <div className="animate-bg fixed inset-0 z-[320] bg-[rgba(10,16,28,.5)]" onClick={() => setContacts(false)} />
          <div className="fixed inset-x-0 bottom-0 z-[330] rounded-t-[18px] bg-surface px-[18px] pb-[22px] pt-4 shadow-[0_-20px_60px_rgba(10,16,28,.35)]">
            <div className="mb-[6px] flex items-center gap-[10px]">
              <span className="flex-1 text-[15.5px] font-extrabold text-ink">{t.common.contact} · {owner.name}</span>
              <span onClick={() => setContacts(false)} className="flex h-[38px] w-[38px] cursor-pointer items-center justify-center rounded-[11px] bg-bg-2 text-[20px] text-text hover:brightness-[.96]"><IconX size={20} /></span>
            </div>
            {([
              ["#3b5fd6", <IconPhone key="p" size={17} />, t.obj.callL, owner.phone, undefined],
              ["#22c15e", <IconBrandWhatsapp key="w" size={17} />, "WhatsApp", "", undefined],
              ["#229ed9", <IconBrandTelegram key="t" size={17} />, "Telegram", "", undefined],
              ["#7360f2", <span key="v" className="text-[15px]">V</span>, "Viber", "", undefined],
              ["#7b4fd0", <span key="x" className="text-[11px]">MAX</span>, "MAX", "", undefined],
              ["#07c160", <IconBrandWechat key="c" size={17} />, "WeChat", "", undefined],
              ["#eef3ff", <IconMessageCircle key="m" size={17} className="text-blue-2" />, t.obj.chat, "", () => { setContacts(false); chatWith(); }],
            ] as [string, ReactNode, string, string, (() => void) | undefined][]).map(([bg, icon, label, right, onClick], i, arr) => (
              <div key={i} onClick={onClick} className={`flex cursor-pointer items-center gap-3 px-[2px] py-3 ${i < arr.length - 1 ? "border-b border-[#f2f4f8]" : "hover:brightness-[.96]"}`}>
                <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full text-[17px] font-extrabold text-white" style={{ background: bg }}>{icon}</span>
                <span className="flex-1 text-[14px] font-semibold text-ink">{label}</span>
                {right ? <span className="text-[13px] font-bold text-ink">{right}</span> : <IconChevronRight size={16} className="text-[#c3c9d4]" />}
              </div>
            ))}
          </div>
        </>
      )}

      {/* Report (prototype 1854–1864, 3933–3936) */}
      <Modal open={!!rpt} onClose={() => setRpt(null)} width={440} z={410} overlay={0.55} sheet="fit" style={{ maxWidth: "min(440px, 96vw)" }}>
        {rpt && (
          <>
            <div className="mb-[6px] flex items-center gap-[10px]"><span className="flex-1 text-[16px] font-extrabold text-ink">{t.obj.rptT}</span><ModalClose onClick={() => setRpt(null)} /></div>
            <p className="mb-[14px] text-[12.5px] leading-[1.5] text-text-2 [text-wrap:pretty]">{t.obj.rptS}</p>
            {/* причина обязательна: без выбора рамка группы подсвечивается красным */}
            <div className={`mb-[14px] flex flex-wrap gap-[6px] rounded-[12px] ${rpt.miss && !rpt.reason ? "outline outline-2 outline-offset-4 outline-red" : ""}`}>
              {REASONS.map((k) => <span key={k} onClick={() => setRpt({ ...rpt, reason: k, miss: false })} className={chipF(rpt.reason === k)}>{t.obj.rptR[k]}</span>)}
            </div>
            <textarea value={rpt.text} onChange={(e) => setRpt({ ...rpt, text: e.target.value })} placeholder={t.obj.rptPh} className="mb-[14px] min-h-[70px] w-full resize-y rounded-[11px] border border-line px-[13px] py-[11px] font-[inherit] text-[13.5px] outline-none" />
            <button type="button" onClick={rptSend} className="flex w-full cursor-pointer items-center justify-center gap-[6px] rounded-[12px] bg-red p-[13px] text-[14px] font-bold text-white hover:bg-[#c73a3f]"><IconFlag size={16} /> {t.obj.rptSend}</button>
          </>
        )}
      </Modal>

      <ExportModal id={o.id} open={exp} onClose={() => setExp(false)} />
      <TransferModal open={transfer} scope="agency" emptyText={t.obj.transferNone} title={t.obj.transferT} hint={t.obj.transferH} busy={trBusy} onClose={() => setTransfer(false)} onPick={async (toId, target) => { setTrBusy(true); try { await transferListing(o.id, toId); upsertLocalListing({ ...o, owner: toId }); setTransfer(false); showToast(t.obj.transferDone.replace("{name}", target?.name ?? "")); router.push("/mine"); } catch (e) { showToast((e as Error).message); } finally { setTrBusy(false); } }} />
    </div>
  );
}
