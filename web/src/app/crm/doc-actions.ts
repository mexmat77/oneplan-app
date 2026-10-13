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
/** Набор реквизитов (12.10.2026: у агентства их может быть несколько — юрлица, филиалы); один — основной. */
export type CompanyProfile = { id: string; label: string; isDefault: boolean; fields: Company };
export type TemplateInfo = { id: string; builtin: boolean; key: string | null; name: Record<Lang, string> | string; kind: string; lang: string; enabled: boolean; fields: string[]; for: string[] };
export type DocInfo = { id: string; clientId: string | null; dealId: string | null; title: string; kind: string; status: "draft" | "sent" | "signed" | "void"; hasDocx: boolean; hasPdf: boolean; hasFile: boolean; fileName: string | null; size: number | null; templateKey: string | null; templateId: string | null; validUntil: string | null; signedAt: string | null; createdAt: string; createdBy: string | null };

// ---------- реквизиты ----------
async function loadProfiles(c: Ctx): Promise<CompanyProfile[]> {
  const { data } = await c.sb.from("crm_settings").select("company_enc").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).maybeSingle();
  if (!data?.company_enc) return [];
  try {
    const j = JSON.parse(dec(c, "crm_settings", "company", c.ws.id, data.company_enc as string)) as { companies?: CompanyProfile[] } & Company;
    if (Array.isArray(j.companies)) return j.companies;
    // старый формат (один набор полей) → один основной профиль
    const fields: Company = {}; for (const [k, v] of Object.entries(j)) if (typeof v === "string" && v) fields[k] = v;
    return Object.keys(fields).length ? [{ id: "main", label: fields.name ?? "", isDefault: true, fields }] : [];
  } catch { return []; }
}
async function storeProfiles(c: Ctx, list: CompanyProfile[]): Promise<void> {
  const { error } = await c.sb.from("crm_settings").upsert({ ws_kind: c.ws.kind, ws_id: c.ws.id, company_enc: enc(c, "crm_settings", "company", c.ws.id, JSON.stringify({ companies: list })), updated_at: new Date().toISOString() }, { onConflict: "ws_kind,ws_id" });
  if (error) throw new Error(error.message);
}
export async function getCompanies(): Promise<CompanyProfile[]> { const c = await crmCtx(); return loadProfiles(c); }
/** Основной набор реквизитов (для подстановки в документы). */
export async function getCompany(): Promise<Company> {
  const c = await crmCtx(); const list = await loadProfiles(c);
  return (list.find((x) => x.isDefault) ?? list[0])?.fields ?? {};
}
export async function saveCompanyProfile(pr: { id?: string; label: string; isDefault: boolean; fields: Company }): Promise<CompanyProfile[]> {
  const c = await crmCtx(); assertWrite(c);
  const clean: Company = {}; for (const [k, v] of Object.entries(pr.fields)) if (v?.trim()) clean[k] = v.trim();
  const list = await loadProfiles(c);
  const id = pr.id || crypto.randomUUID();
  const next: CompanyProfile = { id, label: pr.label.trim() || clean.name || "", isDefault: pr.isDefault || list.length === 0, fields: clean };
  const out = list.some((x) => x.id === id) ? list.map((x) => (x.id === id ? next : x)) : [...list, next];
  const final = next.isDefault ? out.map((x) => ({ ...x, isDefault: x.id === id })) : out;
  if (!final.some((x) => x.isDefault) && final.length) final[0].isDefault = true;
  await storeProfiles(c, final);
  return final;
}
export async function deleteCompanyProfile(id: string): Promise<CompanyProfile[]> {
  const c = await crmCtx(); assertWrite(c);
  const list = (await loadProfiles(c)).filter((x) => x.id !== id);
  if (list.length && !list.some((x) => x.isDefault)) list[0].isDefault = true;
  await storeProfiles(c, list);
  return list;
}
/** Карточка реквизитов (DOCX/PDF) — чтобы скачать/отправить контрагенту. */
export async function companyCardUrl(id: string, which: "docx" | "pdf"): Promise<string> {
  const c = await crmCtx();
  const pr = (await loadProfiles(c)).find((x) => x.id === id);
  if (!pr) throw new Error("not-found");
  const values: Record<string, string> = {}; for (const [k, v] of Object.entries(pr.fields)) values["agency." + k] = v;
  values["deal.date"] = today();
  const docx = renderDocx(await builtinTemplate("company_card"), prepareData(values, { "deal.date": "date" }));
  return tmpFileUrl(c, `company-${id}`, docx, which, (pr.label || pr.fields.name || "company").slice(0, 60));
}
/** Временный файл в закрытом bucket (перезаписывается по ключу), подписанная ссылка на 10 минут. */
async function tmpFileUrl(c: Ctx, key: string, docx: Buffer, which: "docx" | "pdf", name: string): Promise<string> {
  const safe = key.replace(/[^a-zA-Z0-9_-]/g, "_");
  let buf: Buffer = docx, ext = "docx", mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
  if (which === "pdf") { const pdf = await docxToPdf(docx).catch(() => null); if (!pdf) throw new Error("no-pdf"); buf = pdf; ext = "pdf"; mime = "application/pdf"; }
  const p = `${c.ws.kind}/${c.ws.id}/tmp/${safe}.${ext}`;
  const up = await c.sb.storage.from("crm").upload(p, buf, { contentType: mime, upsert: true });
  if (up.error) throw new Error(up.error.message);
  const { data, error } = await c.sb.storage.from("crm").createSignedUrl(p, 600, { download: which === "pdf" ? undefined : `${name.replace(/[\\/:*?"<>|]+/g, " ").trim()}.${ext}` });
  if (error || !data) throw new Error(error?.message ?? "url");
  return data.signedUrl;
}

