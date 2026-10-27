// Örnek işletme: Teksanor'un dolu bir şirkette nasıl göründüğünü göstermek için sentetik firma.
// Kişiler rol etiketiyle ("Teknisyen A (örnek)"), müşteriler numarayla ("Müşteri 1 (örnek)") adlandırılır; gerçek kişi/yer adı yoktur.
// Telefonlar gerçek operatör öneki taşımayan 0000 000 00 xx biçimindedir, e-postalar .example uzantılıdır.
// Kullanıcı adlarını ve parolaları platform yöneticisi verir; burada hiçbir parola üretilmez.
//
// D1 ücretsiz planda bir istekte en fazla 50 sorgu çalıştırılabilir (toplu çağrıdaki her ifade ayrı sayılır).
// Bu yüzden kurulum dört isteğe bölünür: hesaplar+firma, sonra a/b/c veri parçaları. Her parça çok satırlı
// INSERT'lerle (ifade başına en fazla 100 parametre) yazılır ve yaklaşık 10–25 sorgu kullanır.
//
// Tutarlılık: her istek tek bir D1 batch'idir; hata olursa o adımın hiçbir kaydı kalmaz. İlerleme app_metadata'da
// tutulur (accounts → a → b → c); tarayıcı kapanırsa yönetici "Yarım kalan kurulumlar" listesinden devam eder.
import { hashPassword } from "./auth";
import { createId, getDb, refreshOrganizationPeriodSummary, type Database } from "./db";
import { ensureDepartmentTables } from "./department-store";
import { cleanData, departmentBySlug, templateOf } from "./department-catalog";
import { accessRules, type AccessProfile } from "./access";
import { organizationStatements } from "./tenancy";
import { ensureSchema } from "./db";
import { ensureServiceColumns } from "./service";

export type DemoAccount = { username: string; fullName: string; password: string; accessProfile: AccessProfile; department?: string; jobRole?: string };

/** Ekranda önerilen roller: yönetici her birinin kullanıcı adını ve parolasını kendisi yazar. Parolası boş olan atlanır. */
export const DEMO_ROLES: Omit<DemoAccount, "password">[] = [
  { username: "ornek.sahip", fullName: "Firma Sahibi (örnek)", accessProfile: "owner", jobRole: "Genel müdür" },
  { username: "ornek.operasyon", fullName: "Operasyon Müdürü (örnek)", accessProfile: "manager", department: "Operasyon yönetimi", jobRole: "Operasyon müdürü" },
  { username: "ornek.ik", fullName: "İK Uzmanı (örnek)", accessProfile: "hr", department: "İnsan ve organizasyon", jobRole: "İK uzmanı" },
  { username: "ornek.finans", fullName: "Finans Sorumlusu (örnek)", accessProfile: "finance", department: "Finans ve hazine", jobRole: "Finans sorumlusu" },
  { username: "ornek.bt", fullName: "BT Uzmanı (örnek)", accessProfile: "it", department: "Bilgi teknolojileri ve güvenlik", jobRole: "BT uzmanı" },
  { username: "ornek.teknisyen1", fullName: "Teknisyen A (örnek)", accessProfile: "employee", department: "Operasyon yönetimi", jobRole: "Saha teknisyeni" },
  { username: "ornek.teknisyen2", fullName: "Teknisyen B (örnek)", accessProfile: "employee", department: "Operasyon yönetimi", jobRole: "Saha teknisyeni" },
];
export const DEMO_PARTS = ["a", "b", "c"] as const;
export type DemoPart = typeof DEMO_PARTS[number];

const day = (offset: number) => new Date(Date.now() + 3 * 3600000 + offset * 86400000).toISOString().slice(0, 10);
const stamp = (offsetDays: number) => new Date(Date.now() - offsetDays * 86400000).toISOString().slice(0, 19).replace("T", " ");
const PERIOD = (() => { const m = ["Ocak", "Şubat", "Mart", "Nisan", "Mayıs", "Haziran", "Temmuz", "Ağustos", "Eylül", "Ekim", "Kasım", "Aralık"]; const d = new Date(Date.now() + 3 * 3600000); return `${m[d.getUTCMonth()]} ${d.getUTCFullYear()}`; })();
const META = (orgId: string) => `demo_company:${orgId}`;

export class DemoError extends Error { constructor(message: string, readonly status = 400) { super(message); } }

