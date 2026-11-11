CREATE TABLE IF NOT EXISTS service_tracking (
 job_id TEXT PRIMARY KEY REFERENCES service_jobs(id), organization_id TEXT NOT NULL,
 code_hash TEXT NOT NULL UNIQUE, created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);
