// Заливает шаблоны писем Supabase Auth (supabase/email-templates/*.html + *.subject.txt) через Management API.
// Запуск: `node scripts/upload-email-templates.mjs` (SUPABASE_ACCESS_TOKEN и NEXT_PUBLIC_SUPABASE_URL из web/.env.local).
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const web = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const env = Object.fromEntries(fs.readFileSync(path.join(web, ".env.local"), "utf8").split("\n").filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf("="); return [l.slice(0, i), l.slice(i + 1).replace(/^"|"$/g, "")]; }));
const ref = env.NEXT_PUBLIC_SUPABASE_URL.match(/https:\/\/([a-z]+)\.supabase\.co/)[1];
const dir = path.join(web, "supabase", "email-templates");
const body = {};
for (const key of ["invite", "magic_link", "recovery", "confirmation"]) {
  body[`mailer_subjects_${key}`] = fs.readFileSync(path.join(dir, `${key}.subject.txt`), "utf8").trim();
  body[`mailer_templates_${key}_content`] = fs.readFileSync(path.join(dir, `${key}.html`), "utf8");
}
const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/config/auth`, { method: "PATCH", headers: { Authorization: `Bearer ${env.SUPABASE_ACCESS_TOKEN}`, "Content-Type": "application/json" }, body: JSON.stringify(body) });
if (!r.ok) { console.error("PATCH failed", r.status, (await r.text()).slice(0, 300)); process.exit(1); }
const d = await r.json();
console.log("uploaded:", ["invite", "magic_link", "recovery", "confirmation"].map((k) => `${k}=${(d[`mailer_templates_${k}_content`] || "").length}b`).join(" "), "| otp_exp:", d.mailer_otp_exp);
