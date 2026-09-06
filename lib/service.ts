import {getDb,type Database} from "./db";
export const serviceSchema=[
`CREATE TABLE IF NOT EXISTS service_jobs (
 id TEXT PRIMARY KEY REFERENCES work_orders(id), organization_id TEXT NOT NULL REFERENCES organizations(id),
 asset_id TEXT, assigned_user_id TEXT REFERENCES users(id), outcome TEXT NOT NULL DEFAULT '',
 stage TEXT NOT NULL DEFAULT 'requested', version INTEGER NOT NULL DEFAULT 1,
 quote_cents INTEGER NOT NULL DEFAULT 0 CHECK(quote_cents>=0), labor_cents INTEGER NOT NULL DEFAULT 0 CHECK(labor_cents>=0),
 parts_cents INTEGER NOT NULL DEFAULT 0 CHECK(parts_cents>=0), travel_cents INTEGER NOT NULL DEFAULT 0 CHECK(travel_cents>=0),
 paid_cents INTEGER NOT NULL DEFAULT 0 CHECK(paid_cents>=0), currency TEXT NOT NULL DEFAULT 'TRY',
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS service_approvals (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, job_id TEXT NOT NULL REFERENCES service_jobs(id),
 token_hash TEXT NOT NULL UNIQUE, purpose TEXT NOT NULL, job_version INTEGER NOT NULL,
 expires_at TEXT NOT NULL, approved_at TEXT, approved_by TEXT, revoked_at TEXT,
 created_by TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE INDEX IF NOT EXISTS service_org_stage ON service_jobs(organization_id,stage)`,
];
export async function initializeService(db:Database){for(const sql of serviceSchema)await db.prepare(sql).run();}
export function cents(value:unknown){const n=Number(value);if(!Number.isFinite(n)||n<0||n>100000000)throw new Error("Tutar 0–100.000.000 TL arasında olmalı.");return Math.round(n*100);}
export const transitions:Record<string,string[]>={requested:["quoted","cancelled"],quoted:["requested","cancelled"],quote_approved:["in_progress","cancelled"],in_progress:["completed","cancelled"],completed:["in_progress"],accepted:["collected"],collected:[],cancelled:[]};
export function validateTransition(current:string,next:string){if(current!==next&&!transitions[current]?.includes(next))throw new Error("Bu durum değişikliği için önceki adımları tamamlayın.");}
export function totals(job:{quote_cents:number;labor_cents:number;parts_cents:number;travel_cents:number;paid_cents:number}){const cost=job.labor_cents+job.parts_cents+job.travel_cents;return {cost_cents:cost,margin_cents:job.quote_cents-cost,remaining_cents:Math.max(0,job.quote_cents-job.paid_cents)};}
export async function serviceJob(id:string,organizationId:string){return getDb().prepare(`SELECT w.title,w.description,w.customer_name,w.location,w.scheduled_date,w.order_number,w.assigned_to,s.*,a.name AS asset_name,a.asset_code
 FROM service_jobs s JOIN work_orders w ON w.id=s.id AND w.organization_id=s.organization_id
 LEFT JOIN assets a ON a.id=s.asset_id AND a.organization_id=s.organization_id WHERE s.id=? AND s.organization_id=?`).bind(id,organizationId).first<Record<string,unknown>>();}
