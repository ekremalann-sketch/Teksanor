// Finansal yardımcılar: yerelleştirilmiş sayı ayrıştırma ve ödeme kuralları.

export function parseLocalizedNumber(value: unknown): number {
  if (typeof value === "number") return Number.isFinite(value) ? value : 0;
  if (value === null || value === undefined) return 0;
  let text = String(value).trim();
  if (!text) return 0;
  text = text.replace(/[^\d.,-]/g, "");
  // Türkçe format: 1.234,56 -> 1234.56
  if (text.includes(",") && text.includes(".")) {
    text = text.replace(/\./g, "").replace(",", ".");
  } else if (text.includes(",")) {
    text = text.replace(",", ".");
  }
  const num = Number(text);
  return Number.isFinite(num) ? num : 0;
}

// Boş bırakılan alanlar için null döndürür; geçersizse hata fırlatır.
export function parseOptionalLocalizedNumber(value: unknown, field: string): number | null {
  if (value === null || value === undefined || String(value).trim() === "") return null;
  const num = parseLocalizedNumber(value);
  if (!Number.isFinite(num) || num < 0) {
    throw new Error(`${field} alanı geçerli bir tutar olmalıdır.`);
  }
  return num;
}

export function assertPaymentAmounts(input: { totalDebt: number; paidAmount: number }): void {
  if (input.totalDebt < 0 || input.paidAmount < 0) {
    throw new Error("Tutarlar negatif olamaz.");
  }
  if (input.paidAmount > input.totalDebt && input.totalDebt > 0) {
    throw new Error("Ödenen tutar toplam borçtan fazla olamaz.");
  }
}

export function inferredPaymentStatus(input: { totalDebt: number; paidAmount: number }): string {
  if (input.totalDebt <= 0) return "planned";
  if (input.paidAmount <= 0) return "planned";
  if (input.paidAmount >= input.totalDebt) return "paid";
  return "partial";
}
