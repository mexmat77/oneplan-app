// Поля подстановки для документов CRM и реестр встроенных шаблонов (11.10.2026).
// Плейсхолдер в DOCX: {{group.key}} (docxtemplater, разделители {{ }}). Группы: agency (реквизиты ws из crm_settings),
// buyer (= клиент сделки; в аренде — kiracı/арендатор), seller (продавец / kiraya veren / арендодатель), guarantor (поручитель),
// property (объект: адрес, тапу), deal (цена, задаток, комиссия, даты), rent (условия аренды).
import type { Lang } from "@/i18n";

export type FieldType = "text" | "number" | "money" | "date" | "textarea" | "select";
export type DocField = { key: string; label: Record<Lang, string>; type?: FieldType; group: DocGroup; required?: boolean; options?: string[]; hint?: Record<Lang, string> };
export type DocGroup = "agency" | "buyer" | "seller" | "guarantor" | "property" | "deal" | "rent";

const L = (RU: string, EN: string, TR: string): Record<Lang, string> => ({ RU, EN, TR });

export const GROUP_LABELS: Record<DocGroup, Record<Lang, string>> = {
  agency: L("Агентство / компания", "Agency / company", "Emlak ofisi / şirket"),
  buyer: L("Покупатель / арендатор", "Buyer / tenant", "Alıcı / kiracı"),
  seller: L("Продавец / арендодатель", "Seller / landlord", "Satıcı / kiraya veren"),
  guarantor: L("Поручитель", "Guarantor", "Kefil"),
  property: L("Объект", "Property", "Taşınmaz"),
  deal: L("Сделка", "Deal", "İşlem"),
  rent: L("Условия аренды", "Rental terms", "Kira şartları"),
};

const person = (g: "buyer" | "seller" | "guarantor"): DocField[] => [
  { key: `${g}.name`, label: L("ФИО / название", "Full name / company", "Ad Soyad / Ünvan"), group: g, required: true },
  { key: `${g}.idNo`, label: L("T.C. Kimlik No", "Turkish ID No", "T.C. Kimlik No"), group: g },
  { key: `${g}.passportNo`, label: L("Паспорт №", "Passport No", "Pasaport No"), group: g },
  { key: `${g}.taxNo`, label: L("Налоговый номер", "Tax No", "Vergi No"), group: g },
  { key: `${g}.birthDate`, label: L("Дата рождения", "Date of birth", "Doğum tarihi"), group: g, type: "date" },
  { key: `${g}.nationality`, label: L("Гражданство", "Nationality", "Uyruğu"), group: g },
  { key: `${g}.address`, label: L("Адрес", "Address", "Adres"), group: g, type: "textarea" },
  { key: `${g}.workAddress`, label: L("Адрес работы", "Work address", "İşyeri adresi"), group: g, type: "textarea" },
  { key: `${g}.phone`, label: L("Телефон", "Phone", "Telefon"), group: g },
  { key: `${g}.email`, label: L("E-mail", "E-mail", "E-posta"), group: g },
  { key: `${g}.iban`, label: L("IBAN", "IBAN", "IBAN"), group: g },
  { key: `${g}.bank`, label: L("Банк", "Bank", "Banka"), group: g },
  { key: `${g}.accountHolder`, label: L("Владелец счёта", "Account holder", "Hesap sahibi"), group: g },
];

/** Поля анкеты стороны (клиент как покупатель/продавец), ключи без префикса группы (0027). */
export const PARTY_FIELDS: DocField[] = person("buyer").map((f) => ({ ...f, key: f.key.slice("buyer.".length) }));

