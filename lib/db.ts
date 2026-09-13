// D1 veritabanı erişim katmanı — Cloudflare Workers binding üzerinden.
// getDb() ham D1Database döndürür; rotalar prepare/bind/all/first/run kullanır.
import { env } from "cloudflare:workers";
import { schemaStatements } from "@/db/schema";
import { hashPassword, randomSalt } from "@/lib/passwords";

type D1PreparedStatement = {
  bind: (...values: unknown[]) => D1PreparedStatement;
  first: <T = Record<string, unknown>>(column?: string) => Promise<T | null>;
  all: <T = Record<string, unknown>>() => Promise<{ results: T[] }>;
  run: () => Promise<unknown>;
};
export type D1Like = {
  prepare: (query: string) => D1PreparedStatement;
  exec?: (query: string) => Promise<unknown>;
  batch?: (statements: D1PreparedStatement[]) => Promise<unknown>;
};

export function getDb(): D1Like {
  const binding = (env as unknown as { DB?: D1Like }).DB;
  if (!binding) {
    throw new Error("Veritabanı bağlantısı (D1 `DB`) hazır değil.");
  }
  return binding;
}

export function createId(prefix: string): string {
  return `${prefix}_${crypto.randomUUID().replace(/-/g, "").slice(0, 20)}`;
}

