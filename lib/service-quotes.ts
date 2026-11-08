import type {Database} from "./db";

export const serviceQuoteSchema = `CREATE TABLE IF NOT EXISTS service_quote_versions (
 organization_id TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES service_jobs(id),
 job_version INTEGER NOT NULL, revision INTEGER NOT NULL,
 lines TEXT NOT NULL, total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
 reason TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(job_id, job_version), UNIQUE(job_id, revision)
)`;

export type QuoteLine = {kind: "item" | "labor"; label: string; quantity: number; unitCents: number};

export function quoteLines(input: unknown): QuoteLine[] | null {
 if (!Array.isArray(input) || !input.length || input.length > 100) return null;
 const lines: QuoteLine[] = [];
 for (const row of input) {
  if (!row || (row.kind !== "item" && row.kind !== "labor") || typeof row.label !== "string") return null;
  const label = row.label.trim();
  if (!label || label.length > 160 || !Number.isSafeInteger(row.quantity) || row.quantity < 1 ||
      !Number.isSafeInteger(row.unitCents) || row.unitCents < 0 || row.unitCents > 10_000_000_000) return null;
  lines.push({kind: row.kind, label, quantity: row.quantity, unitCents: row.unitCents});
 }
 return lines;
}

export function quoteSnapshot(db: Database, organizationId: unknown, jobId: unknown, jobVersion: unknown) {
 return db.prepare(`SELECT revision, lines, total_cents, reason FROM service_quote_versions
  WHERE organization_id=? AND job_id=? AND job_version<=? ORDER BY job_version DESC LIMIT 1`)
  .bind(organizationId, jobId, jobVersion).first<{revision:number; lines:string; total_cents:number; reason:string}>();
}
