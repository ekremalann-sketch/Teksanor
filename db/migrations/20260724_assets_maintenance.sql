CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'Ekipman',
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  location TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'maintenance', 'inactive', 'retired')) DEFAULT 'active',
  responsible_name TEXT,
  purchase_date TEXT,
  warranty_end TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, asset_code)
);

CREATE TABLE IF NOT EXISTS maintenance_plans (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  asset_id TEXT NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  frequency_type TEXT NOT NULL CHECK (frequency_type IN ('day', 'week', 'month', 'year', 'usage')) DEFAULT 'month',
  frequency_value INTEGER NOT NULL DEFAULT 1,
  next_due_date TEXT,
  assigned_to TEXT,
  checklist_text TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'paused', 'completed')) DEFAULT 'active',
  last_completed_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS assets_org_status_idx ON assets (organization_id, status);
CREATE INDEX IF NOT EXISTS maintenance_org_due_idx ON maintenance_plans (organization_id, next_due_date, status);
