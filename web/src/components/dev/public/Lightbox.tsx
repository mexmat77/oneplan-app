"use client";

// Public-page lightbox — the shared `board/Lightbox` (horizontal feed, ← → arrows, counter, keys + Esc).
import { Lightbox } from "@/components/dev/board/Lightbox";

export type LbState = { list: string[]; idx: number } | null;

export function PubLightbox(props: { list: string[]; idx: number; onClose: () => void }) { return <Lightbox {...props} />; }