type Stmt = ReturnType<Database["prepare"]>;
/** Çok satırlı INSERT ifadeleri: ifade başına en fazla 100 parametre (D1 sınırı). Çalıştırılmaz; batch'e eklenir. */
function insertRows(out: Stmt[], db: Database, table: string, columns: string[], rows: unknown[][], verb = "INSERT") {
  const per = Math.max(1, Math.floor(100 / columns.length));
  for (let i = 0; i < rows.length; i += per) {
    const part = rows.slice(i, i + per);
    const placeholders = part.map(() => `(${columns.map(() => "?").join(", ")})`).join(", ");
    out.push(db.prepare(`${verb} INTO ${table} (${columns.join(", ")}) VALUES ${placeholders}`).bind(...part.flat()));
  }
}
const isConflict = (error: unknown) => /UNIQUE|constraint/i.test(`${String(error)} ${String((error as { cause?: unknown })?.cause ?? "")}`);

export function validateAccounts(input: unknown): DemoAccount[] {
  if (!Array.isArray(input) || input.length > DEMO_ROLES.length) throw new DemoError("Hesap listesi gerekli.");
  const out: DemoAccount[] = [];
  const seen = new Set<string>();
  const roleKeys = new Set<string>();
  for (const raw of input as Record<string, unknown>[]) {
    if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new DemoError("Geçersiz hesap.");
    const username = String(raw.username ?? "").trim().toLowerCase();
    const password = String(raw.password ?? "");
    if (!password) continue; // parolası boş bırakılan rol için hesap açılmaz
    const role = DEMO_ROLES.find((r) => r.accessProfile === raw.accessProfile && (raw.accessProfile !== "employee" || r.username === raw.roleKey)) ?? DEMO_ROLES.find((r) => r.accessProfile === raw.accessProfile);
    if (!role) throw new DemoError("Geçersiz rol.");
    if (roleKeys.has(role.username)) throw new DemoError("Aynı rol iki kez eklenemez.");
    roleKeys.add(role.username);
    if (!/^[a-z0-9._-]{3,32}$/.test(username)) throw new DemoError(`"${username}" kullanıcı adı 3–32 karakter; harf, rakam, nokta, tire olmalı.`);
    if (password.length < 10 || password.length > 128) throw new DemoError(`${username} için parola en az 10 karakter olmalı.`);
    if (seen.has(username)) throw new DemoError(`${username} iki kez yazılmış.`);
    seen.add(username);
    out.push({ ...role, username, password, fullName: String(raw.fullName ?? role.fullName).trim().slice(0, 80) || role.fullName });
  }
  if (!out.some((a) => a.accessProfile === "owner")) throw new DemoError("En az firma sahibi hesabının kullanıcı adı ve parolası girilmeli.");
  return out;
}

/** 1. istek: hesaplar ve firma. Veri parçaları ayrı isteklerle (seedDemoPart) eklenir. */
export async function createDemoCompany(adminId: string, input: { name?: string; accounts: DemoAccount[] }) {
  const db = getDb();
  const names = input.accounts.map((a) => a.username);
  const taken = (await db.prepare(`SELECT username FROM users WHERE username IN (${names.map(() => "?").join(", ")})`).bind(...names).all<{ username: string }>()).results;
  if (taken.length) throw new DemoError(`"${taken[0].username}" kullanıcı adı zaten kayıtlı.`, 409);
  const owner = input.accounts.find((a) => a.accessProfile === "owner")!;
  const ids: Record<string, string> = {};
  const userRows: unknown[][] = [];
  for (const a of input.accounts) {
    ids[a.username] = createId("user");
    const c = await hashPassword(a.password);
    userRows.push([ids[a.username], a.username, `${a.username}@users.teksanor.internal`, a.fullName, c.hash, c.salt, "user"]);
  }
  await ensureSchema();
  const statements: Stmt[] = [];
  insertRows(statements, db, "users", ["id", "username", "email", "full_name", "password_hash", "password_salt", "role"], userRows);
  const name = (input.name || "Örnek · Klima ve Teknik Servis (örnek)").trim().slice(0, 120);
  const { org, statements: orgStatements } = organizationStatements(db, { name, kind: "business", ownerId: ids[owner.username] });
  statements.push(...orgStatements);
  insertRows(statements, db, "organization_members", ["organization_id", "user_id", "role"],
    input.accounts.filter((a) => a.accessProfile !== "owner").map((a) => [org.id, ids[a.username], "member"]));
  insertRows(statements, db, "organization_member_access", ["organization_id", "user_id", "job_role", "department", "access_profile"],
    input.accounts.map((a) => [org.id, ids[a.username], a.jobRole ?? accessRules[a.accessProfile].label, a.department ?? null, a.accessProfile]), "INSERT OR REPLACE");
  statements.push(db.prepare("INSERT INTO app_metadata (key, value) VALUES (?, ?)").bind(META(org.id), "accounts"));
  statements.push(db.prepare("INSERT INTO audit_logs (id, user_id, action, entity_type, entity_id, details, organization_id) VALUES (?, ?, 'create', 'demo_organization', ?, ?, ?)")
    .bind(createId("audit"), adminId, org.id, `Örnek işletme oluşturuldu: ${name} (${input.accounts.length} hesap).`, org.id));
  // Hesaplar, firma, üyelikler, yetkiler, ilerleme kaydı ve denetim izi tek işlem: biri başarısızsa hiçbiri kalmaz.
  try { await db.batch(statements); }
  catch (error) { if (isConflict(error)) throw new DemoError("Kullanıcı adlarından biri bu sırada başka biri tarafından alındı; tekrar deneyin.", 409); throw error; }
  return { organization: org, accounts: input.accounts.map((a) => ({ username: a.username, role: accessRules[a.accessProfile].label })), next: "a" as DemoPart };
}

