// Пилюли панели фильтров (прототип `pillF`) — общие для вторички (`FilterBar`) и новостроек (`NbCatalog`).
// Выбранный фильтр заметно отличается от пустого: голубая заливка, синяя внутренняя обводка, жирный синий текст
// (замечание пользователя 10.10.2026: «не сразу понял, почему 2 объявления — выбранные параметры не отличаются»).
const ON = "mx-[2px] rounded-[10px] bg-blue-tint font-bold shadow-[inset_0_0_0_1.5px_var(--sel-line)] hover:bg-[#e4ecff]";

/** Пилюля быстрого фильтра: `on` — значение выбрано, `open` — её панель раскрыта. */
export const fpill = (on: boolean, open: boolean) =>
  `inline-flex max-w-[230px] shrink-0 cursor-pointer items-center gap-[6px] overflow-hidden text-ellipsis whitespace-nowrap px-[15px] py-3 text-[13px] ${on ? ON : "border-r border-line-4 font-semibold hover:bg-bg-3"} ${open ? "text-blue-2" : on ? "text-sel-ink" : "text-ink"}`;

/** Кнопка «Расположение» в закреплённой панели (с иконкой-булавкой): `on` — выбрана провинция/район/махалле. */
export const fgeo = (on: boolean) =>
  `relative min-w-[170px] max-w-[300px] flex-1 cursor-pointer truncate py-3 pl-9 pr-[30px] text-left text-[13px] ${on ? `${ON} text-sel-ink` : "rounded-l-[10px] border-r border-line-4 font-bold text-ink hover:bg-bg-3"}`;

/** Та же кнопка в раскрытой панели/шторке (с рамкой). */
export const fgeoBox = (on: boolean) =>
  `relative cursor-pointer truncate rounded-[10px] border py-[10px] pl-[34px] pr-[30px] text-left text-[13px] ${on ? "border-sel-line bg-blue-tint font-bold text-sel-ink" : "border-line font-semibold text-ink hover:border-blue"}`;

/** Цвет иконки (булавка, шеврон) внутри выбранной/пустой пилюли. */
export const ficon = (on: boolean) => (on ? "text-sel-ink" : "text-muted");