// ---------- шаблоны ----------
async function templatesOff(c: Ctx): Promise<string[]> {
  const { data, error } = await c.sb.from("crm_settings").select("templates_off").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).maybeSingle();
  if (error) return []; // до миграции 0025 колонки нет
  return Array.isArray(data?.templates_off) ? (data!.templates_off as string[]) : [];
}
/** Встроенный шаблон включить/выключить в пространстве (0025); свой — поле active. */
export async function setTemplateEnabled(id: string, on: boolean): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  if (id.startsWith("builtin:")) {
    const key = id.slice(8); const cur = await templatesOff(c);
    const next = on ? cur.filter((k) => k !== key) : [...new Set([...cur, key])];
    const { error } = await c.sb.from("crm_settings").upsert({ ws_kind: c.ws.kind, ws_id: c.ws.id, templates_off: next }, { onConflict: "ws_kind,ws_id" });
    if (error) throw new Error(error.message);
  } else {
    const { error } = await c.sb.from("crm_doc_templates").update({ active: on }).eq("id", id);
    if (error) throw new Error(error.message);
  }
}
export async function listTemplates(all = false): Promise<TemplateInfo[]> {
  const c = await crmCtx();
  const off = new Set(await templatesOff(c));
  let q = c.sb.from("crm_doc_templates").select("*").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).order("created_at");
  if (!all) q = q.eq("active", true);
  const { data } = await q;
  const own: TemplateInfo[] = ((data ?? []) as Row[]).map((r) => ({ id: r.id as string, builtin: false, key: null, name: r.name as string, kind: r.kind as string, lang: r.lang as string, enabled: r.active !== false, fields: ((r.fields as { key: string }[]) ?? []).map((f) => f.key), for: ["any"] }));
  const builtin = BUILTIN.filter((t) => t.for.length && (all || !off.has(t.key))).map((t) => ({ id: "builtin:" + t.key, builtin: true, key: t.key, name: t.name, kind: t.kind, lang: t.lang, enabled: !off.has(t.key), fields: t.fields, for: t.for as string[] }));
  return [...builtin, ...own];
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
  return { id, builtin: false, key: null, name, kind, lang: "—", enabled: true, fields: keys, for: ["any"] };
}
async function templateBuffer(c: Ctx, id: string): Promise<{ buf: Buffer; name: string; fields: string[] }> {
  if (id.startsWith("builtin:")) { const t = BUILTIN_MAP[id.slice(8)]; if (!t) throw new Error("template"); return { buf: await builtinTemplate(t.key), name: t.name.RU, fields: t.fields }; }
  const { data: t } = await c.sb.from("crm_doc_templates").select("*").eq("id", id).maybeSingle();
  if (!t?.path) throw new Error("template");
  const dl = await c.sb.storage.from("crm").download(t.path as string);
  if (dl.error || !dl.data) throw new Error("template-file");
  return { buf: Buffer.from(await dl.data.arrayBuffer()), name: t.name as string, fields: ((t.fields as { key: string }[]) ?? []).map((f) => f.key) };
}
/** Предпросмотр шаблона: все поля заполнены образцами (подписи полей в скобках), PDF или DOCX. */
export async function previewTemplate(id: string, which: "pdf" | "docx"): Promise<string> {
  const c = await crmCtx();
  const t = await templateBuffer(c, id);
  const values: Record<string, string> = {}; const types: Record<string, string | undefined> = {};
  for (const k of t.fields) { const f = FIELD_MAP[k]; types[k] = f?.type; values[k] = f?.type === "money" ? "1250000" : f?.type === "date" ? today() : f?.type === "number" ? "3" : `«${f?.label.TR ?? k}»`; }
  const company = await getCompany(); for (const [k, v] of Object.entries(company)) if (t.fields.includes("agency." + k)) values["agency." + k] = v;
  const docx = renderDocx(t.buf, prepareData(values, types));
  return tmpFileUrl(c, `preview-${id}`, docx, which, `${t.name} (preview)`);
}
/** Скачать сам шаблон (DOCX с плейсхолдерами) — чтобы поправить и загрузить как свой. */
export async function templateUrl(id: string): Promise<string> {
  const c = await crmCtx();
  const t = await templateBuffer(c, id);
  return tmpFileUrl(c, `tpl-${id}`, t.buf, "docx", t.name);
}
export async function updateTemplate(id: string, patch: { name?: string; kind?: string }): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const upd: Record<string, unknown> = {}; if (patch.name?.trim()) upd.name = patch.name.trim(); if (patch.kind) upd.kind = patch.kind;
  const { error } = await c.sb.from("crm_doc_templates").update(upd).eq("id", id);
  if (error) throw new Error(error.message);
}
export async function deleteTemplate(id: string): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  const { data } = await c.sb.from("crm_doc_templates").select("path").eq("id", id).maybeSingle();
  if (data?.path) await c.sb.storage.from("crm").remove([data.path as string]);
  await c.sb.from("crm_doc_templates").delete().eq("id", id);
}

