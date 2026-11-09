// Servis tahsilat hareketleri. Her tahsilat, iade ve iptal ayrı bir kayıttır; kayıtlar silinmez.
// Ödenen toplam (service_jobs.paid_cents) yalnız bu hareketlerle ve aynı veritabanı işleminde değişir.
//  payment: müşteriden alınan para · refund: müşteriye geri ödenen para (gerekçeli)
//  void: hatalı girilmiş bir tahsilat kaydının iptali (gerekçeli, bir kayıt yalnız bir kez iptal edilir)
export const servicePaymentSchemas = [
`CREATE TABLE IF NOT EXISTS service_payments (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES service_jobs(id),
 kind TEXT NOT NULL CHECK(kind IN ('payment','refund','void')),
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
 method TEXT NOT NULL DEFAULT 'diger' CHECK(method IN ('nakit','havale','kart','diger')),
 reason TEXT NOT NULL DEFAULT '', reverses_id TEXT UNIQUE REFERENCES service_payments(id),
 request_id TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(organization_id, request_id)
)`,
];

export const PAYMENT_METHODS = ["nakit", "havale", "kart", "diger"] as const;
/** Tahsilat alınabilen aşamalar: teklif onayından müşteri rapor onayına kadar. */
export const PAYMENT_STAGES = ["quote_approved", "in_progress", "completed", "accepted"];

/** Kuruş cinsinden 1 kuruş – 100.000.000 TL arası tam sayı; geçersizse null. */
export function paymentAmount(value: unknown): number | null {
 return typeof value === "number" && Number.isSafeInteger(value) && value >= 1 && value <= 10_000_000_000 ? value : null;
}

export function paymentMethod(value: unknown): typeof PAYMENT_METHODS[number] | null {
 return PAYMENT_METHODS.find(method => method === value) ?? null;
}
