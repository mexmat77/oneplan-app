"use server";

// API-ключ риэлтора для выгрузки объявлений (0031): показать / создать / перевыпустить. Ключ хранится в profiles.api_key.
import { randomBytes } from "node:crypto";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export async function getApiKey(): Promise<string | null> {
  const me = await getCurrentUser(); if (!me) return null;
  const sb = await createClient();
  const { data } = await sb.from("profiles").select("api_key").eq("id", me.id).maybeSingle();
  return (data?.api_key as string | null) ?? null;
}
/** Новый ключ (старый перестаёт действовать сразу). */
export async function rotateApiKey(): Promise<string> {
  const me = await getCurrentUser(); if (!me) throw new Error("no-session");
  const key = `opl_live_${randomBytes(16).toString("hex")}`;
  const sb = await createClient();
  const { error } = await sb.from("profiles").update({ api_key: key }).eq("id", me.id);
  if (error) throw new Error(error.message);
  return key;
}
