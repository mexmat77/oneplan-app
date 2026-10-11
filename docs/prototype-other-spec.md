# Спецификация прочих прототипов One-Plan (лендинг, кабинет, мобильное приложение, цвета, ТЗ-print)

Источник: папка `One-Plan приложение/`. Все номера строк — из соответствующего `.dc.html`-файла. Документ дополняет `docs/prototype-realtors-spec.md` (кабинет риэлторов) и предназначен для пиксельно точной пересборки на Next.js.

## 0. Общие соглашения прототипов

Все файлы — шаблоны рантайма `support.js` (`<x-dc>` + `class Component extends DCLogic`):

| Конструкция | Смысл | Аналог в React/Next |
|---|---|---|
| `{{ expr }}` | привязка к значению из `renderVals()` | JSX-выражение |
| `<sc-if value="{{ flag }}">` | условный рендер (`hint-placeholder-val` — только для превью-редактора, игнорировать) | `{flag && …}` |
| `<sc-for list="{{ arr }}" as="x">` | цикл (`hint-placeholder-count` — игнорировать) | `arr.map(x => …)` |
| `onClick="{{ fn }}"`, `onChange`, `onInput`, `onKeyDown`, `onTouchStart/Move/End` | обработчики | те же пропсы |
| `style-hover="…"`, `style-focus="…"` | псевдосостояния, задаваемые инлайн | CSS-модуль / Tailwind `hover:` |
| `<script type="text/x-dc" data-props="…">` | пропсы компонента с редакторами (enum/boolean/color) — «ручки» превью, в проде это либо константы, либо настройки | props/config |
| `renderVals()` | единственное место, где считаются все производные значения и стили; `state` — плоский объект | хуки/селекторы |

Стили — почти всегда инлайновые, поэтому значения ниже указаны как есть (px, цвета, тени). Иконки — Tabler Icons webfont (`<i class="ti ti-…">`); в Next использовать `@tabler/icons-react` с теми же именами.

Файлы вне области этого документа: `OnePlan v2.dc.html` (актуальный кабинет застройщика, описан в `OnePlan ТЗ.dc.html`), `OnePlan Риэлторы.dc.html` (см. `prototype-realtors-spec.md`), `OnePlan Риэлторы (офлайн).html` (6,4 МБ — самодостаточная офлайн-сборка того же риэлторского прототипа с инлайн-ассетами), `export/oneplan-realtors.dc.html`, `handoff/` (дубликаты для передачи). `support.js`, `image-slot.js`, `doc-page.js`, `*-frame.jsx` — рантайм превью, в продакшн не переносятся.

---

## A. `OnePlan Главная.dc.html` — маркетинговый лендинг one-plan.pro

Размер 96,7 КБ, 632 строки. Есть README: `design_handoff_landing/README.md` (проверен по разметке; единственное расхождение — копия в `design_handoff_landing/` **старее**: в ней нет строк 415–419 (подпись про мобильное приложение и кнопки App Store / Google Play) и ключа `app_note` в i18n).

### A.1. Назначение

Один лендинг для двух независимых продуктов (у них нет общей базы): **Риэлторам** (закрытая база вторички, комьюнити) и **Застройщикам** (управление продажами новостройки: шахматка, документы, витрина). Переключатель аудитории перестраивает весь контент страницы и акцентный цвет (золото ↔ синий). Три языка RU/EN/TR.

### A.2. Подключения и глобальные стили (строки 10–27)

- Google Fonts: `Manrope` 500/600/700/800 (заголовки, кнопки), `PT Sans` 400/700 (текст, инпуты) — строка 12.
- Tabler Icons webfont **3.1.0** — строка 13 (в остальных файлах 3.19.0).
- Reset `*{box-sizing:border-box;margin:0;padding:0}`; `body` — PT Sans, `#fff`, цвет `#14243f`; `a` `#4d7cfe` / hover `#3a63d4`; `::selection` `rgba(77,124,254,.2)`.
- Keyframes (22–25): `opCell` (opacity 0→1, scale .4→1), `opRise` (opacity 0→1, translateY 8px→0), `opBlink` (0/80/100 % → .25, 40 % → 1), `opPulse` (box-shadow 0 0 0 0 rgba(240,173,0,.5) → 0 0 0 8px прозрачный).

### A.3. Структура страницы (сверху вниз) — фактический порядок в разметке

| Строки | Секция |
|---|---|
| 29 | Корневой `div`: `min-height:100vh; background:#fff; overflow-x:hidden` |
| 31–36 | **Header** (sticky, top 0, z 30): `rgba(255,255,255,.92)`, `backdrop-filter:blur(14px)`, `border-bottom:1px solid #eef1f6`, высота 62px, `padding:0 clamp(16px,5vw,48px)`, gap 12px. Логотип (32): 4 круга 11px `#4d7cfe #43a047 #f0ad00 #e5484d` с `margin-left:-4px` + текст «OnePlan» 19px/800 `#14243f`, gap 9px. Спейсер. Переключатель языков (34): контейнер `#f0f2f6`, radius 9px, padding 3px, gap 3px; кнопка `font-size:12px;font-weight:700;padding:5px 10px;border-radius:7px;transition:all .15s`; активная `background:#fff;color:#14243f;box-shadow:0 1px 3px rgba(0,0,0,.12)`, неактивная `color:#8a93a2` (стили — строка 539). Кнопка «Войти» (35): 13px/700, radius 10, padding 9px 17px, `#14243f` фон и рамка, белый текст, hover `#0f1b30` → `gotoApp`. |
| 38–229 | **Hero + мок продукта**: 39 — фоновое свечение `glowStyle` (555): `position:absolute;top:-180px;left:50%;translateX(-50%);width:min(1100px,140vw);height:600px;radial-gradient(ellipse 50% 50% at 50% 50%, <tint>, transparent 70%)`, tint `rgba(201,163,91,.13)` (риэлторы) / `rgba(77,124,254,.12)` (застройщики), `transition:all .4s`. |
| 41–54 | Hero-текст: контейнер max-width 1000px, `padding:clamp(40px,6vw,72px) clamp(16px,5vw,48px) 0`, центр. Аптайтл (42) 12.5px/700, letter-spacing .14em, uppercase, `#8a93a2`, mb 18px → `t.umbrella`. Сегмент аудитории (43–46): контейнер `inline-flex;gap:5px;background:#f0f2f6;border:1px solid #e6e9f0;border-radius:14px;padding:5px;margin-bottom:28px`; кнопки `togBase` (544) `14px/700;radius 10;padding 11px 20px;gap 8px;transition all .15s`; активная риэлторы: `background:<gold>;color:#14243f;box-shadow:0 6px 18px rgba(201,163,91,.35)`; активная застройщики: `background:<blue>;color:#fff;box-shadow:0 6px 18px rgba(77,124,254,.3)`; неактивная `transparent;color:#6b7688`; иконки `ti-users-group` / `ti-building-skyscraper`. H1 (47): `clamp(30px,5.6vw,56px)/800;letter-spacing:-.035em;line-height:1.06;max-width:860px;margin:0 auto 18px;text-wrap:balance`; состоит из `p.t1 + <span hl> + p.t2`, `hlStyle` = `color:#9c7420` (риэлторы) или `<blue>`. Подзаголовок (48) `clamp(15px,2.2vw,19px);#5a6472;line-height:1.6;max-width:640px;mb 28px`. Кнопки (49–52): CTA `ctaStyle` (556): `15px/700;radius 12;padding 14px 28px;border none;background:<pa>;color:#14243f|#fff;gap 8px;box-shadow:0 10px 26px rgba(201,163,91,.35)|rgba(77,124,254,.3)`, hover `filter:brightness(1.05)`, иконка `ti-send` → `scrollToForm`; «Войти» белая `border:1px solid #d5dce6`, hover `#b8c2d2`, 15px/700, radius 12, padding 14px 26px → `gotoApp`. Бейдж (53) `13px/700;color:#0f9d6b;background:#e4f6ee;radius 100px;padding 6px 14px`, иконка `ti-gift` → `t.badge`. |
| 56–224 | **Окно-мок**: контейнер max-width 920px, `margin:clamp(36px,5vw,56px) auto 0`; рамка `1px solid #e6e9f0`, radius 16, `box-shadow:0 30px 70px rgba(20,36,63,.14)`. Тайтлбар (58): 40px, `#f0f2f6`, border-bottom `#e6e9f0`, три точки 11px `#e5484d #f0ad00 #43a047`, справа «one-plan.pro» 11px `#9aa4b5`. |
| 60–117 | Мок «Риэлторы» (`isR`): padding `clamp(16px,3vw,28px)`, column gap 12, `animation:opRise .35s`. Шапка (62–67): `t.m_base` 12px/700 uppercase ls .08em `#9c7420`; чип `t.m_closed` 10.5px/700 `#0f9d6b` на `#e4f6ee` radius 100 с `ti-lock`; кнопка `t.m_add` 11.5px/700 `#14243f` на `#e9d9ba`, radius 9, padding 7px 12px, `ti-plus`. Поиск (68): `#f4f6f9`, border `#e2e7ef`, radius 10, padding 10px 13px, 12.5px `#6b7688`, `ti-search` `#9aa4b5` → `t.m_query`. Карточки объектов (69–83): grid `repeat(auto-fit,minmax(240px,1fr))`, gap 9; карточка `border:1px solid #e6e9f0;radius 12;padding 10px 12px;animation opRise .3s` с задержкой `o.dl`; миниатюра 38px radius 9 с градиентом `o.thumbBg` и `ti-building` `rgba(20,36,63,.4)`; название 12.5px/700 Manrope; подпись 11px `#8a93a2`; цена 12.5px/800 Manrope; аватар агента 16px круг `o.agentBg` + инициалы 8.5px/800 + `t.m_write` 10.5px/700 `#9c7420`. **Анимированный диалог** (84–114), см. A.6. Футер (115): 11px `#8a93a2`, `ti-users` `#c9a35b` → `t.m_community`. |
| 119–222 | Мок «Застройщики» (`isD`): шапка (121–130): «MEGAPOLIS · B» 12px/700 Manrope; чип `t.m_selling` (зелёный как выше); вкладки (126–128) `tabBoardStyle/tabDocsStyle/tabPubStyle` (570): `10.5px/700;radius 7;padding 4px 10px;transition all .15s`; активная `color:#14243f;background:#e3ebfd`, неактивная `color:#8a93a2`. |
| 131–159 | Вкладка **Шахматка** (`devIsBoard`): 8 строк (133–140), слева номер этажа 16px 9.5px `#9aa4b5` right; сетка `grid-template-columns:repeat(14,1fr);gap:5px`; клетка — стиль `c.st` (519): `height:16px;border-radius:4px;background:<цвет статуса>;cursor:pointer;animation:opCell .3s ease both[,opPulse 1.5s ease infinite];animation-delay:<r*40+c*16>ms[,0ms];transition:transform .12s[;outline:2px solid #14243f;outline-offset:1px]`, hover `transform:scale(1.35)`. Панель выбранной клетки (142–149): `#f4f6f9`, border `#e2e7ef`, radius 10, padding 9px 13px: «№ {selNo}» 11px/800 Manrope, `selRooms`, `{selM2} m²`, `selPrice` 11px/800, справа чип статуса `selChip` (600): `10px/700;radius 100;padding 3px 9px;color:#fff;background:<цвет>`. Легенда (150–158): квадраты 8px radius 3: `#34c383` Свободно, `#f0ad00` Бронь, `#4d7cfe` Оформление, `#cfd6e0` Продано, `#8b5cf6` Резерв; справа `ti-bolt` `#4d7cfe` + `t.m_live`. |
| 160–179 | Вкладка **Документы** (`devIsDocs`): чипы-фильтры (162–167): активный `#14243f` на `#e3ebfd`, остальные `#8a93a2` на `#f0f2f6`, 10.5px/700 radius 100 padding 4px 11px (`t.m_doc_all/contracts/plans/site`). Список `docs` (168–177): строка `border #e6e9f0;radius 10;padding 9px 12px`; иконка 32px radius 8 `doc.bg`/`doc.c`; имя 12px/700; мета 10.5px `#8a93a2`; кнопка скачать 26px radius 8 `#f0f2f6` `ti-download`. |
| 180–220 | Вкладка **Витрина** (`devIsPub`): шапка проекта (182–189) `linear-gradient(135deg,#31435f,#1d2a42)`, radius 12, padding 14px 16px, белый: «MEGAPOLIS RESIDENCE» 15px/800 Manrope; «Antalya · Altıntaş · 406 {t.m_units}» 11px 70 %; чипы «TAPU» «VNJ» 10px/700 `rgba(255,255,255,.16)`. Карточки `pubCards` (190–213): grid `minmax(min(200px,100%),1fr)` gap 10; карточка radius 14, border `#e6e9f0`; фото `aspect-ratio:16/10` фон `#dfe6f0`, `object-fit:cover`; бейдж стадии `pc.stageStyle` (576): `absolute;top 8;left 8;8.5px/800;background <bg>;color #fff;radius 100;padding 3px 8px`; «LIVE» (196) `top 8;right 8;#e5484d` с мигающей точкой; «İskan ✓» (197) `left 8;bottom 8;#0f9d6b`. Тело: имя 12.5px/800 Manrope; `ti-map-pin` + локация 10px `#8a93a2`; чипы `ch.st` (575) `8.5px/700;radius 100;padding 2px 7px`; строка «{t.m_soldp} · {sold}» / «{onsale} {t.m_onsale}» 10px `#5a6472`; прогресс-бар 4px `#eef1f6` с заливкой `#4d7cfe` шириной `sold`; строка `t.m_ready` / `pc.ready` (`#0f9d6b` 800) + бар `#34c383`; футер 9.5px `#8a93a2` `border-top #f0f2f6`: `pc.builder` / `{units} {t.m_rooms_n}`. Ссылка (214–218): `#f4f6f9;border:1px dashed #c9d2e0;radius 10;padding 9px 13px`; `ti-link` `#4d7cfe`; «one-plan.pro/megapolis» 12.5px; `t.m_copy` 11px/700 `#4d7cfe`; кнопка WhatsApp 26px radius 8 `#25d366`. |
| 225–227 | **Полоса доверия**: `noteStyle` (557): `inline-flex;gap 9px;13px/700;color:<paText>;background:<paTint>;radius 100;padding 9px 18px;line-height 1.4;text-align left`, иконка `ti-shield-check` 16px → `p.note`. |
| 231–258 | **Возможности** (`#f6f8fb`, border-top/bottom `#eef1f6`, `margin-top:clamp(56px,8vw,104px)`), контейнер 1120px, `padding:clamp(44px,6vw,76px) clamp(16px,5vw,48px)`. Заголовок: eyebrow `eyebrowStyle` (558) `12.5px/700;ls .14em;uppercase;color <paText>;mb 14px` → `t.feat_eyebrow`; H2 `clamp(24px,4vw,36px)/800;ls -.025em;lh 1.1` → `p.feat_title`. Сетка 4 карточек (237–256): внешний grid `minmax(min(430px,100%),1fr)` gap 16, внутри два grid `minmax(min(200px,100%),1fr)` — раскладка 4 → 2×2 → 1 (никогда 3+1). Карточка: `#fff;border 1px #e6e9f0;radius 18;padding clamp(20px,2.6vw,26px);center;transition transform .18s, box-shadow .18s`; hover `translateY(-3px);box-shadow:0 14px 30px rgba(20,36,63,.09)`. Иконка `iconStyle` (547): 46px, radius 13, `background <paTint>;color <paText>;font-size 22px;mb 14px`. Заголовок 16.5px/800 ls -.01em mb 7px; текст 13.5px `#6b7688` lh 1.55 max-width 240px. |
| 260–320 | **Фишка** («Подборка одной ссылкой» / «Публичная витрина одной ссылкой»): контейнер 1060px, `padding:clamp(48px,7vw,84px) … 0`; grid `minmax(min(340px,100%),1fr)`, gap `clamp(24px,4vw,52px)`, `align-items:center`. Левая колонка: eyebrow `p.spot_eyebrow`; H2 `clamp(22px,3.4vw,32px)/800` → `p.spot_title`; p 15px `#5a6472` lh 1.65 → `p.spot_d`; пилюля `noteStyle` с иконкой `spotIcon` (`ti-users-plus` / `ti-refresh`) → `p.spot_note`. Правая — мок: **риэлторы** (269–296): карточка `radius 18;shadow 0 24px 60px rgba(20,36,63,.12)`; шапка (271–276) иконка 34px `rgba(201,163,91,.16)`/`#9c7420` `ti-folders`, `t.m_sel_title` 14px/800, чип `t.m_sel_n` 11px/700 золотой; список `mockObjects` (277–286): миниатюра 30px, имя 12px/700, цена 12px/800, иконка `ti-folder-check` 22px золотой тинт; ссылка «one-plan.pro/s/anna-24» с Копировать/WhatsApp (288–292); подпись `t.m_sel_client` с `ti-user-check` (293). **Застройщики** (297–317): шапка-градиент `#31435f→#1d2a42`, padding 22px 18px: чипы TAPU/VNJ, «MEGAPOLIS RESIDENCE» 18px/800, «Antalya · Altıntaş» 11.5px; три статистики (304–308) «406 {t.m_units}» «50% {t.m_soldl}» «5 km {t.m_sea}» 16px/800 + 10.5px `#8a93a2`, разделители `#eef1f6`; ссылка «one-plan.pro/megapolis» (310–314). |
| 322–335 | **Как получить доступ**: контейнер 1120px; H2 `clamp(22px,3.4vw,32px)/800` → `t.how_title`; grid `minmax(min(220px,100%),1fr)` gap 16; шаг: номер `stepNumStyle` (565) 40px круг `<paTint>/<paText>` 16px/800 Manrope mb 12; заголовок 16.5px/800 mb 6; текст 13.5px `#6b7688` max-width 230px. Данные `steps` (560): `t.s1_t/s1_d … s3_t/s3_d`. |
| 337–352 | **FAQ**: контейнер 760px; H2 → `t.faq_title`; список gap 10; элемент (343): `#fff;border 1px #e6e9f0;radius 14;padding 16px 20px;cursor pointer;transition border-color .15s`, hover `#c5cede`; вопрос 15px/700 Manrope; шеврон `ti-chevron-down` `q.chev` (563) `16px;#8a93a2;transition transform .2s` + `rotate(180deg)` у открытого; ответ `q.aStyle` (564) `14px;#5a6472;lh 1.6;padding-top 10px` или `display:none`. |
| 354–359 | **Полоса переключения аудитории**: контейнер 1120px, `margin:clamp(44px,6vw,72px) auto 0`; блок `#f6f8fb;border 1px #e6e9f0;radius 16;padding 18px 22px;center;gap 14`; текст `p.other_q` 14.5px `#5a6472`; кнопка `otherBtnStyle` (566): `13.5px/700;radius 10;padding 10px 18px;border 1px solid <blue|gold>;background #fff;color <blue|#9c7420>` + `ti-arrow-right` → `switchAud`. |
| 361–394 | **Форма заявки** `#lp-lead`: контейнер 820px, `padding:clamp(48px,7vw,88px) … clamp(56px,8vw,88px)`; карточка `#14243f;radius 24;padding clamp(26px,4vw,46px);overflow hidden;color #fff`; свечение `formGlowStyle` (614) `top -140px;600×340;radial rgba(201,163,91,.18)|rgba(77,124,254,.22)`. См. A.7. |
| 396–411 | **Модалка KVKK / Политика** (`legalOpen`): overlay `fixed;inset 0;rgba(11,18,32,.55);z 100;padding 20px`, клик по подложке закрывает, `stopProp` на карточке; карточка `#fff;radius 18;max-width 660px;max-height 82vh;column;shadow 0 40px 100px rgba(0,0,0,.35);animation opRise .25s`; шапка `padding 18px 22px;border-bottom #eef1f6`: `legalTitle` 17px/800 Manrope, крестик 30px radius 9 `#f0f2f6` hover `#e2e7ef` `ti-x`; тело `padding 18px 22px 22px;overflow-y auto`: абзацы `legalParas` 13.5px `#3d4a5f` lh 1.68 mb 12 `text-wrap:pretty`; внизу `t.legal_upd` 12px `#8a93a2`. |
| 413–422 | **Футер**: `border-top #eef1f6;column;center;gap 10;padding 28px 16px 34px`: 4 точки 10px (`margin-left:-3px`); `t.app_note` 11.5px `#9aa1ac` max-width 460px center (415); кнопки «App Store» (`ti-brand-apple-filled` 16px) и «Google Play» (`ti-brand-google-play` 15px) — `href="#"`, `border 1px #e6e9f0;color #5a6472;radius 9;padding 7px 13px;12px/700`, hover border `#c5cede` (416–419); ссылки «KVKK» и `t.f_priv` 11.5px `#8a93a2` underline → `openKvkk` / `openPriv` (420); «© 2026 ONETEAM İNŞAAT LTD. ŞTİ.» 12px `#9aa1ac` (421). |

