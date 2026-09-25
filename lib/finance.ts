export type PaymentAmounts = { totalDebt: number; paidAmount: number };

function parseStrictLocalizedNumber(value: unknown): number | null {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string") return null;
  const raw = value.trim().replace(/^(?:TRY|TL|[₺$€£])\s*/i, "").replace(/\s*(?:TRY|TL|[₺$€£])$/i, "").replace(/\s/g, "");
  if (!raw || !/^-?[0-9.,]+$/.test(raw)) return null;

  const turkishGrouped = /^-?\d{1,3}(?:\.\d{3})+(?:,\d{1,2})?$/.test(raw);
  const englishGrouped = /^-?\d{1,3}(?:,\d{3})+\.\d{1,2}$/.test(raw);
  const plainInteger = /^-?\d+$/.test(raw);
  const decimal = /^-?\d+(?:[.,]\d{1,2})$/.test(raw);
  if (!turkishGrouped && !englishGrouped && !plainInteger && !decimal) return null;
  const normalized = turkishGrouped
    ? raw.replace(/\./g, "").replace(",", ".")
    : englishGrouped ? raw.replace(/,/g, "") : raw.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
}

export function parseLocalizedNumber(value: unknown) {
  return parseStrictLocalizedNumber(value) ?? 0;
}

export function parseOptionalLocalizedNumber(value: unknown, label = "Tutar") {
  if (value === null || value === undefined || value === "") return null;
  const parsed = parseStrictLocalizedNumber(value);
  if (parsed === null) throw new Error(`${label} geçerli bir sayı olmalıdır.`);
  if (parsed < 0) throw new Error(`${label} sıfırdan küçük olamaz.`);
  return parsed;
}

export function nonNegativeNumber(value: unknown) {
  return Math.max(0, parseLocalizedNumber(value));
}

export function remainingDebt({ totalDebt, paidAmount }: PaymentAmounts) {
  const debt = Number.isFinite(totalDebt) ? Math.max(totalDebt, 0) : 0;
  const paid = Number.isFinite(paidAmount) ? Math.max(paidAmount, 0) : 0;
  return Math.max(debt - paid, 0);
}

export function inferredPaymentStatus({ totalDebt, paidAmount }: PaymentAmounts) {
  if (totalDebt > 0 && paidAmount >= totalDebt) return "paid" as const;
  if (paidAmount > 0) return "partial" as const;
  return "planned" as const;
}

export function assertPaymentAmounts({ totalDebt, paidAmount }: PaymentAmounts) {
  if (!Number.isFinite(totalDebt) || !Number.isFinite(paidAmount) || totalDebt < 0 || paidAmount < 0) {
    throw new Error("Borç ve ödeme tutarları sıfırdan küçük olamaz.");
  }
  if (paidAmount > totalDebt && totalDebt > 0) throw new Error("Ödenen tutar toplam borçtan büyük olamaz.");
}

export type PaymentStatus = "planned" | "partial" | "paid" | "overdue";
const paymentStatusAliases: Record<string, PaymentStatus> = {
  planned: "planned", planlandi: "planned", planlandı: "planned", bekliyor: "planned", odenmedi: "planned", ödenmedi: "planned",
  partial: "partial", kismi: "partial", kısmi: "partial", "kismi odendi": "partial", "kısmi ödendi": "partial",
  paid: "paid", odendi: "paid", ödendi: "paid", tamamlandi: "paid", tamamlandı: "paid",
  overdue: "overdue", gecikti: "overdue", gecikmis: "overdue", gecikmiş: "overdue",
};

/** Accepts API codes and the Turkish labels shown in the panel / typed in Excel. */
export function normalizePaymentStatus(value: unknown): PaymentStatus | null {
  if (value === null || value === undefined) return null;
  const key = String(value).trim().toLocaleLowerCase("tr-TR").replace(/\s+/g, " ");
  if (!key) return null;
  return paymentStatusAliases[key] ?? null;
}

/**
 * Validates a payment record without confusing "not entered" (null) with zero.
 * Returns the resolved status or throws a user-facing Turkish message.
 */
export function resolvePaymentStatus(input: { totalDebt: number | null; paidAmount: number | null; status?: unknown }): PaymentStatus {
  const { totalDebt, paidAmount } = input;
  const paid = paidAmount ?? 0;
  if (totalDebt === null && paid > 0) throw new Error("Ödeme kaydetmeden önce toplam borcu girin.");
  if (totalDebt !== null && totalDebt === 0 && paid > 0) throw new Error("Borcu 0 olan kayda ödeme girilemez; önce toplam borcu düzeltin.");
  assertPaymentAmounts({ totalDebt: totalDebt ?? 0, paidAmount: paid });
  const hasStatus = input.status !== undefined && input.status !== null && String(input.status).trim() !== "";
  const status = hasStatus ? normalizePaymentStatus(input.status) : inferredPaymentStatus({ totalDebt: totalDebt ?? 0, paidAmount: paid });
  if (!status) throw new Error("Ödeme durumu geçersiz.");
  if (totalDebt === null && (status === "paid" || status === "partial")) {
    throw new Error("Borç bilinmeden ödeme tamamlandı veya kısmi ödendi olarak işaretlenemez.");
  }
  const debt = totalDebt ?? 0;
  const mismatch =
    (status === "paid" && debt > 0 && paid < debt) ||
    (status === "partial" && (paid <= 0 || paid >= debt)) ||
    (status === "planned" && paid > 0) ||
    (status === "overdue" && debt > 0 && paid >= debt);
  if (mismatch) throw new Error("Ödeme durumu ile ödenen tutar birbiriyle uyuşmuyor.");
  return status;
}

