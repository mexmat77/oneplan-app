# Спецификация прототипа «OnePlan Риэлторы» (для пересборки на Next.js + Supabase)

Источник: `One-Plan приложение/OnePlan Риэлторы.dc.html` (≈630 КБ, 4326 строк).
Все номера строк ниже — из этого файла.

## 0. Общая структура файла

| Диапазон строк | Содержимое |
|---|---|
| 1–16 | `<head>`, подключение `support.js` (рантайм прототипа), Google Fonts Inter, Tabler Icons, Leaflet CSS/JS, `image-slot.js` |
| 17–66 | `<style>` №1: reset, keyframes, десктопные/мобильные `@media`, стили пинов карты (`.opl-pin`), Leaflet-фиксы |
| 67–122 | `<style>` №2: мобильные правила (≤760px) для sheet-модалок, чата, новостроек, таблицы квартир |
| 124–142 | Экран входа (`isLogin`) |
| 144–178 | Модалка «Заявка на доступ» (`regOpen`) |
| 180–1917 | Приложение (`isApp`): топбар, меню, все экраны и модалки |
| 1919–2102 | Клиентский вид подборки (`isClient`) |
| 2104–2121 | Лайтбокс галереи объекта (`lbOpen`) |
| 2123–2175 | Гео-пикер İl/İlçe/Semt (`geoOpen`) |
| 2177–2179 | Toast |
| 2181 | `<script type="text/x-dc" data-props=…>` — props компонента: `skipLogin:boolean=false`, `demoRole:'realtor'|'admin'='realtor'` (секция «Демо»); в коде ещё читается `showCommission` (по умолчанию `true`) |
| 2182–2494 | `class Component extends DCLogic`, `constructor` — все мок-коллекции (`this.R`, `this.OBJ`, `this.GEO`, `this.FEATS`, `this.PORTALS`, `this.DLG`, `this.T`, `this.NTFDATA` …) |
| 2495–2526 | `state = {…}` — весь UI-state (≈330 полей) |
| 2527–2586 | утилиты: `showToast`, `_fTop`, `_numKb`, `_chatBottom`, `_vvFix`, `componentDidMount/Update/WillUnmount` |
| 2587–2940 | карты Leaflet: `_syncObjMap` (объект), `_syncNbCatMap` (каталог новостроек), `_syncNbMap` (проект), `_setAddPin`/`_syncAddMap`/`_flyAddArea` (форма добавления), `_osmRings`, `_syncMap` (каталог, хороплет) |
| 2941–2980 | `_detail(mo,t,fmt)` — сборка «ключевых параметров» и таблицы параметров объекта |
| 2981–4322 | `renderVals()` — все вычисляемые значения и обработчики, которые биндятся в разметку |

Шаблонный язык: `<sc-if value="{{ expr }}">`, `<sc-for list="{{ arr }}" as="x">`, `{{ expr }}`, `onClick="{{ handler }}"`, `style-hover="…"`. `renderVals()` возвращает один плоский объект, ключи которого доступны в шаблоне.

Ключи браузерного хранилища: `localStorage['opl-add-autosave']` (автосейв формы объекта, строки 2579, 2581), `sessionStorage['opl-hint-closed']` (подсказка в каталоге, 3756–3757).

---

## 1. Экраны

Переключение: `state.screen` ∈ `catalog | mine | favs | obj | add | newb | sels | reqs | chat | ntf | rls | profile | billing | api`. Плюс три «надэкранных» состояния: `isLogin` (= `!logged && !clientView`), `isApp` (= `logged && !clientView`), `isClient` (= `!!clientView`). Навигация: `go(sc)` (строка 2998) — сбрасывает `ntfOpen`, для `catalog` ещё `rOwner:''`, `visN:9`; для `newb` — `nbDev:'', nbObj:''`. `prevScreen` хранит, откуда открыли объект (для кнопки «Назад»).

### 1.1 Вход (`isLogin`, строки 124–142)

| Что | Детали |
|---|---|
| Назначение | Вход в закрытую базу. Демо-логин предзаполнен: `loginEmail:'realtor@one-plan.pro'`, `loginPass:'Realtor1@plan'` |
| Элементы | логотип SVG, бейдж `t.common.badge`, `h1 t.login.title`, email/пароль, ссылка «Забыли пароль?» (`fpwOpenB`), кнопка «Войти» (`doLogin` → `logged:true`), блок «Доступ по приглашению» (`t.login.invite`), кнопка «Подать заявку на доступ» (`regOpenB`), переключатель языка `langBtns` |
| Модалка «Заявка на доступ» (`regOpen`, 144–178) | поля `regName*`, `regPhone*` (маска `trPhone` → `+90 5xx xxx xx xx`), `regMail*`, агентство: чип «Свободный агент» (`regFreePick`) или текст `regAgTxt`; honeypot `regHp` (скрытый input); капча «A + B = ?» (`regCapA`,`regCapB`,`regCapV`); `regSubmit` (4226–4235): валидация полей, email regex, телефон ≥10 цифр, `dupCheck` по почте/телефону среди `this.R`, honeypot → тихий «успех», капча, rate-limit 60 с (`this._lastReg`). Успех → `regDone` экран «Заявка отправлена» |
| Модалка «Восстановление пароля» (`fpwOpen`, 1896–1917) | `fpwMail` → `fpwSend` (валидация email) → `fpwDone` («Письмо отправлено», ссылка действует 24 ч по тексту) |
| 2FA | Отдельного экрана нет. 2FA — тумблер в профиле (`tfaOn`), показывает ключ `OPLN-7K2M-Q9X4-TR8B` и ссылки на Google Authenticator (1510–1525) |

### 1.2 Каркас приложения (`isApp`, 180–221, 1536–1548, 1885–1893, 2177)

| Элемент | Строки | Детали |
|---|---|---|
| Топбар `[data-topbar]` | 181–195 | sticky, `min-height:62px`, z-index 100. Логотип → `goCatalog`; пункты `data-nav-item`: База объектов, Мои объекты, Избранное (+бейдж `favsN` = favs + nbFavU + nbWatch), Подборки, Поиски (+бейдж `reqsNewN`), Риэлторы (только `isAdmin`); справа: кнопка чата (точка `chatUnread` = диалог `d3` не прочитан), колокольчик (`ntfCount`), `data-lang-sw` RU/EN/TR, аватар+имя → `goProfile`, кебаб `data-kebab` (только мобайл) |
| Скрытие топбара | 2545–2556 | на мобайле прячется при скролле вниз (`hdrHide`), на десктопе — когда фильтр-бар `[data-fsticky]` прилипает (`data-stuck`) |
| Кебаб-меню `kebabOpen` | 197–207 | строки `kebabRows` (3753): catalog, mine, favs (n), sels, reqs (n), api, billing, + rls для админа; переключатель языка `langBtnsK` |
| Дропдаун уведомлений `ntfOpen` | 209–221 | заголовок + «Прочитать все» (`ntfMarkAll`), 4 верхних (`ntfTop`), «Показать все» → `goNtf` |
| Панель выбранного (`selbarShow`) | 1536–1548 | видна на catalog/mine/favs при `sel.length>0 && !createOpen`: счётчик, до 4 миниатюр + «+N», «Очистить»/«Отменить изменения» (`clearSel`), кнопка «Просмотр» (`openCreate`) |
| Демо-переключатель роли `[data-demo]` | 1885–1893 | плавающая кнопка-колба, `roleBtns`: Риэлтор / Админ (`role`) |
| Toast | 2177–2179, `showToast` 2527 | текст `toast`, авто-скрытие 2400 мс |
| Блокировка скролла body | 2582–2585 | при любой открытой модалке (`lock` — список условий в 2583) |
| Клавиатура | 2559–2578 | Esc закрывает модалки/лайтбоксы; ←/→ листают галереи (obj, lightbox, nb, client) |

### 1.3 Каталог / Мои объекты / Избранное (`isGrid`, 223–446)

Один экран для трёх `screen`: `catalog`, `mine`, `favs` (`gridLabel`, `gridTitle`, `gridSub`, `gridCount`).

| Блок | Строки | Детали |
|---|---|---|
| Под-табы | 243 | `catSwShow` (только catalog без `rOwner`): «Вторичка» (текущий) / «Новостройки» → `goNewb` |
| Профиль риэлтора (`rOwnerShow`) | 225–241 | при `rOwner` (открыт из карточки объекта `openOwnerPage`): кнопка «Ко всей базе» (`rBack`), карточка `rProf` (инициалы, имя, агентство · город · языки, число объектов, телефон, WhatsApp, «Написать в чате» `rChat`) |
| Кнопка «Добавить объект» | 244 | только `isMine` → `goAdd` |
| Подсказка (`hintShow`) | 248–250 | `t.cat.hint` про папку; закрытие пишет `sessionStorage` |
| Фильтр-бар `[data-fbar]` | 251–262 | `fbarShow` (catalog, mine). Слева направо: «Ещё» (`fpMoreOpen`, бейдж `fbMoreN`=число расширенных фильтров `extN`), гео `data-fgeo` (`openGeo`, `geoLabel`), пиллы `fBtns` (deal, type, price, rooms — rooms скрывается для land), `fBtnsExt` (furn; скрыт ≤979px), мобильная кнопка «Ещё», сортировка (`fpSortOpen`), переключатель список/карта `data-viewsw` (десктоп) и FAB `data-view-fab` (мобайл) |
| Панель фильтра `fPanel` | 264–336 | значения: `deal`,`type`,`furn`,`sort` — радио-строки `fpRows` со счётчиками; `rooms` — чипы (`fpRoomsAll` разворачивает `ROOMS_ALL` из 39 вариантов); `price` — два инпута ₺; `area` — брутто/нетто; `feat` — чипы `FEATS`; `more` — большая модалка (`fpPanelStyle` fixed, `min(96vw,980px)`) со всеми группами: гео, цена, сделка, тип, площадь (брутто/нетто/участок при доме), мебель, быстрые фильтры (`mQuickChips`: ВНЖ, Гражданство, Лифт, Газ, Цена снижена, Балкон, В комплексе, Кредит, Обмен), этаж (+«не первый/не последний»), этажность, возраст, санузлы, отопление, имар/тапу (land), тип коммерции + флаги (comm), «кто в квартире/доме», айдат, до моря, депозит (rent), комнаты, особенности. Футер: «Сбросить» (`fpReset`) и «Показать N» (`fpShowL`) |
| Чипы активных фильтров | 338–345 | `filterChips` (3255–3290) с крестиком-удалением, «Сбросить всё» (`resetAll`) |
| Черновики (`draftShow`) | 346–363 | только `mine` с `drafts`: карточка с фото/заглушкой, «Черновик», «Продолжить» (`dr.resume`), удалить |
| Счётчик + «Сохранить поиск» | 364 | `gridCount` («N объектов · M риэлторов»), `saveSearch` (только catalog без rOwner) → модалка `ssOpen` |
| Карта (`isMapView`) | 367–382 | `#opl-map`, хлебные крошки `mapCrumb` («Türkiye › Antalya › …»), «Уровень выше» (`mapUp`), легенда медианной цены (`mapLegendShow/Min/Max`), подсказка `t.cat.mapHint` |
| Список (`isListView`) | 383–412 | грид `repeat(auto-fill,minmax(340px,1fr))`, карточки `gridView` (`mkCard`, 3007–3025): фото 210px, бейдж (статус перекрывает метку), сердечко `toggleFav`, папка `toggleSel`, «В подборке», заголовок, цена + старая цена + снижение, `eq` (≈ € · $), чипы ВНЖ/Гражданство, комнаты/площадь/этаж/локация, владелец (аватар+имя) или «Мой объект», на `mine` — кнопка экспорта в порталы `o.openExp` (`expN` «k/5»). Инфинити-скролл: `[data-grid-sentinel]` → `visN += 9` через 350 мс (2557). Пусто → `gridEmptyText` |
| Избранное: комплексы (`favCplxShow`) | 413–428 | `favCplx` — новостройки из `nbWatch` («слежу»): картинка, название, статус продаж, цена «от», удалить |
| Избранное: квартиры новостроек (`favUnitsShow`) | 429–444 | `favUnits` из `nbFavU` (ключ `projectKey#unitNo`): тип · №, комплекс, брутто/нетто, цена, статус |