export async function addAudit(
  userId: string | null,
  action: string,
  entity: string,
  entityId: string | null,
  message?: string,
  organizationId?: string | null,
): Promise<void> {
  try {
    await getDb().prepare(
      `INSERT INTO audit_log (id, organization_id, user_id, action, entity, entity_id, message)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    ).bind(createId("audit"), organizationId ?? null, userId, action, entity, entityId, message ?? null).run();
  } catch {
    // Denetim kaydı ana işlemi bloke etmemeli.
  }
}

// Bir dönem için finansal özet tablosunu yeniden hesaplar.
export async function refreshOrganizationPeriodSummary(organizationId: string, period: string): Promise<void> {
  const db = getDb();
  const totals = await db.prepare(
    `SELECT COALESCE(SUM(total_debt),0) AS total_debt, COALESCE(SUM(paid_amount),0) AS total_paid, COUNT(*) AS c
     FROM payment_records WHERE organization_id = ? AND period = ?`,
  ).bind(organizationId, period).first<{ total_debt: number; total_paid: number; c: number }>();
  const existing = await db.prepare("SELECT id FROM period_summaries WHERE organization_id = ? AND period = ?")
    .bind(organizationId, period).first<{ id: string }>();
  if (existing) {
    await db.prepare(
      `UPDATE period_summaries SET total_debt = ?, total_paid = ?, record_count = ?, updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`,
    ).bind(totals?.total_debt ?? 0, totals?.total_paid ?? 0, totals?.c ?? 0, existing.id).run();
  } else {
    await db.prepare(
      `INSERT INTO period_summaries (id, organization_id, period, total_debt, total_paid, record_count)
       VALUES (?, ?, ?, ?, ?, ?)`,
    ).bind(createId("psum"), organizationId, period, totals?.total_debt ?? 0, totals?.total_paid ?? 0, totals?.c ?? 0).run();
  }
}

// --- Şema kurulumu ve demo verisi (yalnız yerel geliştirme) ---
let schemaReady: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!schemaReady) schemaReady = initializeSchema();
  return schemaReady;
}

async function initializeSchema(): Promise<void> {
  const db = getDb();
  for (const statement of schemaStatements()) {
    await db.prepare(statement).run();
  }
  await seedDemoData(db);
}

export const DEMO_ORG_ID = "org_teksanor_demo";
export const DEMO_MANAGER_EMAIL = "yonetici@teksanor.com";
export const DEMO_TECH_EMAIL = "saha@teksanor.com";
export const DEMO_PASSWORD = "Teksanor2026!";

async function seedDemoData(db: D1Like): Promise<void> {
  const existing = await db.prepare("SELECT id FROM organizations WHERE id = ?").bind(DEMO_ORG_ID).first();
  if (existing) return;

  await db.prepare("INSERT INTO organizations (id, name, slug, sector) VALUES (?, ?, ?, ?)")
    .bind(DEMO_ORG_ID, "Teksanor Demo A.Ş.", "teksanor-demo", "Teknik servis ve mühendislik").run();

  const managerId = "usr_manager_demo";
  const techId = "usr_tech_demo";
  const salt1 = randomSalt();
  const salt2 = randomSalt();
  const hash1 = await hashPassword(DEMO_PASSWORD, salt1);
  const hash2 = await hashPassword(DEMO_PASSWORD, salt2);

  await db.prepare("INSERT INTO users (id, full_name, email, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)")
    .bind(managerId, "Merve Yönetici", DEMO_MANAGER_EMAIL, hash1, salt1).run();
  await db.prepare("INSERT INTO users (id, full_name, email, password_hash, password_salt) VALUES (?, ?, ?, ?, ?)")
    .bind(techId, "Kaan Saha", DEMO_TECH_EMAIL, hash2, salt2).run();

  await db.prepare("INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (?, ?, ?, ?)")
    .bind(createId("mem"), DEMO_ORG_ID, managerId, "owner").run();
  await db.prepare("INSERT INTO organization_members (id, organization_id, user_id, role) VALUES (?, ?, ?, ?)")
    .bind(createId("mem"), DEMO_ORG_ID, techId, "member").run();

  // Örnek müşteriler
  const customers: Array<[string, string, string, string]> = [
    ["Anadolu Tekstil San.", "Anadolu Tekstil San. ve Tic. A.Ş.", "active", "Tekstil"],
    ["Ege Soğutma Ltd.", "Ege Soğutma Sistemleri Ltd. Şti.", "prospect", "Soğutma"],
    ["Marmara Lojistik", "Marmara Lojistik A.Ş.", "lead", "Lojistik"],
  ];
  for (const [name, company, status, sector] of customers) {
    await db.prepare(
      `INSERT INTO customers (id, organization_id, name, company_name, sector, status, total_value, created_by)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    ).bind(createId("cust"), DEMO_ORG_ID, name, company, sector, status, Math.round(Math.random() * 400000), managerId).run();
  }

  // Örnek çalışanlar
  const employees: Array<[string, string, string]> = [
    ["Kaan Saha", "Saha Teknisyeni", "Teknik servis"],
    ["Elif Mühendis", "Bakım Mühendisi", "Bakım-onarım"],
    ["Ozan Proje", "Proje Mühendisi", "Mühendislik"],
  ];
  for (const [fullName, title, department] of employees) {
    await db.prepare(
      `INSERT INTO employees (id, organization_id, full_name, title, department, status, employment_type, created_by)
       VALUES (?, ?, ?, ?, ?, 'active', 'full_time', ?)`,
    ).bind(createId("emp"), DEMO_ORG_ID, fullName, title, department, managerId).run();
  }

  // Örnek varlıklar
  const assetIds: string[] = [];
  const assets: Array<[string, string, string, string]> = [
    ["VRL-0001", "Kompresör Ünitesi A1", "Ekipman", "Fabrika-1 / Kazan Dairesi"],
    ["VRL-0002", "Servis Aracı 34 TKS 01", "Araç", "Merkez filo"],
    ["VRL-0003", "CNC Tezgahı T3", "Makine", "Üretim Hattı 2"],
  ];
  for (const [code, name, category, location] of assets) {
    const id = createId("asset");
    assetIds.push(id);
    await db.prepare(
      `INSERT INTO assets (id, organization_id, asset_code, name, category, location, status, responsible_name, created_by)
       VALUES (?, ?, ?, ?, ?, ?, 'active', ?, ?)`,
    ).bind(id, DEMO_ORG_ID, code, name, category, location, "Kaan Saha", managerId).run();
  }

  // Örnek bakım planı
  await db.prepare(
    `INSERT INTO maintenance_plans (id, organization_id, asset_id, title, frequency_type, frequency_value, next_due_date, assigned_to, status, created_by)
     VALUES (?, ?, ?, ?, 'month', 3, ?, ?, 'active', ?)`,
  ).bind(createId("maint"), DEMO_ORG_ID, assetIds[0], "Kompresör periyodik bakımı", nextDateISO(20), "Kaan Saha", managerId).run();

  // Örnek iş emirleri
  const orders: Array<[string, string, string, string, string]> = [
    ["Kompresör arıza müdahalesi", "repair", "in_progress", "high", "Anadolu Tekstil San."],
    ["Yıllık periyodik bakım", "maintenance", "assigned", "normal", "Ege Soğutma Ltd."],
    ["Yeni sistem kurulumu", "installation", "open", "normal", "Marmara Lojistik"],
  ];
  let n = 1;
  for (const [title, type, status, priority, customer] of orders) {
    await db.prepare(
      `INSERT INTO work_orders (id, organization_id, order_number, title, customer_name, department, order_type, status, priority, stage, created_by)
       VALUES (?, ?, ?, ?, ?, 'Operasyon yönetimi', ?, ?, ?, 'requested', ?)`,
    ).bind(createId("wo"), DEMO_ORG_ID, `IE-${String(n++).padStart(4, "0")}`, title, customer, type, status, priority, managerId).run();
  }

  // Örnek saha ziyareti
  await db.prepare(
    `INSERT INTO field_visits (id, organization_id, visit_number, visitor_name, customer_name, location, visit_date, visit_type, status, created_by)
     VALUES (?, ?, ?, ?, ?, ?, ?, 'inspection', 'planned', ?)`,
  ).bind(createId("fv"), DEMO_ORG_ID, "SZ-0001", "Kaan Saha", "Anadolu Tekstil San.", "Fabrika-1", nextDateISO(3), managerId).run();

  await addAudit(managerId, "seed", "organization", DEMO_ORG_ID, "Demo çalışma alanı oluşturuldu.", DEMO_ORG_ID);
}

function nextDateISO(daysFromNow: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + daysFromNow);
  return d.toISOString().slice(0, 10);
}
