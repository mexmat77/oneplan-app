"use client";

// Общие куски карточки объекта (прототип `OnePlan v2.dc.html` 456–583; данные 3691–3737, 4236–4283):
// дефолты редактируемых полей (state 2258–2265), резолв фото, индикатор автосохранения, каркас секции.
import { coverOf } from "@/lib/dev/data";
import { PROJECTS_SEED } from "@/lib/dev/data";
import type { DragEvent, ReactNode } from "react";
import { IconCloud, IconCloudCheck, IconLoader2 } from "@tabler/icons-react";
import { useDevT } from "@/i18n/dev";
import { asset } from "@/lib/dev/data";
import coverJson from "@/mock/dev/cover.json";
import type { DocStatus, ProgressEntry, Project, ProjectFile } from "@/lib/dev/types";
import { touch, updateProject, useDev } from "@/store/dev";

export type DescLang = "RU" | "EN" | "TR" | "AR";
export type Docs = { yapi: DocStatus; iskan: DocStatus; tapu: DocStatus; dask: DocStatus };

/** Дефолты прототипа (state 2258–2265) — общие для объектов без своих значений. */
export const DEFAULT_PHOTOS = ["photo-1545324418-cc1a3fa10c00", "photo-1512917774080-9991f1c4c750", "photo-1600585154340-be6161a56a0c", "photo-1571003123894-1f0594d2b5d9", "photo-1600607687939-ce8a6c25118c", "photo-1596464716127-f2a82984de30"];
export const DEFAULT_DESCS: Record<DescLang, string> = {
  RU: "Клубный комплекс у моря с бассейнами и SPA, ландшафтным парком и подземным паркингом. 5 минут до пляжа.",
  EN: "A seafront club residence with pools and SPA, landscaped park and underground parking. 5 min to the beach.",
  TR: "Deniz kenarında havuzlu, SPA, peyzajlı park ve kapalı otoparklı site. Plaja 5 dakika.",
  AR: "",
};
export const DEFAULT_LNG = "32.0669";
export const DEFAULT_LAT = "36.5516";
export const DEFAULT_PROG: ProgressEntry[] = [
  { d: "06.2026", t: "Фасадные работы блока A", ph: ["photo-1541888946425-d81bb19240f5", "vid:demo", "photo-1503387762-592deb58ef4e"] },
  { d: "03.2026", t: "Монолит завершён (8 этажей)", ph: ["photo-1590725140246-20acdee442be"] },
  { d: "10.2025", t: "Фундаментная плита", ph: ["photo-1503387837-b154d5074bd2"] },
];
export const DEFAULT_DOCS: Docs = { yapi: "ok", iskan: "wait", tapu: "wait", dask: "ok" };
export const DEFAULT_FILES: ProjectFile[] = [
  { n: "Sunum — презентация.pdf", s: "PDF · 12 МБ", u: "" },
  { n: "Vaziyet planı — генплан.pdf", s: "PDF · 4,2 МБ", u: "" },
  { n: "Fiyat listesi.xlsx", s: "XLSX · 96 КБ", u: "" },
];
const COVER = coverJson as Record<string, string>;

/** Редактируемое представление объекта: проект + дефолты прототипа там, где поле не задано. */
export type EditObj = Project & { descs: Record<DescLang, string>; lng: string; lat: string; prog: ProgressEntry[]; docs: Docs; photos: string[]; files: ProjectFile[] };

const EMPTY_DESCS: Record<DescLang, string> = { RU: "", EN: "", TR: "", AR: "" };
/** Prototype demo defaults (description, diary, photos, files) apply to the seed objects only; new objects start empty. */
export function withDefaults(p: Project): EditObj {
  const seed = PROJECTS_SEED.some((x) => x.id === p.id);
  return {
    ...p,
    descs: { ...(seed ? DEFAULT_DESCS : EMPTY_DESCS), ...(p.descs || {}) } as Record<DescLang, string>,
    lng: p.lng ?? (seed ? DEFAULT_LNG : ""),
    lat: p.lat ?? (seed ? DEFAULT_LAT : ""),
    prog: p.prog ?? (seed ? DEFAULT_PROG : []),
    // İskan синхронизирован с `p.iskan` (openObject 2691: eDocs.iskan = p.iskan ? 'ok' : 'wait').
    docs: { ...DEFAULT_DOCS, ...(p.docs || {}), iskan: p.iskan ? "ok" : "wait" },
    photos: p.photos ?? (seed ? DEFAULT_PHOTOS : []),
    files: p.files ?? (seed ? DEFAULT_FILES : []),
  };
}