// ---------- документы ----------
function rowDoc(r: Row): DocInfo {
  return { id: r.id as string, clientId: s(r.client_id), dealId: s(r.deal_id), title: r.title as string, kind: r.kind as string, status: r.status as DocInfo["status"], hasDocx: !!r.path_docx, hasPdf: !!r.path_pdf, hasFile: !!r.path_file, fileName: r.path_file ? (r.title as string) : null, size: (r.size as number) ?? null, templateKey: s(r.template_key), templateId: s(r.template_id), validUntil: s(r.valid_until), signedAt: s(r.signed_at), createdAt: r.created_at as string, createdBy: s(r.created_by) };
}
export async function listDocs(f: { dealId?: string; clientId?: string }): Promise<DocInfo[]> {
  const c = await crmCtx();
  let q = c.sb.from("crm_docs").select("*").eq("ws_kind", c.ws.kind).eq("ws_id", c.ws.id).order("created_at", { ascending: false });
  if (f.dealId) q = q.eq("deal_id", f.dealId); else if (f.clientId) q = q.eq("client_id", f.clientId);
  const { data } = await q;
  return ((data ?? []) as Row[]).map(rowDoc);
}

/** Значения по умолчанию для формы документа: реквизиты, клиент → buyer, объект сделки → property, сделка, ранее введённое. */
export async function docDefaults(dealId: string, companyId?: string | null): Promise<{ values: Record<string, string>; pdf: boolean; companies: CompanyProfile[]; companyId: string | null }> {
  const c = await crmCtx();
  const v: Record<string, string> = { "deal.date": today(), "deal.copies": "3", "deal.court": "Antalya", "deal.commissionWhen": "Tapu günü" };
  const companies = await loadProfiles(c);
  const { data: d } = await c.sb.from("crm_deals").select("*, crm_clients!crm_deals_client_id_fkey(*)").eq("id", dealId).maybeSingle();
  let stored: Record<string, string> = {};
  if (d?.extra_enc) { try { stored = JSON.parse(dec(c, "crm_deals", "extra", d.id as string, d.extra_enc as string)); } catch { stored = {}; } }
  const pickId = companyId ?? (d?.company_profile_id as string | null) ?? stored._companyId ?? null;
  const company = (companies.find((x) => x.id === pickId) ?? companies.find((x) => x.isDefault) ?? companies[0])?.fields ?? {};
  for (const [k, val] of Object.entries(company)) v["agency." + k] = val;
  if (d) {
    const cl = (Array.isArray(d.crm_clients) ? d.crm_clients[0] : d.crm_clients) as Row | null;
    // стороны (0027): анкеты клиентов — покупатель (клиент сделки) и продавец (seller_client_id); контакты — запасной вариант
    const dossierOf = (row: Row | null) => { if (!row?.dossier_enc) return {}; try { return JSON.parse(dec(c, "crm_clients", "dossier", row.id as string, row.dossier_enc as string) || "{}") as Record<string, string>; } catch { return {}; } };
    if (d.seller_client_id) {
      const { data: sel } = await c.sb.from("crm_clients").select("*").eq("id", d.seller_client_id as string).maybeSingle();
      if (sel) { v["seller.name"] = sel.name as string; for (const [k, val] of Object.entries(dossierOf(sel as Row))) v["seller." + k] = val; }
    }
    if (cl) {
      v["buyer.name"] = cl.name as string;
      for (const [k, val] of Object.entries(dossierOf(cl))) v["buyer." + k] = val;
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
        const il = GEO.find((g) => g.k === l.il), ilce = il?.ilces.find((x) => x.k === l.ilce);
        if (il) v["property.il"] = il.n.toUpperCase(); if (ilce) v["property.ilce"] = ilce.n.toUpperCase();
        if (l.semt) { // имена махалле — в таблице geo_mahalle (в mock/geo.json их нет)
          const { data: m } = await c.sb.from("geo_mahalle").select("name").eq("k", l.semt as string).maybeSingle();
          if (m?.name) v["property.mahalle"] = String(m.name).toUpperCase();
        }
        const ld = (l.data as Row) ?? {};
        if (ld.adaParsel && String(ld.adaParsel).includes("/")) { const [a, p] = String(ld.adaParsel).split("/"); v["property.ada"] = a.trim(); v["property.parsel"] = p.trim(); }
        if (l.area) v["property.netArea"] = String(l.area);
        if (ld.type === "land" && l.area) v["property.area"] = String(l.area);
        const loc = (ld.loc as Record<string, string>)?.TR ?? (ld.loc as Record<string, string>)?.RU;
        if (loc) v["property.address"] = loc;
      }
    }
    // сохранённые данные сделки (стороны, объект, условия) — поверх автоподстановки
    for (const [k, val] of Object.entries(stored)) if (!k.startsWith("_") && !k.startsWith("agency.")) v[k] = val;
  }
  return { values: v, pdf: await pdfAvailable(), companies, companyId: (companies.find((x) => x.id === pickId) ?? companies.find((x) => x.isDefault) ?? companies[0])?.id ?? null };
}