Используемый state: `fCity,fMin,fMax,fRooms,sort,favs,fPanel,fpLeft,fDeal,fType,fABMin/Max,fANMin/Max,fFurn,fFeats,fpRoomsAll,fFlrMin/Max,fNotFirst,fNotLast,fBFMin/Max,fAge,fBath,fHeat,fBalc,fDrop,fVnj,fCit,fLift,fGas,fAidat,fSea,fDep,fImar,fTapu,fCommT,fKiraci,fDevir,fUsage,fSite,fCephe,fCredit,fTakas,fGarMin/Max,fIl,fIlces,fSemts,view,visN,rOwner,sel,hint,drafts,stOver,expMap,extraMine,nbWatch,nbFavU`.

### 1.4 Страница объекта (`screen:'obj'`, `isObjPage`, 1550–1721)

| Блок | Строки | Детали |
|---|---|---|
| Шапка | 1552–1555 | «Назад» (`closeObj` → `prevScreen`), «Пожаловаться» (`mObj.canReport` = не мой) → `rptOpenB` |
| Галерея `[data-gal]` | 1558–1578 | главное фото со свайпом (`galTS/TM/TE`), стрелки, счётчик, сердечко; 2 боковых (`galSide1/2`, `+N`), полоса миниатюр `galThumbs`; клик → лайтбокс `lbOpen` (десктоп) или вертикальный стек `mgOpen` (мобайл, 1579–1589) |
| Мобильный бар `[data-obj-bar]` | 1590–1601 | аватар владельца, цена, `eq · владелец`, телефон, WhatsApp, «…+5» → шторка контактов `contactsOpen` (1602–1614: Позвонить, WhatsApp, Telegram, Viber, MAX, WeChat, Написать в чате) |
| Заголовок | 1615–1619 | `h1`, чипы ВНЖ/Гражданство, статус `stLabel`, адрес `geoAddr` («Antalya, район Konyaaltı, махалле Hurma»), `metaDates` («№ объявления OP-O3 · Создано … · Обновлено …») |
| Ключевые параметры | 1620–1630 | плитки `mObj.tiles` (комнаты, брутто/нетто, год постройки, ванных; для land: площадь, до моря) + `paramRows` из `_detail` (этаж/этажность, возраст, санузлы, отопление, тапу, тип коммерции/арендатор/девир, участок при доме, кто в квартире, в комплексе, кредит/обмен, балкон, мебель, айдат, до моря, депозит; для land: имар, emsal, ада/парсель, тапу, до моря, кредит/обмен) |
| «В объекте» / «Инфраструктура» | 1631–1644 | `featsL` (shut, terr, sea, depot + балкон) / `infraL` (остальные `feats`) |
| Описание | 1645–1649 | `desc[lang]`, если `mo.base !== lang` — пометка «Описание переведено ИИ, оригинал: XX» |
| История цены (`hasPh`) | 1650–1659 | `phRows`: дата, цена, дельта (зелёная при снижении) + строка «Сейчас» |
| Карта | 1660–1663 | `#obj-map` (Leaflet, пин с ценой) |
| Правая колонка `[data-obj-side]` | 1665–1676 | цена/старая цена/снижение, `eq`, «по курсу ЦБ на <дата>», тип/сделка/статус, большая кнопка «Добавить в подборку / В подборке — убрать» |
| Управление (`canEdit` = мой или admin) | 1677–1685 | пометка админ-режима `adminEdit`, кнопки статуса `stBtns` (active/reserved/sold/off → `stOver[id]`), «Редактировать» (`editMe` → экран add с `aEditId`), «Экспорт в порталы» (`openExport`, бейдж `expActiveLabel` «n/3») |
| Риэлтор объекта (`showOwner`) | 1686–1704 | карточка владельца → `openOwnerPage`, телефон, каналы (Звонок, WhatsApp, Telegram, Viber, MAX, WeChat, Чат → `chatWith`) |
| Похожие | 1705–1717 | `similarRows`: до 3 активных того же deal и (тот же ilçe или те же комнаты) |
| Модалка жалобы `rptOpen` | 1854–1864 | причины `rptReasons` (stale/sold/price/dup/other), комментарий, «Отправить» (`rptSend` → push в `reports` со `st:'new'`) |
| Модалка экспорта `expOpen` | 1767–1789 | `portalRows` по `PORTALS`: тумблер (только `op`/`akd` «Работает», остальные «Скоро» → toast), блок «Ваш сайт · API» → `goApi`, примечание «Демо: подключение настраивает администратор» |

### 1.5 Добавление/редактирование объекта (`screen:'add'`, `isAdd`, 448–629)

Секции формы (все поля в state с префиксом `a*`, автосейв в localStorage с дебаунсом 800 мс, 2581):

