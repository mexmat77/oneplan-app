import { ImageResponse } from "next/og";
import { fmtPrice, loadPublicListing } from "@/lib/listingPublic";
import { ogFonts } from "@/lib/ogFonts";

// OG-картинка объекта (16.10.2026): обложка, цена, параметры, район, риэлтор — тот же стиль, что у подборок.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Объект OnePlan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const site = process.env.NEXT_PUBLIC_SITE_URL || "https://one-plan.pro";
  let o: Awaited<ReturnType<typeof loadPublicListing>> = null;
  try { o = await loadPublicListing(id); } catch (e) { console.error("[og] listing", (e as Error).stack); }
  const fs = await ogFonts(site);
  const photos = (o?.photos ?? []).slice(0, 3).map((u) => (u.startsWith("http") ? u : `${site}${u.startsWith("/") ? "" : "/"}${u}`));
  const title = o?.title || "OnePlan — закрытая база риэлторов";
  const meta = o ? [o.rooms, o.area ? `${o.area} м²` : "", o.place].filter(Boolean).join(" · ") : "";
  return new ImageResponse(
    (
      <div style={{ width: 1200, height: 630, display: "flex", background: "#0f1a2e", fontFamily: fs.length ? "Manrope" : "sans-serif", color: "#fff", position: "relative" }}>
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
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, display: "flex", flexDirection: "column", gap: 12, padding: "26px 56px 40px", backgroundColor: "#0f1a2e" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <img alt="" src={`${site}/logo.png`} width={40} height={40} />
            <span style={{ fontSize: 28, fontWeight: 800, letterSpacing: -0.5 }}>OnePlan</span>
            {o?.realtor && <span style={{ fontSize: 22, fontWeight: 500, color: "#b7c3da" }}>· {o.realtor}{o.agency ? ` · ${o.agency}` : ""}</span>}
          </div>
          <div style={{ fontSize: 50, fontWeight: 800, lineHeight: 1.1, letterSpacing: -1 }}>{title}</div>
          {o && (
            <div style={{ display: "flex", flexWrap: "wrap", gap: 10, fontSize: 26, fontWeight: 500, color: "#dfe6f3" }}>
              <span style={{ display: "flex", backgroundColor: "#4d7cfe", borderRadius: 12, padding: "6px 16px", color: "#fff", fontWeight: 800 }}>{fmtPrice(o.price, o.cur)}</span>
              {meta && <span style={{ display: "flex", backgroundColor: "rgba(255,255,255,0.14)", borderRadius: 12, padding: "6px 16px" }}>{meta}</span>}
            </div>
          )}
        </div>
      </div>
    ),
    { ...size, fonts: fs.map((f) => ({ name: f.name, data: f.data, weight: f.weight, style: "normal" as const })) },
  );
}