### A.4. Пропсы и state (строки 425–427)

Пропсы (425): `accent` (color, по умолчанию `#4d7cfe`), `gold` (color, `#c9a35b`) — секция «Тема»; превью 1200×900.

`state` (427): `lang:'RU'`, `aud:'r'`, `role:'r'`, `faqOpen:0`, `tick:0`, `selUnit:{r:3,c:4}`, `devTab:'board'`, `legalDoc:null`, `leadName:''`, `leadCo:''`, `leadPhone:''`, `leadMail:''`, `leadMsg:''`, `leadC:false`, `leadDone:false`; динамически добавляется `tabTouchedAt` (номер тика ручного клика по вкладке мока).

Жизненный цикл (429–440): `componentDidMount` читает `localStorage['oneplan-lp-prefs']` (JSON `{lang, aud}`), применяет `lang` (если есть в i18n) и `aud` (→ и `role`); запускает `setInterval` 1800 мс → `tick++`. `componentWillUnmount` очищает интервал. `savePrefs(lang,aud)` (442–444) пишет тот же ключ при смене языка/аудитории.

Производные значения (527–547): `blue = props.accent`, `gold = props.gold`, `goldText='#9c7420'`, `pa` = золото/синий, `paText` = `#9c7420`/синий, `paTint` = `rgba(201,163,91,.16)` / `rgba(77,124,254,.12)`; иконки фич `featIcons` (546): риэлторы `ti-database, ti-home-plus, ti-search, ti-message-circle`; застройщики `ti-layout-grid, ti-file-description, ti-world, ti-shield-lock`.

### A.5. Обработчики (renderVals, 548–627)

| Ключ | Поведение |
|---|---|
| `langBtns[].onClick` (538) | `lang=l`, `savePrefs` |
| `pickR` / `pickD` (550–551) | `aud`, `role`, `faqOpen:0`, `savePrefs` |
| `switchAud` (552) | инвертирует аудиторию, `faqOpen:0`, `savePrefs`, `window.scrollTo({top:0,behavior:'smooth'})` |
| `faqs[i].toggle` (562) | `faqOpen = (faqOpen===i ? -1 : i)` — одновременно открыт максимум один |
| `heroBoard[r].cells[c].onClick` (518) | `selUnit={r,c}` |
| `devTabBoard/Docs/Pub` (573) | `devTab`, `tabTouchedAt=tick` |
| `openKvkk` / `openPriv` / `closeLegal` (593–595) | `legalDoc='kvkk'|'priv'|null`; `legalTitle = t[legalDoc+'_t']`, `legalParas = t[legalDoc+'_p']` |
| `gotoApp` (608) | `window.location.href='OnePlan v2.dc.html'` (в проде — маршрут входа в кабинет) |
| `scrollToForm` (609) | скролл к `#lp-lead` с отступом −70px |
| `pickRoleR/D` (610–611) | `role` в форме |
| `onLeadName/Co/Mail/Msg` (617) | `bind` → `state[k]=e.target.value` |
| `onLeadPhone` (618) | см. A.7 |
| `toggleLeadC` (623) | чекбокс |
| `submitLead` (626) | если валидно → `leadDone:true` (бэкенда нет) |

### A.6. Анимации мока (тик 1800 мс)

**Диалог риэлторов** (85–113, флаги 568): `chTyping1 = tick%7===0`, `chMsg1 = tick%7>=1`, `chTyping2 = tick%7===2`, `chMsg2 = tick%7>=3`, `chLink = tick%7>=4`. Цикл 7 тиков = 12,6 с: 0 — SE печатает (3 точки 6px `#8a93a2` с `opBlink 1s`, задержки 0/.2/.4 s, пузырь `#f0f2f6` radius `12px 12px 12px 4px`); 1 — входящее `t.m_chat`; 2 — AK печатает (точки `#9c7420`, пузырь `rgba(201,163,91,.18)` radius `12px 12px 4px 12px`); 3 — ответ `t.m_chat2`; 4 — чип-ссылка «one-plan.pro/s/deniz-24» (`#fff;border 1px rgba(201,163,91,.55);radius 9;padding 6px 11px;11.5px/700;#9c7420`, `ti-link`, `padding-right:34px`); 5–6 — пауза; далее заново. Аватары 26px: SE `#7d9fdd` с зелёной точкой онлайн `#34c383` (9px, border 2px #fff), AK `#c9a35b`.

**Шахматка** (`mkBoard(8,14,flip,sel)`, 508–525): 8 этажей × 14 квартир; подпись этажа `rows-r` (8…1). Статус клетки `unitStatus(r,c)` (490–493): `h=(r*13+c*7+3)%20` → `h<4` sold, `4` res, `5` proc, `6` hold, иначе avail. Цвета (509): sold `#cfd6e0`, res `#f0ad00`, proc `#4d7cfe`, hold `#8b5cf6`, avail `#34c383`. «Бронирование»: клетка `[{r:1,c:3},{r:4,c:9},{r:6,c:2},{r:0,c:8}][tick%4]` (567) рисуется `#f0ad00` с `opPulse 1.5s infinite` и задержкой 0. Информация о клетке `unitInfo(r,c)` (495–506): `floor=8-r`, `idx=(r+c)%3`, `m2=[52,76,110][idx]+(c%3)*2`, `no=floor+'-'+pad2(c+1)`, `rooms=['1+1','2+1','3+1'][idx]`, `price='$'+round(m2*(1750+floor*25)/500)*500` с разделителем тысяч пробелом. Для дефолтного `selUnit {3,4}`: «№ 5-05 · 2+1 · 78 m² · $146 500 · Свободно». Подписи статусов в чипе (598): avail `#34c383`, res `#f0ad00`, proc `#4d7cfe`, hold `#8b5cf6`, sold `#8a93a2`.

**Автовкладки застройщика** (569–572): `dtab = (tabTouchedAt!=null && tick-tabTouchedAt<8) ? devTab : ['board','docs','pub'][floor(tick/3)%3]` — ротация каждые 3 тика (5,4 с); ручной клик фиксирует вкладку на 8 тиков (14,4 с), затем ротация возобновляется.

### A.7. Форма заявки (365–391, логика 540–545, 612–626)

- Заголовок `t.form_title` `clamp(22px,3.4vw,29px)/800`, подзаголовок `t.form_sub` 14.5px `#aeb9cc`.
- Чипы роли (370–373): `roleBase` (545) `13px/700;radius 10;padding 10px 18px;gap 7px`; активный риэлтор `border 1px <gold>;background rgba(201,163,91,.2);color #e9d9ba`; активный застройщик `border 1px <blue>;background rgba(77,124,254,.2);color #a5bdff`; неактивный `border 1px #33456a;transparent;color #8fa0bd`. Предзаполняются из переключателя аудитории (`role`).
- Поля (374–380): grid `minmax(200px,1fr)` gap 12; label 12px `#8fa0bd` mb 6, звёздочка `#ff8b8b`; инпут `li(bad)` (541): `width 100%;background #1e3050;border 1px solid (#e5484d|#33456a);radius 11;padding 12px 14px;14px;color #fff;outline none`. Порядок: Имя* (`leadName`), Компания (`leadCo`), Телефон* (`leadPhone`), Почта* (`leadMail`, `type=email`) + подпись `t.f_email_note` 11px `#8fa0bd`, ниже на всю ширину Комментарий (`leadMsg`).
- **Телефон** (377, 618–621): постоянный префикс «+90» (`absolute;left 14px;14px/700;#fff;pointer-events none`), инпут `type=tel inputMode=numeric placeholder="5xx xxx xx xx"`, `padding-left:52px`. Нормализация ввода: убрать все нецифры → если начинается с `90` — отрезать → если с `0` — отрезать → отрезать ведущие символы `[0-46-9]+` (первой цифрой может быть только 5) → оставить 10 цифр. Отображение `leadPhoneFmt` (619): `3 3 2 2` (`5xx xxx xx xx`). Валидно `phoneOk = /^5\d{9}$/`; при непустом невалидном — красная рамка.
- **Почта**: `mailOk = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/`; красная рамка при непустом невалидном.
- Чекбокс (381): 20px radius 6; отмечен `background <blue>` с `ti-check` белым; пустой `border 1.5px #4a5c7e`; текст `t.f_consent` 12.5px `#c7d0e0` + « · » + ссылка «KVKK» `#8fb0e8` underline → модалка.
- Кнопка (382, 625): `width 100%;mt 16;background <pa>;color #14243f|#fff;radius 12;padding 15px;15px/700`; неактивна (`opacity:.5;pointer-events:none`) пока не выполнено `leadName && phoneOk && mailOk && leadC`.
- Подпись `t.free_note` с `ti-gift` (383).
- Экран успеха (385–391): круг 66px `rgba(15,157,107,.2)` с `ti-check` `#3ddc97` 33px; `t.done_t` 24px/800; `t.done_d` 15px `#aeb9cc`.
- Бэкенд не подключён. Для продакшна нужен endpoint с полями: `role ('r'|'d')`, `name`, `company`, `phone ('+90'+10 цифр)`, `email`, `message`, `lang`.

### A.8. Мок-данные (renderVals)

`mockObjects` (601–605):
```
ANTALYA · KONYAALTI | 2+1 · 78 m² · 5/12 | $145 000 | AK #c9a35b | thumb linear-gradient(135deg,#dfe6f0,#c9d4e4) | delay 0ms
ANTALYA · LARA      | 1+1 · 54 m² · 8/14 | $98 500  | SE #7d9fdd | linear-gradient(135deg,#dcebe0,#c4dbca) | 90ms
ANTALYA · AKSU      | 3+1 · 112 m² · 2/6 | $210 000 | MT #cf8f8f | linear-gradient(135deg,#efe6d8,#e0d2bc) | 180ms
```
`pubCards` (578–582): 1) `megapolis-photos/web-front.jpg`, стадия `t.st_facade` бейдж `#7c5cd6`, İskan ✓, не LIVE, «MEGAPOLIS RESIDENCE», `t.loc_mega`, чипы `tg_start`/`tg_com` (`#fdf2e4`/`#d98a1e`), `tg_cit` (`#efe9fb`/`#7c5cd6`), продано 39 %, в продаже 127, готовность 65 %, «SERVEROĞLU İnşaat», 211 помещений; 2) `diamond-photos/IMG-20250611-WA0060.jpg`, `st_land` `#0f9d6b`, «YÜKSELEN DIAMOND», `loc_dia`, чипы `tg_open` (`#e4f6ee`/`#0f9d6b`), `tg_vnj` (`#e3ebfd`/`#3a63d4`), `tg_com`, 59 % / 16 / 92 %, «Yükselen İnşaat», 63; 3) `akropolis-photos/web-ph-1.jpg`, `st_frame` `#3a63d4`, LIVE, «AKROPOLIS RESIDENCE», `loc_akr`, чипы `tg_open`, `tg_cit`, `tg_vnj`, 90 % / 26 / 45 %, «SERVEROĞLU İnşaat», 250.
`docs` (583–588): `t.doc1` «2.4 MB · 12.07» `ti-file-type-pdf` `#e5484d`/`rgba(229,72,77,.1)`; `t.doc2` «18 MB · 03.07» `ti-ruler-2` `#4d7cfe`/`rgba(77,124,254,.1)`; `t.doc3` «1.1 MB · 28.06» pdf; `t.doc4` «340 MB · 30.06» `ti-photo` `#0f9d6b`/`rgba(15,157,107,.1)`.

### A.9. i18n — полный объект (446–488)

Строки: **RU 448–460**, **EN 461–473**, **TR 474–486**. Структура ключей одинакова для трёх языков: общие ключи → `r:{…}` (аудитория риэлторы) → `d:{…}` (застройщики) → ключи формы/юр-текстов.

#### A.9.1. Общие ключи (RU / EN / TR)

| Ключ | RU | EN | TR |
|---|---|---|---|
| login | Войти | Sign in | Giriş yap |
| badge | Бесплатно | Free | Ücretsiz |
| umbrella | OnePlan · Платформа для профессионалов недвижимости | OnePlan · A platform for real-estate professionals | OnePlan · Gayrimenkul profesyonelleri platformu |
| feat_eyebrow | Возможности | Features | Özellikler |
| how_title | Как получить доступ | How to get access | Erişim nasıl alınır |
| faq_title | Частые вопросы | Common questions | Sık sorulan sorular |
| app_note | Мобильное приложение — для удобной работы на ходу: просмотр, поиск, общение. Полное управление — шахматки, пользователи, настройки — на сайте. | The mobile app is for convenient work on the go: browsing, search, messaging. Full management — unit boards, users, settings — is on the website. | Mobil uygulama, hareket hâlinde rahat çalışmak içindir: görüntüleme, arama, mesajlaşma. Tam yönetim — daire şemaları, kullanıcılar, ayarlar — web sitesindedir. |
| s1_t / s1_d | Заявка / Минута на форму — имя и телефон. | Request / A minute for the form — name and phone. | Talep / Form için bir dakika — ad ve telefon. |
| s2_t / s2_d | Проверка / Убеждаемся, что вы из недвижимости. | Verification / We make sure you work in real estate. | Doğrulama / Sektörde olduğunuzdan emin oluruz. |
| s3_t / s3_d | Доступ / Подключаем и помогаем освоиться. | Access / We connect you and help you settle in. | Erişim / Sizi dahil eder, alışmanıza yardımcı oluruz. |
| m_base | Закрытая база | Closed base | Kapalı veritabanı |
| m_closed | Только для участников | Members only | Yalnızca üyeler |
| m_add | Добавить объект | Add object | İlan ekle |
| m_query | Анталья · 2+1 · до $160 000 | Antalya · 2+1 · up to $160,000 | Antalya · 2+1 · $160.000’e kadar |
| m_write | Написать | Message | Yaz |
| m_community | 2 847 объектов от участников комьюнити | 2,847 objects added by community members | Topluluk üyelerinden 2.847 ilan |
| m_board / m_docs / m_pub | Шахматка / Документы / Витрина | Unit board / Documents / Showcase | Daire şeması / Belgeler / Vitrin |
| m_avail / m_res / m_proc / m_hold / m_sold | Свободно / Бронь / Оформление / Резерв / Продано | Available / Booked / Processing / Hold / Sold | Boş / Opsiyon / İşlemde / Rezerv / Satıldı |
| m_live | Обновляется в реальном времени | Updates in real time | Gerçek zamanlı güncellenir |
| m_selling | Продажи открыты | Sales open | Satış açık |
| m_chat | Здравствуйте! 2+1 в Коньяалты ещё актуальна? | Hi! Is the 2+1 in Konyaaltı still available? | Merhaba! Konyaaltı’ndaki 2+1 hâlâ satışta mı? |
| m_chat2 | Да, свободна. Кидаю подборку — там ещё два похожих: | Yes, it is. Sending a selection — two more similar inside: | Evet, satışta. Seçki gönderiyorum — içinde iki benzer daha var: |
| m_sel_title | Подборка · Анна | Selection · Anna | Seçki · Anna |
| m_sel_n | 3 объекта | 3 objects | 3 ilan |
| m_sel_client | Клиент видит ваши контакты и кнопку «Написать» | The client sees your contacts and a “Message” button | Müşteri iletişim bilgilerinizi ve «Yaz» düğmesini görür |
| m_copy | Копировать | Copy | Kopyala |
| m_units / m_soldl / m_sea | квартир / продано / до моря | units / sold / to the sea | daire / satıldı / denize |
| m_doc_all / contracts / plans / site | Все / Договоры / Планировки / Стройка | All / Contracts / Layouts / Construction | Tümü / Sözleşmeler / Planlar / Şantiye |
| doc1 | Договор долевого участия.pdf | Sales contract.pdf | Satış sözleşmesi.pdf |
| doc2 | Планировки · корпус B.pdf | Layouts · block B.pdf | Planlar · B blok.pdf |
| doc3 | Разрешение на строительство.pdf | Construction permit.pdf | İnşaat ruhsatı.pdf |
| doc4 | Дневник стройки · июнь.zip | Site diary · June.zip | Şantiye günlüğü · Haziran.zip |
| m_soldp / m_onsale / m_ready / m_rooms_n | Продано / в продаже / Готовность / помещений | Sold / on sale / Progress / units | Satıldı / satışta / Hazırlık / birim |
| tg_start / tg_open / tg_com / tg_cit / tg_vnj | Старт продаж / Продажи открыты / Коммерция / Гражданство / Под ВНЖ | Sales start / Sales open / Commercial / Citizenship / Res. permit | Satış başladı / Satış açık / Ticari / Vatandaşlık / Oturma izni |
| st_facade / st_land / st_frame | Фасад / Благоустройство / Каркас | Facade / Landscaping / Frame | Cephe / Peyzaj / Karkas |
| loc_mega / loc_dia / loc_akr | Анталья, Аксу, Алтынташ / Анталья, Алтынташ (Лара) / Анталья, Аксу, Алтынташ | Antalya, Aksu, Altıntaş / Antalya, Altıntaş (Lara) / Antalya, Aksu, Altıntaş | (то же, что EN) |
| legal_upd | Обновлено: июль 2026 · ONETEAM İNŞAAT LTD. ŞTİ. | Updated: July 2026 · ONETEAM İNŞAAT LTD. ŞTİ. | Güncelleme: Temmuz 2026 · ONETEAM İNŞAAT LTD. ŞTİ. |

#### A.9.2. Аудитория «Риэлторам» (`r`) — RU 450–452, EN 463–465, TR 476–478

