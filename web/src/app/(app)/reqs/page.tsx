"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  IconBellRinging, IconBookmark, IconBroadcast, IconCheck, IconChevronDown, IconClock, IconEyeOff, IconHomeShare, IconInfoCircle,
  IconMapPin, IconMessageCircle, IconPencil, IconPlus, IconSend, IconTargetArrow, IconTrash, IconX,
} from "@tabler/icons-react";
import { GeoPicker } from "@/components/GeoPicker";
import { Modal } from "@/components/ui/Modal";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import type { Dict } from "@/i18n";
import { matchSearch } from "@/lib/filters";
import { GEO, REALTORS, SEMT2ILCE } from "@/lib/seed";
import { useRealtor } from "@/store/realtors";
import { getMeId, useMeId } from "@/store/profile";
import { useMahalleLoaded } from "@/lib/geo";
import { type Deal, type Listing, type PropType } from "@/lib/types";
import { dialogIdFor, sendMessage } from "@/store/chat";
import { useAllListings } from "@/store/listings";
import { useProfile } from "@/store/profile";
import { addRequest, markReplied, openSearch, removeRequest, removeSearch, renameSearch, setArea, togglePublish, useReqs, type BaseRequest, type SavedSearch } from "@/store/reqs";

// «Сохранённые поиски» — prototype lines 668–768 (markup), 3219–3253 / 3336–3364 / 3820–3849 (handlers).
const ilName = (k: string) => GEO.find((x) => x.k === k)?.n ?? k;
const ilceName = (k: string) => { for (const g of GEO) { const ic = g.ilces.find((x) => x.k === k); if (ic) return ic.n; } return k; };
const semtName = (ik: string, sk: string) => { for (const g of GEO) { const ic = g.ilces.find((x) => x.k === ik); const sm = ic?.semts.find((x) => x.k === sk); if (sm) return sm.n; } return sk; };
const fmt2 = (n: number) => n.toLocaleString("ru-RU");
const curS = (o: Listing) => (o.cur === "EUR" ? " €" : " ₺");
const objSub = (o: Listing) => `${o.rooms ? `${o.rooms} · ` : ""}${o.area} м² · ${fmt2(o.price)}${curS(o)}`;
const featLabel = (t: Dict, k: string) => ({ furn: t.reqs.fFurn, pool: t.feat.pool, seaview: t.reqs.fSea, first: t.reqs.fFirst, imar: t.ext.imarL.konut, kiraci: t.ext.kiraciB })[k];

const chipF = (on: boolean) => `cursor-pointer rounded-[18px] border px-[13px] py-[9px] text-[12.5px] hover:bg-line-2 ${on ? "border-sel-line bg-blue-tint font-bold text-sel-ink" : "border-line bg-surface font-semibold text-[#3d4a5e]"}`;
const tabCls = (on: boolean) => `inline-flex cursor-pointer items-center rounded-[9px] px-4 py-2 text-[13px] font-bold hover:bg-line-2 ${on ? "bg-surface text-ink shadow-[0_1px_3px_rgba(20,36,63,.1)]" : "text-text-2"}`;
const areaCls = (on: boolean) => `inline-flex cursor-pointer items-center gap-[6px] rounded-[16px] px-[14px] py-[7px] text-[12.5px] font-semibold hover:bg-line-2 ${on ? "bg-ink text-white" : "border border-line bg-surface text-text-2"}`;
const noteCls = "flex items-start gap-[9px] rounded-[12px] bg-bg-3 px-[14px] py-3 text-[12.5px] leading-[1.5] text-text";
const moreBtn = "mx-auto mt-[14px] block cursor-pointer rounded-[11px] border border-sel-tint-2 bg-blue-tint px-6 py-[11px] text-[13px] font-bold text-blue-2 hover:bg-sel-tint";
const sheetHead = "flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[10px] text-muted hover:bg-bg-3 hover:text-ink";