/** 2–4. istekler: veri parçaları sırayla. Aynı parça iki kez yazılmaz. */
export async function seedDemoPart(orgId: string, part: DemoPart) {
  const db = getDb();
  const state = await db.prepare("SELECT value FROM app_metadata WHERE key = ?").bind(META(orgId)).first<{ value: string }>();
  if (!state) throw new DemoError("Bu firma örnek işletme olarak oluşturulmadı.", 404);
  const expected = { a: "accounts", b: "a", c: "b" }[part];
  if (state.value !== expected) {
    const completed = await db.prepare("SELECT value FROM app_metadata WHERE key = ?").bind(`demo_part:${orgId}:${part}`).first<{ value: string }>();
    if (completed) return { counts: JSON.parse(completed.value) as Record<string, number>, next: part === "a" ? "b" : part === "b" ? "c" : null };
    throw new DemoError("Örnek veri parçaları sırayla eklenmeli.", 409);
  }
  const members = (await db.prepare(`SELECT u.id, u.username, u.full_name, m.access_profile FROM organization_member_access m JOIN users u ON u.id = m.user_id WHERE m.organization_id = ?`)
    .bind(orgId).all<{ id: string; username: string; full_name: string; access_profile: string }>()).results;
  const owner = members.find((m) => m.access_profile === "owner");
  if (!owner) throw new DemoError("Firma sahibi bulunamadı.", 409);
  if (part === "b") await ensureServiceColumns(db);
  if (part === "c") await ensureDepartmentTables(db);
  const statements: Stmt[] = [db.prepare("INSERT INTO app_metadata (key, value) VALUES (?, 'lock')").bind(`demo_lock:${orgId}:${part}`)];
  const counts = part === "a" ? partA(statements, db, orgId, owner.id) : part === "b" ? partB(statements, db, orgId, owner.id, members) : partC(statements, db, orgId, owner.id, members);
  statements.push(db.prepare("INSERT INTO app_metadata (key, value) VALUES (?, ?)").bind(`demo_part:${orgId}:${part}`, JSON.stringify(counts)));
  statements.push(db.prepare("UPDATE app_metadata SET value = ?, updated_at = CURRENT_TIMESTAMP WHERE key = ? AND value = ?").bind(part, META(orgId), expected));
  // Parçanın tüm kayıtları ve ilerleme tek işlem; aynı parça iki kez gelirse kilit satırı çakışır, hiçbir şey yazılmaz.
  try { await db.batch(statements); }
  catch (error) { if (isConflict(error)) throw new DemoError("Bu parça zaten ekleniyor veya eklendi; listeyi yenileyin.", 409); throw error; }
  if (part === "c") await refreshOrganizationPeriodSummary(orgId, PERIOD);
  return { counts, next: part === "a" ? "b" : part === "b" ? "c" : null };
}

