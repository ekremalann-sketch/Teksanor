CREATE TABLE IF NOT EXISTS service_quote_versions (
 organization_id TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES service_jobs(id),
 job_version INTEGER NOT NULL, revision INTEGER NOT NULL,
 lines TEXT NOT NULL, total_cents INTEGER NOT NULL CHECK(total_cents >= 0),
 reason TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY(job_id, job_version), UNIQUE(job_id, revision)
);