/** Слить значения в данные сделки (extra_enc): реквизиты компании (agency.*) не хранятся — они берутся из набора `_companyId`. */
async function mergeDealData(c: Ctx, dealId: string, values: Record<string, string>) {
  const { data: d } = await c.sb.from("crm_deals").select("extra_enc, client_id, seller_client_id").eq("id", dealId).maybeSingle();
  let cur: Record<string, string> = {};
  if (d?.extra_enc) { try { cur = JSON.parse(dec(c, "crm_deals", "extra", dealId, d.extra_enc as string)); } catch { cur = {}; } }
  // стороны (0027): покупатель и продавец живут в АНКЕТАХ клиентов, а не в сделке — записываем туда
  const parties: [string, string | null][] = [["buyer.", (d?.client_id as string | null) ?? null], ["seller.", (d?.seller_client_id as string | null) ?? null]];
  for (const [pref, cid] of parties) {
    if (!cid) continue;
    const upd: Record<string, string> = {}; let any = false;
    for (const [k, val] of Object.entries(values)) if (k.startsWith(pref)) { any = true; upd[k.slice(pref.length)] = val ?? ""; }
    if (!any) continue;
    const { data: row } = await c.sb.from("crm_clients").select("dossier_enc").eq("id", cid).maybeSingle();
    let doss: Record<string, string> = {};
    if (row?.dossier_enc) { try { doss = JSON.parse(dec(c, "crm_clients", "dossier", cid, row.dossier_enc as string) || "{}"); } catch { doss = {}; } }
    for (const [k, val] of Object.entries(upd)) { if (val.trim()) doss[k] = val.trim(); else delete doss[k]; }
    await c.sb.from("crm_clients").update({ dossier_enc: enc(c, "crm_clients", "dossier", cid, JSON.stringify(doss)) }).eq("id", cid);
  }
  for (const [k, val] of Object.entries(values)) {
    if (k.startsWith("agency.") || (k.startsWith("buyer.") && d?.client_id) || (k.startsWith("seller.") && d?.seller_client_id)) continue;
    if (val?.trim()) cur[k] = val; else delete cur[k];
  }
  await c.sb.from("crm_deals").update({ extra_enc: enc(c, "crm_deals", "extra", dealId, JSON.stringify(cur)) }).eq("id", dealId);
}
/** «Данные для документов» сделки: сохранить один раз, дальше система сама подставляет в любые шаблоны. */
export async function saveDealDocData(dealId: string, values: Record<string, string>, companyId?: string | null): Promise<void> {
  const c = await crmCtx(); assertWrite(c);
  await mergeDealData(c, dealId, { ...values, _companyId: companyId ?? "" });
  if (companyId !== undefined) await c.sb.from("crm_deals").update({ company_profile_id: companyId || null }).eq("id", dealId);
}
/** Несколько документов за раз из сохранённых данных сделки (без повторного ввода). */
export async function generateDocs(dealId: string, templateIds: string[], values: Record<string, string>): Promise<DocInfo[]> {
  const c = await crmCtx(); assertWrite(c);
  await mergeDealData(c, dealId, values);
  const tpls = await listTemplates(true);
  const out: DocInfo[] = [];
  for (const id of templateIds) {
    const t = tpls.find((x) => x.id === id); if (!t) continue;
    const used: Record<string, string> = {}; t.fields.forEach((k) => { if (values[k]) used[k] = values[k]; });
    out.push(await generateDoc({ dealId, templateId: id, title: typeof t.name === "string" ? t.name : t.name.RU, values: used, keep: false }));
  }
  return out;
}

