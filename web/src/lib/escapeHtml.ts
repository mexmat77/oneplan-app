// Экранирование для HTML-строк, которые Leaflet вставляет как innerHTML (подсказки пинов карты).
// 23.10.2026, аудит: заголовок объявления шёл в tooltip без экранирования — stored XSS от любого риэлтора.
export const escapeHtml = (s: unknown): string =>
  String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

/** Для подстановки в url('…') внутри style: оставляем только безопасные URL (http(s)/data:image/относительные). */
export const safeCssUrl = (s: unknown): string => {
  const u = String(s ?? "");
  if (!/^(https?:\/\/|data:image\/|\/)/i.test(u)) return "";
  return u.replace(/['"()\\\s]/g, "");
};
