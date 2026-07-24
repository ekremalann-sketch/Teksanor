import { env } from "cloudflare:workers";

type Statement = {
  bind: (...values: unknown[]) => Statement;
  first: <T = Record<string, unknown>>() => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<{ success: boolean; meta?: Record<string, unknown> }>;
};

export type Database = {
  exec: (sql: string) => Promise<unknown>;
  prepare: (sql: string) => Statement;
  batch: (statements: Statement[]) => Promise<unknown[]>;
};

export function getDb(): Database {
  const database = (env as unknown as { DB?: Database }).DB;
  if (!database) throw new Error("Veri tabanı bağlantısı hazır değil.");
  return database;
}

const schemaStatements = [
`CREATE TABLE IF NOT EXISTS app_metadata (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT,
  email TEXT NOT NULL UNIQUE,
  full_name TEXT NOT NULL,
  password_hash TEXT NOT NULL,
  password_salt TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'user')) DEFAULT 'user',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS organizations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  kind TEXT NOT NULL CHECK (kind IN ('business', 'personal')) DEFAULT 'business',
  plan TEXT NOT NULL DEFAULT 'trial',
  subscription_status TEXT NOT NULL CHECK (subscription_status IN ('trialing', 'active', 'past_due', 'canceled')) DEFAULT 'trialing',
  trial_ends_at TEXT,
  active INTEGER NOT NULL DEFAULT 1,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS organization_profiles (
  organization_id TEXT PRIMARY KEY REFERENCES organizations(id) ON DELETE CASCADE,
  legal_name TEXT,
  tax_office TEXT,
  tax_number TEXT,
  mersis_number TEXT,
  trade_registry_number TEXT,
  sector TEXT,
  phone TEXT,
  email TEXT,
  website TEXT,
  address TEXT,
  about TEXT,
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS organization_members (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('owner', 'admin', 'member')) DEFAULT 'member',
  active INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, user_id)
)`,
`CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS auth_attempts (
  id TEXT PRIMARY KEY,
  fingerprint_hash TEXT NOT NULL,
  action TEXT NOT NULL CHECK (action IN ('login', 'register')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS period_summaries (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL UNIQUE,
  total_limit REAL NOT NULL DEFAULT 0,
  total_debt REAL NOT NULL DEFAULT 0,
  restructuring REAL NOT NULL DEFAULT 0,
  monthly_payment REAL NOT NULL DEFAULT 0,
  next_installment REAL NOT NULL DEFAULT 0,
  overdraft_debt REAL NOT NULL DEFAULT 0,
  overdraft_limit REAL NOT NULL DEFAULT 0,
  minimum_payment REAL NOT NULL DEFAULT 0,
  expense_total REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0
)`,
`CREATE TABLE IF NOT EXISTS organization_period_summaries (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  period TEXT NOT NULL,
  total_limit REAL NOT NULL DEFAULT 0,
  total_debt REAL NOT NULL DEFAULT 0,
  restructuring REAL NOT NULL DEFAULT 0,
  monthly_payment REAL NOT NULL DEFAULT 0,
  next_installment REAL NOT NULL DEFAULT 0,
  overdraft_debt REAL NOT NULL DEFAULT 0,
  overdraft_limit REAL NOT NULL DEFAULT 0,
  minimum_payment REAL NOT NULL DEFAULT 0,
  expense_total REAL NOT NULL DEFAULT 0,
  sort_order INTEGER NOT NULL DEFAULT 0,
  UNIQUE (organization_id, period)
)`,
`CREATE TABLE IF NOT EXISTS payment_records (
  id TEXT PRIMARY KEY,
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
  payment_status TEXT NOT NULL CHECK (payment_status IN ('planned', 'partial', 'paid', 'overdue')) DEFAULT 'planned',
  paid_at TEXT,
  due_date TEXT,
  important_note TEXT,
  workflow_status TEXT NOT NULL CHECK (workflow_status IN ('draft', 'submitted', 'approved')) DEFAULT 'draft',
  created_by TEXT REFERENCES users(id),
  updated_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS expenses (
  id TEXT PRIMARY KEY,
  period TEXT NOT NULL,
  owner_name TEXT NOT NULL,
  category TEXT NOT NULL,
  description TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  due_date TEXT,
  payment_status TEXT NOT NULL DEFAULT 'planned',
  workflow_status TEXT NOT NULL CHECK (workflow_status IN ('draft', 'submitted', 'approved')) DEFAULT 'draft',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS cash_balances (
  id TEXT PRIMARY KEY,
  account_name TEXT NOT NULL,
  currency TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  manual_rate REAL,
  note TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS manual_debts (
  id TEXT PRIMARY KEY,
  lender_name TEXT NOT NULL,
  debt_type TEXT NOT NULL DEFAULT 'cash',
  currency TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  manual_rate REAL,
  due_date TEXT,
  note TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'paid')) DEFAULT 'open',
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS reference_rates (
  code TEXT PRIMARY KEY,
  rate_try REAL NOT NULL DEFAULT 0,
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS organization_reference_rates (
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  rate_try REAL NOT NULL DEFAULT 0,
  updated_by TEXT REFERENCES users(id),
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (organization_id, code)
)`,
`CREATE TABLE IF NOT EXISTS attachments (
  id TEXT PRIMARY KEY,
  object_key TEXT NOT NULL UNIQUE,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  record_type TEXT,
  record_id TEXT,
  uploaded_by TEXT NOT NULL REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  user_id TEXT REFERENCES users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  details TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS tasks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  department TEXT NOT NULL,
  assignee_name TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'in_progress', 'done', 'cancelled')) DEFAULT 'open',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'critical')) DEFAULT 'normal',
  due_date TEXT,
  completed_at TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS assets (
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
)`,
`CREATE TABLE IF NOT EXISTS maintenance_plans (
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
)`,
`CREATE INDEX IF NOT EXISTS assets_org_status_idx ON assets (organization_id, status)`,
`CREATE INDEX IF NOT EXISTS maintenance_org_due_idx ON maintenance_plans (organization_id, next_due_date, status)`,
`CREATE TABLE IF NOT EXISTS work_orders (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  order_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  customer_name TEXT,
  location TEXT,
  department TEXT NOT NULL DEFAULT 'Operasyon yönetimi',
  order_type TEXT NOT NULL CHECK (order_type IN ('maintenance', 'repair', 'installation', 'inspection', 'other')) DEFAULT 'other',
  status TEXT NOT NULL CHECK (status IN ('open', 'assigned', 'in_progress', 'completed', 'cancelled')) DEFAULT 'open',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'critical')) DEFAULT 'normal',
  assigned_to TEXT,
  scheduled_date TEXT,
  completed_date TEXT,
  estimated_hours REAL DEFAULT 0,
  actual_hours REAL DEFAULT 0,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS field_visits (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  visit_number TEXT NOT NULL,
  work_order_id TEXT REFERENCES work_orders(id),
  visitor_name TEXT NOT NULL,
  customer_name TEXT,
  location TEXT NOT NULL,
  visit_date TEXT NOT NULL,
  visit_type TEXT NOT NULL CHECK (visit_type IN ('inspection', 'installation', 'maintenance', 'support', 'audit', 'other')) DEFAULT 'other',
  status TEXT NOT NULL CHECK (status IN ('planned', 'completed', 'cancelled')) DEFAULT 'planned',
  duration_hours REAL DEFAULT 0,
  findings TEXT,
  actions_taken TEXT,
  next_visit_date TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS procurement_requests (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  request_number TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  department TEXT NOT NULL,
  requested_by TEXT,
  supplier_name TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit TEXT DEFAULT 'adet',
  unit_price REAL DEFAULT 0,
  total_price REAL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TRY',
  status TEXT NOT NULL CHECK (status IN ('draft', 'pending', 'approved', 'ordered', 'delivered', 'cancelled')) DEFAULT 'draft',
  priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'critical')) DEFAULT 'normal',
  required_date TEXT,
  order_date TEXT,
  delivery_date TEXT,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  company_name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  sector TEXT,
  status TEXT NOT NULL CHECK (status IN ('lead', 'prospect', 'active', 'inactive')) DEFAULT 'lead',
  total_value REAL DEFAULT 0,
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS customer_interactions (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  customer_id TEXT NOT NULL REFERENCES customers(id) ON DELETE CASCADE,
  interaction_type TEXT NOT NULL CHECK (interaction_type IN ('call', 'email', 'meeting', 'visit', 'proposal', 'other')) DEFAULT 'other',
  summary TEXT NOT NULL,
  outcome TEXT,
  interaction_date TEXT NOT NULL,
  next_action TEXT,
  next_action_date TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  title TEXT,
  department TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  start_date TEXT,
  status TEXT NOT NULL CHECK (status IN ('active', 'on_leave', 'inactive')) DEFAULT 'active',
  employment_type TEXT NOT NULL CHECK (employment_type IN ('full_time', 'part_time', 'contractor', 'intern')) DEFAULT 'full_time',
  notes TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS risks (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  department TEXT NOT NULL,
  category TEXT NOT NULL CHECK (category IN ('financial', 'operational', 'legal', 'technical', 'hr', 'other')) DEFAULT 'other',
  likelihood TEXT NOT NULL CHECK (likelihood IN ('low', 'medium', 'high')) DEFAULT 'medium',
  impact TEXT NOT NULL CHECK (impact IN ('low', 'medium', 'high', 'critical')) DEFAULT 'medium',
  status TEXT NOT NULL CHECK (status IN ('identified', 'mitigating', 'resolved', 'accepted')) DEFAULT 'identified',
  owner_name TEXT,
  mitigation_plan TEXT,
  review_date TEXT,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS automation_rules (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  trigger_type TEXT NOT NULL CHECK (trigger_type IN ('schedule', 'threshold', 'status_change', 'manual')) DEFAULT 'manual',
  trigger_config TEXT,
  action_type TEXT NOT NULL CHECK (action_type IN ('notify', 'create_task', 'create_report', 'flag_record')) DEFAULT 'notify',
  action_config TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  last_run_at TEXT,
  run_count INTEGER NOT NULL DEFAULT 0,
  created_by TEXT REFERENCES users(id),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  user_id TEXT REFERENCES users(id),
  title TEXT NOT NULL,
  body TEXT,
  type TEXT NOT NULL CHECK (type IN ('info', 'warning', 'error', 'success')) DEFAULT 'info',
  entity_type TEXT,
  entity_id TEXT,
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
`CREATE TABLE IF NOT EXISTS agent_chats (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  agent_name TEXT NOT NULL,
  user_id TEXT REFERENCES users(id),
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')) DEFAULT 'user',
  content TEXT NOT NULL,
  context_snapshot TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`,
"CREATE INDEX IF NOT EXISTS idx_tasks_org ON tasks(organization_id, status)",
"CREATE INDEX IF NOT EXISTS idx_work_orders_org ON work_orders(organization_id, status)",
"CREATE INDEX IF NOT EXISTS idx_field_visits_org ON field_visits(organization_id, visit_date)",
"CREATE INDEX IF NOT EXISTS idx_procurement_org ON procurement_requests(organization_id, status)",
"CREATE INDEX IF NOT EXISTS idx_customers_org ON customers(organization_id, status)",
"CREATE INDEX IF NOT EXISTS idx_employees_org ON employees(organization_id, status)",
"CREATE INDEX IF NOT EXISTS idx_risks_org ON risks(organization_id, status)",
"CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(organization_id, user_id, is_read)",
"CREATE INDEX IF NOT EXISTS idx_agent_chats_org ON agent_chats(organization_id, agent_name)",
"CREATE INDEX IF NOT EXISTS idx_payment_period ON payment_records(period)",
"CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_records(workflow_status)",
"CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)",
"CREATE INDEX IF NOT EXISTS idx_auth_attempts_window ON auth_attempts(fingerprint_hash, action, created_at)",
"CREATE INDEX IF NOT EXISTS idx_manual_debt_status ON manual_debts(status)",
"CREATE INDEX IF NOT EXISTS idx_members_user ON organization_members(user_id)",
] as const;

export const DEFAULT_ORGANIZATION_ID = "org_alan_group";

const CURRENT_SCHEMA_VERSION = "2026-07-24-assets-maintenance-v1";
let schemaPromise: Promise<void> | null = null;

export async function ensureSchema() {
  if (!schemaPromise) {
    schemaPromise = checkSchemaVersion().catch((error) => {
      schemaPromise = null;
      throw error;
    });
  }
  return schemaPromise;
}

async function checkSchemaVersion() {
  const database = getDb();
  try {
    const current = await database.prepare("SELECT value FROM app_metadata WHERE key = 'schema_version'").first<{ value: string }>();
    if (current?.value === CURRENT_SCHEMA_VERSION) return;
  } catch {
    // İlk kurulumda tablo henüz bulunmaz; aşağıdaki güvenli kurulum oluşturur.
  }
  await initializeSchema();
}

async function initializeSchema() {
  const database = getDb();
  for (const statement of schemaStatements) {
    await database.prepare(statement).run();
  }

  const userColumns = await database.prepare("PRAGMA table_info(users)").all<{ name: string }>();
  if (!userColumns.results.some((column) => column.name === "username")) {
    await database.prepare("ALTER TABLE users ADD COLUMN username TEXT").run();
  }
  await database.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username ON users(username)").run();
  await database.prepare("UPDATE payment_records SET workflow_status = 'approved' WHERE workflow_status <> 'approved'").run();
  await database.prepare("UPDATE expenses SET workflow_status = 'approved' WHERE workflow_status <> 'approved'").run();

  for (const table of ["payment_records", "expenses", "cash_balances", "manual_debts", "attachments", "audit_logs"] as const) {
    const columns = await database.prepare(`PRAGMA table_info(${table})`).all<{ name: string }>();
    if (!columns.results.some((column) => column.name === "organization_id")) {
      await database.prepare(`ALTER TABLE ${table} ADD COLUMN organization_id TEXT`).run();
    }
  }
  const paymentColumns = await database.prepare("PRAGMA table_info(payment_records)").all<{ name: string }>();
  if (!paymentColumns.results.some((column) => column.name === "paid_amount")) {
    await database.prepare("ALTER TABLE payment_records ADD COLUMN paid_amount REAL NOT NULL DEFAULT 0").run();
  }
  if (!paymentColumns.results.some((column) => column.name === "payment_status")) {
    await database.prepare("ALTER TABLE payment_records ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'planned'").run();
  }
  if (!paymentColumns.results.some((column) => column.name === "paid_at")) {
    await database.prepare("ALTER TABLE payment_records ADD COLUMN paid_at TEXT").run();
  }
  await migrateTreasuryCurrencyTables(database);
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_payment_org ON payment_records(organization_id)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_expense_org ON expenses(organization_id)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_attachment_org ON attachments(organization_id)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_manual_debt_org ON manual_debts(organization_id)").run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_manual_debt_status ON manual_debts(status)").run();
  await database.prepare(`INSERT OR IGNORE INTO organizations
    (id, name, slug, kind, plan, subscription_status, trial_ends_at)
    VALUES (?, 'Alan Group', 'alan-group', 'business', 'founder', 'active', NULL)`).bind(DEFAULT_ORGANIZATION_ID).run();
  await database.prepare(`INSERT OR IGNORE INTO organization_profiles
    (organization_id, legal_name, sector, about)
    VALUES (?, 'Alan Group', 'Mühendislik, teknoloji ve yönetim', 'Şirket içi finans ve operasyon verilerinin güvenli şekilde izlendiği çalışma alanı.')`)
    .bind(DEFAULT_ORGANIZATION_ID).run();

  await database.prepare("UPDATE payment_records SET organization_id = ? WHERE organization_id IS NULL").bind(DEFAULT_ORGANIZATION_ID).run();
  await database.prepare("UPDATE expenses SET organization_id = ? WHERE organization_id IS NULL").bind(DEFAULT_ORGANIZATION_ID).run();
  await database.prepare("UPDATE cash_balances SET organization_id = ? WHERE organization_id IS NULL").bind(DEFAULT_ORGANIZATION_ID).run();
  await database.prepare("UPDATE manual_debts SET organization_id = ? WHERE organization_id IS NULL").bind(DEFAULT_ORGANIZATION_ID).run();
  await database.prepare("UPDATE attachments SET organization_id = ? WHERE organization_id IS NULL").bind(DEFAULT_ORGANIZATION_ID).run();
  await database.prepare("UPDATE audit_logs SET organization_id = ? WHERE organization_id IS NULL").bind(DEFAULT_ORGANIZATION_ID).run();
  await database.prepare(`INSERT OR IGNORE INTO organization_period_summaries
    (id, organization_id, period, total_limit, total_debt, restructuring, monthly_payment, next_installment,
     overdraft_debt, overdraft_limit, minimum_payment, expense_total, sort_order)
    SELECT id || '-org', ?, period, total_limit, total_debt, restructuring, monthly_payment, next_installment,
      overdraft_debt, overdraft_limit, minimum_payment, expense_total, sort_order FROM period_summaries`)
    .bind(DEFAULT_ORGANIZATION_ID).run();
  await database.prepare(`INSERT OR IGNORE INTO organization_reference_rates (organization_id, code, rate_try, updated_by, updated_at)
    SELECT ?, code, rate_try, updated_by, updated_at FROM reference_rates`).bind(DEFAULT_ORGANIZATION_ID).run();
  await database.prepare(`INSERT INTO app_metadata (key, value, updated_at) VALUES ('schema_version', ?, CURRENT_TIMESTAMP)
    ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP`)
    .bind(CURRENT_SCHEMA_VERSION).run();
}

async function migrateTreasuryCurrencyTables(database: Database) {
  const cashSchema = await database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'cash_balances'").first<{ sql: string }>();
  if (cashSchema?.sql?.includes("CHECK (currency")) {
    await database.prepare(`CREATE TABLE IF NOT EXISTS cash_balances_v2 (
      id TEXT PRIMARY KEY, account_name TEXT NOT NULL, currency TEXT NOT NULL, amount REAL NOT NULL DEFAULT 0,
      manual_rate REAL, note TEXT, created_by TEXT REFERENCES users(id), created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      organization_id TEXT REFERENCES organizations(id))`).run();
    await database.prepare(`INSERT OR IGNORE INTO cash_balances_v2
      (id, account_name, currency, amount, manual_rate, note, created_by, created_at, organization_id)
      SELECT id, account_name, currency, amount, NULL, note, created_by, created_at, organization_id FROM cash_balances`).run();
    await database.prepare("DROP TABLE cash_balances").run();
    await database.prepare("ALTER TABLE cash_balances_v2 RENAME TO cash_balances").run();
  } else {
    const columns = await database.prepare("PRAGMA table_info(cash_balances)").all<{ name: string }>();
    if (!columns.results.some((column) => column.name === "manual_rate")) await database.prepare("ALTER TABLE cash_balances ADD COLUMN manual_rate REAL").run();
  }

  const debtSchema = await database.prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'manual_debts'").first<{ sql: string }>();
  if (debtSchema?.sql?.includes("CHECK (currency")) {
    await database.prepare(`CREATE TABLE IF NOT EXISTS manual_debts_v2 (
      id TEXT PRIMARY KEY, lender_name TEXT NOT NULL, debt_type TEXT NOT NULL DEFAULT 'cash', currency TEXT NOT NULL,
      amount REAL NOT NULL DEFAULT 0, manual_rate REAL, due_date TEXT, note TEXT,
      status TEXT NOT NULL CHECK (status IN ('open', 'paid')) DEFAULT 'open', created_by TEXT REFERENCES users(id),
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP, organization_id TEXT REFERENCES organizations(id))`).run();
    await database.prepare(`INSERT OR IGNORE INTO manual_debts_v2
      (id, lender_name, debt_type, currency, amount, manual_rate, due_date, note, status, created_by, created_at, organization_id)
      SELECT id, lender_name, debt_type, currency, amount, manual_rate, due_date, note, status, created_by, created_at, organization_id FROM manual_debts`).run();
    await database.prepare("DROP TABLE manual_debts").run();
    await database.prepare("ALTER TABLE manual_debts_v2 RENAME TO manual_debts").run();
  }
}

export function createId(prefix: string) {
  return `${prefix}_${crypto.randomUUID()}`;
}

export async function refreshOrganizationPeriodSummary(organizationId: string, period: string) {
  const database = getDb();
  await database.prepare(`INSERT OR IGNORE INTO organization_period_summaries
    (id, organization_id, period, sort_order)
    VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM organization_period_summaries WHERE organization_id = ?))`)
    .bind(createId("summary"), organizationId, period, organizationId).run();
  await database.prepare(`UPDATE organization_period_summaries SET
    total_limit = COALESCE((SELECT SUM(total_limit) FROM payment_records WHERE organization_id = ? AND period = ?), 0),
    total_debt = COALESCE((SELECT SUM(MAX(total_debt - paid_amount, 0)) FROM payment_records WHERE organization_id = ? AND period = ?), 0),
    restructuring = COALESCE((SELECT SUM(restructuring) FROM payment_records WHERE organization_id = ? AND period = ?), 0),
    monthly_payment = COALESCE((SELECT SUM(monthly_payment) FROM payment_records WHERE organization_id = ? AND period = ?), 0),
    next_installment = COALESCE((SELECT SUM(next_installment) FROM payment_records WHERE organization_id = ? AND period = ?), 0),
    overdraft_debt = COALESCE((SELECT SUM(overdraft_debt) FROM payment_records WHERE organization_id = ? AND period = ?), 0),
    overdraft_limit = COALESCE((SELECT SUM(overdraft_limit) FROM payment_records WHERE organization_id = ? AND period = ?), 0),
    minimum_payment = COALESCE((SELECT SUM(minimum_payment) FROM payment_records WHERE organization_id = ? AND period = ?), 0),
    expense_total = COALESCE((SELECT SUM(amount) FROM expenses WHERE organization_id = ? AND period = ?), 0)
    WHERE organization_id = ? AND period = ?`)
    .bind(
      organizationId, period, organizationId, period, organizationId, period, organizationId, period,
      organizationId, period, organizationId, period, organizationId, period, organizationId, period,
      organizationId, period, organizationId, period,
    ).run();
}

export async function addAudit(
  userId: string | null,
  action: string,
  entityType: string,
  entityId: string | null,
  details?: string,
  organizationId?: string | null,
) {
  const database = getDb();
  await database
    .prepare("INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, organization_id) VALUES (?, ?, ?, ?, ?, ?, ?)")
    .bind(createId("audit"), userId, action, entityType, entityId, details ?? null, organizationId ?? null)
    .run();
}