export async function generateDoc(inp: { dealId: string; templateId: string; title: string; values: Record<string, string>; keep?: boolean }): Promise<DocInfo> {
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
  // ключи Storage — только ASCII: имя файла в хранилище техническое, человеческое название — при скачивании (docUrl)
  const up = await c.sb.storage.from("crm").upload(`${base}/document.docx`, docx, { contentType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" });
  if (up.error) throw new Error(up.error.message);
  let pathPdf: string | null = null;
  const pdf = await docxToPdf(docx).catch(() => null);
  if (pdf) { const u2 = await c.sb.storage.from("crm").upload(`${base}/document.pdf`, pdf, { contentType: "application/pdf" }); if (!u2.error) pathPdf = `${base}/document.pdf`; }
  const { data: row, error } = await c.sb.from("crm_docs").insert({ id, ws_kind: c.ws.kind, ws_id: c.ws.id, client_id: d.client_id, deal_id: inp.dealId, template_id: templateId, template_key: templateKey, title: inp.title.trim(), kind, path_docx: `${base}/document.docx`, path_pdf: pathPdf, size: docx.length, params_enc: enc(c, "crm_docs", "params", id, JSON.stringify(inp.values)), created_by: c.me.id }).select("*").single();
  if (error) throw new Error(error.message);
  // данные сделки (стороны, объект, условия) — один раз на сделку (12.10.2026, «20 раз заполнять — ужас»): всё, кроме реквизитов
  if (inp.keep !== false) await mergeDealData(c, inp.dealId, inp.values);
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
  const ext = (file.name.match(/\.([a-z0-9]{1,5})$/i)?.[1] ?? "bin").toLowerCase();
  const p = `${c.ws.kind}/${c.ws.id}/deals/${dealId}/${id}/file.${ext}`; // ключ ASCII; оригинальное имя — в title/mime
  const up = await c.sb.storage.from("crm").upload(p, Buffer.from(await file.arrayBuffer()), { contentType: file.type || "application/octet-stream" });
  if (up.error) throw new Error(up.error.message);
  const { data: row, error } = await c.sb.from("crm_docs").insert({ id, ws_kind: c.ws.kind, ws_id: c.ws.id, client_id: d.client_id, deal_id: dealId, title: title || file.name, kind, path_file: p, mime: file.type, size: file.size, created_by: c.me.id }).select("*").single();
  if (error) throw new Error(error.message);
  return rowDoc(row as Row);
}

/** Временная ссылка на файл (10 мин); скачивание пишется в журнал. */
export async function docUrl(id: string, which: "docx" | "pdf" | "file"): Promise<string> {
  const c = await crmCtx();
  const { data: r } = await c.sb.from("crm_docs").select("path_docx, path_pdf, path_file, title").eq("id", id).maybeSingle();
  const p = which === "docx" ? r?.path_docx : which === "pdf" ? r?.path_pdf : r?.path_file;
  if (!p) throw new Error("not-found");
  const ext = String(p).split(".").pop() ?? "";
  const name = `${String(r?.title ?? "document").replace(/[\\/:*?"<>|]+/g, " ").trim().slice(0, 80)}.${ext}`;
  const { data, error } = await c.sb.storage.from("crm").createSignedUrl(p as string, 600, { download: name });
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
