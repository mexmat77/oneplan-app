"use server";

// Превью ссылок OnePlan в чате (16.10.2026, «превьюшка как в WhatsApp, с маленькой фоткой»): только наши ссылки —
// объект `/obj/<uuid>` и подборка `/s/<slug>`; данные те же, что у OG-превью в мессенджерах (lib/listingPublic,
// lib/selectionsPublic). Чужие адреса не запрашиваем (никаких fetch по произвольным URL с сервера).
import { fmtPrice, loadPublicListing } from "@/lib/listingPublic";
import { loadPublicSelection, pickSelectionLang, selectionSummary } from "@/lib/selectionsPublic";

export type LinkPreview = { url: string; title: string; desc: string; img: string | null; kind: "obj" | "sel" };
const HOSTS = new Set(["one-plan.pro", "www.one-plan.pro", "ai.one-plan.pro", "localhost", "localhost:3000"]);

export async function linkPreview(url: string): Promise<LinkPreview | null> {
  let u: URL; try { u = new URL(url); } catch { return null; }
  if (!HOSTS.has(u.host)) return null;
  const obj = u.pathname.match(/^\/obj\/([0-9a-f-]{36})$/i);
  if (obj) {
    const o = await loadPublicListing(obj[1]); if (!o) return null;
    const desc = [o.rooms, o.area ? `${o.area} м²` : "", o.place, o.realtor].filter(Boolean).join(" · ");
    return { url, kind: "obj", title: `${o.title} · ${fmtPrice(o.price, o.cur)}`, desc, img: o.photos[0] ?? null };
  }
  const sel = u.pathname.match(/^\/s\/([A-Za-z0-9-]{1,40})$/);
  if (sel) {
    const d = await loadPublicSelection(sel[1]); if (!d) return null;
    const sum = selectionSummary(d, pickSelectionLang(d));
    return { url, kind: "sel", title: sum.title, desc: [sum.priceTxt, sum.places, sum.realtor].filter(Boolean).join(" · "), img: sum.photos[0] ?? null };
  }
  return null;
}
