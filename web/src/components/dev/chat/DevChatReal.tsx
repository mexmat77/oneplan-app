"use client";

// Чат кабинета застройщика на Supabase (разметка — ChatScreen прототипа): слева поддержка и коллеги по компании, справа переписка.
// Диалог с коллегой создаётся при первом открытии. Перевод — ИИ по кнопке с выбором языка чтения (trStore).
import { ChatInput } from "@/components/chat/ChatInput";
import { LinkCard, firstOplLink } from "@/components/chat/LinkPreview";
import { linkify } from "@/lib/shareListing";
import { useEffect, useRef, useState } from "react";
import { IconArrowLeft, IconChecks, IconHeadset, IconLanguage, IconMessage2, IconSearch, IconSend, IconTrash } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import type { DevLang } from "@/lib/dev/types";
import { Avatar } from "@/components/ui/UserMenu";
import { hideConversation, openDmWith, openSupport, useConversations, useThread, type ChatPeer } from "@/lib/chat/client";
import { orgLabel, type OrgDict } from "@/lib/chat/shared";
import { confirmDialog } from "@/components/ui/confirm";
import { ensureTr, trKey, useTrCache } from "./trStore";
import { useMobile } from "./useMobile";

const LANGS: DevLang[] = ["RU", "EN", "TR"];
const nowMs = () => Date.now(); // вынесено: react-compiler считает Date.now() в рендере нечистым
type Row = { key: string; peer: ChatPeer; support: boolean; convId: string | null; preview: string; when: string; unread: number; mineLast: boolean; lastRead: boolean };

