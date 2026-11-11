CREATE TABLE IF NOT EXISTS service_expenses (
 id TEXT PRIMARY KEY, organization_id TEXT NOT NULL, spent_on TEXT NOT NULL, description TEXT NOT NULL,
 amount_cents INTEGER NOT NULL CHECK(amount_cents > 0), method TEXT NOT NULL CHECK(method IN ('nakit','havale','kart','diger')),
 request_id TEXT NOT NULL, actor_id TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE(organization_id, request_id)
);
