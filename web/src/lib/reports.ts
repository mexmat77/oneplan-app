// Жалобы на объявления (таблица `reports`, миграция 0007): общий тип для админки (`/admin/reports`, вкладка «Жалобы» на `/rls`).
export type ReportReason = "stale" | "sold" | "price" | "dup" | "other";
export type ReportRow = {
  id: string; reason: ReportReason; text: string | null; status: "new" | "done"; created_at: string; handled_at: string | null;
  from_id: string | null; from_name: string | null;
  listing_ref: string | null; listing_title: string | null; listing_price: number | null; listing_cur: string | null; listing_photo: string | null; listing_owner: string | null;
};
export const REPORT_SELECT = "id, reason, text, status, created_at, handled_at, from_id, from_name, listing_ref, listing_title, listing_price, listing_cur, listing_photo, listing_owner";
