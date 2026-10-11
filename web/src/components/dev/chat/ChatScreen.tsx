"use client";

// Chat — prototype `OnePlan v2.dc.html` lines 1143–1197 (markup), 3842–3880 + 3966–3983 (data), spec §1.16 / §5.4.
// 1-on-1 threads with `TEAM`, search, delivery ticks (sent → delivered 700 ms → read 2100 ms), AI translation
// with cache (`trStore`), read-language switch, mobile list/thread toggle with «back».
import { useEffect, useRef, useState } from "react";
import { IconArrowLeft, IconCheck, IconChecks, IconLanguage, IconMessage2, IconSearch, IconSend } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { CHAT_PEERS, DM_UNREAD, SUPPORT_PEER } from "@/lib/dev/data";
import { agoText } from "@/lib/dev/notifs";
import type { DevLang, DM } from "@/lib/dev/types";
import { openDM, patchDM, pushDM, useDev } from "@/store/dev";
import { ensureTr, trKey, useTrCache } from "./trStore";
import { useMobile } from "./useMobile";

const ME = { init: "AY", color: "#4d7cfe" }; // current user in the prototype = TEAM[0]
const LANGS: DevLang[] = ["RU", "EN", "TR"];
const EMPTY: DM[] = [];
const minsOf = (m: DM) => (m.ts ? Math.max(0, Math.floor((Date.now() - m.ts) / 60000)) : m.mins);

