"use server";

// Заявка с лендинга (форма «Получить доступ») → таблица `leads` в Supabase (миграция 0005_leads.sql).
// В прототипе бэкенда нет (спека §A.7). Пишет сервер сервисным ключом; данные проверяются заново на сервере.
import { createAdminClient, hasServiceRole } from "@/lib/supabase/admin";
import { notifyAdmins } from "@/lib/notify";

export type LeadInput = { role: "r" | "d"; name: string; company: string; phone: string; email: string; message: string; lang: string };
export type LeadResult = { ok: true; stored: boolean } | { ok: false; reason: "invalid" | "error" };

export async function submitLead(input: LeadInput): Promise<LeadResult> {
  const name = String(input.name || "").trim().slice(0, 120);
  const phone = String(input.phone || "").replace(/\D/g, "");
  const email = String(input.email || "").trim().slice(0, 160);
  if (!name || !/^5\d{9}$/.test(phone) || !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email) || (input.role !== "r" && input.role !== "d")) return { ok: false, reason: "invalid" };
  // без ключей Supabase (локальный UI-режим) форма ведёт себя как в прототипе: показывает «спасибо», ничего не сохраняя
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !hasServiceRole()) return { ok: true, stored: false };
  try {
    const { error } = await createAdminClient().from("leads").insert({
      role: input.role, name, company: String(input.company || "").trim().slice(0, 160), phone: `+90${phone}`, email,
      message: String(input.message || "").trim().slice(0, 2000), lang: ["RU", "EN", "TR"].includes(input.lang) ? input.lang : "RU",
    });
    if (error) { console.error("[lead] insert failed:", error.message); return { ok: false, reason: "error" }; }
    void notifyAdmins("lead_new", { name, email, role: input.role === "d" ? "developer" : "realtor" });
    return { ok: true, stored: true };
  } catch (e) {
    console.error("[lead]", e);
    return { ok: false, reason: "error" };
  }
}

// Заявка на доступ со страницы входа (форма «Подать заявку») → access_requests + уведомление админам.
export type AccessRequestInput = { name: string; phone: string; email: string; agency: string; company: string | null; role: "realtor" | "developer"; lang: string };
export async function submitAccessRequest(input: AccessRequestInput): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !hasServiceRole()) return { ok: true };
  const row = { name: String(input.name || "").trim().slice(0, 120), phone: String(input.phone || "").trim().slice(0, 40), email: String(input.email || "").trim().slice(0, 160), agency: String(input.agency || "").trim().slice(0, 160), company: input.company ? String(input.company).trim().slice(0, 160) : null, role: input.role === "developer" ? "developer" : "realtor", lang: ["RU", "EN", "TR"].includes(input.lang) ? input.lang : "RU", kind: "access" };
  if (!row.name || !row.email) return { ok: false, error: "invalid" };
  const { error } = await createAdminClient().from("access_requests").insert(row);
  if (error) return { ok: false, error: error.message };
  void notifyAdmins("req_new", { name: row.name, email: row.email, role: row.role });
  return { ok: true };
}

// Обращение заблокированного пользователя («Написать администратору») → access_requests kind=unblock + уведомление админам.
export async function submitUnblockRequest(input: { name: string; email: string; message: string; lang: string }): Promise<{ ok: boolean; error?: string }> {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !hasServiceRole()) return { ok: true };
  const email = String(input.email || "").trim().slice(0, 160), message = String(input.message || "").trim().slice(0, 2000);
  if (!email || !message) return { ok: false, error: "invalid" };
  const name = String(input.name || "").trim().slice(0, 120) || email;
  const { error } = await createAdminClient().from("access_requests").insert({ name, phone: "", email, agency: "", role: "realtor", lang: ["RU", "EN", "TR"].includes(input.lang) ? input.lang : "RU", kind: "unblock", message });
  if (error) return { ok: false, error: error.message };
  void notifyAdmins("unblock_req", { name, email });
  return { ok: true };
}
