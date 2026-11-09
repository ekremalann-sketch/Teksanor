// Servis parça ve depo hareketleri. Stok yalnız sunucuda değişir ve eksiye inmez.
// Ayırma: depo → iş (rezerve). Kullanım: rezerve → kullanılan. İade: rezerve → depo.
// Her hareket firma içinde benzersiz bir istek kimliği taşır; aynı gönderim ikinci hareket üretmez.
export const servicePartSchemas = [
`CREATE TABLE IF NOT EXISTS service_parts (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
 code TEXT NOT NULL, name TEXT NOT NULL,
 unit_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK(unit_cost_cents >= 0),
 on_hand INTEGER NOT NULL DEFAULT 0 CHECK(on_hand >= 0),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(organization_id, code)
)`,
`CREATE TABLE IF NOT EXISTS service_job_parts (
 organization_id TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES service_jobs(id),
 part_id TEXT NOT NULL REFERENCES service_parts(id),
 reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved >= 0), used INTEGER NOT NULL DEFAULT 0 CHECK(used >= 0),
 PRIMARY KEY(job_id, part_id)
)`,
`CREATE TABLE IF NOT EXISTS service_part_movements (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, part_id TEXT NOT NULL REFERENCES service_parts(id), job_id TEXT,
 kind TEXT NOT NULL CHECK(kind IN ('receive','reserve','consume','return')),
 quantity INTEGER NOT NULL CHECK(quantity > 0), unit_cost_cents INTEGER NOT NULL DEFAULT 0,
 request_id TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(organization_id, request_id)
)`,
];

export const PART_MOVE_KINDS = ["reserve", "consume", "return"] as const;
export type PartMoveKind = typeof PART_MOVE_KINDS[number];

/** 1–10.000 arası tam sayı miktar; geçersizse null. */
export function partQuantity(value: unknown): number | null {
 const n = typeof value === "string" && value.trim() !== "" ? Number(value) : value;
 return typeof n === "number" && Number.isSafeInteger(n) && n >= 1 && n <= 10_000 ? n : null;
}

/** İstemcinin ürettiği tekrar koruma kimliği: 8–100 karakter, yalnız harf, rakam, - ve _. */
export function partRequestId(value: unknown): string | null {
 return typeof value === "string" && /^[A-Za-z0-9_-]{8,100}$/.test(value) ? value : null;
}
