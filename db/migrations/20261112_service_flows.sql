-- T5: firmanın kendi iş akışı (teknik servis akışına eklenen aşamalar, ad değişiklikleri, zorunlu alanlar).
CREATE TABLE IF NOT EXISTS service_flows (
 organization_id TEXT NOT NULL,
 flow_key TEXT NOT NULL,
 version INTEGER NOT NULL DEFAULT 1,
 custom_json TEXT NOT NULL DEFAULT '{}',
 updated_by TEXT,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 PRIMARY KEY (organization_id, flow_key)
);
