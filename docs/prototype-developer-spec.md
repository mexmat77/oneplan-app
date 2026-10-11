# OnePlan — кабинет застройщика. Спецификация прототипа `OnePlan v2.dc.html`

Документ описывает прототип **`One-Plan приложение/OnePlan v2.dc.html`** (4289 строк, ~620 КБ) настолько подробно, чтобы его можно было пересобрать на Next.js + Supabase пиксель-в-пиксель и функция-в-функцию, не открывая исходник. Все номера строк ниже относятся к этому файлу. Кросс-проверка сделана по `OnePlan ТЗ.dc.html` (ТЗ v2.0 от 21.07.2026).

## 0. Устройство файла

| Диапазон строк | Что там |
|---|---|
| 1–8 | `<head>`, подключение `support.js` (рантайм-шаблонизатор, игнорируем) |
| 9–2073 | `<x-dc>` — вся разметка. Шаблонный язык: `<sc-if value="{{ expr }}">`, `<sc-for list="{{ arr }}" as="x">`, `{{ expr }}`, `onClick="{{ handler }}"`, `style-hover="…"`, `style-focus="…"` |
| 10–30 | `<helmet>`: Google Fonts Inter, Tabler Icons 3.19.0, SheetJS `xlsx@0.18.5`, `image-slot.js`, глобальный `<style>` |
| 2073 | `<template id="__bundler_thumbnail">` — иконка превью (навы #14243f + 4 квадрата статусов) |
| 2074 | `data-props` компонента: `lang` (RU/EN/TR, default RU), `currency` (EUR/USD/TRY, default EUR), `startScheme` (board/list/floor, default board), `showPricePerM2` (bool, default true) |
| 2075–4286 | `class Component extends DCLogic` — состояние, моки, i18n, движок шахматки, все обработчики |
| 2076–2276 | `constructor`: моки `PROJECTS`, `COMPANIES`, `USERS`, `TEAM`, `NOTIFS`, `DM_SEED`, `LEGAL`, справочники, `this.state` (2240–2270), `UNITSTORE` (2272–2275) |
| 2277–2469 | `buildI18N()` — RU 2279–2341, EN 2342–2404, TR 2405–2467 |
| 2470–2614 | Генераторы юнитов демо-объектов |
| 2615–2685 | Мастер «Создать планировки» (`mkParse`, `mkGen`, `mkApply`) |
| 2686–3086 | Утилиты, DOM-слушатели (`componentDidMount` 2718–2803), мутации сетки (`g*`), типы планировок (`getPT` и др.), экспорт/импорт |
| 3087–4285 | `renderVals()` — единственная функция, возвращающая все значения для шаблона (объект `return {…}` на 3882–4284) |

Важно: в файле **нет** атрибутов `data-screen-label`; экраны определяются исключительно `sc-if`-гвардами на состоянии `screen`/`tab`/флагах модалок (см. §1).

Данные не сохраняются (всё в памяти вкладки); объекты Megapolis и Akropolis подгружают сетку из `megapolis-data/rows.json` и `akropolis-data/rows.json` через `fetch` (2793–2802), поэтому файл нужно открывать через локальный http-сервер.

---

## 1. Экраны

### 1.0. Маршрутизация состояния

Экран определяется полями состояния (2240–2270):

| Поле | Значения | Гварды в разметке |
|---|---|---|
| `landing` | bool | `showLanding` (32) — полноэкранный лендинг поверх всего (`z-index:150`) |
| `authed` | bool | `showLogin = !authed && !landing` (120); `showApp = authed && screen∉{public,devpub}` (181) |
| `regOpen`, `regDone` | bool | `regOpen` (138), `regFormShow`, `regDone` |
| `screen` | `dashboard`, `objects`, `object`, `users`, `profile`, `chat`, `notifs`, `public`, `devpub` | `isDashboard` 266, `isObjects` 409, `isObject` 257, `isCoList/isPeopleList/isCoDetail` 937/991/1016, `isProfile` 1106, `isChat` 1143, `isNotifs` 1199, `isPublic` 1319, `isDev` 1268 |
| `tab` (внутри `object`) | `main`, `plans`, `io`, `log`, `set` | `isTabMain` 456, `isTabPlans` 585, `isTabIO` 818, `isTabLog` 835, `isTabSet` 868 |
| `scheme` (внутри plans) | `board`, `list`, `floor` | `isSchemeBoard` 603, `isSchemeList` 732, `isSchemeFloorReal` 778 (только Akropolis), `isSchemeFloorSvg` 787 |
| `listVariant` | `table`, `cards` | `isListTable` 741, `isListCards` 761 |
| `pubView` | `board`, `list` | `isPubBoard` 1380, `isPubList` 1475 |
| `usersTab`, `coView` | `companies`/`people`, id компании | см. §1.11 |
| `editGrid` | bool | режим «Редактировать сетку» (`editOn`) |
| `viewRole` | `superadmin`, `admin`, `editor`, `client` | демо-переключатель ролей (1251–1264) |
| модалки | `notifOpen`, `navSheet`, `sheet`, `lbList`, `mkOpen`, `plOpen`, `impOpen`, `addOpen`, `coModal`, `modalNum`/`megaCell`, `liveOpen`, `vidOpen`, `legalDoc`, `demoOpen` | см. §1.14–1.24 |

Рекомендуемая карта маршрутов Next.js: `/` (лендинг), `/login`, `/register`, `/dashboard`, `/objects`, `/objects/[id]/(main|plans|io|log|settings)`, `/users` (companies|people, `/users/companies/[id]`), `/profile`, `/chat`, `/notifications`, `/p/[slug]` (публичная страница объекта), `/d/[companySlug]` (страница застройщика), `/legal/[docId]`.

Все переходы в прототипе делают `window.scrollTo(0,0)` через `setTimeout(...,0)`.

### 1.1. Лендинг (`showLanding`, строки 32–118)

Полноэкранный `position:fixed; inset:0; z-index:150; background:#fff; overflow-y:auto` контейнер `#ld-scroll`.

| Блок | Строки | Содержимое и контролы |
|---|---|---|
| Sticky-шапка 60px | 34–39 | Логотип (4 кружка 11px: #4d7cfe, #43a047, #f0ad00, #e5484d, наложение `margin-left:-4px`) + «OnePlan» 19px/800 #14243f; переключатель языка `langBtns` (RU/EN/TR, стиль `lb.style`); кнопка `t.ld.login` → `landingLogin` (тёмная #14243f) |
| Hero | 41–49 | Бейдж `t.ld.badge` (зелёный #0f9d6b на #e4f6ee, pill), `h1` `t.ld.title` (clamp 30–54px, 800, -.03em), `p` `t.ld.sub`, кнопки `t.ld.apply` → `landingApply` (скролл к `#ld-lead`) и `t.ld.login` → `landingLogin` |
| Скриншот в «окне браузера» | 51–56 | Рамка с 3 кружками (#e5484d, #f0ad00, #43a047), `image-slot` `landing-shots/objects.png`, 16/9 |
| «Для кого» | 58–69 | `h2 t.ld.who_title`, сетка `repeat(auto-fit,minmax(260px,1fr))` карточек `ldWho` (3904): иконка 48px в цветном квадрате (`w.bg`/`w.fg`), `w.t`, `w.d` |
| «Что внутри» | 71–87 | 4 фичи `ldFeats` (3905–3910): чередование текст/скриншот через `order`, скриншоты `landing-shots/board.png`, `profile.png`, `public-hero.png`, `companies.png` |
| Форма заявки `#ld-lead` | 89–113 | Тёмная карточка #14243f. Поля: `leadName`* (`onLeadName`), `leadCo` (`onLeadCo`), `leadPhone`* (`onLeadPhone`), `leadMail` (`onLeadMail`), `leadMsg` (`onLeadMsg`); чекбокс `leadC` (`toggleLeadC`, стиль `leadChk`), ссылка KVKK → `openKvkkStop` (открывает legal `kvkk`); кнопка `submitLead` активна только при name+phone+consent (`leadBtnStyle`, 3919); после отправки `leadDone` — экран «спасибо» (105–111) |
| Футер | 115–116 | `legalFooter` (3940): Üyelik Sözleşmesi, Kullanım Koşulları, KVKK, Gizlilik, Çerez, «Все документы» → `legalDoc`; © 2026 `legalCo.name` |

### 1.2. Вход (`showLogin`, 120–136)

Фон `linear-gradient(135deg,#14243f,#1e3a63)` + затемнение rgba(14,23,42,.55); карточка 380px, radius 18, padding 34, тень `0 30px 80px rgba(0,0,0,.4)`. Внутри: языки, логотип 22px, `t.login_sub`, поле email (предзаполнено `admin@oneplan.pro`), пароль (`password`), ссылка `t.login_forgot` (без обработчика), кнопка `login` (3898: `authed:true, screen:'objects'` — без проверки), «Нет аккаунта? Регистрация» → `openReg`, «← ONEPLAN — Для кого» → `openLanding`, `legalFooter`.

### 1.3. Регистрация (`regOpen`, 138–179)

Карточка 460px. Форма (`regFormShow`): `regOrg`* (`onRegOrg`, placeholder «ONETEAM İNŞAAT LTD. ŞTİ.»), MERSİS (не привязано), `regRep`* (`onRegRep`), `regMail`* (`onRegMail`); четыре чекбокса `regC.terms/kvkk/auth/mkt` (`tglTerms/tglKvkk/tglAuth/tglMkt`, стили `chkTerms…`), первые три обязательны (`regBtnStyle` 3933). `submitReg` (3934) фиксирует `regStamp` (DD.MM.YYYY HH:MM) и псевдо-IP `176.x.x.x`, `regDone:true`. Экран «Заявка отправлена» (160–176): «Запись о согласии» — версия документов v1.0, дата, IP, способ «Веб-форма»; кнопка `regEnter` → `authed:true, screen:'objects'`.

### 1.4. Оболочка приложения (`showApp`, 181–1266)

**Шапка** (183–201): белая, `border-bottom:1px solid #e6e9f0`, `min-height:62px`, `padding:8px clamp(14px,4vw,28px)`, `flex-wrap:wrap`.
- Логотип → `goObjects`.
- Десктоп (`notMobNav`, ширина ≥760): вкладки `goDashboard` / `goObjects` / `goUsers` (последняя только при `canManageUsers`), стиль `nav(on)` (3092): 15px, `border-bottom:2px solid #4d7cfe` активной, цвет #14243f/600 vs #1b2942/400.
- Справа: кнопка чата `goChat` (38×38, radius 11, бейдж `dmUnread` красный #e5484d 18px), колокольчик `toggleNotif` (бейдж `notifCount`), переключатель языка (`lb.navStyle`: активный белый с тенью), профиль `goProfile` (аватар 34px #e7eaf0, «Admin» + `myRoleLabel`).
- Мобайл (`mobNav`, <760): колокольчик 40×40 и кнопка-бургер `openNavSheet`.

**Дропдаун уведомлений** (`notifOpen`, 203–240): оверлей rgba(14,23,42,.14) → `closeNotif`; панель `top:70px; right:clamp(10px,3vw,26px); width:min(392px,94vw); max-height:78vh`, radius 16, тень `0 26px 70px rgba(20,36,63,.24)`. Заголовок `tt.notif` + бейдж `notifUnreadLabel` (если `hasUnread`) + кнопки `markAllNotifRead` (`ti-checks`) и закрыть. Список `notifs` (первые 7): иконка 36px (`n.iconBg/iconFg`), текст «**who** ev **obj** unit extra», `n.ago`, синяя точка при `n.unread`; непрочитанные — фон #f5f8ff. Пусто → `notifPageEmpty`. Футер: `markAllNotifRead` и `openAllNotifs` («Показать все →»).

**Мобильное меню** (`navSheetOpen`, 242–255): полноэкранный белый лист; пункты `navMenu` (4252–4259): Дашборд, Объекты, Пользователи (если `canManageUsers`), Чаты (бейдж `dmUnreadTotal`), Уведомления (бейдж `notifCount`, открывает дропдаун), Профайл; 24px/800; внизу языки.

**Подвкладки объекта** (`isObject`, 257–262): sticky-полоска 50px `top:0; z-index:49` — «← К объектам» (`backToObjects`) и `subtabsView` (4145): main/plans/io/log/set; активная — синее подчёркивание 2px.

`<main>` (264): `padding:clamp(16px,3vw,26px) clamp(14px,4vw,28px) 60px; max-width:1500px; margin:0 auto`. На мобайле (`@media(max-width:760px)`, строка 28) `padding:10px 8px 56px`.

**Демо-переключатель роли** (1251–1264): фиксированный слева-снизу (`left:14px; bottom:14px; z-index:120`). Свёрнут — тёмная пилюля «DEMO {roViewLabel}» → `toggleDemo`; развёрнут — карточка 280px с чипами `roleSwitch` (3309–3312) superadmin/admin/editor/client. В боевой версии убрать.

### 1.5. Дашборд (`isDashboard`, 266–407; данные 3795–3841)

| Блок | Строки | Данные / вычисление |
|---|---|---|
| Заголовок | 267–272 | `dashL.title`, подзаголовок `dashL.sub · dRoleLabel` |
| KPI-карточки | 274–284 | `dashKpis` (3809–3813), 3 карточки `repeat(auto-fit,minmax(270px,1fr))`: «Свободных в продаже» = Σ price свободных юнитов с ценой (`dFreeVal`, #4d7cfe/#eaf1ff, `ti-tag`); «Средняя цена юнита» = `dFreeVal / dFree` (#0f9d6b/#e4f6ee, `ti-home`); «Средняя цена м²» = среднее `price/area` по свободным юнитам с ценой (#7b4fd0/#efe7fb, `ti-ruler-2`). Карточка: radius 20, border #edeff4, padding 20/22, иконка 52px radius 15, значение 24px/800 |
| «Юниты по статусам» | 286–309 | `dStatMeta` (число видимых объектов, всего юнитов); полоса 16px из сегментов `dStatusSeg` (только статусы с count>0, цвета фиксированной палитры `dpal` 3814 = дефолтные цвета статусов); легенда: точка 11px, label, count, `pct%` |
| «По объектам» | 311–348 | `dByObj` (3829–3833): карточки с названием, `loc`, чип стадии (`STAGECOLOR`), полоса «продано» (`sold/total`, #4d7cfe) и «готовность» (`ready%`, #0f9d6b); лимит `D_LIM=6`, кнопка `toggleDashObjExp` «Показать ещё (N)»/«Свернуть», счётчик `dByObjCount` «6 / N показано»; поиск `onDashObjQ` по name+loc+companyName появляется при `dvis.length>6`; `dByObjEmpty` → «Ничего не найдено» |
| «Публикация и команда» | 351–363 | Только `dIsAdmin` (superadmin/admin). `dPubView` (3837–3839): Опубликовано = видимые объекты, Скрыто = `cabHidden`, Пользователей = `USERS.length`, Компаний (только superadmin) = `COMPANIES.length` |
| «Контент — требует внимания» | 365–384 | Только `dIsEditor`. `dContent` (3840): объект попадает, если фото <6 («мало фото»), файлов <2 («нет документов»), нет `video` («нет видео»); иначе `dContentOk` — зелёная плашка |
| «Последние события» | 386–404 | `dActivity` = первые 6 уведомлений; ссылка `openAllNotifs` |

`data-dash-cols` — сетка `1.5fr 1fr`, на мобайле `1fr` (строка 28). Видимые объекты `dvis` = `projectsV2` без `cabHidden` (скрытые/завершённые/компания скрыта). Менеджер (`client`) видит только KPI, статусы, объекты, события.

**Расхождение с ТЗ §14:** графика «продажи по месяцам» и KPI «всего/свободно/продано/сумма по проданным» в прототипе нет (ключи i18n `dash.sales`, `k_sold`, `k_soldval` есть, но не используются); блок команды показывается и админу, и супер-админу.

### 1.6. Объекты (`isObjects`, 409–454; данные `projectsV2` 3649–3665, фильтр 4197)

- Заголовок `t.obj_title`, подзаголовок `t.obj_sub · objCount`.
- Sticky-панель фильтров (412–420, `top:0; z-index:35; background:#f7f8fb`): три кнопки-дропдауна `fltStage`, `fltIskan`, `fltSales` (4061–4063) — открывают универсальный **sheet** (§1.17) с ключами `fStage`/`fIskan`/`fSales`; стиль `OBJD+FLTSKIN(on)` (3125–3126: активный — фон rgba(77,124,254,.1), рамка rgba(77,124,254,.45), текст #2f5fe0). Справа: `toggleHidden` («Показать скрытые · N», `hiddenCount`, persist в `localStorage.op_showHidden`), `openDev` («Страница застройщика», `ti-world`), `openAdd` («Добавить объект», тёмная) — только `canEdit`.
- Баннер `isReadOnly` (421): «Режим просмотра — редактирование недоступно» (#8a5a00 на #fef6e0).
- Сетка карточек `repeat(auto-fill,minmax(290px,1fr)); gap:18px`. Карточка (424–451): radius 16, hover `translateY(-2px)` + тень; обложка 150px `p.cover`; чип стадии слева-сверху (`stageChipStyle`, цвет `STAGECOLOR`); «İskan ✓» слева-снизу (`p.hasIskan`, rgba(15,157,107,.95)); «Не опубликовано» справа-снизу (`p.isHidden` = `pubHidden`); справа-сверху: пульсирующий «LIVE» (`p.hasLive`, анимация `oplPulse`) и кнопка-глаз `p.openPub` («Как клиент» → публичная страница); тело: `p.name` 16/800, `p.loc` с `ti-map-pin`, чипы `salesChip`, `occChip` (если `hasOcc`), `tagsView` (цвета `TAGCOLOR`); прогресс «Продано · pct%» / «N в продаже» (полоса #4d7cfe) и «Готовность ready%» (полоса #0f9d6b); низ: `p.client` и «total помещений».
- «Туман» (`p.cabHidden`, 425): оверлей `fogStyle` rgba(238,242,248,.26) + blur .8px, значок `ti-eye-off`, бейдж «Скрыт» + `hiddenReason` (Завершён / Продан / Приостановлен / Вручную / Компания скрыта). `cabHidden = stage==='done' || hidden || компания неактивна`. По умолчанию скрытые не показываются (`showHidden`).
- Фильтрация (4197): по `fStage`, `fIskan` (yes/no), `fSales`, и `showHidden || !(done||hidden)`.

### 1.7. Карточка объекта — вкладка «Объект» (`isTabMain`, 456–583; данные 3691–3737, 4236–4283)

Hero (457–479): тёмный контейнер radius 18, фон `heroCover` с opacity .5 и градиент; строка: «← Объекты», индикатор автосохранения `epSave` (3698–3700: `ti-cloud`/`ti-loader-2`/`ti-cloud-check`, «Сохранено · HH:MM», зелёный при saved), кнопка `openPublic` «Как видит клиент», кольцо готовности заполнения `epRingStyle` (conic-gradient, `epPct`). Название — прозрачный `input eName` (`onEName`, clamp 24–36px/800). Чипы `heroChips` (4237–4240): «● LIVE» (если `eLive`), стадия, İskan ✓/—, продажи, `eReady%`. Полоса ссылки: `pubUrl` = `oneplan.pro/{slug}` (3666–3667, транслитерация üöçşğı), `copyLink` («Копировать»/«Скопировано ✓», 1.6 с), `togglePub` (`visLabel` «Опубликовано»/«Не опубликовано», переключает `p.pubHidden`).

Двухколоночная раскладка (480–582): левая навигация `epNav` (481–490, `epNavWrapStyle` 4261: 212px sticky top 126 на десктопе, горизонтальная лента на мобайле) с галочками готовности `checks` (3693): basic = имя+назначение; media ≥4 фото; desc — RU/EN/TR длиннее 10 симв.; loc — адрес+lng+lat; prog ≥2 записи; docs ≥2 «Получен». `epPct` = доля выполненных из 6. Клик — плавный скролл к `#sec-*`.

Секции (белые карточки radius 16, padding 22, заголовок с иконкой 32px #eef3ff/#4d7cfe):

| id | Строки | Поля и контролы |
|---|---|---|
| `#sec-basic` | 493–505 | `stageSeg` (3703): 8 чипов «N · стадия», клик ставит `stage` и `ready=STAGEPCT[stage]`; авто-скролл ленты к активному (3702). Слайдер `eReady` 0–100 (`onEReady`, accent #0f9d6b). `salesSeg` (3706): notsale/start/open/sold с цветами. `occSeg` (3707): none/started/full. `purpSeg` (3708): cit/res/com, мультивыбор |
| `#sec-media` | 507–527 | Счётчик `photoCount`; сетка `photosView` (3712–3727) `minmax(140px,1fr)`, 4/3: drag&drop-сортировка (`dragStart/dragOver/dragEnd/dropOn`), тач-ручка `ti-grip-vertical` (`touchStart/Move/End`), бейдж «Обложка» у первого, крестик `ph.remove`, `select` категории `catOpts` (exterior/interior/social/pool/spa/kids/park — хранится суффиксом `#cat=` в URL); видео-плитки (`vid:` префикс); кнопка `addPhoto` (`pickFiles('image/*,video/*')`); поле `eVideo` (YouTube/Vimeo); поле `eLive` (LIVE-ссылка). Drop на секцию → `onMediaDrop` |
| `#sec-desc` | 529–533 | Чипы языков `descLangs` RU/EN/TR/AR; кнопка `aiTranslate` («Перевести ИИ», градиент #7b4fd0→#4d7cfe) при `descLang!=='RU'` — мок: через 700 мс подставляет `AITR[lang]`; `textarea descText` (`onDescText` пишет в `eDescs[descLang]`) |
| `#sec-loc` | 535–543 | `eAddr` (`onEAddr`, также пишет `loc` объекта), `eLng`, `eLat`; заглушка карты (градиент + `ti-map-pin-filled`) |
| `#sec-prog` | 545–558 | Дневник стройки: поле `newProg` + `addProg` (добавляет запись `{d:'07.2026', t, ph:[…]}` в начало); таймлайн `progView` (3728–3733): дата, значок видео, крестик `pr.remove`, редактируемый текст `pr.onText`, миниатюры 82×60 (`th.open` → лайтбокс), кнопка `pr.addMedia` |
| `#sec-docs` | 560–575 | 4 статуса `docsEdit` (3735–3737): Yapı Ruhsatı, İskan, Tapu · Kat İrtifakı, DASK; клик по чипу переключает `ok↔wait` (`cycD`); İskan синхронизируется с `eIskan`/`p.iskan`. Файлы `filesView` (4279): имя, `f.sub`, «Скачать» (`href=f.u`), крестик; `addFile` (`.pdf,.doc,.docx,.xls,.xlsx,.csv,image/*`); drop → `onDocsDrop` |
| Удаление | 577–580 | `delObj` (4283) — удаляет объект из `PROJECTS` и `UNITSTORE` без подтверждения |

Все изменения идут через `eSet(patch)` → `touch()` (2692): `saveState:'saving'` → через 700 мс `'saved'` + `savedAt`.

### 1.8. Вкладка «Планировки» (`isTabPlans`, 585–815)

Заголовок (586–590): хлебная крошка `obj.name / Планировки`, `h1`, справа `schemeView` (4146: Шахматка/Список/Поэтажный план; для вилл без «Поэтажный»), кнопки **Excel** (`exportExcel`) и **PDF** (`exportPdf`).

Фильтры (`showFilters` = scheme≠floor и не editGrid; 592–601): `qNum` (поиск по номеру), `fltBlock` (только если >1 корпуса, sheet по `fWing`), `fltRooms` (sheet `fRoom`: Все/1+1/2+1/3+1/Коммерция), площадь `onAMin/onAMax`, цена `onPMin/onPMax`, `fltStatus` (sheet `fSt`). Предикат `pass` (3133): сегмент + номер + тип виллы + корпус + комнаты + статус + площадь + цена (проданные проходят ценовой фильтр всегда).

**Шахматка** (`isSchemeBoard`, 603–730) — см. §4. Панель управления (634–645): `toggleEdit` («Редактировать сетку»/«Готово», зелёная в режиме), `openMk` («Создать планировки», `mkBtnShow=!editOn`), `zoomBtns` 100/75/50% (`boardZoom`, CSS `zoom`), `segBtns` (Все/Квартиры/Коммерция/Виллы — при наличии коммерции или mixed), в режиме редактирования — подсказка `t.ed.hint` (`canAlign:false` — глобальные кнопки выравнивания скрыты, используются кнопки внутри блока). Пустое состояние `hasNoUnits` (646–653). Легенда (712–714) sticky снизу (`bottom:10px; z-index:16`), кликабельная (фильтр `fSt`).

Виллы (`isVillas`, 604–633): чипы `villaChips` (4174–4175: по `vt` «Тип N» или по комнатности 3+1/4+1/4+2), план посёлка `hasVillaPlan` (`villaPlanImg` = `avocado-photos/web-plan.jpg`, маркеры `villaMarkers` 4163–4173 по `px/py` в процентах, поворот -40° для №65–74), кнопки редактирования, карточки `villaCards` (4176–4185): фото 118px, чип статуса, «Вилла N», `typeLabel`, `metaLine` («Тип N · дом A м² · участок B м²»), цена; в `editOn` — крестик `delQuick` и карточка «+ Вилла» (`addVilla`). Для mixed-объектов (Allure) блок `showVillas` (715–729) с жёстким заголовком «VILLALAR — B·C·D·E·F BLOK».

**Список** (`isSchemeList`, 732–776): кнопки edit/mk, `listVariantView` (таблица/карточки), `villaChips`, `segBtns`, счётчик `listCount`. Таблица (`data-print-list`): колонки `listHead` (3182–3184) — №, Корпус, Этаж, Комнат, Площадь, Цена, Цена/м², Статус; сортировка кликом (asc → desc → сброс, стрелки ▲▼, sticky `top:50px`). Строки `listUnits` = `listU2` (3642–3648): `floor` через `fLbl`, «Вилла» для вилл, цена/м² «—» для проданных; чип статуса. Карточки — `minmax(240px,1fr)`.

**Поэтажный план**: реальный (`isSchemeFloorReal`, только `obj.akro`, 778–786): табы `fpPlanTabs` («A Blok · Zemin» → `akropolis-photos/floor-a-zemin.png`, «B Blok · 1. Kat» → `floor-b-1.png`), зоны `fpZones` (3991–3998) — прямоугольники в % с жёстко заданными координатами, цвет по статусу найденного юнита, клик → `openUnit`. SVG-генератор (`isSchemeFloorSvg`, 787–814): кнопки-заглушки «Добавить план этажа»/«Режим обводки», колонка «Дом 1 (Активен)/Дом 2 (58 свободно)» (статично), кнопки этажей `floorButtons` 7…0 (`fCur`), `floorSvg` = `buildFloor()` (3002–3031: юниты этажа делятся на 2 ряда, плитки rect с заливкой цвета статуса, круг, №, тип · м²; лифт, «Курортный проспект»), карточка `fpCard` (802–811) при клике (старая цена = price×1.12, `open` → модалка).

### 1.9. Вкладка «Экспорт-импорт» (`isTabIO`, 818–833)

Карточка 720px: жёлтая рекомендация `t.io_reco`; «Экспорт»: `exportExcel` (зелёная #137a4d) + «Валюта объекта: objCur»; «Импорт»: описание, кнопка `onImport` → `impPick`; подпись `t.io_fields`. Модалка предпросмотра — §1.20.

### 1.10. Вкладка «Журнал» (`isTabLog`, 835–866; данные 3103–3123)

`LOGSTORE[objId]` — при первом заходе сидируется демо-записями (3104). Пусто → `logEmpty`. Список `logView`: дата `fmtLogD` («19 сент. · 14:05»), чип «№ num» (`e.open` → вкладка plans + модалка), чип поля (Цена — #b45309 на #fef3c7; Статус — #4d7cfe на #eef3ff), `from` зачёркнуто → `to`, пользователь (всегда «Admin»). Пагинация `LOGPP=20`: `logRangeTxt` «1–20 / N», `logPrev/logNext`, кнопки страниц `logPageBtns`.

### 1.11. Вкладка «Настройки» (`isTabSet`, 868–935)

| Карточка | Строки | Контролы |
|---|---|---|
| Нумерация этажей | 872–881 | `fsBtns` (4153–4155): tr «B1 · Z · 1 · 2 · 3», int «B1 · G · 1 · 2 · 3», num «-1 · 0 · 1 · 2 · 3» → `obj.fScheme` |
| Валюта и цвета | 882–891 | `select objCur` EUR/USD/TRY (`onObjCur` → `obj.cur`); 5 `input type=color` `colorRows` (`state.colors`); `applyColors` («Применить и открыть шахматку» → tab plans/board); `resetColors` (активна только если цвета отличаются от дефолта) |
| Особенности квартир | 892–897 | Чипы `featChips` с удалением; `newFeat` + `addFeat` |
| Изображения планировок | 899 | `plOpenModal` → модалка типов (§1.19) |
| Публикация объекта | 900–921 | Радио-карточки `setPubClosed` / `setPubPublic` (`obj.pubMode`, default closed); при public — чекбокс `togglePubBeyan` (`obj.pubBeyan`) и поле `eidsRef` (`onEidsRef`) с подсказкой |
| Видимость в кабинете | 922–934 | Статус `archStatusLabel` (Активен / Скрыт), причина `archReasonBtns` (done/sold/paused/other → `obj.hideReason`), кнопка `toggleArchive` («Скрыть объект» красная / «Вернуть в активные» зелёная → `obj.hidden`) |

### 1.12. Пользователи: список компаний (`isCoList`, 937–989; данные 3208–3289)

Показывается superadmin при `usersTab==='companies'` и `coView==null`. Табы `usersTabs` (Компании / Пользователи, `showUsersTabs` только superadmin). Заголовок + `addCoOpen`. Поиск `coSearch` (по name+dir), `coHiddenToggle` («Показать скрытые (N)», persist `op_showInactiveCo`), переключатель вида `setCoModeCards/setCoModeList`. Карточка (`coModeCards`, 953–973): аватар-инициалы 48px градиент #4d7cfe→#7b4fd0, name, `dir` с `ti-user-cog`, чипы «N объектов» (синий) / «N в команде» (зелёный, без platform-сотрудников) / «Скрыта» (красный при `active===false`), «Администратор: adminName», бейдж доступа `accessBadge` (Бессрочно `ti-infinity` / Доступ до дата `ti-calendar-check` / Доступ истёк `ti-alert-triangle`, красный). Список (`coModeList`, 974–988) — те же данные строкой. `c.open` → `coView=id`.

### 1.13. Пользователи: все люди (`isPeopleList`, 991–1014; данные 3290–3302)

Заголовок `people_title`, счётчик `peopleCountLabel`, `addUserNew`. Поиск `peopleSearch` (fio+mail). Строка: инициалы 40px, ФИО + бейджи «Отключён» (`inactiveBadge`) и «Платформа» (`platBadge`, `ti-shield-lock`), почта, чип роли `roleStyleV` (`ROLECOLOR`), чипы компаний `p.companies`, кнопки `p.edit` (`ti-pencil`) и `p.toggleActive` (`ti-user-off`/`ti-user-check`).

### 1.14. Карточка компании (`isCoDetail`, 1016–1104; данные 3246–3282)

Для admin (`isAdminView`) всегда открыта его компания (`adminCoId=1`), без кнопки «назад» и табов. Шапка: инициалы 60px, name, «Директор: dir», `epSave` (при `canEditAccess`).

Только superadmin (`canEditAccess`, 1025–1056):
- «Реквизиты и контакты» (`cp_*`): `cpContact` (=dir), `cpPhone`, `cpMail`, `cpWeb`, `cpVergi`, `cpAddr` → `setCoField` (3249) в `COMPANIES`.
- «Доступ компании»: статус `accessStatusLabel` (Активна/Доступ истёк), чип `setUnlimited` (Бессрочно), `input type=date accessUntil` (`onAccessDate` → `c.until`).
- «Видимость компании»: `visStateLabel`, кнопка `toggleCoActive` («Скрыть компанию» / «Активировать» → `c.active`).

Далее для всех: «Объекты компании» `objectsActive` (cap `OBJ_CAP=6`, `toggleMoreActive`), скрытые `objHidden` (`toggleHiddenObj`, opacity .62, grayscale, бейдж «Скрыт · причина»). «Команда»: `addUserHere`, таблица `coDetail.team` (без platform): Роль, Имя (+«Отключён»), Почта, «Доступ к объектам» (`accessLabel`: для client — список объектов или «Все объекты», иначе «Все объекты застройщика»), кнопки edit/toggleActive.

### 1.15. Профайл (`isProfile`, 1106–1142)

«Данные»: роль (disabled `myRoleLabel`), ФИО (`defaultValue` «Иван Админов»), почта — не привязаны к состоянию, только `profTouch`. «Реквизиты компании — для Клиентов» (`profCanCompany` = superadmin/admin): организация, директор, ИНН/Vergi No, банк, IBAN (placeholders). «Изменение пароля»: `profPass` + `profGen` (генератор вида `Xxxx-xxxx12`, 3218) + `profCopy`; подсказка `pass_hint`; кнопка сохранить (без обработчика). Плашка правовых документов → `openLegalAll`. `logout` → лендинг.

### 1.16. Чат (`isChat`, 1143–1197; данные 3842–3880)

Контейнер `height:calc(100vh - 150px); min-height:460px; max-width:1100px`. Левая панель `dmListPaneStyle` (330px, на мобайле 100% и скрывается при выбранном собеседнике): заголовок `tt.dm_title`, поиск `dmSearch`, список `convos` (по `TEAM`): аватар-инициалы 44px цветной, имя, `ago`, превью последнего («Вы: …»), синяя точка непрочитанного (`DM_UNREAD` и не активный). Правая: шапка — `dmBack` (только мобайл), аватар, имя, «в сети» (статично зелёная точка), кнопка `toggleChatTr` (`ti-language`), при `chatTr` — `readLangBtns` RU/EN/TR (`chatReadLang`). Лента `activeThread` (3858–3877): свои сообщения справа (синий пузырь #4d7cfe, `border-bottom-right-radius:5px`), чужие слева (белые с рамкой); мета: время `ago` + галочки (`showTick` только свои: `ti-check` для sent, `ti-checks` для delivered/read; read — #4d7cfe, иначе #b3bcc9; title `dlv_*`); подпись перевода «🌐 переведено · TR→RU» (`m.trIsDone`, клик `toggleOrig` показывает оригинал «· оригинал») или «перевод…» (`trIsLoading`). Ввод `chatDraft` + Enter (`chatKey`) / кнопка `sendChat`. Пусто — `dmNoPeer` заглушка.

### 1.17. Все уведомления (`isNotifs`, 1199–1247; данные 3756–3793)

`max-width:820px`. Заголовок, `notifUnreadLabel` («N новых», красным), кнопки `markAllNotifRead`, `clearNotifs` (красная). Чипы `filterChips` (all + типы, встречающиеся в данных, с count; активный синий pill). Группы `notifGroups` «Сегодня / Вчера / Ранее» (по `mins`: <900 / <2340 / иначе). Строка: иконка 42px, текст, `ago`, точка непрочитанного, непрочитанные — фон #f5f8ff и рамка #dbe6ff. Клик — пометить прочитанным (`n.onClick`). Пагинация `notifLim` 20 → `notifShowMore` «Показать ещё (N) · shown / total»; фильтр сбрасывает лимит.

### 1.18. Публичная страница застройщика (`isDev`, 1268–1317)

Шапка 60px sticky: инициалы `devInitials`, `devName` (= `obj.client`), «N проектов · Alanya», языки, WhatsApp (#22c15e, без обработчика), назад `backFromDev`. Hero-градиент #14243f→#1e3a63: «Наши проекты», контакты `devContacts` (4143, жёстко: +90 242 512 40 40, info@newlevel.com.tr, Alanya, Mahmutlar…). Сетка `devProjects` (4141: объекты того же `client`, не скрытые): карточка как в списке объектов, но с чипами `iskanChip`, `salesChip`, `occChip`, готовностью, «N в продаже» и «Смотреть объект →» → `p.openPub`. Футер «Работает на OnePlan» + `legalFooter`.

### 1.19. Публичная страница объекта (`isPublic`, 1319–1529)

Шапка 60px sticky: логотип, `obj.name` + «Продажи от застройщика · client», ссылка `openDev` «Наши проекты», языки, WhatsApp, `backFromPublic` (→ object/main).

`pubHiddenView` (1331–1340): если `pubHidden || stage==='done' || hidden || компания неактивна` — заглушка «Застройщик временно скрыл этот объект» + кнопка к странице застройщика.

`pubShownView`:
- Hero `clamp(240px,36vw,400px)` с `pubCover`, градиентом, кнопкой ▶ (`pubHasVideo` → `openVideo`), тегами `objTags`, `h1`, `pubLoc`, кнопкой «LIVE · смотреть трансляцию» (`pubHasLive` → `openLive`), чипами `pubChips` (стадия, İskan, продажи, готовность).
- Статистика `pubStats` (3679): для Megapolis — `MEGA_INFO` без tapu (участок, квартир, до моря, рассрочка); иначе: помещений, свободно, готовность, стадия. Карточки подняты `translateY(-26px)`.
- Sticky-якоря (1359): #opl-gallery, #opl-units, #opl-diary, #opl-docs, #opl-loc.
- Галерея: чипы `pubGalChips` (категории из `#cat=`), горизонтальная лента `pubGallery` 7/5 → лайтбокс.
- «Выбор квартиры»: `pubViewBtns` (board/list), `segBtns`, `zoomBtns` (`pubShowZoom`), фильтры `select onFRoom` (Все/1+1/2+1/3+1/Коммерция), площадь, цена, `select onFSt`. Доска — те же `bBlocks` (1403–1455, всегда без редактирования), легенда; список — таблица. Виллы — план + карточки (1381–1402).
- Дневник `progView` (только чтение), документы `docsTr` (4 статуса) + `filesView` (скачать), локация (заглушка карты), футер.

### 1.20. Модалки и оверлеи

| Модалка | Гвард | Строки | Описание |
|---|---|---|---|
| LIVE | `liveOpen` | 1531–1545 | Полноэкранный тёмный оверлей `z-index:200`, iframe `pubLiveUrl` 16/9 max 1000px, ссылка «открыть в новой вкладке», Esc закрывает (2724) |
| Промо-видео | `vidOpen` | 1598–1611 | Аналогично, iframe `pubVideoUrl` (`embedUrl` 2814: YouTube/Vimeo → embed) |
| Правовые документы | `legalOpen` | 1547–1596 | Полноэкранный `z-index:210`; индекс (`legalIndex`): `legalList` (10 документов из `LEGAL`, 2161) карточками + карточка оператора `legalCo`; документ (`legalInDoc`): `legalView.ver · upd`, title, секции `h`/`p`; `legalBack`, `closeLegal` |
| Sheet-выбор | `sheetOpen` | 1613–1623 | Универсальный выбор одного значения (`s.sheet={title,key,opts}`); на десктопе центрированная карточка 440px, на мобайле bottom-sheet с «граббером»; `sheetOpts` с галочкой у текущего |
| Лайтбокс | `lbOpen` | 1625–1643 | `#opl-lb-feed` вертикальный scroll-snap по `lbImgs`, кнопки `lbPrev/lbNext`, счётчик `lbCounter`, стрелки клавиатуры и Esc (2726–2728) |
| Создание планировок | `mkOpen` | 1645–1709 | §5.6 |
| Планировки по типам | `plShow` | 1711–1762 | §5.5 |
| Предпросмотр импорта | `impOpen` | 1764–1789 | §5.1 |
| Мастер «Новый объект» | `isAddObject` | 1791–1912 | §1.21 |
| Новая компания | `coModalIsCompany` | 1914–1938 | 2 шага: `cfName`*, `cfDir`* → `cfNext`; `cfAdmName`*, `cfAdmMail`* (email-валидация) → `createCompany` (3331–3342): создаёт компанию и её admin-пользователя, открывает `coView` |
| Пользователь | `coModalIsUser` | 1940–1991 | Заголовок `userModalTitle` (Новый/Изменить); роль `ufRoleOpts` (admin/editor/client) + подсказка `ufRoleHelp`; `ufName`, `ufMail`; пароль `ufPass` + `genPass` + `ufPassCopy`; «Доступ к застройщикам» `ufCompanyOpts` (`ufShowCompanies` = не admin-view; для роли admin — одиночный выбор (radio), иначе мультивыбор + «Все» `ufToggleAllCo`; поиск `ufCoSearch`); «Доступ к объектам» `ufCoObjs` (только роль client); флаг «Сотрудник платформы» `ufTogglePlatform` (только superadmin и роль editor); `createUser` (3353–3364) |
| Карточка квартиры | `modalOpen` | 1993–2060 | §4.9 |
| `lightOpen` | всегда false | 2062–2072 | Мёртвая разметка (старый лайтбокс) |

### 1.21. Мастер «Новый объект» (`isAddObject`, 1791–1912; данные 3445–3464, 3884–3896)

Полноэкранный `z-index:120` фон #f7f8fb. Шапка: иконка `ti-building-plus`, «Новый объект» + бейдж «Замена Google Drive», «Шаг N из 6», закрыть. Прогресс-бар `addPct`. Левая навигация `addSteps` (`#aw-nav`, на мобайле горизонтальная): 6 шагов `wzMeta` (3446) с «папками»: INFO / PHOTO · VIDEO / FLOOR PLANS · LAYOUTS / CATALOG · RUHSAT · PRICE LIST / TİCARİ · КОММЕРЦИЯ / (проверка).

| Шаг | Гвард | Содержимое |
|---|---|---|
| 0 Основное | `isAddInfo` | Застройщик: `wzLocked` (одна компания → карточка) или выбор `wzCoOptions` с поиском `wzCoSearch` (superadmin — все компании; admin — [1]; editor/client — [1,3]); название (placeholder MEGAPOLIS RESIDENCE), `select` стадии `stageOptions`, адрес, назначение `purposeViewWiz` (`awTags`) |
| 1 Фото и видео | `isAddMedia` | Две drop-зоны → `addPhoto` |
| 2 Планировки | `isAddPlans` | Drop-зоны FLOOR PLANS / LAYOUTS → `addFile` |
| 3 Каталог и документы | `isAddDocs` | 3 карточки категорий (презентация, Ruhsat, прайс) — без обработчиков |
| 4 Коммерция | `isAddComm` | `setCommYes/setCommNo` (`addComm`), поле «кол-во коммерческих помещений» |
| 5 Проверка | `isAddDone` | `reviewItems` — 5 галочек |

Футер: `closeAdd`, `addBack`, `addNext` / `createObject` (3887 — только закрывает мастер, объект **не создаётся**).

---

## 2. Роли и доступ

### 2.1. Как роли устроены в прототипе

Роль текущего пользователя хранится в `state.viewRole` (2252, default `superadmin`) и переключается демо-виджетом (`roleSwitch`, 3309–3312). Роль **не** берётся из `USERS`; реальной авторизации нет (`login` 3898 просто ставит `authed:true`). Роли пользователей в данных: `admin`, `editor`, `client` (= «Менеджер» в i18n `roles.client`), плюс `superadmin` только как `viewRole`. Флаг `platform:true` у пользователя (2171) — «сотрудник платформы».

Производные флаги (3283–3315, 4064–4090):

| Флаг | Формула | Эффект |
|---|---|---|
| `canManageUsers` | `superadmin \|\| admin` | пункт «Пользователи» в шапке/меню (188, 4255) |
| `isReadOnly` / `canEdit` | `client` / `!client` | скрывает «Добавить объект» (419), показывает баннер «Режим просмотра» (421) |
| `canEditAccess` | `superadmin` | блоки реквизитов, срока доступа и видимости компании (1022–1056) |
| `isAdminView` | `admin` | экран «Пользователи» = карточка своей компании (`adminCoId=1`), без табов и «назад» (`showUsersTabs`, `showCoBack`) |
| `showUsersTabs` | `superadmin` | табы Компании/Пользователи |
| `ufShowCompanies` | `!isAdminView` | выбор застройщиков в форме пользователя |
| `ufShowPlatform` | `superadmin && ufRole==='editor'` | флаг «Сотрудник платформы» |
| `profCanCompany` | `superadmin \|\| admin` | блок реквизитов в профайле |
| `dIsAdmin` / `dIsEditor` / `dIsManager` | по роли | блоки дашборда «Публикация и команда» / «Контент» |
| `wzMyCoIds` | superadmin → все; admin → `[1]`; editor/client → `[1,3]` | выбор застройщика в мастере (3401) |
| переключение роли на editor/client с экрана `users` | → `screen:'objects'` (3312) | |

Команда компании (`coTeamList`, 3254; `usersLabel` 3228) исключает `platform`-сотрудников — застройщики их не видят (ТЗ §2). В общем списке людей (superadmin) они отмечены бейджем «Платформа».

### 2.2. Матрица прав (по разметке и ТЗ)

| Возможность | Супер-админ | Администратор компании | Редактор | Менеджер (client) |
|---|---|---|---|---|
| Дашборд | KPI + статусы + объекты + «Публикация и команда» (с «Компаний») + события | то же без «Компаний» | KPI + статусы + объекты + «Контент — требует внимания» + события | KPI + статусы + объекты + события |
| Список объектов | все, кнопка «Добавить объект» | своей компании (в прототипе — все), «Добавить» | доступных компаний, «Добавить» | только просмотр, баннер RO, без «Добавить» |
| Карточка объекта / планировки / настройки | полный доступ | полный | полный | по ТЗ — только просмотр; **в прототипе редактирование не блокируется** (модалка квартиры сохраняет, `canSetStatus = screen!=='public'`, 4243) |
| Экран «Пользователи» | Компании (список/карточка) + Все люди; создание компаний; реквизиты, срок доступа, скрытие компании; флаг «Платформа» | только своя компания: команда, добавление/редактирование/отключение пользователей; объекты компании | нет (пункт скрыт) | нет |
| Форма пользователя: роли | admin/editor/client, несколько застройщиков для editor/client, объекты для client | те же роли, но застройщик = своя компания | — | — |
| Профайл | данные + реквизиты компании + пароль | то же | данные + пароль | данные + пароль |
| Чат, уведомления | да | да | да | да |
| Публичные страницы | да | да | да | да |

### 2.3. Срок доступа компании и видимость

- `COMPANIES[i].until` — ISO-дата или `''` (бессрочно). `coExpired(iso)` (3222) — `until < now`. Отображается бейджем «Доступ истёк» (красный) в списке и карточке компании. **Блокировки доступа к объектам по истечении в прототипе нет** — это нужно реализовать на бэкенде (ТЗ §2).
- `COMPANIES[i].active===false` — компания скрыта: её объекты получают `cabHidden` с причиной «Компания скрыта», публичная страница объекта показывает заглушку.
- `USERS[i].active===false` — пользователь отключён (бейдж, opacity .5); `toggleUserActive` (3225).
- `USERS[i].access` — `'all'` или массив id объектов (только для роли client); `until` — дата доступа пользователя (строка «01.06.2027» или «—»), в форме есть `ufUntil`, но поле в разметке не выведено.

---

## 3. Модели данных

Все коллекции — свойства экземпляра `Component` (не `state`), мутируются напрямую + `forceUpdate()`.

### 3.1. Объект / проект — `this.PROJECTS` (2078–2155)

| Поле | Тип | Смысл |
|---|---|---|
| `id` | number | PK (8, 9, 10, 13, 14, 12) |
| `name` | string | Название (в hero редактируется `eName`) |
| `loc` | string | Локация/адрес (`eAddr`) |
| `stage` | enum `STAGELIST` | Стадия: `project`, `siteprep`, `foundation`, `frame`, `facade`, `interior`, `landscape`, `done` |
| `ready` | 0–100 | Готовность %, авто по `STAGEPCT` {project:0, siteprep:5, foundation:15, frame:45, facade:65, interior:80, landscape:92, done:100} |
| `iskan` | bool | İskan получен |
| `salesSt` | enum | `notsale`, `start`, `open`, `sold` |
| `occSt` | enum | Выдача ключей: `none`, `started`, `full` |
| `sale` | number | Легаси-счётчик «в продаже» (не используется в v2) |
| `video` | string | Ссылка на промо-ролик (YouTube/Vimeo) |
| `live` | string | Ссылка LIVE (embed) |
| `client` | string | Название компании-застройщика (связь с `COMPANIES.name` — по строке!) |
| `editor` | string | Имя редактора (не используется) |
| `tags` | string[] | Назначение: `cit` (гражданство), `res` (ВНЖ), `com` (коммерция) |
| `access` | string | «Доступ до» (легаси) |
| `mega` / `diamond` / `akro` / `mixed` / `villas` / `rich` | bool | Флаги демо-генератора сетки и особого поведения |
| `hidden`, `hideReason` | bool, enum `done`/`sold`/`paused`/`other` | Скрыт в кабинете |
| `cover` | path | Обложка |
| `photos` | string[] | Пути; суффикс `#cat=<категория>`; префикс `vid:` для видео |
| `files` | `{n,s,u}[]` | Документы: имя, подпись (формат · размер), url |
| `cur` | `EUR`/`USD`/`TRY` | Валюта объекта (default из props) |
| `fScheme` | `tr`/`int`/`num` | Схема нумерации этажей (default `tr`) |
| `pubHidden` | bool | Не опубликован (кнопка в hero) |
| `pubMode` | `closed`/`public` | Режим публикации (default closed) |
| `pubBeyan`, `eidsRef` | bool, string | Подтверждение полномочий и EİDS для public |
| `genGrid` | bool | Сетка создана генератором (вкл. авто-перенумерацию `gRenum`) |

Пример (2097–2107):

```js
{id:9,name:'YÜKSELEN DIAMOND',loc:'Анталья, Алтынташ (Лара)',stage:'facade',ready:65,iskan:false,salesSt:'open',occSt:'none',sale:16,client:'Yükselen İnşaat',editor:'Мехмет К.',tags:['res','com'],access:'01.06.2027',diamond:true,
  cover:'diamond-photos/IMG-20250611-WA0060.jpg',
  photos:['diamond-photos/IMG-20250611-WA0060.jpg#cat=pool','diamond-photos/IMG-20250611-WA0061.jpg', /* … */ 'diamond-photos/IMG-20250611-WA0159.jpg'],
  files:[
    {n:'Sunum — презентация',s:'PDF',u:'diamond-plans/sunum.pdf'},
    {n:'Fiyat Listesi — прайс',s:'JPEG',u:'diamond-plans/price-list.jpeg'},
    {n:'Vaziyet Planı — генплан',s:'JPEG',u:'diamond-plans/vaziyet.jpeg'},
    {n:'Kat Planı — типовой этаж',s:'JPEG',u:'diamond-plans/kat-plani.jpeg'},
    {n:'Daire planı 1+1',s:'JPEG',u:'diamond-plans/plan-1-1.jpeg'},
    {n:'Daire planı 2+1',s:'JPEG',u:'diamond-plans/plan-2-1.jpeg'}
  ]}
```

Шесть демо-объектов: MEGAPOLIS RESIDENCE (id 8, mega, `rows.json`, коммерция TİCARİ), YÜKSELEN DIAMOND (9, diamond), AKROPOLIS RESIDENCE (10, akro, `rows.json`, LIVE), ALLURE (13, mixed: 126 квартир + 10 вилл), RICHMOND VILLAS (14, villas+rich, 16 вилл 5 типов), AVOCADO VILLAGE (12, villas, hidden/done, план посёлка с маркерами).

**Редактируемые поля объекта в `state`** (2258–2265): `eName, eStage, eReady, eIskan, eSales, eOcc, ePurps, eVideo, eLive, ePhotos, eDescs{RU,EN,TR,AR}, eAddr, eLng, eLat, eProg[{d,t,ph[],live}], eDocs{yapi,iskan,tapu,dask}, eFiles[{n,s,u}]`. `openObject` (2691) копирует их из проекта; часть изменений пишется обратно через `pWrite` (3701). Описания, координаты, дневник и статусы документов **не** сохраняются в `PROJECTS` — они общие для всех объектов (недоработка прототипа).

### 3.2. Помещение (unit) — `this.UNITSTORE[objId]` / `state.units`

| Поле | Тип | Смысл |
|---|---|---|
| `uid` | number | Внутренний id (в экспорте — колонка ID) |
| `num` | string/number | Номер (виден пользователю; для вилл — имя `Tahiti`, `B1`, число) |
| `floor` | int | Этаж: 0 = цоколь/Zemin, отрицательные = B1/B2 |
| `pos` | int | Позиция в ряду (колонка). В генераторах — 0-based или 1-based; `gNormPos` (2846) нормализует в 1..n |
| `band` | `out`/`ins` | Ряд на этаже: окна наружу / во двор |
| `wing` | string | Корпус/блок (`A`, `B`, `C`, `T` = коммерция). Пусто — один корпус |
| `type` | string | Комнатность `1+1`, `2+1`, … , `1*` = коммерция; `''` для пустых плиток генератора |
| `area` | number | м² |
| `price` | number | Цена в валюте объекта (0 = нет цены) |
| `status` | enum `STORDER` | `free`, `booked`, `process`, `sold`, `reserve` |
| `tag` | `null`/`duplex`/`tduplex`/`triplex`/`kapici`/`ofis`/`terrace`(легаси) | Спецтип |
| `ft` | `('terrace'\|'garden')[]` | Доп. метки (бейджи Терраса/Сад) |
| `feats` | string[] | Особенности из `state.features` |
| `entry` | int[] | Триплекс: уровни входа (0 нижний, 1 средний, 2 верхний) |
| `td` | 0/1/2 | Триплекс: смещение вниз |
| `w` | 1–3 | Ширина плитки в клетках (undefined = 1) |
| `vl` | bool | Вилла |
| `vt` | number/string | Тип виллы |
| `la` | number | Площадь участка виллы |
| `blok` | string | Блок виллы (Allure B–F) |
| `px`, `py` | % | Позиция маркера на плане посёлка (Avocado) |
| `lx`, `lw` | px | Легаси-координаты из `rows.json` (tie-break в `gNormPos`; `mBandShow` скрыт при `lx!=null`) |
| `gen` | bool | Создан генератором/редактором (участвует в `gRenum`) |
| `ptId` | number | Ручной тип планировки (0/undefined = авто) |

Примеры: `{uid:8000,num:'B1',floor:0,pos:0,band:'out',type:'4+1',area:377.6,la:556.7,price:0,status:'sold',vt:2,tag:null,feats:[]}` (Richmond, 2563); `{uid:3901,num:1,floor:0,pos:0,band:'out',wing:'T',lx:0,lw:225,type:'1*',area:485,price:0,status:'sold',tag:null,feats:[]}` (Megapolis дюккан, 2589).

Формат `rows.json` (2510–2524): `[{b:'A', f:'7'|'GO'|'GI', cells:[[num, lx, lw, type, area, price, free(0/1), tags('T','D','K')], …]}]`; `f:'GI'` → `band:'ins'`, `floor:0`; `lx` кластеризуется в `pos` с порогом 55px.

### 3.3. Компания — `this.COMPANIES` (2162–2168)

`{id, name, dir, objIds:number[], until:''|'YYYY-MM-DD', active?:bool, phone?, mail?, web?, addr?, vergi?}`.
Пример: `{id:2,name:'Yükselen İnşaat',dir:'Kemal Yükselen',objIds:[9],until:'2026-11-30'}`.

### 3.4. Пользователь — `this.USERS` (2169–2179)

`{id, companyIds:number[], role:'admin'|'editor'|'client', fio, mail, access:'all'|number[], until:'—'|'DD.MM.YYYY', active?:bool, platform?:bool}`.
Пример: `{id:102,companyIds:[1,3],role:'editor',fio:'Мехмет Кая',mail:'mehmet@serveroglu.com.tr',access:'all',until:'—',platform:true}`.

### 3.5. Участник команды чата — `this.TEAM` (2186–2191)

`{id, name, init, color, role}`; пример `{id:1,name:'Ahmet Yılmaz',init:'AY',color:'#4d7cfe',role:'admin'}`. Текущий пользователь в чате — `who:'me'` (аватар «AY», #4d7cfe).

### 3.6. Уведомление — `this.NOTIFS` (2192–2207)

`{id, type, who:TEAM.id, obj:string, unit?:string, extra?:string, mins:number}`; `type ∈ sold, booked, price, status, media, doc, newobj`. Пример: `{id:3,type:'price',who:1,obj:'MEGAPOLIS RESIDENCE',unit:'B-203',extra:'2 350 000 €',mins:126}`. Иконки/цвета `NOTIFICON` (2208): sold `ti-check` #0f9d6b/#e4f6ee; booked `ti-clock-hour-4` #d98a1e/#fdf2e4; price `ti-tag` #4d7cfe/#eef3ff; status `ti-refresh` #7b4fd0/#f2ecfb; media `ti-photo` #0284c7/#e5f3fb; doc `ti-file` #64748b/#eef1f5; newobj `ti-building-plus` #e5484d/#fdecef. Прочитанность — `state.notifReadIds` (default прочитаны id 6–14).

### 3.7. Сообщение чата — `this.DM_SEED[peerId][]` / `state.dmStore` (2212–2218)

`{who:TEAM.id|'me', text, mins, st?:'sent'|'delivered'|'read', lang?:'RU'|'EN'|'TR', mid?}`. Пример: `{who:2,text:'A-104 dairesini sattım 🎉 müşteri Almanya\'dan.',mins:150,lang:'TR'}`. Непрочитанные — `DM_UNREAD={2:1,4:0,1:0,3:0}`.

### 3.8. Запись журнала — `this.LOGSTORE[objId][]` (создаётся в 2999/3104)

`{ts:number, uid, num, f:'status'|'price', from, to}`. Пример сида: `{ts:Date.now()-864e5*2,uid,num,f:'status',from:'free',to:'booked'}`.

### 3.9. Тип планировки — `this.PLANTYPES[objId][]` (`getPT`, 2961)

`{id, name:'Tip A', rooms:'2+1', area:number, imgs:string[], manual?:bool}`. Автогенерация: группировка юнитов по `type|area` (кроме `1*`), сортировка по rooms, area; имена `Tip A/B/C…` внутри комнатности.

### 3.10. Правовой документ — `this.LEGAL` (2161) и оператор `this.LEGALCO` (2160)

`{id, icon, title, ver:'v1.0', upd:'15.07.2026', body:[{h, p:string[]}]}` — 10 документов: `uyelik`, `kosullar`, `gizlilik`, `kvkk`, `cerez`, `icerik`, `sikayet`, `veri`, `saklama`, `ileti`. `LEGALCO = {name, vkn, mersis, sicil, yetki, adres, kvkkMail, legalMail}`.

### 3.11. Настройки объекта и глобальные справочники

| Что | Где | Значения |
|---|---|---|
| Цвета статусов | `state.colors` (2249) | free `#059669`, booked `#FBBF24`, process `#3B82F6`, sold `#64748B`, reserve `#8B5CF6` (текст booked — `#78350F`) |
| Особенности | `state.features` (2250) | «Вид на море», «Первая линия», «Угловая», «Терраса», «С мебелью», «Под гражданство» |
| Порядок статусов | `STORDER` (2224) | free, booked, process, sold, reserve |
| Стадии | `STAGELIST`/`STAGECOLOR`/`STAGEPCT` (2182–2184) | цвета: project #8a93a2, siteprep #a16207, foundation #b45309, frame #4d7cfe, facade #7b4fd0, interior #0284c7, landscape #0f9d6b, done #43a047 |
| Теги назначения | `TAGCOLOR` (2180) | cit #7b4fd0/#efe7fb, res #0284c7/#e0f2fe, com #b45309/#fef3c7 |
| Роли | `ROLECOLOR` (2185) | admin #e5484d/#fdecef, editor #4d7cfe/#eef3ff, client #43a047/#e4f6ee |
| Валюты | `curInfo` (2687) | курс EUR 1, USD 1.09, TRY 35; символы € $ ₺; формат `Intl.NumberFormat('ru-RU')` |
| Категории фото | `catOpts` (3711), `L.cats` | exterior, interior, social, pool, spa, kids, park (+all, video в i18n) |
| Статусы документов | `eDocs` | `ok` («Получен», зелёный), `wait`/`soon` («Оформляется», жёлтый/серый) — `dstat` 2690 |
| Комнатность | `typeOpts` (4246) | `1+0 … 10+2`, `10 Üzeri`, `1*` |
| Спецтипы | `tagOpts` (4247) | '', duplex, tduplex, triplex, kapici |
| Схемы этажей | `fLbl` (2899) | tr: B2·B1·Z·1…; int: B2·B1·G·1…; num: -2·-1·0·1… |
| Мега-инфо | `MEGA_INFO` (2158) | plot 35 852 м², units 406, sea 5 км, install 50%, tapu 100% |
| AI-переводы описаний | `AITR` (2157) | EN/TR/AR |

### 3.12. Полный список ключей `state` (2240–2270)

`authed, screen, tab, lang, legalDoc, cookieDone, notifOpen, notifRead, notifReadIds, notifFilter, notifCleared, notifLim*, chatDraft, chatMsgs, chatPeer, dmStore, dmSearch, demoOpen, chatTr, chatReadLang, trCache, trShow, regOpen, regDone, regOrg, regRep, regMail, regC, regStamp, regIp, profMkt, profReqShow, landing, leadName, leadCo, leadPhone, leadMail, leadMsg, leadC, leadDone, scheme, listVariant, objId, galCat, descLang, presLang, fRoom, fSt, aMin, aMax, pMin, pMax, qNum, logPage, colors, features, newFeat, fCur, uRole, megaCell, boardZoom, lbList, lbIdx, viewRole, coView, coModal, showHidden, showInactiveCo, usersTab, coViewMode, coSearch, peopleSearch, ufCoSearch, cfStep, cfName, cfDir, cfAdmName, cfAdmMail, cfTried, ufRoleInfo, ufRole, ufName, ufMail, ufAccess, ufCompanies, ufUntil, ufPass, ufCopied, ufPlatform, coObjShowAll, coObjShowHidden, addOpen, addStep, awTags, wzClient, wzCoSearch, plOpen, liveOpen, vidOpen, addComm, aiBusy, impOpen, impRows, impFile, impErr, eName, eStage, eReady, eIskan, eSales, eOcc, ePurps, eVideo, eLive, objView, ePhotos, eDescs, eAddr, eLng, eLat, eProg, eDocs, eFiles, newProg, saveState, savedAt, profPass, profCopied, gridText, units, modalNum, mStatus, mFeats, fpCardNum, mNum, mType, mArea, mPrice, mTag, mFt, mEntry, mTd, fpPlan, editGrid, copied, fStage, fIskan, fSales, sortKey, sortDir, fSeg, pubView, fVType, mImg, mGalIdx, mLight, mkOpen, mkMode, mkText, mkF, mkP, mkPF, mkT, mkA, mkPr, mkKind, mkWing, mkReplace, mkVN, mLa, mVt, sheet, fWing` (+ добавляемые позже: `gSel, mPt, mWidth, mBand, navSheet, dashObjQ, dashObjExp, plRoom, ptFlash`).

---

## 4. Шахматка (единый движок сетки)

Один и тот же вычислитель `bBlocks` (3550–3641) питает три места разметки: кабинет (654–711), публичную страницу (1403–1455) и печать PDF (через DOM). Разница только во флаге `editOn = state.editGrid` (на публичной странице всегда false).

### 4.1. Геометрия

| Параметр | Значение | Где |
|---|---|---|
| Ширина клетки | 132px (`flex:none;width:132px;min-width:132px;max-width:132px`) | `cellV` 3476, `fixW` 3557 |
| Высота клетки | `min-height:92px`, `align-self:stretch` | 3516 |
| Зазор | 7px (`gap:7px` в ряду и между этажами) | 3636, 4161 |
| Ширина плитки на `w` клеток | `w*132 + (w-1)*7` | `applyW` 3523 |
| Шаг «дощёлкивания» | 139px (`cellPx`) | 3525 |
| Колонка номера этажа | 52px, `position:sticky; left:0; z-index:6`, фон #eef0f4, radius 9 | 681 |
| Подпись стороны ряда | 64px (`band.hasSide`) — в текущей версии всегда выключена (3639), надписи `sideTop/sideBot` («окна наружу»/«окна во двор», 8px uppercase) выводятся сверху и снизу в колонке этажа при `f.hasSides` | 681, 685 |
| Пустой слот (editOn) | 132px, `border:2px dashed #cdd5e2`, radius 11 | `mkSlot` 3558 |
| Дырка (просмотр) | 132px пустой div (`isHole`), хвостовые дырки отрезаются (3633) | 688 |
| Дырка под накрытием (`isCoverHole`) | 132px × min-height 92px | 689 |
| Кнопка «+ Квартира» в ряду | 110px, dashed, `align-self:stretch` | 701 |
| Кнопка «+ Этаж» | dashed, min-width 220px, под блоком | 707 |
| Контейнер доски | `min-width:900px; display:flex; flex-direction:column; gap:7px; zoom:{boardZoom}` в `overflow-x:auto` | `boardInnerStyle` 4161 |
| Заголовок блока | «Блок A» — 15px/800, фон #14243f, radius 8; для `wing==='T'` — «TİCARİ — DÜKKANLAR» | 656, 3564 |
| Компактный режим | при `units.length>120` padding плитки 7/9 вместо 10/12 | 3472, 3516 |
| Плитка: строка 1 | тип слева, «№num» справа, 13px/600 (`l1Style`) | 3486 |
| Плитка: цена | 17px/800 (`priceStyle`) | 3487 |
| Плитка: мета | «area м²» + цена/м² (`showPerM2`: только если prop включён, не sold, есть цена и не многоэтажная) 11px opacity .9 | 3488, 3484 |
| Проданная плитка | центрированная колонка: «№num», «тип · м²», «Продано» | 692 |
| Бейджи | pill 10px/700, фон rgba(255,255,255,.92), цвет по типу; `align-self:flex-start` | `bgSt` 3479 |
| Ресайз-ручка | 12px справа на всю высоту, `cursor:ew-resize`, белая полоска 3×20 | 3524 |
| Крестик удаления | 18px, top/right 3px, красный на белом | 668 |
| Выделение (группа) | `outline:3px solid #4d7cfe; outline-offset:2px` | 3516 |

### 4.2. Цвета плиток

Фон = `state.colors[status]`; текст белый, для `booked` — `#78350F`. Затемнение непрошедших фильтр — `opacity:.26`. Hover: `translateY(-2px)` + тень `0 8px 20px rgba(20,36,63,.16)`. Цвета бейджей `tagMeta2` (3467): terrace #0284c7, duplex #b45309, tduplex #9a3412, triplex #0f766e, kapici #6b7688, ofis #7b4fd0; garden #15803d; бейдж «Вход · этаж» — фон #0f766e, белый текст (3625); «близнец» — «⧉ …» на rgba(15,23,42,.35) (3628). Легенда: «Всего» #14243f + статусы с count по `segPass` (3145–3151); активный фильтр — фон #eef3ff и inset-рамка #4d7cfe.

### 4.3. Алгоритм построения `bBlocks` (3550–3641)

1. `gAll` — все не-виллы. `minP..maxP` — глобальный диапазон `pos` (по всем корпусам!). В `editOn` добавляется одна лишняя колонка `extra=1`.
2. Корпуса `wingList` = уникальные `wing` (sorted); при отсутствии — один блок `''`. Для каждого блока — `name`, `showName` (не в edit-режиме), переименование (`onRename` 3566 меняет `wing` у всех юнитов корпуса; input `onBlur`), `addFloor` → `gAddFloorW(wg)`, `alignBtns` (left/center/right → `gAlign(mode,wg)`).
3. `floors` внутри блока:
   - `uw` — юниты корпуса, прошедшие сегмент-фильтр. `_need` — множество этажей: свои + для duplex `floor+1`, tduplex `floor-1`, triplex `lo..lo+2` где `lo=floor-td`. `shown` — по убыванию.
   - `fHasIns[f]` — есть ли на этаже ряд `ins`. `rowKeys` — линейный список рядов вида `f|out`, `f|ins` (сверху вниз). `RI(f,bd)` — индекс ряда.
   - `homeAt(f,bd,p,self)` — занята ли клетка `p` другой плиткой с учётом ширины `w`.
   - Многоэтажные (3579–3604): для каждого duplex/tduplex/triplex ищутся целевые этажи `cand` (duplex `[f+1]`; tduplex `[f-1]`; triplex — варианты по `td`: 0 → `[f+1,f+2]`, 1 → `[f+1,f-1]`, 2 → `[f-1,f-2]`, перебираются начиная с текущего `td`). Условие: все целевые этажи показаны и клетки `p..p+w-1` в своём ряду свободны (`rowFree`, учитывая `cover` и `twin`). Далее проверяются **все промежуточные ряды** между верхним и нижним (`okA`):
     - все свободны → случай **(A)**: клетки помечаются `cover[f|bd|q]=uid`, плитка получает `expandMode[uid]={a: рядов вверх, b: рядов вниз, lines: позиции разделительных линий, bf: нижний этаж}`;
     - иначе → случай **(C)**: на целевых этажах ставится `twin[f|bd|q]=u` — «близнец».
     - если целевая клетка занята → ни cover, ни twin → плитка остаётся одноэтажной с бейджем типа (случай «бейдж»).
   - Для каждого этажа (`shown.map`, 3605): `fu2` — юниты этажа, ряды `bands` = `['out','ins']` если на этаже есть `ins`, иначе один. `mkCells(bd)` (3612–3634) идёт по `p=minP..maxP+extra`:
     - юнит на позиции → `cellV(u)` + `fixW` + `applyW` (ширина, ресайз); если `expandMode` — высота `hb*r+7*(r-1)`, отрицательные `margin-top/bottom` на `a`/`b` рядов, `z-index:2`, разделительные линии (`splitLine`, `splitLine2`: 2px белые с opacity .55 на позициях `rk*(hb+7)-4`), бейджи «Вход · этаж» для триплекса по `entry`; `_skip=w-1` колонок пропускаются;
     - `twin` → копия `cellV(tu)` без ресайза/удаления/выделения, фиксированной высоты, `outline:2px dashed rgba(255,255,255,.8)`, бейдж «⧉ …»;
     - `cover` → `{isCoverHole}`;
     - `editOn` → `mkSlot(f,p,wg,bd)`; иначе `{isHole}`.
   - Строка этажа: `label` = `fLbl(f,obj)`, `floorSuffix` = «Цоколь» для 0 иначе «эт.», `canDel` (editOn) → `gDelFloor(f)`, `hasSides`.
   - `b1Row` (2882–2897): если tduplex/триплекс уходит ниже самого нижнего показанного этажа, дорисовываются пустые пунктирные ряды B1/B2 (`opacity:.6`).

### 4.4. Плитка `cellV(u, pal)` (3470–3518)

Возвращает объект со всеми полями шаблона: `num, typeLabel, area, isSold/notSold, priceLabel, perM2, showPerM2, badgesList, l1Style, priceStyle, metaStyle, open, uid, dragStart, canDel/delQuick, canSel/selToggle/selStyle, style, soldStyle`. `pal` (палитра Diamond) в v2 всегда `null`.

- `open(e)`: в edit-режиме Ctrl/Cmd-клик → `gSelTgl(uid)` (точечное выделение), иначе `openUnit(uid)`. `openUnit` (2817) игнорирует клик в течение 400 мс после ресайза (`_resizeSuppress`).
- `dragStart`: только в edit-режиме; сохраняет `_dragUid`, `pointer-events:none` на плитке; если плитка входит в выделение `gSel` (>1) — все выделенные затемняются (`opacity .45`, dashed outline) и строится общий drag-image (клон до 24 плиток, масштаб ≤0.62, max 320×260, 3496–3511).
- `delQuick`: удаляет юнит и вызывает `gRenum`.

### 4.5. Растяжка ширины `applyW` (3519–3528)

`avail` — число свободных клеток справа в своём ряду (стоп на юните или чужом `cover`); `maxW=1+avail`; `sw=min(w,maxW)`. Ширина в px подставляется заменой `132px` в стилях. В edit-режиме `resizeStart` (pointer events): плитка следует за курсором пиксель-в-пиксель (`clampPx` в пределах `px(1)..px(mx)`), при отпускании `nw=round((width+7)/139)` (>50% соседней клетки — заполняет), анимация `transition .15s`, через 160 мс `gMut` пишет `w` (undefined если 1). `_resizeSuppress` подавляет последующий клик.

### 4.6. Перемещение и группы

| Механика | Функция | Строки | Поведение |
|---|---|---|---|
| Drop на слот | `mkSlot.drop` → `gGroupMove(uid,f,p,wg,bd)` | 3562, 2901–2920 | Смещение `df/dp` применяется ко всем выделенным (если тянут выделенную) или к одной; проверка: `np≥0`, этаж существует, клетка не занята; `band` — при переносе на этаж с рядом `ins`: для одиночки — ряд слота, для группы — свой; иначе `out`; корпус = целевой `wg`; затем `gRenum`, `gSel=[]` |
| Drop на плитку | документный `drop` → `gSwapUnits` | 2775–2781, 2835–2845 | Обмен `floor/pos/band/wing` («пятнашки») |
| Рамка выделения | `_mqDown` | 2732–2760 | `mousedown` на пустом месте `[data-oplboard]` в edit-режиме рисует fixed-рамку (#4d7cfe, rgba(77,124,254,.12)); на `mouseup` все `[data-opluid]`, пересёкшие рамку → `gSel`; рамка <8px — сброс |
| Ctrl-клик | `open` | 3489 | toggle в `gSel` |
| Долгое нажатие (тач) | `_lpStart` | 2764–2774 | 550 мс на плитке → `gSelTgl` |
| Подсветка слота | `dragOver/dragLeave` | 3560 | рамка #4d7cfe, фон #eef3ff |
| Очистка | `_grpEnd`, `_dragEnd` | 2761, 2789 | возвращает стили, сбрасывает `_dragUid` |

### 4.7. Правка структуры

| Действие | Функция | Строки |
|---|---|---|
| + Квартира в ряд | `gAddUnit(f,band,wg)` | 2820 — `pos = max+1`, `num = max+1`, `gen:true`, `type:''`, `gRenum` |
| + Этаж (корпус) | `gAddFloorW(wg)` | 2823 — `floor = max+1` внутри корпуса, одна пустая плитка `pos:1` |
| + Этаж (глобально) | `gAddFloor` | 2821 (не используется в разметке) |
| Удалить этаж | `gDelFloor(f)` | 2822 |
| Удалить юнит | `gDelUnit` (из модалки) / `delQuick` | 2819, 3513 |
| Выравнивание | `gAlign(mode,wg)` | 2921–2960: для каждого ряда `floor\|band` одноэтажные юниты получают позиции из свободных колонок ширины `max(maxN, n+taken)`; колонки многоэтажных (`spanOf`) зарезервированы на всех накрытых этажах; `left` — первые, `right` — последние, `center` («Пирамида») — по центру; затем `gRenum` |
| Перенумерация | `gRenum` | 2824–2834: только для `gen`-юнитов или `genGrid`-объектов; сквозная нумерация 1..n по корпусам (sorted), внутри — по `floor` asc, `pos` asc |
| Нормализация позиций | `gNormPos` / `needsNormPos` | 2846–2858: если разброс `pos` >40 (легаси px-координаты) — при входе в edit-режим (`toggleEdit` 4148) и при старте (2274) `pos` пересчитывается в 1..n внутри `wing\|floor\|band` с tie-break по `lx` |
| Переименование корпуса | `bl.onRename` | 3566 |
| Вход в edit-режим | `toggleEdit` | 4148 — также переключает `floor`-схему на `board` |

### 4.8. Нумерация этажей, зум, мобайл

- `fLbl(f, obj)` (2899): `f<0` → `B{-f}` (num: `-1`); `f===0` → `Z` (tr) / `G` (int) / `0` (num); иначе число. Схема хранится в `obj.fScheme`, настраивается в «Настройках».
- Зум `zoomBtns` 100/75/50 % (4195) → `boardZoom` → CSS `zoom` контейнера; для чисто-вилловых объектов скрыт (`pubShowZoom`, `notVillas`).
- Мобайл: доска горизонтально скроллится (`overflow-x:auto`), колонка этажей sticky слева; выделение — долгое нажатие; ресайз — pointer events (touch); фильтры — bottom-sheet; модалка квартиры — bottom-sheet высотой `calc(100% - 30px)` с медиа 37%.
- Резайз окна вызывает `forceUpdate` (2720, 2791) — все `isMobW`/`mobV` пересчитываются (порог 760px).

### 4.9. Модалка квартиры (`modalOpen`, 1993–2060; данные 3424–3443, 3739–3750, 4096–4107, 4243–4248)

Раскладка: десктоп — `width:min(1060px,96vw); height:min(690px,92vh)`, radius 22, слева тёмная (#0d1524) медиа-панель `flex:1.25`, справа инфо 430px; мобайл — bottom-sheet, медиа 37% сверху.

- Медиа: `planImg` = `MM.main` (3739–3750): изображения типа планировки (`ptFor(u).imgs`), иначе для Diamond — `diamond-plans/plan-1-1.jpeg`/`plan-2-1.jpeg`, Richmond — 12 фото по типу виллы `richmond/web-t{vt}-{out,o2,o3,o4,in,i2,i3,i4,p1,p2,p3,p4}.jpg`, Avocado — фото по номеру, Megapolis — `web-vaziyet.jpg`, иначе первое фото объекта. Навигация `galPrev/galNext`, счётчик `galPos`, миниатюры `modalThumbs` 58px, клик → лайтбокс `openLight`.
- Шапка: «№ num», `modal.sub` (объект · этаж · тип, для вилл — «Вилла · Тип N · 4+1 · дом A м² · участок B м²»).
- Цена `priceLabel` 28px/800 + `perM2`; карточки «Комнат/типLabel» и «Площадь».
- PDF планировки `hasModalPdf`: Megapolis — `uploads/LAYOUTS/A{num}.pdf` или `megapolis-ticari/plans/dukkan-{num}.pdf`; Avocado — `avocado-data/desc-{num}.pdf` (63/72/74).
- Редактирование (`isEditModal` = editOn и экран object): `mNum`, `select mType` (`typeOpts`), `mArea`, `mPrice`; ширина `widthOpts` 1/2/3 (`mWidthShow`, не для вилл); ряд `bandOpts` Наружу/Двор (`mBandShow`, не для легаси-объектов с `lx` и не для вилл); `select mTag` (`tagOpts`); тип планировки `mPtChips` (Авто → «Tip X (новый тип)» + ручные типы той же комнатности/площади); доп. метки `ftChips` (Терраса/Сад); для триплекса — `entryChips` (Нижний/Средний/Верхний, мультивыбор) и `tdChips` (Вверх / Вниз на −1 / Вниз на −2); для вилл — `mLa` (участок), `mVt` (тип виллы).
- Статус `statusBtns` (`canSetStatus` = не публичная страница) — 5 кнопок с цветной точкой, выбранная — рамка 2px цвета статуса.
- На публичной странице (`isPublicModal`) вместо статусов — кнопки «Оставить заявку» и «WhatsApp» (без обработчиков).
- Особенности `modalFeats` (`toggleMFeat`).
- Футер: `gDelUnit` (edit), `closeModal`, `saveUnit` (2999): пишет все поля, `w` (undefined при 1), `band`, `entry` (sorted, default `[1]`), `td`, `ft`, `ptId`; при отсутствии ручного типа вызывает `ensureAutoType`; создаёт записи журнала при смене `status`/`price`.

### 4.10. Автотипы планировок по комнатности + м²

`getPT(oid)` (2961–2973) строит список при первом обращении; `autoTypeInfo` (2979) — существующий тип или имя следующего (`nextTypeName` 2974: `Tip A/B/…` внутри комнатности); `ensureAutoType` (2985) создаёт тип при сохранении квартиры; `ptFor(u)` (2993): `ptId` → точное совпадение rooms+area → первое совпадение rooms. В модалке типов (`plTypes`, 4023–4044) показываются только типы с привязанными квартирами (`cnt>0`) или ручные (`manual`) — «осиротевшие» скрываются автоматически.

### 4.11. Легаси-код в файле (не использовать при пересборке)

`board` (3135–3144, старая 8×7 сетка), `megaBlocks`/`megaBlocksV`/`megaLegend`/`megaCellV`/`megaCell`-модалка (2484–2509, 3153–3179, 3437–3443, 3531–3549), `isGap`/`isVoid` ячейки (690–691), `DIAPAL`/`isDiaL`, `gridText`/`gridPreview`, `GAL`/`galImages`/`galCatsView`, `presLangs`, `descMap`, `hubSections`, `lightOpen`-разметка (2062–2072), `canAlign:false`+`alignBtns` (глобальные), `CHAT_SEED`, `TDX`, `LAYOUT`/`AREA`/`FLOOR_BASE`/`genUnits` (только для несуществующих id), `cookieShow`/`cookieAll`/`cookieEssential` (нет разметки), `profAccepted`/`profReq`/`profChkMkt` (нет разметки), дублирующее присваивание `LEGALCO`/`LEGAL` внутри `createCompany` (3336–3337).

---

## 5. Поведение

### 5.1. Экспорт / импорт

**Экспорт Excel** (`exportExcel` 4004 → `downloadXls` 3053–3062): строки = юниты, прошедшие фильтр `pass`, сортировка этаж desc, pos asc. Колонки (заголовки берутся из i18n текущего языка):

| # | Заголовок (RU) | Значение |
|---|---|---|
| 1 | `ID` | `u.uid` |
| 2 | `Корпус` (`f_block`) | `wing`/`blok` или `''` |
| 3 | `Поэтажный план` (`scheme_floor` — **ошибка прототипа**, должно быть «Этаж») | `fLbl(floor)`; для вилл — «Вилла» |
| 4 | `№` | `num` |
| 5 | `Комнаты` (`f_rooms`) | тип; `1*` → «Коммерция» |
| 6 | `м²` | area |
| 7 | `Стоимость (EUR)` | price; пусто для sold и без цены |
| 8 | `Статус` | локализованная метка статуса |

Ширины колонок `!cols` [7,9,9,8,13,8,17,14]; лист = `plans_title` (не длиннее 28 символов); имя файла = `name` с заменой не-алфавитных на `_` + `.xlsx`. Без SheetJS — CSV с `;`, BOM, кавычки по RFC.

**Экспорт PDF** (`exportPdf` 3032–3052): собирает `[data-board="1"]` (или `[data-print-list]` для списка, `[data-print-fp]` для плана), клонирует `outerHTML` + легенду в скрытый iframe, `@page{size:A3 landscape;margin:10mm}`, масштаб `min(1, 1440/width)`, заголовок «name / loc · дата · OnePlan», `print()`.

**Импорт** (`impPick` 3066 → `impBuild` 3067–3082 → модалка → `impApply` 3083):
- Принимает `.csv,.xls,.xlsx`; xlsx через `XLSX.read(binary)` первый лист `sheet_to_json(header:1)`; CSV — `parseCsv` (3063–3064) с автоопределением разделителя `;` или `,` и кавычек.
- Определение колонок по нормализованным заголовкам (`nm`: lower, только буквы/цифры): `id` (точно), номер (`num`, `номер`, `daireno`, `№`, `no`), цена (`цена`, `price`, `fiyat`, `стоим`, `maliyet`), статус (`статус`, `status`, `durum`), площадь (`area`, `alan`, `m2`, `площад`, `м`, `м2`). Дефолтные индексы при отсутствии: num=2, area=4, price=5, status=7 (совпадают с экспортом).
- Сопоставление: сначала по `ID` → `uid`, потом по `num`. Изменения: price (округлённое число не равно текущему), status (через `statusReverse` 3065 — словарь всех меток RU/EN/TR и ключей → ключ), area (разница больше 0.049).
- Модалка предпросмотра (1764–1789): имя файла, ошибка (`impErr` — меньше 2 строк или не прочитан), «изменений нет», либо список «№ num: поле from → to» и кнопка «Применить · N». `impApply` мутирует юниты через `gMut` и вызывает `touch()`; **в журнал не пишет**.

### 5.2. Журнал изменений

Пишется только в `saveUnit` (2999) при изменении `status` или `price` — `{ts, uid, num, f, from, to}` в `LOGSTORE[objId]`. Пользователь в UI всегда «Admin» (3110). Отображение: новые сверху, 20 на страницу, дата в локали языка (`ru-RU`/`en-GB`/`tr-TR`, `dd MMM · HH:mm`). Демо-сид (3104): 3 продажи (6/12/18 дней назад), одна бронь (2 дня), одно изменение цены (4 дня, старая = price×0.94).

### 5.3. Уведомления

- Источник — статический `NOTIFS`; `mins` — «минут назад». `agoText` (3758): «только что» / «N мин назад» / «N ч назад» / «N дн назад».
- Текст: «**who** ev **obj** · unit → extra», где `ev = TT.ev[type]` («продал(а) квартиру», «забронировал(а)», «изменил(а) цену», «сменил(а) статус», «добавил(а) фото/видео», «загрузил(а) документ», «создал(а) объект»); для `status` extra локализуется через `TT.st`.
- Счётчик = непрочитанные (`notifReadIds`). Дропдаун — 7 последних. Страница — фильтр по типу, группы Сегодня (меньше 900 мин) / Вчера (меньше 2340) / Ранее, порции по 20. «Очистить» → `notifCleared:true` (список пуст). Клик по уведомлению — только пометка прочитанным (перехода к объекту нет).
- По ТЗ §13 события должны генерироваться бэкендом по действиям (продажа, бронь, статус, цена, медиа, документы, новый объект) и ограничиваться компаниями пользователя.

### 5.4. Чат

- Диалоги 1-на-1 с участниками `TEAM`. Список `convos` (3845–3852) с поиском по имени, превью последнего сообщения, `ago`, точкой непрочитанного (`DM_UNREAD[peer]` и не открытый диалог), активный — фон #eef3ff.
- Отправка `sendDM` (3878–3880): `{who:'me', text, mins:0, st:'sent', mid, lang: UI-язык}` → через 700 мс `delivered` → через 2100 мс `read`. Галочки: `sent` → `ti-check`; `delivered`/`read` → `ti-checks`; `read` — синий #4d7cfe, иначе #b3bcc9. Enter отправляет (input однострочный).
- **AI-перевод** (`ensureTr` 2694–2717, `activeThread` 3858–3877): если `chatTr` включён и `m.lang` отличается от `readLang` (default = язык интерфейса, переопределяется `readLangBtns`), для текста запрашивается перевод с кэшем `trCache[readLang + U+0001 + text]` и защитой от повторных запросов `_trPend`. Провайдер — `window.claude.complete(prompt)` (в среде прототипа), промпт: «You are a translation engine for a real-estate team chat. Translate the message below into {Russian|English|Turkish}. Keep the tone casual, preserve emoji, numbers, and property codes (like A-104, B-203) exactly. Reply with ONLY the translation». Пока грузится — оригинал + «перевод…»; готово — перевод + подпись «(глобус) переведено · TR→RU», клик переключает на оригинал («· оригинал») через `trShow[peer:index]`. По ТЗ §12 в бою — DeepSeek/OpenAI chat/completions за абстракцией, WebSocket, статусы доставки на сервере, разделители дат (в прототипе отсутствуют).
- Мобайл (меньше 760): показывается либо список, либо тред; кнопка «назад» `dmBack`.

### 5.5. Типы планировок (модалка `plShow`, 1711–1762; данные 4019–4048)

Десктоп — карточка 640px/88vh, мобайл — bottom-sheet 92vh. Подсказки `pl_sub`, `pl_multi_hint`, `pt_mirror_hint`. Чипы комнатности `plRoomChips` (Все + все типы объекта, кроме `1*`) фильтруют список и скроллят вверх. Список `plTypes` сгруппирован по комнатности (`groupLabel` — синий чип «2+1» + линия); строка типа (`data-ptrow`): превью 96×72 (`pt.img`, `background-size:contain`, счётчик «+N»), `select` комнатности `pt.onRooms`, имя `pt.ptName` (`onName`), площадь `pt.areaVal` (`onArea`), «N квартир», кнопка «Загрузить»/«Добавить фото» (`pt.pick`, `input file image/* multiple`, `URL.createObjectURL`), удалить `pt.del`; миниатюры 52px с drag-сортировкой (`th.dragStart/dragOver/drop`), клик = сделать главной (`th.makeMain`), крестик `th.remove`; первая — бейдж «Главная». Футер: `ptAdd` (создаёт ручной тип `Tip X` для текущей комнатности, `manual:true`, подсветка `ptFlash` 1.9 с) и «Готово». Изменения → `touch()`.

### 5.6. Создание планировок (модалка `mkOpen`, 1645–1709; данные 2615–2685, 4108–4135)

Карточка 720px/92vh (мобайл — full-height sheet). Табы `mkTabs`: «Вставить из прайса» / «Сгенерировать сетку». Общие поля: `mkKindChips` (Квартиры / Коммерция / Виллы; для вилловых объектов default `villa`), `mkWingVal` (корпус, default — следующая свободная буква `nextBlockWing` 2655: если корпусов нет — «B», а существующие получают «A»), `mkModeChips` (Добавить к существующим — зелёный / Заменить всё — оранжевый с предупреждением `mkModeHint`).

- **Вставка** (`mkParse` 2615–2638): строки делятся по табуляции, `;` или двум и более пробелам (fallback — по пробелам); токены: тип `\d+\d` или `1*`; статус по подстрокам (`прода|sold|satıl` → sold, `брон|book|rezerv` → booked, `свобод|free|müsait|avail` → free); первое число — номер; число больше 5000 — цена; целое меньше 60 — этаж; 20…600 — площадь. Предпросмотр `mkStats` («Распознано: N помещений · M этажей») и таблица первых 6 строк `mkRows`.
- **Генерация** (`mkGen` 2639–2654): `mkF` этажей (1–40), `mkP` на этаже (1–20), переопределения по этажам `mkPF` (`mkFloorRows` — карточки «Этаж {label}» сверху вниз); сквозная нумерация 1..N; для вилл `mkVN` → `V1..VN`. Итог `mkGenSummary`.
- `mkCreate` → `mkApply(list, editAfter)` (2656–2685): при replace очищает флаги демо-генераторов и ставит `genGrid=editAfter`; корпус присваивается новым юнитам (`wing`), старым без корпуса — «A»; `pos` = следующий в `wing|floor`; `vl:true` для вилл, `gen:true` для остальных, `type:'1*'` для коммерции; объект становится `mixed` при смешении вилл/квартир; после создания — переход на шахматку, сброс фильтров, `editGrid=true` для генератора, плавный скролл к первой новой плитке (с ретраями 6×250 мс).

### 5.7. Публичные страницы и публикация

- URL объекта — `oneplan.pro/{slug}` (`slug` 3666: lower, транслит üöçşğı, не-алфавитные → `-`). Кнопка «Копировать» пишет `https://…` в буфер.
- Видимость на публичной странице: показывается, если `!pubHidden && stage!=='done' && !hidden && компания активна` (4213). «Не опубликовано» (`pubHidden`) переключается в hero карточки объекта. Скрытие в кабинете (`hidden`, `hideReason`) — в «Настройках». Завершённые (`stage==='done'`) автоматически считаются скрытыми.
- Режим публикации `pubMode` closed/public с `pubBeyan`/`eidsRef` — только хранится (внешние витрины one-team.pro / akdeniz.ru — вне прототипа).
- Страница застройщика показывает объекты того же `client`, не скрытые (4141). Контакты жёстко зашиты — должны браться из реквизитов компании (`phone`, `mail`, `web`, `addr`).
- LIVE: `pubLiveUrl = obj.live || eLive`; кнопки LIVE в списке объектов, hero объекта, карточке застройщика, публичной странице; модалка с iframe.
- Промо-видео: `embedUrl(obj.video || eVideo)`; кнопка play на обложке, модалка с iframe.
- Галерея: категории из `#cat=` (без суффикса — `exterior`); чипы показываются при более чем одной категории; лайтбокс с вертикальным свайпом.

### 5.8. Настройки и автосохранение

`touch()` (2692) — имитация автосохранения: `saving` → 700 мс → `saved HH:MM`; индикатор `epSave` в hero объекта, настройках, карточке компании, профайле, модалке типов. Все `eSet`, изменения компаний (`setCoField`, доступ, видимость), цветов, особенностей, типов планировок, импорта вызывают `touch()`.

Persist в `localStorage`: `op_showHidden`, `op_showInactiveCo`, `opl_cookie` (не используется в разметке).

### 5.9. Дашборд — формулы

| Метрика | Формула (3801–3841) |
|---|---|
| Видимые объекты `dvis` | `projectsV2` без `cabHidden` |
| `dUnits` | сумма юнитов видимых объектов |
| `dstatC[k]` | счётчики по статусам |
| Свободных в продаже `dFreeVal` | сумма `price` по `status==='free' && price>0` |
| Средняя цена юнита | `dFreeVal / count(free)` |
| Средняя цена м² | среднее `price/area` по свободным с ценой и площадью |
| Сегменты статусов | `count/total*100`, цвета дефолтной палитры |
| По объектам: продано | `sold/total`, `%` |
| Готовность | `p.ready` |
| Публикация | видимые / скрытые / `USERS.length` / `COMPANIES.length` |
| Контент | фото меньше 6, файлов меньше 2, нет `video` |
| События | первые 6 `notifBase` |

---

## 6. Дизайн-токены

### 6.1. Шрифты и иконки

- `Inter` 400/500/600/700/800 (Google Fonts, строка 12), fallback `-apple-system, system-ui, sans-serif`. Моноширинный для ссылок/паролей/превью: `ui-monospace, monospace`.
- Иконки — Tabler Icons webfont 3.19.0 (`<i class="ti ti-…">`).
- Размеры: h1 экрана 28px/800/-.02em; h1 лендинга clamp(30,5.4vw,54); h2 публичной 22px/800; заголовок секции 16px/700; заголовок карточки 15px/800; body 14px; вторичный 13px; мелкий 12/11.5/11px; бейджи 10–11px/700.

### 6.2. Цвета

| Роль | Hex | Где |
|---|---|---|
| Фон приложения | `#f7f8fb` | body (18) |
| Основной текст | `#1b2942` | body |
| Заголовки / «ink» | `#14243f` | везде |
| Акцент (blue) | `#4d7cfe`; hover `#3a63d4`; тёмный текст-акцент `#2f5fe0` | ссылки, кнопки |
| Акцент-фон | `#eef3ff`, `#eaf1ff`, `#f5f8ff`, `#f0f4ff` | активные чипы, hover |
| Вторичный текст | `#6b7688`, `#5a6472`, `#3c4759`, `#4a5567`, `#3d4757` | подписи |
| Приглушённый текст | `#8a93a2`, `#98a1af`, `#9aa1ac`, `#aab1bd`, `#a2abb8`, `#c3c9d4`, `#c5cbd6` | плейсхолдеры, мета |
| Границы | `#e6e9f0` (основная), `#eef1f6`, `#edeff4`, `#eef0f4`, `#f0f2f6`, `#dbe1ea`, `#cdd5e2` (dashed), `#d5dae2`, `#cdd7ea`/`#c9d6ef` (hover) | |
| Серые фоны | `#f0f2f6` (сегменты/аватары), `#f2f4f8`, `#fafbfd`, `#fbfcfe` (поля), `#eef0f4`, `#e7eaf0` | |
| Зелёный | `#0f9d6b` (текст/кнопки) на `#e4f6ee`; `#22c15e` (WhatsApp, галочки), `#43a047` (лого, done), `#1c7a4a`, `#137a4d` (Excel), `#059669` (статус free), `#15803d`/`#dcfce7` (Сад), `#3ddc97`, `#9df0cb`/`#8ff0c8` (готовность на тёмном) | |
| Красный | `#e5484d` (бейджи, LIVE, удалить), hover `#d13b40`; `#dc2626` на `#fdecec`; `#c53030`, `#a12626`; `#fdecef`; `#ffb3b6`, `#ff8b8b` | |
| Жёлтый/янтарный | `#f0ad00` (лого), `#FBBF24` (booked, текст `#78350F`), `#b7791f` на `#fdf3d7`, `#8a5a00` на `#fef6e0`/`#f5e3b0`, `#b45309` на `#fdf3e6`/`#fef3c7`, `#a16207`, `#c2740c`/`#9a5b12` на `#fff7ed`/`#fde3c2`, `#d98a1e` | |
| Фиолетовый | `#7b4fd0` на `#efe7fb`/`#f2ecfb`; `#8B5CF6` (reserve) | |
| Голубой | `#0284c7` на `#e0f2fe`/`#e5f3fb`; `#3B82F6` (process) | |
| Тил | `#0f766e` на `#e6fffa` (триплекс, вход) | |
| Серый статуса | `#64748B` (sold), `#6b7280` | |
| Тёмные фоны | `#14243f`, градиент `linear-gradient(135deg,#14243f,#1e3a63)`, `#0d1524` (медиа модалки), `#1e3454`/`#0f1b30`/`#1e3763` (hover тёмных кнопок), `#33456a`, `#8fa0bd`/`#9fb0cc`/`#aeb9cc`/`#c7d0e0`/`#cfe0ff`/`#8fb0e8`/`#c9d6ee`/`#d7e0ef`/`#e6edf8` (текст на тёмном) | |
| Оверлеи | `rgba(14,23,42,.14)` (дропдаун), `rgba(14,23,42,.5)`, `rgba(15,23,42,.55)`, `rgba(8,14,26,.45/.62/.86/.88)`, `rgba(5,10,20,.94)`, `rgba(4,8,16,.96)` | |
| Оверлей «туман» | `rgba(238,242,248,.26)` + `backdrop-filter:blur(.8px)` | 3662 |

Заполненные поля ввода (правило 23–24): фон `rgba(77,124,254,0.09)`, рамка `rgba(77,124,254,0.42)`; в фокусе — белый фон и рамка `#4d7cfe`. Placeholder `#aab1bd`.

### 6.3. Радиусы

Чипы/бейджи — pill `20px` (или `999px`, `18px`); кнопки — `9–11px`; поля — `10–11px`; плитки шахматки — `11px`; карточки — `13–16px`; крупные карточки/модалки — `18–22px` (дашборд `20px`, модалка квартиры `22px`); мелкие элементы — `6–8px`; аватар-квадраты `10–16px`; круги `50%`.

### 6.4. Тени

| Использование | Значение |
|---|---|
| Карточка дашборда | `0 1px 2px rgba(20,36,63,.04)` |
| Hover карточки объекта | `0 12px 30px rgba(20,36,63,.12)` + `translateY(-2px)` |
| Hover карточки виллы/юнита | `0 10px 26px rgba(20,36,63,.12)`, `0 8px 22px rgba(20,36,63,.1)` |
| Hover плитки шахматки | `0 8px 20px rgba(20,36,63,.16)`; в grid-режиме `0 6px 16px rgba(20,36,63,.3)` |
| Легенда (sticky) | `0 6px 24px rgba(20,36,63,.14)` |
| Дропдаун уведомлений | `0 26px 70px rgba(20,36,63,.24)` |
| Модалки авторизации/компаний | `0 30px 80px rgba(0,0,0,.4)` |
| Модалка квартиры / mk | `0 30px 90px rgba(0,0,0,.45)` |
| Bottom-sheet | `0 -12px 40px rgba(0,0,0,.25/.35)`, sheet `0 24px 64px rgba(8,14,26,.35)` |
| Лендинг скриншоты | `0 30px 70px rgba(20,36,63,.14)`, `0 16px 40px rgba(20,36,63,.1)` |
| LIVE-кнопка | `0 3px 10px rgba(229,72,77,.45)`, `0 4px 14px rgba(229,72,77,.5)` |
| Демо-виджет | `0 18px 44px rgba(20,36,63,.32)` |
| Активный язык | `0 1px 2px rgba(20,36,63,.12)` |

### 6.5. Анимации

`opl-bg` (fade-in .15–.2s) для оверлеев; `opl-card` (fade + translateY(12px) .25s) для карточек модалок; `oplPulse` (1.6s infinite box-shadow ring) для точки LIVE; переходы плиток `transform .15s, opacity .15s, box-shadow .15s`; ресайз плитки `width .15s`; прогресс мастера `width .3s`.

### 6.6. Размеры и брейкпоинты

| Элемент | Значение |
|---|---|
| Шапка приложения | min-height 62px; лендинг/публичные — 60px; полоса подвкладок — 50px sticky |
| Контейнеры | main 1500px; публичная страница 1280px; лендинг 1120px; форма лендинга 760px; уведомления 820px; чат 1100px; журнал 920px; IO-карточка 720px |
| Боковая навигация редактора | 212px sticky top 126px; мастер — 250px |
| Панель списка чата | 330px |
| Модалка квартиры | `min(1060px,96vw)` × `min(690px,92vh)`, инфо-колонка 430px |
| Иконка-кнопки шапки | 38×38 (мобайл 40×40), radius 11 |
| Плитка шахматки | 132×92, gap 7 (см. §4.1) |
| Единственный брейкпоинт | **760px**: `window.innerWidth<760` → `mobNav`, `isMobW`, `mobV` (мобильное меню, bottom-sheets, модалка-лист, горизонтальные навигации мастера/редактора, чат в один экран); CSS `@media(max-width:760px)` — main padding и одноколоночный дашборд |

### 6.7. Отличия от приложения риэлторов (`OnePlan Риэлторы.dc.html`)

Базовые токены **совпадают**: Inter, фон `#f7f8fb`, текст `#1b2942`, ink `#14243f`, синий `#4d7cfe`/`#3a63d4`, placeholder `#aab1bd`, анимации `opl-bg`/`opl-card`. Отличия:
- Риэлторский добавляет Leaflet (карты) и анимации `opl-spin`, `opl-fade`; у застройщика карты — заглушки-градиенты.
- Риэлторский использует брейкпоинты 760/820/900 и фиксированный topbar с `main{padding:76px 8px 110px}` на мобайле; у застройщика — один брейкпоинт 760 и `main{padding:10px 8px 56px}`.
- У застройщика есть правило подсветки заполненных полей (`rgba(77,124,254,.09)`), у риэлторского его нет.
- Документ `OnePlan Цвета.dc.html` предлагает альтернативные палитры (1a «холодный синий» — текущая; 1b «тёплый графит + песок» `#f6f4ef`/`#16324f`/`#c9a35c`) — в прототипе застройщика применена только 1a.

---

## 7. i18n

### 7.1. Структура

- `this.I18N = buildI18N()` (2277–2469) — три плоских объекта с вложенными группами. **RU: 2279–2341, EN: 2342–2404, TR: 2405–2467.** Доступ через `T()` (2686): `I18N[state.lang] || I18N.RU`; в шаблоне — `t.*`.
- Группы верхнего уровня: `rg` (регистрация), `ld` (лендинг), `lg` (правовые), `dash`, `stages`, `iskan`, `sales`, `occ`, `tags`, `purpose`, `status`, `cats`, `docstatus`, `roles`, `co` (компании/пользователи, ~120 ключей), `docsub`, `pb` (публикация), `pl` (приватность профайла), `wz` (мастер), `hub`, `ed` (редактор сетки), `mk` (создание планировок), `pub` (публичная), `edp` (редактор объекта), `dev` (страница застройщика), плюс плоские ключи (`login_*`, `nav_*`, `tab_*`, `log_*`, `obj_*`, `th_*`, `f_*`, `io_*`, `set_*`, `fs_*`, `pl_*`, `pt_*`, `prof_*`, `fld_*`, `m_*`, `badge_*`, `band_*`, `win_*`, `mega_*` и др.).
- `this.TEAMI18N` (2219–2223): RU 2220, EN 2221, TR 2222 — чат/уведомления/демо: `chat, notif*, day_*, nf{}, ago_*, chat_ph, you, online, dlv_*, tr_*, demo_*, dm_*, ev{}, st{}`. В шаблоне — `tt.*`.
- Язык переключается `langBtns` (3096) → `state.lang`; в `data-props` default RU.
- Локали дат: `fmtLogD` (3105) и `fmtUntil` (3221) — `ru-RU` / `en-GB` / `tr-TR`. Числа — всегда `ru-RU` (`Intl.NumberFormat`, пробел как разделитель тысяч).

### 7.2. Инлайновые тернарии и жёстко зашитые строки

| Строка | Что |
|---|---|
| 4244 | `widthCap`, `widthHint`, `bandCap`, `bandHint`, `bandOpts` — объекты `{RU,EN,TR}[s.lang]` (ширина плитки, ряд на этаже) |
| 3777 | `TT.notif_more || 'Показать ещё'` — ключа `notif_more` в `TEAMI18N` нет, используется fallback |
| 4022 | `L.opt_all || 'Все'` |
| 3940 | `legalFooter` — подписи на турецком без перевода («Üyelik Sözleşmesi», «Kullanım Koşulları», «KVKK», «Gizlilik», «Çerez») |
| 3446 | Имена «папок» мастера: `INFO`, `PHOTO · VIDEO`, `FLOOR PLANS · LAYOUTS`, `CATALOG · RUHSAT · PRICE LIST`, `TİCARİ · КОММЕРЦИЯ` |
| 716, 1460 | «VILLALAR — B·C·D·E·F BLOK» |
| 3564 | «TİCARİ — DÜKKANLAR» |
| 3540 | «Dükkan» (легаси mega) |
| 3484 | «REZERV» (палитра Diamond, не активна) |
| 195, 3110 | «Admin» — имя пользователя в шапке и журнале |
| 1113–1114 | «Иван Админов», `admin@oneplan.pro` в профайле |
| 1272 | «· Alanya» в шапке страницы застройщика |
| 3989 | Табы поэтажного плана «A Blok · Zemin», «B Blok · 1. Kat» |
| 3996 | «Kapıcı» |
| 4143 | Контакты застройщика |
| 2158 | `MEGA_INFO` значения («35 852 м²», «5 км», …) |
| 3418, 3735 | Названия документов «Yapı Ruhsatı», «İskan», «Tapu · Kat İrtifakı», «DASK» |
| 2157, 3397 | Тексты AI-перевода описаний (EN/TR/AR); `descLangs` включает `AR`, для которого нет i18n |
| 1852 | «PHOTO · VIDEO», 1864/1866 «FLOOR PLANS»/«LAYOUTS» в мастере |
| 666 и др. | «м²» в плитках всегда кириллицей |

### 7.3. Что нужно в боевой версии

Все ключи из `I18N`/`TEAMI18N` (RU/EN/TR) перенести в JSON-словарь; добавить недостающие ключи из таблицы 7.2; мультиязычные поля данных — описание объекта (`eDescs` RU/EN/TR/AR), названия документов, имена типов планировок не переводятся.

---

## 8. Внешние зависимости и ассеты

### 8.1. CDN и рантайм

| Ресурс | Версия / URL | Назначение |
|---|---|---|
| Google Fonts Inter | `fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800` | шрифт |
| Tabler Icons webfont | `cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css` | иконки `ti-*` |
| SheetJS | `cdn.jsdelivr.net/npm/xlsx@0.18.5/dist/xlsx.full.min.js` | экспорт/импорт xlsx (глобал `XLSX`) |
| `support.js`, `image-slot.js`, `android-frame.jsx`, `ios-frame.jsx` | локально | рантайм прототипа — игнорировать |
| `window.claude.complete` | среда прототипа | AI-перевод чата — заменить на серверный вызов LLM |
| Unsplash | `images.unsplash.com/{id}?w=…` | плейсхолдеры (`COVER`, `GAL`, дневник стройки `eProg.ph`, `ePhotos` по умолчанию) |

### 8.2. Папки ассетов и их привязка к демо-объектам

| Папка | Объект (id) | Использование |
|---|---|---|
| `megapolis-photos/` (30) | MEGAPOLIS RESIDENCE (8) | `cover` `web-front.jpg`; `photos` `web-front*.jpg`, `web-back-*.jpg`, `web-vaziyet*.jpg`; файлы `info.jpg`, `plot.png`, `front.png`; изображение в модалке квартиры `web-vaziyet.jpg` |
| `megapolis-data/` | 8 | `rows.json` — сетка (18 рядов, 199 ячеек, корпуса A/B, этажи 1–7 + GO/GI); также `board.json`, `cells.json`, `rows.js.txt` (не используются) |
| `megapolis-ticari/` | 8 | `MEGAPOLIS - PRICE LIST.pdf`, `LOCATION.png` (файлы объекта); `plans/dukkan-{1..12}.pdf` — планировки дюкканов в модалке |
| `uploads/FLOOR PLANS/*.pdf`, `uploads/LAYOUTS/A{num}.pdf` | 8 | планы этажей в файлах; PDF-планировка квартиры в модалке |
| `akropolis-photos/` (22) | AKROPOLIS RESIDENCE (10) | `cover` `web-ph-1.jpg`; `photos` `web-ph-*.jpg`, `web-zemin-1.jpg`; `info.jpg`, `plot.jpg`; `floor-a-zemin.png`, `floor-b-1.png` — реальный поэтажный план с зонами |
| `akropolis-data/` | 10 | `rows.json` (24 ряда, 250 ячеек, корпуса A/B/C), `price.pdf`, `ruhsat.pdf` |
| `diamond-photos/` (11) | YÜKSELEN DIAMOND (9) | `cover`/`photos` `IMG-20250611-WA00xx.jpg` |
| `diamond-plans/` | 9 | `sunum.pdf`, `price-list.jpeg`, `vaziyet.jpeg`, `kat-plani.jpeg`, `plan-1-1.jpeg`, `plan-2-1.jpeg` (планировки 1+1/2+1 в модалке) |
| `allure/` | ALLURE (13) | `web-f1..f5.jpg` (экстерьер), `web-i1..i3.jpg` (`#cat=interior`); подпапки `desc/`, `specs/`, `map/`, `floors/` — PDF/JPG файлы объекта |
| `richmond/` (78) | RICHMOND VILLAS (14) | `web-g1..g6.jpg`, `web-t{1..5}-{out,in,o2..o4,i2..i4,p1..p4}.jpg` — по типу виллы; `price-*.pdf`, `desc-*.pdf`, `location.png`, `land.jpg` |
| `avocado-photos/` (17) | AVOCADO VILLAGE (12) | `web-v5556-*.jpg`, `web-v63-*.jpg`, `web-v72-1.jpg`, `web-infra-fitness.jpg`; `web-plan.jpg` — план посёлка для маркеров |
| `avocado-data/` | 12 | `price.pdf`, `desc-63/72/74.pdf` (PDF в модалке виллы), `villa-63.pdf` |
| `landing-shots/` (5) | лендинг | `objects.png`, `board.png`, `profile.png`, `public-hero.png`, `companies.png` |
| `uploads/` (291) | исходники клиента | папки Google Drive, из которых собраны демо-данные (FLOOR PLANS, LAYOUTS, TİCARİ, Richmond Villas Type 1–5, ALLURE и т.д.) |
| `screenshots/`, `handoff/`, `design_handoff_landing/`, `export/` | служебные | не используются приложением |

Для боевой версии все пути заменяются на объекты в Supabase Storage (bucket на компанию/объект) с метаданными: категория (`cat`), тип (image/video/pdf), порядок, обложка.

---

## 9. Расхождения с ТЗ и открытые вопросы

### 9.1. Функциональные расхождения

| # | Тема | В ТЗ | В прототипе |
|---|---|---|---|
| 1 | Права менеджера (§2) | только просмотр | редактирование не блокируется (модалка квартиры сохраняет, настройки доступны); скрыта лишь кнопка «Добавить объект» + баннер |
| 2 | Срок доступа компании (§2) | по истечении доступ закрывается | только бейдж «Доступ истёк» |
| 3 | Дашборд (§14) | KPI всего/свободно/продано/сумма проданных, график продаж по месяцам | 3 KPI (свободных в продаже, средняя цена юнита, средняя цена м²), графика нет; ключи i18n `dash.sales*`, `k_sold`, `k_soldval` не используются |
| 4 | Уведомления (§13) | клик ведёт к объекту | клик только помечает прочитанным |
| 5 | Чат (§12) | командный чат, разделители дат «Сегодня · 21 июля», DeepSeek/GPT | только личные диалоги, разделителей дат нет, перевод через `window.claude.complete` |
| 6 | Журнал (§11) | кто и когда | пользователь всегда «Admin»; импорт и изменения объекта не логируются |
| 7 | Цвета и особенности «на объект» (§8, §5) | per-object | `state.colors`/`state.features` глобальные для всех объектов |
| 8 | Описание/локация/дневник/документы | per-object | `eDescs`, `eLng/eLat`, `eProg`, `eDocs` не сохраняются в `PROJECTS` — одни на все объекты |
| 9 | Поэтажный план (§3) | загрузка планов + обводка | реальный план только для Akropolis с координатами в коде; для остальных — SVG-генератор с фиксированными этажами 0–7 и статичным «Дом 2» |
| 10 | Мастер «Новый объект» | создаёт объект | `createObject` только закрывает мастер; поля названия/адреса/стадии не привязаны |
| 11 | Страница застройщика (§3) | контакты компании | контакты жёстко зашиты, не берутся из `cp_*` реквизитов |
| 12 | Экспорт (§11) | «Этаж» | заголовок 3-й колонки — `scheme_floor` («Поэтажный план») |
| 13 | Выравнивание (§6) | кнопки у всех корпусов в edit-режиме | реализовано (`bl.alignBtns`); глобальные `alignBtns` отключены (`canAlign:false`) |
| 14 | Виллы | план посёлка на объект | `villaPlanImg` жёстко `avocado-photos/web-plan.jpg`, маркеры `px/py` в данных юнита |
| 15 | Смешанные объекты | — | заголовок «VILLALAR — B·C·D·E·F BLOK» жёстко |
| 16 | Удаление объекта | — | без подтверждения |
| 17 | Профайл | данные пользователя, реквизиты, пароль | поля не привязаны к состоянию, «Сохранить пароль» без обработчика |
| 18 | Регистрация | фиксация согласий | IP генерируется псевдослучайно, MERSİS не привязан |
| 19 | Вход | — | без проверки; «Забыли пароль?» без обработчика |
| 20 | Публичная модалка | заявка/WhatsApp | кнопки без обработчиков |
| 21 | Выдача ключей (`occSt`) и режим публикации closed/public + EİDS | нет в ТЗ | есть в прототипе — включить в модель |
| 22 | Завершённые объекты | скрываются «по любой причине» | `stage==='done'` автоматически = скрыт (даже без флага `hidden`), кнопка «Вернуть в активные» не снимает `done` |
| 23 | Компания ↔ объект | — | связь по строке `client` (имя компании), а не по `objIds`; `COMPANIES.objIds` используется только в карточке компании и форме пользователя |
| 24 | Роль «admin» | своя компания | `adminCoId=1` жёстко |
| 25 | Пользователь «Доступ до» | есть в форме (`ufUntil`) | поле не выведено в разметке |

### 9.2. Технические артефакты прототипа

- Дублирующее присваивание `this.LEGALCO`/`this.LEGAL` внутри `createCompany` (3336–3337) — копипаст, удалить.
- `subtabsView` и `schemeView` вычисляются дважды (3101/4145, 3200/4146); последнее побеждает.
- `isSchemeBoard`/`showFilters` переопределяются в конце (4147).
- `onFStage/onFIskan/onFSales` (4205) не используются — фильтры работают через sheet.
- Мёртвый код — см. §4.11.
- `openUnit(u.num)` в легаси-`board` (3139) передаёт номер вместо `uid`.
- `isSold`-ветка плитки (666, 692) рисует упрощённую плитку, но `cellV` заполняет `badgesList` и для проданных.

### 9.3. Открытые вопросы для реализации

1. Модель доступа: хранить роль в `users.role` и `company_members` (many-to-many для editor/client с `access: all | object_ids[]`, `until`, `platform`), супер-админ — флаг на пользователе.
2. Единица хранения шахматки: таблица `units` с полями §3.2 + `object_id`; порядок/позиция (`floor, pos, band, wing, w`) — нормализованы (без `lx/lw`).
3. Типы планировок — таблица `unit_types` (`object_id, rooms, area, name, manual, images[]`) + `units.type_id`; автопривязка по `(rooms, area)` на сервере.
4. Журнал — `unit_changes` (`unit_id, field, from, to, user_id, ts`) с записью при любых мутациях (модалка, импорт, drag).
5. Уведомления — генерация из журнала/событий (`notifications` + `notification_reads`), видимость по компаниям.
6. Публичные страницы — `/p/[slug]` с проверкой `pub_hidden`, `hidden`, `stage`, `company.active`; страница застройщика `/d/[slug]` с реквизитами компании.
7. Чат — таблицы `conversations`, `messages` (`lang`, `status`), Realtime (Supabase) для доставки/прочтения, серверная функция перевода с кэшем `translations(text_hash, lang)`.
8. Медиа — Supabase Storage; категории и порядок — в таблице `media` (`object_id, kind, category, order, is_cover`).
9. Валюта — хранить цены в валюте объекта; курсы (EUR 1 / USD 1.09 / TRY 35) — вынести в настройки.
10. Автосохранение — debounce 700 мс с индикатором как в `epSave`.
