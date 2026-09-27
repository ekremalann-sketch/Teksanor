// E-fatura TASLAĞI: UBL 2.1 biçiminde muhasebe ön taslağı; EN 16931 uyumu doğrulanmadı.
// Bu dosya bir entegratöre (GİB e-Fatura, Peppol erişim noktası) GÖNDERİLMEZ; muhasebeciye
// veya entegratör paneline yüklemek için taslaktır. Eksik zorunlu bilgiler <cbc:Note> ile yazılır.
// Tutarlar kuruş (tamsayı) ile hesaplanır; kayan nokta yuvarlama hatası olmaz.

export const VAT_RATES = [0, 1, 10, 20] as const;
export type InvoiceInput = {
  number: string; issueDate: string; currency: "TRY" | "EUR";
  seller: { name: string; legalName?: string | null; taxNumber?: string | null; taxOffice?: string | null; address?: string | null; email?: string | null };
  buyer: { name: string; address?: string | null };
  lineDescription: string; netCents: number; vatRate: number; paidCents: number; orderReference?: string;
};

const esc = (v: unknown) => String(v ?? "").replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g, "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&apos;");
const amount = (cents: number) => `${cents < 0 ? "-" : ""}${Math.floor(Math.abs(cents) / 100)}.${String(Math.abs(cents) % 100).padStart(2, "0")}`;

export function invoiceTotals(netCents: number, vatRate: number, paidCents: number) {
  if (!Number.isInteger(netCents) || netCents < 0) throw new Error("Fatura tutarı geçersiz.");
  if (!(VAT_RATES as readonly number[]).includes(vatRate)) throw new Error("KDV oranı 0, 1, 10 veya 20 olmalı.");
  const vatCents = Math.round((netCents * vatRate) / 100);
  const grossCents = netCents + vatCents;
  const prepaid = Math.min(Math.max(0, paidCents), grossCents);
  return { netCents, vatCents, grossCents, prepaidCents: prepaid, payableCents: grossCents - prepaid };
}

export function missingForCompliance(input: InvoiceInput) {
  const missing: string[] = [];
  if (!input.seller.taxNumber) missing.push("satıcı vergi numarası");
  if (!input.seller.address) missing.push("satıcı adresi");
  if (!input.buyer.address) missing.push("alıcı adresi");
  return missing;
}

