"use client";

// Клиент реального чата (Supabase): диалоги 1-на-1 и поддержка. Используют обе части — база риэлторов и кабинет застройщика.
//   useConversations(me, supportId) — список диалогов (собеседник, последнее сообщение, непрочитанные), живые обновления;
//   useThread(convId, me)           — сообщения диалога, отправка, отметка прочитанного;
//   openDmWith / openSupport        — найти или создать диалог;
//   useChatUnread(me)               — число непрочитанных для бейджа в шапке.
// Обновления: realtime-подписка на вставки в `messages` + опрос каждые 20 с и при возврате на вкладку (RLS отдаёт только свои).
import { useCallback, useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { PROFILE_SEL, toPeer, type ChatMessage, type ChatPeer, type Conversation, type ProfileRow } from "./shared";
export { SUPPORT_EMAIL, toPeer, type ChatMessage, type ChatPeer, type Conversation } from "./shared";

/** Запуск загрузки из эффекта через микрозадачу (правило react-hooks/set-state-in-effect). */
const defer = (fn: () => unknown) => { queueMicrotask(() => { void fn(); }); };
const toMsg = (r: Record<string, unknown>): ChatMessage => ({ id: r.id as number, convId: r.conv_id as string, senderId: r.sender_id as string, lang: r.lang as string, text: (r.text as Record<string, string>) ?? {}, listingId: (r.listing_id as string | null) ?? null, readAt: (r.read_at as string | null) ?? null, createdAt: r.created_at as string });

/** Пара (a,b) всегда в одном порядке — чтобы не было двух диалогов между одними людьми. */
const pairOf = (x: string, y: string): [string, string] => (x < y ? [x, y] : [y, x]);

export async function openDmWith(me: string, peerId: string): Promise<string | null> {
  if (!peerId || peerId === me) return null;
  const sb = createClient();
  const [a, b] = pairOf(me, peerId);
  const { data } = await sb.from("conversations").select("id").eq("a_id", a).eq("b_id", b).maybeSingle();
  if (data) return data.id as string;
  const { data: ins, error } = await sb.from("conversations").insert({ a_id: a, b_id: b, kind: "dm" }).select("id").single();
  if (error) { console.warn("[chat] openDmWith", error.message); return null; }
  return ins.id as string;
}
/** Диалог пользователя с поддержкой: (user, support). Админ может открыть диалог поддержки для любого `userId`. */
export async function openSupport(userId: string, supportId: string): Promise<string | null> {
  if (!supportId || userId === supportId) return null;
  const sb = createClient();
  const { data } = await sb.from("conversations").select("id").eq("a_id", userId).eq("b_id", supportId).maybeSingle();
  if (data) return data.id as string;
  const { data: ins, error } = await sb.from("conversations").insert({ a_id: userId, b_id: supportId, kind: "support" }).select("id").single();
  if (error) { console.warn("[chat] openSupport", error.message); return null; }
  return ins.id as string;
}

/** Подписка на новые сообщения + опрос; `onChange` дёргается при любом событии. */
function useLive(onChange: () => void, deps: unknown[]) {
  useEffect(() => {
    const sb = createClient();
    let alive = true;
    const tick = () => { if (alive && document.visibilityState === "visible") onChange(); };
    const ch = sb.channel(`chat-${Math.random().toString(36).slice(2)}`).on("postgres_changes", { event: "*", schema: "public", table: "messages" }, tick).subscribe();
    const iv = setInterval(tick, 20_000);
    document.addEventListener("visibilitychange", tick);
    return () => { alive = false; clearInterval(iv); document.removeEventListener("visibilitychange", tick); sb.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

export function useConversations(me: string | null, supportId: string, isAdmin = false) {
  const [list, setList] = useState<Conversation[]>([]);
  const [loaded, setLoaded] = useState(false);
  const load = useCallback(async () => {
    if (!me) return;
    const sb = createClient();
    const { data: convs } = await sb.from("conversations").select("id, kind, a_id, b_id").order("created_at", { ascending: false });
    const rows = convs ?? [];
    if (!rows.length) { setList([]); setLoaded(true); return; }
    const ids = rows.map((c) => c.id as string);
    const peerIds = new Set<string>();
    rows.forEach((c) => { peerIds.add(c.a_id as string); peerIds.add(c.b_id as string); });
    const [{ data: profs }, { data: msgs }, { data: hiddenRows }] = await Promise.all([
      sb.from("profiles").select(PROFILE_SEL).in("id", Array.from(peerIds)),
      sb.from("messages").select("id, conv_id, sender_id, lang, text, listing_id, read_at, created_at").in("conv_id", ids).order("created_at", { ascending: false }).limit(ids.length * 60),
      sb.from("conversation_hidden").select("conv_id, hidden_at").eq("user_id", me),
    ]);
    // «удалено у себя»: сообщения до hidden_at для меня не существуют — диалог выглядит пустым (как новый), пока не напишут снова
    const hiddenAt = new Map((hiddenRows ?? []).map((h) => [h.conv_id as string, +new Date(h.hidden_at as string)]));
    const after = (convId: string, created: string) => { const h = hiddenAt.get(convId); return h === undefined || +new Date(created) > h; };
    const pmap = new Map((profs ?? []).map((p) => [p.id as string, toPeer(p as unknown as ProfileRow, supportId)]));
    const fallback = (id: string): ChatPeer => ({ id, name: "—", email: null, phone: null, color: "#8a93a2", avatar: null, agency: "", org: id === supportId ? "staff" : "free", online: false, lastSeen: null, support: id === supportId });
    const out: Conversation[] = rows.map((c): Conversation => {
      const a = c.a_id as string, b = c.b_id as string;
      const isSupport = c.kind === "support" || a === supportId || b === supportId;
      const mine = a === me || b === me;
      const other = isSupport && !mine ? a : a === me ? b : a; // админ в чужом диалоге поддержки видит пользователя
      const peer = pmap.get(other) ?? fallback(other);
      const all = (msgs ?? []).filter((m) => m.conv_id === c.id && after(c.id as string, m.created_at as string)).map((m) => toMsg(m as Record<string, unknown>));
      const unread = all.filter((m) => m.senderId !== me && !m.readAt && (mine || isAdmin)).length;
      return { id: c.id as string, kind: isSupport ? "support" : "dm", peer, last: all[0] ?? null, unread, supportOf: isSupport && !mine ? peer : undefined };
    });
    setList(out); setLoaded(true);
  }, [me, supportId, isAdmin]);
  useEffect(() => { defer(load); }, [load]);
  useLive(load, [load]);
  return { conversations: list, loaded, reload: load };
}

export function useThread(convId: string | null, me: string | null) {
  const [msgs, setMsgs] = useState<ChatMessage[]>([]);
  const [names, setNames] = useState<Record<string, string>>({});
  const load = useCallback(async () => {
    if (!convId) { setMsgs([]); return; }
    const sb = createClient();
    const [{ data }, { data: hid }] = await Promise.all([
      sb.from("messages").select("id, conv_id, sender_id, lang, text, listing_id, read_at, created_at").eq("conv_id", convId).order("created_at", { ascending: true }).limit(500),
      me ? sb.from("conversation_hidden").select("hidden_at").eq("conv_id", convId).eq("user_id", me).maybeSingle() : Promise.resolve({ data: null }),
    ]);
    const since = hid?.hidden_at ? +new Date(hid.hidden_at as string) : 0; // «удалено у себя» — старые сообщения не показываем
    const list = (data ?? []).filter((m) => +new Date(m.created_at as string) > since).map((m) => toMsg(m as Record<string, unknown>));
    setMsgs((prev) => (prev.length && prev[0]?.convId !== convId ? list : list)); // всегда свежий список текущего диалога
    const senders = Array.from(new Set(list.map((m) => m.senderId)));
    if (senders.length) { const { data: ps } = await sb.from("profiles").select("id, name, email").in("id", senders); setNames(Object.fromEntries((ps ?? []).map((p) => [p.id as string, (p.name as string) || (p.email as string) || "—"]))); }
  }, [convId, me]);
  useEffect(() => { defer(load); }, [load]);
  useLive(load, [load]);
  const send = useCallback(async (text: string, lang: string, listingId?: string | null) => {
    const v = text.trim();
    if (!convId || !me || !v) return false;
    const sb = createClient();
    const { error } = await sb.from("messages").insert({ conv_id: convId, sender_id: me, lang, text: { [lang]: v }, listing_id: listingId ?? null });
    if (error) { console.warn("[chat] send", error.message); return false; }
    await load(); return true;
  }, [convId, me, load]);
  const markRead = useCallback(async () => {
    if (!convId || !me) return;
    const sb = createClient();
    await sb.from("messages").update({ read_at: new Date().toISOString() }).eq("conv_id", convId).neq("sender_id", me).is("read_at", null);
  }, [convId, me]);
  // сообщения чужого диалога не показываем, пока грузится новый
  const visible = msgs.filter((m) => m.convId === convId);
  return { messages: visible, names, send, markRead, reload: load };
}

/** Непрочитанные входящие по всем моим диалогам (для бейджа чата в шапке). */
export function useChatUnread(me: string | null, supportId: string, isAdmin = false): number {
  const [n, setN] = useState(0);
  const load = useCallback(async () => {
    if (!me) { setN(0); return; }
    const sb = createClient();
    const { data: convs } = await sb.from("conversations").select("id, a_id, b_id");
    const ids = (convs ?? []).filter((c) => isAdmin || c.a_id === me || c.b_id === me).map((c) => c.id as string);
    if (!ids.length) { setN(0); return; }
    const { count } = await sb.from("messages").select("id", { count: "exact", head: true }).in("conv_id", ids).neq("sender_id", me).is("read_at", null);
    setN(count ?? 0);
  }, [me, isAdmin]);
  useEffect(() => { defer(load); }, [load]);
  useLive(load, [load]);
  void supportId;
  return n;
}

/** «Удалить у себя»: hidden_at — граница, сообщения до неё для меня исчезают; диалог снова появится, когда придёт новое сообщение. */
export async function hideConversation(convId: string, me: string): Promise<boolean> {
  const sb = createClient();
  const { error } = await sb.from("conversation_hidden").upsert({ conv_id: convId, user_id: me, hidden_at: new Date().toISOString() });
  if (error) { console.warn("[chat] hide", error.message); return false; }
  // удалённые сообщения не должны висеть в счётчике непрочитанных
  await sb.from("messages").update({ read_at: new Date().toISOString() }).eq("conv_id", convId).neq("sender_id", me).is("read_at", null);
  return true;
}
/** Снять скрытие (пользователь сам открыл диалог заново через «Новый чат»). */

/** Участники для «нового чата»: активные профили, кроме меня и сервисных. Админов платформы обычным пользователям не показываем —
 *  к администрации один канал (Support); админ сам может начать диалог с любым участником. */
export async function listChatPeers(me: string, supportId: string, opts?: { isAdmin?: boolean; filter?: (p: ProfileRow & { role?: string; developer_id?: string | null }) => boolean }): Promise<ChatPeer[]> {
  const sb = createClient();
  const { data } = await sb.from("profiles").select(`${PROFILE_SEL}, developer_id, status`).eq("status", "active").order("name");
  return (data ?? [])
    .filter((p) => p.id !== me && p.id !== supportId && !p.platform_staff && (opts?.isAdmin || p.role !== "admin") && (!opts?.filter || opts.filter(p as unknown as ProfileRow & { role?: string; developer_id?: string | null })))
    .map((p) => toPeer(p as unknown as ProfileRow, supportId));
}