export default function ReqsPage() {
  useMahalleLoaded();
  const { t, lang } = useI18n();
  const ME = useMeId();
  const realtorOf = useRealtor();
  const router = useRouter();
  const all = useAllListings();
  const { searches, reqs, replies, area } = useReqs();
  const { areas: pAreas } = useProfile();
  const [tab, setTab] = useState<"mine" | "feed">("mine");
  const [editing, setEditing] = useState<string | null>(null);
  const [editVal, setEditVal] = useState("");
  const [nMine, setNMine] = useState(8);
  const [nFeed, setNFeed] = useState(2);
  const [offerFor, setOfferFor] = useState<BaseRequest | null>(null);
  const [nrOpen, setNrOpen] = useState(false);

  const moreL = (rest: number, step: number, total: number) => `${t.common.showMore.replace("{n}", String(Math.min(rest, step)))} · ${total}`;
  const mine = all.filter((o) => o.owner === ME && o.st === "active");
  const matchOf = (s: SavedSearch) => all.filter((o) => matchSearch(o, s.params)).length;
  // fmtParams (3241): «Antalya · Alanya · Oba · 2+1, 3+1 · Цена от N ₺ · до N ₺»
  const fmtParams = (p: SavedSearch["params"]) => [
    p.il ? ilName(p.il) + (p.ilces.length ? ` · ${p.ilces.map(ilceName).join(", ")}` : "") + (p.semts.length ? ` · ${p.semts.map((sk) => semtName(SEMT2ILCE[sk], sk)).join(", ")}` : "") : t.geo.all,
    p.rooms.length ? p.rooms.join(", ") : null,
    p.min ? `${t.cat.from} ${fmt2(+String(p.min).replace(/\s/g, ""))} ₺` : null,
    p.max ? `${t.cat.to} ${fmt2(+String(p.max).replace(/\s/g, ""))} ₺` : null,
  ].filter(Boolean).join(" · ");

  const inMyAreas = (q: { il: string }) => !pAreas.length || pAreas.includes(q.il);
  // Feed: my published searches (`ps…`) + base requests, filtered by area (3344–3349).
  const myPub = searches.filter((s) => s.published).map<BaseRequest & { paramsStr: string }>((s) => ({
    id: `ps${s.id}`, by: ME, deal: s.params.deal, type: s.params.type || "flat", rooms: s.params.rooms.join(", "), il: s.params.il || "antalya",
    geo: "", max: +s.params.max || 0, days: 30, c: { RU: "", EN: "", TR: "" }, fromSearch: s.id, paramsStr: fmtParams(s.params),
  }));
  const feedAll: (BaseRequest & { paramsStr?: string })[] = [...myPub, ...reqs];
  const feed = area === "all" ? feedAll : feedAll.filter(inMyAreas);
  const feedN = reqs.filter(inMyAreas).length;
  const bMatch = (r: BaseRequest) => mine.filter((o) => (o.type || "flat") === r.type && (o.deal || "sale") === r.deal);
  const areaMineL = t.reqs.areaMine + (pAreas.length ? ` · ${pAreas.slice(0, 2).map(ilName).join(", ")}${pAreas.length > 2 ? ` +${pAreas.length - 2}` : ""}` : "");

  function offer(r: BaseRequest, o: Listing) {
    const d = dialogIdFor(r.by);
    sendMessage(d, `${o.t[lang]} · ${objSub(o)} — ${t.reqs.offMsg}`, lang, o.id);
    markReplied(r.id, o.id);
    setOfferFor(null);
    router.push(`/chat?with=${r.by}`);
  }
  function openInBase(s: SavedSearch) {
    openSearch(s.id);
    router.push(`/catalog?q=${s.id}`);
  }
  const restMine = searches.length - nMine, restFeed = feed.length - nFeed;

  return (
    <div className="mx-auto max-w-[900px]">
      <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.reqs.title}</h1>
      <p className="mb-4 mt-[5px] max-w-[640px] text-[14px] text-text-2 [text-wrap:pretty]">{t.reqs.sub}</p>
      <div className="mb-[18px] flex w-fit gap-[6px] rounded-[12px] bg-line-2 p-1">
        <span onClick={() => setTab("mine")} className={tabCls(tab === "mine")}>{t.reqs.tabMine}</span>
        <span onClick={() => setTab("feed")} className={tabCls(tab === "feed")}>
          {t.reqs.tabFeed} <span className="ml-[2px] rounded-[10px] bg-red px-[7px] py-[1px] text-[11px] font-extrabold text-white">{feedN}</span>
        </span>
      </div>

      {tab === "mine" && (
        <>
          {searches.length === 0 && <div className="rounded-[16px] border border-dashed border-line-5 bg-surface px-5 py-14 text-center text-[14px] leading-[1.6] text-muted">{t.reqs.empty}</div>}
          <div className="flex flex-col gap-3">
            {searches.slice(0, nMine).map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-[14px] rounded-[16px] border border-line bg-surface px-[18px] py-4">
                <span className="flex h-[42px] w-[42px] flex-none items-center justify-center rounded-[11px] bg-blue-tint text-blue"><IconBookmark size={19} /></span>
                <div className="min-w-[200px] flex-1">
                  {editing === s.id ? (
                    <div className="flex items-center gap-[7px]">
                      <input value={editVal} onChange={(e) => setEditVal(e.target.value)} className="min-w-0 flex-1 rounded-[9px] border border-blue px-[11px] py-2 text-[13.5px] font-semibold outline-none" autoFocus />
                      <button type="button" onClick={() => { renameSearch(s.id, editVal.trim() || s.name); setEditing(null); }} className="flex-none cursor-pointer rounded-[8px] bg-green-3 px-[13px] py-2 text-[12px] font-bold text-white hover:brightness-[.92]"><IconCheck size={14} /></button>
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-[14.5px] font-bold text-ink">{s.name}</span>
                      <span onClick={() => { setEditing(s.id); setEditVal(s.name); }} title={t.rl.editB} className="inline-flex cursor-pointer text-muted-2 hover:text-blue"><IconPencil size={14} /></span>
                      {s.newN > 0 && <span className="rounded-[12px] bg-red px-[9px] py-[3px] text-[10.5px] font-bold text-white">+{s.newN} {t.reqs.newN}</span>}
                    </div>
                  )}
                  <div className="mt-[3px] text-[12.5px] text-muted">{fmtParams(s.params)}</div>
                </div>
                <span className="inline-flex flex-none items-center gap-[5px] rounded-[16px] bg-green-tint px-[13px] py-[6px] text-[13px] font-bold text-green"><IconTargetArrow size={14} /> {matchOf(s)} {t.reqs.match}</span>
                <button type="button" onClick={() => togglePublish(s.id)} className={`inline-flex flex-none cursor-pointer items-center gap-[6px] rounded-[10px] border px-[14px] py-[9px] text-[12.5px] font-bold hover:opacity-85 ${s.published ? "border-[#bfe8d4] bg-green-tint text-green" : "border-line bg-surface text-ink"}`}>
                  {s.published ? <IconCheck size={14} /> : <IconBroadcast size={14} />} {s.published ? t.reqs.pubOn : t.reqs.pub}
                </button>
                <button type="button" onClick={() => openInBase(s)} className="flex-none cursor-pointer rounded-[10px] border border-sel-tint-2 bg-blue-tint px-[14px] py-[9px] text-[12.5px] font-bold text-blue hover:bg-sel-tint">{t.reqs.open}</button>
                <span onClick={() => removeSearch(s.id)} className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[10px] border border-line text-red hover:bg-[#fdf1f1]"><IconTrash size={15} /></span>
              </div>
            ))}
          </div>
          {restMine > 0 && <button type="button" onClick={() => setNMine((n) => n + 8)} className={moreBtn}>{moreL(restMine, 8, searches.length)}</button>}
          <div className={`${noteCls} mt-[18px]`}><IconBellRinging size={16} className="mt-[1px] flex-none text-blue" /><span>{t.reqs.note}</span></div>
          <div className={`${noteCls} mt-[10px]`}><IconClock size={16} className="mt-[1px] flex-none text-blue" /><span>{t.reqs.newAlg}</span></div>
        </>
      )}

      {tab === "feed" && (
        <>
          <div className="mb-[14px] flex flex-wrap items-center gap-2">
            <span onClick={() => setArea("mine")} className={areaCls(area === "mine")}><IconMapPin size={14} /> {areaMineL}</span>
            <span onClick={() => setArea("all")} className={areaCls(area === "all")}>{t.reqs.areaAll}</span>
            <span className="flex-1" />
            <button type="button" onClick={() => setNrOpen(true)} className="inline-flex cursor-pointer items-center gap-[7px] rounded-[10px] bg-blue-2 px-4 py-[9px] text-[13px] font-bold text-white hover:bg-[#3453bd]"><IconPlus size={15} /> {t.reqs.newReq}</button>
          </div>
          <div className="flex flex-col gap-3">
            {feed.slice(0, nFeed).map((r) => {
              const isMine = r.by === ME;
              const rr = (isMine ? realtorOf(ME) ?? REALTORS.me : realtorOf(r.by)) ?? { name: "—", ag: "", color: "#8a93a2" };
              const m = isMine ? [] : bMatch(r);
              const cm = r.c ? r.c[lang] || r.c.RU : "";
              const sent = !!replies[r.id];
              const params = r.paramsStr || [t.deal[r.deal], t.typ[r.type], r.rooms, r.geo, r.max ? `≤ ${fmt2(r.max)} ₺` : null, ...(r.featKeys || []).map((k) => featLabel(t, k))].filter(Boolean).join(" · ");
              return (
                <div key={r.id} className="rounded-[16px] border border-line bg-surface px-[18px] py-4">
                  <div className="flex flex-wrap items-center gap-[11px]">
                    <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[15px] font-extrabold text-white" style={{ background: rr.color }}>{rr.name.split(" ").map((w) => w[0]).join("").slice(0, 2)}</span>
                    <div className="min-w-[170px] flex-1">
                      <div className="text-[14px] font-bold text-ink">{rr.name} <span className="font-medium text-muted">· {rr.ag}</span></div>
                      <div className="mt-[2px] text-[12px] text-muted"><IconClock size={11} className="inline align-[-1px]" /> {t.reqs.expIn} {r.days} {t.reqs.d}</div>
                    </div>
                    {isMine && <span className="flex-none rounded-[16px] bg-blue-tint px-3 py-[6px] text-[12px] font-bold text-blue-2">{t.reqs.yourReq}</span>}
                    {m.length > 0 && <span className="inline-flex flex-none items-center gap-1 rounded-[16px] bg-green-tint px-3 py-[6px] text-[12.5px] font-bold text-green"><IconTargetArrow size={13} /> {t.reqs.youHave} {m.length}</span>}
                  </div>
                  <div className="mb-1 mt-3 text-[14px] font-bold text-ink">{params}</div>
                  {cm.trim() && <div className="text-[13px] italic leading-[1.5] text-text">«{cm}»</div>}
                  <div className="mt-[13px] flex flex-wrap gap-2">
                    {isMine ? (
                      <button type="button" onClick={() => (r.fromSearch ? togglePublish(r.fromSearch) : removeRequest(r.id))} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] border border-line bg-surface px-[15px] py-[9px] text-[13px] font-semibold text-red hover:border-red hover:bg-[#fdf1f1]"><IconEyeOff size={14} /> {t.reqs.unpubB}</button>
                    ) : (
                      <>
                        {sent ? (
                          <span onClick={() => router.push(`/chat?with=${r.by}`)} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] bg-green-tint px-[15px] py-[9px] text-[13px] font-bold text-green hover:brightness-95"><IconCheck size={14} /> {t.reqs.offered} · {rr.name.split(" ")[0]}</span>
                        ) : (
                          <button type="button" onClick={() => (m.length ? setOfferFor(r) : showToast(t.reqs.noMatch))} className="inline-flex cursor-pointer items-center gap-[6px] whitespace-nowrap rounded-[10px] bg-blue-2 px-[15px] py-[9px] text-[13px] font-bold text-white hover:bg-[#3453bd]"><IconHomeShare size={14} /> {t.reqs.offer}</button>
                        )}
                        <button type="button" onClick={() => router.push(`/chat?with=${r.by}`)} className="inline-flex cursor-pointer items-center gap-[6px] rounded-[10px] border border-line bg-surface px-[15px] py-[9px] text-[13px] font-semibold text-ink hover:border-blue hover:text-blue"><IconMessageCircle size={14} /> {t.obj.chat}</button>
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          {restFeed > 0 && <button type="button" onClick={() => setNFeed((n) => n + 2)} className={moreBtn}>{moreL(restFeed, 2, feed.length)}</button>}
          <div className={`${noteCls} mt-[18px]`}><IconInfoCircle size={16} className="mt-[1px] flex-none text-blue" /><span>{t.reqs.feedNote}</span></div>
        </>
      )}

      {/* «Какой объект предложить?» — prototype 734–748 */}
      <Modal open={!!offerFor} onClose={() => setOfferFor(null)} width={480} z={340} overlay={0.45} anim="none" padding="20px" style={{ boxShadow: "0 30px 80px rgba(10,16,28,.35)" }}>
        <div className="mb-[14px] flex items-center gap-[10px]"><span className="flex-1 text-[15.5px] font-extrabold text-ink">{t.reqs.offerT}</span><span onClick={() => setOfferFor(null)} className={sheetHead}><IconX size={19} /></span></div>
        <div className="flex flex-col gap-[9px]">
          {offerFor && bMatch(offerFor).map((o) => (
            <div key={o.id} onClick={() => offer(offerFor, o)} className="flex cursor-pointer items-center gap-3 rounded-[13px] border border-line p-[9px] hover:border-blue hover:bg-bg-5">
              <span className="h-12 w-16 flex-none rounded-[9px] bg-cover bg-center" style={{ backgroundImage: `url(${o.img})` }} />
              <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-bold text-ink">{o.t[lang]}</div><div className="mt-[2px] text-[12px] text-muted">{objSub(o)}</div></div>
              <IconSend size={17} className="mr-[6px] flex-none text-blue" />
            </div>
          ))}
        </div>
      </Modal>

      <NewRequestSheet open={nrOpen} onClose={() => setNrOpen(false)} />
    </div>
  );
}

// «Новый запрос» — prototype 750–767, 3832–3849. State lives here (mounted permanently) so the form survives
// the GeoPicker round-trip (`openGeoReq` hides the sheet, `closeGeo`/`geoPick` bring it back) like the prototype's global state.
function NewRequestSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const [deal, setDeal] = useState<Deal>("sale");
  const [type, setType] = useState<PropType>("flat");
  const [rooms, setRooms] = useState<string[]>(["2+1"]);
  const [feats, setFeats] = useState<string[]>([]);
  const [il, setIl] = useState("antalya");
  const [ilce, setIlce] = useState("");
  const [semt, setSemt] = useState("");
  const [max, setMax] = useState("");
  const [comment, setComment] = useState("");
  const [geoOpen, setGeoOpen] = useState(false);
  const featOpts: [string, string][] = type === "land" ? [["imar", t.ext.imarL.konut], ["seaview", t.reqs.fSea], ["first", t.reqs.fFirst]] : type === "comm" ? [["kiraci", t.ext.kiraciB], ["seaview", t.reqs.fSea], ["first", t.reqs.fFirst]] : [["furn", t.reqs.fFurn], ["pool", t.feat.pool], ["seaview", t.reqs.fSea], ["first", t.reqs.fFirst]];
  const toggle = (arr: string[], v: string) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const label = "mb-[6px] block text-[12.5px] font-semibold text-text-2";
  const input = "w-full rounded-[10px] border border-line px-[11px] py-[10px] text-[13.5px] outline-none";
  const hasRooms = type === "flat" || type === "house";
  const geoLabel = ilName(il) + (ilce ? ` › ${ilceName(ilce)}` : "") + (semt ? ` › ${semtName(ilce, semt)}` : "");

  function pickType(v: PropType) {
    const roomsOk = v === "flat" || v === "house";
    const okF = v === "land" ? ["seaview", "first", "imar"] : v === "comm" ? ["seaview", "first", "kiraci"] : ["furn", "pool", "seaview", "first"];
    setType(v);
    setRooms(roomsOk ? (rooms.length ? rooms : ["2+1"]) : []);
    setFeats(feats.filter((f) => okF.includes(f)));
  }
  function onMax(v: string) {
    const d = v.replace(/\D/g, "").slice(0, 12);
    setMax(d ? (+d).toLocaleString("ru-RU") : "");
  }
  function publish() {
    const mx = parseInt(max.replace(/\D/g, ""), 10) || 0;
    const geoL = ilName(il) + (ilce ? ` · ${ilceName(ilce)}` : "") + (semt ? ` · ${semtName(ilce, semt)}` : "");
    addRequest({ by: getMeId(), deal, type, rooms: hasRooms ? rooms.join(" / ") : "", il, geo: geoL, max: mx, featKeys: [...feats], c: { RU: comment, EN: comment, TR: comment } });
    setMax(""); setComment(""); setFeats([]);
    onClose();
    showToast(t.reqs.nrDone);
  }

  return (
    <>
      <Modal open={open && !geoOpen} onClose={onClose} width={520} z={340} overlay={0.45} anim="none" padding="20px" style={{ boxShadow: "0 30px 80px rgba(10,16,28,.35)", maxHeight: "calc(100vh - 40px)" }}>
        <div className="mb-4 flex items-center gap-[10px]"><span className="flex-1 text-[15.5px] font-extrabold text-ink">{t.reqs.newReq}</span><span onClick={onClose} className={sheetHead}><IconX size={19} /></span></div>
        <div className="mb-[14px] flex flex-wrap gap-[22px]">
          <div><label className={label}>{t.add.dealL}</label><div className="flex flex-wrap gap-[5px]">{(["sale", "rent"] as Deal[]).map((k) => <span key={k} onClick={() => setDeal(k)} className={chipF(deal === k)}>{t.deal[k]}</span>)}</div></div>
          <div><label className={label}>{t.add.typeL}</label><div className="flex flex-wrap gap-[5px]">{(["flat", "house", "comm", "land"] as PropType[]).map((k) => <span key={k} onClick={() => pickType(k)} className={chipF(type === k)}>{t.typ[k]}</span>)}</div></div>
        </div>
        {hasRooms && (
          <div className="mb-[14px]"><label className={label}>{t.add.rooms}</label><div className="flex flex-wrap gap-[5px]">{["1+1", "2+1", "3+1", "4+1", "5+1", "6+1"].map((r) => <span key={r} onClick={() => setRooms(toggle(rooms, r))} className={chipF(rooms.includes(r))}>{r}</span>)}</div></div>
        )}
        <div className="mb-[14px] flex flex-wrap gap-[14px]">
          <div className="min-w-[170px] flex-1"><label className={label}>{t.reqs.budgetL}</label><input value={max} onChange={(e) => onMax(e.target.value)} placeholder="6 500 000" className={input} inputMode="numeric" /></div>
          <div className="min-w-[170px] flex-1"><label className={label}>{t.reqs.whereL}</label>
            <div onClick={() => setGeoOpen(true)} className="flex w-full cursor-pointer items-center gap-2 rounded-[10px] border border-line bg-surface px-[11px] py-[10px] text-[13.5px] hover:border-blue">
              <IconMapPin size={15} className="flex-none text-blue" /><span className="flex-1 truncate font-semibold text-ink">{geoLabel}</span><IconChevronDown size={14} className="flex-none text-muted" />
            </div>
          </div>
        </div>
        <div className="mb-[14px]"><label className={label}>{t.reqs.featsL}</label><div className="flex flex-wrap gap-[5px]">{featOpts.map(([k, l]) => <span key={k} onClick={() => setFeats(toggle(feats, k))} className={chipF(feats.includes(k))}>{l}</span>)}</div></div>
        <div className="mb-4"><label className={label}>{t.reqs.commentL}</label><textarea value={comment} onChange={(e) => setComment(e.target.value)} rows={2} placeholder={t.reqs.commPh} className={`${input} resize-y font-[inherit]`} /></div>
        <button type="button" onClick={publish} className="flex w-full cursor-pointer items-center justify-center gap-2 rounded-[12px] bg-blue-2 py-[13px] text-[14px] font-bold text-white hover:bg-[#3453bd]"><IconBroadcast size={16} /> {t.reqs.pubGo}</button>
        <div className="mt-[10px] text-[12px] leading-[1.5] text-muted">{t.reqs.nrNote}</div>
      </Modal>
      {geoOpen && (
        <GeoPicker
          mode="req"
          value={{ il, ilces: ilce ? [ilce] : [], semts: semt ? [semt] : [] }}
          onApply={(v) => { setIl(v.il); setIlce(v.ilces[0] ?? ""); setSemt(v.semts[0] ?? ""); setGeoOpen(false); }}
          onClose={() => setGeoOpen(false)}
        />
      )}
    </>
  );
}
