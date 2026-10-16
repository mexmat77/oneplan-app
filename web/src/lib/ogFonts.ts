import "server-only";

// Шрифты для OG-картинок (Manrope 500/800, кириллица) — public/fonts/*.woff с диска, запасной путь — по URL сайта; кэш в процессе.
let fontsP: Promise<{ name: string; data: ArrayBuffer; weight: 500 | 800 }[]> | null = null;
export async function ogFonts(site: string) {
  if (!fontsP) fontsP = (async () => {
    const out: { name: string; data: ArrayBuffer; weight: 500 | 800 }[] = [];
    for (const w of [500, 800] as const) {
      try {
        const [{ readFile }, path] = await Promise.all([import("node:fs/promises"), import("node:path")]);
        const buf = await readFile(path.join(process.cwd(), "public", "fonts", `manrope-${w}.woff`));
        out.push({ name: "Manrope", data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer, weight: w });
      } catch {
        try { out.push({ name: "Manrope", data: await fetch(`${site}/fonts/manrope-${w}.woff`).then((r) => r.arrayBuffer()), weight: w }); } catch { /* без шрифта картинка не соберётся */ }
      }
    }
    if (!out.length) fontsP = null;
    return out;
  })();
  return fontsP;
}
