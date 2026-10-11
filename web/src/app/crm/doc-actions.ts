"use server";

// Документы CRM: реквизиты компании, шаблоны (встроенные + свои DOCX), генерация DOCX/PDF из сделки, свои файлы, ссылки.
// Файлы — закрытый bucket "crm" (путь <ws_kind>/<ws_id>/…, RLS хранилища по ws), параметры документа — зашифрованы.
import { assertWrite, audit, crmCtx, dec, enc, type Ctx } from "@/lib/crm/server";
import { BUILTIN, BUILTIN_MAP, FIELD_MAP } from "@/lib/crm/docFields";
import { builtinTemplate, docxToPdf, listPlaceholders, pdfAvailable, prepareData, renderDocx } from "@/lib/crm/docs";
import { GEO } from "@/lib/seed";
import type { Lang } from "@/i18n";

type Row = Record<string, unknown>;
const s = (v: unknown) => (v == null ? null : String(v));
const today = () => new Date().toISOString().slice(0, 10);

export type Company = Record<string, string>; // name, taxNo, taxOffice, mersis, registryNo, address, representative, phone, email, iban, bank, licenseNo
export type TemplateInfo = { id: string; builtin: boolean; key: string | null; name: Record<Lang, string> | string; kind: string; lang: string; fields: string[]; for: string[] };
export type DocInfo = { id: string; clientId: string | null; dealId: string | null; title: string; kind: string; status: "draft" | "sent" | "signed" | "void"; hasDocx: boolean; hasPdf: boolean; hasFile: boolean; fileName: string | null; size: number | null; templateKey: string | null; templateId: string | null; validUntil: string | null; signedAt: string | null; createdAt: string; createdBy: string | null };

// ---------- реквизиты ----------
export async function getCompany(): Promise<Company> {
  const c = await crmCtx();
  const { data } = await c.sb.from("crm_settings").select("company_enc").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).maybeSingle();
  if (!data?.company_enc) return {};
  try { return JSON.parse(dec(c, "crm_settings", "company", c.ws.id, data.company_enc as string)) as Company; } catch { return {}; }
}
export async function saveCompany(company: Company): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const clean: Company = {}; for (const [k, v] of Object.entries(company)) if (v?.trim()) clean[k] = v.trim();
  const { error } = await c.sb.from("crm_settings").upsert({ ws_kind: c.ws.kind, ws_id: c.ws.id, company_enc: enc(c, "crm_settings", "company", c.ws.id, JSON.stringify(clean)), updated_at: new Date().toISOString() }, { onConflict: "ws_kind,ws_id" });
  if (error) throw new Error(error.message);
}

// ---------- шаблоны ----------
export async function listTemplates(): Promise<TemplateInfo[]> {
  const c = await crmCtx();
  const { data } = await c.sb.from("crm_doc_templates").select("*").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).eq("active", true).order("created_at");
  const own: TemplateInfo[] = ((data ?? []) as Row[]).map((r) => ({ id: r.id as string, builtin: false, key: null, name: r.name as string, kind: r.kind as string, lang: r.lang as string, fields: ((r.fields as { key: string }[]) ?? []).map((f) => f.key), for: ["any"] }));
  return [...BUILTIN.map((t) => ({ id: "builtin:" + t.key, builtin: true, key: t.key, name: t.name, kind: t.kind, lang: t.lang, fields: t.fields, for: t.for as string[] })), ...own];
}
/** Свой шаблон: DOCX с {{group.key}}; поля определяются по плейсхолдерам (неизвестные ключи — тоже поля, тип text). */
export async function uploadTemplate(fd: FormData): Promise<TemplateInfo> {
  const c = await crmCtx(); assertWrite(c);
  const file = fd.get("file") as File | null;
  const name = String(fd.get("name") ?? "").trim() || (file?.name ?? "template").replace(/\.docx$/i, "");
  const kind = String(fd.get("kind") ?? "other");
  if (!file || !/\.docx$/i.test(file.name)) throw new Error("docx");
  const buf = Buffer.from(await file.arrayBuffer());
  const keys = listPlaceholders(buf);
  const id = crypto.randomUUID();
  const pathT = `${c.ws.kind}/${c.ws.id}/templates/${id}.docx`;
  const up = await c.sb.storage.from("crm").upload(pathT, buf, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document", upsert: true });
  if (up.error) throw new Error(up.error.message);
  const fields = keys.map((k) => ({ key: k, type: FIELD_MAP[k]?.type ?? "text", group: FIELD_MAP[k]?.group ?? k.split(".")[0] }));
  const { error } = await c.sb.from("crm_doc_templates").insert({ id, ws_kind: c.ws.kind, ws_id: c.ws.id, name, lang: "—", kind, path: pathT, fields, created_by: c.me.id });
  if (error) throw new Error(error.message);
  return { id, builtin: false, key: null, name, kind, lang: "—", fields: keys, for: ["any"] };
}
export async function deleteTemplate(id: string): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const { data } = await c.sb.from("crm_doc_templates").select("path").eq("id", id).maybeSingle();
  if (data?.path) await c.sb.storage.from("crm").remove([data.path as string]);
  await c.sb.from("crm_doc_templates").delete().eq("id", id);
}