export const FIELDS: DocField[] = [
  { key: "agency.name", label: L("Название компании", "Company name", "Ünvan"), group: "agency", required: true },
  { key: "agency.taxNo", label: L("Налоговый номер", "Tax No", "Vergi No"), group: "agency" },
  { key: "agency.taxOffice", label: L("Налоговая", "Tax office", "Vergi dairesi"), group: "agency" },
  { key: "agency.mersis", label: L("MERSİS", "MERSİS No", "Mersis No"), group: "agency" },
  { key: "agency.registryNo", label: L("Торговый реестр №", "Trade registry No", "Ticaret sicil No"), group: "agency" },
  { key: "agency.address", label: L("Адрес", "Address", "Adres"), group: "agency", type: "textarea" },
  { key: "agency.representative", label: L("Представитель", "Representative", "Yetkili"), group: "agency" },
  { key: "agency.phone", label: L("Телефон", "Phone", "Telefon"), group: "agency" },
  { key: "agency.email", label: L("E-mail", "E-mail", "E-posta"), group: "agency" },
  { key: "agency.iban", label: L("IBAN", "IBAN", "IBAN"), group: "agency" },
  { key: "agency.bank", label: L("Банк", "Bank", "Banka"), group: "agency" },
  { key: "agency.licenseNo", label: L("Лицензия (Yetki belgesi) №", "Licence No", "Yetki belgesi No"), group: "agency" },
  ...person("buyer"), ...person("seller"), ...person("guarantor"),
  { key: "property.il", label: L("Провинция (İl)", "Province (İl)", "İl"), group: "property" },
  { key: "property.ilce", label: L("Район (İlçe)", "District (İlçe)", "İlçe"), group: "property" },
  { key: "property.mahalle", label: L("Махалле / köy", "Neighbourhood / village", "Mahalle / Köy"), group: "property" },
  { key: "property.street", label: L("Улица и номер", "Street and number", "Sokağı ve numarası"), group: "property" },
  { key: "property.unit", label: L("Квартира / дом №", "Apartment / house No", "Daire / Bağımsız bölüm No"), group: "property" },
  { key: "property.address", label: L("Полный адрес", "Full address", "Tam adres"), group: "property", type: "textarea" },
  { key: "property.location", label: L("Местность (Mevkii)", "Locality (Mevkii)", "Mevkii"), group: "property" },
  { key: "property.ada", label: L("Ada", "Block (Ada)", "Ada"), group: "property" },
  { key: "property.parsel", label: L("Parsel", "Parcel", "Parsel"), group: "property" },
  { key: "property.area", label: L("Площадь участка, м²", "Land area, m²", "Yüzölçümü, m²"), group: "property" },
  { key: "property.netArea", label: L("Нетто, м²", "Net area, m²", "Net m²"), group: "property" },
  { key: "property.grossArea", label: L("Брутто, м²", "Gross area, m²", "Brüt m²"), group: "property" },
  { key: "property.type", label: L("Тип (Niteliği)", "Type (Niteliği)", "Niteliği"), group: "property" },
  { key: "property.block", label: L("Блок", "Block", "Blok"), group: "property" },
  { key: "property.entrance", label: L("Подъезд", "Entrance", "Giriş"), group: "property" },
  { key: "property.floor", label: L("Этаж", "Floor", "Kat"), group: "property" },
  { key: "property.unitNo", label: L("Bağımsız bölüm №", "Independent section No", "Bağımsız bölüm No"), group: "property" },
  { key: "property.landShare", label: L("Доля участка (Arsa payı)", "Land share", "Arsa payı"), group: "property" },
  { key: "property.volumePage", label: L("Cilt / Sayfa", "Volume / Page", "Cilt / Sayfa"), group: "property" },
  { key: "property.deedType", label: L("Вид тапу (Kat irtifakı / mülkiyeti)", "Deed type", "Tapu tipi"), group: "property" },
  { key: "property.propertyNo", label: L("Taşınmaz No", "Property ID No", "Taşınmaz No"), group: "property" },
  { key: "property.share", label: L("Доля (Hisse)", "Share (Hisse)", "Hisse"), group: "property" },
  { key: "property.registration", label: L("Регистрация (дата, yevmiye)", "Registration (date, journal No)", "Tescil tarihi – yevmiye No"), group: "property" },
  { key: "property.condition", label: L("Текущее состояние", "Current condition", "Şimdiki durumu"), group: "property" },
  { key: "property.inventory", label: L("Опись имущества", "Inventory", "Demirbaş eşya"), group: "property", type: "textarea" },
  { key: "deal.no", label: L("Номер договора", "Contract No", "Sözleşme / Protokol No"), group: "deal" },
  { key: "deal.date", label: L("Дата договора", "Contract date", "Sözleşme tarihi"), group: "deal", type: "date", required: true },
  { key: "deal.place", label: L("Место подписания", "Place of signing", "İmza yeri"), group: "deal" },
  { key: "deal.price", label: L("Цена, TL", "Price, TL", "Satış bedeli, TL"), group: "deal", type: "money" },
  { key: "deal.deposit", label: L("Задаток (kapora), TL", "Deposit, TL", "Kapora, TL"), group: "deal", type: "money" },
  { key: "deal.depositDate", label: L("Дата задатка", "Deposit date", "Kapora tarihi"), group: "deal", type: "date" },
  { key: "deal.remaining", label: L("Остаток, TL", "Remaining, TL", "Kalan, TL"), group: "deal", type: "money" },
  { key: "deal.paymentMethod", label: L("Способ оплаты", "Payment method", "Ödeme şekli"), group: "deal", type: "select", options: ["Havale", "Nakit", "Kredi", "Havale / Nakit"] },
  { key: "deal.commissionPct", label: L("Комиссия, %", "Commission, %", "Komisyon, %"), group: "deal", type: "number" },
  { key: "deal.commission", label: L("Комиссия, TL", "Commission, TL", "Komisyon, TL"), group: "deal", type: "money" },
  { key: "deal.commissionWhen", label: L("Когда платится комиссия", "Commission due", "Komisyon ödeme zamanı"), group: "deal", type: "select", options: ["Kapora günü", "Tapu günü"] },
  { key: "deal.transferDays", label: L("Срок передачи тапу, дней", "Title transfer period, days", "Tapu devir süresi, gün"), group: "deal", type: "number" },
  { key: "deal.transferDate", label: L("Плановая дата тапу", "Target transfer date", "Tapu hedef tarihi"), group: "deal", type: "date" },
  { key: "deal.landRegistry", label: L("Управление тапу", "Land registry office", "Tapu müdürlüğü"), group: "deal" },
  { key: "deal.court", label: L("Суд (подсудность)", "Court (jurisdiction)", "Yetkili mahkeme"), group: "deal" },
  { key: "deal.copies", label: L("Экземпляров", "Copies", "Nüsha"), group: "deal", type: "number" },
  { key: "deal.notes", label: L("Особые условия", "Special terms", "Özel şartlar"), group: "deal", type: "textarea" },
  { key: "rent.monthly", label: L("Аренда в месяц, TL", "Monthly rent, TL", "Aylık kira, TL"), group: "rent", type: "money" },
  { key: "rent.yearly", label: L("Аренда в год, TL", "Yearly rent, TL", "Yıllık kira, TL"), group: "rent", type: "money" },
  { key: "rent.payment", label: L("Порядок оплаты", "Payment terms", "Kiranın ne şekilde ödeneceği"), group: "rent" },
  { key: "rent.payDay", label: L("День оплаты (число месяца)", "Payment day of month", "Ödeme günü"), group: "rent", type: "number" },
  { key: "rent.start", label: L("Начало аренды", "Start date", "Kiranın başlangıç tarihi"), group: "rent", type: "date" },
  { key: "rent.term", label: L("Срок аренды", "Term", "Kira müddeti"), group: "rent" },
  { key: "rent.termYears", label: L("Срок, лет", "Term, years", "Süre, yıl"), group: "rent", type: "number" },
  { key: "rent.usage", label: L("Назначение использования", "Intended use", "Ne için kullanılacağı"), group: "rent" },
  { key: "rent.deposit", label: L("Депозит", "Deposit", "Depozito"), group: "rent" },
  { key: "rent.advance", label: L("Предоплата", "Advance", "Peşinat"), group: "rent" },
  { key: "rent.increase", label: L("Индексация (по чему)", "Increase basis", "Artış esası"), group: "rent" },
  { key: "rent.increasePct", label: L("Индексация, %", "Increase, %", "Artış oranı, %"), group: "rent", type: "number" },
  { key: "rent.clauses", label: L("Пунктов в договоре", "Number of clauses", "Madde sayısı"), group: "rent", type: "number" },
];
export const FIELD_MAP: Record<string, DocField> = Object.fromEntries(FIELDS.map((f) => [f.key, f]));