export function ChatScreen() {
  const { t, tt, lang } = useDevT();
  const s = useDev();
  const mobile = useMobile();
  const cache = useTrCache();
  const [peer, setPeer] = useState<number | null>(null);
  const [search, setSearch] = useState("");
  const [trOn, setTrOn] = useState(true);
  const [readLangSel, setReadLangSel] = useState<DevLang | null>(null);
  const [draft, setDraft] = useState("");
  const [trShow, setTrShow] = useState<Record<string, boolean>>({});
  const feedRef = useRef<HTMLDivElement>(null);
  const readLang: DevLang = readLangSel ?? lang;
  const roles = t.roles as Record<string, string>;

  const thread = (peer !== null && s.dm[peer]) || EMPTY;
  const p = peer !== null && peer !== undefined ? CHAT_PEERS.find((x) => x.id === peer) ?? null : null;

  // Request missing translations (prototype called `ensureTr` during render; here after render).
  useEffect(() => {
    if (!trOn) return;
    thread.forEach((m) => { if (m.text && m.lang && m.lang !== readLang) ensureTr(m.text, readLang); });
  }, [thread, trOn, readLang]);
  // Keep the feed scrolled to the latest message.
  useEffect(() => { const el = feedRef.current; if (el) el.scrollTop = el.scrollHeight; }, [thread.length, peer]);

  const q = search.trim().toLowerCase();
  const convos = CHAT_PEERS.filter((x) => x.id === SUPPORT_PEER.id || !q || x.name.toLowerCase().includes(q)).map((x) => {
    const th = s.dm[x.id] ?? [];
    const last = th.length ? th[th.length - 1] : null;
    const unread = !!(DM_UNREAD[x.id] || 0) && peer !== x.id && !s.dmOpened.includes(String(x.id));
    return { ...x, roleLabel: x.role === "support" ? tt.support : roles[x.role] || "", preview: last ? `${last.who === "me" ? `${tt.you}: ` : ""}${last.text}` : "", ago: last ? agoText(minsOf(last), tt) : "", unread, active: peer === x.id };
  });

  const send = () => {
    const tx = draft.trim();
    if (!tx || peer === null) return;
    const mid = Date.now();
    pushDM(peer, { who: "me", text: tx, mins: 0, st: "sent", mid, lang, ts: mid });
    setDraft("");
    const pid = peer;
    setTimeout(() => patchDM(pid, mid, { st: "delivered" }), 700);
    setTimeout(() => patchDM(pid, mid, { st: "read" }), 2100);
  };

  const listPane = mobile && peer !== null ? "hidden" : `flex flex-none flex-col border-r border-line-2 bg-surface ${mobile ? "w-full" : "w-[330px]"}`;
  const threadPane = mobile && peer === null ? "hidden" : "flex min-w-0 flex-1 flex-col";

  return (
    <div className="mx-auto flex h-[calc(100vh-150px)] min-h-[460px] max-w-[1100px] overflow-hidden rounded-[16px] border border-line bg-surface">
      <div className={listPane}>
        <div className="flex-none px-[14px] pb-[10px] pt-[14px]">
          <div className="mb-[10px] text-[16px] font-extrabold text-ink">{tt.dm_title}</div>
          <div className="relative">
            <IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98a1af]" />
            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tt.dm_search} className="w-full rounded-[11px] border border-line bg-bg-4 py-[9px] pl-[34px] pr-3 text-[13.5px] text-ink outline-none" />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-[10px] pt-1">
          {convos.map((c) => (
            <div key={c.id} onClick={() => { setPeer(c.id); openDM(c.id); }} className={`flex cursor-pointer items-center gap-[11px] rounded-[12px] px-3 py-[11px] hover:bg-[#f5f7fb] ${c.active ? "bg-blue-tint" : ""}`}>
              <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-[14px] font-extrabold text-white" style={{ background: c.color }}>{c.init}</span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[6px]"><span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[14px] font-bold text-ink">{c.name}</span><span className="flex-none text-[11px] text-[#98a1af]">{c.ago}</span></div>
                <div className="mt-[2px] flex items-center gap-[6px]"><span className="flex-1 overflow-hidden text-ellipsis whitespace-nowrap text-[12.5px] text-text-2">{c.preview}</span>{c.unread && <span className="h-[9px] w-[9px] flex-none rounded-full bg-blue" />}</div>
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className={threadPane}>
        {p ? (
          <>
            <div className="flex flex-none items-center gap-[11px] border-b border-line-2 bg-surface px-4 py-[11px]">
              <span onClick={() => setPeer(null)} className={`h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[9px] border border-line text-[18px] text-text ${mobile ? "flex" : "hidden"}`}><IconArrowLeft size={18} /></span>
              <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full text-[13px] font-extrabold text-white" style={{ background: p.color }}>{p.init}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-extrabold text-ink">{p.name}</div>
                <div className="flex items-center gap-[5px] text-[12px] text-green"><span className="h-[7px] w-[7px] rounded-full bg-green-3" />{tt.online}</div>
              </div>
              <div onClick={() => setTrOn((v) => !v)} title={tt.tr_on} className={`flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[9px] border text-[18px] ${trOn ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-muted"}`}><IconLanguage size={18} /></div>
              {trOn && (
                <div className="flex flex-none gap-[3px] rounded-[8px] bg-bg-2 p-[3px]">
                  {LANGS.map((lc) => (
                    <span key={lc} onClick={() => setReadLangSel(lc)} title={tt.tr_read} className={`cursor-pointer rounded-[7px] px-[9px] py-1 text-[11px] font-bold ${readLang === lc ? "bg-surface text-blue shadow-[0_1px_3px_rgba(20,36,63,.12)]" : "text-text-2"}`}>{lc}</span>
                  ))}
                </div>
              )}
            </div>
            <div ref={feedRef} className="flex-1 overflow-y-auto bg-bg-3 px-[clamp(12px,3vw,22px)] py-[18px]">
              {thread.map((m, i) => {
                const me = m.who === "me";
                const pp = me ? { init: ME.init, color: ME.color } : CHAT_PEERS.find((x) => x.id === m.who) ?? { init: "?", color: "#8a93a2" };
                const mkey = `${peer}:${i}`;
                const showOrig = !!trShow[mkey];
                const srcLang = m.lang || "";
                let text = m.text, trState: "none" | "loading" | "done" | "fallback" = "none";
                if (trOn && m.text && srcLang && srcLang !== readLang) {
                  const e = cache[trKey(readLang, m.text)];
                  if (e === undefined) trState = "loading";
                  else if (e.fallback) trState = "fallback";
                  else if (e.text.trim()) { trState = "done"; if (!showOrig) text = e.text; }
                }
                const infoCls = `mx-[2px] mt-[3px] flex items-center gap-[5px] text-[11px] text-[#9aa3b1] ${me ? "flex-row-reverse" : ""}`;
                return (
                  <div key={m.mid ?? i} className={`mb-[14px] flex items-start gap-[9px] ${me ? "flex-row-reverse" : ""}`}>
                    <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[11px] font-extrabold text-white" style={{ background: pp.color }}>{pp.init}</span>
                    <div className={`flex min-w-0 max-w-[min(560px,74%)] flex-col ${me ? "items-end" : "items-start"}`}>
                      <div className={`w-fit max-w-full break-words rounded-[14px] px-[13px] py-[9px] text-[14px] leading-[1.45] ${me ? "rounded-br-[5px] bg-blue text-white" : "rounded-bl-[5px] border border-line bg-surface text-ink"}`}>{text}</div>
                      <div className={`mx-[2px] mt-[3px] flex items-center gap-1 text-[11px] text-[#98a1af] ${me ? "flex-row-reverse" : ""}`}>
                        <span>{agoText(minsOf(m), tt)}</span>
                        {me && (m.st === "sent"
                          ? <IconCheck size={14} className="text-[#b3bcc9]" aria-label={tt.dlv_sent} />
                          : <IconChecks size={14} className={(m.st || "read") === "read" ? "text-blue" : "text-[#b3bcc9]"} aria-label={(tt as unknown as Record<string, string>)[`dlv_${m.st || "read"}`]} />)}
                      </div>
                      {trState === "loading" && <div className={infoCls}><IconLanguage size={12} />{tt.tr_loading}</div>}
                      {trState === "fallback" && <div className={infoCls}><IconLanguage size={12} />{t.px.tr_fallback}</div>}
                      {trState === "done" && (
                        <div onClick={() => setTrShow((v) => ({ ...v, [mkey]: !v[mkey] }))} className={`${infoCls} cursor-pointer`}>
                          <IconLanguage size={12} className="text-blue" />{showOrig ? `· ${tt.tr_orig}` : `🌐 ${tt.tr_by} · ${srcLang}→${readLang}`}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-none items-center gap-[10px] border-t border-line-2 bg-surface px-[14px] py-3">
              <input value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }} placeholder={tt.chat_ph} className="flex-1 rounded-[12px] border border-line bg-bg-4 px-[15px] py-3 text-[14px] text-ink outline-none" />
              <button type="button" onClick={send} title={tt.chat_send} className="flex h-[46px] w-[46px] flex-none cursor-pointer items-center justify-center rounded-[12px] border-0 bg-blue text-[20px] text-white hover:bg-[#3a63d4]"><IconSend size={20} /></button>
            </div>
          </>
        ) : (
          <div className="flex flex-1 flex-col items-center justify-center p-[30px] text-center text-[#98a1af]">
            <span className="mb-[14px] flex h-16 w-16 items-center justify-center rounded-full bg-blue-tint text-[30px] text-blue"><IconMessage2 size={30} /></span>
            <div className="mb-[5px] text-[17px] font-extrabold text-ink">{tt.dm_empty}</div>
            <div className="text-[13.5px] text-[#98a1af]">{tt.dm_empty_sub}</div>
          </div>
        )}
      </div>
    </div>
  );
}
