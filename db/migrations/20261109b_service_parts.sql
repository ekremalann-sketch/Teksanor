CREATE TABLE IF NOT EXISTS service_parts (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL REFERENCES organizations(id),
 code TEXT NOT NULL, name TEXT NOT NULL,
 unit_cost_cents INTEGER NOT NULL DEFAULT 0 CHECK(unit_cost_cents >= 0),
 on_hand INTEGER NOT NULL DEFAULT 0 CHECK(on_hand >= 0),
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(organization_id, code)
);
CREATE TABLE IF NOT EXISTS service_job_parts (
 organization_id TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES service_jobs(id),
 part_id TEXT NOT NULL REFERENCES service_parts(id),
 reserved INTEGER NOT NULL DEFAULT 0 CHECK(reserved >= 0), used INTEGER NOT NULL DEFAULT 0 CHECK(used >= 0),
 PRIMARY KEY(job_id, part_id)
);
CREATE TABLE IF NOT EXISTS service_part_movements (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, part_id TEXT NOT NULL REFERENCES service_parts(id), job_id TEXT,
 kind TEXT NOT NULL CHECK(kind IN ('receive','reserve','consume','return')),
 quantity INTEGER NOT NULL CHECK(quantity > 0), unit_cost_cents INTEGER NOT NULL DEFAULT 0,
 request_id TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(organization_id, request_id)
);