// ---------- документы ----------
function rowDoc(r: Row): DocInfo {
  return { id: r.id as string, clientId: s(r.client_id), dealId: s(r.deal_id), title: r.title as string, kind: r.kind as string, status: r.status as DocInfo["status"], hasDocx: !!r.path_docx, hasPdf: !!r.path_pdf, hasFile: !!r.path_file, fileName: r.path_file ? String(r.path_file).split("/").pop() ?? null : null, size: (r.size as number) ?? null, templateKey: s(r.template_key), templateId: s(r.template_id), validUntil: s(r.valid_until), signedAt: s(r.signed_at), createdAt: r.created_at as string, createdBy: s(r.created_by) };
}
export async function listDocs(f: { dealId?: string; clientId?: string }): Promise<DocInfo[]> {
  const c = await crmCtx();
  let q = c.sb.from("crm_docs").select("*").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).order("created_at", { ascending: false });
  if (f.dealId) q = q.eq("deal_id", f.dealId); else if (f.clientId) q = q.eq("client_id", f.clientId);
  const { data } = await q;
  return ((data ?? []) as Row[]).map(rowDoc);
}

/** Значения по умолчанию для формы документа: реквизиты, клиент → buyer, объект сделки → property, сделка, ранее введённое. */
export async function docDefaults(dealId: string): Promise<{ values: Record<string, string>; pdf: boolean }> {
  const c = await crmCtx();
  const v: Record<string, string> = { "deal.date": today(), "deal.copies": "3", "deal.court": "Antalya", "deal.commissionWhen": "Tapu günü" };
  const company = await getCompany();
  for (const [k, val] of Object.entries(company)) v["agency." + k] = val;
  const { data: d } = await c.sb.from("crm_deals").select("*, crm_clients(*)").eq("id", dealId).maybeSingle();
  if (d) {
    const cl = (Array.isArray(d.crm_clients) ? d.crm_clients[0] : d.crm_clients) as Row | null;
    if (cl) {
      v["buyer.name"] = cl.name as string;
      const { data: cts } = await c.sb.from("crm_contacts").select("*").eq("client_id", cl.id as string).order("is_main", { ascending: false });
      for (const x of (cts ?? []) as Row[]) {
        const val = dec(c, "crm_contacts", "value", x.id as string, x.value_enc as string);
        if ((x.kind === "phone" || x.kind === "whatsapp") && !v["buyer.phone"]) v["buyer.phone"] = val;
        if (x.kind === "email" && !v["buyer.email"]) v["buyer.email"] = val;
      }
    }
    if (d.amount) v["deal.price"] = String(d.amount);
    if (d.deal === "rent" || d.deal === "daily") { if (d.amount) v["rent.monthly"] = String(d.amount); }
    // объект из базы объявлений
    if (d.listing_id && /^[0-9a-f-]{36}$/i.test(d.listing_id as string)) {
      const { data: l } = await c.sb.from("listings").select("il, ilce, semt, area, data").eq("id", d.listing_id as string).maybeSingle();
      if (l) {
        const il = GEO.find((g) => g.k === l.il), ilce = il?.ilces.find((x) => x.k === l.ilce), semt = ilce?.semts.find((x) => x.k === l.semt);
        if (il) v["property.il"] = il.n.toUpperCase(); if (ilce) v["property.ilce"] = ilce.n.toUpperCase(); if (semt) v["property.mahalle"] = semt.n.toUpperCase();
        const ld = (l.data as Row) ?? {};
        if (ld.adaParsel && String(ld.adaParsel).includes("/")) { const [a, p] = String(ld.adaParsel).split("/"); v["property.ada"] = a.trim(); v["property.parsel"] = p.trim(); }
        if (l.area) v["property.netArea"] = String(l.area);
        if (ld.type === "land" && l.area) v["property.area"] = String(l.area);
        const loc = (ld.loc as Record<string, string>)?.TR ?? (ld.loc as Record<string, string>)?.RU;
        if (loc) v["property.address"] = loc;
      }
    }
    // ранее введённые значения этой сделки (продавец, тапу…) — поверх
    if (d.extra_enc) { try { Object.assign(v, JSON.parse(dec(c, "crm_deals", "extra", d.id as string, d.extra_enc as string))); } catch { /* ignore */ } }
  }
  return { values: v, pdf: await pdfAvailable() };
}

