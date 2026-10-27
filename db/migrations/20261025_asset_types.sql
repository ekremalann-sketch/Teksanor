-- Firma tanımlı ekipman türleri (klima, jeneratör, asansör… firmanın kendisi ekler).
-- Uygulama açılışta ensureSchema ile de oluşturur; bu dosya elle kurulum ve inceleme içindir.
CREATE TABLE IF NOT EXISTS asset_types (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  default_frequency_type TEXT CHECK (default_frequency_type IN ('day', 'week', 'month', 'year')),
  default_frequency_value INTEGER,
  checklist_text TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, name)
);
