"use client";

// Чат риэлторов на Supabase (разметка — прототип 770–817, как в ChatDemo). Диалоги 1-на-1 с участниками базы и с поддержкой;
// админ платформы видит все диалоги поддержки и отвечает в них от своего имени. Перевод — ИИ по кнопке (trStore, как в кабинете застройщика).
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { confirmDialog } from "@/components/ui/confirm";
import { IconArrowLeft, IconBrandWhatsapp, IconChecks, IconHeadset, IconLanguage, IconMessagePlus, IconSearch, IconSend, IconSparkles, IconTrash, IconX } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import type { Lang } from "@/i18n";
import { Avatar } from "@/components/ui/UserMenu";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { showToast } from "@/components/ui/toast";
import { ensureTr, trKey, useTrCache } from "@/components/dev/chat/trStore";
import { hideConversation, listChatPeers, openDmWith, openSupport, useConversations, useThread, type ChatPeer, type Conversation } from "@/lib/chat/client";
import { orgLabel, type OrgDict } from "@/lib/chat/shared";
import { normPh } from "@/lib/phone";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const TR_KEY = "oneplan-chat-tr";

export function RealtorChat({ me, supportId }: { me: { id: string; name: string; isAdmin: boolean }; supportId: string }) {
  const { t, lang } = useI18n();
  const router = useRouter();
  const params = useSearchParams();
  const cache = useTrCache();
  const { conversations, loaded, reload } = useConversations(me.id, supportId, me.isAdmin);
  const [cur, setCur] = useState<string | null>(null);
  const { messages, names, send, markRead } = useThread(cur, me.id);
  const [q, setQ] = useState("");
  const [mobOpen, setMobOpen] = useState(false);
  const [input, setInput] = useState("");
  const [tr, setTr] = useState(() => { try { return localStorage.getItem(TR_KEY) !== "0"; } catch { return true; } });
  const [orig, setOrig] = useState<Record<number, boolean>>({});
  const [picker, setPicker] = useState<null | { q: string; list: ChatPeer[] | null }>(null);
  const msgsRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const L = (ru: string, en: string, trs: string) => (lang === "RU" ? ru : lang === "TR" ? trs : en);

  // ?with=sup → поддержка; ?with=<uuid> → диалог с участником
  useEffect(() => {
    const w = params.get("with");
    if (!w) return;
    (async () => {
      const id = w === "sup" ? await openSupport(me.id, supportId) : UUID.test(w) ? await openDmWith(me.id, w) : null;
      if (id) { setCur(id); setMobOpen(true); await reload(); }
      router.replace("/chat");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params]);
  // по умолчанию — поддержка (как в прототипе), если диалогов нет — создаём её
  useEffect(() => {
    if (!loaded || cur || me.isAdmin) return;
    const sup = conversations.find((c) => c.kind === "support" && !c.supportOf);
    queueMicrotask(() => { if (sup) setCur(sup.id); else void openSupport(me.id, supportId).then((id) => { if (id) { setCur(id); void reload(); } }); });
  }, [loaded, cur, conversations, me.id, me.isAdmin, supportId, reload]);
  useEffect(() => { if (cur) void markRead().then(reload); }, [cur, messages.length, markRead, reload]);
  useEffect(() => { const el = msgsRef.current; if (el) el.scrollTop = el.scrollHeight; }, [messages.length, cur]);
  useEffect(() => { if (!tr) return; messages.forEach((m) => { const src = m.text[m.lang]; if (src && m.lang !== lang) ensureTr(src, lang as Lang); }); }, [messages, tr, lang]);

  const dlg = conversations.find((c) => c.id === cur) ?? null;
  const peerName = (c: Conversation) => (c.kind === "support" && !c.supportOf ? "OnePlan Support" : c.peer.name);
  const O: OrgDict = { agency: t.chat.orgAgency, developer: t.chat.orgDev, free: t.chat.orgFree, staff: t.chat.orgStaff };
  const orgOf = (c: Conversation) => (c.kind === "support" && !c.supportOf ? "" : orgLabel(c.peer, O));
  const nq = q.trim().toLowerCase();
  const list = [...conversations]
    .sort((a, b) => { const sa = a.kind === "support" && !a.supportOf ? 1 : 0, sb = b.kind === "support" && !b.supportOf ? 1 : 0; if (sa !== sb) return sb - sa; return (b.last ? +new Date(b.last.createdAt) : 0) - (a.last ? +new Date(a.last.createdAt) : 0); })
    .filter((c) => !nq || `${peerName(c)} ${c.peer.agency}`.toLowerCase().includes(nq))
    .filter((c) => (c.kind === "support" && !c.supportOf) || c.last || c.id === cur); // пустой (или удалённый у себя) диалог показываем только открывшему
  const time = (iso: string) => new Date(iso).toLocaleTimeString(lang === "RU" ? "ru-RU" : lang === "TR" ? "tr-TR" : "en-GB", { hour: "2-digit", minute: "2-digit" });
  const txt = (m: { lang: string; text: Record<string, string> }) => m.text[m.lang] ?? Object.values(m.text)[0] ?? "";

  const sendMsg = async () => {
    const v = input.trim(); if (!v || !cur) return;
    setInput("");
    const ok = await send(v, lang);
    if (!ok) showToast(t.add.linkBad === undefined ? "Error" : L("Не удалось отправить", "Could not send", "Gönderilemedi"));
    await reload();
    setTimeout(() => { inputRef.current?.focus(); const el = msgsRef.current; if (el) el.scrollTop = el.scrollHeight; }, 30);
  };
  const openPicker = async () => { setPicker({ q: "", list: null }); const l = await listChatPeers(me.id, supportId, { isAdmin: me.isAdmin }); setPicker((p) => (p ? { ...p, list: l } : p)); };
  const startWith = async (p: ChatPeer) => { const id = await openDmWith(me.id, p.id); setPicker(null); if (id) { setCur(id); setMobOpen(true); await reload(); } };
  const removeDlg = async () => { if (!dlg) return; const isSupportInbox = !!dlg.supportOf; if (!(await confirmDialog({ title: isSupportInbox ? L("Закрыть обращение", "Close request", "Talebi kapat") : L("Удалить диалог", "Remove chat", "Sohbeti sil"), ok: isSupportInbox ? L("Закрыть", "Close", "Kapat") : L("Удалить", "Remove", "Sil"), danger: true, text: isSupportInbox ? L("Закрыть обращение? Переписка исчезнет у вас; если пользователь напишет снова, обращение появится заново только с новыми сообщениями.", "Close this request? The history disappears for you; if the user writes again, the request reappears with the new messages only.", "Talep kapatılsın mı? Yazışma sizde silinir; kullanıcı tekrar yazarsa talep yalnızca yeni mesajlarla geri gelir.") : L("Удалить переписку у себя? У собеседника она останется. Если он напишет снова, диалог появится заново только с новыми сообщениями.", "Delete this chat for you? The other party keeps it. If they write again, the chat reappears with the new messages only.", "Yazışma sizde silinsin mi? Karşı tarafta kalır. Tekrar yazarsa sohbet yalnızca yeni mesajlarla geri gelir.") }))) return; if (await hideConversation(dlg.id, me.id)) { setCur(null); setMobOpen(false); await reload(); } };
  const toggleTr = () => { setTr((v) => { try { localStorage.setItem(TR_KEY, v ? "0" : "1"); } catch {} return !v; }); };
  const waHref = dlg?.peer.phone ? `https://wa.me/${normPh(dlg.peer.phone)}` : null;

  return (
    <>
      <h1 className="text-[24px] font-extrabold tracking-[-0.02em] text-ink">{t.chat.title}</h1>
      <p className="mb-[18px] mt-[5px] max-w-[640px] text-[14px] text-text-2 [text-wrap:pretty]">{t.chat.sub}</p>
      <div className={`opl-chat-shell flex h-[calc(100vh-250px)] min-h-[460px] overflow-hidden rounded-[16px] border border-line bg-surface ${mobOpen ? "open" : ""}`}>
        <div className="opl-chat-list w-[300px] flex-none overflow-y-auto border-r border-line-2">
          <div className="sticky top-0 z-5 flex gap-2 border-b border-bg-4 bg-surface px-[10px] pb-2 pt-[10px]">
            <div className="relative flex-1">
              <IconSearch size={14} className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted-2" />
              <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t.chat.search} className="w-full rounded-[10px] border border-line bg-bg py-[9px] pl-8 pr-[11px] text-[13px] outline-none" />
            </div>
            <button type="button" onClick={openPicker} title={L("Новый чат", "New chat", "Yeni sohbet")} className="flex h-[38px] w-[38px] flex-none cursor-pointer items-center justify-center rounded-[10px] bg-blue-2 text-white hover:bg-blue-3"><IconMessagePlus size={17} /></button>
          </div>
          {loaded && list.length === 0 && <div className="px-[14px] py-6 text-center text-[12.5px] text-muted">{t.chat.notFound}</div>}
          {me.isAdmin && list.some((c) => c.supportOf) && <div className="bg-bg-5 px-[14px] py-[6px] text-[10.5px] font-extrabold uppercase tracking-[.06em] text-muted">{L("Поддержка · входящие", "Support · inbox", "Destek · gelen")}</div>}
          {[...list.filter((c) => c.supportOf), ...list.filter((c) => !c.supportOf)].map((c, i, arr) => {
            const firstPersonal = !c.supportOf && (i === 0 ? false : !!arr[i - 1].supportOf);
            const isSup = c.kind === "support" && !c.supportOf;
            return (
              <div key={c.id}>
              {firstPersonal && me.isAdmin && <div className="bg-bg-5 px-[14px] py-[6px] text-[10.5px] font-extrabold uppercase tracking-[.06em] text-muted">{L("Личные диалоги", "Direct messages", "Kişisel sohbetler")}</div>}
              <div onClick={() => { setCur(c.id); setMobOpen(true); }} className={`flex cursor-pointer items-center gap-[10px] border-b border-bg-3 px-[14px] py-3 hover:brightness-95 ${c.id === cur ? "bg-blue-tint" : "bg-surface"}`}>
                <div className="relative flex-none">
                  {isSup ? <div className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white"><IconHeadset size={19} /></div> : <Avatar name={c.peer.name} size={40} color={c.peer.color} />}
                  {c.peer.online && !isSup && <span className="absolute bottom-0 right-0 h-[11px] w-[11px] rounded-full border-2 border-surface bg-green-3" />}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13.5px] font-bold text-ink">{peerName(c)}</div>
                  {c.supportOf ? <div className="truncate text-[11px] font-semibold text-warn-2">{L("обращение в поддержку", "support request", "destek talebi")}{orgOf(c) ? ` · ${orgOf(c)}` : ""}</div> : orgOf(c) ? <div className="truncate text-[11px] font-semibold text-text-2">{orgOf(c)}</div> : null}
                  <div className="truncate text-[12px] text-muted">
                    {c.last?.senderId === me.id && <span className="mr-1 inline-flex align-[-2px]"><IconChecks size={13} style={{ color: c.last.readAt ? "#4d7cfe" : "#aab1bd" }} /></span>}
                    {c.last ? txt(c.last) : (isSup ? L("Напишите нам — поможем", "Write to us — we will help", "Bize yazın — yardımcı olalım") : "")}
                  </div>
                </div>
                <div className="flex flex-none flex-col items-end gap-1">
                  <span className="text-[10.5px] text-muted-2">{c.last ? time(c.last.createdAt) : ""}</span>
                  {c.unread > 0 && <span className="flex h-[18px] min-w-[18px] items-center justify-center rounded-[9px] bg-blue-2 px-[5px] text-[10px] font-bold text-white">{c.unread}</span>}
                </div>
              </div>
              </div>
            );
          })}
        </div>

        <div className="opl-chat-win flex min-w-0 flex-1 flex-col">
          {dlg ? (
            <>
              <div data-chat-hdr="1" className="box-border flex min-h-[56px] items-center gap-[11px] border-b border-line-2 px-4 py-[9px]">
                <span onClick={() => setMobOpen(false)} className="opl-chat-back hidden h-9 w-9 flex-none cursor-pointer items-center justify-center rounded-[10px] border border-line text-[18px] text-ink hover:bg-line-2"><IconArrowLeft size={18} /></span>
                {dlg.kind === "support" && !dlg.supportOf ? <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-full bg-ink text-white"><IconHeadset size={18} /></div> : <Avatar name={dlg.peer.name} size={38} color={dlg.peer.color} />}
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[14.5px] font-bold text-ink">{peerName(dlg)}{dlg.supportOf && <span className="ml-2 text-[12px] font-semibold text-muted">· {L("диалог поддержки", "support thread", "destek görüşmesi")}</span>}</div>
                  <div className="text-[11.5px]" style={{ color: dlg.peer.online || (dlg.kind === "support" && !dlg.supportOf) ? "#0f9d6b" : "#aab1bd" }}>{dlg.kind === "support" && !dlg.supportOf ? L("Отвечаем в рабочее время", "We reply during working hours", "Çalışma saatlerinde yanıtlıyoruz") : `${dlg.peer.online ? t.chat.online : t.chat.ls}${orgOf(dlg) ? ` · ${orgOf(dlg)}` : ""}`}</div>
                </div>
                {waHref && <a href={waHref} target="_blank" rel="noopener" title="WhatsApp" className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[10px] border border-line text-[16px] text-green-3 hover:border-green-3"><IconBrandWhatsapp size={16} /></a>}
                <div onClick={toggleTr} title={tr ? t.chat.trOn : t.chat.trOff} className={`flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[10px] border hover:brightness-95 ${tr ? "border-blue bg-blue-tint text-blue" : "border-line text-muted"}`}><IconLanguage size={16} /></div>
                {!(dlg.kind === "support" && !dlg.supportOf) && <button type="button" onClick={() => void removeDlg()} title={dlg.supportOf ? L("Закрыть обращение", "Close request", "Talebi kapat") : L("Удалить диалог", "Remove chat", "Sohbeti sil")} className="flex h-[34px] w-[34px] cursor-pointer items-center justify-center rounded-[10px] border border-line text-muted hover:border-red hover:text-red"><IconTrash size={16} /></button>}
              </div>
              <div ref={msgsRef} data-chat-msgs="1" className="flex flex-1 flex-col gap-[10px] overflow-y-auto overflow-x-hidden bg-bg-3 p-[18px] [overscroll-behavior:contain]">
                <div className="mt-auto flex-none" />
                {messages.length === 0 && <div className="py-6 text-center text-[12.5px] text-muted">{dlg.kind === "support" && !dlg.supportOf ? L("Здравствуйте! Это поддержка OnePlan. Пишите по любым вопросам — поможем.", "Hello! This is OnePlan support. Write to us about anything — we will help.", "Merhaba! OnePlan desteği. Her konuda yazın — yardımcı olalım.") : L("Сообщений пока нет", "No messages yet", "Henüz mesaj yok")}</div>}
                {messages.map((m) => {
                  const mine = m.senderId === me.id;
                  const src = txt(m);
                  const foreign = m.lang !== lang, e = tr && foreign ? cache[trKey(lang as Lang, src)] : undefined;
                  const translated = e && !e.fallback && e.text.trim() ? e.text : null;
                  const isOrig = !!orig[m.id];
                  const text = translated && !isOrig ? translated : src;
                  const by = !mine && dlg.kind === "support" && !dlg.supportOf ? `${names[m.senderId] ?? ""} · OnePlan Support` : !mine && dlg.supportOf ? names[m.senderId] : null;
                  return (
                    <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[72%] rounded-[14px] px-[13px] py-[10px] ${mine ? "rounded-br-[4px] bg-blue-2 text-white" : "rounded-bl-[4px] border border-line bg-surface text-ink"}`}>
                        {by && <div className="mb-[3px] text-[10.5px] font-bold text-blue-2">{by}</div>}
                        <div className="whitespace-pre-wrap break-words text-[13.5px] leading-[1.5]">{text}</div>
                        {tr && foreign && (
                          <div onClick={() => translated && setOrig((o) => ({ ...o, [m.id]: !o[m.id] }))} className={`mt-[5px] flex items-center gap-1 text-[10.5px] opacity-75 ${translated ? "cursor-pointer hover:brightness-95" : ""}`}>
                            <IconSparkles size={11} /> {!translated ? (e?.fallback ? `${m.lang}` : "…") : isOrig ? `${m.lang} · ${t.chat.orig} — ${t.chat.ai} ⇄` : `${m.lang} → ${lang} · ${t.chat.ai}`}
                          </div>
                        )}
                        <div className="mt-1 flex items-center justify-end gap-1 text-[10px]">
                          <span className="opacity-60">{time(m.createdAt)}</span>
                          {mine && <span title={m.readAt ? t.chat.readT : t.chat.dlvT} className="inline-flex"><IconChecks size={13} style={{ color: m.readAt ? "#8fe3ff" : "rgba(255,255,255,.65)" }} /></span>}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex gap-[9px] border-t border-line-2 px-4 py-[13px]">
                <input ref={inputRef} data-chat-input="1" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); void sendMsg(); } }} placeholder={t.chat.ph} className="min-w-0 flex-1 rounded-[12px] border border-line bg-bg px-[14px] py-[11px] text-[14px] outline-none focus:border-blue" />
                <button type="button" onClick={() => void sendMsg()} onMouseDown={(e) => e.preventDefault()} className="flex h-11 w-11 flex-none cursor-pointer items-center justify-center rounded-[12px] bg-blue-2 text-white hover:bg-blue-3"><IconSend size={18} /></button>
              </div>
            </>
          ) : (
            <div className="flex flex-1 flex-col items-center justify-center p-[30px] text-center text-muted">
              <span className="mb-[14px] flex h-16 w-16 items-center justify-center rounded-full bg-blue-tint text-blue"><IconMessagePlus size={30} /></span>
              <div className="mb-[5px] text-[17px] font-extrabold text-ink">{L("Выберите диалог", "Pick a conversation", "Bir sohbet seçin")}</div>
              <div className="text-[13.5px]">{L("или начните новый кнопкой «+»", "or start a new one with “+”", "veya “+” ile yeni bir tane başlatın")}</div>
            </div>
          )}
        </div>
      </div>

      {picker && (
        <Modal open onClose={() => setPicker(null)} width={460} z={410} padding="22px 24px">
          <div className="mb-3 flex items-center gap-[10px]"><span className="flex-1 text-[16px] font-extrabold text-ink">{L("Новый чат", "New chat", "Yeni sohbet")}</span><ModalClose onClick={() => setPicker(null)} /></div>
          <div className="relative mb-3"><IconSearch size={14} className="absolute left-[11px] top-1/2 -translate-y-1/2 text-muted-2" /><input autoFocus value={picker.q} onChange={(e) => setPicker({ ...picker, q: e.target.value })} placeholder={t.chat.search} className="w-full rounded-[10px] border border-line bg-bg py-[9px] pl-8 pr-[11px] text-[13px] outline-none focus:border-blue" /></div>
          <div className="max-h-[360px] overflow-y-auto rounded-[12px] border border-line">
            {picker.list === null && <div className="p-4 text-center text-[12.5px] text-muted">…</div>}
            {picker.list?.filter((p) => !picker.q.trim() || `${p.name} ${p.agency} ${p.email ?? ""}`.toLowerCase().includes(picker.q.trim().toLowerCase())).map((p) => (
              <div key={p.id} onClick={() => void startWith(p)} className="flex cursor-pointer items-center gap-[10px] border-b border-bg-3 px-3 py-[10px] last:border-b-0 hover:bg-bg-5">
                <Avatar name={p.name} size={36} color={p.color} />
                <div className="min-w-0 flex-1"><div className="truncate text-[13.5px] font-bold text-ink">{p.name}</div><div className="truncate text-[12px] text-muted">{orgLabel(p, O) || p.email}</div></div>
                {p.online && <span className="h-[9px] w-[9px] flex-none rounded-full bg-green-3" />}
              </div>
            ))}
            {picker.list && picker.list.length === 0 && <div className="p-4 text-center text-[12.5px] text-muted">{t.chat.notFound}</div>}
          </div>
          <button type="button" onClick={() => setPicker(null)} className="mt-3 inline-flex cursor-pointer items-center gap-1 text-[12.5px] font-semibold text-muted hover:text-ink"><IconX size={14} /> {t.common.cancel}</button>
        </Modal>
      )}
    </>
  );
}
