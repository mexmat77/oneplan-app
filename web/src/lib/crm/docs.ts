import "server-only";

// Документы CRM: подстановка в DOCX-шаблон (docxtemplater, {{group.key}}), суммы прописью TR/EN, PDF через LibreOffice
// (soffice --headless на сервере; если его нет — только DOCX), файлы — в закрытом bucket "crm".
import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import Docxtemplater from "docxtemplater";
import PizZip from "pizzip";
import { BUILTIN_MAP } from "./docFields";

const exec = promisify(execFile);

// ---------- числа прописью ----------
const TR1 = ["", "bir", "iki", "üç", "dört", "beş", "altı", "yedi", "sekiz", "dokuz"];
const TR10 = ["", "on", "yirmi", "otuz", "kırk", "elli", "altmış", "yetmiş", "seksen", "doksan"];
function tr3(n: number): string {
  const h = Math.floor(n / 100), t = Math.floor((n % 100) / 10), u = n % 10;
  return [h ? (h === 1 ? "yüz" : TR1[h] + " yüz") : "", TR10[t], TR1[u]].filter(Boolean).join(" ");
}
export function wordsTr(n: number): string {
  n = Math.round(Math.abs(n));
  if (n === 0) return "sıfır";
  const parts: string[] = [];
  const units = [["", 1], ["bin", 1000], ["milyon", 1e6], ["milyar", 1e9], ["trilyon", 1e12]] as const;
  for (let i = units.length - 1; i >= 0; i--) {
    const [name, v] = units[i]; const q = Math.floor(n / v) % 1000;
    if (!q) continue;
    if (name === "bin" && q === 1) parts.push("bin"); else parts.push((tr3(q) + " " + name).trim());
  }
  return parts.join(" ");
}
const EN1 = ["", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const EN10 = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
function en3(n: number): string {
  const h = Math.floor(n / 100), r = n % 100;
  const tail = r < 20 ? EN1[r] : EN10[Math.floor(r / 10)] + (r % 10 ? "-" + EN1[r % 10] : "");
  return [h ? EN1[h] + " hundred" : "", tail].filter(Boolean).join(" ");
}
export function wordsEn(n: number): string {
  n = Math.round(Math.abs(n));
  if (n === 0) return "zero";
  const parts: string[] = [];
  const units = [["", 1], ["thousand", 1000], ["million", 1e6], ["billion", 1e9], ["trillion", 1e12]] as const;
  for (let i = units.length - 1; i >= 0; i--) { const [name, v] = units[i]; const q = Math.floor(n / v) % 1000; if (q) parts.push((en3(q) + " " + name).trim()); }
  return parts.join(" ");
}
export const fmtTr = (n: number) => Math.round(n).toLocaleString("tr-TR");  // 17.500.000
export const fmtEn = (n: number) => Math.round(n).toLocaleString("en-US");  // 17,500,000
const num = (v: unknown) => { const n = parseFloat(String(v ?? "").replace(/[^\d.,-]/g, "").replace(/\./g, "").replace(",", ".")); return isFinite(n) ? n : NaN; };
const fmtDate = (v: unknown) => { const s = String(v ?? ""); const m = s.match(/^(\d{4})-(\d{2})-(\d{2})/); return m ? `${m[3]}.${m[2]}.${m[1]}` : s; };

/** Значения формы (group.key → строка) → данные для шаблона: деньги в формате 17.500.000 + прописью TR/EN (+ ключи *En,
 *  *WordsTr, *WordsEn), даты дд.мм.гггг. Словарь ПЛОСКИЙ с ключами «group.key»: стандартный парсер docxtemplater ищет тег
 *  целиком как ключ scope, точки не разбирает. */
export function prepareData(values: Record<string, string>, fieldTypes: Record<string, string | undefined>): Record<string, string> {
  const data: Record<string, string> = {};
  for (const [k, raw] of Object.entries(values)) {
    const t = fieldTypes[k];
    if (t === "money") { const n = num(raw); data[k] = isNaN(n) ? raw : fmtTr(n); if (!isNaN(n)) { data[k + "WordsTr"] = wordsTr(n); data[k + "WordsEn"] = wordsEn(n); data[k + "En"] = fmtEn(n); } }
    else if (t === "date") data[k] = fmtDate(raw);
    else data[k] = raw;
  }
  return data;
}

/** Рендер DOCX: шаблон + данные → буфер. Неизвестные плейсхолдеры → пустая строка. */
export function renderDocx(template: Buffer, data: Record<string, unknown>): Buffer {
  const zip = new PizZip(template);
  const d = new Docxtemplater(zip, { paragraphLoop: true, linebreaks: true, delimiters: { start: "{{", end: "}}" }, nullGetter: () => "" });
  d.render(data);
  return d.getZip().generate({ type: "nodebuffer", compression: "DEFLATE" }) as Buffer;
}

/** Плейсхолдеры в DOCX ({{group.key}}) — для своих шаблонов пользователя. */
export function listPlaceholders(template: Buffer): string[] {
  const zip = new PizZip(template);
  const out = new Set<string>();
  for (const name of Object.keys(zip.files)) {
    if (!/^word\/(document|header\d*|footer\d*)\.xml$/.test(name)) continue;
    const xml = zip.files[name].asText();
    const text = xml.replace(/<[^>]+>/g, "");
    for (const m of text.matchAll(/\{\{\s*([a-zA-Z][\w.]*)\s*\}\}/g)) out.add(m[1]);
  }
  return [...out];
}

export async function builtinTemplate(key: string): Promise<Buffer> {
  const t = BUILTIN_MAP[key];
  if (!t) throw new Error("template");
  return readFile(path.join(process.cwd(), "src", "crm-templates", t.file));
}

let sofficeChecked: string | null | undefined;
async function soffice(): Promise<string | null> {
  if (sofficeChecked !== undefined) return sofficeChecked;
  for (const p of ["/usr/bin/soffice", "/usr/local/bin/soffice", "/opt/homebrew/bin/soffice", "/Applications/LibreOffice.app/Contents/MacOS/soffice"]) {
    try { await readFile(p); sofficeChecked = p; return p; } catch { /* next */ }
  }
  sofficeChecked = null; return null;
}
export const pdfAvailable = async () => !!(await soffice());

/** DOCX → PDF через LibreOffice; null, если LibreOffice не установлен. */
export async function docxToPdf(docx: Buffer): Promise<Buffer | null> {
  const bin = await soffice();
  if (!bin) return null;
  const dir = await mkdtemp(path.join(tmpdir(), "opl-doc-"));
  try {
    const src = path.join(dir, "doc.docx");
    await writeFile(src, docx);
    await exec(bin, ["--headless", "--norestore", "--convert-to", "pdf", "--outdir", dir, src], { env: { ...process.env, HOME: dir }, timeout: 60000 });
    return await readFile(path.join(dir, "doc.pdf"));
  } finally { await rm(dir, { recursive: true, force: true }); }
}
