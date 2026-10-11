"use client";

// «Экспорт в порталы» — prototype lines 1767–1789 (markup) and 3450–3459 (rows).
// Toggles persist per listing in `expMap` (store), so the badge on the object page
// and on «Мои объекты» cards survives closing the modal. Opened from the object page
// and from `ListingCard` on /mine (prototype `openExp`).
import { useRouter } from "next/navigation";
import { IconApi, IconChevronRight, IconInfoCircle, IconX } from "@tabler/icons-react";
import { useI18n } from "@/i18n/provider";
import { Modal } from "@/components/ui/Modal";
import { showToast } from "@/components/ui/toast";
import { toggleExp, useListingMeta } from "@/store/listings";
import portalsJson from "@/mock/portals.json";

export type Portal = { k: string; name: string; bg: string; akd?: boolean; op?: boolean };
export const PORTALS = portalsJson as Portal[];
export const isLivePortal = (p: Portal) => !!(p.op || p.akd);
/** Number of live portals switched on for a listing (prototype `expActive` / `expN`). */
export const expCount = (pm: Record<string, boolean> | undefined) => PORTALS.filter((p) => isLivePortal(p) && pm?.[p.k]).length;

const OP_LOGO = (
  <svg width="22" height="22" viewBox="60 45 380 370" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M207.972 185.858C200.472 135.358 120.472 171.858 98.9716 190.358C84.4717 202.834 75.0716 211.858 72.4716 227.858C65.9716 267.858 82.1238 285.358 98.9716 297.858C129.972 320.858 180.995 319.858 196.972 289.358C207.972 268.358 217.472 223.858 207.972 185.858Z" fill="#61E261" />
    <path d="M335.972 348.858C294.972 333.858 222.972 330.858 168.472 345.358C148.472 350.679 145.472 372.358 168.472 388.358C205.472 410.358 293.222 409.358 335.972 380.858C350.972 370.858 350.472 354.163 335.972 348.858Z" fill="#FBBB00" />
    <path d="M346.472 318.858C282.472 318.858 273.472 230.858 293.972 119.858C299.143 91.8579 340.472 74.858 381.472 119.858C426.396 169.165 434.472 241.358 405.472 280.858C391.472 299.927 375.472 318.858 346.472 318.858Z" fill="#4F8BF9" />
    <path d="M224.268 57.1437C172.715 68.4983 115.812 100.865 117.509 117.701C118.292 125.924 135.258 131.405 154.313 129.709C189.813 126.446 242.931 102.954 262.638 81.941C268.511 75.6765 268.903 74.7629 268.25 69.9339C266.945 60.276 260.028 55.8386 245.28 55.0555C238.755 54.7945 231.576 55.447 224.268 57.1437Z" fill="#FA0064" />
  </svg>
);
const AKD_LOGO = (
  <svg width="26" height="26" viewBox="0 0 48 48">
    <path d="M8 22.5a16 16 0 0 1 32 0h-8.5a7.5 7.5 0 0 0-15 0Z" fill="#f0862c" />
    <path d="M8.4 26.5h31.2a16 16 0 0 1-31.2 0Z" fill="#2f6fd0" />
    <path d="M9 31c5-3.2 9-1 13.5.6 4.7 1.7 9 2.4 15-1.6" stroke="#fff" strokeWidth="2.4" fill="none" strokeLinecap="round" />
  </svg>
);

const LiveB = ({ label }: { label: string }) => <span className="rounded-[8px] bg-[#e4f6ee] px-[7px] py-[2px] text-[10px] font-extrabold uppercase tracking-[.04em] text-[#0f9d6b]">{label}</span>;

export function ExportModal({ id, open, onClose }: { id: string; open: boolean; onClose: () => void }) {
  const { t } = useI18n();
  const router = useRouter();
  const { expMap } = useListingMeta();
  const pm = expMap[id] || {};
  return (
    <Modal open={open} onClose={onClose} width={460} z={320} overlay={0.55} sheet={false} style={{ maxWidth: "min(460px, 96vw)" }}>
      <div className="mb-[6px] flex items-start gap-[10px]">
        <div className="flex-1 text-[17.5px] font-extrabold text-ink">{t.exp.t}</div>
        <button type="button" onClick={onClose} aria-label="close" className="cursor-pointer p-[2px] text-[#aab1bd] hover:text-ink"><IconX size={22} /></button>
      </div>
      <p className="mb-4 text-[13px] leading-[1.55] text-text-2 [text-wrap:pretty]">{t.exp.s}</p>
      <div className="flex flex-col gap-[9px]">
        {PORTALS.map((p) => {
          const soon = !isLivePortal(p);
          const on = !soon && !!pm[p.k];
          return (
            <div key={p.k} className="flex items-center gap-3 rounded-[12px] border border-line px-[14px] py-3" style={soon ? { opacity: 0.6 } : undefined}>
              <div className="box-border flex h-9 w-9 flex-none items-center justify-center rounded-[9px] text-[13px] font-extrabold text-white" style={{ background: p.bg, border: `1px solid ${isLivePortal(p) ? "#e6e9f0" : p.bg}` }}>
                {p.op ? OP_LOGO : p.akd ? AKD_LOGO : p.name.slice(0, 2).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-[7px] text-[13.5px] font-bold text-ink">
                  {p.name} {soon ? <span className="rounded-[8px] bg-bg-2 px-[7px] py-[2px] text-[10px] font-extrabold uppercase tracking-[.04em] text-muted">{t.exp.soonB}</span> : <LiveB label={t.exp.liveB} />}
                </div>
                <div className="text-[11.5px]" style={{ color: soon ? "#aab1bd" : on ? "#0f9d6b" : "#aab1bd" }}>{soon ? t.exp.soonS : on ? t.exp.on : t.exp.off}</div>
              </div>
              <div
                role="switch"
                aria-checked={on}
                onClick={() => { if (soon) { showToast(t.exp.soonT); return; } toggleExp(id, p.k); }}
                className="relative h-6 w-10 flex-none rounded-[12px] transition-[background] duration-150 hover:brightness-[.96]"
                style={{ cursor: soon ? "not-allowed" : "pointer", background: on ? "#22c15e" : "#d5dce6" }}
              >
                <span className="absolute top-[3px] h-[18px] w-[18px] rounded-full bg-white transition-[left] duration-150" style={{ left: on ? 19 : 3 }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-[14px] flex items-center gap-[10px] border-t border-[#f2f4f8] pt-3">
        <span className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] bg-ink text-[16px] text-white"><IconApi size={16} /></span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-[7px] text-[13.5px] font-bold text-ink">{t.exp.apiT} <LiveB label={t.exp.liveB} /></div>
          <div className="text-[11.5px] text-muted">{t.exp.apiSub}</div>
        </div>
        <button type="button" onClick={() => { onClose(); router.push("/api-access"); window.scrollTo(0, 0); }} className="inline-flex flex-none cursor-pointer items-center gap-1 rounded-[10px] border border-line bg-surface px-[14px] py-[9px] text-[12.5px] font-bold text-ink hover:border-blue hover:text-blue">
          {t.exp.apiMore} <IconChevronRight size={14} />
        </button>
      </div>
      <div className="mt-[14px] flex items-start gap-[9px] rounded-[12px] bg-[#f5f7fb] px-[13px] py-[11px] text-[12px] leading-[1.5] text-text">
        <IconInfoCircle size={15} className="mt-[1px] flex-none text-blue" />
        <span>{t.exp.note}</span>
      </div>
    </Modal>
  );
}
