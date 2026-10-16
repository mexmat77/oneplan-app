import Link from "next/link";
import { cookies } from "next/headers";
import { LogoMark } from "@/components/Logo";
import { LANG_COOKIE, type Lang } from "@/i18n";

// Публичная документация API (16.10.2026; RU/EN/TR — 17.10.2026, «документы по API должны быть универсальные»):
// выгрузка объявлений на сайт (разделы 1–8) и приём заявок с сайта в CRM (раздел 9). Открыта без входа (proxy: /api/docs).
// Язык — `?lang=ru|en|tr`, иначе cookie приложения, иначе RU; переключатель вверху. Это ТЗ, которое риэлтор/агентство
// отдаёт своему разработчику — ссылку с нужным языком дают страница «API и выгрузка» и настройки источников CRM.
export const metadata = { title: "OnePlan API — listings export & website leads", robots: { index: false } };

const SITE = process.env.NEXT_PUBLIC_SITE_URL || "https://one-plan.pro";
const h2 = "mt-10 mb-3 text-[20px] font-extrabold tracking-[-0.01em] text-ink";
const h3 = "mt-6 mb-2 text-[15px] font-bold text-ink";
const p = "mb-3 text-[14px] leading-[1.6] text-text";
const pre = "mb-4 overflow-x-auto rounded-[12px] bg-[#14243f] px-4 py-3 font-mono text-[12.5px] leading-[1.6] text-[#dfe6f3]";
const code = "rounded-[5px] bg-bg-3 px-[5px] py-[1px] font-mono text-[12.5px] text-[#2c3a52]";
const Tbl = ({ rows, head }: { rows: string[][]; head: string[] }) => (
  <div className="mb-4 overflow-x-auto rounded-[12px] border border-line">
    <table className="w-full text-[13px]"><thead><tr className="bg-bg-3 text-left text-[11px] uppercase tracking-[.05em] text-muted">{head.map((h) => <th key={h} className="px-3 py-2">{h}</th>)}</tr></thead>
      <tbody>{rows.map((r, i) => <tr key={i} className="border-t border-line align-top">{r.map((c, j) => <td key={j} className={`px-3 py-2 ${j === 0 ? "whitespace-nowrap font-mono text-[12.5px] text-[#2c3a52]" : "text-text"}`}>{c}</td>)}</tr>)}</tbody></table>
  </div>
);
/** Абзац с `code`-вставками: части в обратных кавычках рендерятся моноширинно. */
const P = ({ children }: { children: string }) => <p className={p}>{children.split(/`([^`]+)`/).map((part, i) => (i % 2 ? <span key={i} className={code}>{part}</span> : part))}</p>;

type Doc = {
  title: string; intro: string; langName: string;
  k_h: string; k_p1: string; k_head: string[]; k_rows: string[][]; k_p2: string;
  m_h: string; m_head: string[]; m_rows: string[][]; m_params: string; p_head: string[]; p_rows: string[][];
  r_h: string; r_code: string; r_p: string;
  x_h: string; x_code: string;
  d_h: string; d_p: string; d_code: string;
  e_h: string; e_curl: string; e_php_h: string; e_php: string; e_node_h: string; e_node: string; e_inc_h: string; e_inc: string;
  l_h: string; l_head: string[]; l_rows: string[][]; l_p: string;
  u_h: string; u_p: string;
  c_h: string; c_p: string; c_tok_h: string; c_tok: string; c_req_h: string; c_req: string; c_f_head: string[]; c_f_rows: string[][];
  c_resp_h: string; c_resp_head: string[]; c_resp_rows: string[][]; c_does_h: string; c_does: string; c_ex_h: string; c_ex: string; c_builders: string;
  po_h: string; po_p: string;
  f_h: string; f_p1: string; f_link: string; f_p2: string;
};

const JSON_SAMPLE = (c: Record<string, string>) => `GET ${SITE}/api/v1/listings?key=opl_live_…&deal=sale&limit=2

{
  "total": 12, "count": 2, "limit": 2, "offset": 0,
  "scope": "realtor", "name": "Ivan Petrov", "agency": "ONETEAM",
  "generated_at": "2026-10-16T09:00:00.000Z",
  "items": [
    {
      "id": "OP-100003",                      // ${c.id}
      "uuid": "e5dd730c-b50d-4c28-8359-30fa1ca8313c",
      "status": "active",                     // active | reserved | sold | off
      "deal": "sale",                         // sale | rent | daily | transfer
      "type": "land",                         // flat | house | comm | land | other
      "rooms": null,                          // "2+1" … ; ${c.rooms}
      "price": 13200000, "currency": "TRY",   // TRY | EUR | USD — ${c.price}
      "badge": "excl",                        // excl | new | hot | drop | null
      "title": { "RU": "…", "EN": "…", "TR": "…" },
      "description": { "RU": "…", "EN": "…", "TR": "…" },
      "original_lang": "RU", "machine_translated": ["EN", "TR"],
      "location": { "il": "antalya", "il_name": "Antalya", "ilce": "muratpasa", "ilce_name": "Muratpaşa",
                    "mahalle": "ermenek", "mahalle_name": "Ermenek", "lat": 36.87, "lng": 30.77, "sea_distance_m": 1200 },
      "area": { "gross": 470, "net": 421 },   // m²; ${c.area}
      "floor": 3, "floors_total": 5,
      "building": { "age_years": 5, "heating": ["ac"], "bathrooms": 2, "balcony": true, "lift": true, "gas": false,
                    "in_complex": true, "aidat_monthly": 1500 },
      "terms": { "furnished": true, "citizenship_eligible": false, "residence_permit_eligible": true,
                 "mortgage": true, "exchange": false, "owned_5y": false, "deposit": null, "commission": 2 },
      "photos": ["https://…/1.jpg", "https://…/2.jpg"],   // ${c.photos}
      "cover": "https://…/1.jpg",
      "features": ["pool", "opark", "sea"],   // ${c.features}
      "price_history": [{ "date": "10.10.2026", "price": 13350000 }],
      "realtor": { "id": "…", "name": "Ivan Petrov", "phone": "+90 5…", "email": "…" },
      "url": "${SITE}/share/obj/e5dd730c-…",  // ${c.url}
      "created_at": "2026-10-10T19:04:51Z", "updated_at": "2026-10-13T13:25:15Z"
    }
  ]
}`;
const XML_SAMPLE = `GET ${SITE}/feed/opl_agency_….xml

