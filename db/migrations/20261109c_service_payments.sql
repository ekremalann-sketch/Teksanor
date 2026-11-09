CREATE TABLE IF NOT EXISTS service_payments (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES service_jobs(id),
 kind TEXT NOT NULL CHECK(kind IN ('payment','refund','void')),
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0),
 method TEXT NOT NULL DEFAULT 'diger' CHECK(method IN ('nakit','havale','kart','diger')),
 reason TEXT NOT NULL DEFAULT '', reverses_id TEXT UNIQUE REFERENCES service_payments(id),
 request_id TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(organization_id, request_id)
);