| Ключ | RU | EN | TR |
|---|---|---|---|
| tag | Риэлторам | For realtors | Emlakçılar |
| role | Я риэлтор | I am a realtor | Emlakçıyım |
| t1 / hl / t2 | Закрытая база вторички — / от риэлторов для риэлторов / (пусто) | A closed resale database — / by realtors, for realtors / (пусто) | Kapalı ikinci el veritabanı — / emlakçıdan emlakçıya / (пусто) |
| sub | Профессиональное комьюнити: добавляйте свои объекты, ищите варианты у коллег и договаривайтесь напрямую. Без публичных площадок и посредников. | A professional community: add your objects, find options from colleagues and deal directly. No public marketplaces, no intermediaries. | Profesyonel topluluk: ilanlarınızı ekleyin, meslektaşlarınızın seçeneklerini bulun ve doğrudan anlaşın. Halka açık platformlar ve aracılar yok. |
| cta | Вступить в комьюнити | Join the community | Topluluğa katıl |
| note | Мы гарантируем конфиденциальность: объекты видят только проверенные участники. | We guarantee confidentiality: objects are visible only to verified members. | Gizliliği garanti ediyoruz: ilanları yalnızca doğrulanmış üyeler görür. |
| feat_title | Как работает комьюнити | How the community works | Topluluk nasıl çalışır |
| other_q / other_btn | Вы застройщик? / OnePlan для застройщиков | Are you a developer? / OnePlan for developers | Geliştirici misiniz? / Geliştiriciler için OnePlan |
| spot_eyebrow | Фишка комьюнити | Community feature | Topluluk özelliği |
| spot_title | Подборка для клиента — одной ссылкой | A client selection — in one link | Müşteriye özel seçki — tek bağlantıyla |
| spot_d | Отметьте квартиры папкой — и отправьте клиенту персональную ссылку. Внутри только выбранные варианты, ваши контакты и кнопка связи: клиент всегда возвращается к вам. | Mark apartments with the folder — and send the client a personal link. Inside: only the chosen options, your contacts and a contact button. The client always comes back to you. | Daireleri klasörle işaretleyin — müşteriye kişisel bağlantı gönderin. İçinde yalnızca seçilen seçenekler, iletişim bilgileriniz ve mesaj düğmesi: müşteri hep size döner. |
| spot_note | Чем больше нас в комьюнити — тем больше вариантов для ваших клиентов. Зовите коллег. | The more of us in the community — the more options for your clients. Invite colleagues. | Toplulukta ne kadar çok olursak, müşterileriniz için o kadar çok seçenek. Meslektaşlarınızı davet edin. |

**FAQ риэлторов:**

| | RU | EN | TR |
|---|---|---|---|
| q1 | Кто может вступить в комьюнити? | Who can join the community? | Topluluğa kimler katılabilir? |
| a1 | Практикующие риэлторы и агентства недвижимости. Каждую заявку мы проверяем вручную: убеждаемся, что вы действительно работаете на рынке, и только после этого открываем доступ. Случайных людей и покупателей в базе нет. | Practicing realtors and real-estate agencies. We review every request manually to make sure you actually work in the market — only then do we open access. No random people or buyers inside. | Aktif emlakçılar ve emlak ofisleri. Her talebi elle inceliyoruz: gerçekten piyasada çalıştığınızdan emin olduktan sonra erişim açıyoruz. İçeride rastgele kişiler veya alıcılar yok. |
| q2 | Кто видит мои объекты? | Who sees my objects? | İlanlarımı kim görür? |
| a2 | Только проверенные участники комьюнити. База не индексируется поисковиками, объекты не публикуются на площадках и не видны никому за пределами системы. Вы сами решаете, какие объекты добавлять. | Only verified community members. The base is not indexed by search engines, objects are not published anywhere and are invisible outside the system. You decide which objects to add. | Yalnızca doğrulanmış topluluk üyeleri. Veritabanı arama motorlarında görünmez, ilanlar hiçbir yerde yayınlanmaz ve sistem dışından görülemez. Hangi ilanları ekleyeceğinize siz karar verirsiniz. |
| q3 | Сколько это стоит? | How much does it cost? | Ücreti ne kadar? |
| a3 | ONEPLAN бесплатен: регистрация, база, поиск и общение с коллегами не стоят ничего. | ONEPLAN is free: registration, the base, search and messaging cost nothing. | ONEPLAN ücretsizdir: kayıt, veritabanı, arama ve mesajlaşma için ücret yok. |
| q4 | Как связаться с риэлтором объекта? | How do I reach the listing realtor? | İlanın emlakçısına nasıl ulaşırım? |
| a4 | В каждой карточке указан риэлтор, который ведёт объект, — пишите ему напрямую в один клик. Никаких цепочек из трёх посредников: вы договариваетесь между собой, и комиссия делится на двоих. | Every card shows the realtor in charge of the object — message them directly in one click. No chains of three intermediaries: you agree between yourselves and split the commission two ways. | Her kartta ilanı yöneten emlakçı görünür — tek tıkla doğrudan yazın. Üç aracılı zincirler yok: kendi aranızda anlaşır, komisyonu ikiye bölersiniz. |

**Карточки возможностей риэлторов** (иконки `ti-database`, `ti-home-plus`, `ti-search`, `ti-message-circle`):

| | RU | EN | TR |
|---|---|---|---|
| f1 | Общая база вторички — Живой каталог, который пополняют сами риэлторы. | Shared resale base — A live catalog maintained by realtors themselves. | Ortak ikinci el veritabanı — Emlakçıların kendilerinin doldurduğu canlı katalog. |
| f2 | Свои объекты — Добавили объект — его сразу видит всё комьюнити. | Your own objects — Add an object — the whole community sees it right away. | Kendi ilanlarınız — İlan ekleyin — tüm topluluk anında görür. |
| f3 | Умный поиск — Район, комнатность, бюджет — вариант за минуты. | Smart search — District, rooms, budget — an option in minutes. | Akıllı arama — Bölge, oda sayısı, bütçe — seçenek dakikalar içinde. |
| f4 | Напрямую с коллегой — Без посредников: комиссия остаётся у вас двоих. | Direct with a colleague — No intermediaries: the commission stays between you two. | Meslektaşla doğrudan — Aracı yok: komisyon ikinizin arasında kalır. |

#### A.9.3. Аудитория «Застройщикам» (`d`) — RU 453–455, EN 466–468, TR 479–481

| Ключ | RU | EN | TR |
|---|---|---|---|
| tag | Застройщикам | For developers | Geliştiriciler |
| role | Я застройщик | I am a developer | Geliştiriciyim |
| t1 / hl / t2 | Управление продажами новостройки / в одной системе / (пусто) | Manage new-build sales / in one system / (пусто) | Yeni konut satışlarını / tek sistemde / yönetin |
| sub | Шахматка, цены, документы, дневник стройки и публичная витрина. Полноценная замена Google-диску — современнее и удобнее. | Unit board, prices, documents, construction diary and a public showcase. A full replacement for Google Drive — modern and convenient. | Daire şeması, fiyatlar, belgeler, şantiye günlüğü ve herkese açık vitrin. Google Drive’a tam alternatif — modern ve kullanışlı. |
| cta | Оставить заявку | Request access | Erişim talebi |
| note | Мы гарантируем: ваша база изолирована, наружу уходит только витрина, которой делитесь вы. | We guarantee it: your base is isolated, only the showcase you share goes outside. | Garanti ediyoruz: veritabanınız izoledir, dışarıya yalnızca paylaştığınız vitrin çıkar. |
| feat_title | Что внутри системы | What is inside | Sistemin içinde neler var |
| other_q / other_btn | Вы риэлтор? / Закрытая база для риэлторов | Are you a realtor? / Closed base for realtors | Emlakçı mısınız? / Emlakçılar için kapalı veritabanı |
| spot_eyebrow | Фишка системы | System feature | Sistem özelliği |
| spot_title | Публичная витрина — одной ссылкой | Public showcase — in one link | Herkese açık vitrin — tek bağlantıyla |
| spot_d | Поделитесь страницей объекта с агентствами и покупателями: актуальные цены, статусы и фото — без пересылки PDF и прайсов в чатах. | Share the object page with agencies and buyers: live prices, statuses and photos — no PDFs and price lists in chats. | İlan sayfasını acenteler ve alıcılarla paylaşın: güncel fiyatlar, durumlar ve fotoğraflar — sohbetlerde PDF ve fiyat listesi göndermek yok. |
| spot_note | Ссылку можно открыть в любой момент — данные всегда свежие. | The link can be opened anytime — the data is always fresh. | Bağlantı her an açılabilir — veriler her zaman günceldir. |

**FAQ застройщиков:**

| | RU | EN | TR |
|---|---|---|---|
| q1 | Видят ли риэлторы и другие компании мою базу? | Will realtors or other companies see my base? | Emlakçılar veya diğer şirketler veritabanımı görür mü? |
| a1 | Нет. Ваша база полностью изолирована: ни риэлторы, ни другие застройщики её не видят. Наружу уходит только публичная витрина — страница объекта, которой вы сами решаете, с кем поделиться. | No. Your base is fully isolated: neither realtors nor other developers can see it. The only thing that goes outside is the public showcase — an object page you choose who to share with. | Hayır. Veritabanınız tamamen izoledir: ne emlakçılar ne de diğer geliştiriciler görebilir. Dışarıya yalnızca herkese açık vitrin çıkar — kiminle paylaşacağınıza siz karar verirsiniz. |
| q2 | Что с документами и файлами? | What about documents and files? | Belgeler ve dosyalar ne olacak? |
| a2 | Договоры, планировки, разрешения, фото и дневник стройки хранятся в системе, привязанными к объекту. Больше не нужно искать нужный файл по папкам Google-диска и пересылать ссылки в чатах. | Contracts, layouts, permits, photos and the construction diary live in the system, attached to the object. No more digging through Google Drive folders and forwarding links in chats. | Sözleşmeler, planlar, izinler, fotoğraflar ve şantiye günlüğü ilana bağlı olarak sistemde durur. Artık Google Drive klasörlerinde dosya aramak ve sohbetlerde bağlantı iletmek yok. |
| q3 | Сколько это стоит? | How much does it cost? | Ücreti ne kadar? |
| a3 | ONEPLAN бесплатен: все возможности системы доступны без оплаты. | ONEPLAN is free: all features are available at no cost. | ONEPLAN ücretsizdir: tüm özellikler ücretsiz kullanılabilir. |
| q4 | Сколько занимает запуск? | How long does setup take? | Kurulum ne kadar sürer? |
| a4 | Обычно хватает одного дня. Мы вместе с вами заводим объекты, загружаем шахматку, настраиваем команду и права — и вы сразу работаете в системе. | Usually one day is enough. Together we load your objects, set up the unit board, the team and permissions — and you start working right away. | Genellikle bir gün yeter. İlanları birlikte yükler, daire şemasını, ekibi ve yetkileri kurarız — hemen çalışmaya başlarsınız. |

**Карточки возможностей застройщиков** (иконки `ti-layout-grid`, `ti-file-description`, `ti-world`, `ti-shield-lock`):

| | RU | EN | TR |
|---|---|---|---|
| f1 | Шахматка квартир — Статусы, цены и планировки — как на бумаге, только живое. | Unit board — Statuses, prices and layouts — like on paper, but live. | Daire şeması — Durumlar, fiyatlar ve planlar — kâğıttaki gibi ama canlı. |
| f2 | Документы и стройка — Договоры, фото и дневник стройки в одном месте. | Documents & construction — Contracts, photos and the construction diary in one place. | Belgeler ve şantiye — Sözleşmeler, fotoğraflar ve şantiye günlüğü tek yerde. |
| f3 | Публичная витрина — Страница объекта по ссылке — всегда актуальная. | Public showcase — An object page by link — always up to date. | Herkese açık vitrin — Bağlantıyla ilan sayfası — her zaman güncel. |
| f4 | Роли и доступы — Команда, права и скрытые объекты под контролем. | Roles & access — Team, permissions and hidden objects under control. | Roller ve erişim — Ekip, yetkiler ve gizli ilanlar kontrol altında. |

#### A.9.4. Форма заявки — RU 456, 460; EN 469, 473; TR 482, 486

| Ключ | RU | EN | TR |
|---|---|---|---|
| form_title | Заявка на доступ | Access request | Erişim talebi |
| form_sub | Оставьте контакты — подключим вас. Это бесплатно. | Leave your contacts — we will onboard you. It is free. | İletişim bilgilerinizi bırakın — sizi dahil edelim. Ücretsizdir. |
| f_name | Имя | Name | Ad |
| f_co | Компания / агентство | Company / agency | Şirket / acente |
| f_phone | Телефон | Phone | Telefon |
| f_email | Эл. почта | Email | E-posta |
| f_email_note | Сюда придёт пароль для входа и восстановление доступа | Your sign-in password and account recovery go here | Giriş şifreniz ve hesap kurtarma buraya gönderilir |
| f_msg | Комментарий (необязательно) | Comment (optional) | Not (isteğe bağlı) |
| f_consent | Согласен(на) на обработку данных для обратной связи | I agree to data processing for feedback | Geri dönüş için veri işlenmesini kabul ediyorum |
| f_priv | Политика конфиденциальности | Privacy policy | Gizlilik politikası |
| f_submit | Отправить заявку | Send request | Talebi gönder |
| done_t | Спасибо! Заявка принята | Thank you! Request received | Teşekkürler! Talebiniz alındı |
| done_d | Мы свяжемся с вами в ближайшее время. | We will contact you shortly. | En kısa sürede sizinle iletişime geçeceğiz. |
| free_note | ONEPLAN бесплатен. | ONEPLAN is free. | ONEPLAN ücretsizdir. |

#### A.9.5. KVKK — полный текст (RU 457–458, EN 470–471, TR 483–484)

**RU — `kvkk_t`: «Уведомление об обработке персональных данных (KVKK)»**, `kvkk_p` (9 абзацев):

1. Оператор данных. Настоящее уведомление подготовлено в соответствии со ст. 10 Закона Турецкой Республики «О защите персональных данных» № 6698 (KVKK) и Положением о порядке исполнения обязанности по информированию. Оператором данных выступает ONETEAM İNŞAAT LTD. ŞTİ. (далее — «Компания»).
2. Обрабатываемые персональные данные. Компания обрабатывает: идентификационные данные (имя, фамилия), контактные данные (телефон, e-mail), профессиональные данные (название компании/агентства, сведения о деятельности в сфере недвижимости), содержание комментария из формы заявки, а при использовании платформы — записи о безопасности учётной записи и операций (сессии, лог-записи).
3. Способ сбора данных. Персональные данные собираются в электронной форме, полностью или частично автоматизированными способами: через форму заявки на сайте, ваши действия на платформе и переписку с вами.
4. Цели обработки. Данные обрабатываются для: рассмотрения заявки на доступ и связи с вами; проверки заявки (подтверждение деятельности в сфере недвижимости); создания и администрирования учётной записи в ONEPLAN; отправки пароля для входа и писем восстановления доступа; обеспечения работы, безопасности и развития сервиса; исполнения обязанностей, предусмотренных законодательством.
5. Правовые основания. Обработка опирается на ст. 5/2(a) KVKK — прямое указание закона; ст. 5/2(c) — необходимость для заключения и исполнения договора; ст. 5/2(ç) — исполнение правовой обязанности оператора; ст. 5/2(f) — законный интерес Компании при условии ненанесения вреда вашим основным правам и свободам; в остальных случаях — на ваше явное согласие (ст. 5/1), выраженное отметкой в форме заявки.
6. Передача данных. Данные не продаются и не передаются третьим лицам в маркетинговых целях. В соответствии со ст. 8 и 9 KVKK они могут передаваться только поставщикам инфраструктуры (хостинг, e-mail) в объёме, необходимом для работы сервиса, а также уполномоченным государственным органам и судебным инстанциям по их законному требованию.
7. Срок хранения. Данные хранятся в течение срока действия вашей учётной записи и установленных законодательством сроков исковой давности, после чего в соответствии со ст. 7 KVKK удаляются, уничтожаются или анонимизируются — либо ранее, по вашему запросу.
8. Ваши права (ст. 11 KVKK). Вы вправе: узнать, обрабатываются ли ваши данные; запросить информацию об обработке; узнать цель обработки и соответствует ли использование этой цели; знать третьих лиц в стране и за рубежом, которым переданы данные; требовать исправления неполных или неточных данных; требовать удаления или уничтожения данных в рамках ст. 7; требовать уведомления третьих лиц об исправлении и удалении; возражать против неблагоприятного для вас результата, полученного исключительно автоматизированным анализом; требовать возмещения ущерба, причинённого незаконной обработкой.
9. Порядок обращения. Запросы по своим правам вы можете направить письменно или через контактные каналы Компании в порядке, установленном Положением об обращении к оператору данных. Обращение рассматривается бесплатно в кратчайший срок, но не позднее 30 (тридцати) дней.

**EN — `kvkk_t`: «Personal Data Processing Notice (KVKK)»**:

1. Data controller. This notice is provided under Article 10 of the Turkish Personal Data Protection Law No. 6698 (“KVKK”) and the Communiqué on the Procedures and Principles for Fulfilling the Obligation to Inform. The data controller is ONETEAM İNŞAAT LTD. ŞTİ. (the “Company”).
2. Personal data processed. The Company processes: identity data (name, surname), contact data (phone number, e-mail address), professional data (company/agency name, information on your real-estate activity), the content of the comment in the request form and, if you use the platform, account and transaction security records (session and log records).
3. Method of collection. Personal data is collected electronically, by fully or partly automated means: through the request form on the website, your actions on the platform and correspondence with you.
4. Purposes of processing. Your data is processed to: evaluate your access request and contact you; verify your application (confirmation of real-estate activity); create and manage your ONEPLAN account; send your sign-in password and account-recovery e-mails; operate, secure and improve the service; and fulfil obligations arising from legislation.
5. Legal grounds. Processing relies on KVKK Art. 5/2(a) — being expressly provided for by law; Art. 5/2(c) — necessity for the conclusion or performance of a contract; Art. 5/2(ç) — compliance with a legal obligation of the controller; Art. 5/2(f) — the Company’s legitimate interests, provided your fundamental rights and freedoms are not harmed; and otherwise on your explicit consent (Art. 5/1) given via the checkbox in the request form.
6. Transfers. Your data is never sold or shared with third parties for marketing. In line with KVKK Arts. 8 and 9, it may be transferred only to infrastructure providers (hosting, e-mail delivery) to the extent required for the service to operate, and to authorised public institutions and judicial authorities upon their lawful request.
7. Retention. Data is kept for the duration of your membership and the limitation periods set by legislation, after which it is deleted, destroyed or anonymised under KVKK Art. 7 — or earlier upon your request.
8. Your rights (KVKK Art. 11). You have the right to: learn whether your data is processed; request information about processing; learn the purpose and whether the data is used in line with it; know the third parties to whom it is transferred in Turkey or abroad; request correction of incomplete or inaccurate data; request deletion or destruction under Art. 7; request that corrections and deletions be notified to third parties; object to a result unfavourable to you produced exclusively by automated analysis; and claim compensation for damage caused by unlawful processing.
9. How to apply. You may submit requests concerning your rights in writing or via the Company’s contact channels, in accordance with the Communiqué on the Procedures and Principles of Application to the Data Controller. Requests are resolved free of charge as soon as possible and within 30 (thirty) days at the latest.