/** Объект по id из стора (или `null`). */
export function useEditObj(id: number): EditObj | null {
  const s = useDev();
  const p = s.projects.find((x) => x.id === id);
  return p ? withDefaults(p) : null;
}

/** `eSet(patch)` — правка проекта + `touch()` (updateProject уже вызывает touch). */
export const eSet = (id: number, patch: Partial<Project>) => updateProject(id, patch);
export { touch };

/** Разбор записи фото: `vid:` префикс, `#cat=` суффикс. */
export function splitPhoto(p: string): { vid: boolean; raw: string; cat: string } {
  const s = String(p);
  const vid = s.startsWith("vid:");
  const raw0 = vid ? s.slice(4) : s;
  const ci = raw0.indexOf("#cat=");
  return { vid, cat: ci > -1 ? raw0.slice(ci + 5) : "exterior", raw: ci > -1 ? raw0.slice(0, ci) : raw0 };
}
/** URL картинки: blob:/http/путь с `/` — как есть (через `asset`), иначе unsplash-id с параметрами прототипа. */
export function photoUrl(raw: string, q = "?w=340&h=255&fit=crop"): string {
  if (raw.startsWith("blob:") || raw.startsWith("data:") || raw.startsWith("http")) return raw;
  if (raw.indexOf("/") > -1) return asset(raw);
  return `https://images.unsplash.com/${raw}${q}`;
}
/** Обложка hero: `obj.cover` или unsplash `COVER[id]` (4236). */
export const heroCover = (p: Project) => (coverOf(p) || `https://images.unsplash.com/${COVER[String(p.id)] || COVER["8"]}?w=1200&h=500&fit=crop`);

/** `pickFiles(accept, cb)` (2809) — скрытый input, multiple. */
export function pickFiles(accept: string, cb: (files: File[]) => void) {
  const inp = document.createElement("input");
  inp.type = "file"; inp.accept = accept; inp.multiple = true;
  inp.onchange = () => cb(Array.from(inp.files || []));
  inp.click();
}
// `mediaUrls` (2811) / `addDocFiles` (2816) прототипа делали blob-URL; теперь файлы грузятся в Storage —
// см. `uploadFiles` / `fileLabel` в `@/lib/upload` (используются в SecMedia / SecProg / SecDocs).

export const onDragOverPrevent = (e: DragEvent) => e.preventDefault();

/** Индикатор автосохранения `epSave` (3698–3700): ti-cloud / ti-loader-2 / ti-cloud-check, зелёный при saved. */
export function SaveChip() {
  const { t } = useDevT();
  const { save } = useDev();
  const saved = save !== "" && save !== "saving";
  const label = save === "saving" ? t.edp.saving : saved ? `${t.edp.saved} · ${save}` : t.edp.autosave;
  return (
    <span className={`inline-flex items-center gap-[6px] whitespace-nowrap rounded-[20px] px-3 py-[7px] text-[12px] font-semibold ${saved ? "bg-green-tint text-green" : "bg-bg-2 text-muted"}`}>
      {save === "saving" ? <IconLoader2 size={14} className="animate-spin" /> : saved ? <IconCloudCheck size={14} /> : <IconCloud size={14} />} {label}
    </span>
  );
}

/** Белая карточка секции (radius 16, padding 22) с заголовком-иконкой 32px #eef3ff/#4d7cfe. */
export function SectionCard({ id, icon, title, after, headClass = "mb-[18px]", onDrop, children }: { id: string; icon: ReactNode; title: string; after?: ReactNode; headClass?: string; onDrop?: (e: DragEvent<HTMLDivElement>) => void; children: ReactNode }) {
  return (
    <div id={id} onDrop={onDrop} onDragOver={onDrop ? onDragOverPrevent : undefined} className="rounded-[16px] border border-line bg-surface p-[22px]">
      <div className={`flex flex-wrap items-center gap-[10px] ${headClass}`}>
        <div className="flex h-8 w-8 items-center justify-center rounded-[9px] bg-blue-tint text-blue">{icon}</div>
        <h3 className="m-0 text-[16px] font-bold text-ink">{title}</h3>
        {after}
      </div>
      {children}
    </div>
  );
}

/** Подпись поля 13px #6b7688. */
export const Label = ({ children, mb = 8 }: { children: ReactNode; mb?: number }) => <label className="block text-[13px] text-text-2" style={{ marginBottom: mb }}>{children}</label>;

/** Поле ввода секции (border #e6e9f0, radius 11, bg #fbfcfe, focus blue). */
export const inputCls = "w-full rounded-[11px] border border-line bg-[#fbfcfe] px-[13px] py-[11px] text-[14px] outline-none focus:border-blue";