type SpreadsheetCell = unknown;
function cellText(value: SpreadsheetCell): string {
  if (value === null || value === undefined) return "";
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? "" : value.toISOString().slice(0, 10);
  if (typeof value === "object") {
    const cell = value as { result?: unknown; richText?: Array<{ text?: string }>; text?: unknown };
    if (cell.result !== undefined) return cellText(cell.result);
    if (Array.isArray(cell.richText)) return cell.richText.map((part) => part.text ?? "").join("");
    if (cell.text !== undefined) return cellText(cell.text);
    return "";
  }
  return String(value).trim();
}
/** Numeric cells keep their number; blanks stay "" so the server can tell "missing" from 0. */
function cellAmount(value: SpreadsheetCell): number | string {
  if (typeof value === "number") return value;
  if (value && typeof value === "object" && typeof (value as { result?: unknown }).result === "number") return (value as { result: number }).result;
  return cellText(value);
}

/** Maps one spreadsheet row (header → cell) to the /api/payments payload used by Excel/CSV import. */
export function paymentImportPayload(row: Record<string, SpreadsheetCell>, fallbackPeriod: string) {
  const normalize = (key: string) => key.toLocaleLowerCase("tr-TR").replace(/[^a-z0-9ğüşöçı]+/g, " ").trim();
  const keys = Object.keys(row).map((key) => [key, normalize(key)] as const);
  const find = (words: string[], exclude: string[] = []) =>
    keys.find(([, normalized]) => words.every((word) => normalized.includes(word)) && !exclude.some((word) => normalized.includes(word)))?.[0];
  const get = (...alternatives: Array<[string[], string[]?]>) => {
    for (const [words, exclude] of alternatives) { const key = find(words, exclude); if (key !== undefined) return row[key]; }
    return "";
  };
  return {
    period: cellText(get([["dönem"], ["gelecek"]])) || fallbackPeriod,
    ownerName: cellText(get([["kişi"]], [["sahip"]], [["kredi", "kartları"]])) || "Belirtilmedi",
    bankName: cellText(get([["banka"]], [["kredi", "kartları"]])) || "Belirtilmedi",
    accountName: cellText(get([["hesap"]], [["kredi", "kartları"]])) || "Excel aktarımı",
    totalLimit: cellAmount(get([["toplam", "limit"]])),
    totalDebt: cellAmount(get([["toplam", "borç"]])),
    restructuring: cellAmount(get([["yapılandırma"]])),
    monthlyPayment: cellAmount(get([["aylık", "ödeme"]])),
    nextInstallment: cellAmount(get([["gelecek", "dönem"]])),
    overdraftDebt: cellAmount(get([["kmh", "borç"]])),
    overdraftLimit: cellAmount(get([["kmh", "limit"]])),
    interestRate: cellAmount(get([["faiz", "oran"]])),
    interestDebt: cellAmount(get([["faiz", "borç"]])),
    minimumPayment: cellAmount(get([["asgari", "ödeme"]])),
    paidAmount: cellAmount(get([["ödenen", "tutar"]])),
    paymentStatus: cellText(get([["ödeme", "durumu"]], [["durum"]])),
    paidAt: cellText(get([["ödendiği"]], [["ödeme", "tarihi"], ["son"]])),
    dueDate: cellText(get([["son", "ödeme"]], [["vade"]])),
    importantNote: cellText(get([["önemli", "not"]], [["not"], ["kalan", "gelecek", "ödeme", "tutar"]])),
    upsert: true,
  };
}

export const paymentFieldLabels: Record<string, string> = {
  totalLimit: "Toplam limit", totalDebt: "Toplam borç", restructuring: "Yapılandırma", monthlyPayment: "Aylık ödeme",
  nextInstallment: "Gelecek dönem taksit", overdraftDebt: "KMH borcu", overdraftLimit: "KMH limiti", interestRate: "Faiz oranı",
  interestDebt: "Faiz borcu", minimumPayment: "Asgari ödeme", paidAmount: "Ödenen tutar", amount: "Tutar",
};

/** Required, strictly parsed, strictly positive amount (expenses). */
export function parseRequiredPositiveAmount(value: unknown, label = "Tutar") {
  const parsed = parseOptionalLocalizedNumber(value, label);
  if (parsed === null) throw new Error(`${label} gereklidir.`);
  if (parsed === 0) throw new Error(`${label} sıfırdan büyük olmalıdır.`);
  return parsed;
}