**TR — `kvkk_t`: «Kişisel Verilerin İşlenmesine İlişkin Aydınlatma Metni (KVKK)»**:

1. Veri Sorumlusu. İşbu Aydınlatma Metni, 6698 sayılı Kişisel Verilerin Korunması Kanunu’nun (“KVKK”) 10. maddesi ile Aydınlatma Yükümlülüğünün Yerine Getirilmesinde Uyulacak Usul ve Esaslar Hakkında Tebliğ uyarınca, veri sorumlusu sıfatıyla ONETEAM İNŞAAT LTD. ŞTİ. (“Şirket”) tarafından hazırlanmıştır.
2. İşlenen Kişisel Veriler. Şirket tarafından; kimlik verileriniz (ad, soyad), iletişim verileriniz (telefon numarası, e-posta adresi), mesleki verileriniz (şirket/acente adı, sektörel faaliyet bilgisi), talep formunda ilettiğiniz not içeriği ile platformu kullanmanız hâlinde hesap ve işlem güvenliğine ilişkin kayıtlar (oturum ve log kayıtları) işlenmektedir.
3. Kişisel Verilerin Toplanma Yöntemi. Kişisel verileriniz; web sitesindeki başvuru formu, platform üzerindeki işlemleriniz ve sizinle kurulan yazışmalar aracılığıyla, elektronik ortamda, tamamen veya kısmen otomatik yollarla toplanmaktadır.
4. İşleme Amaçları. Kişisel verileriniz; erişim talebinizin değerlendirilmesi ve sizinle iletişim kurulması, üyelik başvurunuzun doğrulanması (gayrimenkul sektöründe faaliyet kontrolü), ONEPLAN platformunda hesabınızın oluşturulması ve yönetilmesi, giriş şifresi ile hesap kurtarma e-postalarının gönderilmesi, hizmetin işletilmesi, güvenliğinin sağlanması ve geliştirilmesi ile mevzuattan doğan yükümlülüklerin yerine getirilmesi amaçlarıyla işlenmektedir.
5. Hukuki Sebepler. Kişisel verileriniz; KVKK m.5/2(a) kanunlarda açıkça öngörülmesi, m.5/2(c) bir sözleşmenin kurulması veya ifasıyla doğrudan doğruya ilgili olması, m.5/2(ç) veri sorumlusunun hukuki yükümlülüğünü yerine getirebilmesi için zorunlu olması ve m.5/2(f) temel hak ve özgürlüklerinize zarar vermemek kaydıyla Şirketin meşru menfaatleri hukuki sebeplerine; bu kapsama girmeyen hâllerde ise başvuru formundaki onay kutusu aracılığıyla verdiğiniz açık rızanıza (m.5/1) dayanılarak işlenmektedir.
6. Kişisel Verilerin Aktarılması. Kişisel verileriniz satılmaz ve pazarlama amacıyla üçüncü kişilerle paylaşılmaz. Verileriniz; KVKK m.8 ve m.9’daki şartlara uygun olarak, yalnızca hizmetin işletilmesi için gerekli ölçüde barındırma (hosting) ve e-posta altyapısı sağlayıcılarına ve kanunen yetkili kamu kurum ve kuruluşları ile yargı mercilerine, talep etmeleri hâlinde aktarılabilir.
7. Saklama Süresi. Kişisel verileriniz, üyeliğiniz devam ettiği sürece ve ilgili mevzuatta öngörülen zamanaşımı süreleri boyunca saklanır; bu sürelerin sonunda veya talebiniz üzerine KVKK m.7 uyarınca silinir, yok edilir veya anonim hâle getirilir.
8. KVKK m.11 Kapsamındaki Haklarınız. Kişisel verilerinizin işlenip işlenmediğini öğrenme; işlenmişse buna ilişkin bilgi talep etme; işlenme amacını ve amacına uygun kullanılıp kullanılmadığını öğrenme; yurt içinde veya yurt dışında aktarıldığı üçüncü kişileri bilme; eksik veya yanlış işlenmişse düzeltilmesini isteme; KVKK m.7 çerçevesinde silinmesini veya yok edilmesini isteme; düzeltme ve silme işlemlerinin aktarıldığı üçüncü kişilere bildirilmesini isteme; münhasıran otomatik sistemlerle analiz edilmesi sonucu aleyhinize bir sonucun ortaya çıkmasına itiraz etme; kanuna aykırı işleme sebebiyle zarara uğramanız hâlinde zararın giderilmesini talep etme haklarına sahipsiniz.
9. Başvuru Usulü. Haklarınıza ilişkin taleplerinizi, Veri Sorumlusuna Başvuru Usul ve Esasları Hakkında Tebliğ’e uygun olarak yazılı şekilde veya Şirketin iletişim adresleri üzerinden iletebilirsiniz. Başvurunuz, niteliğine göre en kısa sürede ve en geç 30 (otuz) gün içinde ücretsiz olarak sonuçlandırılır.

#### A.9.6. Политика конфиденциальности — полный текст (RU 459–460, EN 472–473, TR 485–486)

**RU — `priv_t`: «Политика конфиденциальности»**, `priv_p` (7 абзацев):

1. Мы уважаем вашу конфиденциальность. Эта политика описывает, какие данные собирает платформа ONEPLAN и как мы с ними обращаемся.
2. Сбор данных. Мы собираем только то, что вы сами указываете в форме заявки: имя, компанию, телефон, e-mail и комментарий. Локально в вашем браузере также сохраняются выбранный язык интерфейса и режим просмотра.
3. Использование. Данные нужны исключительно для связи с вами, подключения к платформе и её поддержки. Мы не рассылаем спам и не передаём контакты третьим лицам.
4. База объектов. Объекты, добавленные риэлторами, видны только проверенным участникам закрытого комьюнити. База застройщика изолирована: наружу уходит только публичная витрина, которой застройщик делится сам.
5. Безопасность. Доступ к данным ограничен ролями и правами, соединение защищено шифрованием, каждая заявка на доступ проверяется вручную.
6. Удаление. Вы можете в любой момент запросить удаление учётной записи и связанных данных, написав нам.
7. Вопросы по настоящей политике направляйте в ONETEAM İNŞAAT LTD. ŞTİ.

**EN — `priv_t`: «Privacy Policy»**:

1. We respect your privacy. This policy describes what data the ONEPLAN platform collects and how we handle it.
2. Data collection. We only collect what you provide in the request form: name, company, phone, e-mail and comment. Your chosen interface language and view mode are also stored locally in your browser.
3. Use. The data is used solely to contact you, onboard you to the platform and support you. We do not send spam and do not share contacts with third parties.
4. Property database. Objects added by realtors are visible only to verified members of the closed community. A developer’s base is isolated: only the public showcase the developer chooses to share goes outside.
5. Security. Access to data is restricted by roles and permissions, connections are encrypted, and every access request is reviewed manually.
6. Deletion. You may request deletion of your account and related data at any time by contacting us.
7. Questions about this policy: ONETEAM İNŞAAT LTD. ŞTİ.

**TR — `priv_t`: «Gizlilik Politikası»**:

1. Gizliliğinize saygı duyuyoruz. Bu politika, ONEPLAN platformunun hangi verileri topladığını ve bunları nasıl kullandığımızı açıklar.
2. Veri toplama. Yalnızca başvuru formunda kendinizin belirttiği bilgileri toplarız: ad, şirket, telefon, e-posta ve not. Seçtiğiniz arayüz dili ve görünüm modu tarayıcınızda yerel olarak saklanır.
3. Kullanım. Veriler yalnızca sizinle iletişim kurmak, sizi platforma dahil etmek ve destek vermek için kullanılır. Spam göndermeyiz, iletişim bilgilerini üçüncü kişilerle paylaşmayız.
4. Portföy veritabanı. Emlakçıların eklediği ilanlar yalnızca kapalı topluluğun doğrulanmış üyeleri tarafından görülür. Geliştiricinin veritabanı izoledir: dışarıya yalnızca geliştiricinin paylaştığı vitrin çıkar.
5. Güvenlik. Verilere erişim roller ve yetkilerle sınırlıdır, bağlantı şifrelidir ve her erişim talebi elle incelenir.
6. Silme. Hesabınızın ve ilgili verilerin silinmesini bize yazarak her zaman talep edebilirsiniz.
7. Bu politikayla ilgili sorular için: ONETEAM İNŞAAT LTD. ŞTİ.

### A.10. Дизайн-токены лендинга

| Группа | Значения |
|---|---|
| Шрифты | Manrope (h1–h4, button; 500–800), PT Sans (body, input; 400/700) |
| Фон | `#fff`; полоса фич `#f6f8fb`; серые плашки `#f0f2f6`, `#f4f6f9`; тёмная карточка формы `#14243f`, поля `#1e3050`, рамки полей `#33456a` / неактивный чип `#4a5c7e` |
| Текст | `#14243f` заголовки; `#5a6472`, `#6b7688` body; `#8a93a2`, `#9aa4b5`, `#9aa1ac` muted; в форме `#aeb9cc`, `#8fa0bd`, `#c7d0e0`; в модалке `#3d4a5f` |
| Рамки | `#e6e9f0`, `#eef1f6`, `#e2e7ef`, `#d5dce6` (кнопка Войти), hover `#b8c2d2` / `#c5cede`, dashed `#c9d2e0` |
| Синий | `#4d7cfe` (props.accent), hover `#3a63d4`, тинт `rgba(77,124,254,.12)`, плашка вкладки `#e3ebfd`, ссылка в форме `#8fb0e8`, чип роли `#a5bdff` |
| Золото | `#c9a35b` (props.gold), текст `#9c7420`, тинт `rgba(201,163,91,.16)` / `.18` / `.2`, кнопка мока `#e9d9ba`, чип роли `#e9d9ba` |
| Зелёный | `#0f9d6b` на `#e4f6ee`; `#34c383`; успех `#3ddc97` на `rgba(15,157,107,.2)`; логотип `#43a047`; WhatsApp `#25d366` |
| Прочее | красный `#e5484d` (ошибка, LIVE, точка логотипа); `#f0ad00` (бронь, логотип); `#8b5cf6` (резерв); `#cfd6e0` (продано); бейджи стадий `#7c5cd6`, `#0f9d6b`, `#3a63d4`; чипы витрины `#fdf2e4`/`#d98a1e`, `#efe9fb`/`#7c5cd6`, `#e3ebfd`/`#3a63d4`, `#e4f6ee`/`#0f9d6b`; градиент шапки проекта `#31435f → #1d2a42`; аватары `#7d9fdd`, `#c9a35b`, `#cf8f8f` |
| Радиусы | чипы 100px; кнопки 9–12; карточки 12–18; окно мока 16; крупные блоки 22–24; модалка 18 |
| Тени | мок `0 30px 70px rgba(20,36,63,.14)`; фишка `0 24px 60px rgba(20,36,63,.12)`; CTA `0 10px 26px <цвет>`; сегмент `0 6px 18px <цвет>`; hover карточки `0 14px 30px rgba(20,36,63,.09)`; модалка `0 40px 100px rgba(0,0,0,.35)` |

### A.11. Ассеты

`megapolis-photos/web-front.jpg`, `diamond-photos/IMG-20250611-WA0060.jpg`, `akropolis-photos/web-ph-1.jpg` (все существуют). Логотип — CSS (4 круга). Скриншоты секций для сверки: `landing-shots/{board,companies,objects,profile,public-hero}.png`.

### A.12. Открытые вопросы

1. Бэкенд формы (endpoint, уведомление, CRM) — отсутствует.
2. KVKK/Политика — в прототипе модалки; для SEO нужны отдельные маршруты (`/kvkk`, `/privacy`) с этими же текстами; в п. 9 KVKK не вписаны KEP- и юридический адрес.
3. «Войти» ведёт на файл `OnePlan v2.dc.html` — заменить на маршрут входа.
4. Ссылки App Store / Google Play — `href="#"`, приложений в сторах ещё нет.
5. Порядок секций в README («фишка» перед «возможностями») не совпадает с разметкой (возможности → фишка); брать разметку.
6. `<html lang>`, meta/OG под 3 языка, favicon — не заданы.
7. Tabler 3.1.0 vs 3.19.0 в остальных файлах — унифицировать.

---

## B. `OnePlan Кабинет.dc.html` — кабинет платформы застройщиков (ранняя версия)

Размер 132,7 КБ, 1033 строки. Заголовок логина — «Платформа застройщиков» (`login_sub`).

### B.1. Что это

Это **ранний/альтернативный вариант кабинета застройщиков** (предшественник `OnePlan v2.dc.html`, который описан в `OnePlan ТЗ.dc.html` и является актуальным эталоном). Отличия от v2: шрифт **Inter** (а не Manrope/PT Sans), другой цвет фона `#f7f8fb`, другие дефолтные цвета статусов (`free #43a047`, `sold #9aa1ac`, `reserve #8e63d6`), нет дашборда/чата/уведомлений, есть отдельный «Поэтажный план» (SVG) и «Сетка объекта» (текстовый редактор каркаса шахматки). Роли модели — **Администратор / Редактор / Клиент**, где «Клиент» — компания-застройщик (New Level İnşaat, Aina Yapı) с датой «Доступ до»; Admin/Editor — сотрудники платформы ONETEAM, ведущие объекты клиентов. Т. е. это кабинет оператора платформы, а не самообслуживание застройщика. Использовать как **референс идей** (мастер «Новый объект» как замена Google Drive, сетка, поэтажный план, реквизиты компании), а не как основной источник UI; при конфликте с v2/ТЗ приоритет у v2.

### B.2. Подключения (10–23)

Google Fonts Inter 400–800; Tabler 3.19.0; `body{font-family:Inter;background:#f7f8fb;color:#1b2942}`; `::placeholder #aab1bd`; keyframes `opl-bg` (fade) и `opl-card` (fade + translateY 12px).

### B.3. Пропсы, константы, state (557–610)

Пропсы (557): `lang` enum RU/EN/TR (RU); `currency` enum USD/EUR/TRY (USD) — курс `{USD:1,EUR:0.92,TRY:32}`, символ `$ € ₺` (809); `startScheme` enum board/list/floor (board); `showPricePerM2` boolean (true). Превью 100 % × 840.

Константы (561–595):
- `PROJECTS` (561–569) — 8 объектов `{id,name,loc,stage,sale,client,editor,tags[],access,mega?}`:
  1 NEW LEVEL PANORAMA · Аланья, Джикджилли · construction · 64 · New Level İnşaat · Мехмет К. · [cit,res] · 01.06.2027
  2 NEW LEVEL KLEOPATRA 1&2 · Аланья, Клеопатра · done · 12 · New Level · Ирина А. · [cit]
  3 AINA GARDEN OBA · Аланья, Оба · construction · 88 · Aina Yapı · Ольга Д. · [res] · 12.03.2027
  4 NEW LEVEL VILLAS INCEKUM · Инджекум · foundation · 9 · New Level · Мехмет К. · [cit]
  5 CITY ALANYA CENTER · Аланья, центр · construction · 120 · New Level · Ирина А. · [cit,res,com]
  6 AKROPORA KONAKLI · Конаклы · construction · 54 · New Level · Ольга Д. · [res]
  7 PREMIUM AVSALLAR · Авсаллар · done · 7 · New Level · Мехмет К. · [cit]
  8 MEGAPOLIS RESIDENCE · Аланья, Махмутлар · construction · 181 · New Level · Мехмет К. · [cit,res,com] · `mega:true`
- `MEGA_INFO` (571): plot «36 000 м²», units «406», sea «5 км», install «50%», tapu «100%».
- `USERS` (572–578): 101 admin Иван Админов admin@oneplan.pro; 102 editor Мехмет Кая mehmet@ (4 объекта); 103 editor Ирина Алиева irina@ (3); 104 client «New Level (директор)» sales@newlevel.com.tr, 6 объектов, доступ 01.06.2027, «New Level İnşaat Ltd.»; 105 client «Aina Yapı (директор)» info@ainayapi.com, 1, 12.03.2027, «Aina Yapı A.Ş.».
- `TAGCOLOR` (579): cit `#7b4fd0`/`#efe7fb`, res `#0284c7`/`#e0f2fe`, com `#b45309`/`#fef3c7`. `ROLECOLOR` (580): admin `#e5484d`/`#fdecef`, editor `#4d7cfe`/`#eef3ff`, client `#43a047`/`#e4f6ee`.
- `STORDER` = free, booked, process, sold, reserve. `GALKEYS` = all, interior, exterior, social, spa, kids, video; `GAL` — Unsplash-id по категориям (583–591), URL `https://images.unsplash.com/<id>?w=300&h=225&fit=crop`.
- `LAYOUT` = ['1+1','2+1','2+1','3+1','2+1','1+1','1*'] (7 позиций на этаже; `1*` — коммерция); `AREA` диапазоны: 1+1 52–60, 2+1 85–110, 3+1 120–145, 1* 40–70; `FLOOR_BASE` = [1,8,15,22,29,36,43,50] (номер первой квартиры этажа).

`state` (597–608): `authed:true`, `screen:'objects'` ('objects'|'object'|'users'|'profile'), `tab:'main'` ('main'|'plans'|'grid'|'io'|'fp'|'set'), `lang`, `scheme` ('board'|'list'|'floor'), `listVariant:'table'|'cards'`, `objId:1`, `galCat:'all'`, `descLang:'RU'`, `presLang:'RU'`, фильтры `fRoom,fSt,aMin,aMax,pMin,pMax`, `colors:{free:'#43a047',booked:'#f0ad00',process:'#4d7cfe',sold:'#9aa1ac',reserve:'#8e63d6'}`, `features:['Вид на море','Первая линия','Угловая','Терраса','С мебелью','Под гражданство']`, `newFeat`, `fCur:3` (текущий этаж плана), `uRole:'all'`, `megaCell:null`, `addOpen:false`, `addStep:0`, `addComm:false`, `gridText:'1 2 3 4 5 6 7\n8 9 10 11 12 13 14\n15 16 17 18 19 1*\n22 23 24 25 26 27 28'`, `units:genUnits()`, `modalNum:null`, `mStatus`, `mFeats:[]`, `fpCardNum:null`.

`genUnits()` (768–781): детерминированный LCG (`x=7`), 8 этажей × 7 позиций; `area` случайно в диапазоне типа; `price = round(area*(3400+600*r)/1000)*1000`; статус: 3 % reserve, далее `sold` с вероятностью `0.4*floor/7`, +5 % booked, +3 % process, иначе free. Поле `{num,floor,pos,type,area,price,status,feats}`.

`megaBlocks()` (782–807): захардкоженная «мозаика» блока A MEGAPOLIS: этажи 7…1 и G (цоколь), у каждого две ленты `out` (внешний фасад) и `ins` (двор), ячейки `u(n,type,area,price|'SOLD',tag)` с тегами `terrace`, `duplex`, `kapici` (служебная). Данные — реальный прайс (например 105 · 3+1 · 105 м² · 350 500; 64 · 3+1 · 159 · 495 600 duplex; 101 · 3+1 · 214 · 706 200 duplex на G и 2-м).

### B.4. Экраны