export function DevChatReal({ me, supportId, colleagues }: { me: { id: string; name: string; isAdmin: boolean }; supportId: string; colleagues: ChatPeer[] }) {
  const { t, tt, lang } = useDevT();
  const mobile = useMobile();
  const cache = useTrCache();
  const { conversations, reload } = useConversations(me.id, supportId, me.isAdmin);
  const [cur, setCur] = useState<string | null>(null);
  const [curPeer, setCurPeer] = useState<ChatPeer | null>(null);
  const { messages, names, send, markRead } = useThread(cur, me.id);
  const [search, setSearch] = useState("");
  const [trOn, setTrOn] = useState(true);
  const [readLangSel, setReadLangSel] = useState<DevLang | null>(null);
  const [draft, setDraft] = useState("");
  const [trShow, setTrShow] = useState<Record<number, boolean>>({});
  const feedRef = useRef<HTMLDivElement>(null);
  const readLang: DevLang = readLangSel ?? lang;
  const txt = (m: { lang: string; text: Record<string, string> }) => m.text[m.lang] ?? Object.values(m.text)[0] ?? "";
  const when = (iso: string) => { const d = new Date(iso); const mins = Math.max(0, Math.floor((nowMs() - d.getTime()) / 60000)); if (mins < 1) return tt.ago_now; if (mins < 60) return `${mins} ${tt.ago_min}`; if (mins < 1440) return `${Math.floor(mins / 60)} ${tt.ago_h}`; return `${Math.floor(mins / 1440)} ${tt.ago_d}`; };

  useEffect(() => { if (cur) void markRead().then(reload); }, [cur, messages.length, markRead, reload]);
  useEffect(() => { const el = feedRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length, cur]);
  useEffect(() => { if (!trOn) return; messages.forEach((m) => { const s = txt(m); if (s && m.lang !== readLang) ensureTr(s, readLang); }); }, [messages, trOn, readLang]);

  // Строки списка: поддержка, коллеги (с диалогом или без), остальные существующие диалоги
  const supportPeer: ChatPeer = { id: supportId, name: "OnePlan Support", email: null, phone: null, color: "#14243f", agency: "", org: "staff", online: true, lastSeen: null, support: true };
  const O: OrgDict = { agency: tt.org_agency, developer: tt.org_dev, free: tt.org_free, staff: tt.org_staff };
  const byPeer = new Map(conversations.map((c) => [c.peer.id, c]));
  const mySupport = conversations.find((c) => c.kind === "support" && !c.supportOf) ?? null;
  const rows: Row[] = [];
  const mk = (peer: ChatPeer, support: boolean, c: typeof mySupport): Row => ({ key: peer.id, peer, support, convId: c?.id ?? null, preview: c?.last ? `${c.last.senderId === me.id ? `${tt.you}: ` : ""}${txt(c.last)}` : "", when: c?.last ? when(c.last.createdAt) : "", unread: c?.unread ?? 0, mineLast: c?.last?.senderId === me.id, lastRead: !!c?.last?.readAt });
  if (!me.isAdmin) rows.push(mk(supportPeer, true, mySupport));
  colleagues.forEach((p) => rows.push(mk(p, false, byPeer.get(p.id) ?? null)));
  // чужие диалоги вне списка коллег — только если в них уже есть сообщения (пустой диалог виден лишь тому, кто его открыл)
  conversations.filter((c) => !rows.some((r) => r.peer.id === c.peer.id) && !(c.kind === "support" && !c.supportOf) && (c.last || c.id === cur)).forEach((c) => rows.push({ ...mk(c.peer, !!c.supportOf, c), key: c.id }));
  const q = search.trim().toLowerCase();
  const list = rows.filter((r) => r.support || !q || `${r.peer.name} ${r.peer.agency}`.toLowerCase().includes(q)).sort((a, b) => (b.convId ? 1 : 0) - (a.convId ? 1 : 0));

  const open = async (r: Row) => {
    setCurPeer(r.peer);
    let id = r.convId;
    if (!id) id = r.support && !me.isAdmin ? await openSupport(me.id, supportId) : await openDmWith(me.id, r.peer.id);
    if (id) { setCur(id); await reload(); }
  };
  const removeDlg = async () => {
    if (!cur) return;
    if (!(await confirmDialog({ title: tt.dm_remove, text: tt.dm_remove_confirm, ok: tt.dm_remove, danger: true }))) return;
    if (await hideConversation(cur, me.id)) { setCur(null); setCurPeer(null); await reload(); }
  };
  const sendMsg = async () => { const v = draft.trim(); if (!v || !cur) return; setDraft(""); await send(v, lang); await reload(); };
  const active = conversations.find((c) => c.id === cur) ?? null;
  const isSupportThread = !!active && active.kind === "support";
  const listPane = mobile && cur ? "hidden" : `flex flex-none flex-col border-r border-line-2 bg-surface ${mobile ? "w-full" : "w-[330px]"}`;
  const threadPane = mobile && !cur ? "hidden" : "flex min-w-0 flex-1 flex-col";

  return (
    <div className="mx-auto flex h-[calc(100vh-150px)] min-h-[460px] max-w-[1100px] overflow-hidden rounded-[16px] border border-line bg-surface">
      <div className={listPane}>
        <div className="flex-none px-[14px] pb-[10px] pt-[14px]">
          <div className="mb-[10px] text-[16px] font-extrabold text-ink">{tt.dm_title}</div>
          <div className="relative"><IconSearch size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#98a1af]" /><input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={tt.dm_search} className="w-full rounded-[11px] border border-line bg-bg-4 py-[9px] pl-[34px] pr-3 text-[13.5px] text-ink outline-none" /></div>
        </div>
        <div className="flex-1 overflow-y-auto px-2 pb-[10px] pt-1">
          {list.map((r) => (
            <div key={r.key} onClick={() => void open(r)} className={`flex cursor-pointer items-center gap-[11px] rounded-[12px] px-3 py-[11px] hover:bg-[#f5f7fb] ${r.convId && r.convId === cur ? "bg-blue-tint" : ""}`}>
              {r.support && !r.peer.support ? <Avatar name={r.peer.name} size={44} color={r.peer.color} /> : r.support ? <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-ink text-white"><IconHeadset size={20} /></span> : <Avatar name={r.peer.name} size={44} color={r.peer.color} />}
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[6px]"><span className="flex-1 truncate text-[14px] font-bold text-ink">{r.peer.name}</span><span className="flex-none text-[11px] text-[#98a1af]">{r.when}</span></div>
                {!r.support && orgLabel(r.peer, O) && <div className="truncate text-[11px] font-semibold text-text-2">{orgLabel(r.peer, O)}</div>}
                <div className="mt-[2px] flex items-center gap-[6px]"><span className="flex-1 truncate text-[12.5px] text-text-2">{r.preview || (r.support ? tt.support : "")}</span>{r.unread > 0 && <span className="flex h-[18px] min-w-[18px] flex-none items-center justify-center rounded-[9px] bg-blue px-[5px] text-[10px] font-bold text-white">{r.unread}</span>}</div>
              </div>
            </div>
          ))}
          {list.length === 0 && <div className="px-3 py-6 text-center text-[12.5px] text-[#98a1af]">{tt.dm_empty}</div>}
        </div>
      </div>

      <div className={threadPane}>
        {cur && curPeer ? (
          <>
            <div className="flex flex-none items-center gap-[11px] border-b border-line-2 bg-surface px-4 py-[11px]">
              <span onClick={() => { setCur(null); setCurPeer(null); }} className={`h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[9px] border border-line text-[18px] text-text ${mobile ? "flex" : "hidden"}`}><IconArrowLeft size={18} /></span>
              {curPeer.support ? <span className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-ink text-white"><IconHeadset size={18} /></span> : <Avatar name={curPeer.name} size={38} color={curPeer.color} />}
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-extrabold text-ink">{curPeer.name}</div>
                <div className="flex items-center gap-[5px] text-[12px] text-text-2">{curPeer.online && <span className="h-[7px] w-[7px] rounded-full bg-green-3" />}{curPeer.support ? tt.support : [curPeer.online ? tt.online : "", orgLabel(curPeer, O)].filter(Boolean).join(" · ")}</div>
              </div>
              <div onClick={() => setTrOn((v) => !v)} title={tt.tr_on} className={`flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[9px] border text-[18px] ${trOn ? "border-blue bg-blue-tint text-blue" : "border-line bg-surface text-text"}`}><IconLanguage size={18} /></div>
              {trOn && <div className="flex flex-none gap-[3px] rounded-[8px] bg-bg-2 p-[3px]">{LANGS.map((lc) => <span key={lc} onClick={() => setReadLangSel(lc)} title={tt.tr_read} className={`cursor-pointer rounded-[7px] px-[9px] py-1 text-[11px] font-bold ${readLang === lc ? "bg-surface text-blue shadow-[0_1px_3px_rgba(20,36,63,.12)]" : "text-muted"}`}>{lc}</span>)}</div>}
              {!(isSupportThread && !active?.supportOf) && <button type="button" onClick={() => void removeDlg()} title={tt.dm_remove} className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[9px] border border-line text-muted hover:border-red hover:text-red"><IconTrash size={16} /></button>}
            </div>
            <div ref={feedRef} className="flex-1 overflow-y-auto bg-bg-3 px-[clamp(12px,3vw,22px)] py-[18px]">
              {messages.length === 0 && <div className="py-8 text-center text-[13px] text-[#98a1af]">{isSupportThread && !active?.supportOf ? tt.support : tt.dm_empty_sub}</div>}
              {messages.map((m) => {
                const mine = m.senderId === me.id;
                const src = txt(m);
                let text = src, trState: "none" | "loading" | "done" | "fallback" = "none";
                if (trOn && src && m.lang !== readLang) { const e = cache[trKey(readLang, src)]; if (e === undefined) trState = "loading"; else if (e.fallback) trState = "fallback"; else if (e.text.trim()) { trState = "done"; if (!trShow[m.id]) text = e.text; } }
                const by = !mine && isSupportThread && !active?.supportOf ? `${names[m.senderId] ?? ""} · OnePlan Support` : !mine ? names[m.senderId] : null;
                const infoCls = `mx-[2px] mt-[3px] flex items-center gap-[5px] text-[11px] text-[#9aa3b1] ${mine ? "flex-row-reverse" : ""}`;
                return (
                  <div key={m.id} className={`mb-[14px] flex items-start gap-[9px] ${mine ? "flex-row-reverse" : ""}`}>
                    <Avatar name={mine ? me.name : names[m.senderId] ?? "?"} size={32} color={mine ? "#4d7cfe" : curPeer.support ? "#14243f" : curPeer.color} />
                    <div className={`flex min-w-0 max-w-[min(560px,74%)] flex-col ${mine ? "items-end" : "items-start"}`}>
                      {by && <div className="mb-[2px] text-[10.5px] font-bold text-blue-2">{by}</div>}
                      <div className={`w-fit max-w-full whitespace-pre-wrap break-words rounded-[14px] px-[13px] py-[9px] text-[14px] leading-[1.45] ${mine ? "rounded-br-[5px] bg-blue text-white" : "rounded-bl-[5px] border border-line bg-surface text-ink"}`}>{linkify(text).map((p, i) => (typeof p === "string" ? p : <a key={i} href={p.url} target="_blank" rel="noreferrer" className="underline underline-offset-2 break-all">{p.url.replace(/^https?:\/\//, "")}</a>))}{(() => { const u = firstOplLink(linkify(text).filter((p): p is { url: string } => typeof p !== "string").map((p) => p.url)); return u ? <LinkCard url={u} mine={mine} /> : null; })()}</div>
                      <div className={`mx-[2px] mt-[3px] flex items-center gap-1 text-[11px] text-[#98a1af] ${mine ? "flex-row-reverse" : ""}`}><span>{when(m.createdAt)}</span>{mine && <IconChecks size={14} className={m.readAt ? "text-blue" : "text-[#b3bcc9]"} />}</div>
                      {trState === "loading" && <div className={infoCls}><IconLanguage size={12} />{tt.tr_loading}</div>}
                      {trState === "fallback" && <div className={infoCls}><IconLanguage size={12} />{t.px.tr_fallback}</div>}
                      {trState === "done" && <div onClick={() => setTrShow((v) => ({ ...v, [m.id]: !v[m.id] }))} className={`${infoCls} cursor-pointer`}><IconLanguage size={12} className="text-blue" />{trShow[m.id] ? `· ${tt.tr_orig}` : `🌐 ${tt.tr_by} · ${m.lang}→${readLang}`}</div>}
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="flex flex-none items-end gap-[10px] border-t border-line-2 bg-surface px-[14px] py-3">
              <ChatInput value={draft} onChange={setDraft} onSend={() => void sendMsg()} placeholder={tt.chat_ph} className="bg-bg-4 text-ink" />
              <button type="button" onClick={() => void sendMsg()} title={tt.chat_send} className="flex h-[46px] w-[46px] flex-none cursor-pointer items-center justify-center self-end rounded-[12px] border-0 bg-blue text-[20px] text-white hover:bg-[#3a63d4]"><IconSend size={20} /></button>
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