/** Вычисляемые поля (не вводятся): суммы прописью и в формате с разделителями. */
export const COMPUTED = ["deal.priceWordsTr", "deal.priceWordsEn", "deal.priceEn", "deal.commissionWordsTr", "deal.commissionWordsEn", "deal.commissionEn", "deal.depositWordsTr", "rent.monthlyWordsTr", "rent.yearlyWordsTr"];

export type DocKind = "sale" | "rent" | "deposit" | "viewing" | "handover" | "consent" | "other";
export type BuiltinTemplate = { key: string; file: string; name: Record<Lang, string>; kind: DocKind; lang: string; fields: string[]; for: ("sale" | "rent" | "daily" | "any")[] };

/** Встроенные шаблоны: файлы в src/crm-templates (собраны scripts/gen-crm-templates.mjs и из образцов пользователя). */
export const BUILTIN: BuiltinTemplate[] = [
  { key: "company_card", file: "company_card_tr_en.docx", kind: "other", lang: "TR/EN", for: [],   // служебный: карточка реквизитов (for: [] — не предлагается в сделке)
    name: L("Карточка реквизитов компании", "Company details card", "Firma bilgi kartı"),
    fields: ["deal.date", "agency.name", "agency.taxNo", "agency.taxOffice", "agency.mersis", "agency.registryNo", "agency.address", "agency.representative", "agency.phone", "agency.email", "agency.iban", "agency.bank", "agency.licenseNo"] },
  { key: "sale_tripartite", file: "sale_tripartite_tr_en.docx", kind: "sale", lang: "TR/EN", for: ["sale"],
    name: L("Договор купли-продажи с агентством (3 стороны, TR/EN)", "Tripartite sale, title transfer and agency agreement (TR/EN)", "Üç taraflı satış, tapu devir ve emlak hizmet bedeli sözleşmesi (TR/EN)"),
    fields: ["deal.date", "deal.place", "agency.name", "agency.taxNo", "agency.taxOffice", "agency.address", "agency.mersis", "agency.registryNo", "agency.representative", "agency.phone",
      "seller.name", "seller.idNo", "seller.birthDate", "seller.passportNo", "seller.nationality", "seller.address", "seller.phone",
      "buyer.name", "buyer.idNo", "buyer.passportNo", "buyer.birthDate", "buyer.nationality", "buyer.address", "buyer.phone",
      "property.il", "property.ilce", "property.mahalle", "property.location", "property.ada", "property.parsel", "property.area", "property.volumePage", "property.type", "property.propertyNo", "property.share", "property.registration",
      "deal.price", "deal.transferDays", "deal.commissionPct", "deal.commission"] },
  { key: "sale_protocol", file: "sale_protocol_deposit_tr.docx", kind: "sale", lang: "TR", for: ["sale"],
    name: L("Протокол купли-продажи с задатком (3 стороны, TR)", "Tripartite sale protocol with deposit (TR)", "Üç taraflı taşınmaz satış protokolü (kapora & aracılık)"),
    fields: ["deal.no", "deal.date", "agency.name", "agency.address", "agency.mersis", "agency.registryNo", "agency.taxOffice", "agency.taxNo", "agency.iban",
      "seller.name", "seller.idNo", "seller.address", "seller.phone", "seller.iban", "seller.bank", "seller.accountHolder",
      "buyer.name", "buyer.idNo", "buyer.address", "buyer.phone",
      "property.il", "property.ilce", "property.mahalle", "property.ada", "property.parsel", "property.area", "property.type", "property.block", "property.entrance", "property.floor", "property.unitNo", "property.landShare", "property.netArea", "property.grossArea", "property.volumePage", "property.deedType", "property.propertyNo", "property.share", "property.registration",
      "deal.price", "deal.paymentMethod", "deal.deposit", "deal.depositDate", "deal.remaining", "deal.landRegistry", "deal.transferDate", "deal.commissionPct", "deal.commission", "deal.commissionWhen"] },
  { key: "rent_standard", file: "rent_standard_tr.docx", kind: "rent", lang: "TR", for: ["rent", "daily"],
    name: L("Договор аренды (стандартный турецкий Kira Sözleşmesi)", "Rental agreement (standard Turkish Kira Sözleşmesi)", "Kira sözleşmesi (standart)"),
    fields: ["deal.date", "property.mahalle", "property.street", "property.unit", "property.type", "seller.name", "seller.idNo", "seller.taxNo", "seller.address", "buyer.name", "buyer.idNo", "buyer.taxNo", "buyer.address", "buyer.workAddress",
      "rent.monthly", "rent.yearly", "rent.payment", "rent.term", "rent.termYears", "rent.start", "property.condition", "rent.usage", "property.inventory", "rent.payDay", "rent.increase", "rent.increasePct", "rent.advance", "rent.deposit", "rent.clauses", "deal.copies", "deal.court", "guarantor.name", "guarantor.idNo", "guarantor.address", "deal.notes"] },
  { key: "viewing_form", file: "viewing_form_tr.docx", kind: "viewing", lang: "TR", for: ["any"],
    name: L("Акт показа объекта (Yer Gösterme Belgesi)", "Property viewing form (Yer Gösterme Belgesi)", "Yer gösterme belgesi"),
    fields: ["deal.date", "agency.name", "agency.licenseNo", "agency.address", "agency.phone", "agency.representative", "buyer.name", "buyer.idNo", "buyer.phone", "buyer.address", "property.address", "property.il", "property.ilce", "property.mahalle", "property.ada", "property.parsel", "property.type", "deal.price", "deal.commissionPct"] },
  { key: "deposit_receipt", file: "deposit_receipt_tr.docx", kind: "deposit", lang: "TR", for: ["sale", "rent"],
    name: L("Расписка о задатке (Kapora Makbuzu)", "Deposit receipt (Kapora Makbuzu)", "Kapora makbuzu"),
    fields: ["deal.no", "deal.date", "deal.place", "agency.name", "agency.representative", "buyer.name", "buyer.idNo", "buyer.phone", "seller.name", "property.address", "property.ada", "property.parsel", "deal.price", "deal.deposit", "deal.paymentMethod", "deal.transferDate"] },
  { key: "handover", file: "handover_tr.docx", kind: "handover", lang: "TR", for: ["any"],
    name: L("Акт приёма-передачи (Teslim Tutanağı)", "Handover protocol (Teslim Tutanağı)", "Teslim tutanağı"),
    fields: ["deal.date", "deal.place", "seller.name", "seller.idNo", "buyer.name", "buyer.idNo", "property.address", "property.condition", "property.inventory", "deal.notes"] },
  { key: "kvkk_consent", file: "kvkk_consent_tr.docx", kind: "consent", lang: "TR", for: ["any"],
    name: L("Согласие на обработку персональных данных (KVKK)", "Personal data consent (KVKK)", "KVKK aydınlatma ve açık rıza metni"),
    fields: ["deal.date", "agency.name", "agency.address", "agency.email", "agency.phone", "buyer.name", "buyer.idNo", "buyer.phone", "buyer.email"] },
];
export const BUILTIN_MAP: Record<string, BuiltinTemplate> = Object.fromEntries(BUILTIN.map((t) => [t.key, t]));
