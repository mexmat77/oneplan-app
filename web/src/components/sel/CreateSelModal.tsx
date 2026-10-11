"use client";

import { useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { IconBrandTelegram, IconBrandWhatsapp, IconCircleCheck, IconDeviceFloppy, IconEye, IconLink, IconTrash, IconX } from "@tabler/icons-react";
import { Modal } from "@/components/ui/Modal";
import { useI18n } from "@/i18n/provider";
import { fmt } from "@/lib/money";
import { useAllListings } from "@/store/listings";
import { usePrefs } from "@/store/prefs";
import { createSelection, selectionUrl, setClientReturn, updateSelection, useSelections, type Selection } from "@/store/selections";

// «Новая подборка» / «Редактирование подборки» — prototype lines 1723–1765, handlers 4289–4303.
const inputCls = "w-full rounded-[10px] border border-line px-3 py-[10px] text-[13.5px] outline-none";

export function CreateSelModal({ onClose }: { onClose: () => void }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const pathname = usePathname();
  const all = useAllListings();
  const { sel, selDraft, setSelDraft, toggleSel, resetSelDraft } = usePrefs();
  const selections = useSelections();
  const [done, setDone] = useState<Selection | null>(null);
  const [copied, setCopied] = useState(false);
  const editing = selDraft.editingSel ? selections.find((x) => x.id === selDraft.editingSel) : null;
  const objs = sel.map((id) => all.find((o) => o.id === id)).filter((o): o is NonNullable<typeof o> => !!o);

  // doCreateSel (3487–3495): edit → update in place; create → new «sent» selection with «Только что».
  function doCreateSel(): Selection {
    const cm: Record<string, string> = {};
    for (const id of sel) if ((selDraft.cm[id] || "").trim()) cm[id] = selDraft.cm[id].trim();
    if (editing) {
      const patch = { title: selDraft.title || selDraft.name || editing.title, name: selDraft.name || editing.name, note: selDraft.note, items: [...sel], cm };
      updateSelection(editing.id, patch);
      return { ...editing, ...patch };
    }
    return createSelection({ title: selDraft.title, name: selDraft.name, note: selDraft.note, items: [...sel], cm });
  }
  function copy(s: Selection) {
    try { navigator.clipboard.writeText(selectionUrl(s)); } catch {}
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }
  // cancelSel (4290): drop the folder, edit mode and all fields.
  function cancelSel() { resetSelDraft(); onClose(); }
  // closeCreate (4291): X / dim — the fields survive unless the selection was just created.
  function closeCreate() { if (done) resetSelDraft(); onClose(); }
  function openClient(s: Selection) {
    setClientReturn(pathname);
    router.push(`/s/${s.slug}?preview=1`);
  }
  // createViewClient (4296): save, close the modal and open the client view (folder stays).
  function createViewClient() { const s = doCreateSel(); onClose(); openClient(s); }
  // openCreatedClient (4303): everything is reset, then the client view opens.
  function openCreatedClient() { if (!done) return; resetSelDraft(); onClose(); openClient(done); }
  const url = done ? selectionUrl(done) : "";

  return (
    <Modal open onClose={closeCreate} width={500} z={310} sheet="tall" anim="none" padding="0" style={{ display: "flex", flexDirection: "column", overflow: "hidden", maxWidth: "min(500px, 96vw)" }}>
      <div className="flex flex-none items-start gap-[10px] border-b border-bg-4 px-[22px] pb-[14px] pt-5">
        <div className="flex-1">
          <div className="text-[17.5px] font-extrabold text-ink">{editing ? t.sel.mEdit : t.sel.mTitle}</div>
          <div className="mt-[2px] text-[12.5px] text-muted">{t.sel.selN} {sel.length}</div>
        </div>
        <button type="button" onClick={closeCreate} className="cursor-pointer p-[2px] text-muted-2 hover:text-ink"><IconX size={22} /></button>
      </div>

      {!done ? (
        <>
          <div className="min-h-0 flex-1 overflow-y-auto px-[22px] py-[18px]">
            <label className="mb-[6px] block text-[12.5px] font-semibold text-text-2">{t.sel.fT}</label>
            <input value={selDraft.title} onChange={(e) => setSelDraft({ title: e.target.value })} placeholder={t.sel.fTPh} className={`${inputCls} mb-[13px]`} />
            <label className="mb-[6px] block text-[12.5px] font-semibold text-text-2">{t.sel.fN} <span className="font-normal text-muted-2">— {t.sel.fNn}</span></label>
            <input value={selDraft.name} onChange={(e) => setSelDraft({ name: e.target.value })} placeholder={t.sel.fNPh} className={`${inputCls} mb-[13px]`} />
            <label className="mb-[6px] block text-[12.5px] font-semibold text-text-2">{t.sel.fM} <span className="font-normal text-muted-2">— {t.sel.fMn}</span></label>
            <textarea value={selDraft.note} onChange={(e) => setSelDraft({ note: e.target.value })} placeholder={t.sel.fMPh} className={`${inputCls} mb-[13px] min-h-[58px] resize-y`} />
            <label className="mb-2 block text-[12.5px] font-semibold text-text-2">{t.sel.fC} <span className="font-normal text-muted-2">— {t.sel.fCn}</span></label>
            {objs.map((o) => {
              const cmt = selDraft.cm[o.id] || "";
              return (
                <div key={o.id} className="flex gap-[10px] border-b border-dashed border-line-2 py-[10px]">
                  <span className="h-[46px] w-[46px] flex-none rounded-[9px] bg-cover bg-center" style={{ backgroundImage: `url('${o.img}')` }} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <div className="min-w-0 flex-1 truncate text-[12.5px] font-bold text-ink">{o.t[lang]}</div>
                      <button type="button" onClick={() => toggleSel(o.id)} className="flex h-[26px] w-[26px] flex-none cursor-pointer items-center justify-center rounded-[8px] text-muted-2 hover:bg-red-tint hover:text-red"><IconTrash size={14} /></button>
                    </div>
                    <div className="mb-[6px] text-[11.5px] text-muted">{o.rooms} · {fmt(o.price, o.cur)}</div>
                    <div className="mb-[6px] flex flex-wrap gap-1">
                      {t.sel.chips.map((c) => (
                        <button key={c} type="button" onClick={() => setSelDraft({ cm: { ...selDraft.cm, [o.id]: cmt.trim() ? `${cmt.trim()}, ${c}` : c } })} className="cursor-pointer rounded-[13px] border border-line bg-[#fafbfd] px-2 py-[3px] text-[10.5px] text-text hover:border-blue hover:text-blue">+ {c}</button>
                      ))}
                    </div>
                    <input value={cmt} onChange={(e) => setSelDraft({ cm: { ...selDraft.cm, [o.id]: e.target.value } })} placeholder={t.sel.cmtPh} className="w-full rounded-[8px] border border-line border-l-[3px] border-l-blue bg-[#f8fbff] px-[10px] py-2 text-[12.5px] outline-none" />
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex flex-none gap-[9px] border-t border-bg-4 px-[22px] pb-5 pt-[14px]">
            <button type="button" onClick={cancelSel} className="flex-none cursor-pointer rounded-[12px] px-4 py-[13px] text-[13.5px] font-semibold text-muted hover:text-red">{t.common.cancel}</button>
            {editing && (
              <button type="button" onClick={createViewClient} className="flex flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[12px] border border-line bg-surface py-[13px] text-[14px] font-bold text-ink hover:border-blue hover:text-blue"><IconEye size={16} /> {t.sel.previewB}</button>
            )}
            <button type="button" onClick={() => setDone(doCreateSel())} className="flex flex-1 cursor-pointer items-center justify-center gap-2 whitespace-nowrap rounded-[12px] bg-blue-2 py-[13px] text-[14px] font-bold text-white hover:bg-blue-3">
              {editing ? <IconDeviceFloppy size={16} /> : <IconLink size={16} />} {editing ? t.sel.saveShort : t.sel.create}
            </button>
          </div>
        </>
      ) : (
        <div className="px-[22px] pb-[22px] pt-5">
          <div className="rounded-[14px] border border-sel-tint-2 bg-blue-tint p-4">
            <div className="mb-[11px] flex items-center gap-2 text-[13.5px] font-bold text-green"><IconCircleCheck size={17} /> {t.sel.done}</div>
            <div className="mb-[11px] flex gap-2">
              <input value={url} readOnly className="min-w-0 flex-1 rounded-[10px] border border-[#c9d8ff] bg-surface px-[11px] py-[10px] font-mono text-[12px] outline-none" />
              <button type="button" onClick={() => copy(done)} className={`flex-none cursor-pointer rounded-[10px] px-[15px] text-[13px] font-bold text-white hover:brightness-95 ${copied ? "bg-green-3" : "bg-blue-2"}`}>{copied ? t.sel.copied : t.sel.copy}</button>
            </div>
            <div className="flex flex-wrap gap-2">
              <a href={`https://wa.me/?text=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" className="inline-flex flex-1 cursor-pointer items-center justify-center gap-[6px] rounded-[10px] bg-green-3 p-[10px] text-center text-[13px] font-bold text-white"><IconBrandWhatsapp size={16} /> WhatsApp</a>
              <a href={`https://t.me/share/url?url=${encodeURIComponent(url)}`} target="_blank" rel="noreferrer" className="inline-flex flex-1 cursor-pointer items-center justify-center gap-[6px] rounded-[10px] border border-[#c9d8ff] bg-surface p-[10px] text-center text-[13px] font-bold text-blue"><IconBrandTelegram size={16} /> Telegram</a>
              <button type="button" onClick={openCreatedClient} className="flex-1 cursor-pointer whitespace-nowrap rounded-[10px] border border-[#c9d8ff] bg-surface p-[10px] text-center text-[13px] font-bold text-ink hover:brightness-95">{t.sel.asClient}</button>
            </div>
          </div>
        </div>
      )}
    </Modal>
  );
}
