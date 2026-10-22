// Безопасный адрес «куда вернуть после входа» (23.10.2026, аудит: open redirect через ?next=https://evil.com и //evil.com).
// Принимаем только относительный путь внутри сайта: начинается с одного «/», не с «//» и не с «/\».
export function safeNext(s: string | null | undefined, fallback = "/catalog"): string {
  if (!s) return fallback;
  return /^\/(?![\/\\])/.test(s) ? s : fallback;
}
