"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconBuildingSkyscraper, IconCheck, IconEye, IconFolders, IconHeart, IconHeartFilled, IconLink, IconPencil, IconPlus, IconSend, IconTrash } from "@tabler/icons-react";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import { useAllListings } from "@/store/listings";
import { usePrefs } from "@/store/prefs";
import { likedCount, removeSelection, selectionUrl, setClientReturn, useSelections, type Selection } from "@/store/selections";
import { resolveSelItems } from "@/lib/selectionItems";
import { plural } from "@/lib/plural";

// «Подборки для клиентов» — prototype lines 631–666, handlers 3463–3496, 3916.
const ST: Record<Selection["status"], [string, string]> = { draft: ["#f0f2f6", "#6b7688"], sent: ["#eef3ff", "#4d7cfe"], viewed: ["#e4f6ee", "#0f9d6b"] };

// Fallback for selections without the prototype's `date` field (older local data).
function relDate(iso: string, lang: "RU" | "EN" | "TR") {
  const d = new Date(iso), now = new Date();
  const days = Math.floor((new Date(now.toDateString()).getTime() - new Date(d.toDateString()).getTime()) / 86400000);
  const time = d.toLocaleTimeString(lang === "RU" ? "ru-RU" : lang === "TR" ? "tr-TR" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  if (days === 0) return (lang === "RU" ? "Сегодня, " : lang === "TR" ? "Bugün " : "Today, ") + time;
  if (days === 1) return lang === "RU" ? "Вчера" : lang === "TR" ? "Dün" : "Yesterday";
  const ru = days % 10 === 1 && days % 100 !== 11 ? "день" : days % 10 >= 2 && days % 10 <= 4 && (days % 100 < 10 || days % 100 >= 20) ? "дня" : "дней";
  return lang === "RU" ? `${days} ${ru} назад` : lang === "TR" ? `${days} gün önce` : `${days} days ago`;
}

export default function SelsPage() {
  const { t, lang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const all = useAllListings();
  const selections = useSelections();
  const { setSel, setSelDraft } = usePrefs();
  const [copied, setCopied] = useState<string | null>(null);

  const stats = [
    { Icon: IconFolders, bg: "#eef3ff", c: "#4d7cfe", v: selections.length, l: t.sel.stT },
    { Icon: IconSend, bg: "#fdf5df", c: "#c98d00", v: selections.filter((x) => x.status !== "draft").length, l: t.sel.stS },
    { Icon: IconEye, bg: "#e4f6ee", c: "#0f9d6b", v: selections.filter((x) => x.status === "viewed").length, l: t.sel.stV },
    { Icon: IconHeart, bg: "#fdecec", c: "#e5484d", v: selections.reduce((a, x) => a + likedCount(x), 0), l: t.sel.stL },
  ];
  const stLabel = { draft: t.sel.draft, sent: t.sel.sent, viewed: t.sel.viewed };

  // startNewSel (3916): go to the catalog with the hint; the folder is kept, only edit mode is dropped.
  function startNew() { setSelDraft({ editingSel: null }); router.push("/catalog"); showToast(t.cat.hint); }
  // edit (3474): load the selection into the folder, go to the catalog, show `editHint`.
  function edit(s: Selection) { setSel([...s.items]); setSelDraft({ editingSel: s.id, title: s.title, name: s.name, note: s.note || "", cm: { ...s.cm } }); router.push("/catalog"); showToast(t.sel.editHint); }
  function copy(s: Selection) { try { navigator.clipboard.writeText(selectionUrl(s)); } catch {} setCopied(s.id); setTimeout(() => setCopied(null), 1500); }
  function openClient(s: Selection) { setClientReturn(pathname); router.push(`/s/${s.slug}?preview=1`); }

  const act = "flex flex-1 cursor-pointer items-center justify-center gap-[5px] px-1 py-3 text-center text-[12.5px] font-semibold hover:bg-bg-3";

  return (
    <>
      <div className="mb-[18px] flex flex-wrap items-start gap-4">
        <div className="min-w-[260px] flex-1">
          <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.sel.title}</h1>
          <p className="mt-[5px] max-w-[640px] text-[14px] text-text-2 [text-wrap:pretty]">{t.sel.sub}</p>
        </div>
        <button type="button" onClick={startNew} className="inline-flex flex-none cursor-pointer items-center gap-[7px] rounded-[11px] bg-blue-2 px-[18px] py-[11px] text-[14px] font-bold text-white hover:bg-blue-3"><IconPlus size={17} /> {t.sel.new}</button>
      </div>
      <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(170px,1fr))] gap-3">
        {stats.map(({ Icon, bg, c, v, l }) => (
          <div key={l} className="flex items-center gap-3 rounded-[14px] border border-line bg-surface px-[17px] py-[15px]">
            <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[10px]" style={{ background: bg, color: c }}><Icon size={18} /></span>
            <div><div className="text-[20px] font-extrabold text-ink">{v}</div><div className="text-[12px] text-muted">{l}</div></div>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(300px,100%),1fr))] gap-4">
        {selections.map((s) => {
          const st = ST[s.status];
          const liked = likedCount(s);
          const init = (s.name || "?").split(/[\s(]/).filter(Boolean).slice(0, 2).map((w) => w[0]).join("").toUpperCase();
          // объекты с учётом судьбы объявления: живые первыми, проданные/снятые/удалённые (по снимку) — в конце (16.10.2026)
          const its = resolveSelItems(s, all);
          const avail = its.filter((x) => !x.gone).length, gone = its.length - avail;
          const thumbs = its.slice(0, 4).map((x) => ({ src: x.live?.img || x.snap?.img || "", gone: !!x.gone }));
          const date = s.date?.[lang] ?? relDate(s.updatedAt, lang);
          return (
            <div key={s.id} className="flex flex-col overflow-hidden rounded-[16px] border border-line bg-surface">
              <div className="flex items-center gap-[11px] px-4 pb-[11px] pt-[15px]">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-[11px] bg-blue-tint text-[14px] font-bold text-blue">{init}</span>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-bold text-ink">{s.title}</div>
                  <div className="truncate text-[11.5px] text-muted">{t.sel.forP} {s.name} · {date}</div>
                </div>
                <span className="flex-none whitespace-nowrap rounded-[8px] px-[10px] py-1 text-[11px] font-bold" style={{ background: st[0], color: st[1] }}>{stLabel[s.status]}</span>
              </div>
              <div className="flex gap-[6px] px-4 pb-[11px]">
                {thumbs.map((th, i) => <span key={i} className={`flex aspect-square max-w-16 flex-1 items-center justify-center rounded-[9px] bg-bg-2 bg-cover bg-center text-[12px] font-bold text-muted ${th.gone ? "opacity-40 grayscale" : ""}`} style={{ backgroundImage: `url('${th.src}')` }} />)}
                {its.length > 4 && <span className="flex aspect-square max-w-16 flex-1 items-center justify-center rounded-[9px] bg-bg-2 text-[12px] font-bold text-muted">+{its.length - 4}</span>}
              </div>
              <div className="flex flex-wrap gap-[13px] px-4 pb-[13px] text-[12.5px] text-text-2">
                <span className="inline-flex items-center gap-1"><IconBuildingSkyscraper size={14} className="text-muted-2" /> {avail} {plural(lang, avail, t.sel.objsP)}{gone > 0 && <span className="text-muted"> · {gone} {plural(lang, gone, t.sel.goneN)}</span>}</span>
                {s.views > 0 && <span className="inline-flex items-center gap-1"><IconEye size={14} className="text-muted-2" /> {s.views} {t.sel.views}</span>}
                {liked > 0 && <span className="inline-flex items-center gap-1 text-red"><IconHeartFilled size={14} /> {liked}</span>}
              </div>
              <div className="mt-auto flex border-t border-bg-4">
                <button type="button" onClick={() => openClient(s)} className={`${act} text-blue`}><IconEye size={14} /> {t.sel.open}</button>
                <button type="button" onClick={() => copy(s)} className={`${act} border-l border-bg-4 ${copied === s.id ? "text-green" : "text-text"}`}>{copied === s.id ? <IconCheck size={14} /> : <IconLink size={14} />} {copied === s.id ? t.sel.copied : t.sel.link}</button>
                <button type="button" onClick={() => edit(s)} className={`${act} border-l border-bg-4 text-text`}><IconPencil size={14} /> {t.sel.edit}</button>
                <button type="button" onClick={() => { removeSelection(s.id); showToast(t.sel.delDone); }} className={`${act} border-l border-bg-4 text-red hover:bg-[#fdf1f1]`}><IconTrash size={14} /> {t.sel.del}</button>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