| Строки | Экран / блок | Контролы и поведение |
|---|---|---|
| 26–39 | **Логин** (`showLogin = !authed`): fixed overlay `linear-gradient(135deg,#14243f,#1e3a63)` + `rgba(14,23,42,.55)`; карточка 380px radius 18 padding 34 shadow `0 30px 80px rgba(0,0,0,.4)`; языки (стиль `lb.style` 859: 12px/700 `#4d7cfe` активный / `#8a93a2`); логотип 4 круга 12px + «OnePlan» 22px/800; `t.login_sub` 15px/600 `#6b7688`; поля email (`admin@oneplan.pro`) и пароль (`password`) — `border #e6e9f0;radius 10;padding 12px 13px;14px`, focus `#4d7cfe`; «Забыли пароль?» 13px `#4d7cfe`; кнопка `#4d7cfe` radius 11 padding 13 15px/600 hover `#3a63d4` → `login` (`authed:true, screen:'objects'`). | Валидации нет |
| 43–50 | **Шапка** (sticky 62px, `#fff`, border-bottom `#e6e9f0`, `overflow-x:auto`): логотип → `goObjects`; вкладки `nav(on)` (854): 15px, `border-bottom:2px solid #4d7cfe|transparent`, active `#14243f` 600 — «Объекты» (`ti-building-community`, активна на objects/object), «Пользователи» (`ti-users`); языки (пилюля `#f0f2f6`, `lb.navStyle` 860); профиль (аватар 34px `#e7eaf0` `ti-user`, «Admin» 14px/600, `t.role_admin` 12px) → `goProfile`. |
| 52–57 | **Подвкладки объекта** (`isObject`, sticky top 62, 50px): «← `t.back_objects`» → `backToObjects`; `subtabsView` (863): Объект / Планировки / Сетка / Экспорт-импорт / Поэтажный план / Настройки; стиль `stBase` 15px, `border-bottom 2px` активной. **Баг прототипа:** для вкладки `fp` нет блока разметки (`isTabFp` вычисляется в 1010, но не используется) — клик по «Поэтажный план» показывает пустую страницу; поэтажный план живёт внутри «Планировки» как схема `floor`. |
| 61–100 | **Объекты** (`isObjects`): H1 28px/800 `t.obj_title`; подпись `t.obj_sub · objCount`; фильтры-селекты (кастомная стрелка `ti-chevron-down` `#9aa1ac`, `appearance:none;padding 9px 30px 9px 12px;border #e6e9f0;radius 10;14px`): «Все клиенты / New Level İnşaat / Aina Yapı», «Все стадии / Котлован / Строится / Сдан» (не подключены к данным); кнопка «+ Добавить объект» `#14243f` radius 10 padding 10px 16px hover `#1e3454` → `openAdd`. Таблица (min-width 820): th 13px/600 `#6b7688` `#fafbfd`; колонки ID (`#8a93a2`) · Название (700 `#14243f`) · Локация · Стадия · В продаже (`{sale} →` `#4d7cfe` 600) · Назначение (теги `tagV` 856: 11px/600 radius 6 padding 3px 8px) · Клиент · Редактор · Доступ до; строка hover `#f8faff` → `openObject(id)`. |
| 102–158 | **Объект → Основное** (`isTabMain`): хлебные крошки; H1 `obj.name`; теги. Карточки (`#fff;border #e6e9f0;radius 14;padding 22`, h3 16px/700): **Основная информация** — Название (input `obj.name`, bg `#fbfcfe`), Стадия (select `stageOptions`), Назначение (чипы `purposeView` 950: активные `#4d7cfe`/`#eef3ff`, radius 18); **Локация** — Долгота `32.0669`, Широта `36.5516`, Адрес `obj.loc`, заглушка карты 120px `linear-gradient(135deg,#e8eef7,#dde6f2)` с `ti-map-pin-filled` `#4d7cfe` 32px; **Галерея** — чипы категорий `galCatsView` (943: активный `#14243f` белый, radius 20, padding 8px 13px), «+ Добавить фото», grid `auto-fill minmax(150px,1fr)` `aspect-ratio 4/3` radius 10, `galImages` по `galCat`; **Ход строительства** — 3 записи (`prog1_date/prog1` + ссылка «LIVE-камера» `ti-video`, `prog2`, `prog3`; разделители dashed), кнопка «Добавить этап / LIVE»; **Описание · язык** — чипы RU/EN/TR/AR (`langChip` 945), textarea `descText` из `descMap` (948, 4 языка, включая арабский); **Презентация · генплан** — чипы RU/EN/TR, файл «Презентация» (PDF / JPEG / Word, «Скачать» зелёный чип) и «Генплан» (`ti-map-2`, «Открыть»); **Документы 🇹🇷** — `docsTr` (951): Yapı Ruhsatı (Получен), İskan (К сдаче), Tapu · Kat İrtifakı (Оформляется), DASK (К сдаче); статусы `dstat` (812): ok `#e4f6ee/#0f9d6b`, wait `#fdf3d7/#b7791f`, soon `#eef1f5/#8a93a2`; «+ Добавить документ». Низ: «Обновить» (`#4d7cfe`, `ti-device-floppy`) и «Удалить объект» (`#e5484d`, `ti-trash`) — без обработчиков. |
| 160–311 | **Планировки** (`isTabPlans`): H1 + переключатель схем `schemeView` (929–931): Шахматка (`ti-layout-grid`) / Список (`ti-list`) / Поэтажный план (`ti-stack-2`; для `mega` скрыт, `floor` принудительно → board); стиль `sc(on)` 14px/600 radius 10 padding 9px 16px, активная `#14243f` белая. **Фильтры** (167–175, скрыты при `floor`): Корпус (Блок A / Блок B, декоративный), Комнаты (Все/1+1/2+1/3+1/Коммерция → `fRoom`), Площадь min–max (`aMin/aMax`, placeholder 45/221), Стоимость (`pMin/pMax`, 0/600000), Статус (`statusOptions` → `fSt`). Фильтрация `pass(u)` (866) не скрывает, а **приглушает** клетки (`opacity .28`; в мозаике .26). |
| 177–235 | **Шахматка**: **обычная** (`isRegularBoard`, 212–234): строки этажей 7…0, слева и справа плашка номера 32px `#eef0f4` `#aab1bd`; клетка `cellBase` (867): `radius 11;padding 11px 13px;color #fff;min-height 84;flex 1;min-width 170;column;space-between;background <colors[status]>`; содержимое: тип + номер 13px/600, цена 19px/800 (`money()` — `Intl ru-RU` + символ), площадь `м²` 11px + `perM2` (если `showPricePerM2`); проданная — центрированная надпись `t.sold_word` 15px/700; hover `translateY(-2px);shadow 0 8px 20px rgba(20,36,63,.16)`; клик → `openUnit(num)`. Легенда (231–233): «Всего» `#14243f` + 5 статусов с количествами (`legend` 879). **Мозаика MEGAPOLIS** (`isMega`, 178–211): 5 инфо-плашек `megaInfo` (label 12px, value 19px/800); заголовок «Блок A» (белый на `#14243f`, radius 8); этаж — плашка 52px (`f.label` 17px/800 + `floorSuffix` «эт.»), две ленты с подписью стороны 64px 10px uppercase `#aab1bd` («Внешний фасад» / «Внутренний двор»); ячейка `mcell` (890–901): `min-height 92;min-width 148`, цвет `colors.free|sold`, цена `€ N`, бейдж тега (`badge_terrace` `#0284c7`, `badge_duplex` `#b45309`, `badge_kapici` `#6b7688`) на `rgba(255,255,255,.9)`, дуплекс — `outline 2px solid #b45309`; клик → `megaCell`. Легенда: Свободно / Продано / Дуплекс / Терраса с количествами (906). |
| 237–281 | **Список**: переключатель Таблица/Карточки (`lv` 925: активный `#4d7cfe` на `#eef3ff`), счётчик `listCount t.units_count`. Таблица (243–268): № · Этаж · Тип · Площадь · Цена · Цена/м² · Статус (чип `statusStyle` radius 20 белый текст на цвете); сортировка этаж desc, pos asc. Карточки (269–280): grid `auto-fill minmax(240px,1fr)`: «№ N» 17px/800 + чип, «тип · этаж N», цена 21px/800, площадь / за м². Клик → модалка. Для `mega` список строится из мозаики (910–918). |
| 283–310 | **Поэтажный план** (`isSchemeFloor`): кнопки «Добавить план этажа» (`ti-upload`, тёмная) и «Режим обводки» (`ti-pencil`, белая) — декоративные; подсказка `t.fp_hint`. Левая колонка 150px: «Дом 1 · Активен» (`#eef3ff`/`#d4e0ff`), «Дом 2 · 58 свободно», подпись «Этаж», кнопки этажей 7…0 (`floorButtons` 953, активная `#14243f`). Справа — SVG `buildFloor()` (819–848): viewBox 1100×560, подложка `rect 60,70 980×450 rx14 #fbfcfe/#e6e9f0`, вертикальная подпись «Курортный проспект» (`svg_avenue`), блок «лифт / лестница» 100×60 `#eef0f4`; квартиры текущего этажа делятся на 2 ряда (y 110 и 330, высота 170, x от 120 до 980, gap 10), плитка `rect rx6 fill=<цвет> fillOpacity .13 (.4 у проданных) stroke 2px`, внутренние линии-перегородки (55 % ширины, 50 % высоты, opacity .3), круг 13px + белая точка, подпись «№N» 13/700 и «тип · м²» 11px; клик → `openFp(num)` → всплывающая карточка (298–307): «Квартира №N» 17px/800, подпись, старая цена зачёркнутая (`price*1.12` округлённая до 1000), цена 21px/800 **`#e5484d`**, статус с квадратиком, «Открыть карточку» → модалка. |
| 313–327 | **Сетка** (`isTabGrid`): H1 `t.grid_title`, описание `t.grid_desc`; карточка «Секции» + «Добавить секцию»; блок секции (`#fafbfd`): инпут названия «Блок A», кнопки редактировать/удалить; monospace-textarea `gridText` (`onGridText`), пример `t.grid_ex`; «Предпросмотр сетки:» — `gridPreview` (933–934): строки снизу вверх (номер этажа = `glines.length - i`), клетки 40×32 radius 6 белый текст, `#4d7cfe`, с `*` — `#b45309`. |
| 329–343 | **Экспорт-импорт** (`isTabIO`): «Импорт» — `io_import_desc`, кнопка «Импорт данных (.CSV)» (`ti-upload`); «Экспорт» — селект валюты USD/EUR/TRY + «Экспорт данных (.CSV)» (`ti-download`); `io_fields`: «ID Объекта · Секция · Номер помещения · Статус · Этаж · Площадь · Кол-во комнат · Стоимость · Валюта · Особенности». Без обработчиков. |
| 345–363 | **Настройки** (`isTabSet`): **Цвета шахматки** — 5 `input[type=color]` (`colorRows` 936 → `state.colors[k]`), кнопка «Применить и открыть шахматку» → `tab:'plans', scheme:'board'`; **Особенности квартир** — чипы `featChips` с `×` (удаление), инпут `newFeat` + «Добавить» (`addFeat` 817, trim, пустые игнорируются); **Изображения планировок** — текст + кнопка «Загрузить планировки» (`ti-photo-plus`). |
| 365–397 | **Пользователи** (`isUsers`): H1, подпись `users_sub · userCount`; селект ролей (`uRole` all/admin/editor/client); «+ Добавить пользователя»; таблица ID · Роль (чип `ROLECOLOR`) · ФИО · Почта (логин) · Объектов · Доступ до · Компания. Строки без обработчика. |
| 399–423 | **Профайл** (`isProfile`): «Данные» — Роль (disabled `#f0f2f6`), ФИО «Иван Админов», Почта; «Реквизиты компании — для Клиентов» — Название и форма организации (placeholder «New Level İnşaat Ltd. Şti.»), ФИО директора, ИНН / Vergi No, БИК банка, Счёт / IBAN; «Изменение пароля» — Новый пароль + `pass_hint` («Минимум 6 знаков: латиница, минимум одна цифра, заглавная, строчная и символ.») + «Сохранить пароль» (`ti-lock`); «Выйти из платформы» (`#e5484d`) → `logout` (`authed:false`). |
| 429–528 | **Мастер «Новый объект»** (`isAddObject`, fixed overlay `#f7f8fb` z 120, `opl-bg .2s`): шапка — иконка 38px `#4d7cfe` `ti-building-plus`, `wz.title` 18px/800, бейдж «Замена Google Drive» (`ti-cloud-off`, `#0f9d6b` на `#e4f6ee`), «Шаг N из 6», крестик 38px → `closeAdd`; прогресс 4px `#eef0f4`/`#4d7cfe` шириной `addPct = round(step/5*100)%`. Левая колонка 250px — шаги `addSteps` (972–983): `[info 'ti-info-circle' 'INFO'] [media 'ti-photo' 'PHOTO · VIDEO'] [plans 'ti-stack-2' 'FLOOR PLANS · LAYOUTS'] [docs 'ti-files' 'CATALOG · RUHSAT · PRICE LIST'] [comm 'ti-building-store' 'TİCARİ · КОММЕРЦИЯ'] [done 'ti-circle-check' '']`; строка `rowStyle` (активная `#eef3ff`), точка 34px (`active #4d7cfe/#fff`, `done #e4f6ee/#0f9d6b` с `ti-check`, иначе `#eef0f4/#8a93a2`), подпись «📁 папка» 11px `#aab1bd`; клик по шагу — прямой переход. Правая: H2 `addTitle` 23px/800 + чип «заменяет папку X». Шаги: **Основное** (454–465) — Название (placeholder «MEGAPOLIS RESIDENCE»), Стадия, Адрес («Аланья, Махмутлар»), чипы назначения; **Фото и видео** (467–475) — две drop-зоны (`border 2px dashed #cdd5e2;radius 16;padding 32px 20px;bg #fbfcfe`, hover `#4d7cfe`/`#f5f8ff`, иконка 52px `#eef3ff`): `drop_photos/_sub`, `drop_video/_sub`; **Планировки** (477–485) — «FLOOR PLANS» `drop_plans`, «LAYOUTS» `drop_layouts`; **Каталог и документы** (487–494) — 3 строки-загрузки: Презентация / каталог (`ti-file-type-pdf`, синий), Разрешение (Ruhsat) (`ti-certificate`, `#fdf3e6/#b45309`), Прайс-лист (`ti-table`, зелёный); **Коммерция** (496–506) — вопрос `comm_q`, две карточки-выбора (`commYesStyle/commNoStyle` 1000–1001: `border 2px #4d7cfe;#eef3ff` у выбранной), при «да» — поле «Кол-во коммерческих помещений» (placeholder 12); **Проверка** (508–516) — `review_sub`, карточка «Почти готово» (`ti-checks`), grid `reviewItems` (5 шагов с папками, `ti-circle-check-filled` `#0f9d6b`). Футер: «Отмена», «← Назад» (не на первом), «Далее →» (`#4d7cfe`) / «✓ Создать объект» (`#0f9d6b`, hover `#0c8a5e`) → `createObject` (закрывает мастер; объект **не создаётся**). |
| 530–555 | **Модалка квартиры** (`modalOpen`): overlay `rgba(0,0,0,.4)` z 90, карточка 640px radius 16 max-height 90vh `opl-card`; шапка «№ N» 20px/800 + `modal.sub` («{obj.name} · этаж N · тип» / для mega «MEGAPOLIS · Блок A · N эт. · тег»); тело: изображение планировки `planImg` (Unsplash `photo-1503387762-592deb58ef4e` 400×400) + строки Тип / Площадь / Цена / Цена за м²; «Статус продажи» — grid 2 колонки `statusBtns` (961: рамка `2px solid <цвет>` у выбранного, квадратик 10px), для mega только Свободно/Продано (967, «Свободно» ставит цену 200 000 если была SOLD); «Особенности квартиры» — чипы `modalFeats` (toggle `mFeats`). Футер: Отмена / Сохранить → `saveUnit` (816: записывает `status` и `feats` в `units`). |

### B.5. i18n (611–767)

`buildI18N()` возвращает `{RU, EN, TR}`; **RU 613–663**, **EN 664–714**, **TR 715–765**. Структура ключей (RU-значения — единственный источник копирайта, EN/TR — переводы 1:1):

