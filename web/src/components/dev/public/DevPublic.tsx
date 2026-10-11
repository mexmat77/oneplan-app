"use client";

// Public developer page `/d/[slug]` — prototype `OnePlan v2.dc.html` lines 1268–1317 (`isDev`), data 4140–4143, spec §1.18.
// Sticky 60px header (initials, name, «N проектов · city», languages, WhatsApp, back), hero gradient with contacts
// (from company requisites `phone/mail/web/addr` — the prototype hard-coded them), grid of visible projects, footer.
import { displayLoc } from "@/lib/dev/geo";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { IconArrowBackUp, IconArrowRight, IconEyeOff, IconMail, IconMapPin, IconPhone, IconWorld } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { STAGECOLOR, slugOf } from "@/lib/dev/data";
import { useDev } from "@/store/dev";
import { buildProjectsV2, OCC_CHIP, SALES_CHIP, type ProjectView } from "@/components/dev/objects/projectView";
import { LiveModal } from "@/components/dev/media/LiveModal";
import { LangSwitch, PubFooter, WaButton, useLegal } from "./shared";

const chip = (bg: string, fg: string) => ({ fontSize: 10, fontWeight: 700, padding: "3px 8px", borderRadius: 20, whiteSpace: "nowrap" as const, background: bg, color: fg });