function partA(out: Stmt[], db: Database, orgId: string, ownerId: string) {
  out.push(db.prepare(`INSERT OR REPLACE INTO organization_profiles (organization_id, legal_name, tax_office, tax_number, phone, email, address, website, about, updated_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).bind(orgId, "Örnek Klima ve Teknik Servis (örnek)", "Örnek Vergi Dairesi", "0000000000", "0000 000 00 01",
    "bilgi@ornek-servis.example", "Örnek Mah. Örnek Cad. No:1 (örnek adres)", "ornek-servis.example",
    "15 kişilik klima, soğutma ve jeneratör servis firması. Konut, otel ve fabrikalara bakım sözleşmesiyle hizmet veriyor. Bu firma tanıtım amaçlı sentetik bir örnektir.", ownerId));
  const employees: [string, string, string, string][] = [
    ["Firma Sahibi (örnek)", "Genel müdür", "Yönetim ve strateji", "full_time"], ["Operasyon Müdürü (örnek)", "Operasyon müdürü", "Operasyon yönetimi", "full_time"],
    ["Teknisyen A (örnek)", "Kıdemli teknisyen", "Operasyon yönetimi", "full_time"], ["Teknisyen B (örnek)", "Teknisyen", "Operasyon yönetimi", "full_time"],
    ["Teknisyen C (örnek)", "Teknisyen", "Operasyon yönetimi", "full_time"], ["Stajyer Teknisyen (örnek)", "Teknisyen yardımcısı", "Operasyon yönetimi", "intern"],
    ["İK Uzmanı (örnek)", "İK uzmanı", "İnsan ve organizasyon", "full_time"], ["Finans Sorumlusu (örnek)", "Finans sorumlusu", "Finans ve hazine", "full_time"],
    ["Ön Muhasebe Personeli (örnek)", "Ön muhasebe", "Muhasebe ve vergi koordinasyonu", "part_time"], ["BT Uzmanı (örnek)", "BT uzmanı", "Bilgi teknolojileri ve güvenlik", "contractor"],
    ["Satış Temsilcisi (örnek)", "Satış temsilcisi", "Satış ve iş geliştirme", "full_time"], ["Müşteri Temsilcisi (örnek)", "Müşteri temsilcisi", "Müşteri deneyimi ve destek", "full_time"],
    ["Satın Alma Uzmanı (örnek)", "Satın alma uzmanı", "Satın alma ve tedarik", "full_time"], ["Kalite Sorumlusu (örnek)", "Kalite sorumlusu", "Kalite ve risk yönetimi", "full_time"],
    ["Ar-Ge Mühendisi (örnek)", "Ar-Ge mühendisi", "Ar-Ge ve inovasyon", "full_time"],
  ];
  insertRows(out, db, "employees", ["id", "organization_id", "full_name", "title", "department", "email", "start_date", "status", "employment_type", "created_by"],
    employees.map(([n, t, d, e], i) => [createId("emp"), orgId, n, t, d, `calisan${i + 1}@ornek-servis.example`, day(-900 + i * 55), n === "Teknisyen C (örnek)" ? "on_leave" : "active", e, ownerId]));
  const customers: [string, string, string, number][] = [
    ["Müşteri 1 – Otel (örnek)", "Turizm", "active", 420000], ["Müşteri 2 – Fabrika (örnek)", "Sanayi", "active", 610000],
    ["Müşteri 3 – Site yönetimi (örnek)", "Konut", "active", 95000], ["Müşteri 4 – Okul (örnek)", "Eğitim", "active", 140000],
    ["Müşteri 5 – Alışveriş merkezi (örnek)", "Perakende", "prospect", 0], ["Müşteri 6 – Lojistik deposu (örnek)", "Lojistik", "lead", 0],
    ["Müşteri 7 – Restoran (örnek)", "Yeme-içme", "active", 75000], ["Müşteri 8 – Ofis binası (örnek)", "Ticari", "active", 38000],
  ];
  insertRows(out, db, "customers", ["id", "organization_id", "name", "company_name", "email", "phone", "address", "sector", "status", "total_value", "created_by"],
    customers.map(([n, s, st, v], i) => [createId("cust"), orgId, n, n, `musteri${i + 1}@ornek.example`, `0000 000 00 ${String(10 + i)}`, "Örnek adres (örnek)", s, st, v, ownerId]));
  const assets: [string, string, string, string][] = [
    ["KLM-001", "VRF dış ünite 28 kW", "Müşteri 1 (otel), çatı", "active"], ["KLM-002", "Split klima 24.000 BTU", "Müşteri 3 (site), B blok", "active"],
    ["JEN-001", "Jeneratör 250 kVA", "Müşteri 2 (fabrika), enerji odası", "maintenance"], ["SOG-001", "Soğuk oda kompresörü", "Müşteri 7 (restoran), mutfak", "active"],
    ["KLM-003", "Klima santrali", "Müşteri 4 (okul), kazan dairesi", "active"], ["ARC-001", "Servis aracı (örnek plaka)", "Merkez", "active"],
  ];
  const assetIds = assets.map(() => createId("asset"));
  insertRows(out, db, "assets", ["id", "organization_id", "asset_code", "name", "category", "location", "status", "responsible_name", "purchase_date", "warranty_end", "created_by"],
    assets.map(([c, n, l, s], i) => [assetIds[i], orgId, c, n, c.startsWith("ARC") ? "Araç" : "Ekipman", l, s, "Operasyon Müdürü (örnek)", day(-700), day(300), ownerId]));
  const plans: [number, string, string][] = [[0, "VRF aylık bakım", "month"], [2, "Jeneratör yük testi", "month"], [3, "Kompresör gaz kontrolü", "week"], [4, "Santral filtre değişimi", "month"]];
  insertRows(out, db, "maintenance_plans", ["id", "organization_id", "asset_id", "title", "frequency_type", "frequency_value", "next_due_date", "assigned_to", "checklist_text", "created_by"],
    plans.map(([i, t, f]) => [createId("mnt"), orgId, assetIds[i], t, f, 1, day(i * 3 - 2), "Teknisyen A (örnek)", "Filtre\nGaz basıncı\nElektrik bağlantıları", ownerId]));
  return { "çalışan": employees.length, "müşteri": customers.length, "varlık": assets.length, "bakım planı": plans.length };
}

type Member = { id: string; username: string; full_name: string; access_profile: string };

function partB(out: Stmt[], db: Database, orgId: string, ownerId: string, members: Member[]) {
  const techs = members.filter((m) => m.access_profile === "employee").map((m) => m.id);
  const jobs: [string, string, string, number, string | null, [number, number, number, number, number]][] = [
    ["Lobi klimaları soğutmuyor", "Müşteri 1 – Otel (örnek)", "requested", 0, null, [0, 0, 0, 0, 0]],
    ["Jeneratör yıllık bakım", "Müşteri 2 – Fabrika (örnek)", "quoted", 1, null, [18500, 0, 0, 0, 0]],
    ["Soğuk oda alarm veriyor", "Müşteri 7 – Restoran (örnek)", "quote_approved", 0, null, [7200, 0, 0, 0, 0]],
    ["Okul santrali filtre değişimi", "Müşteri 4 – Okul (örnek)", "in_progress", 0, "t0", [12400, 3000, 4200, 600, 0]],
    ["Site B blok klima montajı", "Müşteri 3 – Site yönetimi (örnek)", "in_progress", 1, "t1", [26000, 6000, 12500, 800, 10000]],
    ["Ofis split klima arızası", "Müşteri 8 – Ofis binası (örnek)", "completed", -1, "t0", [4800, 1200, 900, 300, 0]],
    ["Otel VRF aylık bakım", "Müşteri 1 – Otel (örnek)", "accepted", -6, "t1", [9500, 2400, 1100, 400, 5000]],
    ["Fabrika jeneratör arızası", "Müşteri 2 – Fabrika (örnek)", "collected", -14, "t0", [22000, 5000, 7800, 900, 22000]],
    ["Restoran kompresör değişimi", "Müşteri 7 – Restoran (örnek)", "collected", -20, "t1", [31000, 4000, 19000, 700, 31000]],
    ["AVM keşif ziyareti", "Müşteri 5 – Alışveriş merkezi (örnek)", "cancelled", -3, null, [0, 0, 0, 0, 0]],
  ];
  const year = new Date().getFullYear();
  const ids = jobs.map(() => createId("wo"));
  insertRows(out, db, "work_orders", ["id", "organization_id", "order_number", "title", "description", "customer_name", "location", "department", "order_type", "status", "priority", "scheduled_date", "created_by"],
    jobs.map(([title, cust, stage, offset], i) => [ids[i], orgId, `İŞ-${year}-${String(i + 1).padStart(4, "0")}`, title, "Örnek iş kaydı.", cust, "Örnek adres (örnek)", "Operasyon yönetimi",
      /bakım/i.test(title) ? "maintenance" : /montaj/i.test(title) ? "installation" : /keşif/i.test(title) ? "inspection" : "repair",
      stage === "cancelled" ? "cancelled" : ["collected", "accepted", "completed"].includes(stage) ? "completed" : stage === "in_progress" ? "in_progress" : "open",
      stage === "requested" ? "high" : "normal", day(offset), ownerId]));
  insertRows(out, db, "service_jobs", ["id", "organization_id", "assigned_user_id", "stage", "quote_cents", "labor_cents", "parts_cents", "travel_cents", "paid_cents", "outcome"],
    jobs.map(([, , stage, , tech, [q, l, p, t, paid]], i) => [ids[i], orgId, tech === "t0" ? techs[0] ?? null : tech === "t1" ? techs[1] ?? techs[0] ?? null : null, stage,
      q * 100, l * 100, p * 100, t * 100, paid * 100, ["completed", "accepted", "collected"].includes(stage) ? "Arıza giderildi, sistem test edildi." : ""]));
  const tasks: [string, string, string, string, string, number][] = [
    ["Teklif şablonunu güncelle", "Satış ve iş geliştirme", "Satış Temsilcisi (örnek)", "open", "normal", 3],
    ["Teknisyen KKD kontrolü", "Kalite ve risk yönetimi", "Kalite Sorumlusu (örnek)", "in_progress", "high", 1],
    ["Ay sonu müşavir dosyası", "Muhasebe ve vergi koordinasyonu", "Ön Muhasebe Personeli (örnek)", "open", "high", 5],
    ["Servis aracı muayenesi", "Operasyon yönetimi", "Operasyon Müdürü (örnek)", "open", "normal", 12],
    ["Yedekleme tatbikatı", "Bilgi teknolojileri ve güvenlik", "BT Uzmanı (örnek)", "done", "normal", -2],
  ];
  insertRows(out, db, "tasks", ["id", "organization_id", "title", "department", "assignee_name", "status", "priority", "due_date", "created_by"],
    tasks.map(([t, d, a, s, p, due]) => [createId("task"), orgId, t, d, a, s, p, day(due), ownerId]));
  const projects: [string, string, string, number, number][] = [["Otel zinciri bakım sözleşmesi", "Satış ve iş geliştirme", "active", 45, 60000], ["Uzaktan arıza izleme pilotu", "Ar-Ge ve inovasyon", "planning", 10, 120000], ["Depo düzeni ve stok kodları", "Operasyon yönetimi", "on_hold", 30, 15000]];
  insertRows(out, db, "projects", ["id", "organization_id", "name", "department", "owner_name", "status", "priority", "start_date", "target_date", "budget", "progress", "description", "created_by"],
    projects.map(([nm, d, st, pr, b]) => [createId("prj"), orgId, nm, d, "Firma Sahibi (örnek)", st, "normal", day(-30), day(60), b, pr, "Örnek proje.", ownerId]));
  const risks: [string, string, string, string, string, string][] = [["Yaz sezonunda teknisyen yetersizliği", "Operasyon yönetimi", "operational", "high", "high", "mitigating"], ["Döviz bazlı parça fiyatları", "Finans ve hazine", "financial", "high", "medium", "identified"], ["Müşteri verisinin WhatsApp'ta kalması", "Hukuk ve uyum", "legal", "medium", "high", "mitigating"]];
  insertRows(out, db, "risks", ["id", "organization_id", "title", "department", "category", "likelihood", "impact", "status", "owner_name", "mitigation_plan", "review_date", "created_by"],
    risks.map(([t, d, c, l, im, s]) => [createId("risk"), orgId, t, d, c, l, im, s, "Operasyon Müdürü (örnek)", "Örnek önlem planı.", day(30), ownerId]));
  const buys: [string, string, number, number, string][] = [["R32 gaz tüpü", "Örnek Soğutma Tedarik", 10, 2100, "ordered"], ["Bakır boru 1/4", "Örnek Metal", 50, 180, "approved"], ["Saha tableti", "Örnek Bilişim", 2, 14500, "pending"]];
  insertRows(out, db, "procurement_requests", ["id", "organization_id", "request_number", "title", "department", "requested_by", "supplier_name", "quantity", "unit_price", "total_price", "status", "required_date", "created_by"],
    buys.map(([t, sup, qn, up, s], i) => [createId("prc"), orgId, `SAT-${year}-${String(i + 1).padStart(3, "0")}`, t, "Satın alma ve tedarik", "Satın Alma Uzmanı (örnek)", sup, qn, up, qn * up, s, day(7), ownerId]));
  return { "servis işi": jobs.length, "görev": tasks.length, "proje": projects.length, "risk": risks.length, "satın alma": buys.length };
}

function partC(out: Stmt[], db: Database, orgId: string, ownerId: string, members: Member[]) {
  const payments: [string, string, number, number, number, string, number][] = [["Örnek Banka", "Ticari kredi", 480000, 24000, 0, "planned", 10], ["Örnek Banka", "Araç kredisi", 210000, 9800, 9800, "paid", -3], ["Örnek Katılım", "Kredi kartı", 64000, 64000, 20000, "partial", 4]];
  insertRows(out, db, "payment_records", ["id", "period", "owner_name", "bank_name", "account_name", "total_debt", "monthly_payment", "paid_amount", "payment_status", "due_date", "workflow_status", "created_by", "organization_id"],
    payments.map(([bank, acc, debt, monthly, paid, st, due]) => [createId("pay"), PERIOD, "Örnek Klima Servis", bank, acc, debt, monthly, paid, st, day(due), "approved", ownerId, orgId]));
  const expenses: [string, string, number][] = [["Yakıt", "Servis araçları yakıt", 18400], ["Parça", "Kompresör ve fan motoru alımı", 42600], ["Kira", "Atölye kirası", 35000], ["Personel", "Yemek kartı yüklemesi", 27000]];
  insertRows(out, db, "expenses", ["id", "period", "owner_name", "category", "description", "amount", "workflow_status", "created_by", "organization_id"],
    expenses.map(([cat, desc, amt]) => [createId("exp"), PERIOD, "Örnek Klima Servis", cat, desc, amt, "approved", ownerId, orgId]));
  const byUser = (username: string) => members.find((m) => m.access_profile === "employee" && m.username === username) ?? members.filter((m) => m.access_profile === "employee")[username.endsWith("2") ? 1 : 0];
  const procs: { slug: string; template: string; title: string; data: Record<string, string>; steps: number; blocked?: string; ageDays?: number; owner?: string; requester?: "t1" | "t2" }[] = [
    { slug: "ik", template: "ise-alim", title: "Yaz sezonu için 2 teknisyen", data: { pozisyon: "Saha teknisyeni", birim: "Operasyon" }, steps: 4, owner: "İK Uzmanı (örnek)" },
    { slug: "ik", template: "ise-alim", title: "Ön muhasebe tam zamanlı", data: { pozisyon: "Ön muhasebe", birim: "Muhasebe" }, steps: 1, ageDays: 8 },
    { slug: "ik", template: "ise-giris", title: "İşe giriş – stajyer teknisyen (örnek)", data: { calisan: "Stajyer Teknisyen (örnek)", baslama: day(3) }, steps: 1, owner: "İK Uzmanı (örnek)" },
    { slug: "ik", template: "izin", title: "Yıllık izin – Teknisyen C (örnek)", data: { tur: "Yıllık", baslangic: day(-2), bitis: day(5), vekil: "Teknisyen A (örnek)" }, steps: 3, requester: "t1" },
    { slug: "ik", template: "izin", title: "Mazeret izni – Teknisyen B (örnek)", data: { tur: "Mazeret", baslangic: day(2), bitis: day(2) }, steps: 1, requester: "t2" },
    { slug: "ik", template: "performans", title: "3. çeyrek değerlendirme – saha ekibi", data: { calisan: "Saha ekibi", donem: "Q3" }, steps: 1 },
    { slug: "ik", template: "ayrilis", title: "Ayrılış – eski depo sorumlusu", data: { calisan: "Örnek Çalışan", "son-gun": day(6) }, steps: 2, blocked: "Servis aracı anahtarı teslim edilmedi" },
    { slug: "satin-alma", template: "talep", title: "Saha ekibi için 2 tablet", data: { urun: "Tablet", miktar: "2", tahmini: "29000", teklifler: "A: 14.500 · B: 15.200 · C: 13.900", secilen: "C" }, steps: 3 },
    { slug: "satin-alma", template: "talep", title: "R32 gaz tüpü (10 adet)", data: { urun: "R32 tüp", miktar: "10" }, steps: 1, ageDays: 9 },
    { slug: "satin-alma", template: "tedarikci", title: "Yeni bakır boru tedarikçisi", data: { firma: "Örnek Metal", belgeler: "Vergi levhası, imza sirküleri" }, steps: 2 },
    { slug: "finans", template: "odeme-talebi", title: "Atölye kirası", data: { alici: "Örnek Gayrimenkul", tutar: "35000", dayanak: "KİRA-ÖRNEK" }, steps: 2 },
    { slug: "finans", template: "odeme-talebi", title: "Parça tedarikçisi ödemesi", data: { alici: "Örnek Soğutma Tedarik", tutar: "21000", dayanak: "FTR-ÖRNEK-0912" }, steps: 1, ageDays: 4 },
    { slug: "muhasebe", template: "ay-sonu", title: `${PERIOD} kapanışı`, data: { donem: day(0).slice(0, 7) }, steps: 1 },
    { slug: "muhasebe", template: "gelen-fatura", title: "Tablet faturası", data: { fatura: "ORN2026000123", tedarikci: "Örnek Bilişim", tutar: "27800" }, steps: 1 },
    { slug: "bt", template: "erisim", title: "Ön muhasebeye e-fatura portalı erişimi", data: { sistem: "e-Fatura portalı", yetki: "Kayıt girişi" }, steps: 1 },
    { slug: "bt", template: "olay", title: "Şüpheli e-posta (oltalama) bildirimi", data: { tespit: "Kargo bildirimi görünümlü bağlantı", "kisisel-veri": "Hayır" }, steps: 3 },
    { slug: "kalite", template: "dof", title: "Geç kalan bakım ziyaretleri", data: { uygunsuzluk: "Geçen ay 3 bakım ziyareti planlanan günden sonra yapıldı", kok: "Planlama panosunda yük uyarısı izlenmedi" }, steps: 2 },
    { slug: "kalite", template: "denetim", title: "Saha formu iç denetimi", data: { kapsam: "Son 30 günün saha formları" }, steps: 1 },
    { slug: "destek", template: "sikayet", title: "Ofis: klima su damlatıyor", data: { musteri: "Müşteri 8 – Ofis binası (örnek)", kanal: "Telefon", kategori: "Hizmet" }, steps: 2 },
    { slug: "destek", template: "sikayet", title: "Otel: fatura tutarı itirazı", data: { musteri: "Müşteri 1 – Otel (örnek)", kanal: "E-posta", kategori: "Fatura" }, steps: 1, ageDays: 3 },
    { slug: "satis", template: "teklif", title: "AVM yıllık bakım sözleşmesi", data: { musteri: "Müşteri 5 – Alışveriş merkezi (örnek)", tutar: "380000", indirim: "8" }, steps: 2 },
    { slug: "satis", template: "teklif", title: "Lojistik deposu soğutma projesi", data: { musteri: "Müşteri 6 – Lojistik deposu (örnek)", tutar: "540000" }, steps: 0 },
    { slug: "hukuk", template: "sozlesme", title: "Otel bakım sözleşmesi yenileme", data: { "karsi-taraf": "Müşteri 1 – Otel (örnek)", tur: "Bakım sözleşmesi" }, steps: 2 },
    { slug: "arge", template: "fikir", title: "Kompresörlere titreşim sensörü", data: { problem: "Plansız kompresör arızaları", olcut: "Arızaların %20 azalması" }, steps: 2 },
    { slug: "arge", template: "destek", title: "KOBİ Ar-Ge destek başvurusu", data: { program: "Ar-Ge destek çağrısı (örnek)", "son-tarih": day(40) }, steps: 1 },
    { slug: "operasyon", template: "aksaklik", title: "Servis aracı arızası: 1 gün ekip eksik", data: { yer: "Merkez", etki: "Orta" }, steps: 1 },
    { slug: "yonetim", template: "hedef", title: "Tahsilat süresini 30 güne indir", data: { hedef: "Ortalama tahsilat süresi", olcut: "En fazla 30 gün" }, steps: 2 },
    { slug: "proje", template: "degisiklik", title: "Montaj projesine ek 4 iç ünite", data: { proje: "Müşteri 3 B blok montajı", etki: "+3 gün, +18.000 TL" }, steps: 2 },
  ];
  const rows: unknown[][] = [], events: unknown[][] = [];
  for (const p of procs) {
    const dep = departmentBySlug(p.slug); const t = dep && templateOf(dep, p.template);
    if (!dep || !t) continue;
    const stage = t.stages[Math.min(p.steps, t.stages.length - 1)];
    const id = createId("dproc");
    const req = p.requester ? byUser(p.requester === "t1" ? "ornek.teknisyen1" : "ornek.teknisyen2") : undefined;
    const requesterId = req?.id ?? ownerId, requesterName = req?.full_name ?? "Firma Sahibi (örnek)";
    rows.push([id, orgId, dep.slug, t.key, p.title, stage.key, p.blocked ? "blocked" : "active", (p.ageDays ?? 0) > 5 ? "high" : "normal", p.owner ?? null, requesterId, requesterName, JSON.stringify(cleanData(t, p.data)), p.blocked ?? null, stamp(p.ageDays ?? 1)]);
    events.push([createId("dpe"), orgId, id, "create", stage.key, requesterId, requesterName, "Örnek süreç"]);
  }
  insertRows(out, db, "department_processes", ["id", "organization_id", "department_slug", "template_key", "title", "stage_key", "status", "priority", "owner_name", "requester_id", "requester_name", "data", "blocked_reason", "stage_entered_at"], rows);
  insertRows(out, db, "department_process_events", ["id", "organization_id", "process_id", "action", "to_stage", "actor_id", "actor_name", "note"], events);
  return { "ödeme kaydı": payments.length, "gider": expenses.length, "birim süreci": rows.length };
}

/** Yönetici ekranı: oluşturulan örnek işletmeler ve kurulum ilerlemesi (yarım kalan devam ettirilebilir). */
export async function listDemoCompanies() {
  const db = getDb();
  const rows = (await db.prepare(`SELECT m.key, m.value, m.updated_at, o.id, o.name, o.created_at FROM app_metadata m JOIN organizations o ON o.id = substr(m.key, 14)
    WHERE m.key LIKE 'demo_company:%' ORDER BY o.created_at DESC LIMIT 20`).all<{ key: string; value: string; updated_at: string; id: string; name: string; created_at: string }>()).results;
  const order = ["accounts", "a", "b", "c"];
  return rows.map((r) => {
    const at = Math.max(0, order.indexOf(r.value)); // accounts=0 … c=3
    return { organizationId: r.id, name: r.name, createdAt: r.created_at, updatedAt: r.updated_at, stepsDone: at + 1, complete: r.value === "c", nextPart: r.value === "c" ? null : DEMO_PARTS[at] };
  });
}
