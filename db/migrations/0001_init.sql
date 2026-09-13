-- Teksanor operasyon veritabanı şeması (Cloudflare D1 / SQLite)
-- Tüm tablolar firma bazlı (organization_id) çok kiracılı izolasyon içindir.

CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT UNIQUE,
  sector TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  mfa_secret TEXT,
  mfa_enabled INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS organization_members (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, user_id)
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  expires_at TEXT NOT NULL,
  ip TEXT,
  user_agent TEXT
);

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  sector TEXT,
  status TEXT NOT NULL DEFAULT 'lead',
  total_value REAL NOT NULL DEFAULT 0,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_interactions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  interaction_type TEXT NOT NULL DEFAULT 'note',
  interaction_date TEXT,
  summary TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  full_name TEXT NOT NULL,
  title TEXT,
  department TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  start_date TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  employment_type TEXT NOT NULL DEFAULT 'full_time',
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS assets (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  asset_code TEXT NOT NULL,
  name TEXT NOT NULL,
  category TEXT,
  brand TEXT,
  model TEXT,
  serial_number TEXT,
  location TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  responsible_name TEXT,
  purchase_date TEXT,
  warranty_end TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, asset_code)
);

CREATE TABLE IF NOT EXISTS maintenance_plans (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  asset_id TEXT NOT NULL,
  title TEXT NOT NULL,
  frequency_type TEXT NOT NULL DEFAULT 'month',
  frequency_value INTEGER NOT NULL DEFAULT 1,
  next_due_date TEXT,
  assigned_to TEXT,
  checklist_text TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  order_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  customer_name TEXT,
  location TEXT,
  department TEXT,
  order_type TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  assigned_to TEXT,
  assigned_user_id TEXT,
  scheduled_date TEXT,
  estimated_hours REAL NOT NULL DEFAULT 0,
  notes TEXT,
  -- Servis masası alanları
  stage TEXT NOT NULL DEFAULT 'requested',
  outcome TEXT,
  asset_id TEXT,
  quote_cents INTEGER NOT NULL DEFAULT 0,
  labor_cents INTEGER NOT NULL DEFAULT 0,
  parts_cents INTEGER NOT NULL DEFAULT 0,
  travel_cents INTEGER NOT NULL DEFAULT 0,
  paid_cents INTEGER NOT NULL DEFAULT 0,
  version INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS field_visits (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  visit_number TEXT NOT NULL,
  work_order_id TEXT,
  visitor_name TEXT NOT NULL,
  customer_name TEXT,
  location TEXT NOT NULL,
  visit_date TEXT NOT NULL,
  visit_type TEXT NOT NULL DEFAULT 'other',
  status TEXT NOT NULL DEFAULT 'planned',
  duration_hours REAL NOT NULL DEFAULT 0,
  findings TEXT,
  actions_taken TEXT,
  next_visit_date TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_records (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  period TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  bank_name TEXT NOT NULL,
  account_name TEXT NOT NULL,
  total_limit REAL NOT NULL DEFAULT 0,
  total_debt REAL NOT NULL DEFAULT 0,
  restructuring REAL NOT NULL DEFAULT 0,
  monthly_payment REAL NOT NULL DEFAULT 0,
  next_installment REAL NOT NULL DEFAULT 0,
  overdraft_debt REAL NOT NULL DEFAULT 0,
  overdraft_limit REAL NOT NULL DEFAULT 0,
  interest_rate REAL NOT NULL DEFAULT 0,
  interest_debt REAL NOT NULL DEFAULT 0,
  minimum_payment REAL NOT NULL DEFAULT 0,
  paid_amount REAL NOT NULL DEFAULT 0,
  due_date TEXT,
  important_note TEXT,
  payment_status TEXT NOT NULL DEFAULT 'planned',
  paid_at TEXT,
  missing_fields TEXT NOT NULL DEFAULT '[]',
  workflow_status TEXT NOT NULL DEFAULT 'submitted',
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS period_summaries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  period TEXT NOT NULL,
  total_debt REAL NOT NULL DEFAULT 0,
  total_paid REAL NOT NULL DEFAULT 0,
  record_count INTEGER NOT NULL DEFAULT 0,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (organization_id, period)
);

CREATE TABLE IF NOT EXISTS procurement_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  request_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  department TEXT NOT NULL,
  requested_by TEXT,
  supplier_name TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT NOT NULL DEFAULT 'adet',
  unit_price REAL NOT NULL DEFAULT 0,
  total_price REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TRY',
  status TEXT NOT NULL DEFAULT 'pending',
  priority TEXT NOT NULL DEFAULT 'normal',
  required_date TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS risks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  department TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other',
  likelihood TEXT NOT NULL DEFAULT 'medium',
  impact TEXT NOT NULL DEFAULT 'medium',
  status TEXT NOT NULL DEFAULT 'identified',
  owner_name TEXT,
  mitigation_plan TEXT,
  review_date TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  department TEXT NOT NULL,
  assignee_name TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  due_date TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL DEFAULT 'manual',
  action_type TEXT NOT NULL DEFAULT 'notify',
  is_active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  code TEXT,
  name TEXT NOT NULL,
  description TEXT,
  customer_name TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  progress INTEGER NOT NULL DEFAULT 0,
  budget REAL NOT NULL DEFAULT 0,
  start_date TEXT,
  end_date TEXT,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  description TEXT,
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TRY',
  expense_date TEXT,
  status TEXT NOT NULL DEFAULT 'recorded',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS treasury_accounts (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  account_name TEXT NOT NULL,
  bank_name TEXT,
  currency TEXT NOT NULL DEFAULT 'TRY',
  balance REAL NOT NULL DEFAULT 0,
  account_type TEXT NOT NULL DEFAULT 'bank',
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  object_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT,
  size_bytes INTEGER NOT NULL DEFAULT 0,
  record_type TEXT,
  record_id TEXT,
  uploaded_by TEXT NOT NULL,
  scan_status TEXT NOT NULL DEFAULT 'clean',
  scan_details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_links (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  work_order_id TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  purpose TEXT NOT NULL DEFAULT 'quote',
  expires_at TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at TEXT,
  decision TEXT
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL,
  user_id TEXT,
  title TEXT NOT NULL,
  body TEXT,
  level TEXT NOT NULL DEFAULT 'info',
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  organization_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  entity TEXT NOT NULL,
  entity_id TEXT,
  message TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_work_orders_org ON work_orders (organization_id);
CREATE INDEX IF NOT EXISTS idx_customers_org ON customers (organization_id);
CREATE INDEX IF NOT EXISTS idx_field_visits_org ON field_visits (organization_id);
CREATE INDEX IF NOT EXISTS idx_maintenance_org ON maintenance_plans (organization_id);
CREATE INDEX IF NOT EXISTS idx_audit_org ON audit_log (organization_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions (user_id);