export function DevPublic({ slug }: { slug: string }) {
  const { t } = useDevT();
  const s = useDev();
  const router = useRouter();
  const legal = useLegal();
  const [live, setLive] = useState<ProjectView | null>(null);
  const co = s.companies.find((c) => slugOf(c.name) === slug);
  const sales = t.sales as Record<string, string>;

  const header = (name: string, initials: string, count: number, phone?: string) => (
    <div className="sticky top-0 z-[60] flex h-[60px] items-center gap-3 border-b border-line bg-[rgba(255,255,255,.95)] px-[clamp(16px,5vw,40px)] backdrop-blur-[8px]">
      <div className="flex h-9 w-9 flex-none items-center justify-center rounded-[10px] bg-ink text-[13px] font-extrabold text-white">{initials}</div>
      <div className="min-w-0"><div className="whitespace-nowrap text-[15px] font-extrabold text-ink">{name}</div><div className="whitespace-nowrap text-[11px] text-text-2">{count} {t.dev.projects_count} · {t.px.city}</div></div>
      <div className="flex-1" />
      <LangSwitch />
      <WaButton phone={phone} />
      <span onClick={() => router.push("/dev/objects")} title={t.pub.back} className="flex h-[34px] w-[34px] flex-none cursor-pointer items-center justify-center rounded-[9px] border border-line text-muted hover:text-ink"><IconArrowBackUp size={17} /></span>
    </div>
  );

  if (!co) {
    return (
      <div className="min-h-screen bg-surface">
        {header(slug, "?", 0)}
        <div className="flex min-h-[60vh] items-center justify-center p-[30px]">
          <div className="max-w-[420px] text-center">
            <div className="mx-auto mb-[18px] flex h-[74px] w-[74px] items-center justify-center rounded-[22px] bg-[#eef0f4] text-[34px] text-muted"><IconEyeOff size={34} /></div>
            <div className="text-[22px] font-extrabold text-ink">{t.px.dev_not_found}</div>
          </div>
        </div>
        <PubFooter onLegal={legal.open} />
        {legal.node}
      </div>
    );
  }

  const all = buildProjectsV2(s.projects, s.units, s.companies, t);
  const projects = all.filter((p) => p.client === co.name && !p.isHidden && !p.cabHidden);
  const initials = co.name.split(/\s+/).map((w) => w[0] || "").join("").slice(0, 2).toUpperCase();
  const contacts: { icon: React.ReactNode; label: string; value: string }[] = [];
  if (co.phone) contacts.push({ icon: <IconPhone size={16} />, label: t.dev.phone, value: co.phone });
  if (co.mail) contacts.push({ icon: <IconMail size={16} />, label: t.dev.email, value: co.mail });
  if (co.web) contacts.push({ icon: <IconWorld size={16} />, label: t.px.web, value: co.web });
  if (co.addr) contacts.push({ icon: <IconMapPin size={16} />, label: t.dev.address, value: co.addr });

  return (
    <div className="min-h-screen bg-surface">
      {header(co.name, initials, projects.length, co.phone)}

      <div className="bg-[linear-gradient(135deg,#14243f,#1e3a63)] px-[clamp(16px,5vw,40px)] py-[clamp(30px,5vw,56px)]">
        <div className="mx-auto max-w-[1280px]">
          <h1 className="mb-[6px] text-[clamp(26px,4vw,40px)] font-extrabold tracking-[-.02em] text-white">{t.dev.all}</h1>
          <div className="mb-5 text-[14px] text-[#9fb0cc]">{co.name} · {projects.length} {t.dev.projects_count}</div>
          <div className="flex flex-wrap gap-[10px]">
            {contacts.map((c) => (
              <div key={c.label} className="flex items-center gap-[9px] rounded-[11px] bg-[rgba(255,255,255,.09)] px-[14px] py-[9px]">
                <span className="text-[#8fb0e8]">{c.icon}</span>
                <div><div className="text-[10px] uppercase tracking-[.04em] text-[#9fb0cc]">{c.label}</div><div className="whitespace-nowrap text-[13px] font-semibold text-white">{c.value}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-[1280px] px-[clamp(16px,5vw,40px)] pb-[60px] pt-7">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))] gap-[18px]">
          {projects.map((p) => {
            const salesKey = p.salesSt || "open";
            const occKey = p.occSt || "none";
            return (
              <div key={p.id} onClick={() => router.push(`/p/${slugOf(p.name)}`)} className="flex cursor-pointer flex-col overflow-hidden rounded-[16px] border border-line bg-surface transition-[box-shadow,transform] hover:-translate-y-[2px] hover:shadow-[0_12px_30px_rgba(20,36,63,.12)]">
                <div className="relative h-[150px] bg-[#e7eaf0]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {p.coverUrl && <img src={p.coverUrl} alt="" loading="lazy" className="h-full w-full object-cover" />}
                  <span className="absolute left-[10px] top-[10px] whitespace-nowrap rounded-[20px] px-[10px] py-1 text-[11px] font-bold text-white" style={{ background: STAGECOLOR[p.stage] || "#14243f" }}>{p.stageLabel}</span>
                  {p.hasLive && (
                    <span onClick={(e) => { e.stopPropagation(); setLive(p); }} className="absolute right-[10px] top-[10px] inline-flex cursor-pointer items-center gap-[5px] rounded-[20px] bg-red px-[9px] py-1 text-[10px] font-extrabold text-white shadow-[0_3px_10px_rgba(229,72,77,.45)]"><span className="h-[6px] w-[6px] rounded-full bg-white" style={{ animation: "oplPulse 1.6s infinite" }} />{t.dx.live}</span>
                  )}
                  {p.hasIskan && <span className="absolute bottom-[10px] left-[10px] whitespace-nowrap rounded-[20px] bg-[rgba(15,157,107,.95)] px-[10px] py-1 text-[11px] font-bold text-white">{t.dx.iskan_ok}</span>}
                </div>
                <div className="flex flex-1 flex-col gap-2 px-4 pb-4 pt-[14px]">
                  <div className="text-[16px] font-extrabold leading-[1.2] text-ink">{p.name}</div>
                  <div className="flex items-center gap-[5px] text-[13px] text-text-2"><IconMapPin size={14} /> {displayLoc(p.loc, t.geo.no_addr)}</div>
                  <div className="flex flex-wrap gap-1">
                    <span style={p.iskan ? chip("#e4f6ee", "#0f9d6b") : chip("#eef1f5", "#8a93a2")}>{p.iskan ? t.dx.iskan_ok : t.px.iskan_no}</span>
                    <span style={chip(SALES_CHIP[salesKey][0], SALES_CHIP[salesKey][1])}>{sales[salesKey]}</span>
                    {p.hasOcc && <span style={chip(OCC_CHIP[occKey][0], OCC_CHIP[occKey][1])}>{p.occSt === "full" ? t.occ.chip_full : t.occ.chip_started}</span>}
                  </div>
                  <div className="mt-auto">
                    <div className="mb-1 flex justify-between gap-2 text-[12px] text-text-2"><span className="whitespace-nowrap">{t.dev.ready}</span><span className="whitespace-nowrap font-bold text-green">{p.ready}%</span></div>
                    <div className="h-[6px] rounded-[4px] bg-[#eef0f4]"><div className="h-full rounded-[4px] bg-green" style={{ width: `${p.ready}%` }} /></div>
                  </div>
                  <div className="mt-[2px] flex items-center justify-between gap-2 border-t border-dashed border-line pt-[10px]">
                    <span className="whitespace-nowrap text-[12px] text-muted">{p.free} {t.pub.free_now}</span>
                    <span className="inline-flex items-center gap-[5px] whitespace-nowrap text-[13px] font-bold text-blue">{t.dev.open} <IconArrowRight size={14} /></span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      <PubFooter onLegal={legal.open} />
      {legal.node}
      {live && <LiveModal url={String(live.live)} title={live.name} onClose={() => setLive(null)} />}
    </div>
  );
}