- Логин: `login_sub` «Платформа застройщиков», `login_email`, `login_pass`, `login_forgot` «Забыли пароль?», `login_enter` «Войти».
- Навигация: `nav_objects` «Объекты», `nav_users` «Пользователи», `role_admin` «Администратор», `back_objects` «К объектам»; вкладки `tab_main` «Объект», `tab_plans` «Планировки», `tab_grid` «Сетка», `tab_io` «Экспорт-импорт», `tab_fp` «Поэтажный план», `tab_set` «Настройки».
- Список объектов: `obj_title` «Объекты», `obj_sub` «Список объектов застройки», `f_all_clients`, `f_all_stages`, `btn_add_object`; th: `th_id` ID, `th_name` Название, `th_loc` Локация, `th_stage` Стадия, `th_sale` В продаже, `th_purpose` Назначение, `th_client` Клиент, `th_editor` Редактор, `th_access` Доступ до.
- Словари: `stages{foundation:Котлован, construction:Строится, done:Сдан}`, `tags{cit:Гражданство,res:Под ВНЖ,com:Коммерция}`, `purpose{cit:Под гражданство,res:Под ВНЖ,com:Коммерция}`, `status{free:Свободно,booked:Бронь,process:Оформление,sold:Продано,reserve:Резерв}`, `cats{all:Все,interior:Интерьер,exterior:Экстерьер,social:Социальная часть,spa:Спа,kids:Детская комната,video:Видео}`, `docstatus{ok:Получен,wait:Оформляется,soon:К сдаче}`, `roles{admin:Администратор,editor:Редактор,client:Клиент}`, `docsub{yapi:Разрешение на строительство,iskan:Акт ввода,tapu:Предв. титул,dask:Страхование от землетрясений}`.
- Карточка объекта: `main_info` «Основная информация», `fld_name` «Название КП или ЖК», `fld_stage` «Стадия строительства», `fld_purpose` «Назначение (Турция)», `loc_title` «Локация», `fld_lng` «Долгота», `fld_lat` «Широта», `fld_addr` «Адрес», `gallery` «Галерея», `btn_add_photo`, `progress` «Ход строительства», `prog1_date` «Июнь 2026», `prog1` «Фасадные работы блока A», `live` «LIVE-камера», `prog2_date` «Март 2026», `prog2` «Монолит завершён (8 этажей)», `prog3_date` «Окт 2025», `prog3` «Фундаментная плита», `btn_add_stage` «Добавить этап / LIVE», `desc` «Описание», `lang_word` «язык», `pres` «Презентация · генплан», `pres_file` «Презентация», `masterplan` «Генплан», `masterplan_fmt` «PDF / изображение», `btn_download`, `btn_open`, `docs` «Документы», `btn_add_doc`, `btn_update` «Обновить», `btn_delete_obj` «Удалить объект».
- Планировки: `plans_title`, `scheme_board/list/floor`, `f_block` «Корпус», `f_rooms`, `f_area` «Площадь, м²», `f_price` «Стоимость», `f_status`, `opt_all`, `rooms_commercial` «Коммерция», `block_a/b`, `legend_total` «Всего», `sold_word` «Продано», `lv_table` «Таблица», `lv_cards` «Карточки», `units_count` «квартир», `th_num/th_floor/th_type/th_areaShort/th_price/th_pricem2`; поэтажный план: `fp_add_floor`, `fp_trace` «Режим обводки», `fp_hint`, `house` «Дом», `active` «Активен», `free_suffix` «свободно», `floor_word` «Этаж», `apt` «Квартира №», `open_card`, `word_floor` «этаж», `word_commercial` «коммерция», `svg_lift` «лифт / лестница», `svg_avenue` «Курортный проспект»; mega: `mega_plot` «Площадь участка», `mega_units` «Квартир», `mega_sea` «До моря», `mega_install` «Рассрочка», `mega_tapu` «Стоимость в ТАПУ», `band_out` «Внешний фасад», `band_in` «Внутренний двор», `ground` «Цоколь», `floor_short` «эт.», `block` «Блок», `badge_terrace` «Терраса», `badge_duplex` «Дуплекс · 2 эт.», `badge_kapici` «Служебная», `more_units` «ещё».
- Сетка: `grid_title` «Сетка объекта», `grid_desc` «Каркас шахматки: секции, этажи, номера помещений. Номера через пробел, новая строка — новый этаж. «1*» — коммерческое помещение.», `sections`, `btn_add_section`, `grid_ex` «Пример: «15 16 17 18 19 1*» — на этаже 1* коммерческое помещение. Объединение ячеек — в режиме редактирования.», `grid_preview`.
- IO: `io_title` «Экспорт-импорт данных», `io_import`, `io_import_desc` «Загрузите CSV — данные по помещениям обновятся массово.», `io_import_btn` «Импорт данных (.CSV)», `io_export`, `io_export_btn` «Экспорт данных (.CSV)», `io_fields`.
- Настройки: `set_title`, `set_colors` «Цвета шахматки», `set_colors_desc` «Своя цветовая гамма статусов для этого объекта.», `set_apply` «Применить и открыть шахматку», `set_feats` «Особенности квартир», `set_feats_desc` «Метки для каталога. Привязываются к квартирам в модалке планировки.», `set_new_feat`, `btn_add`, `set_plans` «Изображения планировок», `set_plans_desc` «Загрузка планировок с привязкой к квартирам (+ дозагрузка изображений для многоэтажных квартир / вилл).», `set_plans_btn`.
- Пользователи: `users_title`, `users_sub` «Только для администраторов», `f_all_roles`, `role_admins/editors/clients`, `btn_add_user`, `th_role`, `th_fio` «ФИО», `th_mail` «Почта (логин)», `th_objcount` «Объектов», `th_company`.
- Профайл: `prof_title` «Профайл», `prof_sub` «Ваши данные и безопасность», `prof_data`, `fld_role`, `fld_fio`, `fld_email`, `prof_company` «Реквизиты компании», `prof_forclients` «— для Клиентов», `fld_org`, `fld_director`, `fld_tax` «ИНН / Vergi No», `fld_bik` «БИК банка», `fld_iban` «Счёт / IBAN», `prof_pass`, `fld_newpass`, `pass_hint`, `btn_save_pass`, `btn_logout` «Выйти из платформы».
- Модалка: `m_type`, `m_area`, `m_price`, `m_pricem2` «Цена за м²», `m_status` «Статус продажи», `m_feats` «Особенности квартиры», `m_cancel`, `m_save`.
- Мастер `wz` (648–663): `title` «Новый объект», `step` «Шаг», `of` «из», `back`, `next` «Далее», `create` «Создать объект», `cancel`, `replaces` «заменяет папку», `migrate` «Замена Google Drive», `optional`, `s_info` «Основное», `s_media` «Фото и видео», `s_plans` «Планировки», `s_docs` «Каталог и документы», `s_comm` «Коммерция», `s_done` «Проверка», `info_hint` «Название, стадия, назначение и расположение объекта.», `drop_photos` «Перетащите фотографии», `drop_photos_sub` «или нажмите · JPG, PNG, HEIC до 20 МБ», `drop_video` «Ссылки на видео или файлы», `drop_video_sub` «YouTube, Vimeo, MP4 — облёты, ролики, LIVE», `plans_hint` «Планы этажей и планировки квартир — из них соберётся шахматка.», `drop_plans` «Планы этажей», `drop_plans_sub` «PDF, PNG, DWG — по одному на этаж/секцию», `drop_layouts` «Планировки квартир», `drop_layouts_sub` «PNG, JPG — привяжутся к типам и номерам», `docs_hint` «Материалы для клиентов и юридические документы.», `cat_present` «Презентация / каталог», `cat_present_sub` «PDF, PPTX, Word», `cat_ruhsat` «Разрешение (Ruhsat)», `cat_ruhsat_sub` «PDF — Yapı Ruhsatı, İskan», `cat_price` «Прайс-лист», `cat_price_sub` «CSV, XLSX, PDF — импорт в шахматку», `comm_q` «В объекте есть коммерческие помещения?», `comm_hint` «Магазины, офисы, кафе на первых этажах (папка TİCARİ).», `comm_yes` «Да, есть коммерция», `comm_no` «Нет, только жильё», `comm_count` «Кол-во коммерческих помещений», `review_title` «Почти готово», `review_sub` «Всё, что раньше лежало в папках Google Drive, теперь собрано в одном объекте.», `filled`, `create_done` «Объект создан».

### B.6. Модели данных

```ts
Project { id:number; name; loc; stage:'foundation'|'construction'|'done'; sale:number; client; editor; tags:('cit'|'res'|'com')[]; access:string /*дата*/; mega?:boolean }
Unit { num:number; floor:0..7; pos:0..6; type:'1+1'|'2+1'|'3+1'|'1*'; area:number; price:number /*USD*/; status:'free'|'booked'|'process'|'sold'|'reserve'; feats:string[] }
MegaCell { n:number; t:string; a:number; p:number|'SOLD' /*EUR*/; tag:'terrace'|'duplex'|'kapici'|null }  // Block { name; floors:[{label, ground?, out:MegaCell[], ins:MegaCell[]}] }
User { id; role:'admin'|'editor'|'client'; fio; mail; objects:number|'—'; access:string|'—'; company }
ObjectColors { free, booked, process, sold, reserve }  // per object
GridText: string  // строки = этажи (сверху), токены = номера, '*' = коммерция
```

### B.7. Токены кабинета

Шрифт Inter; фон `#f7f8fb`, карточки `#fff`, поля `#fbfcfe`, серые плашки `#eef0f4`, `#f0f2f6`, `#fafbfd`; текст `#1b2942` body, `#14243f` заголовки, `#6b7688` label, `#8a93a2`/`#aab1bd`/`#9aa1ac` muted, `#5c6675`; рамки `#e6e9f0`, dashed `#e6e9f0`; синий `#4d7cfe` (hover `#3a63d4`, тинт `#eef3ff`, рамка `#d4e0ff`); тёмная кнопка `#14243f` hover `#1e3454`; зелёный `#0f9d6b`/`#e4f6ee`, hover `#0c8a5e`, `#43a047`; красный `#e5484d`/`#fdecef`; тёплый `#b45309`/`#fef3c7`/`#fdf3e6`; фиолетовый `#7b4fd0`/`#efe7fb`, `#8e63d6`; голубой `#0284c7`/`#e0f2fe`; радиусы 6–16 (кнопки 9–11, карточки 12–16, чипы 18–20/100); тени hover `0 8px 20px rgba(20,36,63,.16)`, модалка `0 30px 80px rgba(0,0,0,.35)`.

### B.8. Открытые вопросы кабинета

1. Вкладка «Поэтажный план» пустая (нет разметки для `isTabFp`) — либо убрать из подвкладок, либо перенести схему `floor`.
2. Кнопки «Обновить», «Удалить объект», «Добавить фото/этап/документ/секцию/пользователя», импорт/экспорт, drop-зоны мастера — без логики.
3. Модель «Клиент = компания-застройщик» и «Доступ до» — противоречит модели v2/ТЗ (где роли: супер-админ, администратор компании, менеджер). Уточнить, актуальна ли.
4. Цены: обычные объекты в USD, MEGAPOLIS в EUR — смешение валют.
5. Галерея и план — Unsplash-заглушки.

---

## C. Мобильное приложение: `OnePlan App.dc.html`, `OnePlan App Риэлторы.dc.html`, `OnePlan Приложение.dc.html`

### C.1. Нативное приложение или mobile-web?

Это **концепт нативного мобильного приложения (iOS/Android)**, спроектированный как HTML-макет экрана 402×874:

- `OnePlan Приложение.dc.html` вставляет `OnePlan App` в рамки устройств `IOSDevice` (402×874, `top-inset=62` — статус-бар, `bottom-inset=16` — home-индикатор) и `AndroidDevice` (412×892, `top-inset=0`, `bottom-inset=6`); подпись «Мобильное приложение для застройщиков · кликабельный прототип»; лендинг показывает кнопки App Store / Google Play и текст `app_note` («Мобильное приложение — для удобной работы на ходу… Полное управление… — на сайте»); в профиле — push-уведомления, «язык определяется по системе», «Оплата откроется на сайте OnePlan (как Spotify)» (обход комиссий сторов); свайпы галерей через touch-события.
- Сам макет — обычный HTML/CSS (flex-колонка `height:100%`, таббар внизу, bottom-sheet), поэтому его можно один в один собрать как **мобильный web-layout / PWA на Next.js** (маршрут `/app` с `max-width:402px` в десктопе или fullscreen на телефоне) — и использовать как визуальный референс для React Native/Expo. Пропсы `topInset/bottomInset` соответствуют `env(safe-area-inset-*)`.

Два файла — два продукта: **App** — для застройщика (`Mehmet Aydın · New Level İnşaat`), **App Риэлторы** — для риэлтора (`Ирина Ковалёва · Compass Realty`). Общая оболочка одинаковая (шапка 52px, таббар 5 вкладок, сетка цветов), различаются экраны.

### C.2. Общая оболочка (обе версии)

- Шрифты Manrope 500–800 + PT Sans 400/700; Tabler 3.19.0. `body{background:#f6f8fb;color:#14243f}`; keyframes `opRise`, `opFade`, `opSheet` (translateY 100 % → 0), в App ещё `opBlink`.
- Корень: `height:100%;flex column;overflow hidden;position relative` (App 29 / Риэлторы 30). Сверху `topPadStyle` (белая полоса высотой `topInset`), внизу таббар и `bottomPadStyle`.
- **Шапка** (App 33–39 / Р 34–40): `#fff;border-bottom #eef1f6;gap 10;padding 8px 14px;min-height 52px`. Кнопка «назад» 36px radius 11 `#f0f2f6` `ti-arrow-left` (`showBack`); логотип (11px точки + «OnePlan» 18px/800 Manrope, только на главной); `headerTitle` 16.5px/800 Manrope с ellipsis + `headerSub` 11px/700 `#0f9d6b` (статус «в сети» / агентство); колокольчик 36px `ti-bell` с точкой 8px `#e5484d` (`notifDot`) → `goNotif`.
- **Таббар** (App 357–364 / Р 505–512): `#fff;border-top #eef1f6;padding 6px 8px 2px`; вкладка `flex 1;column;gap 3;padding 7px 0 6px;min-height 48;radius 10`, цвет активной `#4d7cfe`, иначе `#8a93a2` (Р: `#9aa4b5`); иконка 21px, подпись 9.5px/700 Manrope; бейдж `absolute;top -4;right -10;min-width 15;height 15;radius 8;#e5484d;9px/800`.
- Сегмент-контрол `seg(on)` (App 626 / Р 622): контейнер `#eaedf3;radius 11;padding 4;gap 4`; кнопка `flex 1;min-height 38;radius 8;13px/700 Manrope`; активная `#fff;color #14243f;box-shadow 0 1px 4px rgba(20,36,63,.14)`.
- Тумблер `tog(on)` (App 732): `47×28;radius 14;padding 3;background #34c383|#dfe4ec;justify-content flex-end|flex-start`, кружок 22px белый с тенью. В Р: `44×26`, `#34c383|#d5dce6`.
- Языковые кнопки (App 733–734): `min-width 40;min-height 32;radius 9;12px/700;active #14243f/#fff, else #f0f2f6/#5a6472`.

### C.3. `OnePlan App.dc.html` — приложение застройщика (800 строк)

Пропсы (399): `topInset`, `bottomInset` (number, 0), `currency` enum `€ $ ₺` (€), `startRole` enum `manager|owner` (manager), `lang` enum ru/en/tr (ru), `emptyToday` boolean (false). Превью 402×874.

`state` (578–585): `tab:'home'` ('home'|'objects'|'chats'|'notif'|'profile'), `objId:null`, `objTab:'board'` ('board'|'docs'|'pub'), `chatId:null`, `sel:null` ({cell,obj}), `role`, `lang`, `notifOn:true`, `pubOn:true`, `copied:false`, `draft:''`, `typing:false`, `notifSeen:false`, `rev:0` (счётчик перерисовки), `boardView:'grid'|'list'`, `boardType:null`, `boardStatus:null`, `selMonth:5`, `chatUnread:[2,1,0]`, `chatExtra:[[],[],[]]`; динамические: `floorScheme` ('num'|'z'|'g'), `tileInfo` ('m2'|'price'), `aiTr` (bool), `trOrig` (map).

**Данные** (401–576):
- Генератор шахматки `mk(seed,minFloor,maxFloor,cols,base)` (405–434): по колонкам, снизу вверх; спецплитки для seed 1: col 0 f 0 — триплекс 5+1 (h 3), col 1 f −1 — терс-дуплекс 3+1 (h 2), col 2 f −2 — триплекс; этажи <1 иначе пропускаются; на 1-м этаже «садовые» колонки (`(c+seed)%4==0`) — дуплекс 3+1; за 2 этажа до верха при `(c+seed)%5==0` — триплекс 5+1; за 1 — при `(c+seed)%3==1` дуплекс 4+1; иначе тип из `['1+1','2+1','3+1','2+1','1+1','3+1','2+1']`. `m2 = M2[type] + hash(0..8) − 4` (`M2`: 1+1 52, 2+1 73, 3+1 96, 4+1 142, 5+1 188); `price = m2*base`; статус по хэшу: этажи ≤2 — 70 % sold / 20 % proc / 10 % free; верхние два — 60 % free / 20 % res / 20 % hold; остальные — из массива `['free','sold','res','free','proc','sold','free','hold','res','free']`. Номер `no = <этаж|'Z'|'B'+n> + pad2(col+1)`. Поля `{col,floorStart,floorEnd,h,kind:'flat'|'duplex'|'triplex'|'ters2',type,m2,price,st,no,histKey}`.
- `objects` (435–439): 0 «MEGAPOLIS RESIDENCE» · Antalya · Altıntaş · `megapolis-photos/web-front.jpg` · стадия build (`#fff4d6`/`#9c7420`) · готовность 68 · теги TAPU, VNJ · блок «Блок B» · `mk(1,-2,9,16,2600)` · `one-plan.pro/megapolis`; 1 «AKROPOLIS» · Alanya · Oba · `akropolis-photos/web-ph-1.jpg` · done (`#e4f6ee`/`#0f9d6b`) · 100 · TAPU, İskan · «Блок A» · `mk(2,1,7,10,2100)` · `one-plan.pro/akropolis`; 2 «AVOCADO VILLAGE» · Alanya · Avsallar · `avocado-photos/web-v5556-1.jpg` · start (`#e3ebfd`/`#3a63d4`) · 22 · VNJ · «Виллы» · `mk(3,1,5,6,3400)` · `one-plan.pro/avocado`.
- Статусы `ST` (440–446): free `#34c383`/тинт `#e4f6ee`/deep `#0f9d6b`; res `#f0ad00`/`#fff4d6`/`#9c7420`; proc `#4d7cfe`/`#e3ebfd`/`#3a63d4`; sold `#cfd6e0`/`#f0f2f6`/`#5a6472`; hold `#8b5cf6`/`#ede9fd`/`#6d4fd0`. Подписи `STL` (ед. ч.: Свободна/Бронь/Оформление/Продана/Резерв; EN Available/Reserved/Processing/Sold/Blocked; TR Müsait/Rezerve/İşlemde/Satıldı/Bloke) и `STPL` (мн. ч.: Свободно/Брони/Оформление/Продано/Резерв). `KINDL`: Дуплекс/Триплекс/Терс-дуплекс. `STAGEL`: build «Строится», done «Сдан · İskan», start «Старт продаж».
- `MON` (Фев…Июл), `REV` = [720000, 985000, 840000, 1150000, 1072000, 1265000] (€).
- `DOCS` (469–475): Прайс-лист · июль 2026 (PDF · 2,4 MB, `ti-file-type-pdf` `#fde8e8`/`#e5484d`), Планировки этажей (JPEG · 8, `ti-layout-2`), Шаблон договора (DOCX · 340 KB, `ti-file-text`), Vaziyet · генплан (JPEG · 1,8 MB, `ti-map-2` зелёный), Презентация объекта (PDF · 12 MB, `ti-presentation` `#fff4d6`/`#9c7420`).
- `EVENTS` (476–480, «Сегодня»): «Бронь № 507 · MEGAPOLIS · Selin Erdem» 12:40; «№ 205 · AKROPOLIS — продана» 11:05; «Новый вопрос по AVOCADO VILLAGE» 09:32.
- `NOTIFS` (481–487): day 0 (fresh): «Selin поставила бронь на № 507 · MEGAPOLIS» 12:40, «№ 205 · AKROPOLIS переведена в «Продана»» 11:05; day 1: «AVOCADO VILLAGE: 3 квартиры переведены в «Оформление»» 18:22, «Прайс-лист MEGAPOLIS обновлён» 10:02; day 2: «AKROPOLIS: получен İskan, статус объекта обновлён» 12 июля.
- Словарь `L` (488–568) — все UI-строки ru/en/tr (greeting «Добрый день», headerDate «17 июля», roleMgr «Редактор», roleOwn «Менеджер», roleFullMgr «Редактор · ведёт объекты», roleFullOwn «Менеджер · только просмотр», KPI `kFree/kRes/kProc/kSold/kRev/kDeals/kAvg/kCycle/kCycleHint`, `revTitle` «Выручка по месяцам», `today`, `todayEmptyText` «Пока тихо — новые брони, продажи и вопросы появятся здесь», `myObjects`, `seeAll`, `freeLow`, `searchPh` «Поиск по объектам», `units` «юнитов», `soldL`, `readyL`, `tabBoard` «Шахматка», `tabDocs`, `tabPub` «Публикация», `dtHint` «D — дуплекс · T — триплекс · TD — терс-дуплекс (вниз, к 0 и −1 этажам)», `vGrid` «Сетка», `vList`, `fAll`, `boardHint` «Нажмите на квартиру — карточка со статусом, ценой и планом», `nothingFound`, `floorsWord`, `pubTitle` «Публичная страница», `pubSub` «Ссылка для клиентов и партнёров», `share`, `stViews/stReq/stLeads`, `chatCaption`, `msgPh`, `setLang`, `setLangHint`, `setPush`, `setTheme`, `themeLight`, `setCompany`, `setTariff`, `tariffVal` «PRO · до 10 объектов», `setSupport`, `logout`, `nav_*`, `h_*`, `online`, `sheetChange` «Изменить статус», `floorOne/floorsMany/floorAb`, `histNone` «Статус не менялся за последние 30 дней», `histPre` «Статус изменён на», `justNow`, `autoReply` «Принято! Отвечу в течение часа.», `aiTr` «AI-перевод сообщений», `trOrigTap` «оригинал», `trOrigOn` «оригинал · показать перевод», `dayToday/dayYest/dayEarlier`).
- `CHATS_BASE` (569–576): Selin Erdem (SE, `#7d9fdd`, online, «Менеджер · MEGAPOLIS», 3 сообщения о брони № 507); Anna Kim (AK, `#c9a35b`, online, «Менеджер · AVOCADO», 2); Kürşat Demir (KD, `#8b5cf6`, offline, «Редактор · AKROPOLIS», 2). Тексты хранятся в трёх языках.

