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
"CREATE INDEX IF NOT EXISTS idx_payment_period ON payment_records(period)",
"CREATE INDEX IF NOT EXISTS idx_payment_status ON payment_records(workflow_status)",
"CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)",
"CREATE INDEX IF NOT EXISTS idx_auth_attempts_window ON auth_attempts(fingerprint_hash, action, created_at)",
"CREATE INDEX IF NOT EXISTS idx_manual_debt_status ON manual_debts(status)",
"CREATE INDEX IF NOT EXISTS idx_members_user ON organization_members(user_id)",
] as const;

export const DEFAULT_ORGANIZATION_ID = "org_alan_group";

const summaries = [
  ["sum-nis-may", "Nisan - Mayıs 2026", 2563000, 2208950, 0, 788750, 297700, 955000, 1405000, 362300, 42500, 1],
  ["sum-may-haz", "Mayıs - Haziran 2026", 2563000, 2422500, 1318000, 800000, 258300, 1346000, 1385000, 311500, 82500, 2],
  ["sum-haz-tem", "Haziran - Temmuz 2026", 2563000, 2090000, 1233000, 947000, 154500, 1363500, 1385000, 325500, 92500, 3],
  ["sum-tem-agu", "Temmuz - Ağustos 2026", 2570000, 1592000, 1147000, 546300, 143500, 1165500, 1250000, 224000, 92500, 4],
] as const;

const latestPayments = [
  ["pay-evren-garanti", "Evren", "Garanti", "Garanti kredi kartı", 225000, 0, 0, 0, 0, 55500, 50000, 4.25, 0, 0, null, ""],
  ["pay-evren-enpara", "Evren", "Enpara", "Yapılandırma bloke kart", 364000, 202000, 90000, 47000, 0, 114000, 150000, 4.25, 0, 17000, "2026-07-06", "En az 15-20 bin ödeme planı oluşturulacak."],
  ["pay-evren-yapikredi", "Evren", "Yapı Kredi", "Kredi kartı", 76000, 0, 0, 0, 6400, 0, 0, 0, 0, 0, null, ""],
  ["pay-evren-hepsiburada", "Evren", "Yapı Kredi", "Hepsiburada Worldcard", 0, 0, 0, 0, 2500, 0, 0, 0, 0, 0, null, ""],
  ["pay-evren-denizbank", "Evren", "Denizbank", "Denizbank kart", 163000, 0, 0, 0, 48000, 0, 160000, 3.89, 0, 0, null, ""],
  ["pay-firma-enpara", "Firma Yetkilisi", "Enpara", "Enpara kredi kartı", 151000, 143400, 0, 125700, 1500, 0, 25000, 4.25, 0, 13000, "2026-06-18", ""],
  ["pay-firma-akbank", "Firma Yetkilisi", "Akbank", "Yapılandırma", 1030000, 1030000, 1057000, 183000, 87600, 0, 0, 0, 0, 92000, "2026-06-01", "İhtarname çekildi; yakın takip gerekiyor."],
  ["pay-firma-yapikredi", "Firma Yetkilisi", "Yapı Kredi", "Kredi kartı", 110000, 78000, 0, 52000, 0, 81000, 75000, 4.25, 0, 25000, "2026-06-04", "Gecikmiş ödemeler mevcut."],
  ["pay-firma-teb1", "Firma Yetkilisi", "TEB", "TEB 1", 11500, 11000, 0, 11000, 0, 0, 0, 0, 0, 0, null, ""],
  ["pay-firma-tombank", "Firma Yetkilisi", "TOM Bank", "TOM Bank", 10000, 10000, 0, 10000, 0, 0, 0, 0, 0, 0, null, ""],
  ["pay-firma-vakifbank", "Firma Yetkilisi", "VakıfBank", "VakıfBank kredi kartı", 44000, 8000, 0, 8000, 0, 765000, 640000, 4.25, 0, 7000, "2026-06-18", ""],
  ["pay-firma-qnb", "Firma Yetkilisi", "QNB Finansbank", "QNB kredi kartı", 400000, 123600, 0, 123600, 0, 150000, 150000, 4.25, 0, 70000, "2026-06-08", "Son ödeme tarihi geçti."],
  ["pay-firma-teb-ev", "Firma Yetkilisi", "TEB", "TEB ev", 7000, 7000, 0, 7000, 0, 0, 0, 0, 0, 0, "2026-06-18", ""],
] as const;