export async function generateDoc(inp: { dealId: string; templateId: string; title: string; values: Record<string, string> }): Promise<DocInfo> {
  const c = await crmCtx(); assertWrite(c);
  const { data: d } = await c.sb.from("crm_deals").select("id, client_id").eq("id", inp.dealId).maybeSingle();
  if (!d) throw new Error("deal");
  let template: Buffer, templateKey: string | null = null, templateId: string | null = null, kind = "other";
  if (inp.templateId.startsWith("builtin:")) {
    templateKey = inp.templateId.slice(8); const t = BUILTIN_MAP[templateKey]; if (!t) throw new Error("template");
    template = await builtinTemplate(templateKey); kind = t.kind;
  } else {
    const { data: t } = await c.sb.from("crm_doc_templates").select("*").eq("id", inp.templateId).maybeSingle();
    if (!t?.path) throw new Error("template");
    const dl = await c.sb.storage.from("crm").download(t.path as string);
    if (dl.error || !dl.data) throw new Error("template-file");
    template = Buffer.from(await dl.data.arrayBuffer()); templateId = t.id as string; kind = t.kind as string;
  }
  const types: Record<string, string | undefined> = {}; for (const k of Object.keys(inp.values)) types[k] = FIELD_MAP[k]?.type;
  const docx = renderDocx(template, prepareData(inp.values, types));
  const id = crypto.randomUUID();
  const base = `${c.ws.kind}/${c.ws.id}/deals/${inp.dealId}/${id}`;
  const safe = inp.title.replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 60) || "document";
  const up = await c.sb.storage.from("crm").upload(`${base}/${safe}.docx`, docx, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  if (up.error) throw new Error(up.error.message);
  let pathPdf: string | null = null;
  const pdf = await docxToPdf(docx).catch(() => null);
  if (pdf) { const u2 = await c.sb.storage.from("crm").upload(`${base}/${safe}.pdf`, pdf, { contentType: "application/pdf" }); if (!u2.error) pathPdf = `${base}/${safe}.pdf`; }
  const { data: row, error } = await c.sb.from("crm_docs").insert({ id, ws_kind: c.ws.kind, ws_id: c.ws.id, client_id: d.client_id, deal_id: inp.dealId, template_id: templateId, template_key: templateKey, title: inp.title.trim(), kind, path_docx: `${base}/${safe}.docx`, path_pdf: pathPdf, size: docx.length, params_enc: enc(c, "crm_docs", "params", id, JSON.stringify(inp.values)), created_by: c.me.id }).select("*").single();
  if (error) throw new Error(error.message);
  // запомнить в сделке продавца/объект/условия для следующих документов (без реквизитов компании и данных клиента)
  const keep: Record<string, string> = {}; for (const [k, val] of Object.entries(inp.values)) if (!k.startsWith("agency.") && !k.startsWith("buyer.") && val) keep[k] = val;
  await c.sb.from("crm_deals").update({ extra_enc: enc(c, "crm_deals", "extra", inp.dealId, JSON.stringify(keep)) }).eq("id", inp.dealId);
  await c.sb.from("crm_events").insert({ ws_kind: c.ws.kind, ws_id: c.ws.id, client_id: d.client_id, deal_id: inp.dealId, actor_id: c.me.id, kind: "doc", payload: { title: inp.title.trim(), docId: id } });
  return rowDoc(row as Row);
}

