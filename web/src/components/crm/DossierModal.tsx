"use client";

// Анкета клиента для договоров (13.10.2026, 0027): паспорт / T.C. kimlik, адрес, налоговый номер, IBAN — заполняется один раз в
// карточке клиента и подставляется во все документы, где этот клиент — покупатель или продавец. Хранится зашифрованно.
import { useState } from "react";
import { IconCheck } from "@tabler/icons-react";
import { saveDossier } from "@/app/crm/actions";
import { Modal, ModalClose } from "@/components/ui/Modal";
import { DateField } from "@/components/ui/DateRange";
import { showToast } from "@/components/ui/toast";
import { useI18n } from "@/i18n/provider";
import { PARTY_FIELDS } from "@/lib/crm/docFields";
import { crmError, btnP, btnS, inp, lbl } from "./crmUi";

export function DossierModal({ open, clientId, clientName, value, onClose, onSaved }: { open: boolean; clientId: string; clientName: string; value: Record<string, string>; onClose: () => void; onSaved: (v: Record<string, string>) => void }) {
  return <Modal open={open} onClose={onClose} width={760} sheet="tall">{open && <DossierForm clientId={clientId} clientName={clientName} value={value} onClose={onClose} onSaved={onSaved} />}</Modal>;
}

function DossierForm({ clientId, clientName, value, onClose, onSaved }: { clientId: string; clientName: string; value: Record<string, string>; onClose: () => void; onSaved: (v: Record<string, string>) => void }) {
  const { t, lang } = useI18n();
  const c = t.crm;
  const [f, setF] = useState<Record<string, string>>(() => ({ name: clientName, ...value }));
  const [busy, setBusy] = useState(false);
  const set = (k: string, v: string) => setF((p) => ({ ...p, [k]: v }));
  const filled = PARTY_FIELDS.filter((x) => f[x.key]?.trim()).length;
  async function save() {
    setBusy(true);
    try { const clean: Record<string, string> = {}; for (const x of PARTY_FIELDS) if (f[x.key]?.trim()) clean[x.key] = f[x.key].trim(); await saveDossier(clientId, clean); showToast(c.client.dossierSaved); onSaved(clean); }
    catch (e) { crmError(e, c.errSave, c.errReadonly); }
    finally { setBusy(false); }
  }
  return (
    <div data-crm-form="1">
      <div data-modal-head="1" className="mb-1 flex items-center justify-between"><div className="text-[18px] font-semibold text-ink">{c.client.dossier} · {clientName}</div><ModalClose onClick={onClose} /></div>
      <p className="mb-3 text-[12.5px] text-muted">{c.client.dossierS} · {filled}/{PARTY_FIELDS.length}</p>
      <div className="grid grid-cols-3 gap-x-3 gap-y-3 max-md:grid-cols-1">
        {PARTY_FIELDS.map((x) => { const wide = x.type === "textarea"; return (
          <div key={x.key} className={wide ? "col-span-3 max-md:col-span-1" : ""}>
            <label className={lbl}>{x.label[lang]}{x.required ? <span className="text-red"> *</span> : ""}</label>
            {wide ? <textarea value={f[x.key] ?? ""} onChange={(e) => set(x.key, e.target.value)} className={`${inp} min-h-[56px] resize-y py-2`} />
              : x.type === "date" ? <DateField value={f[x.key] ?? ""} onChange={(v) => set(x.key, v)} />
              : <input value={f[x.key] ?? ""} onChange={(e) => set(x.key, e.target.value)} inputMode={/phone/i.test(x.key) ? "tel" : /email/i.test(x.key) ? "email" : undefined} className={inp} />}
          </div>); })}
      </div>
      <div data-modal-foot="1" className="mt-4 flex justify-end gap-2 border-t border-line pt-3"><button type="button" onClick={onClose} className={btnS}>{c.cancel}</button><button type="button" onClick={save} disabled={busy} className={btnP}><IconCheck size={15} /> {c.save}</button></div>
    </div>
  );
}