const CURRENT_SCHEMA_VERSION = "2026-07-17-remove-personal-identifiers-v4";
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

  const existing = await database.prepare("SELECT COUNT(*) AS count FROM period_summaries").first<{ count: number }>();
  if ((existing?.count ?? 0) === 0) {
    const summarySql = `INSERT OR IGNORE INTO period_summaries
      (id, period, total_limit, total_debt, restructuring, monthly_payment, next_installment, overdraft_debt, overdraft_limit, minimum_payment, expense_total, sort_order)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`;
    const paymentSql = `INSERT OR IGNORE INTO payment_records
      (id, period, owner_name, bank_name, account_name, total_limit, total_debt, restructuring, monthly_payment, next_installment, overdraft_debt, overdraft_limit, interest_rate, interest_debt, minimum_payment, due_date, important_note, workflow_status, organization_id)
      VALUES (?, 'Temmuz - Ağustos 2026', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'approved', '${DEFAULT_ORGANIZATION_ID}')`;

    await database.batch([
      ...summaries.map((row) => database.prepare(summarySql).bind(...row)),
      ...latestPayments.map((row) => database.prepare(paymentSql).bind(...row)),
    ]);
  }

  const manualDebtCount = await database.prepare("SELECT COUNT(*) AS count FROM manual_debts").first<{ count: number }>();
  if ((manualDebtCount?.count ?? 0) === 0) {
    const debtSql = `INSERT INTO manual_debts
      (id, lender_name, debt_type, currency, amount, manual_rate, note, status, organization_id)
      VALUES (?, ?, 'gold', ?, ?, NULL, ?, 'open', '${DEFAULT_ORGANIZATION_ID}')`;
    await database.batch([
      database.prepare(debtSql).bind("debt-mehmet-ata", "Mehmet Alan", "ATA_GOLD", 12, "12 Ata altın · henüz verilmedi."),
      database.prepare(debtSql).bind("debt-kuyumcu-gram", "Kuyumcu Altın", "GRAM_GOLD", 40, "40 gram altın · henüz verilmedi."),
      database.prepare(debtSql).bind("debt-firma-ata", "Firma Ortağı", "ATA_GOLD", 3, "3 Ata altın · henüz verilmedi."),
      database.prepare(debtSql).bind("debt-firma-bilezik", "Firma Ortağı", "GRAM_GOLD", 30, "2 adet 15 gram bilezik · henüz verilmedi."),
    ]);
  }

  await database.prepare("UPDATE payment_records SET organization_id = ? WHERE organization_id IS NULL").bind(DEFAULT_ORGANIZATION_ID).run();
  await database.prepare("UPDATE expenses SET organization_id = ? WHERE organization_id IS NULL").bind(DEFAULT_ORGANIZATION_ID).run();
  await database.prepare("UPDATE cash_balances SET organization_id = ? WHERE organization_id IS NULL").bind(DEFAULT_ORGANIZATION_ID).run();
  await database.prepare("UPDATE manual_debts SET organization_id = ? WHERE organization_id IS NULL").bind(DEFAULT_ORGANIZATION_ID).run();
  await database.prepare("UPDATE attachments SET organization_id = ? WHERE organization_id IS NULL").bind(DEFAULT_ORGANIZATION_ID).run();
  await database.prepare("UPDATE audit_logs SET organization_id = ? WHERE organization_id IS NULL").bind(DEFAULT_ORGANIZATION_ID).run();
  await database.prepare("UPDATE payment_records SET owner_name = 'Firma Yetkilisi' WHERE lower(trim(owner_name)) IN ('ekrem', 'ekrem alan')").run();
  await database.prepare("UPDATE manual_debts SET lender_name = 'Firma Ortağı' WHERE lower(trim(lender_name)) = 'ekrem alan'").run();
  await database.prepare("UPDATE attachments SET record_id = replace(record_id, 'pay-ekrem-', 'pay-firma-') WHERE record_id LIKE 'pay-ekrem-%'").run();
  await database.prepare("UPDATE audit_logs SET entity_id = replace(entity_id, 'pay-ekrem-', 'pay-firma-') WHERE entity_id LIKE 'pay-ekrem-%'").run();
  await database.prepare("UPDATE payment_records SET id = replace(id, 'pay-ekrem-', 'pay-firma-') WHERE id LIKE 'pay-ekrem-%'").run();
  await database.prepare("UPDATE manual_debts SET id = replace(id, 'debt-ekrem-', 'debt-firma-') WHERE id LIKE 'debt-ekrem-%'").run();
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
    total_debt = COALESCE((SELECT SUM(total_debt) FROM payment_records WHERE organization_id = ? AND period = ?), 0),
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
