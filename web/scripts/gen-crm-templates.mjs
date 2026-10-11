// Встроенные шаблоны документов CRM, собранные кодом (пакет `docx`): стандартный турецкий договор аренды (Kira Sözleşmesi),
// акт показа (Yer Gösterme Belgesi), расписка о задатке (Kapora Makbuzu), акт приёма-передачи (Teslim Tutanağı),
// согласие KVKK. Плейсхолдеры {{group.key}} — см. src/lib/crm/docFields.ts. Запуск: node scripts/gen-crm-templates.mjs
// Два шаблона купли-продажи (sale_*.docx) сделаны из образцов пользователя отдельным разовым скриптом и лежат в src/crm-templates.
import { writeFileSync } from "node:fs";
import { AlignmentType, BorderStyle, Document, HeadingLevel, Packer, Paragraph, Table, TableCell, TableRow, TextRun, WidthType } from "docx";

import { fileURLToPath } from "node:url";
const OUT = fileURLToPath(new URL("../src/crm-templates/", import.meta.url));
const FONT = "Arial";
const P = (text, o = {}) => new Paragraph({ alignment: o.align, spacing: { after: o.after ?? 80, before: o.before ?? 0 }, children: [new TextRun({ text, bold: o.bold, size: o.size ?? 20, font: FONT })] });
const H = (text) => new Paragraph({ alignment: AlignmentType.CENTER, spacing: { after: 200 }, children: [new TextRun({ text, bold: true, size: 28, font: FONT })] });
const H2 = (text) => new Paragraph({ spacing: { before: 160, after: 80 }, children: [new TextRun({ text, bold: true, size: 22, font: FONT })] });
const border = { style: BorderStyle.SINGLE, size: 4, color: "999999" };
const cell = (text, w, bold = false) => new TableCell({ width: { size: w, type: WidthType.PERCENTAGE }, borders: { top: border, bottom: border, left: border, right: border }, margins: { top: 60, bottom: 60, left: 100, right: 100 }, children: [new Paragraph({ children: [new TextRun({ text, bold, size: 19, font: FONT })] })] });
const kv = (rows) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: rows.map(([k, v]) => new TableRow({ children: [cell(k, 38, true), cell(v, 62)] })) });
const sign = (labels) => new Table({ width: { size: 100, type: WidthType.PERCENTAGE }, rows: [new TableRow({ children: labels.map((l) => new TableCell({ width: { size: 100 / labels.length, type: WidthType.PERCENTAGE }, borders: { top: { style: BorderStyle.NONE }, bottom: { style: BorderStyle.NONE }, left: { style: BorderStyle.NONE }, right: { style: BorderStyle.NONE } }, children: [P(l, { bold: true, after: 400 }), P("İmza: ____________________")] })) })] });
const doc = (children) => new Document({ styles: { default: { document: { run: { font: FONT, size: 20 } } } }, sections: [{ properties: { page: { margin: { top: 900, bottom: 900, left: 1000, right: 1000 } } }, children }] });
async function save(name, d) { writeFileSync(OUT + name, await Packer.toBuffer(d)); console.log("✓", name); }

