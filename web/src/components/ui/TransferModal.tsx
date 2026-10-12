"use client";

// Выбор риэлтора-получателя (12.10.2026): передача объекта или клиента. Список — активные риэлторы базы (кроме себя),
// с агентством в подписи; поиск по имени/агентству; подтверждение одной кнопкой.
import { useEffect, useState } from "react";
import { IconUserShare } from "@tabler/icons-react";
import { listTransferTargets, type TransferTarget } from "@/app/(app)/transfer-actions";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { Select } from "@/components/ui/Select";
import { useI18n } from "@/i18n/provider";

type Props = { open: boolean; title: string; hint?: string; prefer?: { id: string; name: string }[]; busy?: boolean; onClose: () => void; onPick: (id: string, target: TransferTarget | null) => void };

export function TransferModal({ open, title, hint, prefer, busy, onClose, onPick }: Props) {
  const { t } = useI18n();
  const [list, setList] = useState<TransferTarget[] | null>(null);
  const [to, setTo] = useState("");
  useEffect(() => { if (open && !list) listTransferTargets().then(setList).catch(() => setList([])); }, [open, list]);
  if (!open) return null;
  const preferIds = new Set((prefer ?? []).map((p) => p.id));
  const opts = [
    ...(prefer ?? []).map((p) => ({ value: p.id, label: `${p.name} · ${t.tr.sameTeam}` })),
    ...(list ?? []).filter((x) => !preferIds.has(x.id)).map((x) => ({ value: x.id, label: x.agency ? `${x.name} · ${x.agency}` : x.name })),
  ];
  return (
    <Modal open onClose={onClose} width={480}>
      <div data-crm-form="1">
        <div className="mb-3 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{title}</div><ModalClose onClick={onClose} /></div>
        {hint && <p className="mb-3 text-[12.5px] text-muted">{hint}</p>}
        <label className="mb-[4px] block text-[11px] font-semibold uppercase tracking-[.05em] text-muted">{t.tr.to}</label>
        <Select value={to} onChange={setTo} options={opts} searchable placeholder={list ? t.tr.pick : "…"} disabled={!list} />
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="inline-flex h-9 cursor-pointer items-center rounded-[6px] border border-line bg-surface px-3 text-[13px] font-semibold text-ink hover:bg-bg-3">{t.tr.cancel}</button>
          <button type="button" disabled={!to || busy} onClick={() => onPick(to, list?.find((x) => x.id === to) ?? null)} className="inline-flex h-9 cursor-pointer items-center gap-[6px] rounded-[6px] bg-blue-2 px-3 text-[13px] font-semibold text-white hover:bg-blue-3 disabled:opacity-50"><IconUserShare size={15} /> {busy ? "…" : t.tr.go}</button>
        </div>
      </div>
    </Modal>
  );
}