| Секция | Строки | Поля / обработчики |
|---|---|---|
| Основное | 455–460 | `aDeal` (sale/rent/daily), `aType` (flat/house/comm/land) |
| Расположение | 462–472 | гео-пикер в режиме add (`openGeoAdd`, `addGeoLabel`), `aLink` + «Найти» (`doGeoFind`: парсит координаты из ссылки Google/Yandex, меняет местами lat/lng при `ll=` и вне диапазона 35–43), `#add-map` (клик/перетаскивание пина → `_setAddPin` → Nominatim reverse → `aAddr`, `aIl`, `aIlce`, `aSemt`; новые İl/İlçe/Semt добавляются в `GEO` с ключом `z…`) |
| Параметры | 474–536 | комнаты `aRoomBtns` (+ «Все варианты» `aRoomsAll`), площадь брутто*/участка* (`aArea`), нетто* (`aNet`), участок при доме (`aGarden`, house), этаж* (`aFloor`, flat/comm), этажность (`aFloors`), год постройки* (`aAge` — хранится год; при публикации → возраст), emsal/ада-парсель (land), до моря `aSeaBtns` (300/1000/3000/5000/9000), айдат (flat), депозит* (rent, `aDepM`), отопление `aHeat[]` (мультивыбор, `none` эксклюзивен) + санузлы `aBath` (1/2/3+), мебель* `aFurn`, флаги `aFlagBtns` (балкон, лифт, газ, в комплексе; при sale: ВНЖ, гражданство, кредит, обмен, в собственности 5+ лет), метка `aBadge` ('', new, hot, exc), «кто в квартире/доме» `aUsageA` (flat/house при sale), тип коммерции `aCommTA` + `aKiraciY`/`aDevirY`, имар `aImar` + тапу `aTapuA` (land), особенности `aFeats` |
| Дубликаты (`dupShow`) | 517–536 | `dupList` (3292–3298): объекты того же `ilce` и `rooms` с ценой в €±12% — до 3, «Открыть». При публикации первый раз — предупреждение `dupAsk`, второй клик публикует (`aDupOk`) |
| Фотографии | 538–559 | drop-zone / `#ph-input` (image/*, до 20, FileReader → dataURL в `aPhotos`), карточки с drag&drop-перестановкой (`ds/dov/dp`), первая — «Обложка», удаление |
| Цена, название, описание | 560–581 | `aPrice` (маска с пробелами, `aPriceEq` «≈ € · $» по курсам 48 / 43.2), `aCur` ₺/€/$ (кнопки объявлены `aCurBtns`, но в разметке не найдены), название* + «Сгенерировать» (`aGenTitle`: комнаты/тип, махалле, м², «N м до моря»), описание + «Перевести ИИ» (`doTranslate` → `aTr`, карточки `aTrCards` — демо, берётся `DESCS[1]`), комиссия `aComm` (bind объявлен; поле в разметке отсутствует) |
| Предпросмотр | 582–606 | `[data-aprev]` fixed справа при ≥1500px, иначе FAB `[data-aprev-fab]` + оверлей `aPrevOpen`; показывает обложку, метку, заголовок, цену, чипы, мету |
| Результат публикации (`pubShow`) | 607–620 | «Объект опубликован»: «Открыть страницу» (`pubView`), «Добавить в подборку» (`pubSel`), «К моим объектам» (`pubMine`) |
| Прогресс + кнопки | 621–626 | прогресс обязательных (`aReqPairs`: title, price, area, LL, + net/age (не land), floor (flat), depM (rent)), «Сохранить черновик» (`doDraft` → `drafts[]`, экран mine), «Опубликовать» (`doPublish`, 3630–3672), «Отмена» |

`doPublish`: проверка обязательных (`aMiss` подсвечивает поля красным), проверка дублей, сборка объекта `o` (id `x<ts>`, owner `me`, `created/updated` сегодня, все поля из формы, `ll` из `aLL`, `base: lang`, `photos` или заглушка `NOPH`), при `aEditId` — `Object.assign` в существующий объект, иначе push в `extraMine`.

### 1.6 Новостройки (`screen:'newb'`, `isNewb`, 961–1334)

| Блок | Строки | Детали |
|---|---|---|
| Под-табы | 963 | «Вторичка» → `goCatalog` / «Новостройки» |
| Страница застройщика (`nbDevPage`) | 965–971 | при `nbDev`: «Все новостройки» (`nbDevBack`), иконка, название, «Застройщик · N проектов» |
| Фильтр-бар | 977–991 | «Ещё» (`nbMoreOpen`, бейдж `nbMoreN`), гео (общий `openGeo`, использует `fIl/fIlces/fSemts` — сопоставление по подстроке в `p.geo`), пиллы `nbFBtns` (type, rooms, price, area), поиск `newbQ` (десктоп), список/карта `nbVM` |
| Панель `nbPanel` | 993–1033 | rooms (чипы 1+0…4+2), area (м²), price (млн ₺: значения <1000 умножаются на 1e6), type (flat/house/comm), more (гео, поиск, цена, тип, комнаты, площадь, срок сдачи `nbDlv` 2026/2027, быстрые: «Рассрочка» `nbInst`, «Продажи открыты» `nbSalesF`, особенности `nbFeats`) |
| Чипы фильтров | 1035–1042 | `nbFilterChips`, `nbReset` |
| Карта / список | 1043–1076 | `#nbcat-map` (пины «от X ₺» → открыть проект) / карточки `newbRows`: фото, «Срок сдачи», бейдж продаж `salesL`, «Рассрочка», название, гео, планировки (`plans`: тип · от м² · от цена), застройщик → `devGo` |
| Примечание | 1077 | `t.newb.soon`: «Данные синхронизируются с OnePlan V2 (новостройки)» |
| Страница проекта (`nbPage`, `nbo`) | 1079–1233 | «Назад» (`nbo.back`), чипы категорий фото `catChips` (all/ext/int/soc/pool/spa/kids/park), галерея (свайп, стрелки, счётчик, кнопка «слежу» `watchClick` → `nbWatch` + toast), `h1` + бейдж продаж, гео · застройщик, карточка параметров `paramRows` (срок сдачи, выдача ключей, квартир, этажей/блоков, рассрочка), «Планировки и цены» (`plans` + eq), «Списком» — шахматка: чипы статусов `unitStChips` (Всего/free/hold/proc/sold/res с числами), чипы комнат `unitRmChips`, таблица `unitRows` (№, блок, этаж, тип+тег Терраса/Дуплекс/Вилла, брутто, нетто, цена, статус) + «Показать ещё» по 20 (`nbUN`), «Инфраструктура комплекса» (`feats`), «О комплексе» (`descr`), «Локация» `#nb-map`, «Дневник стройки» (`diary`), «Документы» (`docs` → toast «⬇ имя»). Правая колонка `[data-nb-side]`: «от <цена>», eq, курс, статус продаж, срок сдачи, выдача ключей, квартир, «Запросить условия» (`reqB` → чат поддержки), карточка застройщика (`devGo`, телефон, Звонок/WhatsApp/Telegram/Чат) |
| Лайтбокс `nbo.lbOpen` / моб. стек `nbo.mgOpen` | 1234–1242, 1321–1331 | навигация `lbPrev/lbNext/lbClose` |
| Моб. бар + контакты застройщика | 1243–1267 | `nbo.ctsOpen` (аналог контактов объекта) |
| Шторка квартиры `nbo.uo` (`nbUnit`) | 1268–1320 | `[data-unit-sheet]`: тип · №, тег, статус, комплекс, фото/план/3D-план (`uStrip`, свайп, `uTap`), цена + eq, строки (блок, этаж, брутто, нетто, срок сдачи, рассрочка), «В избранное» (`fav` → `nbFavU`), «Запросить условия» (`req` → чат поддержки); мобильный стек `uMgOpen` |

State: `newbQ,nbObj,nbCat,nbLb,nbMg,nbView,nbInst,nbSalesF,nbRooms,nbMin,nbMax,nbGal,nbPanel,nbPLeft,nbType,nbABMin/Max,nbFeats,nbDlv,nbVM,nbUSt,nbURm,nbUN,nbUnit,nbUIdx,nbUMg,nbFavU,nbWatch,nbDev,nbCts`.

### 1.7 Подборки (`screen:'sels'`, `isSels`, 631–666; модалка создания 1723–1765)

| Блок | Детали |
|---|---|
| Шапка | `h1`, «Новая подборка» (`startNewSel` → каталог + toast-подсказка) |
| Статистика `selStats` | Всего подборок, Отправлены (status≠draft), Просмотрены (status=viewed), Понравилось объектов (Σ liked) |
| Карточки `selCards` (3463–3476) | инициалы клиента, название, «Для: имя · дата», статус (draft/sent/viewed), 4 миниатюры + «+N», «N объектов», просмотры, лайки; действия: «Открыть» (`openClient` → clientView), «Ссылка» (`copyLink` → clipboard `https://one-plan.pro/s/<ID>7F`, 1.5 с «Скопировано»), «Изменить» (`edit` → sel=items, поля c*, каталог, `editingSel`), «Удалить» |
| Модалка `createOpen` | заголовок «Новая подборка»/«Редактирование», «Объектов выбрано: N»; форма: название `cTitle`, имя клиента `cName`, сообщение `cNote`, список `cObjs` (фото, название, `rooms · цена`, удалить, чипы-шаблоны комментариев `t.sel.chips`, инпут комментария `cCm[id]`); кнопки «Отмена» (`cancelSel`), «Превью» (при редактировании, `createViewClient`), «Создать и получить ссылку»/«Сохранить» (`doCreateSel`, 3488–3496). Готово (`createDoneShow`): ссылка `createdUrl` (`https://one-plan.pro/s/` + последние 6 символов id в верхнем регистре), «Копировать», WhatsApp/Telegram (без обработчиков), «Открыть как клиент» |

### 1.8 Поиски (`screen:'reqs'`, `isReqs`, 668–768)

Табы `reqTab`: `mine` («Мои поиски») / `feed` («Запросы базы», бейдж `reqFeedN`).

**Мои поиски** (676–697): `reqRows` из `savedSearches` — иконка, название (инлайн-редактирование `startEdit/saveEdit`), «+N новых» (`newN`), параметры `fmtParams`, «N совпад.» (`matchOf`), «Опубликовать запрос / Запрос в базе» (`togglePub` → `pubReqs`), «Показать в базе» (`open` → каталог с фильтрами из params, обнуляет newN), удалить. Пагинация по 8 (`pgr('req')`). Примечания `t.reqs.note`, `t.reqs.newAlg`.

**Запросы базы** (698–732): переключатель «Мои районы (регионы из профиля `pAreas`) / Все запросы» (`reqArea`), «Новый запрос» (`nrOpenB`). Строки `bReqRows` (3347–3358) = опубликованные мои поиски (`myPubReqs`, `ps:true`) + `BREQS`: инициалы/имя/агентство автора, «осталось N дн.», «Ваш запрос» или «у вас подходящих: N» (`bMatch` — мои объекты того же type и deal), параметры, комментарий; действия: мой — «Снять с публикации» (`unpub`); чужой — «Предложить объект» (`offer` → шторка `offerOpen`) или «Объект отправлен в чат · Имя» (`reqSent`), «Написать в чате» (`chat` → диалог автора). Пагинация по 2. Примечание `t.reqs.feedNote`.

**Шторка «Какой объект предложить?»** (734–748): `offerRows` — мои подходящие; `pick` → в диалог автора добавляется сообщение с `objId` (карточка объекта в чате), `reqSent[reqId]=objId`, переход в чат.

**Шторка «Новый запрос»** (749–767): `nrDeal` (sale/rent), `nrType`, комнаты `nrRooms[]` (1+1…6+1), бюджет `nrMax`, «Где» (гео-пикер в режиме `req` → `nrIl/nrIlce/nrSemt`), особенности `nrFeats` (зависят от типа: furn/pool/seaview/first; land: imar/seaview/first; comm: kiraci/seaview/first), комментарий; `nrPublish` → `BREQS.unshift({... by:'me', days:30})`.

### 1.9 Чат (`screen:'chat'`, `isChat`, 770–817)

`.opl-chat-shell` (две колонки; на мобайле — список или окно, класс `open` = `chatMobOpen`). Список `dlgList` (поиск `chatQ` по имени/агентству; сортировка: поддержка первой, затем по `ts`/времени последнего сообщения): аватар/иконка гарнитуры для поддержки, онлайн-точка, имя, последнее сообщение с галочками (`ti-checks`, цвет: доставлено `#aab1bd` / прочитано `#4d7cfe`), время, бейдж непрочитанных (мок: только `d3`). Окно: «Назад» (моб.), собеседник + статус «в сети / был(а) недавно», WhatsApp, тумблер ИИ-перевода `chatTr`; сообщения `msgs` (карточка объекта при `objId` → `openObj`, автор `by` для поддержки, текст, пометка перевода «TR → RU · ИИ» с переключением оригинала `toggleOrig`, время + галочки); инпут `chatInput` (Enter → `sendMsg`), кнопка отправки.

### 1.10 Уведомления (`screen:'ntf'`, 819–836)

Группы `ntfGroups` (Сегодня/Вчера) из `NTFDATA`, по 4 с «Показать ещё» (`pgr('ntf_'+d,…,4)`), «Прочитать все». Непрочитанные подсвечиваются `#f8faff`.

### 1.11 Риэлторы — админ (`screen:'rls'`, `isRls` = rls && isAdmin, 838–959)

| Блок | Детали |
|---|---|
| Шапка | «Пригласить риэлтора» (`openInv`) |
| Статистика `rlStats` | В базе, Активны, На модерации, Открытых приглашений (мок «2») |
| Табы `rlTab` | `people` («Риэлторы»), `ags` («Агентства», бейдж `agTotal`), `reps` («Жалобы», бейдж новых) |
| Риэлторы (926–957) | поиск `rlQ` (по имени/почте), «Добавить» (`rlAddB` → модалка с `rlEditK:'__new'`); строки `rlRows` (3595–3613; pending первыми): аватар+онлайн, имя (+«· мой объект» для me), агентство · город · языки, метрики (объекты/подборки/реакции), «Активность: …», бейдж оплаты `payL` (Оплачено до / Истекает ≤14 дн. / Просрочено — относительно даты 24.08.2026), статус (Активен/Пауза/На модерации), кнопки Принять/Отклонить (pending) или Приостановить/Вернуть доступ (`rlOver`), «Редактировать» (`edit`). Пагинация по 5 |
| Агентства (882–925) | список `agRows` (поиск `agQ`, сортировка, «N риэлт.», по 3), «Добавить» (`agAddOpenB`), подсказка `agDelH`; карточка агентства `agView`: название, число риэлторов, мета `agViewMetaL` (адрес · телефон · лицензия · «✓ скан»), «Данные» (`agVData` → модалка), удалить (только без риэлторов), список риэлторов агентства с «Редактировать» |
| Жалобы (854–881) | `rptAdmRows` (new первыми, по 8): фото/название/цена объекта, статус (Новая/Разобрана), причина + текст, «от кого · дата», «Открыть объявление», «Разобрано / Вернуть» (`toggleSt`) |
| Модалка «Данные риэлтора» `rlEditOpen` (1791–1814) | `reName`, `reMail`, `rePhone` (маска TR), агентство: поиск `reAgQ` + список `reAgOpts` («Свободный агент» первым), «Доступ оплачен до» `reTo` → календарь `calOpen` (1829–1841, `calCells` 6×7, `calPrev/Next`), ошибки `reErr` (обязательные, email, `dupCheck`), `rlEditSave` (4210–4217): создаёт `rn<ts>` или обновляет `this.R[k]`; для `me` синхронизирует профиль |
| Модалка «Приглашение в базу» `invOpen` (1816–1827) | email `invEmail` → «Отправить» (toast), либо ссылка `https://one-plan.pro/join/RLT-8F2K` + «Копировать» |
| Модалка «Новое агентство / Данные агентства» `agAddOpen` (1866–1883) | `agNName*`, `agNAddr`, `agNPhone`, `agNLic` (TR-07-XXXX), скан (file → имя файла `agNScan`); `agAddSave` (4186–4196): уникальность названия/телефона/лицензии по `AGMETA`, переименование каскадно обновляет `R[*].ag` |

### 1.12 API (`screen:'api'`, 1336–1366)

Ключ `opl_live_7f3k9q2m` (хардкод), методы `apiEps`: `GET /api/v1/listings` (фильтры deal,type,il,ilce,price_min/max,rooms; JSON с пагинацией), `GET /api/v1/listings/{id}`, `GET /feed/{key}.xml` (обновление каждые 15 мин), `POST {your-url}` webhook (`listing.created`, `price.changed`, `status.changed`); пример ответа (1357–1361); «Написать в поддержку» (`apiChat` → диалог `dsup`).

### 1.13 Подписка (`screen:'billing'`, 1368–1401)

«Подписка активна до 24.11.2026 · Тариф: 6 мес» (хардкод), тарифы `bilPacks` (3946): 3 мес — 4 500 ₺ (1 500 ₺/мес), 6 мес — 7 650 ₺ (1 275, −15%), 12 мес — 12 600 ₺ (1 050, −30%); `bilPack` выбран '6'; «Оплатить картой» → toast «Перенаправляем…»; история `bilHist` (24.05.2026 и 24.11.2025 по 7 650 ₺, «Оплачено», иконка счёта).

### 1.14 Профиль (`screen:'profile'`, 1403–1534)

| Блок | Детали |
|---|---|
| Карточка подписки → `goBilling` | «Подписка активна до 24.11.2026» |
| Данные | `pName` (редактируемое), `pAgency` (readOnly, подсказка «смена через поддержку»), `pMail` (readOnly) |
| Мои рабочие регионы | `pAreas[]` (İl-ключи из `GEO`), кнопка «+ Добавить регион» раскрывает все провинции (`pAreasOpen`) — по ним фильтруются «Запросы базы» |
| Контакты и каналы | `pPhone` + «Найти мессенджеры» (`runCheck`: 900 мс «Проверяем…», результат «WhatsApp, Telegram, Viber»); Звонок «всегда»; WhatsApp (`waFound`/`waOn` тумблер); Telegram (`tgFound`/`tgOn`, опция показывать `@логин` `tgOptLogin`/`tgLogin`, ручное добавление `tgShowForm`/`addTgLogin`); Viber (`vbOn`); MAX (`mxAdded/mxOn/mxId` +7, форма `mxForm`); WeChat (`wcAdded/wcOn/wcId`); предупреждение `chWarn`; «Клиент видит: …» (`chSummary`) |
| Безопасность | пароль (просмотр / форма `pwEdit`: старый/новый/подтверждение, глаз, «Сгенерировать» 8 символов), 2FA тумблер `tfaOn` + ключ `OPLN-7K2M-Q9X4-TR8B` и ссылки App Store / Google Play |
| Кнопки | «Сохранить» (`profSave` → toast), «Выйти» (`doLogout`) |

### 1.15 Клиентский вид подборки (`isClient`, 1919–2102)

Полноэкранный оверлей (z 350). Верхняя тёмная полоса: «Предпросмотр — так подборку видит клиент», «Клиент видит только контакты автора», «В кабинет» (`closeClient`). Шапка: логотип, агент (`myInitials`, `pName`, «Ваш агент · OnePlan»), иконки каналов по настройкам профиля (`cliShowWa/Tg/Vb/Mx/Wc`), телефон.

Список (`cliListShow`): `h1` «Подборка для <имя>», сообщение агента `cliNote`, чипы `cliMeta` (Обновлено <дата>, N объектов, N понравилось, города), карточки `cliCards` (мини-галерея с листанием `cliGal[key]`, название, цена/старая/снижение, eq, ВНЖ/Гражданство, параметры, комментарий агента `cv.cm[id]`, реакции Нравится/Думаю/Не то → `cliReacts[selId:objId]`, лайк показывает toast).

Объект (`cliObjShow`, `cliO`): моб. бар с ценой и контактами агента, «К подборке», галерея (свайп/стрелки/боковые/миниатюры, лайтбокс `cliLb`, моб. стек `cliMg`), `h2`, локация, комментарий, «Ключевые параметры» (тот же `_detail`), «В объекте», «Инфраструктура», «Описание»; справа: цена/eq/тип/сделка, реакции, карточка агента с каналами.

### 1.16 Гео-пикер (`geoOpen`, 2123–2175)

Модалка 520×min(620px,86vh) (на мобайле — bottom-sheet). `geoMode`: `filter` (каталог/новостройки), `add` (форма объекта), `req` (новый запрос). Шаги `geoStep`: `il` → `ilce` → `semt`. Заголовок `geoTitle` + крошки `geoCrumb`, поиск `geoQ`. Шаг İl: «Вся Турция» (только filter, `geoAll`), строки `geoIlRows` со счётчиком объектов (в filter скрываются провинции без объектов). Шаг İlçe: чекбоксы-мультивыбор (filter) или клик → шаг semt (add/req); если у провинции нет районов в справочнике (add) — «Выбрать только провинцию» (`geoPickIlOnly`). Шаг Semt: «Весь район целиком» (`geoWhole`), группы по İlçe `geoSemtGroups` с чекбоксами. Футер (filter): «Микрорайоны →» (`geoNext`), «Показать N объектов/проектов» (`geoApply` → `fIl/fIlces/fSemts`). Временные значения: `geoIlTmp, geoIlcesTmp, geoSemtsTmp, geoIlceFocus`.

---

## 2. Роли и доступ

В прототипе только две роли: `role` ∈ `'realtor' | 'admin'` (state `role`, fallback `props.demoRole`, переключатель в демо-панели `roleBtns`, 3709). Роли «владелец агентства» нет — агентство лишь строка `ag` у риэлтора и справочник `AGS/AGMETA`, которым управляет админ.

| Возможность | Риэлтор | Админ |
|---|---|---|
| Пункт «Риэлторы» в навигации/кебабе, экран `rls` (`isRls`) | нет (при переключении на realtor с экрана rls — редирект в catalog) | да |
| Редактирование чужого объекта: статус, «Редактировать», экспорт (`mObj.canEdit = isMine || role==='admin'`, 3422) | только свои | любые; показывается плашка `adminEdit` «Режим администратора — вы редактируете чужой объект» |
| Жалоба на объект (`canReport = !isMine`) | на чужие | на чужие |
| Модерация заявок (Принять/Отклонить), пауза/возврат доступа, редактирование данных риэлторов, дата оплаты | — | да |
| Справочник агентств (создание, переименование, удаление пустых, реквизиты, скан лицензии) | — | да |
| Жалобы: просмотр, «Разобрано/Вернуть» | — | да |
| Приглашения (email / ссылка `/join/…`) | — | да (кнопка на экране rls) |
| Подключение порталов экспорта | тумблеры доступны, но примечание «подключение настраивает администратор» | то же |
| Смена агентства и почты в профиле | заблокировано (через поддержку) | то же (в прототипе) |
| Комиссия партнёру (`o.comm`, `showComm`) | видна всем риэлторам, клиент не видит | то же |

Статусы участника: `active | paused | pending` (`R[k].pending`, override `rlOver[k]`). Оплата доступа: `R[k].paidTo` (`dd.mm.yyyy`), статус `ok / soon (≤14 дн.) / exp`. Текст `t.bil.lock`: при неоплате доступ к базе закрывается, кабинет и оплата остаются.

---

## 3. Модели данных

### 3.1 Риэлтор / участник — `this.R` (2192–2200, 2362, 2363–2364)

Объект-словарь: ключ = id (`me`, `r1`…`r6`, `sup`, новые `rn<ts>`).

| Поле | Тип | Смысл |
|---|---|---|
| `name` | string | ФИО |
| `ag` | string | агентство (или `'—'` / «Свободный агент») |
| `color` | hex | цвет аватара |
| `phone` | string | `+90 5xx xxx xx xx` |
| `mail` | string? | почта (для `sup`; для остальных вычисляется `mailOf`: `me` → `realtor@one-plan.pro`, иначе `<k>@one-plan.pro`) |
| `city` | {RU,EN,TR} | город |
| `langs` | string | «RU · EN» |
| `online` | bool | онлайн |
| `objs`, `sels`, `likes` | number | метрики для админ-списка |
| `la` | {RU,EN,TR} | «последняя активность» текстом |
| `pending` | bool? | заявка на модерации |
| `support` | bool? | аккаунт поддержки |
| `paidTo` | string | «доступ оплачен до» `dd.mm.yyyy` (из `PDT`) |

Пример: `r1:{name:'Mehmet Kaya',ag:'Kaya Emlak',color:'#0f9d6b',phone:'+90 533 210 44 87',city:{RU:'Анталия',EN:'Antalya',TR:'Antalya'},langs:'TR · EN',online:true,objs:2,sels:7,likes:12,la:{RU:'сейчас',EN:'now',TR:'şimdi'},paidTo:'03.09.2026'}`

Текущий пользователь дублируется в state: `pName,pAgency,pPhone,pWa,pTg,pMail,pAreas[]`, каналы `waFound,waOn,tgFound,tgOn,tgAdded,tgLogin,vbOn,mxOn,mxAdded,mxId,wcOn,wcAdded,wcId`, `tfaOn`.

### 3.2 Объект (вторичка) — `this.OBJ` (2207–2219, 2271–2275, генерация 2287–2305, нормализация 2306–2360) + `state.extraMine`

| Поле | Тип | Смысл |
|---|---|---|
| `id` | string | `o1..o12`, `m1..m3` (мои), `g<n>_<j>` (сгенерированные), `x<ts>` (созданные в форме) |
| `owner` | string | ключ из `R` |
| `t` | {RU,EN,TR} | заголовок |
| `price` | number | цена, **всегда в TRY** (в конструкторе EUR×48, USD×43.2 → TRY, округление до 10 000; строка 2355) |
| `cur` | 'TRY' | валюта (после нормализации всегда TRY) |
| `deal` | enum | `sale | rent | daily` (в i18n есть ещё `transfer`, не используется) |
| `type` | enum | `flat | house | comm | land` |
| `rooms` | string | `'1+1'…'9+3'`, `''` для land |
| `area` | number | нетто м² (брутто = `round(area*1.12)`; для land — площадь участка) |
| `fl` | string | «3/5» или «—»; `floorN`, `floorsTotal` — числа |
| `cityKey` | enum | `antalya | alanya | belek | istanbul | ankara | mersin` (для `CITY_LL`) |
| `il`, `ilce`, `semt` | string | ключи из `GEO` |
| `loc` | {RU,EN,TR} | «Анталия · Лара» |
| `ll` | [lat,lng] | координаты |
| `img` | url | обложка; `photos: url[]` (3 или 10 фото) |
| `desc` | {RU,EN,TR} | описание; `base` — язык оригинала (`'RU'|'EN'|'TR'`) |
| `badge` | enum? | `new | hot | exc` |
| `st` | enum? | `active (default) | reserved | sold | off`; override `state.stOver[id]` |
| `comm` | number | комиссия партнёру, % (0–5) |
| `furn` | bool | мебель |
| `feats` | string[] | из `FEATS` |
| `bath` | number | санузлы |
| `age` | number | возраст здания (лет) |
| `heat` | enum \| enum[] \| null | `none | kombi | central | ac | floor` |
| `balcony`, `lift`, `gasline`, `inSite`, `credit`, `takas`, `own5` | bool | флаги |
| `aidat` | number | ₺/мес (flat) |
| `seaDist` | number | метров до моря |
| `deposit` | number? | депозит (rent), по умолчанию `price*2` |
| `ph` | [[date,price],…]? | история цены (даты `dd.mm.yyyy`) |
| `created`, `updated` | string | `dd.mm.yyyy` (ru-RU) |
| `usage` | enum? | `empty | owner | tenant` (flat/house) |
| `cephe` | enum? | `guney | kuzey | dogu | bati` (flat) |
| `tapu` | enum | `mulkiyet | irtifak` (не land) / `mustakil | hisseli` (land) |
| `imar` | enum? | `konut | ticari | tarla | imarsiz` (land) |
| `emsal` | number? | KAKS (land); `adaParsel: '101 / 4'` |
| `garden` | number? | м² участка при доме (house) |
| `commType` | enum? | `shop | office | depot | rest` (comm); `kiraci`, `devir` bool |
| `vnj` | bool | подходит под ВНЖ (sale && flat/house/land) |
| `cit` | bool | под гражданство (vnj && (TRY ≥ 17 500 000 или EUR ≥ 400 000)) |

Пример (до нормализации, 2208): `{id:'o1',owner:'r3',t:{RU:'2+1 Гюзелоба, 3 этаж',EN:'2+1 Güzeloba, 3rd floor',TR:'Güzeloba 2+1, 3. kat'},price:5430000,cur:'TRY',rooms:'2+1',area:100,fl:'3/5',cityKey:'antalya',loc:{RU:'Анталия · Гюзелоба',EN:'Antalya · Güzeloba',TR:'Antalya · Güzeloba'},img:IMG[0],desc:D[0],base:'TR',comm:3}`; далее `o1` получает `ilce:'muratpasa', semt:'guzeloba', il:'antalya'` (GMAP 2271), `o5.st='reserved'`, `o9.st='sold'`, `o2.ph=[['12.06.2026',4850000],['28.07.2026',4700000]]`.

### 3.3 Новостройка — `this.NEWB` (3300–3335)

| Поле | Тип | Смысл |
|---|---|---|
| `k` | string | ключ (`terra`, `lara`, `oba`, `belek`) |
| `n` | string | название |
| `type` | `flat | house` | |
| `cur` | `TRY | USD | EUR` | валюта прайса (в отличие от вторички — не конвертируется) |
| `geo` | string | «Antalya · Konyaaltı · Hurma» (фильтр по гео — подстрочный поиск по этой строке) |
| `ll` | [lat,lng] | |
| `dev` | string | застройщик |
| `dlv` | string | срок сдачи «12.2026» |
| `sales` | enum | `none | start | open | sold` |
| `keys` | enum | `not | started | done` |
| `units`, `fl`, `bl` | number | квартир, этажей, блоков |
| `inst` | bool | рассрочка |
| `feats` | string[] | ключи инфраструктуры (часть — `fit, cam, ter, gaz, ten` — отсутствует в `t.feat` и отфильтровывается) |
| `plans` | [rooms, m2, price, tag?][] | планировки; `tag:'villa'` |
| `ph` | {img, cat}[] | фото; `cat` ∈ `ext | int | soc | pool | spa | kids | park` |
| `desc` | {RU,EN,TR} | |
| `diary` | {d:'08.2026', tx:{RU,EN,TR}, img}[] | дневник стройки |
| `docs` | string[] | имена PDF |
| `unitList` | Unit[] | генерируется (3325–3334): `{no, bl, f, pl (ссылка на plan), gb (брутто), net (=round(gb*0.82)), tag: '' | 'ter' | 'dup' | 'villa', st: 'free' | 'hold' | 'proc' | 'res' | 'sold' | 'na'}` |

Пример: `{k:'terra',n:'Terra Marin',type:'flat',cur:'TRY',geo:'Antalya · Konyaaltı · Hurma',ll:[36.8672,30.6402],dev:'Terra İnşaat',dlv:'12.2026',sales:'open',keys:'not',units:96,fl:8,bl:2,inst:true,feats:['pool','ipool','upark','play','fit','sec','cam','sauna','hamam','gen'],plans:[['1+0',38,4900000],['1+1',55,6900000],['2+1',78,9800000],['3+1',112,14500000]],ph:mkPh(2),desc:{…},diary:[{d:'08.2026',tx:{RU:'Каркас блока A завершён, начат монтаж фасада',…},img:im(4)},…],docs:['İnşaat ruhsatı.pdf','Kat planları.pdf','Tapu örneği.pdf','Ödeme planı.pdf']}`

Избранное новостроек в state: `nbWatch: string[]` (ключи проектов), `nbFavU: string[]` (`'<k>#<no>'`).

### 3.4 Агентство — `this.AGS` (3583) + `this.AGMETA` (3299)

`AGS = ['AM Estate','Kaya Emlak','Antalya Homes','Sun Riviera']` (массив названий). `AGMETA[name] = {addr, phone, lic, scan}`; пример: `'AM Estate':{addr:'Fener Mah. Tekelioğlu Cd. 21, Muratpaşa/Antalya',phone:'+90 532 555 10 20',lic:'TR-07-4821',scan:'am-estate-lisans.pdf'}`. Число риэлторов агентства считается по `R[*].ag`.

### 3.5 Подборка — `state.selections` (2507–2511)

| Поле | Тип | Смысл |
|---|---|---|
| `id` | string | `s1..s4`, новые `s<ts>` |
| `title` | string | название |
| `name` | string | имя клиента |
| `items` | string[] | id объектов |
| `status` | enum | `draft | sent | viewed` |
| `liked`, `views` | number | |
| `cm` | {objId: string} | комментарии к объектам |
| `note` | string | сообщение клиенту |
| `date` | {RU,EN,TR} | относительная дата |

Пример: `{id:'s1',title:'Анна · у моря',name:'Анна Соколова',items:['o3','o2','o6','o1','o9'],status:'viewed',liked:3,views:2,cm:{o3:'Первая линия, вид на море',o2:'Подходит под гражданство'},note:'Подобрал варианты у моря по вашему бюджету…',date:{RU:'Сегодня',…}}`. Реакции клиента: `state.cliReacts['<selId>:<objId>'] = 'like' | 'maybe' | 'no' | null`. Черновик создания: `sel[], cTitle, cName, cNote, cCm{}, editingSel, createDone`.

### 3.6 Сохранённый поиск — `state.savedSearches` (2504)

`{id:'q1', name:'Анна · у моря до 9,6 млн ₺', params:{il:'antalya', ilces:[], semts:[], min:'', max:'9600000', rooms:['2+1','3+1']}, newN:2}`. Публикация как запрос: `state.pubReqs: id[]`.

### 3.7 Запрос базы — `this.BREQS` (3336–3340)

| Поле | Тип | Смысл |
|---|---|---|
| `id` | string | `b1..b4`, новые `bn<ts>`; опубликованные поиски — `ps<qId>` с `ps:true, psId, paramsStr` |
| `by` | string | ключ риэлтора |
| `deal`, `type`, `rooms` | enum/string | `rooms` — «2+1» или «2+1 / 3+1» |
| `il` | string | провинция (для фильтра «Мои районы») |
| `geo` | string | текст локации |
| `max` | number | бюджет до, ₺ |
| `days` | number | дней до автозакрытия (30 при создании) |
| `featKeys` | string[]? | `furn | pool | seaview | first | imar | kiraci` |
| `c` | {RU,EN,TR} | комментарий |

Пример: `{id:'b1',by:'r1',deal:'sale',type:'flat',rooms:'2+1',il:'antalya',geo:'Antalya · Alanya · Oba',max:6500000,days:21,c:{RU:'Клиент с наличными, готов выйти на сделку за неделю. Этаж не первый.',EN:'…',TR:'…'}}`. Отклики: `state.reqSent[reqId] = objId`.

### 3.8 Диалог / сообщение — `this.DLG` (2365–2379) + `state.extraMsgs`

Диалог: `{id:'d1', who:'r1', msgs:[…]}`; `dsup` — поддержка (`who:'sup'`). Сообщение: `{me:bool, by?:string (подпись оператора), lang:'RU'|'EN'|'TR' (язык оригинала), tx:{RU,EN,TR}, time:'10:24'|'Вчера', ts?:number (есть только у отправленных в сессии), objId?:string}`.

Пример: `{me:false,lang:'TR',tx:{RU:'Привет! 1+1 в Коньяалты ещё в продаже?',EN:'Hi! Is the 1+1 in Konyaaltı still for sale?',TR:'Merhaba! Konyaaltı’daki 1+1 hâlâ satışta mı?'},time:'10:24'}`. Прочитанность диалогов: `state.readDlgs: id[]`; показ оригинала: `showOrig['<dlgId>:<idx>']`.

### 3.9 Уведомление — `this.NTFDATA` (2474–2493)

`{id, icon:'ti-…', tone:hex, bg:hex, day:'today'|'yest', time:'16:05', unread:bool, tx:{RU:[title, sub], EN:[…], TR:[…]}}`. Пример: `{id:'nfp',icon:'ti-heart-down',tone:'#0f9d6b',bg:'#e4f6ee',day:'today',time:'16:05',unread:true,tx:{RU:['Цена снижена в избранном','«3+1 Лиман с бассейном» подешевел на 480 000 ₺ — теперь 8 640 000 ₺.'],…}}`. Типы событий по мокам: снижение цены в избранном, резерв объекта из избранного, запрос под мой объект, новые по сохранённому поиску, клиент открыл подборку, клиент лайкнул, сообщение в чате, новый объект в базе, заявка на вступление, ссылка отправлена. Прочитано: `state.ntfRead: id[]`.

### 3.10 Портал — `this.PORTALS` (2361)

`{k, name, bg, akd?:true, op?:true}`: `sah` Sahibinden `#f0ad00`, `hep` Hepsiemlak `#e5484d`, `eml` Emlakjet `#4d7cfe`, `akd` Akdeniz.ru (akd), `ot` One-team.ru (op). «Работает» только `op`/`akd`; остальные «Скоро». Подключение объекта: `state.expMap[objId][portalKey] = bool`.

### 3.11 Жалоба — `state.reports` (2524)

`{id:'rp1', obj:'o9', reason:'sold', txt:'Объект продан ещё в июле, статус не обновлён', from:'r2', date:'24.08.2026', st:'new'|'done'}`; `reason` ∈ `stale | sold | price | dup | other`.

### 3.12 Тариф / оплата (3946–3950)

`bilPacks`: `['3',4500,1500,'']`, `['6',7650,1275,'−15%']`, `['12',12600,1050,'−30%']` — [месяцы, итого ₺, ₺/мес, выгода]. `bilHist`: `{d:'24.05.2026', p:'6 мес', a:'7 650 ₺'}`.

### 3.13 Гео-справочник — `this.GEO` (2221–2268), индексы `ILCES`, `SEMT2ILCE`, `IL_OF` (2269–2270), `CITY_LL` (2220)

`GEO: {k, n, ilces:[{k, n, semts:[{k, n}]}]}[]`. Заполнены: Adana, Ankara, Antalya (11 ilçe: muratpasa, konyaalti, kepez, alanya, serik, manavgat, kemer, aksu, dosemealti, kumluca, gazipasa), Aydın, Bursa, İstanbul, İzmir, Mersin, Muğla, Trabzon; остальные 71 провинция добавлены без районов (2268). Ключи — латиница без диакритики. Пример: `{k:'antalya',n:'Antalya',ilces:[{k:'konyaalti',n:'Konyaaltı',semts:[{k:'liman',n:'Liman'},{k:'hurma',n:'Hurma'},{k:'uncali',n:'Uncalı'},{k:'sarisu',n:'Sarısu'}]},…]}`. Динамически добавленные из Nominatim получают ключ `'z'+normalized`.

### 3.14 Перечисления (сводно)

| Перечисление | Значения | Где |
|---|---|---|
| Статус объекта `st` | `active, reserved, sold, off` | `t.stt` |
| Тип сделки `deal` | `sale, rent, daily` (+ `transfer` в i18n) | `t.deal` |
| Тип объекта `type` | `flat, house, comm, land` (+ `other` в i18n) | `t.typ` |
| Комнатность | базовые `1+1, 2+1, 3+1, 4+1`; полный `ROOMS_ALL` (3165): `1+0, 1+1, 1.5+1, 2+0, 2+1, 2.5+1, 2+2, 3+0, 3+1, 3.5+1, 3+2, 3+3, 4+0, 4+1, 4.5+1, 4.5+2, 4+2, 4+3, 4+4, 5+1, 5.5+1, 5+2, 5+3, 5+4, 6+1, 6+2, 6.5+1, 6+3, 6+4, 7+1, 7+2, 7+3, 8+1, 8+2, 8+3, 8+4, 9+1, 9+2, 9+3` | |
| Мебель `furn` | `yes, no` (bool в объекте) | `t.furn` |
| Отопление `heat` | `none, kombi, central, ac, floor` | `t.heatL` |
| Тапу | `mustakil, hisseli` (land); `mulkiyet, irtifak` (остальные) | `t.ext.tapuL` |
| Имар | `konut, ticari, tarla, imarsiz` | `t.ext.imarL` |
| Тип коммерции | `shop, office, depot, rest` | `t.ext.commL` |
| Кто в квартире | `empty, owner, tenant` | `t.ext.usageL` |
| Сторона света | `guney, kuzey, dogu, bati` | `t.ext.cepheL` |
| Особенности `FEATS` (2276) | `pool, ipool, opark, upark, play, gym, cctv, sec, sauna, hamam, gen, gazebo, bbq, tennis, basket, depot, shut, terr, sea` | `t.feat` |
| Метка `badge` | `new (#22c15e), hot (#e5484d), exc (#7b4fd0)` | `badgeMap` 3002 |
| Валюты | `TRY (₺), EUR (€), USD ($)`; курсы: 1 € = 48 ₺, 1 $ = 43.2 ₺ (USD = EUR/0.9) | 2355, 2989–2992 |
| Возраст здания (фильтр) | `0-5, 5-10, 10-20, 20+` | |
| Санузлы (фильтр) | `1, 2, 3(+)` | |
| До моря (фильтр) | `300, 1000, 3000, 5000, gt5` | |
| Города (`cityKey`/`t.cat.cities`) | `antalya, alanya, belek` (+ `istanbul, ankara, mersin` в `CITY_LL`) | |
| Статус продаж новостройки | `none, start, open, sold` | `t.newb.salesL` |
| Выдача ключей | `not, started, done` | `t.newb.keysL` |
| Статус квартиры | `free, hold, proc, res, sold, na` | `V2` 4020 |
| Категории фото проекта | `all, ext, int, soc, pool, spa, kids, park` | `t.newb.cats` |
| Статус подборки | `draft, sent, viewed` | `t.sel` |
| Реакция клиента | `like, maybe, no` | |
| Статус участника | `active, paused, pending` | `t.rl` |
| Статус жалобы | `new, done` | |
| Причина жалобы | `stale, sold, price, dup, other` | `t.obj.rptR` |
| Особенности запроса | `furn, pool, seaview, first, imar, kiraci` | |
| Сортировка | `new, cheap, exp` | |
| Языки | `RU, EN, TR` (детект по `navigator.language`, 2496) | |

---

## 4. Поведение

### 4.1 Фильтрация и сортировка каталога (`passF` 3026–3075, 3076–3085)

- Базовый набор: `ALLOBJ = OBJ + extraMine`; каталог исключает `sold` (`stOf(o)!=='sold'`), при `rOwner` — только объекты владельца.
- `passF` проверяет по порядку: deal (обязательно равен `fDeal`, по умолчанию `sale`), type, брутто (`round(area*1.12)`, для land — area) min/max, нетто min/max, мебель, все выбранные `fFeats` (AND), ВНЖ, гражданство, лифт, газ, «цена снижена» (`ph[0][1] > price`), балкон, отопление (OR), санузлы (3 = 3+), возраст (диапазоны), этаж min/max, не первый / не последний, этажность, айдат ≤, до моря (≤ или `gt5`), депозит ≤ (rent), имар, тапу, тип коммерции, арендатор, девир, кто в квартире, участок при доме, в комплексе, сторона света, кредит, обмен, гео (il → ilces → semts только для выбранных ilçe), комнаты, цена в ₺ (`eur(o)*48`).
- Сортировка: `new` (порядок массива), `cheap`/`exp` по `eur(o)`.
- Смена deal сбрасывает `fDep` (если не rent) и `fVnj` (если не sale); смена типа сбрасывает `typeClear`, для land — ещё `landClear` (комнаты, этажи, санузлы, отопление, балкон, мебель, особенности, айдат, возраст, в комплексе).
- `scopeAll` (3082) — база для счётчиков в панелях (deal/type/rooms показывают только существующие значения).
- Пагинация «инфинити»: `visN` (старт 9, +9 при приближении сентинела), сбрасывается при смене фильтров.

### 4.2 Избранное и папка (подборка)

- Сердечко: `favs: id[]` (toggle на карточке/странице). Экран «Избранное» показывает `favObjs` (с применением тех же фильтров `passF`), плюс комплексы `nbWatch` и квартиры `nbFavU`.
- Папка `toggleSel(id)` → `sel: id[]`; карточка получает синюю рамку и «В подборке». Панель внизу → модалка создания. `doCreateSel`: новая подборка (`status:'sent'`, `date:'Только что'`) или обновление при `editingSel`.
- Ссылка подборки: карточка — `https://one-plan.pro/s/<ID.toUpperCase()>7F` (3472), после создания — `https://one-plan.pro/s/<ID.toUpperCase().slice(-6)>` (4299) — форматы различаются.
- Инвайт: `https://one-plan.pro/join/RLT-8F2K` (4239).

### 4.3 Сохранённые поиски и запросы

- `saveSearch` берёт только `il, ilces, semts, min, max, rooms` (не все фильтры!) → модалка имени → `savedSearches.unshift({id:'q<ts>', name, params, newN:0})`.
- `matchOf(params)` (3219–3229): число активных объектов по il/ilces/semts/rooms/цена ₺. `newN` — мок (2 и 0), обнуляется при «Показать в базе».
- Публикация поиска как запроса: `pubReqs` → в ленте «Запросы базы» как строка с `paramsStr`.
- Запросы: фильтр «Мои районы» по `pAreas` (профиль), `bMatch` = мои объекты того же type/deal; «Предложить» → сообщение в чат автору с карточкой объекта.

### 4.4 Чат (3548–3577)

- Список: поддержка первой, затем по `ts` (сессионные) и `time`. Непрочитано: только `d3` пока не открыт (`readDlgs`).
- Перевод: при `chatTr` и `m.lang !== lang` показывается `m.tx[lang]` и подпись «TR → RU · ИИ»; клик — оригинал (`m.tx[m.lang]`, «TR · оригинал — ИИ ⇄»).
- Отправка: текст записывается одинаковым во все три языка, `ts=Date.now()` (=> галочки «Доставлено», у мок-сообщений — «Прочитано»). Реального перевода нет.
- Сообщение с `objId` рендерит карточку объекта (из «Предложить объект»).
- Точки входа в чат: карточка владельца (`chatWith`), профиль риэлтора (`rChat`), запрос (`chat`), поддержка (`apiChat`, `reqB`, `devChat`, `ctsChat` → `dsup`; для застройщика ищется `who==='support'`, которого нет → падает на `d1`).

### 4.5 Уведомления

Статичный список; `unreadCount = NTFDATA.filter(unread && !ntfRead)`. «Прочитать все» = `ntfRead = все id`. Нет генерации новых уведомлений в рантайме (кроме toast'ов).

### 4.6 Карты (Leaflet 1.9.4)

- Тайлы: `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png` (© OSM · © CARTO), maxZoom 18.
- Каталог `#opl-map` (`_syncMap` 2744–2940): уровень `_mapLevel` = `il` (нет `fIl`) → `ilce` (нет `fIlces`) → `semt` (нет `fSemts`) → `obj`. На уровнях il/ilce/semt — хороплет по медианной цене группы: цвет `hsl(115−100·t, 52%, 64−12·t)` (зелёный → красный), тултип «Название · кол-во · медиана», клик = drill-down (`fIl`/`fIlces`/`fSemts`), объекты точками `circleMarker` (цвет по статусу). Полигоны провинций — GeoJSON с GitHub (`alpers/Turkey-Maps-GeoJSON/tr-cities.json`, fallback `cihadturhan/tr-geojson/tr-cities-utf8.json`), сопоставление по нормализованному имени. Полигоны ilçe/mahalle — Nominatim `search?polygon_geojson=1&polygon_threshold=…`, запросы «Name, İlçe, İl» и «Name Mahallesi, …», с паузой 400 мс и стаггером 300 мс; при неудаче рисуется синтетический «блоб» вокруг центроида (2901–2903), объекты «прилипают» к центроиду полигона (`snap`). Уровень obj: пины `.opl-pin` с ценой («8.6M ₺»/«450k ₺»), классы `res`/`sold`, тултип-карточка (фото, заголовок, локация, мета, цена), клик → страница объекта; контуры выбранных махалле.
- Объект `#obj-map`: один пин с ценой, zoom 14.
- Форма `#add-map`: клик/drag пина → `_setAddPin` → Nominatim `reverse?accept-language=tr` → адрес и авто-определение il/ilçe/semt (нечёткое сравнение по префиксу); смена il/ilçe/semt → `_flyAddArea` (Nominatim search → `fitBounds`).
- Новостройки: `#nbcat-map` (пины «от X ₺/$/€» → открыть проект), `#nb-map` (пин с названием).
- Легенда медианной цены показывается при ≥2 группах.

### 4.7 Валюты

Все цены вторички хранятся в TRY. `eur(o)=price/48`, USD = `eur/0.9`; `eqOf(o)` → «≈ 180 000 € · 200 000 $» (округление `rnd`: до 10 000 при ≥1 млн, до 1 000 при ≥10 000, иначе до 100). Новостройки хранят `cur` как есть, `toTry` для фильтра цены. «по курсу ЦБ на <сегодня>» — текст, курс захардкожен.

### 4.8 Дубликаты, черновики, автосейв

- Дубли при добавлении: тот же `ilce` и `rooms`, цена в € в пределах 12%.
- Черновики `drafts[]` (снимок всех `a*` полей, `dcId`), показываются на «Мои объекты», «Продолжить» восстанавливает state.
- Автосейв формы в `localStorage['opl-add-autosave']` каждые 800 мс на экране add; восстанавливается при `componentDidMount`.

### 4.9 Поделиться / контакты

Кнопки WhatsApp/Telegram/Viber/MAX/WeChat везде декоративные (без `href`). «Копировать» использует `navigator.clipboard.writeText` с индикатором `copied` на 1.5 с. Каналы клиента в подборке зависят от настроек профиля (`cliShowWa` = `waFound && waOn` и т. д.).

### 4.10 Таймеры и анимации

| Что | Значение | Строка |
|---|---|---|
| Toast | 2400 мс | 2527 |
| «Скопировано» | 1500 мс | 3472, 4240, 4300 |
| Инфинити-скролл | 350 мс задержка, +9 | 2557 |
| Автосейв формы | debounce 800 мс | 2581 |
| Поиск мессенджеров | 900 мс | 3696 |
| Rate-limit заявки | 60 000 мс | 4234 |
| Nominatim повторы | 400 мс между запросами, 300 мс стаггер | 2791, 2870, 2907 |
| Карта `invalidateSize` | 60 мс после создания | |
| Скролл к верху после фильтра | 60 мс | 2528 |
| CSS | `opl-bg` (fade 0.2 s), `opl-card` (translateY 12px), `opl-spin` (1 s), `opl-fade` (0.16 s); топбар `transform .18s/.25s`; свайп галереи `transform .35s cubic-bezier(.22,.61,.36,1)`; тумблеры `.15s/.2s` | 23–26, 2614 |

Прочее: iOS-фикс `visualViewport` (2531–2542) для чата/шторок при открытой клавиатуре; `_numKb` (2529) ставит `inputmode=numeric` числовым полям по плейсхолдеру; `_chipFade` (2621) — градиентная маска у прокручиваемых чипов.

---

## 5. Дизайн-токены

### 5.1 Шрифт
`'Inter', -apple-system, system-ui, sans-serif`, веса 400/500/600/700/800 (Google Fonts). Размеры (по частоте): 12.5, 13, 12, 14, 13.5, 11.5, 11, 17, 10.5, 15, 16, 19, 18, 20, 14.5, 10, 24, 22, 21 px. Заголовки h1 ≈ 22–24 px / 800; подписи и бейджи 10.5–11 px / 700–800, часто `text-transform:uppercase; letter-spacing:.03–.04em`.

### 5.2 Цвета

| Роль | Hex |
|---|---|
| Фон страницы | `#f7f8fb` (body), градиент входа `#f7f8fb → #eef1f6` |
| Текст основной | `#1b2942` (body), `#14243f` (заголовки, тёмный primary, топбар-актив, кнопки «тёмные») |
| Текст вторичный | `#5a6472`, `#6b7688`, `#3d4a5e` |
| Текст приглушённый / плейсхолдер | `#8a93a2`, `#aab1bd`, `#c3c9d4`, `#c9cfda` |
| Границы | `#e6e9f0` (основная), `#edf0f6`, `#f5f7fb` (разделители строк), `#d5dce6`, `#dde2ec` |
| Поверхности | `#fff`, `#f5f7fb`, `#eef1f6`, `#f0f2f6`, `#f2f4f8`, `#f8faff` (hover/unread) |
| Primary (кнопки) | `#3b5fd6`, hover `#3350bd` / `#3453bd`; ссылки/иконки `#4d7cfe`, hover `#3a63d4` |
| Selected chip | bg `#eef3ff`, border `#9db8f5`, text `#2c4a9e`; light `#e2ebff`, `#d8e3ff` |
| Success | `#0f9d6b` (text), `#e4f6ee` (bg), `#22c15e` (тумблер/метка new), `#2f9e5b`, `#e7f6ec`, `#1ba851` (WhatsApp hover) |
| Warning | `#c98d00`, `#f0ad00` (резерв), bg `#fdf5df`, `#a17102`, `#b96b00`, `#9a7100` |
| Danger | `#e5484d`, bg `#fdecec`, `#c73a3f`, `#f6c9cb` |
| Purple | `#7b4fd0`, bg `#efe7fb`, `#6d3fd8`, `#f1ebff`, `#8b5cf6` |
| Логотип | `#61E261` (зелёный) |
| Мессенджеры | WhatsApp `#1ba851`, Telegram `#1b86ba`/`#229ed9`, Viber `#7360f2`/`#5f4cdd`, MAX `#7b4fd0`/`#6a3fbd`, WeChat `#07c160`/`#06a854` |
| Карта | пин `#14243f`, границы `#1f3a63`, заливка `#3b5fd6`, хороплет `#5f7355` / `#b8bfc9` / `#e3e6ea`, точки sold `#8a93a2`, reserved `#f0ad00` |
| Тёмные панели (selbar, demo) | `#14243f`, `#2a3a58`, `#8fa0bd`, `#37496b` |

### 5.3 Радиусы
10 px (инпуты, кнопки, пункты меню — самый частый), 16 px (карточки, модалки), 12 px, 9 px, 11 px, 8 px (бейджи), 18–20 px (чипы-пиллы, большие модалки), 14 px (пузыри чата), 7 px (мини-бейджи), 50 % (аватары/точки); bottom-sheet `18px 18px 0 0`.

### 5.4 Тени
`0 1px 3px rgba(20,36,63,.05)` (карточки/сегменты), `0 1px 3px rgba(20,36,63,.12)` (активный сегмент), `0 4px 14px rgba(20,36,63,.18)` (плавающие кнопки на фото), `0 12px 32px rgba(20,36,63,.10)` (hover карточки), `0 18px 50px rgba(20,36,63,.16)` (дропдаун-панели), `0 30px 80px rgba(0,0,0,.4)` / `rgba(10,16,28,.35)` (модалки), `0 -8px 30px rgba(20,36,63,.16)` (нижняя панель), `0 6px 16px rgba(77,124,254,.22)` (primary CTA), `0 14px 38px rgba(20,36,63,.24)` (тултип карты), `0 10px 28px rgba(20,36,63,.14)` (прилипший фильтр-бар).

### 5.5 Размеры и сетка
- Контент: `max-width:1220px; padding:26px clamp(14px,4vw,28px) 110px` (мобайл: `76px 8px 110px`).
- Топбар: `min-height:62px`, `padding:8px clamp(14px,4vw,28px)`, sticky (мобайл fixed), z 100.
- Карточки каталога: `grid-template-columns:repeat(auto-fill,minmax(340px,1fr)); gap:16px`; фото 210 px; кнопки на фото 31×31, radius 9.
- Страница объекта/проекта: `grid-template-columns:minmax(0,1fr) 360px; gap:20px` (761–1080 px: `312px`, gap 16).
- Галерея: `grid 2.2fr 1fr / 1fr 1fr; gap 8px; height clamp(300px,40vw,500px)`; миниатюры 88×62 (объект) / 76×56 (клиент, проект).
- Чат: `height:calc(100vh - 250px); min-height:460px`, пузырь `max-width:72%`.
- Гео-пикер: 520 px × `min(620px,86vh)`.
- Панели фильтров: 340 / 480 (все комнаты) / 560 (особенности) px; «Ещё» — `min(96vw,980px)`, `max-height:90vh`; новостройки — 430 px.
- Превью формы: fixed при ≥1500 px, `left:calc(50% + 428px); top:130px; width:302px`.
- Тумблеры 40×24 (кноб 18), 2FA 44×26.
- Таблица квартир: `52px 44px 54px 110px 1fr 1fr 1.3fr 96px`.

### 5.6 Брейкпоинты (`@media`, строки 28–66, 68–121)
- `≤760px` — мобайл: скрыть nav-items/lang/имя, показать кебаб; топбар fixed; модалки `[data-sheet]`, `[data-f-sheet]`, `[data-unit-sheet]`, `[data-geo-panel]` → bottom-sheet; галерея одна колонка `min(64vw,380px)`; скрыть `[data-viewsw]`, `[data-fmore]`, `[data-fdesk]`, `[data-gal-arr]`, `[data-sort-label]`; показать `[data-view-fab]`, `[data-mob-more]`, `[data-mob-panel]`; чат в один столбец; таблица квартир в «карточки» (`[data-urow]` flex с `order`).
- `≤820px` — `[data-obj-cols]`/чат в одну колонку, показать `[data-obj-bar]`, `[data-demo]` выше.
- `≤900px` — скрыть подписи nav (`[data-nav-label]`), `[data-brand-tag]`.
- `≤979px` — скрыть `[data-fext]` (пилла «Мебель»).
- `761–1080px` — узкая правая колонка 312 px, unit-sheet 740 px.
- `≥761px` — прилипший фильтр-бар на всю ширину (`[data-fsticky][data-stuck="1"]`).
- `≥1500px` — фиксированное превью формы; `≤1499px` — FAB превью.

### 5.7 Z-index
топбар 100; панели фильтров 150–190; dim «Ещё» 335, панель 340–341; клиентский вид 350; лайтбоксы/шторки 400–420; чат мобайл 640; 600–800 — стек модалок поверх. Leaflet ограничен `z-index:400` для контролов и `isolation:isolate`.

### 5.8 `data-*` атрибуты (для адаптива и JS-хуков)
`data-topbar, data-hdr-hidden, data-nav-item, data-nav-label, data-lang-sw, data-prof-name, data-kebab, data-kebab-menu, data-kebab-rows, data-kebab-lang, data-fsticky, data-stuck, data-fbar, data-fbar-scroll, data-fmore, data-fgeo, data-fbtn, data-fext, data-mob-more, data-viewsw, data-view-fab, data-f-dim, data-f-sheet, data-sheet-tall, data-mob-panel, data-sort-label, data-more-label, data-grid-sentinel, data-card, data-card-pad, data-obj-cols, data-obj-side, data-obj-bar, data-gal, data-gal-side, data-gal-thumbs, data-gal-arr, data-strip, data-aprev, data-aprev-fab, data-nb-cols, data-nb-side, data-nb-card, data-nb-chips, data-nb-mosaic, data-nb-morebody, data-nb-foot, data-unit-sheet, data-unit-cols, data-unit-tbl, data-umin, data-uhead, data-urow, data-u, data-uphoto, data-ubtns, data-chat-hdr, data-chat-msgs, data-chat-input, data-chat-list, data-chat-win, data-cli-wrap, data-geo-panel, data-sheet, data-demo, data-screen-label, data-fade`.

---

## 6. i18n — структура `this.T` (2380–2473)

| Язык | Начало | Конец | Примечание |
|---|---|---|---|
| `RU` | 2381 (`RU:{`) — 2382 первая секция `common` | 2409 (`prof`), 2410 `},` | 679 листовых ключей |
| `EN` | 2411 (`EN:{`) — 2412 `common` | 2440 (`prof`), 2441 `},` | 670 ключей |
| `TR` | 2442 (`TR:{`) — 2443 `common` | 2471 (`prof`), 2472 `}` | 670 ключей |

Каждая секция — одна строка вида `<key>:{…},` (строки 2402, 2408, 2409 длиннее 3 500 символов). Объект — JS-литерал с одинарными кавычками (не JSON); для извлечения достаточно токенизатора строк/скобок (в `docs`-скрипте выше это сделано на Python).

Верхнеуровневые ключи RU (в порядке файла) и их вложенность:

| Ключ | Кол-во | Листовые ключи | Вложенные |
|---|---|---|---|
| `common` | 9 | badge, tag, demo, cancel, back, menu, contact, yes, no | |
| `geo` | 15 | loc, all, il, ilce, semt, whole, show, obj, pick, wholeSub, search, next, semtT, addEmpty, pickIl | |
| `fav` | 3 | title, sub, empty | |
| `nav` | 8 | cat, mine, sels, rls, chat, ntf, reqs, favs | |
| `stt` | 4 | active, reserved, sold, off | |
| `deal` | 4 | sale, rent, daily, transfer | |
| `typ` | 5 | flat, house, comm, land, other | |
| `furn` | 2 | yes, no | |
| `heatL` | 5 | none, kombi, central, ac, floor | |
| `bil` | 14 | title, sub, activeTo, plan, mo, perMo, total, save, pay, payT, lock, histT, paid, inv | |
| `api` | 10 | title, sub, keyL, epT, exT, ep1–ep4, cta | |
| `newb` | 33 | resale, title, sub, q, from, dlv, dev, soon, keysT, salesT, instB, dlvT, unitsT, flT, blT, plansT, shaftT, listT, stFree, stRes, stSold, descT, locT, diaryT, docsT, dlB, infraT, fromM, reqB, flr | `salesL{none,start,open,sold}`, `keysL{not,started,done}`, `cats{all,ext,int,soc,pool,spa,kids,park}` |
| `par` | 14 | no, created, upd, floor, age, bath, heat, balc, furnL, aidat, sea, dep, m, km | |
| `ext` | 19 | usageTH, imarT, tapuT, commT, kiraciB, devirB, usageT, siteB, cepheT, creditB, takasB, emsalP, adaP, gardenP | `imarL{konut,ticari,tarla,imarsiz}`, `tapuL{mustakil,hisseli,mulkiyet,irtifak}`, `commL{shop,office,depot,rest}`, `usageL{empty,owner,tenant}`, `cepheL{guney,kuzey,dogu,bati}` |
| `feat` | 19 | pool, ipool, opark, upark, play, gym, cctv, sec, sauna, hamam, gen, gazebo, bbq, tennis, basket, depot, shut, terr, sea | |
| `reqs` | 39 | pinT, openObj, newAlg, tabMine, tabFeed, pub, pubOn, yourReq, unpubB, newReq, budgetL, whereL, commentL, featsL, fFurn, fSea, fFirst, commPh, pubGo, nrNote, nrDone, noMatch, offMsg, youHave, offer, offered, areaMine, areaAll, offerT, expIn, d, feedNote, title, sub, match, newN, open, empty, note | |
| `exp` | 13 | apiMore, apiT, apiSub, apiS, liveB, soonB, soonS, soonT, t, s, on, off, note | |
| `login` | 25 | regCapL, regCapErr, regRate, forgot, fpwT, fpwS, fpwB, fpwDoneT, fpwDoneS, fpwBack, regB, regT, regS, regPhoneH, regPhoneErr, regDup, regGo, regDoneT, regDoneS, title, sub, email, pass, btn, invite | |
| `cat` | 77 | ssT, ssH, profBack, profObjs, title, sub, hint, from, to, found, rls, sortNew, sortCheap, sortExp, empty, fav, saveSearch, reset, loading, dealT, typeT, typeB, priceB, priceT, areaB, areaT, grossL, netL, roomsB, roomsT, furnB, furnT, featB, featT, sortT, anyL, resetBtn, fromS, toS, moreB, moreT, roomsAll, roomsBasic, quickT, vnjB, dropB, balcB, floorT, bfT, ageT, bathT, heatT, aidatB, aidatT, seaB, seaT, depB, depT, notFirst, notLast, sea300, sea1, sea3, sea5, sea5p, plotL, vnjChip, citChip, perMo, perDay, savedOk, list, map, mapUp, legend, mapHint | `cities{'',antalya,alanya,belek}` |
| `mine` | 3 | title, sub, add | |
| `add` | 70 | badgeL, badgeNone, badgeHint, title, sub, city, district, rooms, area, floor, price, comm, commH, base, desc, descPh, tr, trDone, ai, publish, photos, photoPh, dealL, typeL, floorsL, flagsL, upT, upS, cover, reorder, titleL, titlePh, yearL, liftL, gasL, own5L, linkL, linkPh, findL, prevL, pinL, pinH, foundL, reqMiss, linkBad, genT, progL, secMain, secLoc, secPar, secFin, yr0–yr3, draftB, draftSaved, draftRow, draftGo, editB, savedEdit, pubT, pubS, pubView, pubSel, pubMine, dupAsk, dupT, dupS, dupOpen | |
| `obj` | 40 | rptB, rptT, rptS, rptSend, rptDone, rptPh, allObjs, mineTag, comm, chat, addSel, inSel, aiFrom, st, ph, dropped, commShort, keyT, inT, infraT, descT, locT, typeT, dealT, dealSale, statusT, realtorT, callL, similarT, rate, roomsL, grossL, yearL, bathsL, floorL, kindHouse, kindFlat | `rptR{stale,sold,price,dup,other}`, `fe[6]`, `inf[10]` (массивы, не используются в коде) |
| `sel` | 46 | title, sub, new, stT, stS, stV, stL, draft, sent, viewed, open, link, copied, edit, del, forP, objs, views, mTitle, mEdit, selN, fT, fTPh, fN, fNn, fNPh, fM, fMn, fMPh, fC, fCn, cmtPh, create, save, done, copy, asClient, minOne, editHint, delDone, clear, inSel, inSelBar, createBar, saveBar | `chips[5]` |
| `cli` | 14 | updL, likedL, toSel, callB, bar, back, role, ttl, n, like, maybe, no, likeT, note | |
| `chat` | 13 | readT, dlvT, search, notFound, title, sub, trOn, trOff, orig, ai, ph, online, ls | |
| `ntf` | 5 | title, mark, all, today, yest | |
| `rl` | 78 | tabR, rpNew, rpDone, rpDoneB, rpReopen, rpEmpty, rpSub, paidToL, payOk, paySoon, payExp, agDupName, agDupPhone, agDupLic, addB, agAddT, agEditT, agAddrL, agLicL, agScanL, agScanB, agSaved, agDataB, agNoMeta, mailErr, rlSearch, tabP, tabA, agBack, agEmpty, agDirT, agCnt, agSave, agAdd, agNewPh, agDelH, agDone, agDup, agSearch, agFree, agWrite, adminEditN, editB, editT, editSave, editDone, agL, reqErr, dupMail, dupPhone, title, sub, inv, stT, stA, stP, stI, objs, sels, likes, la, act, pau, pen, pause, resume, ok, no, mT, mS, email, send, or, copy, copied, sent, apprT, declT | |
| `prof` | 59 | pwGenB, pwErr, tfaGet, tfaT, tfaS, tfaQr, agLock, mailLock, areasL, areasS, title, sub, name, ag, phone, save, saved, out, mail, ch, chSub, call, always, byPhone, byLogin, notFound, found, notF, demo, optLogin, optLoginH, optDoneH, loginH, addLogin, manualH, add, sees, warnNone, sec, pass, chg, oldP, newP, confP, upd, pwDone, check, checking, checkH, checkDone, mxAdd, mxManualH, byId, wcAdd, wcH, byHand, foundBy, badPhone, chOk | |

Расхождения между языками: в EN и TR ключи деталей новостройки (blT, cats, descT, diaryT, dlB, dlvT, docsT, flT, flr, fromM, infraT, instB, keysL, keysT, listT, locT, plansT, reqB, salesL, salesT, shaftT, stFree, stRes, stSold, unitsT) вынесены в отдельную секцию `newb2`, а в RU лежат внутри `newb`; код объединяет их `Object.assign({}, t.newb, t.newb2||{})` (3953). Остальные ключи совпадают. Кроме `T`, в `renderVals` много инлайн-тернариев `lang==='RU'?…:lang==='TR'?…:…` (например, «Показать ещё», статусы квартир `V2`, черновики, «проектов») — их тоже нужно вынести в словарь.

---

## 7. Внешние зависимости

| Что | URL / источник | Где |
|---|---|---|
| Шрифт Inter | `https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap` | 12 |
| Иконки | Tabler Icons webfont 3.19.0 — `https://cdn.jsdelivr.net/npm/@tabler/icons-webfont@3.19.0/dist/tabler-icons.min.css` (классы `ti ti-*`) | 13 |
| Карты | Leaflet 1.9.4 — `https://unpkg.com/leaflet@1.9.4/dist/leaflet.css`, `…/leaflet.js` | 14–15 |
| Тайлы | CARTO Voyager `https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png` | 2596, 2633, 2660, 2702, 2750 |
| Геокодинг | Nominatim: `https://nominatim.openstreetmap.org/reverse?format=json&accept-language=tr&lat=&lon=` (2673); `…/search?format=json&limit=1&q=` (2718); `…/search?format=json&polygon_geojson=1&polygon_threshold=0.0005|0.002&limit=5&q=` (2781, 2850) | |
| GeoJSON провинций | `https://raw.githubusercontent.com/alpers/Turkey-Maps-GeoJSON/master/tr-cities.json`, fallback `https://raw.githubusercontent.com/cihadturhan/tr-geojson/master/geo/tr-cities-utf8.json` | 2814 |
| Фото объектов | Unsplash `https://images.unsplash.com/photo-<id>?w=600&h=380&fit=crop` (массивы `IMG` 2185–2191, `LIMG` 2277, `CIMG` 2281; лайтбокс заменяет на `w=1600&h=1000`); заглушка `NOPH` — inline SVG data-URI (2351) | |
| Фото новостроек | переиспользуют фото вторички (`REAL`, 3301) | |
| Ссылки | App Store / Google Play Google Authenticator (1519–1520) | |
| Рантайм прототипа | `./support.js?v=2`, `image-slot.js` — не переносятся | 6, 16 |
| Локальные папки с реальными фото/данными | в `One-Plan приложение/`: `akropolis-*`, `avocado-*`, `megapolis-*`, `diamond-*`, `richmond`, `allure`, `uploads`, `handoff`, `screenshots` — в этом прототипе **не используются** (все картинки Unsplash) | |

---

## 8. Открытые вопросы (мок / неясно для бэкенда)

1. **Аутентификация**: `doLogin` не проверяет пароль; заявка на доступ, восстановление пароля, 2FA (ключ и QR) — чисто визуальные. Нужны: Supabase Auth (email+пароль), инвайты по ссылке `/join/<code>` и по email, модерация заявок админом, TOTP 2FA.
2. **Роли**: только `realtor`/`admin`. Роли «владелец агентства» нет — уточнить, нужна ли (управление своими риэлторами, общая подписка).
3. **Валюты**: все цены нормализованы в TRY с захардкоженными курсами (48 / 43.2); в форме есть `aCur`, но объект после публикации всё равно хранит `cur` из формы без конвертации (3663) — несогласованно. Нужен реальный курс ЦБ ТР и хранение оригинальной валюты.
4. **ИИ-перевод**: описания (`doTranslate` подставляет `DESCS[1]`), чат (`tx` одинаков на всех языках), пометка «переведено ИИ» — заглушки. Нужен сервис перевода + хранение оригинала/языка (`base`, `m.lang`).
5. **Подборки**: ссылка формируется двумя разными способами (`<ID>7F` vs `slice(-6)`); клиентский вид — оверлей внутри приложения, а не публичная страница; статусы `sent/viewed`, `views`, `liked` — моки. Нужны публичные страницы `/s/<slug>`, трекинг просмотров/реакций, привязка к клиенту.
6. **Сохранённые поиски**: сохраняются только 6 параметров (гео, цена, комнаты), `newN` — мок. Нужен полный набор фильтров и фоновый подсчёт новых объектов + уведомления.
7. **Запросы базы**: `days` — статика, автоудаление через 30 дней не реализовано; «Предложить объект» просто пишет в чат.
8. **Чат**: нет реального времени, статусов доставки/прочтения (эвристика по `ts`), непрочитанные — только `d3`; поддержка — отдельный «диалог» `dsup`; для застройщика ищется несуществующий `who==='support'`.
9. **Уведомления**: статический список; нет генерации событий (цена/статус в избранном, совпадения, лайки, заявки).
10. **Экспорт в порталы / API**: тумблеры хранятся в `expMap` только в state; API-ключ `opl_live_7f3k9q2m`, эндпоинты и вебхуки — текст. XML-фид «раз в 15 минут» и совместимость с Hepsiemlak/Emlakjet требуют отдельного ТЗ.
11. **Подписка**: даты, тарифы, история — хардкод; «Оплатить» → toast. Нужен платёжный провайдер, `paidTo` у участника, блокировка доступа при просрочке (текст `t.bil.lock`).
12. **Гео**: справочник неполный (10 провинций с районами, 71 без), ключи `z…` создаются на лету из Nominatim; полигоны районов/махалле тянутся с Nominatim в рантайме (rate-limit, нестабильно) и подменяются синтетическими «блобами»; объекты «прилипают» к центроидам. Для прода нужен собственный справочник İl/İlçe/Mahalle с геометрией (например, из OSM/TÜİK) и хранение точных координат.
13. **Фото**: dataURL в state, до 20; заглушки Unsplash. Нужен Supabase Storage, ресайз, обложка, порядок.
14. **Мессенджеры в профиле**: «поиск по номеру» (WhatsApp/Telegram/Viber/MAX) — имитация 900 мс; все кнопки каналов без ссылок (`wa.me`, `t.me`, `viber://`).
15. **Новостройки**: примечание в UI — «данные синхронизируются с OnePlan V2»; в прототипе `NEWB` и `unitList` генерируются; ключи `feats` (`fit, cam, ter, gaz, ten`) не совпадают со словарём `t.feat` и теряются; «Запросить условия» и документы — заглушки. Нужен контракт с V2 (проекты, планировки, шахматка, дневник, документы).
16. **Жалобы**: только state; при «Открыть объявление» из жалобы ставится `objModal`, но `screen` не меняется (4155) — вероятная ошибка прототипа.
17. **Дубликаты**: эвристика (ilçe + комнаты + цена ±12 %) — уточнить правила и хранение решения «не дубль».
18. **Черновики/автосейв**: localStorage; в проде — таблица `listing_drafts`.
19. **Комиссия партнёру** (`comm`, prop `showCommission`): видна всем риэлторам — подтвердить политику.
20. **Дата «сегодня»** в прототипе зафиксирована как 24.08.2026 (расчёты `created`, `paidTo` статусов, `reports.date`) — в проде заменить на серверное время.
21. **Неиспользуемые/висячие элементы**: `fCity`/`cityOpts`, `aCurBtns`, `aComm` (bind есть, поля в разметке нет), `t.obj.fe/inf`, `deal:'transfer'`, `typ:'other'`, `newb.shaftT` («Шахматка» — в UI только «Списком»), `hint-placeholder-*` атрибуты рантайма.
