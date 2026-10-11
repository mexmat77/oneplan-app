"use client";

// Long free-form descriptions on the public object page: paragraphs, bullet lists, readable measure and a
// «Показать полностью» clamp — the way listing pages on Zillow / Rightmove / Emlakjet present long text.
import { useLayoutEffect, useRef, useState, type ReactNode } from "react";
import { IconChevronDown, IconChevronUp } from "@tabler/icons-react";

type Block = { kind: "p"; text: string } | { kind: "ul"; items: string[] };

const BULLET = /^\s*(?:[-–—•·*]|\d+[.)])\s+/;
const INLINE_BULLET = /\s+(?=[•▪■]\s)/; // «… • пункт • пункт» typed on one line

/** Split raw text into paragraphs and lists. A single wall of text is broken into ~3-sentence paragraphs. */
export function parseBlocks(raw: string): Block[] {
  const text = (raw || "").replace(/\r\n?/g, "\n").trim();
  if (!text) return [];
  const lines = text.split("\n").map((l) => l.trim()).filter((l, i, a) => l || (i > 0 && a[i - 1]));
  const out: Block[] = [];
  const flushP = (buf: string[]) => { if (buf.length) out.push(...wallToParagraphs(buf.join(" "))); };
  let buf: string[] = [];
  for (const line of lines) {
    if (!line) { flushP(buf); buf = []; continue; }
    // inline «•» bullets inside one line → list
    const inl = line.split(INLINE_BULLET);
    if (inl.length > 2 && inl.slice(1).every((x) => /^[•▪■]\s/.test(x))) {
      const lead = inl[0].replace(/[•▪■]\s*$/, "").trim();
      if (lead) buf.push(lead);
      flushP(buf); buf = [];
      const items = inl.slice(1).map((x) => x.replace(/^[•▪■]\s*/, "").trim()).filter(Boolean);
      const lastI = items[items.length - 1];
      const cut = lastI.match(/^(.*?[.;!?])\s+(?=[A-ZА-ЯЁİ])/);
      out.push({ kind: "ul", items: cut ? [...items.slice(0, -1), cut[1]] : items });
      if (cut) out.push(...wallToParagraphs(lastI.slice(cut[0].length)));
      continue;
    }
    if (BULLET.test(line)) {
      flushP(buf); buf = [];
      const last = out[out.length - 1];
      const item = line.replace(BULLET, "").trim();
      if (last && last.kind === "ul") last.items.push(item); else out.push({ kind: "ul", items: [item] });
      continue;
    }
    buf.push(line);
  }
  flushP(buf);
  return out;
}

/** «Стена текста» без переносов → абзацы по 2–3 предложения; списки «- пункт - пункт» внутри строки → список. */
function wallToParagraphs(s: string): Block[] {
  const t = s.trim();
  if (!t) return [];
  // "…, а именно: - открытый бассейн - закрытый бассейн - …" → intro + list (+ tail). En-dashes inside normal
  // sentences («Газипаша – 40 км») must not count, so we look for the longest run of ≥3 short segments.
  const parts = t.split(/(\s+[-–—]\s+)(?=[^\s])/); // [seg, sep, seg, sep, …]
  const segs: string[] = parts.filter((_, i) => i % 2 === 0);
  const seps: string[] = parts.filter((_, i) => i % 2 === 1);
  let best: [number, number] | null = null; // [startSeg, endSeg) — segments that are list items
  // An item is short, holds no sentence break inside and does not end with «:» (that is the intro).
  const isItem = (x: string) => x.length < 140 && !/[.!?]\s+[A-ZА-ЯЁİ]/.test(x) && !/:\s*$/.test(x);
  for (let i = 1; i < segs.length; i++) {
    let j = i;
    while (j < segs.length && isItem(segs[j])) j++;
    if (j - i >= 3 && (!best || j - i > best[1] - best[0])) best = [i, j];
    i = j;
  }
  if (best) {
    const [a, b0] = best;
    let b = b0;
    const join = (from: number, to: number) => segs.slice(from, to).map((x, k) => (k ? seps[from + k - 1] + x : x)).join("");
    const items = segs.slice(a, b);
    let tail = "";
    // The item after the run may be the last list item running into the next sentence («управляющая компания. Все…»).
    const nextSeg = segs[b];
    const m = nextSeg && /^[a-zа-яё]/.test(nextSeg) ? nextSeg.match(/^(.*?[.;!?])\s+(?=[A-ZА-ЯЁİ])/) : null;
    if (m) { items.push(m[1]); tail = nextSeg.slice(m[0].length); b += 1; }
    const rest = join(b, segs.length);
    if (rest) tail = tail ? tail + seps[b - 1] + rest : rest;
    const blocks: Block[] = [];
    const intro = join(0, a);
    if (intro.trim()) blocks.push(...sentencesToParagraphs(intro.trim()));
    blocks.push({ kind: "ul", items: items.map((x) => x.replace(/[.;,]\s*$/, "").trim()) });
    if (tail.trim()) blocks.push(...wallToParagraphs(tail));
    return blocks;
  }
  return sentencesToParagraphs(t);
}
function sentencesToParagraphs(t: string): Block[] {
  if (t.length < 420) return [{ kind: "p", text: t }];
  const sentences = t.match(/[^.!?]+[.!?]+["»)]?\s*|[^.!?]+$/g) ?? [t];
  const paras: string[] = [];
  let cur = "";
  for (const sn of sentences) {
    cur += sn;
    if (cur.length > 330) { paras.push(cur.trim()); cur = ""; }
  }
  if (cur.trim()) paras.push(cur.trim());
  return paras.map((text) => ({ kind: "p", text }));
}

export function RichText({ text, moreLabel, lessLabel, collapsedPx = 300 }: { text: string; moreLabel: string; lessLabel: string; collapsedPx?: number }) {
  const blocks = parseBlocks(text);
  const [open, setOpen] = useState(false);
  const [tall, setTall] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const measure = () => setTall(el.scrollHeight > collapsedPx + 40);
    measure();
    const ro = new ResizeObserver(measure);
    ro.observe(el);
    return () => ro.disconnect();
  }, [collapsedPx, text]);
  const nodes: ReactNode[] = blocks.map((b, i) =>
    b.kind === "p"
      ? <p key={i} className="mb-[14px] last:mb-0">{b.text}</p>
      : <ul key={i} className="mb-[14px] list-none pl-0 last:mb-0">{b.items.map((it, j) => <li key={j} className="relative mb-[6px] pl-[18px] before:absolute before:left-[2px] before:top-[9px] before:h-[6px] before:w-[6px] before:rounded-full before:bg-blue">{it}</li>)}</ul>,
  );
  return (
    <div className="max-w-[760px]">
      <div className="relative" style={{ maxHeight: open || !tall ? undefined : collapsedPx, overflow: "hidden" }}>
        <div ref={ref} className="text-[15.5px] leading-[1.7] text-[#3d4757] [text-wrap:pretty]">{nodes}</div>
        {tall && !open && <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[90px] bg-[linear-gradient(to_bottom,rgba(247,248,251,0),#f7f8fb)]" />}
      </div>
      {tall && (
        <button type="button" onClick={() => setOpen((v) => !v)} className="mt-2 inline-flex cursor-pointer items-center gap-[5px] rounded-[9px] border border-line bg-surface px-[14px] py-[8px] text-[13px] font-bold text-ink hover:border-blue hover:text-blue">
          {open ? <><IconChevronUp size={15} /> {lessLabel}</> : <><IconChevronDown size={15} /> {moreLabel}</>}
        </button>
      )}
    </div>
  );
}
