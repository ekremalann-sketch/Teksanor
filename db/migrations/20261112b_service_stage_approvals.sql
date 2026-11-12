-- T12: akıştaki onay adımı. İş, onay aşamasından ancak bu tabloda o sürüm için onay varsa ileri geçer.
CREATE TABLE IF NOT EXISTS service_stage_approvals (
 organization_id TEXT NOT NULL,
 job_id TEXT NOT NULL,
 stage TEXT NOT NULL,
 job_version INTEGER NOT NULL,
 approved_by TEXT NOT NULL,
 approved_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (job_id, stage, job_version)
);