<?xml version="1.0" encoding="UTF-8"?>
<listings generated="2026-10-16T09:00:00.000Z" source="${SITE}" scope="agency" name="ONETEAM" agency="ONETEAM" count="12">
  <listing id="OP-100003" uuid="e5dd730c-…" status="active">
    <deal>sale</deal><type>land</type><rooms></rooms><badge>excl</badge>
    <price currency="TRY">13200000</price>
    <title lang="ru">…</title><title lang="en">…</title><title lang="tr">…</title>
    <description lang="ru">…</description>…
    <location il="antalya" ilce="muratpasa" mahalle="ermenek" lat="36.87" lng="30.77" sea_distance_m="1200">Antalya, Muratpaşa, Ermenek</location>
    <area gross="470" net="421"/><floor total="5">3</floor>
    <building age_years="5" bathrooms="2" balcony="true" lift="true" gas="false" in_complex="true" aidat_monthly="1500"><heating>ac</heating></building>
    <terms furnished="true" citizenship_eligible="false" residence_permit_eligible="true" mortgage="true" exchange="false" deposit=""/>
    <photos><photo>https://…/1.jpg</photo></photos>
    <features><feature>pool</feature></features>
    <realtor id="…">Ivan Petrov</realtor>
    <url>${SITE}/share/obj/e5dd730c-…</url><created_at>…</created_at><updated_at>…</updated_at>
  </listing>
