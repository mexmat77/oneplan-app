"use client";

// Демо-чат прототипа (сид + localStorage) — используется только без Supabase; реальный чат — `RealtorChat`.

import { Suspense, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { IconArrowLeft, IconBrandWhatsapp, IconChecks, IconChevronRight, IconHeadset, IconLanguage, IconSearch, IconSend, IconSparkles } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { useBackClose } from "@/hooks/useScrollLock";
import { useMobile } from "@/components/dev/chat/useMobile";
import { fmt } from "@/lib/money";
import { REALTORS } from "@/lib/seed";
import { useAllListings } from "@/store/listings";
import { UNREAD_SEED, dialogIdFor, markRead, sendMessage, setTranslate, useChat, type Dialog } from "@/store/chat";

// «Чат риэлторов» — prototype lines 770–817 (markup), 3548–3577 (handlers), CSS 67–122 (`.opl-chat-shell`), `_vvFix` 2531–2544.
const SUPPORT = { name: "OnePlan Support", ag: "OnePlan", color: "#14243f", online: true, phone: "" };

// Prototype `_vvFix`: with the keyboard open on ≤760 the fixed chat shell / topbar / bottom bars follow the visual viewport.
function vvFix() {
  const vv = window.visualViewport;
  if (!vv || window.innerWidth > 760) return;
  const mm = document.querySelector<HTMLElement>("[data-chat-msgs]");
  const nearBtm = mm ? mm.scrollHeight - mm.scrollTop - mm.clientHeight < 120 : false;
  const sh = document.querySelector<HTMLElement>(".opl-chat-shell.open");
  if (sh) { sh.style.setProperty("height", `${vv.height}px`, "important"); sh.style.top = `${vv.offsetTop}px`; }
  const tb = document.querySelector<HTMLElement>("[data-topbar]");
  if (tb) tb.style.top = `${vv.offsetTop}px`;
  const kb = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
  document.querySelectorAll<HTMLElement>("[data-obj-bar]").forEach((bar) => { bar.style.bottom = `${kb}px`; });
  document.querySelectorAll<HTMLElement>('[data-sheet="fit"]').forEach((sf) => { sf.style.bottom = `${kb}px`; });
  document.querySelectorAll<HTMLElement>("[data-f-sheet]").forEach((sf) => {
    if (getComputedStyle(sf).position === "fixed") { sf.style.setProperty("bottom", `${kb}px`, "important"); sf.style.setProperty("max-height", `${Math.round(vv.height * 0.92)}px`, "important"); }
  });
  if (nearBtm && mm) mm.scrollTop = mm.scrollHeight;
}

function ChatInner() {
  const { t, lang } = useI18n();
  const params = useSearchParams();
  const all = useAllListings();
  const { dialogs, read, tr } = useChat();
  const [q, setQ] = useState("");
  const [cur, setCur] = useState<string>(() => (params.get("with") ? dialogIdFor(params.get("with")!) : "d1"));
  const [mobOpen, setMobOpen] = useState(!!params.get("with"));
  const mobile = useMobile();
  useBackClose(mobile && mobOpen, () => setMobOpen(false)); // «назад» на телефоне → список диалогов (21.10.2026)
  const [input, setInput] = useState("");
  const [orig, setOrig] = useState<Record<string, boolean>>({});
  const msgsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const peer = (d: Dialog) => (d.who === "sup" ? SUPPORT : REALTORS[d.who] ?? { name: d.who, ag: "", color: "#8a93a2", online: false, phone: "" });
  const lastOf = (d: Dialog) => d.msgs[d.msgs.length - 1];
  const nq = q.trim().toLowerCase();
  // dlgSorted (3551): support first, then by `ts` of the last message, then by its `time` string.
  const list = [...dialogs]
    .sort((a, b) => {
      const sa = a.who === "sup" ? 1 : 0, sb = b.who === "sup" ? 1 : 0;
      if (sa !== sb) return sb - sa;
      const ma = lastOf(a), mb = lastOf(b);
      const ta = ma?.ts || 0, tb = mb?.ts || 0;
      if (ta !== tb) return tb - ta;
      return String(mb?.time ?? "").localeCompare(String(ma?.time ?? ""));
    })
    .filter((d) => { const w = peer(d); return !nq || `${w.name} ${w.ag || ""}`.toLowerCase().includes(nq); });
  const dlg = dialogs.find((d) => d.id === cur) ?? dialogs[0];
  const who = dlg ? peer(dlg) : SUPPORT;
  const unread = (d: Dialog) => (read.includes(d.id) ? 0 : UNREAD_SEED[d.id] ?? 0);
  const chatBottom = () => { const el = msgsRef.current; if (el) el.scrollTop = el.scrollHeight; };

  useEffect(() => { if (dlg) markRead(dlg.id); }, [dlg]);
  useEffect(() => { chatBottom(); }, [dlg?.msgs.length, cur]);
  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    vv.addEventListener("resize", vvFix);
    vv.addEventListener("scroll", vvFix);
    return () => { vv.removeEventListener("resize", vvFix); vv.removeEventListener("scroll", vvFix); };
  }, []);

  function sendMsg() {
    const v = input.trim();
    if (!v || !dlg) return;
    sendMessage(dlg.id, v, lang);
    setInput("");
    setTimeout(() => { inputRef.current?.focus(); chatBottom(); }, 30);
  }
  const initials = (n: string) => n.split(" ").map((w) => w[0]).join("");

  return (
    <>
      <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.chat.title}</h1>
      <p className="mb-[18px] mt-[5px] max-w-[640px] text-[14px] text-text-2 [text-wrap:pretty]">{t.chat.sub}</p>
      <div className={`opl-chat-shell flex h-[calc(100vh-250px)] min-h-[460px] overflow-hidden rounded-[16px] border border-line bg-surface ${mobOpen ? "open" : ""}`}>
        <div className="opl-chat-list w-[300px] flex-none overflow-y-auto border-r border-line-2">
          <div className="sticky top-0 z-5 border-b border-bg-4 bg-surface px-[10px] pb-2 pt-[10px]">
            <div className="relative">
              <IconSearch size={14} className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted-2" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.chat.search} className="w-full rounded-[10px] border border-line bg-bg py-[9px] pl-8 pr-[11px] text-[13px] outline-none" />
            </div>
          </div>
          {list.length === 0 && <div className="px-[14px] py-6 text-center text-[12.5px] text-muted">{t.chat.notFound}</div>}
          {list.map((d) => {
            const w = peer(d);
            const last = lastOf(d);
            const n = unread(d);
            return (
              <div key={d.id} onClick={() => { setCur(d.id); setMobOpen(true); setTimeout(chatBottom, 50); }} className={`flex cursor-pointer items-center gap-[10px] border-b border-bg-3 px-[14px] py-3 hover:brightness-95 ${d.id === dlg?.id ? "bg-blue-tint" : "bg-surface"}`}>
                <div className="relative flex-none">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: w.color }}>{d.who === "sup" ? <IconHeadset size={19} /> : initials(w.name)}</div>
                  {w.online && <span className="absolute bottom-0 right-0 h-[11px] w-[11px] rounded-full border-2 border-surface bg-green-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-bold text-ink">{w.name}</div>
                  <div className="truncate text-[12px] text-muted">
                    {last?.me && <span title={last.ts ? t.chat.dlvT : t.chat.readT} className="mr-1 inline-flex align-[-2px]"><IconChecks size={13} style={{ color: last.ts ? "#aab1bd" : "#4d7cfe" }} /></span>}
                    {last?.tx[lang] ?? ""}
                  </div>
                </div>
                <div className="flex flex-none flex-col items-end gap-1">
                  <span className="text-[10.5px] text-muted-2">{last?.time ?? ""}</span>
                  {n > 0 && <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-blue-2 px-[5px] text-[10px] font-bold text-white">{n}</span>}
                </div>
              </div>
            );
          })}
        </div>

        <div className="opl-chat-win flex min-w-0 flex-1 flex-col">
          <div data-chat-hdr="1" className="box-border flex min-h-[56px] items-center gap-[11px] border-b border-line-2 px-4 py-[9px]">
            <span onClick={() => setMobOpen(false)} className="opl-chat-back hidden h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-[10px] border border-line text-[18px] text-ink hover:bg-line-2"><IconArrowLeft size={18} /></span>
            <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full text-[13px] font-bold text-white" style={{ background: who.color }}>{dlg?.who === "sup" ? <IconHeadset size={18} /> : initials(who.name)}</div>
            <div className="min-w-0 flex-1">
              <div className="text-[14.5px] font-bold text-ink">{who.name}</div>
              <div className="text-[11.5px]" style={{ color: who.online ? "#0f9d6b" : "#aab1bd" }}>{who.online ? t.chat.online : t.chat.ls}</div>
            </div>
            <span title="WhatsApp" className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[10px] border border-line text-[16px] text-green-3 hover:border-green-3"><IconBrandWhatsapp size={16} /></span>
            <div onClick={() => setTranslate(!tr)} title={tr ? t.chat.trOn : t.chat.trOff} className={`flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[10px] border hover:brightness-95 ${tr ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-muted"}`}><IconLanguage size={16} /></div>
          </div>
          <div ref={msgsRef} data-chat-msgs="1" className="flex flex-1 flex-col gap-[10px] overflow-y-auto overflow-x-hidden bg-bg-3 p-[18px] [overscroll-behavior:contain]">
            <div className="mt-auto flex-none" />
            {dlg?.msgs.map((m, i) => {
              const key = `${dlg.id}:${i}`;
              const foreign = m.lang !== lang, showTr = tr && foreign, isOrig = !!orig[key];
              const text = showTr && !isOrig ? m.tx[lang] : m.tx[m.lang];
              const obj = m.objId ? all.find((o) => o.id === m.objId) : null;
              return (
                <div key={key} className={`flex ${m.me ? "justify-end" : "justify-start"}`}>
                  <div className={`max-w-[72%] rounded-[14px] px-[13px] py-[10px] ${m.me ? "rounded-br-[4px] bg-blue-2 text-white" : "rounded-bl-[4px] border border-line bg-surface text-ink"}`}>
                    {obj && (
                      <Link href={`/obj/${obj.id}`} className={`mt-2 flex cursor-pointer items-center gap-[9px] rounded-[10px] px-[9px] py-[7px] hover:brightness-95 ${m.me ? "bg-[rgba(255,255,255,.16)]" : "border border-line-4 bg-bg-3"}`}>
                        <span className="h-[42px] w-[56px] flex-none rounded-[7px] bg-cover bg-center" style={{ backgroundImage: `url(${obj.img})` }} />
                        <span className="min-w-0 flex-1"><span className="block truncate text-[12px] font-bold">{obj.t[lang]}</span><span className="text-[11px] opacity-75">{fmt(obj.price, obj.cur)} · {t.reqs.openObj}</span></span>
                        <IconChevronRight size={15} className="flex-none opacity-70" />
                      </Link>
                    )}
                    {m.by && !m.me && <div className="mb-[3px] text-[10.5px] font-bold text-blue-2">{m.by}</div>}
                    <div className="text-[13.5px] leading-[1.5]">{text}</div>
                    {showTr && (
                      <div onClick={() => setOrig((o) => ({ ...o, [key]: !o[key] }))} className="mt-[5px] flex cursor-pointer items-center gap-1 text-[10.5px] opacity-75 hover:brightness-95">
                        <IconSparkles size={11} /> {isOrig ? `${m.lang} · ${t.chat.orig} — ${t.chat.ai} ⇄` : `${m.lang} → ${lang} · ${t.chat.ai}`}
                      </div>
                    )}
                    <div className="mt-1 flex items-center justify-end gap-1 text-[10px]">
                      <span className="opacity-60">{m.time}</span>
                      {m.me && <span title={m.ts ? t.chat.dlvT : t.chat.readT} className="inline-flex"><IconChecks size={13} style={{ color: m.ts ? "rgba(255,255,255,.65)" : "#8fe3ff" }} /></span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex gap-[9px] border-t border-line-2 px-4 py-[13px]">
            <input ref={inputRef} data-chat-input="1" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMsg(); } }} placeholder={t.chat.ph} className="min-w-0 flex-1 rounded-[11px] border border-line px-[13px] py-[11px] text-[14px] outline-none" />
            <button type="button" onClick={sendMsg} onMouseDown={(e) => e.preventDefault()} onTouchEnd={(e) => { e.preventDefault(); sendMsg(); }} className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-[11px] bg-blue-2 text-[17px] text-white hover:bg-blue-3"><IconSend size={17} /></button>
          </div>
        </div>
      </div>
    </>
  );
}

export function ChatDemo() {
  return <Suspense><ChatInner /></Suspense>;
}
