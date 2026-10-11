// Phone masks — 1:1 with the prototype (`trPhone` line 3691, `fmtPhone` line 3689, `normPh`).

/** Turkish mobile mask: `+90 5xx xxx xx xx` (max 10 digits after the country code). */
export function trPhone(v: string): string {
  let d = String(v).replace(/\D/g, "");
  if (d.startsWith("90")) d = d.slice(2);
  if (d[0] === "0") d = d.slice(1);
  const i5 = d.indexOf("5");
  d = i5 < 0 ? "" : d.slice(i5);
  d = d.slice(0, 10);
  if (!d) return "+90 ";
  return "+90 " + d.slice(0, 3) + (d.length > 3 ? " " + d.slice(3, 6) : "") + (d.length > 6 ? " " + d.slice(6, 8) : "") + (d.length > 8 ? " " + d.slice(8, 10) : "");
}

/** Generic international mask used for MAX (`+7 …`): `+CC xxx xxx xx xx`. */
export function fmtPhone(v: string): string {
  let d = String(v).replace(/\D/g, "").slice(0, 12);
  if (!d) return "";
  if (d[0] === "8" && d.length >= 11) d = "7" + d.slice(1);
  const cc = d.slice(0, d[0] === "9" ? 2 : 1);
  const rest = d.slice(cc.length);
  const parts = [rest.slice(0, 3), rest.slice(3, 6), rest.slice(6, 8), rest.slice(8, 10)].filter(Boolean);
  return "+" + cc + (parts.length ? " " + parts.join(" ") : "");
}

/** Digits only — for duplicate checks. */
export const normPh = (v: string) => String(v || "").replace(/\D/g, "");

export const validMail = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || "").trim());