</listings>`;
const DICT_SAMPLE = (c: Record<string, string>) => `{
  "deal": { "sale": { "RU": "Продать", "EN": "Sell", "TR": "Satılık" }, … },
  "type": { "flat": { "RU": "Квартира", "EN": "Apartment", "TR": "Daire" }, … },
  "status": { "active": { "RU": "Активен", "EN": "Active", "TR": "Aktif" }, … },
  "features": { "pool": { "RU": "Бассейн", "EN": "Pool", "TR": "Havuz" }, … },
  "heating": { … }, "badge": { … },
  "geo": [ { "key": "antalya", "name": "Antalya", "ilce": [ { "key": "muratpasa", "name": "Muratpaşa", "mahalle": [ { "key": "lara", "name": "Lara" } ] } ] } ],
  "rooms": ["1+0", "1+1", "2+1", …], "currencies": ["TRY", "EUR", "USD"]   // ${c.note}
}`;
const CURL = `curl -H "Authorization: Bearer opl_live_…" "${SITE}/api/v1/listings?deal=sale&type=flat&limit=50"`;
const PHP = (c: string) => `$key = getenv('ONEPLAN_KEY'); // ${c}
$json = file_get_contents("${SITE}/api/v1/listings?key=$key&limit=500");
$data = json_decode($json, true);
foreach ($data['items'] as $o) {
  echo '<a href="/objects/' . $o['id'] . '"><img src="' . $o['cover'] . '"> ' . $o['title']['EN'] . ' — ' . number_format($o['price'], 0, '', ' ') . ' ₺</a>';
}`;
const NODE = `const r = await fetch("${SITE}/api/v1/listings?limit=500", { headers: { Authorization: \`Bearer \${process.env.ONEPLAN_KEY}\` }, next: { revalidate: 300 } });
const { items } = await r.json();`;
const INBOUND_REQ = (msg: string, lang: string) => `POST ${SITE}/api/crm/inbound
Authorization: Bearer ops_…
Content-Type: application/json

{ "name": "Mehmet Yılmaz", "phone": "+90 532 000 00 00", "email": "m@example.com",
  "message": "${msg}", "lang": "${lang}" }`;
const INBOUND_EX = (c: Record<string, string>) => `# curl
curl -X POST "${SITE}/api/crm/inbound" -H "Authorization: Bearer $ONEPLAN_CRM_TOKEN" -H "Content-Type: application/json" \\
  -d '{"name":"Mehmet","phone":"+90 532 000 00 00","message":"2+1 Konyaaltı"}'

// Node.js / Next.js (${c.node})
await fetch("${SITE}/api/crm/inbound", { method: "POST",
  headers: { Authorization: \`Bearer \${process.env.ONEPLAN_CRM_TOKEN}\`, "Content-Type": "application/json" },
  body: JSON.stringify({ name, phone, email, message, lang: "EN" }) });

<?php // WordPress: functions.php, ${c.php} (Contact Form 7 — wpcf7_mail_sent)
wp_remote_post('${SITE}/api/crm/inbound', ['headers' => ['Authorization' => 'Bearer ' . getenv('ONEPLAN_CRM_TOKEN'), 'Content-Type' => 'application/json'],
  'body' => json_encode(['name' => $name, 'phone' => $phone, 'email' => $email, 'message' => $msg])]);`;

const DOCS: Record<Lang, Doc> = {
  RU: {
    langName: "Русский",
    title: "Выгрузка объявлений на ваш сайт и заявки в CRM",
    intro: `Техническое задание для разработчика сайта риэлтора или агентства. Разделы 1–8 — выгрузка объявлений на сайт, раздел 9 — приём заявок с сайта в CRM. OnePlan отдаёт ваши объявления в формате JSON (REST API) и XML-фид. Данные обновляются сразу после изменения в кабинете, ответы кэшируются на 5 минут (фид — 15 минут). Все адреса — \`${SITE}\`.`,
    k_h: "1. Ключ доступа", k_p1: "Ключ выдаётся в кабинете OnePlan → «API и выгрузка». Есть два вида:",
    k_head: ["Ключ", "Что отдаёт", "Кто создаёт"], k_rows: [["opl_live_…", "объявления одного риэлтора", "сам риэлтор"], ["opl_agency_…", "объявления всех риэлторов агентства (с именем и телефоном риэлтора в каждом объекте)", "администратор агентства"]],
    k_p2: "Ключ передаётся параметром `?key=…` или заголовком `Authorization: Bearer …`. Ключ открывает только чтение ваших объявлений и не даёт доступа к остальной базе. Не вставляйте его во фронтенд-код сайта (JavaScript в браузере) — запрашивайте API со своего сервера. Если ключ утёк, перевыпустите его в кабинете: старый перестаёт работать сразу.",
    m_h: "2. Методы", m_head: ["Метод", "Описание"], m_rows: [
      ["GET /api/v1/listings", "Список объявлений с фильтрами и постраничной выдачей (по умолчанию только активные)"],
      ["GET /api/v1/listings/{uuid}", "Одно объявление (любого статуса) по uuid или номеру OP-100001"],
      ["GET /api/v1/dictionaries", "Справочники: подписи значений на RU/EN/TR, география (il → ilçe → mahalle), список комнат, валюты"],
      ["GET /feed/{key}.xml", "XML-фид всех активных объявлений — для сайтов на CMS и агрегаторов"]],
    m_params: "Параметры /api/v1/listings", p_head: ["Параметр", "Значения", "Пояснение"], p_rows: [
      ["deal", "sale, rent, daily, transfer", "тип сделки; несколько через запятую"],
      ["type", "flat, house, comm, land, other", "тип объекта; несколько через запятую"],
      ["il", "ключ провинции, напр. antalya", "см. dictionaries.geo"],
      ["ilce", "ключи районов через запятую", "см. dictionaries.geo"],
      ["rooms", "1+1,2+1,3+1…", "несколько через запятую; у участков пусто"],
      ["price_min, price_max", "число", "в валюте объявления (обычно ₺)"],
      ["status", "active (по умолчанию), reserved, sold, off, all", "показывать ли резерв/проданные"],
      ["updated_since", "ISO-дата, напр. 2026-10-01T00:00:00Z", "только изменённые после даты — для инкрементальной синхронизации"],
      ["realtor", "uuid риэлтора", "только для ключа агентства: объявления одного сотрудника"],
      ["limit, offset", "limit ≤ 500 (по умолчанию 100), offset от 0", "страницы; в ответе total — всего объявлений"]],
    r_h: "3. Формат ответа", r_code: JSON_SAMPLE({ id: "номер для людей", rooms: "null у участков", price: "цена в валюте объявления", area: "у участков gross = net = площадь участка", photos: "публичные URL, можно показывать напрямую", features: "ключи — подписи в /api/v1/dictionaries", url: "публичная карточка-превью OnePlan" }),
    r_p: "Тексты всегда приходят на трёх языках. Если риэлтор писал на одном языке, остальные два переведены ИИ — такие языки перечислены в `machine_translated`, можно подписать «перевод автоматический». Фото отдаются в исходном размере (до 1600 px по длинной стороне).",
    x_h: "4. XML-фид", x_code: XML_SAMPLE,
    d_h: "5. Справочники", d_p: "`GET /api/v1/dictionaries?key=…` возвращает подписи для всех кодов на RU/EN/TR и географию:", d_code: DICT_SAMPLE({ note: "ключи — как в объявлениях" }),
    e_h: "6. Примеры кода", e_curl: CURL, e_php_h: "PHP (WordPress, Laravel и т. п.) — на сервере сайта", e_php: PHP("ключ храните в настройках сервера, не в коде"), e_node_h: "Node.js / Next.js — на сервере", e_node: NODE,
    e_inc_h: "Инкрементальное обновление", e_inc: "Раз в 5–15 минут запрашивайте `?updated_since=<время прошлого запроса>&status=all` — придут изменённые, проданные и снятые объявления; по `status` удаляйте или помечайте их у себя. Полную перезагрузку (без updated_since) делайте раз в сутки.",
    l_h: "7. Ограничения и ошибки", l_head: ["Код", "Значение"], l_rows: [["401 invalid_key", "ключа нет, он отозван, риэлтор или агентство заблокированы"], ["404 not_found", "объявление не найдено или принадлежит другому риэлтору"], ["429", "слишком часто: держите не более 1 запроса в секунду с одного ключа"], ["5xx", "временная ошибка — повторите через минуту"]],
    l_p: "CORS открыт (`Access-Control-Allow-Origin: *`), но из-за ключа запрашивайте API со своего сервера. Объём ответа при limit=500 — до ~2 МБ. Фото лежат в хранилище OnePlan и доступны без ключа; скачивать их к себе не обязательно.",
    u_h: "8. Что можно делать с данными", u_p: "Показывать на собственном сайте риэлтора или агентства, в своих приложениях и презентациях. Нельзя: передавать фид третьим лицам, выкладывать ключ публично, выдавать объявления другого агентства за свои. Телефон и имя риэлтора в ответе — для вывода контактов на вашем сайте.",
    c_h: "9. Заявки с вашего сайта → CRM OnePlan",
    c_p: "Форма на сайте («Оставить заявку», «Узнать цену», «Записаться на показ») может отправлять заявки прямо в вашу CRM: клиент появится в списке со статусом «Новый», контакты зашифруются, а вам придёт уведомление. Работает с любым сайтом: WordPress, Tilda, Wix (через серверный скрипт), собственный код.",
    c_tok_h: "Токен", c_tok: "CRM → Настройки → Источники → добавьте источник с типом «Сайт» (например, «Сайт агентства») → кнопка «Создать токен». Токен вида `ops_…` показывается один раз — скопируйте его; в OnePlan хранится только его хэш. Потеряли — «Перевыпустить», старый перестаёт работать. Токен держите на сервере сайта (переменная окружения, настройки CMS), не в JavaScript страницы: оттуда его увидит любой посетитель.",
    c_req_h: "Запрос", c_req: INBOUND_REQ("Интересует 2+1 в Konyaaltı до 8 млн ₺", "RU"),
    c_f_head: ["Поле", "Обязательно", "Пояснение"], c_f_rows: [["name", "одно из трёх", "имя клиента, до 200 символов"], ["phone", "одно из трёх", "в любом формате, до 40 символов; нормализуется для поиска дублей"], ["email", "одно из трёх", "до 120 символов"], ["message", "нет", "текст заявки, до 4000 символов — попадёт в ленту клиента"], ["lang", "нет", "RU, EN или TR — язык клиента (по умолчанию RU)"]],
    c_resp_h: "Ответы", c_resp_head: ["Код", "Значение"], c_resp_rows: [["200 {ok:true, clientId, duplicate}", "заявка принята; duplicate=true — клиент с таким телефоном/e-mail уже есть, заявка привязана к нему"], ["400 empty / json", "нет ни имени, ни телефона, ни e-mail, либо тело не JSON"], ["401 token", "токена нет, он перевыпущен или источник отключён"], ["409 crm-not-initialized", "владелец ещё ни разу не открывал CRM — откройте её один раз"]],
    c_does_h: "Что делает OnePlan", c_does: "Ищет клиента по телефону и e-mail (сравнение по хэшу — номер открыто не хранится). Нашёл — добавляет заявку в ленту существующего клиента с пометкой «дубль», ответственный не меняется. Не нашёл — создаёт клиента со статусом «Новый» и источником из токена. Контакты, текст и сырая заявка шифруются ключом вашего пространства (AES-256-GCM). Уведомление приходит в колокольчик со ссылкой на карточку.",
    c_ex_h: "Примеры", c_ex: INBOUND_EX({ node: "обработчик формы на сервере", php: "хук формы" }),
    c_builders: "Tilda, Wix и другие конструкторы: используйте их вебхук формы, направив его на небольшой серверный скрипт (PHP/Node), который добавит заголовок с токеном и перешлёт заявку — конструкторы не умеют подставлять секретный заголовок сами.",
    po_h: "Порталы объявлений", po_p: "Sahibinden не принимает объявления из внешних систем: размещение там только вручную в кабинете портала (его API по решению Антимонопольного совета Турции отдаёт объявления корпоративных магазинов наружу, на конкурирующие площадки, а не принимает их). Hepsiemlak и Emlakjet подключают выгрузку партнёрским программам по договору с порталом — наш фид к этому готов, включение возможно после подписания такого договора. Обещать «автоматическую публикацию на Sahibinden» клиентам нельзя.",
    f_h: "10. Планы", f_p1: "Вебхуки (событие на ваш URL при создании объявления, смене цены или статуса) — по запросу в поддержку: ", f_link: "написать", f_p2: ". Версия API: v1 (16.10.2026). Изменения, ломающие совместимость, выйдут как v2; v1 продолжит работать.",
  },
  EN: {
    langName: "English",
    title: "Listings export to your website and website leads into the CRM",
    intro: `Technical specification for the developer of a realtor’s or agency’s website. Sections 1–8 cover exporting listings to a website, section 9 — receiving leads from the website into the CRM. OnePlan serves your listings as JSON (REST API) and as an XML feed. Data updates right after a change in the account; responses are cached for 5 minutes (feed — 15 minutes). All URLs start with \`${SITE}\`.`,
    k_h: "1. Access key", k_p1: "The key is issued in the OnePlan account → “API & export”. There are two kinds:",
    k_head: ["Key", "What it returns", "Who creates it"], k_rows: [["opl_live_…", "listings of one realtor", "the realtor"], ["opl_agency_…", "listings of all the agency’s realtors (with the realtor’s name and phone in every item)", "agency administrator"]],
    k_p2: "Pass the key as the `?key=…` parameter or the `Authorization: Bearer …` header. The key grants read-only access to your own listings and nothing else in the database. Never put it into the website’s front-end code (browser JavaScript) — call the API from your server. If the key leaks, re-issue it in the account: the old one stops working immediately.",
    m_h: "2. Endpoints", m_head: ["Endpoint", "Description"], m_rows: [
      ["GET /api/v1/listings", "Listings with filters and pagination (active only by default)"],
      ["GET /api/v1/listings/{uuid}", "One listing (any status) by uuid or by number OP-100001"],
      ["GET /api/v1/dictionaries", "Dictionaries: labels for all codes in RU/EN/TR, geography (il → ilçe → mahalle), room types, currencies"],
      ["GET /feed/{key}.xml", "XML feed of all active listings — for CMS-based sites and aggregators"]],
    m_params: "Parameters of /api/v1/listings", p_head: ["Parameter", "Values", "Notes"], p_rows: [
      ["deal", "sale, rent, daily, transfer", "deal type; several comma-separated"],
      ["type", "flat, house, comm, land, other", "property type; several comma-separated"],
      ["il", "province key, e.g. antalya", "see dictionaries.geo"],
      ["ilce", "district keys, comma-separated", "see dictionaries.geo"],
      ["rooms", "1+1,2+1,3+1…", "several comma-separated; empty for land"],
      ["price_min, price_max", "number", "in the listing’s currency (usually ₺)"],
      ["status", "active (default), reserved, sold, off, all", "whether to include reserved/sold"],
      ["updated_since", "ISO date, e.g. 2026-10-01T00:00:00Z", "only items changed after the date — for incremental sync"],
      ["realtor", "realtor uuid", "agency key only: listings of one employee"],
      ["limit, offset", "limit ≤ 500 (default 100), offset from 0", "pagination; total in the response — overall count"]],
    r_h: "3. Response format", r_code: JSON_SAMPLE({ id: "human-readable number", rooms: "null for land", price: "price in the listing’s currency", area: "for land gross = net = plot area", photos: "public URLs, can be displayed directly", features: "keys — labels in /api/v1/dictionaries", url: "public OnePlan preview card" }),
    r_p: "Texts always come in three languages. If the realtor wrote in one language, the other two are AI-translated — those languages are listed in `machine_translated`; you may label them “automatic translation”. Photos are served at their original size (up to 1600 px on the long side).",
    x_h: "4. XML feed", x_code: XML_SAMPLE,
    d_h: "5. Dictionaries", d_p: "`GET /api/v1/dictionaries?key=…` returns labels for every code in RU/EN/TR and the geography:", d_code: DICT_SAMPLE({ note: "keys match the listings" }),
    e_h: "6. Code examples", e_curl: CURL, e_php_h: "PHP (WordPress, Laravel, etc.) — on the website server", e_php: PHP("keep the key in server settings, not in code"), e_node_h: "Node.js / Next.js — on the server", e_node: NODE,
    e_inc_h: "Incremental updates", e_inc: "Every 5–15 minutes request `?updated_since=<time of the previous request>&status=all` — you receive changed, sold and withdrawn listings; use `status` to delete or mark them on your side. Do a full reload (without updated_since) once a day.",
    l_h: "7. Limits and errors", l_head: ["Code", "Meaning"], l_rows: [["401 invalid_key", "no key, key revoked, realtor or agency blocked"], ["404 not_found", "listing not found or belongs to another realtor"], ["429", "too frequent: keep to at most 1 request per second per key"], ["5xx", "temporary error — retry in a minute"]],
    l_p: "CORS is open (`Access-Control-Allow-Origin: *`), but because of the key call the API from your server. A response with limit=500 is up to ~2 MB. Photos live in OnePlan storage and are available without a key; you don’t have to download them.",
    u_h: "8. What you may do with the data", u_p: "Show it on the realtor’s or agency’s own website, in your own apps and presentations. Not allowed: passing the feed to third parties, publishing the key, presenting another agency’s listings as your own. The realtor’s phone and name in the response are for displaying contacts on your website.",
    c_h: "9. Leads from your website → OnePlan CRM",
    c_p: "A form on your website (“Request a call”, “Ask the price”, “Book a viewing”) can send leads straight into your CRM: the client appears in the list with the “New” status, contacts are encrypted and you get a notification. Works with any website: WordPress, Tilda, Wix (via a server script), custom code.",
    c_tok_h: "Token", c_tok: "CRM → Settings → Sources → add a source of the “Website” kind (e.g. “Agency website”) → “Create token”. The token looks like `ops_…` and is shown once — copy it; OnePlan stores only its hash. Lost it — “Re-issue”, the old one stops working. Keep the token on the website server (environment variable, CMS settings), never in page JavaScript: any visitor would see it there.",
    c_req_h: "Request", c_req: INBOUND_REQ("Looking for a 2+1 in Konyaaltı up to 8M ₺", "EN"),
    c_f_head: ["Field", "Required", "Notes"], c_f_rows: [["name", "one of the three", "client name, up to 200 characters"], ["phone", "one of the three", "any format, up to 40 characters; normalised for duplicate search"], ["email", "one of the three", "up to 120 characters"], ["message", "no", "lead text, up to 4000 characters — goes to the client’s timeline"], ["lang", "no", "RU, EN or TR — client language (default RU)"]],
    c_resp_h: "Responses", c_resp_head: ["Code", "Meaning"], c_resp_rows: [["200 {ok:true, clientId, duplicate}", "lead accepted; duplicate=true — a client with this phone/e-mail already exists, the lead is attached to them"], ["400 empty / json", "neither name, phone nor e-mail given, or the body is not JSON"], ["401 token", "no token, token re-issued or source disabled"], ["409 crm-not-initialized", "the owner has never opened the CRM — open it once"]],
    c_does_h: "What OnePlan does", c_does: "Looks the client up by phone and e-mail (hash comparison — the number is never stored in clear text). Found — adds the lead to the existing client’s timeline marked “duplicate”, the owner stays. Not found — creates a client with the “New” status and the source from the token. Contacts, text and the raw lead are encrypted with your workspace key (AES-256-GCM). A notification with a link to the card arrives in the bell.",
    c_ex_h: "Examples", c_ex: INBOUND_EX({ node: "form handler on the server", php: "form hook" }),
    c_builders: "Tilda, Wix and other builders: use their form webhook pointed at a small server script (PHP/Node) that adds the token header and forwards the lead — builders cannot attach a secret header themselves.",
    po_h: "Listing portals", po_p: "Sahibinden does not accept listings from external systems: posting there is manual only in the portal’s own account (its API, mandated by the Turkish Competition Board, exports corporate stores’ listings out to competing platforms, not in). Hepsiemlak and Emlakjet enable exports for partner programs under an agreement with the portal — our feed is ready for that; activation is possible after such an agreement is signed. Do not promise clients “automatic publishing on Sahibinden”.",
    f_h: "10. Roadmap", f_p1: "Webhooks (an event to your URL on listing creation, price or status change) — on request to support: ", f_link: "write to us", f_p2: ". API version: v1 (16 Oct 2026). Breaking changes will ship as v2; v1 keeps working.",
  },
  TR: {
    langName: "Türkçe",
    title: "İlanların sitenize aktarımı ve siteden CRM’ye talepler",
    intro: `Emlakçı veya ofis sitesinin geliştiricisi için teknik şartname. 1–8. bölümler ilanların siteye aktarımı, 9. bölüm siteden gelen taleplerin CRM’ye alınması. OnePlan ilanlarınızı JSON (REST API) ve XML akışı olarak verir. Veriler panelde yapılan değişiklikten hemen sonra güncellenir; yanıtlar 5 dakika (akış 15 dakika) önbelleklenir. Tüm adresler \`${SITE}\` ile başlar.`,
    k_h: "1. Erişim anahtarı", k_p1: "Anahtar OnePlan panelinde → «API ve aktarım» bölümünde verilir. İki türü vardır:",
    k_head: ["Anahtar", "Ne döndürür", "Kim oluşturur"], k_rows: [["opl_live_…", "tek emlakçının ilanları", "emlakçının kendisi"], ["opl_agency_…", "ofisin tüm emlakçılarının ilanları (her ilanda emlakçının adı ve telefonu)", "ofis yöneticisi"]],
    k_p2: "Anahtar `?key=…` parametresiyle veya `Authorization: Bearer …` başlığıyla gönderilir. Anahtar yalnızca kendi ilanlarınızı okuma yetkisi verir, veritabanının geri kalanına erişim sağlamaz. Anahtarı sitenin ön yüz koduna (tarayıcıdaki JavaScript) koymayın — API’yi kendi sunucunuzdan çağırın. Anahtar sızarsa panelden yeniden üretin: eskisi hemen devre dışı kalır.",
    m_h: "2. Uç noktalar", m_head: ["Uç nokta", "Açıklama"], m_rows: [
      ["GET /api/v1/listings", "Filtreli ve sayfalı ilan listesi (varsayılan olarak yalnızca aktif ilanlar)"],
      ["GET /api/v1/listings/{uuid}", "Tek ilan (herhangi bir durumda) — uuid veya OP-100001 numarasıyla"],
      ["GET /api/v1/dictionaries", "Sözlükler: tüm kodların RU/EN/TR etiketleri, coğrafya (il → ilçe → mahalle), oda tipleri, para birimleri"],
      ["GET /feed/{key}.xml", "Tüm aktif ilanların XML akışı — CMS tabanlı siteler ve toplayıcılar için"]],
    m_params: "/api/v1/listings parametreleri", p_head: ["Parametre", "Değerler", "Açıklama"], p_rows: [
      ["deal", "sale, rent, daily, transfer", "işlem türü; virgülle birden çok"],
      ["type", "flat, house, comm, land, other", "mülk türü; virgülle birden çok"],
      ["il", "il anahtarı, örn. antalya", "bkz. dictionaries.geo"],
      ["ilce", "virgülle ilçe anahtarları", "bkz. dictionaries.geo"],
      ["rooms", "1+1,2+1,3+1…", "virgülle birden çok; arsalarda boş"],
      ["price_min, price_max", "sayı", "ilanın para biriminde (genellikle ₺)"],
      ["status", "active (varsayılan), reserved, sold, off, all", "rezerve/satılmış ilanlar gösterilsin mi"],
      ["updated_since", "ISO tarih, örn. 2026-10-01T00:00:00Z", "yalnızca bu tarihten sonra değişenler — artımlı senkronizasyon için"],
      ["realtor", "emlakçı uuid", "yalnızca ofis anahtarı için: tek çalışanın ilanları"],
      ["limit, offset", "limit ≤ 500 (varsayılan 100), offset 0’dan", "sayfalama; yanıttaki total — toplam ilan sayısı"]],
    r_h: "3. Yanıt biçimi", r_code: JSON_SAMPLE({ id: "insanlar için numara", rooms: "arsalarda null", price: "ilanın para biriminde fiyat", area: "arsalarda gross = net = arsa alanı", photos: "herkese açık URL’ler, doğrudan gösterilebilir", features: "anahtarlar — etiketler /api/v1/dictionaries içinde", url: "OnePlan herkese açık önizleme kartı" }),
    r_p: "Metinler her zaman üç dilde gelir. Emlakçı tek dilde yazdıysa diğer ikisi yapay zekâ ile çevrilir — bu diller `machine_translated` alanında listelenir, «otomatik çeviri» etiketi koyabilirsiniz. Fotoğraflar özgün boyutta verilir (uzun kenar en fazla 1600 px).",
    x_h: "4. XML akışı", x_code: XML_SAMPLE,
    d_h: "5. Sözlükler", d_p: "`GET /api/v1/dictionaries?key=…` tüm kodların RU/EN/TR etiketlerini ve coğrafyayı döndürür:", d_code: DICT_SAMPLE({ note: "anahtarlar ilanlardakiyle aynı" }),
    e_h: "6. Kod örnekleri", e_curl: CURL, e_php_h: "PHP (WordPress, Laravel vb.) — site sunucusunda", e_php: PHP("anahtarı kodda değil sunucu ayarlarında tutun"), e_node_h: "Node.js / Next.js — sunucuda", e_node: NODE,
    e_inc_h: "Artımlı güncelleme", e_inc: "Her 5–15 dakikada `?updated_since=<önceki isteğin zamanı>&status=all` isteyin — değişen, satılan ve kaldırılan ilanlar gelir; `status` değerine göre kendi tarafınızda silin veya işaretleyin. Tam yeniden yüklemeyi (updated_since olmadan) günde bir yapın.",
    l_h: "7. Sınırlar ve hatalar", l_head: ["Kod", "Anlamı"], l_rows: [["401 invalid_key", "anahtar yok, iptal edilmiş, emlakçı veya ofis engellenmiş"], ["404 not_found", "ilan bulunamadı veya başka bir emlakçıya ait"], ["429", "çok sık: anahtar başına saniyede en fazla 1 istek"], ["5xx", "geçici hata — bir dakika sonra yeniden deneyin"]],
    l_p: "CORS açıktır (`Access-Control-Allow-Origin: *`), ancak anahtar nedeniyle API’yi kendi sunucunuzdan çağırın. limit=500 ile yanıt ~2 MB’a kadar olabilir. Fotoğraflar OnePlan depolamasındadır ve anahtarsız erişilir; kendinize indirmeniz gerekmez.",
    u_h: "8. Verilerle neler yapılabilir", u_p: "Emlakçının veya ofisin kendi sitesinde, kendi uygulama ve sunumlarında gösterilebilir. Yapılamaz: akışı üçüncü taraflara vermek, anahtarı herkese açık yayınlamak, başka bir ofisin ilanlarını kendi ilanınız gibi sunmak. Yanıttaki emlakçı adı ve telefonu sitenizde iletişim bilgisi göstermek içindir.",
    c_h: "9. Sitenizden gelen talepler → OnePlan CRM",
    c_p: "Sitenizdeki form («Talep bırak», «Fiyat sor», «Gösterim randevusu») talepleri doğrudan CRM’nize gönderebilir: müşteri listede «Yeni» durumuyla belirir, kişiler şifrelenir ve size bildirim gelir. Her siteyle çalışır: WordPress, Tilda, Wix (sunucu betiği üzerinden), özel kod.",
    c_tok_h: "Token", c_tok: "CRM → Ayarlar → Kaynaklar → «Site» türünde kaynak ekleyin (örn. «Ofis sitesi») → «Token oluştur». `ops_…` biçimindeki token bir kez gösterilir — kopyalayın; OnePlan yalnızca hash’ini saklar. Kaybolursa «Yeniden üret», eskisi çalışmaz. Token’ı site sunucusunda tutun (ortam değişkeni, CMS ayarları), sayfa JavaScript’inde değil: orada her ziyaretçi görebilir.",
    c_req_h: "İstek", c_req: INBOUND_REQ("Konyaaltı’nda 8 milyon ₺’ye kadar 2+1 arıyorum", "TR"),
    c_f_head: ["Alan", "Zorunlu", "Açıklama"], c_f_rows: [["name", "üçünden biri", "müşteri adı, en fazla 200 karakter"], ["phone", "üçünden biri", "herhangi bir biçim, en fazla 40 karakter; tekrar araması için normalleştirilir"], ["email", "üçünden biri", "en fazla 120 karakter"], ["message", "hayır", "talep metni, en fazla 4000 karakter — müşterinin akışına düşer"], ["lang", "hayır", "RU, EN veya TR — müşterinin dili (varsayılan RU)"]],
    c_resp_h: "Yanıtlar", c_resp_head: ["Kod", "Anlamı"], c_resp_rows: [["200 {ok:true, clientId, duplicate}", "talep alındı; duplicate=true — bu telefon/e-posta ile müşteri zaten var, talep ona bağlandı"], ["400 empty / json", "ad, telefon ve e-posta hiçbiri yok ya da gövde JSON değil"], ["401 token", "token yok, yeniden üretilmiş veya kaynak kapalı"], ["409 crm-not-initialized", "sahibi CRM’yi hiç açmamış — bir kez açın"]],
    c_does_h: "OnePlan ne yapar", c_does: "Müşteriyi telefon ve e-posta ile arar (hash karşılaştırması — numara açık saklanmaz). Bulursa talebi mevcut müşterinin akışına «tekrar» işaretiyle ekler, sorumlu değişmez. Bulamazsa «Yeni» durumunda ve token’daki kaynakla müşteri oluşturur. Kişiler, metin ve ham talep çalışma alanınızın anahtarıyla şifrelenir (AES-256-GCM). Zile, karta bağlantı içeren bildirim gelir.",
    c_ex_h: "Örnekler", c_ex: INBOUND_EX({ node: "sunucudaki form işleyici", php: "form kancası" }),
    c_builders: "Tilda, Wix ve diğer site kurucular: formun webhook’unu, token başlığını ekleyip talebi ileten küçük bir sunucu betiğine (PHP/Node) yönlendirin — kurucular gizli başlığı kendileri ekleyemez.",
    po_h: "İlan portalları", po_p: "Sahibinden dış sistemlerden ilan kabul etmez: orada ilan yalnızca portalın kendi panelinden elle verilir (Rekabet Kurulu kararıyla açılan API’si kurumsal mağazaların ilanlarını rakip platformlara dışarı aktarır, içeri almaz). Hepsiemlak ve Emlakjet aktarımı yalnızca portalla sözleşme yapan iş ortağı programlarına açar — akışımız buna hazırdır; etkinleştirme böyle bir sözleşme imzalandıktan sonra mümkündür. Müşterilere «Sahibinden’de otomatik yayın» vaat etmeyin.",
    f_h: "10. Yol haritası", f_p1: "Webhook’lar (ilan oluşturma, fiyat veya durum değişikliğinde URL’nize olay) — destekten istek üzerine: ", f_link: "yazın", f_p2: ". API sürümü: v1 (16.10.2026). Uyumluluğu bozan değişiklikler v2 olarak çıkar; v1 çalışmaya devam eder.",
  },
};
const LANG_OF = (v: string | undefined): Lang | null => (v ? ({ ru: "RU", en: "EN", tr: "TR" } as Record<string, Lang>)[v.toLowerCase()] ?? null : null);

export default async function ApiDocsPage({ searchParams }: { searchParams: Promise<{ lang?: string }> }) {
  const sp = await searchParams;
  const lang: Lang = LANG_OF(sp.lang) ?? LANG_OF((await cookies()).get(LANG_COOKIE)?.value) ?? "RU";
  const d = DOCS[lang];
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[900px] px-5 py-10">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <LogoMark size={28} /><span className="text-[19px] font-extrabold text-ink">OnePlan</span><span className="rounded-[8px] bg-blue-tint px-2 py-[2px] text-[11px] font-bold uppercase tracking-[.05em] text-blue">API v1</span>
          <span className="ml-auto flex gap-1 rounded-[9px] bg-bg-2 p-[3px]">
            {(["RU", "EN", "TR"] as Lang[]).map((l) => <Link key={l} href={`/api/docs?lang=${l.toLowerCase()}`} className={`rounded-[7px] px-[10px] py-[5px] text-[11.5px] font-bold ${l === lang ? "bg-surface text-ink shadow-[0_1px_3px_rgba(20,36,63,.12)]" : "text-muted hover:bg-line-2"}`}>{l}</Link>)}
          </span>
        </div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ink">{d.title}</h1>
        <P>{d.intro}</P>

        <h2 className={h2}>{d.k_h}</h2>
        <P>{d.k_p1}</P>
        <Tbl head={d.k_head} rows={d.k_rows} />
        <P>{d.k_p2}</P>

        <h2 className={h2}>{d.m_h}</h2>
        <Tbl head={d.m_head} rows={d.m_rows} />
        <h3 className={h3}>{d.m_params}</h3>
        <Tbl head={d.p_head} rows={d.p_rows} />

        <h2 className={h2}>{d.r_h}</h2>
        <pre className={pre}>{d.r_code}</pre>
        <P>{d.r_p}</P>

        <h2 className={h2}>{d.x_h}</h2>
        <pre className={pre}>{d.x_code}</pre>

        <h2 className={h2}>{d.d_h}</h2>
        <P>{d.d_p}</P>
        <pre className={pre}>{d.d_code}</pre>

        <h2 className={h2}>{d.e_h}</h2>
        <h3 className={h3}>curl</h3>
        <pre className={pre}>{d.e_curl}</pre>
        <h3 className={h3}>{d.e_php_h}</h3>
        <pre className={pre}>{d.e_php}</pre>
        <h3 className={h3}>{d.e_node_h}</h3>
        <pre className={pre}>{d.e_node}</pre>
        <h3 className={h3}>{d.e_inc_h}</h3>
        <P>{d.e_inc}</P>

        <h2 className={h2}>{d.l_h}</h2>
        <Tbl head={d.l_head} rows={d.l_rows} />
        <P>{d.l_p}</P>

        <h2 className={h2}>{d.u_h}</h2>
        <P>{d.u_p}</P>

        <h2 id="crm-inbound" className={h2}>{d.c_h}</h2>
        <P>{d.c_p}</P>
        <h3 className={h3}>{d.c_tok_h}</h3>
        <P>{d.c_tok}</P>
        <h3 className={h3}>{d.c_req_h}</h3>
        <pre className={pre}>{d.c_req}</pre>
        <Tbl head={d.c_f_head} rows={d.c_f_rows} />
        <h3 className={h3}>{d.c_resp_h}</h3>
        <Tbl head={d.c_resp_head} rows={d.c_resp_rows} />
        <h3 className={h3}>{d.c_does_h}</h3>
        <P>{d.c_does}</P>
        <h3 className={h3}>{d.c_ex_h}</h3>
        <pre className={pre}>{d.c_ex}</pre>
        <P>{d.c_builders}</P>

        <h3 className={h3}>{d.po_h}</h3>
        <P>{d.po_p}</P>

        <h2 className={h2}>{d.f_h}</h2>
        <p className={p}>{d.f_p1}<Link href="/chat?with=sup" className="font-semibold text-blue hover:underline">{d.f_link}</Link>{d.f_p2}</p>
      </div>
    </div>
  );
}
