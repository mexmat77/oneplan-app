import Link from "next/link";
import { LogoMark } from "@/components/Logo";

// Публичная документация API выгрузки объявлений (16.10.2026) — для разработчиков сайтов агентств и риэлторов.
// Открыта без входа (proxy: /api/docs). Текст — ТЗ, которое риэлтор/агентство отдаёт своему разработчику.
export const metadata = { title: "OnePlan API — выгрузка объявлений на сайт", robots: { index: false } };

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

export default function ApiDocsPage() {
  return (
    <div className="min-h-screen bg-bg">
      <div className="mx-auto max-w-[900px] px-5 py-10">
        <div className="mb-6 flex items-center gap-3"><LogoMark size={28} /><span className="text-[19px] font-extrabold text-ink">OnePlan</span><span className="rounded-[8px] bg-blue-tint px-2 py-[2px] text-[11px] font-bold uppercase tracking-[.05em] text-blue">API v1</span></div>
        <h1 className="text-[28px] font-extrabold tracking-[-0.02em] text-ink">Выгрузка объявлений на ваш сайт</h1>
        <p className={p}>Техническое задание для разработчика сайта риэлтора или агентства. OnePlan отдаёт ваши объявления в формате JSON (REST API) и XML-фид. Данные обновляются сразу после изменения в кабинете, ответы кэшируются на 5 минут (фид — 15 минут). Все адреса — <span className={code}>{SITE}</span>.</p>

        <h2 className={h2}>1. Ключ доступа</h2>
        <p className={p}>Ключ выдаётся в кабинете OnePlan → «API и выгрузка». Есть два вида:</p>
        <Tbl head={["Ключ", "Что отдаёт", "Кто создаёт"]} rows={[["opl_live_…", "объявления одного риэлтора", "сам риэлтор"], ["opl_agency_…", "объявления всех риэлторов агентства (с именем и телефоном риэлтора в каждом объекте)", "администратор агентства"]]} />
        <p className={p}>Ключ передаётся параметром <span className={code}>?key=…</span> или заголовком <span className={code}>Authorization: Bearer …</span>. Ключ открывает только чтение ваших объявлений и не даёт доступа к остальной базе. Не вставляйте его во фронтенд-код сайта (JavaScript в браузере) — запрашивайте API со своего сервера. Если ключ утёк, перевыпустите его в кабинете: старый перестаёт работать сразу.</p>

        <h2 className={h2}>2. Методы</h2>
        <Tbl head={["Метод", "Описание"]} rows={[
          ["GET /api/v1/listings", "Список объявлений с фильтрами и постраничной выдачей (по умолчанию только активные)"],
          ["GET /api/v1/listings/{uuid}", "Одно объявление (любого статуса) по uuid или номеру OP-100001"],
          ["GET /api/v1/dictionaries", "Справочники: подписи значений на RU/EN/TR, география (il → ilçe → mahalle), список комнат, валюты"],
          ["GET /feed/{key}.xml", "XML-фид всех активных объявлений — для сайтов на CMS и агрегаторов"],
        ]} />

        <h3 className={h3}>Параметры /api/v1/listings</h3>
        <Tbl head={["Параметр", "Значения", "Пояснение"]} rows={[
          ["deal", "sale, rent, daily, transfer", "тип сделки; несколько через запятую"],
          ["type", "flat, house, comm, land, other", "тип объекта; несколько через запятую"],
          ["il", "ключ провинции, напр. antalya", "см. dictionaries.geo"],
          ["ilce", "ключи районов через запятую", "см. dictionaries.geo"],
          ["rooms", "1+1,2+1,3+1…", "несколько через запятую; у участков пусто"],
          ["price_min, price_max", "число", "в валюте объявления (обычно ₺)"],
          ["status", "active (по умолчанию), reserved, sold, off, all", "показывать ли резерв/проданные"],
          ["updated_since", "ISO-дата, напр. 2026-10-01T00:00:00Z", "только изменённые после даты — для инкрементальной синхронизации"],
          ["realtor", "uuid риэлтора", "только для ключа агентства: объявления одного сотрудника"],
          ["limit, offset", "limit ≤ 500 (по умолчанию 100), offset от 0", "страницы; в ответе total — всего объявлений"],
        ]} />

        <h2 className={h2}>3. Формат ответа</h2>
        <pre className={pre}>{`GET ${SITE}/api/v1/listings?key=opl_live_…&deal=sale&limit=2

{
  "total": 12, "count": 2, "limit": 2, "offset": 0,
  "scope": "realtor", "name": "Иван Петров", "agency": "ONETEAM",
  "generated_at": "2026-10-16T09:00:00.000Z",
  "items": [
    {
      "id": "OP-100003",                      // номер для людей
      "uuid": "e5dd730c-b50d-4c28-8359-30fa1ca8313c",
      "status": "active",                     // active | reserved | sold | off
      "deal": "sale",                         // sale | rent | daily | transfer
      "type": "land",                         // flat | house | comm | land | other
      "rooms": null,                          // "2+1" … ; null у участков
      "price": 13200000, "currency": "TRY",   // TRY | EUR | USD — цена в валюте объявления
      "badge": "excl",                        // excl | new | hot | drop | null
      "title": { "RU": "…", "EN": "…", "TR": "…" },
      "description": { "RU": "…", "EN": "…", "TR": "…" },
      "original_lang": "RU", "machine_translated": ["EN", "TR"],
      "location": { "il": "antalya", "il_name": "Antalya", "ilce": "muratpasa", "ilce_name": "Muratpaşa",
                    "mahalle": "ermenek", "mahalle_name": "Ermenek", "lat": 36.87, "lng": 30.77, "sea_distance_m": 1200 },
      "area": { "gross": 470, "net": 421 },   // м²; у участков gross = net = площадь участка
      "floor": 3, "floors_total": 5,
      "building": { "age_years": 5, "heating": ["ac"], "bathrooms": 2, "balcony": true, "lift": true, "gas": false,
                    "in_complex": true, "aidat_monthly": 1500 },
      "terms": { "furnished": true, "citizenship_eligible": false, "residence_permit_eligible": true,
                 "mortgage": true, "exchange": false, "owned_5y": false, "deposit": null, "commission": 2 },
      "photos": ["https://…/1.jpg", "https://…/2.jpg"],   // публичные URL, можно показывать напрямую
      "cover": "https://…/1.jpg",
      "features": ["pool", "opark", "sea"],   // ключи — подписи в /api/v1/dictionaries
      "price_history": [{ "date": "10.10.2026", "price": 13350000 }],
      "realtor": { "id": "…", "name": "Иван Петров", "phone": "+90 5…", "email": "…" },
      "url": "${SITE}/share/obj/e5dd730c-…",  // публичная карточка-превью OnePlan
      "created_at": "2026-10-10T19:04:51Z", "updated_at": "2026-10-13T13:25:15Z"
    }
  ]
}`}</pre>
        <p className={p}>Тексты всегда приходят на трёх языках. Если риэлтор писал на одном языке, остальные два переведены ИИ — такие языки перечислены в <span className={code}>machine_translated</span>, можно подписать «перевод автоматический». Фото отдаются в исходном размере (до 1600 px по длинной стороне).</p>

        <h2 className={h2}>4. XML-фид</h2>
        <pre className={pre}>{`GET ${SITE}/feed/opl_agency_….xml

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
    <realtor id="…">Иван Петров</realtor>
    <url>${SITE}/share/obj/e5dd730c-…</url><created_at>…</created_at><updated_at>…</updated_at>
  </listing>
</listings>`}</pre>

        <h2 className={h2}>5. Справочники</h2>
        <p className={p}><span className={code}>GET /api/v1/dictionaries?key=…</span> возвращает подписи для всех кодов на RU/EN/TR и географию:</p>
        <pre className={pre}>{`{
  "deal": { "sale": { "RU": "Продать", "EN": "Sell", "TR": "Satılık" }, … },
  "type": { "flat": { "RU": "Квартира", … }, … },
  "status": { "active": { "RU": "Активен", … }, … },
  "features": { "pool": { "RU": "Бассейн", … }, … },
  "heating": { … }, "badge": { … },
  "geo": [ { "key": "antalya", "name": "Antalya", "ilce": [ { "key": "muratpasa", "name": "Muratpaşa", "mahalle": [ { "key": "lara", "name": "Lara" } ] } ] } ],
  "rooms": ["1+0", "1+1", "2+1", …], "currencies": ["TRY", "EUR", "USD"]
}`}</pre>

        <h2 className={h2}>6. Примеры кода</h2>
        <h3 className={h3}>curl</h3>
        <pre className={pre}>{`curl -H "Authorization: Bearer opl_live_…" "${SITE}/api/v1/listings?deal=sale&type=flat&limit=50"`}</pre>
        <h3 className={h3}>PHP (WordPress, Laravel и т. п.) — на сервере сайта</h3>
        <pre className={pre}>{`$key = getenv('ONEPLAN_KEY'); // ключ храните в настройках сервера, не в коде
$json = file_get_contents("${SITE}/api/v1/listings?key=$key&limit=500");
$data = json_decode($json, true);
foreach ($data['items'] as $o) {
  echo '<a href="/objects/' . $o['id'] . '"><img src="' . $o['cover'] . '"> ' . $o['title']['RU'] . ' — ' . number_format($o['price'], 0, '', ' ') . ' ₺</a>';
}`}</pre>
        <h3 className={h3}>Node.js / Next.js — на сервере</h3>
        <pre className={pre}>{`const r = await fetch("${SITE}/api/v1/listings?limit=500", { headers: { Authorization: \`Bearer \${process.env.ONEPLAN_KEY}\` }, next: { revalidate: 300 } });
const { items } = await r.json();`}</pre>
        <h3 className={h3}>Инкрементальное обновление</h3>
        <p className={p}>Раз в 5–15 минут запрашивайте <span className={code}>?updated_since=&lt;время прошлого запроса&gt;&amp;status=all</span> — придут изменённые, проданные и снятые объявления; по <span className={code}>status</span> удаляйте или помечайте их у себя. Полную перезагрузку (без updated_since) делайте раз в сутки.</p>

        <h2 className={h2}>7. Ограничения и ошибки</h2>
        <Tbl head={["Код", "Значение"]} rows={[["401 invalid_key", "ключа нет, он отозван, риэлтор или агентство заблокированы"], ["404 not_found", "объявление не найдено или принадлежит другому риэлтору"], ["429", "слишком часто: держите не более 1 запроса в секунду с одного ключа"], ["5xx", "временная ошибка — повторите через минуту"]]} />
        <p className={p}>CORS открыт (<span className={code}>Access-Control-Allow-Origin: *</span>), но из-за ключа запрашивайте API со своего сервера. Объём ответа при limit=500 — до ~2 МБ. Фото лежат в хранилище OnePlan и доступны без ключа; скачивать их к себе не обязательно.</p>

        <h2 className={h2}>8. Что можно делать с данными</h2>
        <p className={p}>Показывать на собственном сайте риэлтора или агентства, в своих приложениях и презентациях. Нельзя: передавать фид третьим лицам, выкладывать ключ публично, выдавать объявления другого агентства за свои. Телефон и имя риэлтора в ответе — для вывода контактов на вашем сайте.</p>

        <h2 className={h2}>9. Планы</h2>
        <p className={p}>Вебхуки (событие на ваш URL при создании объявления, смене цены или статуса) — по запросу в поддержку: <Link href="/chat?with=sup" className="font-semibold text-blue hover:underline">написать</Link>. Версия API: v1 (16.10.2026). Изменения, ломающие совместимость, выйдут как v2; v1 продолжит работать.</p>
      </div>
    </div>
  );
}
