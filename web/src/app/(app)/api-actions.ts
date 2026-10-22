"use server";

// API-ключи для выгрузки объявлений: риэлтора (profiles.api_key, 0031) и агентства (agencies.api_key, 0032 — только
// администратор агентства). Показать / создать / перевыпустить.
import { randomBytes } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { apiKeyHash } from "@/lib/apiListings";

// С 23.10.2026 (миграция 0038) ключ хранится ХЭШЕМ и показывается один раз при выпуске; владелец видит только подсказку
// «…ab12» (`api_key_hint`). Запись — сервисным ключом: триггер profiles_guard не даёт менять api_key из сессии.
export type ApiKeyInfo = { hint: string | null };

export async function getApiKey(): Promise<ApiKeyInfo | null> {
  const me = await getCurrentUser(); if (!me) return null;
  const sb = await createClient();
  const { data } = await sb.from("profiles").select("api_key_hint").eq("id", me.id).maybeSingle();
  return { hint: (data?.api_key_hint as string | null) ?? null };
}
export async function rotateApiKey(): Promise<string> {
  const me = await getCurrentUser(); if (!me) throw new Error("no-session");
  const key = `opl_live_${randomBytes(16).toString("hex")}`;
  const { error } = await createAdminClient().from("profiles").update({ api_key: apiKeyHash(key), api_key_hint: key.slice(-4) }).eq("id", me.id);
  if (error) throw new Error(error.message);
  return key;
}
/** Агентство текущего пользователя и его право на ключ агентства (администратор агентства или админ платформы). */
async function agencyCtx() {
  const me = await getCurrentUser(); if (!me) return null;
  const admin = createAdminClient();
  const { data: p } = await admin.from("profiles").select("agency_id").eq("id", me.id).maybeSingle();
  const agencyId = (p?.agency_id as string | null) ?? null;
  if (!agencyId) return null;
  const { data: m } = await admin.from("org_members").select("role").eq("org_kind", "agency").eq("org_id", agencyId).eq("profile_id", me.id).maybeSingle();
  const canManage = me.role === "admin" || m?.role === "owner";
  const { data: ag } = await admin.from("agencies").select("name, api_key_hint").eq("id", agencyId).maybeSingle();
  return { admin, agencyId, canManage, name: String(ag?.name ?? ""), hint: (ag?.api_key_hint as string | null) ?? null };
}
export async function getAgencyApiKey(): Promise<{ name: string; hint: string | null; canManage: boolean } | null> {
  const c = await agencyCtx(); if (!c) return null;
  return { name: c.name, hint: c.canManage ? c.hint : null, canManage: c.canManage };
}
export async function rotateAgencyApiKey(): Promise<string> {
  const c = await agencyCtx(); if (!c || !c.canManage) throw new Error("forbidden");
  const key = `opl_agency_${randomBytes(16).toString("hex")}`;
  const { error } = await c.admin.from("agencies").update({ api_key: apiKeyHash(key), api_key_hint: key.slice(-4) }).eq("id", c.agencyId);
  if (error) throw new Error(error.message);
  return key;
}
