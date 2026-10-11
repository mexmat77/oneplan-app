"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { IconEye } from "@tabler/icons-react";
import { useT } from "@/i18n/provider";
import { showToast } from "@/components/ui/toast";
import { useAllListings } from "@/store/listings";
import { usePrefs } from "@/store/prefs";
import { CreateSelModal } from "./CreateSelModal";

// Dark bottom bar that appears while listings are being collected into a selection
// (prototype lines 1536–1548, 3673–3676, 4285–4288): only on catalog / mine / favs,
// only with a non-empty folder and hidden while the create modal is open.
const SCREENS = ["/catalog", "/mine", "/favs"];

export function SelBar() {
  const t = useT();
  const pathname = usePathname();
  const all = useAllListings();
  const { sel, selDraft, clearSel } = usePrefs();
  const [open, setOpen] = useState(false);
  const onScreen = SCREENS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (!onScreen || !sel.length) return null;
  const editing = !!selDraft.editingSel;
  const thumbs = sel.slice(0, 4).map((id) => all.find((o) => o.id === id)?.img).filter((x): x is string => !!x);
  const th = "h-[34px] w-[34px] rounded-[8px] border-2 border-ink bg-cover bg-center";

  function openCreate() {
    if (!sel.length) { showToast(t.sel.minOne); return; }
    setOpen(true);
  }

  return (
    <>
      {!open && (
        <div className="pointer-events-none fixed inset-x-0 bottom-0 z-150 px-[18px] pb-4">
          <div className="pointer-events-auto mx-auto flex max-w-[1000px] flex-wrap items-center gap-[14px] rounded-[15px] bg-ink px-[17px] py-3 text-white shadow-[0_14px_44px_rgba(20,36,63,.35)]">
            <span className="flex items-center gap-[9px] text-[13.5px]">
              <span className="inline-flex h-[26px] min-w-[26px] items-center justify-center rounded-[8px] bg-blue px-[7px] font-extrabold">{sel.length}</span> {t.sel.inSelBar}
            </span>
            <div className="flex">
              {thumbs.map((src, i) => (
                <span key={i} className={`${th} ${i ? "ml-[-9px]" : ""}`} style={{ backgroundImage: `url('${src}')` }} />
              ))}
              {sel.length > 4 && <span className={`${th} ml-[-9px] flex items-center justify-center bg-dark-2 text-[10.5px] font-bold`}>+{sel.length - 4}</span>}
            </div>
            <div className="flex-1" />
            <button type="button" onClick={clearSel} className="cursor-pointer text-[12.5px] text-dark-muted hover:text-white">{editing ? t.sel.discard : t.sel.clear}</button>
            <button type="button" onClick={openCreate} className="inline-flex cursor-pointer items-center gap-[7px] rounded-[11px] bg-blue-2 px-[18px] py-[11px] text-[13.5px] font-bold text-white hover:bg-blue-3">
              <IconEye size={16} /> {t.sel.previewBar}
            </button>
          </div>
        </div>
      )}
      {open && <CreateSelModal onClose={() => setOpen(false)} />}
    </>
  );
}
