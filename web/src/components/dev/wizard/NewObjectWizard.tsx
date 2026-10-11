"use client";

// Мастер «Новый объект» — prototype `OnePlan v2.dc.html` lines 1791–1912 (`isAddObject`), data 3445–3464 and
// 3884–3896. Spec §1.21. Full-screen (z 120) over the cabinet; files picked in the steps are uploaded to
// Supabase Storage (`dev/new/<ts>/photos|plans|files`, see `wizardState.addWzFiles`); on «Создать объект» the
// project is added to the store (`addProject`, id = max + 1, public URLs, cover = first photo, empty grid) and the card opens.
import { IconArrowLeft, IconArrowRight, IconBuildingPlus, IconCheck, IconCloudOff, IconFolder, IconWand } from "@tabler/icons-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useDevT } from "@/i18n/dev";
import { useEscape, useScrollLock } from "@/hooks/useScrollLock";
import { STAGEPCT } from "@/lib/dev/data";
import type { Project, ProjectFile } from "@/lib/dev/types";
import { fileLabel } from "@/lib/upload";
import { isMapLink } from "@/lib/dev/geo";
import { addProject, nextProjectId, updateCompany, useDev } from "@/store/dev";
import { showToast } from "@/components/ui/toast";
import { StepComm } from "./StepComm";
import { StepDocs } from "./StepDocs";
import { StepDone } from "./StepDone";
import { StepInfo, wzSelected } from "./StepInfo";
import { StepMedia } from "./StepMedia";
import { StepPlans } from "./StepPlans";
import { WizardNav } from "./WizardNav";
import { WZ_INITIAL, WZ_KEYS, wzAllFiles, wzFolder, wzLabel, type WzFile, type WzState } from "./wizardState";

const done = (list: WzFile[]) => list.filter((f) => f.status === "done" && f.url);
const toFile = (f: WzFile): ProjectFile => ({ n: f.name, s: fileLabel(f.name, f.size), u: f.url });