export function buildUblInvoice(input: InvoiceInput) {
  const t = invoiceTotals(input.netCents, input.vatRate, input.paidCents);
  const c = esc(input.currency);
  const missing = missingForCompliance(input);
  const sellerName = input.seller.legalName || input.seller.name;
  const party = (name: string, extra = "") => `<cac:Party><cac:PartyName><cbc:Name>${esc(name)}</cbc:Name></cac:PartyName>${extra}</cac:Party>`;
  const address = (a?: string | null) => a ? `<cac:PostalAddress><cbc:StreetName>${esc(a)}</cbc:StreetName><cac:Country><cbc:IdentificationCode>TR</cbc:IdentificationCode></cac:Country></cac:PostalAddress>` : "";
  const sellerTax = input.seller.taxNumber ? `<cac:PartyTaxScheme><cbc:CompanyID>${esc(input.seller.taxNumber)}</cbc:CompanyID><cac:TaxScheme><cbc:ID>VAT</cbc:ID>${input.seller.taxOffice ? `<cbc:Name>${esc(input.seller.taxOffice)}</cbc:Name>` : ""}</cac:TaxScheme></cac:PartyTaxScheme>` : "";
  const category = input.vatRate === 0 ? "Z" : "S";
  return `<?xml version="1.0" encoding="UTF-8"?>
<Invoice xmlns="urn:oasis:names:specification:ubl:schema:xsd:Invoice-2" xmlns:cac="urn:oasis:names:specification:ubl:schema:xsd:CommonAggregateComponents-2" xmlns:cbc="urn:oasis:names:specification:ubl:schema:xsd:CommonBasicComponents-2">
  <cbc:CustomizationID>urn:teksanor:accounting-draft:1</cbc:CustomizationID>
  <cbc:ID>${esc(input.number)}</cbc:ID>
  <cbc:IssueDate>${esc(input.issueDate)}</cbc:IssueDate>
  <cbc:InvoiceTypeCode>380</cbc:InvoiceTypeCode>
  <cbc:Note>TASLAK: Teksanor servis kaydından üretilmiştir; resmî e-fatura değildir. Entegratör veya muhasebe kontrolünden sonra düzenlenmelidir.</cbc:Note>
  ${missing.length ? `<cbc:Note>Eksik bilgi: ${esc(missing.join(", "))}.</cbc:Note>` : ""}
  <cbc:DocumentCurrencyCode>${c}</cbc:DocumentCurrencyCode>
  ${input.orderReference ? `<cac:OrderReference><cbc:ID>${esc(input.orderReference)}</cbc:ID></cac:OrderReference>` : ""}
  <cac:AccountingSupplierParty>${party(input.seller.name, `${address(input.seller.address)}${sellerTax}<cac:PartyLegalEntity><cbc:RegistrationName>${esc(sellerName)}</cbc:RegistrationName></cac:PartyLegalEntity>${input.seller.email ? `<cac:Contact><cbc:ElectronicMail>${esc(input.seller.email)}</cbc:ElectronicMail></cac:Contact>` : ""}`)}</cac:AccountingSupplierParty>
  <cac:AccountingCustomerParty>${party(input.buyer.name, `${address(input.buyer.address)}<cac:PartyLegalEntity><cbc:RegistrationName>${esc(input.buyer.name)}</cbc:RegistrationName></cac:PartyLegalEntity>`)}</cac:AccountingCustomerParty>
  <cac:TaxTotal>
    <cbc:TaxAmount currencyID="${c}">${amount(t.vatCents)}</cbc:TaxAmount>
    <cac:TaxSubtotal>
      <cbc:TaxableAmount currencyID="${c}">${amount(t.netCents)}</cbc:TaxableAmount>
      <cbc:TaxAmount currencyID="${c}">${amount(t.vatCents)}</cbc:TaxAmount>
      <cac:TaxCategory><cbc:ID>${category}</cbc:ID><cbc:Percent>${input.vatRate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:TaxCategory>
    </cac:TaxSubtotal>
  </cac:TaxTotal>
  <cac:LegalMonetaryTotal>
    <cbc:LineExtensionAmount currencyID="${c}">${amount(t.netCents)}</cbc:LineExtensionAmount>
    <cbc:TaxExclusiveAmount currencyID="${c}">${amount(t.netCents)}</cbc:TaxExclusiveAmount>
    <cbc:TaxInclusiveAmount currencyID="${c}">${amount(t.grossCents)}</cbc:TaxInclusiveAmount>
    <cbc:PrepaidAmount currencyID="${c}">${amount(t.prepaidCents)}</cbc:PrepaidAmount>
    <cbc:PayableAmount currencyID="${c}">${amount(t.payableCents)}</cbc:PayableAmount>
  </cac:LegalMonetaryTotal>
  <cac:InvoiceLine>
    <cbc:ID>1</cbc:ID>
    <cbc:InvoicedQuantity unitCode="C62">1</cbc:InvoicedQuantity>
    <cbc:LineExtensionAmount currencyID="${c}">${amount(t.netCents)}</cbc:LineExtensionAmount>
    <cac:Item><cbc:Name>${esc(input.lineDescription)}</cbc:Name><cac:ClassifiedTaxCategory><cbc:ID>${category}</cbc:ID><cbc:Percent>${input.vatRate}</cbc:Percent><cac:TaxScheme><cbc:ID>VAT</cbc:ID></cac:TaxScheme></cac:ClassifiedTaxCategory></cac:Item>
    <cac:Price><cbc:PriceAmount currencyID="${c}">${amount(t.netCents)}</cbc:PriceAmount></cac:Price>
  </cac:InvoiceLine>
</Invoice>
`;
}