**Экраны:**

| Строки | Экран | Содержимое и поведение |
|---|---|---|
| 43–110 | **Главная** (`isHome`) | «{greeting}, Mehmet» 21px/800; «New Level İnşaat · 17 июля» 13px `#8a93a2`. Сегмент роли Редактор/Менеджер (`roleMgr/roleOwn`; переход в manager сбрасывает `objTab` с pub). KPI 2×2 (628–638): для manager — Свободно/Брони/В оформлении/Продано по всем объектам (иконки `ti-key`, `ti-clock`, `ti-file-pencil`, `ti-circle-check`, тинты 32px radius 9); для owner — Выручка · июль `fmt(1265000)`, Сделок · июль 18, Средняя цена m² `fmt(2480)`, Ср. срок сделки «14 дн» с подсказкой. **Только owner** (65–77): карточка «Выручка по месяцам · 2026»: `revNumber` 24px/800, строка роста (`growthStyle` зелёный `#0f9d6b` / красный `#e5484d`, `ti-trending-up/down`, «+N% к <пред. месяц>»), гистограмма 6 столбцов высотой `v/max*100%` (`#4d7cfe` выбранный / `#dbe4f5`), подписи месяцев (клик → `selMonth`). «Сегодня» — `events` или пустое состояние (`emptyToday`: круг 40px `#f0f4fa` `ti-sun` + текст). «Мои объекты» + «Все» → горизонтальный скролл `miniObjs` 150px (фото 80px, имя, «N свободно»). |
| 112–136 | **Объекты** (`isObjList`) | Поиск-плашка (декоративная); карточки `objCards`: фото 130px + чип стадии (`stageChip` 10px/800 radius 100), имя 15px/800 + теги (`#f0f2f6` 9.5px), «`ti-map-pin` loc · N юнитов», прогресс «Продано N%» (`#14243f`) и «Готовность N%» (`#34c383`, 5px). Клик → `openObj` (сброс фильтров, вид grid). |
| 138–245 | **Объект** (`isObjDetail`) | Обложка 140px с градиентом `linear-gradient(180deg,transparent 30%,rgba(14,23,42,.7))`, имя 17px/800, `objMeta` «loc · блок · N юнитов». Сегмент Шахматка / Документы / Публикация (последняя только owner). **Шахматка** (155–204): подсказка `dtHint`; чипы типов (`typeChips` 669: Все + присутствующие 1+1…5+1, активный `#4d7cfe`); чипы статусов с точкой и количеством (`statusChips` 670, активный — `deep`-цвет статуса); строка «Этажи: 0 · −1 · −2 / Z · B1 · B2 / G · B1 · B2» (`schemeChips`) + справа «m² / €» (`tileChips`); сегмент Сетка/Список. **Сетка** (173–190): карточка `padding 12px 7px 12px 5px`, `gridStyle` (673): `grid-template-columns: (17|21)px repeat(cols,64px); gap 5px; grid-auto-rows 58px`; подписи этажей sticky слева 9px/700 (`#4d7cfe` для этажей <1); клетка `c.st` (682): `grid-column col+2; grid-row (maxFloor-floorEnd+1)/span h; radius 6; background <tint>; border 1.5px <color>`, не подходящие под фильтр — `opacity .13`, выбранная — `box-shadow 0 0 0 2px #14243f`; содержимое: тег D/T/TD (7px в правом верхнем углу), «№no» 9.5px, тип 13px/800, «m² или цена» 9.5px; подсказка `boardHint`. **Список** (191–203): строки с цветной полоской 4×34, «№», «тип · вид», «этаж · m²», цена, чип статуса; сортировка по этажу desc; пустое состояние `nothingFound`. **Документы** (206–216): `docs` с иконкой 38px и кнопкой скачать 36px. **Публикация** (218–242, только owner): карточка «Публичная страница» с тумблером `pubOn`, ссылка `objLink` + «Копировать» (`navigator.clipboard`, 1,6 с показывает «Скопировано ✓»), кнопки WhatsApp (`#25d366`), «Поделиться» (`ti-share-2`), QR (`ti-qrcode`) 44px; статистика 3 плашки: 1 245 Просмотры · 27 Обращений · 12 Заявок. |
| 247–264 | **Чаты** (`isChatList`) | `chatCards`: аватар 42px с точкой онлайн, имя 13.5px/800 + агентство 10.5px, последнее сообщение, время («12:40», «11:18», «вчера»), бейдж непрочитанных `#4d7cfe`; клик обнуляет `chatUnread[i]`. Подпись `chatCaption` с `ti-users` `#c9a35b`. |
| 266–287 | **Диалог** (`isThread`) | Полоса «AI-перевод сообщений» (`#f4f8ff`, `ti-sparkles`, тумблер 34×20 `aiTr`); лента (авто-скролл вниз через `msgsRef` в `componentDidUpdate`): таблетка даты «Сегодня · 17 июля»; пузыри `m.bub` (715): свои `#4d7cfe` белый radius `14 14 4 14`, чужие `#fff` border `#e6e9f0` radius `14 14 14 4`, max-width 78 %, 13.5px; время 9px + галочки (`✓` sent / `✓✓` dlv/read; read — `#bfe0ff`); у чужих сообщений при включённом переводе и `lang!='tr'` — подпись «AI · TR → RU · оригинал» (клик переключает на оригинал `m.t.tr`, подпись «· оригинал · показать перевод»); индикатор «печатает» (три точки). Ввод: инпут `draft` (Enter → send) + кнопка 44px `ti-send`. `doSend` (782–795): добавляет сообщение `st:'sent'` → через 700 мс `dlv` → 1600 мс `read`; через 1500 мс автоответ `autoReply` (снимает `typing`). |
| 289–302 | **Уведомления** (`isNotif`) | Группы «Сегодня / Вчера / Ранее» (10.5px/800 uppercase `#9aa4b5`); карточка `ncard` (716): непрочитанная `border #d8e4fd;bg #f4f8ff` + точка 8px `#4d7cfe`; открытие вкладки ставит `notifSeen:true` (бейдж и точка пропадают). |
| 304–353 | **Профиль** (`isProfile`) | Карточка: аватар 52px `#14243f` «MA», «Mehmet Aydın», «New Level İnşaat · {roleLabel}», карандаш. Блок настроек: Язык интерфейса (RU/EN/TR) + подсказка `setLangHint`; Push-уведомления (тумблер `notifOn`); Тема — «Светлая» (статично). Блок: Компания «New Level İnşaat»; Тариф — чип «PRO · до 10 объектов» (`#9c7420` на `rgba(201,163,91,.18)`); Поддержка. Кнопка «Выйти» (`border #f3d4d6;color #e5484d`, без логики); «OnePlan · v1.0 · one-plan.pro». |
| 367–395 | **Bottom-sheet квартиры** (`showSheet = !!sel`) | Подложка `rgba(14,23,42,.45)` `opFade`; лист `radius 22 22 0 0;max-height 84%;opSheet .3s cubic-bezier(.3,1,.4,1)`, ручка 38×4.5 `#dfe4ec`; «№ {selNo}» 20px/800 + чип статуса (`tint/deep`), крестик 34px; чипы: «тип · вид», «m²», «этаж(и)», имя объекта; изображение плана 150px `object-fit:contain` (`diamond-plans/plan-1-1.jpeg` для 1+1, иначе `plan-2-1.jpeg`); цена 23px/800 + «за m²»; «ИЗМЕНИТЬ СТАТУС» — 4 кнопки free/res/proc/sold (**без hold**), `min-height 46;radius 12;border 1.5px`, активная — тинт/deep; `setStatus` мутирует юнит и пишет `histKey`; строка истории `ti-history`: «Статус изменён на «…» · только что» или `histNone`. |

Форматирование (589–598): `fmt(v)` — символ валюты + пробел + округление до 500 (`€1`, `$1.06`, `₺36.5`), `ru-RU`; `fmtShort` — `€123K` / `€1.2M`.

**Замечание по ролям:** ключ `manager` подписан «Редактор · ведёт объекты» (правит статусы), ключ `owner` — «Менеджер · только просмотр», но именно owner видит выручку и вкладку «Публикация» с тумблером. Названия ролей нужно согласовать с ТЗ (§2) перед реализацией.

### C.4. `OnePlan App Риэлторы.dc.html` — приложение риэлтора (901 строка)

Пропсы (517): `topInset`, `bottomInset`, `lang` ru/en/tr. Дополнительные CSS (17–18): `body>div…{height:100%}`, `[data-scroll]>*{flex:none}`. `componentDidMount` → `_numKb()` (576): всем `input` с цифровым placeholder ставит `inputMode=numeric`.

`state` (570): `tab:'home'` ('home'|'base'|'chats'|'notif'|'profile'), `seg:'sec'|'new'`, `obj:null`, `objGal:0`, `nb:null`, `nbGal:0`, `chat:''` ('sup'|'c1'|'c2'), `draft`, `favs:[]` (id вторички), `notifOn`, `lang`, `msgs:{}` (доп. сообщения по чату), `unread:{c2:1}`, `sheet:''` ('geo'|'deal'|'type'|'rooms'|'price'|'nrooms'|'nprice'), фильтры вторички `fDeal:'sale'|'rent'`, `fType:''|'flat'|'villa'`, `fRooms:[]`, `fPrice:''`; гео `gIl`, `gIlces:[]`, `gSemts:[]`, `gStep:1..3`, `gQ`; новостройки `nbUSt:'free'`, `nbURm:''`, `nFRooms:[]`, `nFPrice:''`, `nFInst:false`, `nbUnit:null`, `nbFavU:[]` (ключи `'<nbId>#<unitNo>'`); профиль `profScreen:''` ('favs'|'sub'|'reg'|'msgr'|'sec'), `pwOld`, `pwNew`, `pwS1/pwS2` (показ пароля), `twoFA:false`, `regions:['muratpasa','konyaalti','kepez']`, `msgrs:{wa:true,tg:true,vb:false,max:false,wc:false}`.

**Данные** (521–569):
- `OBJS` (вторичка, 4 шт.): 0 — `megapolis-photos/web-front.jpg` (+ `web-back-1`, `web-front-3`, `web-front-5`), 5 430 000 ₺ (старая 5 720 000), 2+1, брутто 95 / нетто 82, этаж 3/6, «2+1 · Гюзелоба, 3 этаж», Antalya · Muratpaşa · Güzeloba, агент Мехмет Далман · Coast Homes, feats pool/upark/sec/lift; 1 — `akropolis-photos/web-ph-1.jpg` (+ `web-front-2`, `web-back-2`), 9 120 000 ₺, 3+1, 145/121, 5/8, «3+1 · Лара, вид на море», Ayşe Kaya · Lara Estate, ipool/upark/sec/sauna/ter; 2 — `avocado-photos/web-v5556-1.jpg` (+ `web-front-4`), 14 800 000 ₺, 4+1, 210/178, «Villa», «Вилла 4+1 · Авсаллар», Alanya · Avsallar, Ирина Ковалёва · Compass Realty, pool/opark/bbq/sec; 3 — `megapolis-photos/web-front-6.jpg` (+ `web-back-3`), 3 990 000 ₺ (старая 4 200 000), 1+1, 58/48, 2/5, «1+1 · Кепез, новый дом», Antalya · Kepez · Varsak, Селин Эрдем · Nova Emlak, opark/play/lift. Описания в 3 языках.
- `NEWB` (новостройки, 3 шт.): ALLURE (Arso İnşaat, Antalya · Aksu, сдача 12.2026, продажи open, ₺, рассрочка; планы 1+1 62 м² 8 400 000 / 2+1 95 13 200 000 / Villa 210 28 000 000; фото `allure/web-f1, web-f2, web-i1, web-f4`); Lara Sky Residence (Sky Yapı, Lara, 06.2027, start, $, рассрочка; 1+0 45 120 000 / 1+1 62 175 000 / 2+1 95 275 000; `diamond-photos/IMG-…60/62/64`); Terra Marin (Terra İnşaat, Hurma, 03.2026, open, ₺, без рассрочки; 2+1 105 12 500 000 / 3+1 150 17 800 000; `megapolis-photos/web-front-7, web-front-8, web-back-4`). Для каждой генерируются 14 юнитов (532): `no 101+i`, план по кругу, этаж `1+(i%7)`, брутто `+ (i%3)*2`, статус по хэшу `(i*7+id*5)%12`: <4 sold, <6 hold, <7 proc, <8 res, иначе free; при `sales:'start'` юниты с i>7 — `na`.
- `GEO` (533–559): İl → İlçe → Semt: Antalya (Muratpaşa: Güzeloba, Lara, Fener, Çağlayan; Konyaaltı: Liman, Hurma, Uncalı, Sarısu; Kepez: Merkez, Varsak, Santral; Alanya: Mahmutlar, Oba, Tosmur, Kestel, Avsallar; Serik: Belek, Kadriye; Manavgat: Side, Evrenseki; Kemer: Göynük, Çamyuva; Aksu: Çalkaya, Kundu), İstanbul (Kadıköy, Beşiktaş, Şişli, Beylikdüzü …), Ankara (Çankaya, Keçiören), İzmir (Konak, Çeşme), Muğla (Bodrum, Fethiye), Mersin (Yenişehir, Erdemli). Привязки `OBJ_GEO`, `NB_GEO` (562–563).
- `FEATL` (564): pool Бассейн, ipool Крытый бассейн, upark/opark Паркинг, sec Охрана, lift Лифт, sauna Сауна, ter Терраса, play Детская площадка, bbq Барбекю.
- `CHATS` (565–569): `sup` «OnePlan Support» (`ti-headset`, `#14243f`, «Поддержка», «Здравствуйте! Чем можем помочь?» 09:00); `c1` Мехмет Далман (МД, `#7d9fdd`, Coast Homes; моё «Добрый день! Квартира 2+1 в Гюзелоба актуальна?» 12:02 read, ответ «Да, актуальна. Могу показать завтра после 14:00.» 12:10); `c2` Айше Кая (АК, `#c9a35b`, Lara Estate; «Клиент готов на 8,9 млн, если торг — сегодня.» 11:31, непрочитано 1).
- Словарь `T` (592–605): greeting, headerDate «30 августа», today, seeAll, newInBase «Новое в базе», reqTitle «Запросы базы», reqSub «3 новых запроса в ваших районах», segSec «Вторичка», segNew «Новостройки», objFeats «В объекте», objDesc, msgPh, setLang, setPush, logout, roleRealtor «Риэлтор», reset «Сбросить», nav_home/base/chats/notif/profile («Главная / База / Чаты / Уведомления / Профиль»), h_base «База объектов», h_chats «Чат риэлторов», h_notif, h_profile. Остальные строки — инлайн-объекты `{ru,en,tr}` в `renderVals` (прокси `L()`).
- Валюта: цены в ₺ (`fmt`), эквивалент «≈ €N · $N» (`eq`: ₺/48 и ₺/43.2, округление до 1000).

**Экраны:**

