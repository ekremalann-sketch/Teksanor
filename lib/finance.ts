export type PaymentAmounts = { totalDebt: number; paidAmount: number };

export function parseLocalizedNumber(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value instanceof Date) return 0;
  const raw = String(value ?? "").trim();
  if (!raw) return 0;
  const cleaned = raw
    .replace(/[₺$€£\s]/g, "")
    .replace(/[^0-9,.-]/g, "");
  if (!cleaned || cleaned === "-" || cleaned === "," || cleaned === ".") return 0;

  const hasComma = cleaned.includes(",");
  const hasDot = cleaned.includes(".");
  let normalized = cleaned;

  if (hasComma && hasDot) {
    normalized = cleaned.lastIndexOf(",") > cleaned.lastIndexOf(".")
      ? cleaned.replace(/\./g, "").replace(",", ".")
      : cleaned.replace(/,/g, "");
  } else if (hasComma) {
    normalized = cleaned.replace(",", ".");
  } else if ((cleaned.match(/\./g) ?? []).length > 1) {
    normalized = cleaned.replace(/\./g, "");
  }

  const number = Number(normalized);
  return Number.isFinite(number) ? number : 0;
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