// ---------- 1. Kira Sözleşmesi (стандартная форма) ----------
await save("rent_standard_tr.docx", doc([
  H("KİRA SÖZLEŞMESİ"),
  kv([
    ["Dairesi", "{{property.unit}}"], ["Mahallesi", "{{property.mahalle}}"], ["Sokağı ve Numarası", "{{property.street}}"], ["Kiralanan Şeyin Cinsi", "{{property.type}}"],
    ["Kiraya Verenin Adı Soyadı / Ünvanı", "{{seller.name}}"], ["Kiraya Verenin T.C. Kimlik No.su / Vergi No.su", "{{seller.idNo}} {{seller.taxNo}}"], ["Kiraya Verenin İkametgâh Adresi", "{{seller.address}}"],
    ["Kiracının Adı Soyadı / Ünvanı", "{{buyer.name}}"], ["Kiracının T.C. Kimlik No.su / Vergi No.su", "{{buyer.idNo}} {{buyer.taxNo}}"], ["Kiracının İkametgâh Adresi", "{{buyer.address}}"], ["Kiracının İşyeri Adresi", "{{buyer.workAddress}}"],
    ["Bir Aylık Kira Karşılığı", "{{rent.monthly}} TL ({{rent.monthlyWordsTr}} Türk Lirası)"], ["Bir Yıllık Kira Karşılığı", "{{rent.yearly}} TL ({{rent.yearlyWordsTr}} Türk Lirası)"],
    ["Kiranın Ne Şekilde Ödeneceği", "{{rent.payment}}"], ["Kira Müddeti", "{{rent.term}}"], ["Kiranın Başlangıç Tarihi", "{{rent.start}}"],
    ["Kiralanan Şeyin Şimdiki Durumu", "{{property.condition}}"], ["Kiralanan Şeyin Ne İçin Kullanılacağı", "{{rent.usage}}"],
  ]),
  H2("Kiralanan Şey İle Beraber Teslim Olunan Demirbaş Eşyanın Beyanı"),
  P("{{property.inventory}}"),
  P("Gelir Vergisi Kanununa göre: Tüccar, Serbest Meslek Erbabı ve Çiftçiler, ticari, mesleki ve zirai işleri ile ilgili olarak yaptıkları kira ödemelerinden Kanunca belirtilen oranlarda stopaj tevkifatı yaparak vergi dairesine yatıracaklardır.", { size: 16, before: 120 }),
  new Paragraph({ children: [], pageBreakBefore: true }),
  H("HUSUSİ ŞARTLAR"),
  ...[
    "Kiracı kat mülkiyeti kanununa uymayı aynen kabul ve taahhüt eder.",
    "Kiracı kiralananı kısmen veya tamamen başkasına devir ve ciro edemez.",
    "Kiracı kiralanan gayrimenkulde mal sahibinin haberi ve izni olmadan tadilat yapamaz.",
    "Kiracı kira bedelini en geç ait olduğu ayın ilk {{rent.payDay}} gününde ve her ay peşin olarak ödemeyi taahhüt eder.",
    "Kiracı kontrat bitiminde kira bedelini {{rent.increase}} göre %{{rent.increasePct}} oranında artırmayı şimdiden kabul ve taahhüt eder.",
    "Elektrik, su, doğalgaz, kalorifer, apartmana ait giderler ile çevre temizlik vergisi kiracıya aittir.",
    "Kiracı apartman yönetiminin alacağı kararlara aynen uyacaktır.",
    "Kiracı kiralananı boşaltmak istediği takdirde en az bir ay evvelinden mal sahibine ulaşacak şekilde bildirmeyi taahhüt eder.",
    "Kiracı peşinat olarak {{rent.advance}} mal sahibine vermiştir.",
    "Kiracı depozito olarak {{rent.deposit}} mal sahibine vermiştir.",
    "Kiracı mal sahibine vermiş olduğu peşinat ve depozitodan faiz veya herhangi bir fazlalık talep edemez.",
    "Kiracı mal sahibine vermiş olduğu peşinat ve depozitoyu yapacağı tamirata mahsup edemez.",
    "Kiracı kiralanan gayrimenkulü tahliye ederken vermiş olduğu zarar ve ziyana ait meblağ ile ödenmemiş bulunan elektrik, su, doğalgaz, telefon borçları mal sahibi tarafından depozitodan mahsup edilir. Eğer verilen depozito yeterli olmaz ise kalan miktarı kiracı kontrat başlangıç tarihi itibariyle kabul ve ödemeyi taahhüt eder.",
    "Kontrat tarihine kadar olan tüm gider ve borçlar mal sahibine aittir.",
    "Kontrat tarihinden sonra tahakkuk eden tüm gider ve borçlar kiracıya aittir.",
    "Kiralanan gayrimenkule tahakkuk edecek stopaj vergisi kiracıya aittir.",
    "Aynı dönem içerisinde kira bedelinin iki ay arka arkaya ödenmemesi halinde, ödenmeyen aydan itibaren kontrat süresi sonuna kadar olan kira bedelleri muacceliyet kesbeder ve bu hal kiracı tarafından gayrimenkulün tahliyesi sebebi olarak peşinen kabul edilir.",
    "Kefilin kefaleti müşterek ve müteselsil olup, kefil kontratın ilk yapıldığındaki kira dönemi ve belirlenen süre için kefaletin mevcudiyetinin devamını beyan ve imzası ile kabul ve taahhüt eder.",
    "İşbu kontrat {{rent.termYears}} yıllıktır. Kontratın sona ermesinden bir ay evvel taraflar yazılı olarak ihtarda bulunmadıkları sürece kontrat yenilenmiş kabul edilir.",
    "Taraflarca kira sözleşmesinde yazılı adresler kanuni ikametgâh adresi olarak kabul edilir. Adreslerdeki herhangi bir değişiklik taraflara yazılı olarak bildirilmediği takdirde kontratta yazılı olan adrese yapılan tebligat muteber sayılacaktır.",
  ].map((t, i) => P(`${i + 1}-) ${t}`)),
  P("Özel şartlar: {{deal.notes}}", { before: 120 }),
  P("İşbu kontrat {{rent.clauses}} maddeden ibaret olup {{deal.copies}} nüsha düzenlenip, muhatapların her birine verilmiştir. İhtilaf halinde {{deal.court}} mahkemeleri ve icra daireleri yetkilidir.", { before: 160 }),
  P("Aşağıdaki imzaları bulunan Mal Sahibi – Kiracı – Kiracı Kefili yukarıdaki bütün maddeleri herhangi bir tazyike maruz kalmadan okuyup imza suretiyle kabul etmiştir. Tarih: {{deal.date}}", { after: 300 }),
  sign(["KİRAYA VEREN\n{{seller.name}}", "KEFİL\n{{guarantor.name}}\n{{guarantor.idNo}}\n{{guarantor.address}}", "KİRACI\n{{buyer.name}}"]),
]));

