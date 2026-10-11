// Генератор лендинга из прототипа `One-Plan приложение/OnePlan Главная.dc.html` (спека: docs/prototype-other-spec.md §A).
// Запуск: `node scripts/gen-landing.mjs` из папки `web`. Перезаписывает:
//   src/components/landing/LandingView.jsx   — разметка прототипа 1:1 (inline-стили как в прототипе, через `S("css")`)
//   src/components/landing/landingLogic.js   — методы класса прототипа дословно (`renderVals` и хелперы)
//   src/components/landing/landingHover.css  — правила `style-hover` прототипа
//   src/i18n/landing/{ru,en,tr}.json         — словари прототипа
// Рукописные файлы (не трогает): Landing.tsx, LandingIcon.tsx, landing.css.
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const web = path.resolve(here, "..");
const protoDir = path.resolve(web, "..", "One-Plan приложение");
const src = fs.readFileSync(path.join(protoDir, "OnePlan Главная.dc.html"), "utf8");
const lines = src.split("\n");

// ───── 1. разметка ─────
const tplStart = lines.findIndex((l) => l.trim() === "</helmet>") + 1;
const tplEnd = lines.findIndex((l) => l.trim() === "</x-dc>");
let tpl = lines.slice(tplStart, tplEnd).join("\n").trim();

