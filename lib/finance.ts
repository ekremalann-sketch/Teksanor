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