// ---------- 2. Yer Gösterme Belgesi (Taşınmaz Ticareti Hakkında Yönetmelik, md. 16) ----------
await save("viewing_form_tr.docx", doc([
  H("TAŞINMAZ GÖSTERME BELGESİ"),
  P("Taşınmaz Ticareti Hakkında Yönetmelik hükümleri uyarınca düzenlenmiştir.", { align: AlignmentType.CENTER, size: 16, after: 200 }),
  H2("1. İşletme (Emlak Ofisi)"),
  kv([["Ünvan", "{{agency.name}}"], ["Yetki Belgesi No", "{{agency.licenseNo}}"], ["Adres", "{{agency.address}}"], ["Telefon", "{{agency.phone}}"], ["Yetkili", "{{agency.representative}}"]]),
  H2("2. Alıcı / Kiracı Adayı"),
  kv([["Adı Soyadı", "{{buyer.name}}"], ["T.C. Kimlik / Pasaport No", "{{buyer.idNo}}"], ["Telefon", "{{buyer.phone}}"], ["Adres", "{{buyer.address}}"]]),
  H2("3. Gösterilen Taşınmaz"),
  kv([["Adres", "{{property.address}}"], ["İl / İlçe / Mahalle", "{{property.il}} / {{property.ilce}} / {{property.mahalle}}"], ["Ada / Parsel", "{{property.ada}} / {{property.parsel}}"], ["Niteliği", "{{property.type}}"], ["İstenen bedel", "{{deal.price}} TL"], ["Hizmet bedeli oranı", "%{{deal.commissionPct}}"]]),
  P("Yukarıda bilgileri yazılı taşınmaz, {{deal.date}} tarihinde işletme tarafından alıcı/kiracı adayına gösterilmiştir. Alıcı/kiracı adayı, taşınmazı işletme aracılığıyla gördüğünü, taşınmazı mal sahibi veya üçüncü kişilerle doğrudan görüşerek satın alması/kiralaması halinde de işletmeye hizmet bedelini ödemeyi kabul ve taahhüt eder.", { before: 160, after: 300 }),
  sign(["İŞLETME\n{{agency.name}}\n{{agency.representative}}", "ALICI / KİRACI ADAYI\n{{buyer.name}}"]),
]));

// ---------- 3. Kapora Makbuzu ----------
await save("deposit_receipt_tr.docx", doc([
  H("KAPORA (ÖN ÖDEME) MAKBUZU"),
  P("Makbuz No: {{deal.no}}        Tarih: {{deal.date}}        Yer: {{deal.place}}", { after: 160 }),
  kv([["Ödeyen (Alıcı / Kiracı)", "{{buyer.name}} — T.C./Pasaport No: {{buyer.idNo}} — Tel: {{buyer.phone}}"], ["Alan", "{{seller.name}} (adına: {{agency.name}} / {{agency.representative}})"],
    ["Taşınmaz", "{{property.address}} — Ada/Parsel: {{property.ada}}/{{property.parsel}}"], ["Toplam bedel", "{{deal.price}} TL"], ["Kapora tutarı", "{{deal.deposit}} TL ({{deal.depositWordsTr}} Türk Lirası)"], ["Ödeme şekli", "{{deal.paymentMethod}}"], ["Tapu / sözleşme hedef tarihi", "{{deal.transferDate}}"]]),
  P("Yukarıda belirtilen kapora tutarı, taşınmazın satışına/kiralanmasına ilişkin ön ödeme olarak teslim alınmıştır. Alıcının haklı bir sebep olmaksızın işlemden vazgeçmesi halinde kapora iade edilmez; satıcının vazgeçmesi halinde kapora iki katı olarak iade edilir. Kapora, tapu devri/sözleşme imzası sırasında toplam bedelden mahsup edilir.", { before: 160, after: 300 }),
  sign(["TESLİM ALAN\n{{agency.name}}", "TESLİM EDEN\n{{buyer.name}}"]),
]));