const hovers = new Map(); // css → className
const hoverClass = (css) => { if (!hovers.has(css)) hovers.set(css, `lph-${hovers.size + 1}`); return hovers.get(css); };
const expr = (v) => v.trim();
/** Значение атрибута → JS-выражение (строка / одно выражение / шаблонная строка). */
function attrValue(v) {
  const m = v.match(/^\{\{([\s\S]*?)\}\}$/);
  if (m && !m[1].includes("{{")) return expr(m[1]);
  if (!v.includes("{{")) return JSON.stringify(v);
  return "`" + v.replace(/`/g, "\\`").replace(/\{\{([\s\S]*?)\}\}/g, (_, e) => "${" + expr(e) + "}") + "`";
}
const VOID = new Set(["input", "img", "br"]);
const DROP = /^hint-/;
const RENAME = { class: "className", inputmode: "inputMode", for: "htmlFor" };

function convertTag(name, rawAttrs, selfClose) {
  const attrs = [];
  const re = /([a-zA-Z_:][-a-zA-Z0-9_:.]*)(?:="([^"]*)")?/g;
  let m;
  while ((m = re.exec(rawAttrs))) attrs.push([m[1], m[2]]);
  const get = (k) => attrs.find((a) => a[0] === k)?.[1];
  if (name === "sc-for") return `{(${expr(get("list").replace(/^\{\{|\}\}$/g, ""))}).map((${get("as")}, ${get("as")}_i) => (<Fragment key={${get("as")}_i}>`;
  if (name === "sc-if") return `{(${expr(get("value").replace(/^\{\{|\}\}$/g, ""))}) ? (<>`;
  // иконка Tabler: <i class="ti ti-x" style=…></i> → <Ti n=… style=… />
  if (name === "i" && /(^|\s)ti(\s|$)/.test(get("class") || "")) {
    const cls = get("class").replace(/(^|\s)ti(\s|$)/, " ").trim();
    const st = get("style");
    return `<Ti n={${attrValue(cls)}}${st !== undefined ? ` style={S(${attrValue(st)})}` : ""} />`;
  }
  const out = [];
  let cls = null;
  for (const [k0, v] of attrs) {
    if (DROP.test(k0)) continue;
    const k = RENAME[k0.toLowerCase()] || k0;
    if (k === "style") { out.push(`style={S(${attrValue(v)})}`); continue; }
    if (k === "style-hover") { cls = hoverClass(v); continue; }
    if (k === "src") { out.push(`src={A(${attrValue(v)})}`); continue; }
    if (v === undefined) { out.push(k); continue; }
    out.push(v.includes("{{") ? `${k}={${attrValue(v)}}` : `${k}=${JSON.stringify(v)}`);
  }
  if (cls) out.push(`className="${cls}"`);
  if (name === "img" && !attrs.some((a) => a[0] === "alt")) out.push('alt=""');
  if (name === "a" && get("href") === "#") out.push("onClick={(e) => e.preventDefault()}");
  return `<${name}${out.length ? " " + out.join(" ") : ""}${selfClose || VOID.has(name) ? " /" : ""}>`;
}

let jsx = "";
const tagRe = /<(\/?)([a-zA-Z][a-zA-Z0-9-]*)((?:\s+[a-zA-Z_:][-a-zA-Z0-9_:.]*(?:="[^"]*")?)*)\s*(\/?)>/g;
let last = 0, tm, skipCloseI = 0;
const text = (s) => s.replace(/\{\{([\s\S]*?)\}\}/g, (_, e) => "{" + expr(e) + "}");
while ((tm = tagRe.exec(tpl))) {
  jsx += text(tpl.slice(last, tm.index));
  last = tagRe.lastIndex;
  const [, close, name, rawAttrs, selfClose] = tm;
  if (close) {
    if (name === "sc-for") jsx += "</Fragment>))}";
    else if (name === "sc-if") jsx += "</>) : null}";
    else if (name === "i" && skipCloseI > 0) skipCloseI--;
    else jsx += `</${name}>`;
    continue;
  }
  const conv = convertTag(name, rawAttrs, !!selfClose);
  if (conv.startsWith("<Ti ")) skipCloseI++;
  jsx += conv;
}
jsx += text(tpl.slice(last));
// Логотип: четыре точки прототипа → фирменный знак `LogoMark` (один логотип везде, см. CLAUDE.md).
jsx = jsx.replace(/<span style=\{S\("display:inline-flex"\)\}>(?:<span style=\{S\("width:(\d+)px;height:\d+px;border-radius:50%;background:#[0-9a-f]{6}(?:;margin-left:-\d+px)?"\)\}><\/span>){4}<\/span>/g,
  (_m, px) => `<LogoMark size={${Math.round(Number(px) * 2.4)}} />`);

// ───── 2. логика класса ─────
const idx = (re) => lines.findIndex((l) => re.test(l));
const iI18n = idx(/^  i18n\(\)\{$/), iUnit = idx(/^  unitStatus\(r,c\)\{$/), iEnd = lines.findIndex((l, i) => i > iUnit && /^}$/.test(l));
const i18nSrc = lines.slice(iI18n + 1, iUnit).join("\n").replace(/\}\s*$/, ""); // тело метода i18n() без закрывающей скобки
const I18N = new Function(i18nSrc)();
const methods = lines.slice(iUnit, iEnd).join("\n");
const keys = Object.keys(
  new Function("I18N", `const C={${methods.replace(/^  \}$/gm, "  },")}};
    const self=Object.assign(Object.create(C),{state:{lang:'RU',aud:'r',role:'r',faqOpen:0,tick:0,selUnit:{r:3,c:4},devTab:'board',legalDoc:null,leadName:'',leadCo:'',leadPhone:'',leadMail:'',leadMsg:'',leadC:false,leadDone:false},props:{},setState(){},savePrefs(){},i18n(){return I18N}});
    return C.renderVals.call(self);`)(I18N),
);

const outDir = path.join(web, "src/components/landing");
fs.mkdirSync(outDir, { recursive: true });
const HEAD = "// СГЕНЕРИРОВАНО `scripts/gen-landing.mjs` из прототипа «OnePlan Главная.dc.html» — не править руками, править генератор/прототип.\n";

fs.writeFileSync(path.join(outDir, "landingLogic.js"), `${HEAD}// Методы класса прототипа дословно. \`ctx\` = { state, props, setState, savePrefs, i18n, gotoApp, submit } из \`Landing.tsx\`.
const C = {
${methods
  .replace(/^  \}$/gm, "  },")
  .replace(/gotoApp:\(\)=>\{[^}]*\},/, "gotoApp:()=>this.gotoApp(),")
  .replace(/submitLead:\(\)=>\{if\(([^)]*)\)this\.setState\(\{leadDone:true\}\);\}/, "submitLead:()=>{if($1)this.submit();}")}
};
/** Все значения для разметки (\`renderVals\` прототипа). */
export function landingVals(ctx) { return C.renderVals.call(Object.assign(Object.create(C), ctx)); }
`);

fs.writeFileSync(path.join(outDir, "LandingView.jsx"), `${HEAD}// Разметка лендинга 1:1 с прототипом (строки ${tplStart + 1}–${tplEnd}). Стили — строки CSS прототипа через \`S()\`.
import { Fragment } from "react";
import { A, S } from "./landingStyle";
import { Ti } from "./LandingIcon";
import { LogoMark } from "@/components/Logo";

export function LandingView({ v }) {
  const { ${keys.join(", ")} } = v;
  return (
    ${jsx.split("\n").join("\n    ")}
  );
}
`);

fs.writeFileSync(path.join(outDir, "landingHover.css"), `/* ${HEAD.trim().slice(3)} */\n` +
  [...hovers].map(([css, c]) => `.${c}:hover{${css.split(";").filter(Boolean).map((d) => d.trim() + "!important").join(";")}}`).join("\n") + "\n");

const dictDir = path.join(web, "src/i18n/landing");
fs.mkdirSync(dictDir, { recursive: true });
for (const [lang, file] of [["RU", "ru"], ["EN", "en"], ["TR", "tr"]]) fs.writeFileSync(path.join(dictDir, `${file}.json`), JSON.stringify(I18N[lang], null, 1) + "\n");

console.log(`template lines ${tplStart + 1}–${tplEnd}, vals: ${keys.length}, hovers: ${hovers.size}, i18n keys: ${Object.keys(I18N.RU).length}`);
