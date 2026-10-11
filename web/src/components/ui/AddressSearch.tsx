"use client";

// Поле адреса с подсказками Google Places (общее для формы объекта риэлтора и кабинета застройщика, 10.10.2026).
// Без ключа — обычный input. Ссылки на карты и координаты подсказок не вызывают (их разбирает родитель по `onChange`).
// Выбор подсказки → детали места → `onPick` (координаты, адрес, İl/İlçe/Mahalle). Подпись «Google» внизу — требование Google.
import { useEffect, useRef, useState, type KeyboardEvent } from "react";
import { isMapLink, parseMapLink } from "@/lib/dev/geo";
import { hasGoogle, newSession, placeDetails, placesAutocomplete, type GPlace, type GSuggest } from "@/lib/google";

export type { GPlace };

export function AddressSearch({ value, onChange, onPick, placeholder, className, lang, bias, inputMode }: {
  value: string; onChange: (v: string) => void; onPick: (p: GPlace) => void; placeholder?: string; className?: string; lang: string;
  bias?: [number, number] | null; inputMode?: "text" | "search";
}) {
  const [list, setList] = useState<GSuggest[]>([]);
  const [open, setOpen] = useState(false);
  const [hi, setHi] = useState(-1);
  const [busy, setBusy] = useState(false);
  const session = useRef(newSession());
  const seq = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const off = (e: MouseEvent) => { if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false); };
    document.addEventListener("mousedown", off);
    return () => document.removeEventListener("mousedown", off);
  }, []);

  const query = (v: string) => {
    if (timer.current) clearTimeout(timer.current);
    const q = v.trim();
    if (!hasGoogle() || q.length < 3 || isMapLink(q) || parseMapLink(q)) { setList([]); setOpen(false); return; }
    timer.current = setTimeout(async () => {
      const my = ++seq.current;
      const res = await placesAutocomplete(q, session.current, lang, bias ?? null);
      if (my !== seq.current) return;
      setList(res); setHi(-1); setOpen(res.length > 0);
    }, 280);
  };

  const pick = async (s: GSuggest) => {
    setOpen(false); setBusy(true);
    const p = await placeDetails(s.id, session.current, lang);
    session.current = newSession(); // сессия закрывается запросом деталей
    setBusy(false);
    if (!p) return;
    onChange(p.addr || `${s.main}, ${s.secondary}`);
    onPick(p);
  };

  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (!open || !list.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); setHi((h) => (h + 1) % list.length); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setHi((h) => (h <= 0 ? list.length - 1 : h - 1)); }
    else if (e.key === "Enter") { if (hi >= 0) { e.preventDefault(); void pick(list[hi]); } }
    else if (e.key === "Escape") setOpen(false);
  };

  return (
    <div ref={wrap} className="relative min-w-0 flex-1">
      <input
        value={value} placeholder={placeholder} className={className} inputMode={inputMode} autoComplete="off"
        onChange={(e) => { onChange(e.target.value); query(e.target.value); }}
        onFocus={() => { if (list.length) setOpen(true); }}
        onKeyDown={onKey}
      />
      {busy && <span className="pointer-events-none absolute right-3 top-1/2 h-[14px] w-[14px] -translate-y-1/2 animate-spin rounded-full border-2 border-line border-t-blue" />}
      {open && list.length > 0 && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-[60] overflow-hidden rounded-[12px] border border-line bg-surface shadow-[0_10px_30px_rgba(20,36,63,.16)]">
          {list.map((s, i) => (
            <button key={s.id} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => void pick(s)} onMouseEnter={() => setHi(i)}
              className={`block w-full cursor-pointer px-[13px] py-[9px] text-left ${i === hi ? "bg-blue-tint" : "bg-surface"}`}>
              <span className="block truncate text-[13.5px] font-semibold text-ink">{s.main}</span>
              {s.secondary && <span className="block truncate text-[12px] text-muted">{s.secondary}</span>}
            </button>
          ))}
          <div className="border-t border-line-2 px-[13px] py-[5px] text-right text-[10.5px] text-muted">Google</div>
        </div>
      )}
    </div>
  );
}