| Строки | Экран | Содержимое и поведение |
|---|---|---|
| 44–92 | **Главная** | «Добрый день, Ирина», «Compass Realty · 30 августа». KPI 2×2 кликабельные (676–681): Объектов в базе 248 (→ base), Мои объекты 12, Избранное `favs+nbFavU` (→ профиль/избранное), Подборки 6. «Сегодня»: Цена снижена: 2+1 Гюзелоба · −290 000 ₺ (12:40); Новый запрос: 3+1 в Konyaaltı до 15 млн ₺ (11:05); Айше Кая ответила в чате по 3+1 Лара (09:32). «Новое в базе» + «Все» → карточки 168px (фото 88px, цена 13px/800, название). Плашка «Запросы базы / 3 новых запроса в ваших районах» с бейджем 3 (`ti-speakerphone`) → `notif`. |
| 94–146 | **База** (`isCatalog`) | Липкая шапка: сегмент Вторичка/Новостройки; строка чипов `filterChips` (736–747, `chipSt` 623: белые с рамкой, активные `#14243f`; с шевроном): вторичка — Гео («Вся Турция» / «Antalya · N · M»), Купить/Снять, Тип, Комнаты, Цена; новостройки — Гео, Комнаты, Цена, Рассрочка (toggle). **Список вторички** (`listings` 754–760): карточка фото 168px + бейдж снижения «−N ₺» (`#0f9d6b`), сердце 36px (`ti-heart(-filled)`, `#e5484d` если в избранном, `stopPropagation`), счётчик фото; цена 17px/800 + эквивалент, заголовок 13px/700, гео, чипы «2+1», «95 м² брутто», «3/6». Фильтрация `secFl` (699): гео по `OBJ_GEO`, `fDeal==='sale'` (при «Снять» список пуст), тип flat/villa, комнаты (Villa — отдельный вариант), диапазон цены `PRICES` (до 5 млн / 5–10 / 10–15 / от 15 млн ₺). **Новостройки** (`newbCards` 761–766): фото 150px, бейдж «СРОК СДАЧИ 12.2026» (`#14243f`), «ПРОДАЖИ ОТКРЫТЫ» (`#dcf3e4`/`#1f7a44`) или «СТАРТ ПРОДАЖ» (`#fdf0cd`/`#9a7100`); имя 15px/800, «гео · застройщик», строки планов «1+1 · от 62 м² · от 8 400 000 ₺» (цена `#3b5fd6`). Фильтр `nbFl` (702): гео, комнаты по планам, рассрочка, цена (min по планам, пересчёт $/€ в ₺). |
| 461–503 | **Sheet фильтров** (`sheetOpen`) | Подложка `rgba(10,16,28,.45)`; лист `radius 18 18 0 0;max-height 72%;opSheet .22s`; заголовок по `sheet`; кнопка «назад» в гео. **Гео-пикер** (469–491): поиск `gQ`; шаг 1 — список İl (строка с чекбоксом 22px radius 7, подпись «N ilçe», шеврон) → выбор İl переводит на шаг 2; шаг 2 — İlçe (мультивыбор, подпись «N mah.»), внизу dashed-кнопка «Выбрать махалле (N)» → шаг 3; шаг 3 — Semt, сгруппированные заголовками İlçe (мультивыбор). Остальные sheets — чипы (`sheetChips`): Тип сделки Купить/Снять; Тип недвижимости Любой/Квартира/Дом · вилла; Комнаты 1+1…4+1, Villa (мульти); Цена (4 диапазона, single); для новостроек Комнаты из планов, Цена. Футер: «Сбросить» (красный `#fde8e8/#e5484d` если есть значение, иначе серый) и «Показать N» (`#4d7cfe`). |
| 198–243 | **Объект вторички** (`isObjDetail`) | Галерея 230px со свайпом (`_swS/_swM/_swE` 577–586: порог `max(40px, 16% ширины)`, `data-strip` translateX, transition `.35s cubic-bezier(.22,.61,.36,1)`), счётчик «1 / 4», бейдж снижения, сердце 40px с тенью. Цена 23px/800 + эквивалент, заголовок 14.5px/700, гео. Параметры 2×2 (`objParams`): Комнаты, Брутто, Нетто, Этаж (иконки `ti-door`, `ti-ruler-measure`, `ti-ruler-2`, `ti-stairs-up`, 32px `#eef3ff`). «В объекте» — чипы фич; «Описание». Липкий низ: аватар агента (инициалы, `#3b5fd6`), имя/агентство, кнопки 42px: телефон (`#3b5fd6`), WhatsApp (`#22c15e`), чат (`#f0f2f6`) → чат `c1`. |
| 148–196 | **Новостройка** (`isNbDetail`) | Галерея 210px со свайпом; имя 20px/800 + бейдж продаж; «гео · застройщик»; «`ti-key` Срок сдачи 12.2026». Карточка «Планировки и цены». Карточка «Квартиры · N / 14»: чипы статусов с точкой и количеством (Всего/Свободно `#12996b`/Бронь `#f0ad00`/Оформление `#4d7cfe`/Продано `#6b7a90`/Резерв `#8b5cf6`; активный по умолчанию «Свободно»), чипы комнат; строки юнитов (`nbUnits` 789–792): «2+1 №101 … цена», «3 эт. · 97 м² / 80 м²» + чип статуса uppercase; проданные `opacity .55`; клик → `uSheetOpen`. Низ: застройщик (инициалы), телефон, WhatsApp, чат → `sup`. |
| 430–459 | **Sheet юнита новостройки** | «2+1 · №101» + чип статуса; фото (план-заглушка из `phs`) 170px; цена 21px/800 + эквивалент; параметры 2×2: Этаж, Брутто, Нетто (82 %), Срок сдачи, Рассрочка Да/—, Комплекс; футер: «В избранное / В избранном» (`nbFavU`, красная рамка при активном) и «Запросить условия» (`#4d7cfe`) → открывает чат `sup`. |
| 245–261 | **Чаты** | Карточки: аватар 44px (иконка для Support), имя + агентство, галочка последнего своего сообщения (`ti-check`/`ti-checks` `#4d7cfe`) + текст, время, бейдж непрочитанных. |
| 263–275 | **Диалог** | Пузыри как в App (без AI-перевода и даты); `_send` (892–897): своё сообщение `tick:'sent'` (`ti-check`), через 1,2 с все свои → `read` (`ti-checks`). Автоответа нет. |
| 277–290 | **Уведомления** | Сегодня: «Цена снижена по объекту из избранного: 2+1 Гюзелоба · −290 000 ₺» 12:40, «Новый запрос базы: 3+1 в Konyaaltı до 15 млн ₺» 11:05 (непрочитанные, рамка `#dce7f8`); Вчера: «По поиску «Konyaaltı 2+1» — 2 новых объекта» 18:22 (`ti-bookmark`), «ALLURE: обновлён прайс — 4 лота сменили статус» 10:02 (`ti-building-skyscraper` `#ede9fd`/`#6d4fd0`). Бейдж таббара — статичная «2». |
| 391–426 | **Профиль** | Аватар «ИК», «Ирина Ковалёва», «Compass Realty · Риэлтор». Строки `profRows` (871–879): Избранное (счётчик `#e5484d`), Подписка (чип «до 15.03.2027» зелёный), Мои рабочие регионы («Antalya · 3»), Мессенджеры («2 подкл.»), Безопасность («2FA ✓» если включено), Поддержка (→ чат `sup`). Блок: Язык интерфейса, Push-уведомления. «Выйти», «OnePlan · v1.0 · one-plan.pro». |
| 292–319 | **Избранное** | Список вторички (миниатюра 68×54, заголовок, гео, цена, сердце-удаление) + секция «Новостройки · квартиры» (`nbFavU`); пустое состояние dashed «Пока пусто — нажимайте ♥ на объектах». |
| 321–340 | **Подписка** | Строки: Тариф «PRO · 12 мес», Оплачено до 15.03.2027, Последний платёж 15.03.2026 · 14 400 ₺; пакеты 3 мес 4 500 ₺ / 6 мес 8 100 ₺ (−10%) / 12 мес 14 400 ₺ (−20%, выделен `#4d7cfe`/`#eef3ff`); кнопка «Продлить и оплатить картой» (`ti-credit-card`); подпись «Оплата откроется на сайте OnePlan (как Spotify)». |
| 342–352 | **Рабочие регионы** | Заголовок «Antalya», чипы İlçe (мультивыбор, активные `#14243f` с `ti-check`); подпись «Запросы базы из этих районов будут приходить в уведомления». |
| 354–370 | **Мессенджеры** | Телефон «+90 532 481 77 20»; строки WhatsApp (`#22c15e`), Telegram (`#229ed9`), Viber («V», `#7360f2`), MAX («M», `#7b4fd0`), WeChat (`#07c160`) с подписью «Подключён/Подключить» и тумблером. |
| 372–389 | **Безопасность** | Поля Старый/Новый пароль с глазком (`ti-eye/eye-off`), «Сгенерировать» (8 символов из безопасного алфавита, показывает пароль), «Сменить пароль» (без логики); 2FA тумблер «Двухфакторная аутентификация (2FA) / Google Authenticator / Apple Passwords»; подпись «Почта выдаётся по приглашению — сменить её может только поддержка». |

Заголовки шапки по экранам (634): объект → название, новостройка → имя, чат → имя (подзаголовок — агентство), Избранное / Подписка / Рабочие регионы / Мессенджеры / Безопасность / База объектов / Чат риэлторов / Уведомления / Профиль. `goBack` (632): объект → список, новостройка → список, подэкран профиля → профиль, иначе → список чатов.

### C.5. `OnePlan Приложение.dc.html` (46 строк)

Канвас-обёртка (`design_doc_mode=canvas`, фон `#e8edf4`, Manrope): заголовок с логотипом, подписи «Мобильное приложение для застройщиков · кликабельный прототип» и «Табы, шахматка, карточка квартиры, чаты и настройки — интерактивны»; два `x-import`: `IOSDevice` из `ios-frame.jsx` (402×874, `top-inset=62 bottom-inset=16`) и `AndroidDevice` из `android-frame.jsx` (412×892, `top-inset=0 bottom-inset=6`), внутри `<dc-import name="OnePlan App" …>` с пробросом пропсов `currency/startRole/lang/emptyToday` (44). Подписи «iPhone · 402 × 874», «Android · 412 × 892». Для риэлторского приложения такой обёртки нет.

### C.6. Модели данных приложений

```ts
// App (застройщик)
Project { id; name; loc; img; stageKey:'build'|'done'|'start'; stageBg; stageC; ready:number; tags:string[]; block:{ru,en,tr}; board:Board; link }
Board { cols; minFloor; maxFloor; units:Unit[] }
Unit { col; floorStart; floorEnd; h:1|2|3; kind:'flat'|'duplex'|'triplex'|'ters2'; type:'1+1'..'5+1'; m2; price /*EUR*/; st:'free'|'res'|'proc'|'sold'|'hold'; no:string; histKey:string|null }
Chat { name; init; bg; online; agency:{ru,en,tr}; msgs:[{me:0|1; t:{ru,en,tr}} | {me:1; text; st:'sent'|'dlv'|'read'; id; tm}] }
Notif { i; bg; c; fresh; day:0|1|2; text:{ru,en,tr}; time:{ru,en,tr} }
// App Риэлторы
Listing { id; img; phs[]; price /*TRY*/; old; rooms; gross; net; floor:string|'Villa'; title:{ru,en,tr}; geo; agent; agency; feats:FeatKey[]; desc:{ru,en,tr} }
NewBuild { id; img; phs[]; name; dev; geo; dlv:'MM.YYYY'; sales:'open'|'start'; cur:'₺'|'$'|'€'; inst:boolean; plans:[rooms, m2, price][]; units:[{no; pl; fl; gb; st:'free'|'hold'|'proc'|'res'|'sold'|'na'}] }
Geo { k; n; ilces:[{k; n; semts:[{k; n}]}] }
```

### C.7. Ассеты приложений

`megapolis-photos/web-front.jpg, web-front-2…8.jpg, web-back-1…4.jpg`, `akropolis-photos/web-ph-1.jpg`, `avocado-photos/web-v5556-1.jpg`, `allure/web-f1.jpg, web-f2.jpg, web-i1.jpg, web-f4.jpg`, `diamond-photos/IMG-20250611-WA0060/62/64.jpg`, `diamond-plans/plan-1-1.jpeg, plan-2-1.jpeg` — все присутствуют. Рамки устройств `ios-frame.jsx`, `android-frame.jsx` — только для превью.

### C.8. Открытые вопросы (приложения)

1. Формат поставки: PWA/mobile-web на Next.js или нативное приложение — макет допускает оба; safe-area через `env()`.
2. Названия ролей в App (Редактор/Менеджер) не совпадают с ТЗ; вкладка «Публикация» у роли «только просмотр».
3. Нет экранов входа/онбординга, смены языка при первом запуске, восстановления пароля.
4. Кнопки «Поделиться», QR, телефон/WhatsApp, «Сменить пароль», «Продлить и оплатить», «Выйти» — без логики.
5. Бейдж уведомлений у риэлторов статичен («2»); `notifDot` всегда true.
6. Планировки в sheet — заглушки `diamond-plans`; у новостроек вместо плана — фото.
7. Курсы валют (48 ₺/€, 43.2 ₺/$; в App 1.06 $/€, 36.5 ₺/€) захардкожены и различаются между файлами.

---

## D. `OnePlan Цвета.dc.html` — сравнение палитр (89 строк)

Канвас (`design_doc_mode=canvas`, фон `#e7e8ec`, Inter, Tabler 3.19.0) с двумя вариантами оформления каталога риэлторов — **1a «Текущая: холодный синий»** (24–53) и **1b «Премиум: тёплый графит + песок»** (55–84). Оба показывают одну композицию: шапка с логотипом и вкладками «База объектов / Мои объекты / Подборки», карточка объекта («3+1 Лиман с бассейном», 8 640 000 ₺, «≈ 180 000 € · 200 000 $», чипы «Бассейн», «Охрана 24/7», бейдж «Новый», сердце), панель цены («−260 000 ₺ · Цена снижена», кнопки «Добавить в подборку» и «Написать в чате»), информационная плашка. Фото — Unsplash `photo-1512917774080-9991f1c4c750`. Во всех остальных прототипах используется палитра **1a**.

| Токен | 1a — холодный синий (текущая) | 1b — тёплый графит + песок |
|---|---|---|
| Фон страницы | `#f7f8fb` | `#f6f4ef` |
| Тень панели-превью | `0 10px 30px rgba(20,36,63,.12)` | `0 10px 30px rgba(30,30,20,.14)` |
| Фон карточек/шапки | `#fff` | `#fffdf9` |
| Рамка карточек | `#edf0f6` (шапка `#e6e9f0`) | `#eae5d9` (шапка `#e8e3d8`) |
| Тень карточки | `0 1px 3px rgba(20,36,63,.05)` | `0 1px 3px rgba(40,35,20,.06)` |
| Логотип (3 круга 10px) | `#4d7cfe #43a047 #f0ad00` | `#c9a35c #16324f #8c9a8a` |
| Текст логотипа / заголовки | `#14243f` | `#101f33` |
| Активная вкладка | `#14243f` фон, белый текст, radius 9, 12.5px/600 | `#16324f` |
| Неактивная вкладка | `#5a6472` | `#6e6a5e` |
| Бейдж «Новый» | `#22c15e` | `#c9a35c` |
| Сердце | `#e5484d` на `rgba(255,255,255,.94)` | `#b0392e` на `rgba(255,253,249,.95)` |
| Название объекта | `#14243f` 13px/700 | `#101f33` |
| Цена в карточке | `#4d7cfe` 15.5px/800 | `#16324f` |
| Эквивалент | `#8a93a2` 10.5px | `#98917f` |
| Чипы фич | `#2c4a9e` на `#eef3ff` | `#6b5626` на `#f0e9db` |
| Крупная цена | `#14243f` 21px/800 ls −.02em | `#101f33` |
| Подпись эквивалента | `#5a6472` 11.5px/600 | `#6e6a5e` |
| «Цена снижена» | `#0f9d6b` на `#e4f6ee` | `#5c7a3f` на `#ecf0e0` |
| Главная кнопка | `#4d7cfe`, тень `0 6px 16px rgba(77,124,254,.22)` | `#16324f`, тень `0 6px 16px rgba(22,50,79,.25)` |
| Вторичная кнопка | рамка `#e6e9f0`, текст `#5a6472` | рамка `#d9cfb8`, текст `#8a713f` |
| Инфо-плашка | фон `#eef3ff`, рамка `#d8e3ff`, текст `#2c4a9e`, иконка `#4d7cfe` — «Подсказки и служебные плашки — светло-синие» | фон `#f4ecdc`, рамка `#e4d7ba`, текст `#6b5626`, иконка `#c9a35c` — «Подсказки и служебные плашки — песочные, тёплые» |
| Плашка-ярлык варианта | `#14243f` | `#16324f` |

Общие размеры: карточка radius 16, фото 130px, padding 12px 14px; панель цены 230px, padding 16; кнопки radius 10, padding 11/10, 12px; чипы radius 12, padding 4px 9px, 10.5px/600; бейджи radius 7/10.

**Сводная таблица токенов по всем прототипам** (для единого `theme.ts`):

| Токен | Лендинг / App | Кабинет (ранний) | Риэлторы (см. другой spec) |
|---|---|---|---|
| Шрифт | Manrope + PT Sans | Inter | Inter |
| Фон страницы | `#fff` / `#f6f8fb` | `#f7f8fb` | `#f7f8fb` |
| Текст основной | `#14243f` | `#1b2942` (заголовки `#14243f`) | `#14243f` |
| Акцент | `#4d7cfe` (hover `#3a63d4`) | `#4d7cfe` | `#4d7cfe` |
| Золото | `#c9a35b` / `#9c7420` | — | — |
| Рамки | `#e6e9f0`, `#eef1f6` | `#e6e9f0` | `#e6e9f0` |
| Статусы | free `#34c383`, res `#f0ad00`, proc `#4d7cfe`, sold `#cfd6e0`, hold `#8b5cf6` | free `#43a047`, booked `#f0ad00`, process `#4d7cfe`, sold `#9aa1ac`, reserve `#8e63d6` (настраиваемые) | — |
| Успех / ошибка | `#0f9d6b`/`#e4f6ee`, `#e5484d` | те же | те же |

---

## E. `OnePlan ТЗ-print-4kyzst.dc.html` vs `OnePlan ТЗ.dc.html`

`OnePlan ТЗ.dc.html` (250 строк, 42 КБ) — актуальное ТЗ **v2.0** к прототипам `OnePlan v2.dc.html` и `OnePlan App.dc.html` (документ на `doc-page`, letter, поля 0.8in). `OnePlan ТЗ-print-4kyzst.dc.html` (675 строк, 55 КБ) — **автоматический print-экспорт более старой версии** того же документа (суффикс `-4kyzst` — случайный id экспорта). Отличия (`diff`: 57 строк только в ТЗ, 482 только в print):

**Технические добавления print-версии (не контент):**
- строки 4–12: `<style data-omelette-print-defaults>` с `@media print { @page{margin:.5in}; h1–h6 break-after:avoid; figure/table/pre/img/svg/tr break-inside:avoid; p orphans/widows 3 }`;
- строки 249–673: инлайн-скрипт `[autoprint]` (ожидание рендера DC-компонентов и шрифтов, прокрутка для lazy-img, доигрывание анимаций, `@page` для deck-stage, вызов `window.print()`). В продакшн не нужен.

**Контентные отличия (print = старая редакция ТЗ):**

| Раздел | print (старая) | ТЗ.dc.html (актуальная v2.0) |
|---|---|---|
| Подзаголовок (29/38) | «Справочник к прототипу OnePlan v2.dc.html…» | тот же абзац, обновлённая формулировка |
| §4 модель unit | поле `lx` — «Абсолютная X-координата (только для мозаичных досок — см. §5)» | поле `w` — «Ширина плитки в клетках (1–3). Квартира занимает колонки pos…pos+w−1»; `lx` — «Устаревшее (старые импорты). Используется только как tie-break при одноразовой нормализации позиций» |
| §5 | **«Планировки: два типа доски»** — А. Сеточная (flex, плитки 132px, редактор) и Б. Мозаичная (координатная, по `lx`, для Megapolis/Akropolis) | **«Планировки: единый движок шахматки»** — один движок (клетка 132×92, зазор 7), растяжка плитки `w` 1–3 с дощёлкиванием, два ряда на этаже `band` («окна наружу / во двор»), нормализация legacy-сеток; отдельного координатного движка нет |
| §6 спецтипы | без блока про band | добавлен блок «Многоэтажные на этажах с двумя рядами (band)»: случаи A / C («близнец» ⧉) / бейдж «Дуплекс · 2 эт.» |
| §12–14 | отсутствуют | **§12 Командный чат** (статусы ✓/✓✓/✓✓ голубые, время и дата-таблетка, AI-перевод через DeepSeek/OpenAI с кэшем и показом оригинала, WebSocket/Pusher, бейдж непрочитанных), **§13 Уведомления и журнал событий** (типы, колокольчик с последними 7, страница с группировкой по дням и фильтрами, видимость по ролям, push в приложении), **§14 Дашборд** (KPI, «По объектам» 6 карточек + «Показать ещё», лента событий, менеджер — только просмотр) |
| «Что реализовать» | §12 — 6 пунктов (БД+API, роли, публичные ссылки, файлы, мультиязычность+ИИ-перевод, импорт/экспорт Excel) | §15 — те же + «Чат — WebSocket, статусы, AI-перевод (§12)» и «Уведомления — генерация, колокольчик, страница, push (§13)» |
| Футер | «ТЗ к прототипу OnePlan v2.dc.html» | «ТЗ v2.0 к прототипам OnePlan v2.dc.html и OnePlan App.dc.html» |

**Вывод:** print-версия не содержит ничего актуального сверх `OnePlan ТЗ.dc.html`; единственный «дополнительный» контент — описание устаревшей мозаичной (координатной) доски по `lx`, которое в v2.0 сознательно отменено (единый движок с `w` и `band`). Источником истины считать `OnePlan ТЗ.dc.html`; print-файл можно игнорировать (или использовать как готовый PDF-экспорт старой редакции).

---

## F. Сводные открытые вопросы для владельца

1. Подтвердить, что `OnePlan Кабинет.dc.html` — устаревший вариант и его роль «Клиент = компания» не переносится.
2. Согласовать названия ролей в мобильном приложении с §2 ТЗ.
3. Решить формат мобильного приложения (PWA на Next.js vs нативное); при PWA — где живёт «Полное управление» (лендинг обещает его на сайте).
4. Endpoint заявки лендинга и юр. адреса в KVKK.
5. Единые курсы валют и единая палитра статусов (лендинг/App vs кабинет).
6. Унифицировать версию Tabler Icons и шрифты (Manrope/PT Sans в лендинге и App, Inter в кабинетах).
