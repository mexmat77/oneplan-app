// Тач-устройство (телефон/планшет без наведения). Единая точка: клавиатура на телефоне не должна выскакивать сама —
// автофокус полей поиска и первых полей форм только на компьютере (правило пользователя 18.10.2026).
export const isTouch = () => typeof window !== "undefined" && !!window.matchMedia && window.matchMedia("(hover: none)").matches;
/** `autoFocus={kbAutoFocus()}` — фокус (и клавиатура) сами появляются только там, где есть мышь. */
export const kbAutoFocus = () => !isTouch();