// ---------- 4. Teslim Tutanağı ----------
await save("handover_tr.docx", doc([
  H("TAŞINMAZ TESLİM TUTANAĞI"),
  P("Tarih: {{deal.date}}        Yer: {{deal.place}}", { after: 160 }),
  kv([["Teslim eden", "{{seller.name}} — T.C./Pasaport No: {{seller.idNo}}"], ["Teslim alan", "{{buyer.name}} — T.C./Pasaport No: {{buyer.idNo}}"], ["Taşınmaz", "{{property.address}}"], ["Taşınmazın durumu", "{{property.condition}}"]]),
  H2("Teslim edilen demirbaş ve eşyalar"),
  P("{{property.inventory}}"),
  H2("Sayaç değerleri ve anahtarlar"),
  kv([["Elektrik sayacı", "________________"], ["Su sayacı", "________________"], ["Doğalgaz sayacı", "________________"], ["Teslim edilen anahtar adedi", "________________"]]),
  P("Notlar: {{deal.notes}}", { before: 120 }),
  P("Taraflar, taşınmazın yukarıda belirtilen durumda ve eşyalarla birlikte teslim edildiğini kabul ederler.", { before: 120, after: 300 }),
  sign(["TESLİM EDEN\n{{seller.name}}", "TESLİM ALAN\n{{buyer.name}}"]),
]));

// ---------- 5. KVKK aydınlatma ve açık rıza ----------
await save("kvkk_consent_tr.docx", doc([
  H("KİŞİSEL VERİLERİN İŞLENMESİNE İLİŞKİN AYDINLATMA METNİ VE AÇIK RIZA BEYANI"),
  P("Veri Sorumlusu: {{agency.name}} — {{agency.address}} — {{agency.phone}} — {{agency.email}}", { after: 160 }),
  P("6698 sayılı Kişisel Verilerin Korunması Kanunu (KVKK) kapsamında, kimlik, iletişim, adres ve taşınmaz tercihlerinize ilişkin kişisel verileriniz; taşınmaz alım-satım ve kiralama aracılık hizmetlerinin sunulması, sözleşmelerin hazırlanması, yasal yükümlülüklerin yerine getirilmesi ve sizinle iletişim kurulması amaçlarıyla işlenmektedir. Verileriniz, hizmetin gerektirdiği ölçüde taşınmaz sahipleri, noterler, tapu müdürlükleri ve yasal mercilerle paylaşılabilir; hizmet ilişkisi süresince ve yasal saklama süreleri boyunca saklanır. KVKK'nın 11. maddesi kapsamında verilerinize erişme, düzeltme, silinmesini isteme ve işlemeye itiraz etme haklarınız bulunmaktadır; başvurularınızı yukarıdaki iletişim bilgilerinden iletebilirsiniz."),
  H2("Açık Rıza Beyanı"),
  P("Yukarıdaki aydınlatma metnini okudum ve anladım. Kişisel verilerimin belirtilen amaçlarla işlenmesine ve paylaşılmasına açık rızam vardır."),
  kv([["Adı Soyadı", "{{buyer.name}}"], ["T.C. Kimlik / Pasaport No", "{{buyer.idNo}}"], ["Telefon", "{{buyer.phone}}"], ["E-posta", "{{buyer.email}}"], ["Tarih", "{{deal.date}}"]]),
  P("", { after: 200 }),
  sign(["VERİ SAHİBİ\n{{buyer.name}}"]),
]));

// карточка реквизитов компании (TR/EN) — скачивается из настроек CRM, чтобы отправить контрагенту
await save("company_card_tr_en.docx", doc([
  H("FİRMA BİLGİ KARTI / COMPANY DETAILS"),
  P("Tarih / Date: {{deal.date}}", { align: AlignmentType.RIGHT, after: 160 }),
  kv([
    ["Ünvan / Company name", "{{agency.name}}"],
    ["Vergi No / Tax No", "{{agency.taxNo}}"],
    ["Vergi Dairesi / Tax office", "{{agency.taxOffice}}"],
    ["MERSİS No", "{{agency.mersis}}"],
    ["Ticaret Sicil No / Trade registry No", "{{agency.registryNo}}"],
    ["Yetki Belgesi No / Licence No", "{{agency.licenseNo}}"],
    ["Adres / Address", "{{agency.address}}"],
    ["Yetkili / Representative", "{{agency.representative}}"],
    ["Telefon / Phone", "{{agency.phone}}"],
    ["E-posta / E-mail", "{{agency.email}}"],
    ["Banka / Bank", "{{agency.bank}}"],
    ["IBAN", "{{agency.iban}}"],
  ]),
  P("", { after: 300 }),
  sign(["Kaşe / İmza — Stamp / Signature"]),
]));