export function NewObjectWizard() {
  const { t } = useDevT();
  const router = useRouter();
  const dev = useDev();
  const [s, setS] = useState<WzState>(WZ_INITIAL);
  // Storage folder of this wizard session: `dev/new/<timestamp>` (the object has no id until it is created).
  const [storeDir] = useState(() => `dev/new/${Date.now()}`);
  const set = (patch: Partial<WzState>) => setS((x) => ({ ...x, ...patch }));
  const upd = (fn: (x: WzState) => WzState) => setS(fn);
  const total = WZ_KEYS.length;
  const pct = Math.round((s.step / (total - 1)) * 100);
  const key = WZ_KEYS[s.step];
  const folder = wzFolder(t, key);
  const close = () => router.push("/dev/objects");
  useScrollLock(true);
  useEscape(true, close);

  const create = () => {
    const co = wzSelected(dev.viewRole, dev.companies, s.client);
    if (!co) { showToast(t.dx.wz_need_client); set({ step: 0 }); return; }
    const name = s.name.trim();
    if (!name) { showToast(t.dx.wz_need_name); set({ step: 0, needName: true }); return; }
    if (wzAllFiles(s).some((f) => f.status === "uploading")) { showToast(t.dx.upload_wait); return; }
    const id = nextProjectId();
    // `photos`: public URLs with the `#cat=` suffix (exterior by default), videos with the `vid:` prefix; cover = first photo.
    const imgs = done(s.photos).map((f) => f.url);
    const photos = [...imgs.map((u) => `${u}#cat=exterior`), ...done(s.videos).map((f) => `vid:${f.url}`)];
    const files = [...done(s.docs.present), ...done(s.docs.ruhsat), ...done(s.docs.price), ...done(s.floorPlans), ...done(s.layouts)].map(toFile);
    const addr = isMapLink(s.addr) ? "" : s.addr.trim(); // ссылка на карту — не адрес (координаты уже в lng/lat)
    const p: Project = {
      id, name, loc: addr, stage: s.stage, ready: STAGEPCT[s.stage] ?? 0, iskan: false, salesSt: "open", occSt: "none",
      client: co.name, tags: s.tags, cover: imgs[0] ?? "", photos, files, cur: "EUR", addr,
      lng: s.lng.trim() || undefined, lat: s.lat.trim() || undefined,
      video: s.videoUrl.trim() || undefined, genGrid: false,
    };
    addProject(p, []);
    updateCompany(co.id, { objIds: [...co.objIds, id] });
    showToast(t.wz.create_done);
    router.push(`/dev/objects/${id}`);
  };

  const btn = "cursor-pointer rounded-[11px] border px-[18px] py-3 text-[14px] font-semibold";
  return (
    <div className="fixed inset-0 z-[121] flex flex-col bg-bg" style={{ animation: "opl-bg .2s ease" }}>
      {/* header (1793–1801) */}
      <div className="flex flex-none flex-wrap items-center gap-4 border-b border-line bg-surface px-[clamp(16px,4vw,32px)] py-[14px]">
        <div className="flex min-w-[200px] flex-1 items-center gap-[10px]">
          <div className="flex h-[38px] w-[38px] flex-none items-center justify-center rounded-[11px] bg-blue text-[20px] text-white"><IconBuildingPlus size={20} /></div>
          <div>
            <div className="text-[18px] font-extrabold leading-[1.1] text-ink">{t.wz.title}</div>
            <div className="mt-[3px] inline-flex items-center gap-[5px] whitespace-nowrap rounded-[20px] bg-green-tint px-2 py-[2px] text-[11px] font-semibold text-green"><IconCloudOff size={12} /> {t.wz.migrate}</div>
          </div>
        </div>
        <Link href="/dev/objects/new" className="inline-flex flex-none items-center gap-[6px] whitespace-nowrap rounded-[10px] border border-blue bg-blue-tint px-[12px] py-[8px] text-[13px] font-semibold text-[#3a63d4]"><IconWand size={15} /> {t.imp.title}</Link>
        <div className="flex-none text-[13px] text-text-2">{t.wz.step} {s.step + 1} {t.wz.of} {total}</div>
        <button type="button" onClick={close} className="h-[38px] w-[38px] flex-none cursor-pointer rounded-[10px] border border-line bg-surface text-[20px] text-muted hover:bg-[#f5f6f9]">&times;</button>
      </div>
      <div className="h-1 flex-none bg-[#eef0f4]"><div className="h-full bg-blue transition-[width] duration-300 ease-in-out" style={{ width: `${pct}%` }} /></div>

      <div className="flex-1 overflow-y-auto">
        <div className="mx-auto flex max-w-[1100px] flex-wrap items-start gap-[26px] px-[clamp(16px,4vw,32px)] py-[clamp(18px,3vw,30px)]">
          <WizardNav step={s.step} onStep={(i) => set({ step: i })} />
          <div className="min-w-[300px] flex-1">
            <div className="mb-1 flex flex-wrap items-center gap-[10px]">
              <h2 className="m-0 text-[23px] font-extrabold tracking-[-0.02em] text-ink">{wzLabel(t, key)}</h2>
              {folder && <span className="inline-flex items-center gap-[5px] whitespace-nowrap rounded-[20px] bg-[#eef0f4] px-[10px] py-1 text-[12px] font-semibold text-text-2"><IconFolder size={12} /> {t.wz.replaces} {folder}</span>}
            </div>
            {key === "info" && <StepInfo s={s} set={set} role={dev.viewRole} companies={dev.companies} />}
            {key === "media" && <StepMedia s={s} set={set} upd={upd} folder={storeDir} />}
            {key === "plans" && <StepPlans s={s} set={set} upd={upd} folder={storeDir} />}
            {key === "docs" && <StepDocs s={s} set={set} upd={upd} folder={storeDir} />}
            {key === "comm" && <StepComm s={s} set={set} />}
            {key === "done" && <StepDone />}
          </div>
        </div>
      </div>

      {/* footer (1901–1910) */}
      <div className="flex flex-none items-center gap-3 border-t border-line bg-surface px-[clamp(16px,4vw,32px)] py-[14px]">
        <button type="button" onClick={close} className={`${btn} border-line bg-surface text-text-2`}>{t.wz.cancel}</button>
        <div className="flex-1" />
        {s.step > 0 && <button type="button" onClick={() => set({ step: Math.max(0, s.step - 1) })} className={`${btn} inline-flex items-center gap-[7px] border-line bg-surface text-ink hover:bg-[#f5f6f9]`}><IconArrowLeft size={16} /> {t.wz.back}</button>}
        {s.step === total - 1
          ? <button type="button" onClick={create} className="inline-flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[11px] border border-green bg-green px-[22px] py-3 text-[14px] font-bold text-white hover:bg-[#0c8a5e]"><IconCheck size={16} /> {t.wz.create}</button>
          : <button type="button" onClick={() => set({ step: Math.min(total - 1, s.step + 1) })} className="inline-flex cursor-pointer items-center gap-[7px] whitespace-nowrap rounded-[11px] border border-blue bg-blue px-[22px] py-3 text-[14px] font-bold text-white hover:bg-[#3a63d4]">{t.wz.next} <IconArrowRight size={16} /></button>}
      </div>
    </div>
  );
}
