"use client";

// Выигранная сделка с конкретным объектом (0024, решение пользователя 12.10.2026): предложить снять объект с продажи —
// объявление → «продано» (аренда → «снято»), квартира застройщика → «продана» в шахматке (и в локальном сторе кабинета,
// чтобы открытая вкладка шахматки не вернула старый статус при следующей записи).
import { closeDealObject } from "@/app/crm/actions";
import { confirmDialog } from "@/components/ui/confirm";
import { showToast } from "@/components/ui/toast";
import type { Deal } from "@/lib/crm/types";
import type { Dict } from "@/i18n";
import { getDev, setUnits } from "@/store/dev";
import { setStOver } from "@/store/listings";
import { dealRef } from "./ObjCard";

export async function offerCloseObject(d: Deal, wsKind: string, t: Dict): Promise<void> {
  const r = dealRef(d);
  if (!r || r.kind === "free") return;
  const c = t.crm.obj;
  const ok = await confirmDialog({ title: c.closeT, text: r.kind === "unit" ? c.closeQUnit : d.deal.startsWith("rent") ? c.closeQRent : c.closeQ, ok: c.closeOk, cancel: c.closeNo });
  if (!ok) return;
  try {
    const res = await closeDealObject(d.id);
    if (res.listing) { setStOver(res.listing.id, res.listing.status as "sold" | "off"); showToast(c.closedListing); }
    if (res.unit && wsKind === "developer") {
      const cur = getDev().units[res.unit.projectId];
      if (cur) setUnits(res.unit.projectId, cur.map((u) => (u.uid === res.unit!.unitUid ? { ...u, status: "sold" } : u)));
      showToast(c.closedUnit);
    }
    if (!res.listing && !res.unit) showToast(c.closeSkipped);
  } catch { showToast(c.closeErr); }
}
