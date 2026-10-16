import { ImageResponse } from "next/og";
import { loadPublicSelection, pickSelectionLang, selectionSummary } from "@/lib/selectionsPublic";
import { ogFonts } from "@/lib/ogFonts";

// OG-картинка подборки для превью ссылки в Telegram/WhatsApp (13.10.2026): обложка первого объекта, число объектов,
// диапазон цен, районы, риэлтор и агентство, логотип. Шрифт Manrope (кириллица) — с Google Fonts, TTF кэшируется в процессе.
export const runtime = "nodejs";
export const dynamic = "force-dynamic"; // подборка меняется — картинку не кэшировать как статику
export const alt = "Подборка объектов OnePlan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://one-plan.pro";
  let data: Awaited<ReturnType<typeof loadPublicSelection>> = null, sum: ReturnType<typeof selectionSummary> | null = null;
  try { data = await loadPublicSelection(slug); sum = data ? selectionSummary(data, pickSelectionLang(data)) : null; } catch (e) { console.error("[og] selection", (e as Error).stack); }
  const fs = await ogFonts(site);
  const photos = (sum?.photos ?? []).map((u) => (u.startsWith("http") ? u : `${site}${u.startsWith("/") ? "" : "/"}${u}`)); // относительные пути демо-фото → абсолютные
  const title = sum?.title ?? "OnePlan";
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: "#0f1a2e", fontFamily: fs.length ? "Manrope" : "sans-serif", color: "#fff", position: "relative" }}>
        {/* фото: первое — крупно, ещё два — колонкой справа */}
        <div style={{ display: "flex", width: 1200, height: 630, position: "absolute", left: 0, top: 0 }}>
          <div style={{ display: "flex", width: photos.length > 1 ? 800 : 1200, height: 630, overflow: "hidden" }}>
            {photos[0] ? <img alt="" src={photos[0]} width={photos.length > 1 ? 800 : 1200} height={630} style={{ objectFit: "cover", width: "100%", height: "100%" }} /> : <div style={{ width: "100%", height: "100%", background: "linear-gradient(135deg,#1f3a63,#4d7cfe)" }} />}
          </div>
          {photos.length > 1 && (
            <div style={{ display: "flex", flexDirection: "column", width: 400, height: 630 }}>
              {photos.slice(1, 3).map((p, i) => <img key={i} alt="" src={p} width={400} height={photos.length > 2 ? 315 : 630} style={{ objectFit: "cover", width: 400, height: photos.length > 2 ? 315 : 630, borderLeft: "4px solid #0f1a2e", ...(i ? { borderTop: "4px solid #0f1a2e" } : {}) }} />)}
            </div>
          )}
        </div>
        {/* тёмная плашка снизу — текст читается на любом фото */}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", gap: 12, padding: "26px 56px 40px", backgroundColor: "#0f1a2e" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img alt="" src={`${site}/logo.png`} width={40} height={40} />
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>OnePlan</span>
            {sum?.realtor && <span style={{ fontSize: 22, fontWeight: 500, color: "#b7c3da" }}>· {sum.realtor}</span>}
          </div>
          <div style={{ fontSize: 54, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }}>{title}</div>
          {sum && (sum.priceTxt || sum.places) && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 26, fontWeight: 500, color: "#dfe6f3" }}>
              {sum.priceTxt && <span style={{ display: "flex", backgroundColor: "#4d7cfe", borderRadius: 12, padding: "6px 16px", color: "#fff", fontWeight: 800 }}>{sum.priceTxt}</span>}
              {sum.places && <span style={{ display: "flex", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 12, padding: "6px 16px" }}>{sum.places}</span>}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, fonts: fs.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: "normal" as const })) },
  );
}