/** Свой файл в сделку (паспорт, тапу, расписка…). */
export async function uploadDoc(fd: FormData): Promise<DocInfo> {
  const c = await crmCtx(); assertWrite(c);
  const file = fd.get("file") as File | null; const dealId = String(fd.get("dealId") ?? ""); const title = String(fd.get("title") ?? "").trim(); const kind = String(fd.get("kind") ?? "other");
  if (!file || !dealId) throw new Error("file");
  if (file.size > 25 * 1024 * 1024) throw new Error("size");
  const { data: d } = await c.sb.from("crm_deals").select("id, client_id").eq("id", dealId).maybeSingle();
  if (!d) throw new Error("deal");
  const id = crypto.randomUUID();
  const safe = file.name.replace(/[^\p{L}\p{N} _.-]/gu, "").slice(0, 80) || "file";
  const p = `${c.ws.kind}/${c.ws.id}/deals/${dealId}/${id}/${safe}`;
  const up = await c.sb.storage.from("crm").upload(p, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream" });
  if (up.error) throw new Error(up.error.message);
  const { data: row, error } = await c.sb.from("crm_docs").insert({ id, ws_kind: c.ws.kind, ws_id: c.ws.id, client_id: d.client_id, deal_id: dealId, title: title || safe, kind, path_file: p, mime: file.type, size: file.size, created_by: c.me.id }).select("*").single();
  if (error) throw new Error(error.message);
  return rowDoc(row as Row);
}

/** Временная ссылка на файл (10 мин); скачивание пишется в журнал. */
export async function docUrl(id: string, which: "docx" | "pdf" | "file"): Promise<string> {
  const c = await crmCtx();
  const { data: r } = await c.sb.from("crm_docs").select("path_docx, path_pdf, path_file, title").eq("id", id).maybeSingle();
  const p = which === "docx" ? r?.path_docx : which === "pdf" ? r?.path_pdf : r?.path_file;
  if (!p) throw new Error("not-found");
  const { data, error } = await c.sb.storage.from("crm").createSignedUrl(p as string, 600, { download: true });
  if (error || !data) throw new Error(error?.message ?? "url");
  await audit(c.sb, c.ws, c.me.id, "download_doc", id, { which });
  return data.signedUrl;
}
export async function setDocStatus(id: string, status: DocInfo["status"], validUntil?: string | null): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const { error } = await c.sb.from("crm_docs").update({ status, signed_at: status === "signed" ? new Date().toISOString() : null, valid_until: validUntil ?? null }).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteDoc(id: string): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const { data: r } = await c.sb.from("crm_docs").select("path_docx, path_pdf, path_file").eq("id", id).maybeSingle();
  const paths = [r?.path_docx, r?.path_pdf, r?.path_file].filter(Boolean) as string[];
  if (paths.length) await c.sb.storage.from("crm").remove(paths);
  await c.sb.from("crm_docs").delete().eq("id", id);
  await audit(c.sb, c.ws, c.me.id, "delete_doc", id, {});
}

/** Открыть сохранённые значения документа (для «создать похожий»). */
export async function docParams(id: string): Promise<Record<string, string>> {
  const c = await crmCtx();
  const { data: r } = await c.sb.from("crm_docs").select("params_enc").eq("id", id).maybeSingle();
  if (!r?.params_enc) return {};
  try { return JSON.parse(dec(c, "crm_docs", "params", id, r.params_enc as string)); } catch { return {}; }
}
// Ctx используется в типах выше
export type { Ctx as _CrmCtx };
