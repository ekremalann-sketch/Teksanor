import { isAutomationPaused } from "./automation-control";
import { canView, type MemberAccess, type ModuleId } from "./access";
import { auditStatement, createId, getDb } from "./db";
import { requestSafeInitializer } from "./request-safe-initializer";

// Otomasyon kuralının neyi kontrol edeceği artık kural adından tahmin edilmez; kullanıcı
// açıkça seçer ve seçim trigger_config içinde {"check": "..."} olarak saklanır.
export const RULE_CHECKS = {
  payments_due: {
    label: "Vadesi geçen veya 7 gün içinde dolan ödemeler",
    module: "payments",
    count: "SELECT COUNT(*) AS c FROM payment_records WHERE organization_id = ? AND due_date IS NOT NULL AND due_date <= date('now','+7 days') AND payment_status != 'paid' AND monthly_payment > paid_amount",
    total: "SELECT COUNT(*) AS c FROM payment_records WHERE organization_id = ?",
    sample: "SELECT id, owner_name || ' · ' || bank_name || ' · ' || due_date AS label FROM payment_records WHERE organization_id = ? AND due_date IS NOT NULL AND due_date <= date('now','+7 days') AND payment_status != 'paid' AND monthly_payment > paid_amount ORDER BY due_date LIMIT 5",
  },
  work_orders_overdue: {
    label: "Planlanan tarihi geçmiş açık iş emirleri",
    module: "work-orders",
    count: "SELECT COUNT(*) AS c FROM work_orders WHERE organization_id = ? AND status NOT IN ('completed','cancelled') AND scheduled_date IS NOT NULL AND scheduled_date < date('now')",
    total: "SELECT COUNT(*) AS c FROM work_orders WHERE organization_id = ?",
    sample: "SELECT id, title || ' · ' || scheduled_date AS label FROM work_orders WHERE organization_id = ? AND status NOT IN ('completed','cancelled') AND scheduled_date IS NOT NULL AND scheduled_date < date('now') ORDER BY scheduled_date LIMIT 5",
  },
  projects_active: {
    label: "Aktif projeler (ilerleme özeti)",
    module: "projects",
    count: "SELECT COUNT(*) AS c FROM projects WHERE organization_id = ? AND status = 'active'",
    total: "SELECT COUNT(*) AS c FROM projects WHERE organization_id = ?",
    sample: "SELECT id, name AS label FROM projects WHERE organization_id = ? AND status = 'active' ORDER BY name LIMIT 5",
  },
  tasks_high_priority: {
    label: "Açık yüksek/kritik öncelikli görevler",
    module: "tasks",
    count: "SELECT COUNT(*) AS c FROM tasks WHERE organization_id = ? AND status NOT IN ('done','cancelled') AND priority IN ('high','critical')",
    total: "SELECT COUNT(*) AS c FROM tasks WHERE organization_id = ?",
    sample: "SELECT id, title AS label FROM tasks WHERE organization_id = ? AND status NOT IN ('done','cancelled') AND priority IN ('high','critical') ORDER BY created_at DESC LIMIT 5",
  },
} as const satisfies Record<string, { label: string; module: ModuleId; count: string; total: string; sample: string }>;

export type RuleCheck = keyof typeof RULE_CHECKS;
export const RULE_CHECK_IDS = Object.keys(RULE_CHECKS) as RuleCheck[];

export function isRuleCheck(value: unknown): value is RuleCheck {
  return typeof value === "string" && Object.hasOwn(RULE_CHECKS, value);
}

type RuleRow = { id: string; name: string; action_type: string; trigger_config?: string | null };

/** Eski kuralların amacı bilinmiyorsa güvenle atla; kural adından veri kapsamı çıkarma. */
export function resolveCheck(rule: RuleRow): RuleCheck | null {
  try {
    const parsed = JSON.parse(rule.trigger_config || "{}") as { check?: unknown };
    if (isRuleCheck(parsed.check)) return parsed.check;
  } catch { /* bozuk config: sezgiye düş */ }
  // Eski kayıtların adı gerçek veri sorgusunun seçimi olamaz. Sahibi kontrolü açıkça kaydedene kadar çalıştırma.
  return null;
}

export const RUNS_TABLE_SQL = `CREATE TABLE IF NOT EXISTS automation_runs (
  id TEXT PRIMARY KEY,
  organization_id TEXT NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  rule_id TEXT NOT NULL,
  source TEXT NOT NULL CHECK (source IN ('manual', 'schedule')),
  status TEXT NOT NULL CHECK (status IN ('matched', 'clear', 'skipped')),
  check_id TEXT NOT NULL,
  scanned INTEGER NOT NULL DEFAULT 0,
  matched INTEGER NOT NULL DEFAULT 0,
  detail TEXT,
  run_by TEXT,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
)`;

const initializeRunsTable = requestSafeInitializer(async (db: ReturnType<typeof getDb>) => {
    await db.prepare(RUNS_TABLE_SQL).run();
    await db.prepare("CREATE INDEX IF NOT EXISTS idx_automation_runs_rule ON automation_runs(organization_id, rule_id, created_at)").run();
});
export function ensureRunsTable() {
  return initializeRunsTable(getDb());
}

/**
 * Kuralı gerçekten çalıştırır: yetki kapsamındaki kayıtları sayar, eşleşme varsa
 * uygulama içi bildirim oluşturur ve çalışma geçmişine yazar. Harici e-posta/SMS göndermez.
 * Zamanlanmış çalışmada aynı gün ikinci kez çalışmaz (runKey tekilliği).
 */
export async function runRule(input: {
  organizationId: string;
  rule: RuleRow;
  userId: string | null;
  access: MemberAccess | null;
  source: "manual" | "schedule";
}) {
  await ensureRunsTable();
  const db = getDb();
  if (await isAutomationPaused(input.organizationId)) {
    return { runId: "", check: null, scanned: 0, matched: 0, status: "skipped" as const,
      detail: "Otomasyonlar acil durdurma ile durduruldu. Yeniden başlatmak için Otomasyonlar ekranını kullanın.", sample: [] as string[] };
  }
  const check = resolveCheck(input.rule);
  if (!check || input.rule.action_type !== "notify") {
    return { runId: "", check: null, scanned: 0, matched: 0, status: "skipped" as const,
      detail: "Eski kuralın kontrolü ve bildirim eylemi doğrulanmalı.", sample: [] as string[] };
  }
  const spec = RULE_CHECKS[check];
  const runId = input.source === "schedule"
    ? `sched:${input.rule.id}:${new Date().toISOString().slice(0, 10)}`
    : createId("run");

  if (!input.access || !canView(input.access, spec.module)) {
    await db.prepare(`INSERT OR IGNORE INTO automation_runs (id, organization_id, rule_id, source, status, check_id, detail, run_by)
      VALUES (?, ?, ?, ?, 'skipped', ?, ?, ?)`)
      .bind(runId, input.organizationId, input.rule.id, input.source, check, "Çalıştıran kişinin bu modülü görme yetkisi yok.", input.userId).run();
    return { runId, check, scanned: 0, matched: 0, status: "skipped" as const, detail: "Bu kuralın kontrol ettiği modülü görme yetkiniz yok.", sample: [] as string[] };
  }

  const [count, total, sample] = await Promise.all([
    db.prepare(spec.count).bind(input.organizationId).first<{ c: number }>(),
    db.prepare(spec.total).bind(input.organizationId).first<{ c: number }>(),
    db.prepare(spec.sample).bind(input.organizationId).all<{ id: string; label: string }>(),
  ]);
  const matched = count?.c ?? 0;
  const scanned = total?.c ?? 0;
  const labels = sample.results.map((row) => row.label);
  const detail = matched
    ? `${spec.label}: ${matched} kayıt.${labels.length ? ` İlk kayıtlar: ${labels.join("; ")}` : ""}`
    : `${spec.label}: eşleşen kayıt yok.`;
  const status = matched ? "matched" : "clear";

  // A unique marker binds all writes to this batch's claim. A duplicate scheduled
  // run cannot increment counters or send another notification. Marker is replaced
  // by the public detail before commit; audit failure rolls back the claim too.
  const claim = createId("claim");
  const writes = [db.prepare(`INSERT OR IGNORE INTO automation_runs (id, organization_id, rule_id, source, status, check_id, detail, run_by)
    SELECT ?, ?, ?, ?, 'clear', ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM app_metadata WHERE key=? AND value='1')`)
    .bind(runId, input.organizationId, input.rule.id, input.source, check, claim, input.userId, `automation_paused:${input.organizationId}`)];
  if (matched) {
    writes.push(db.prepare(`INSERT INTO notifications (id, organization_id, user_id, title, body, type, entity_type, entity_id)
      SELECT ?, ?, ?, ?, ?, 'warning', 'automation', ? WHERE EXISTS (SELECT 1 FROM automation_runs WHERE id=? AND detail=?)`)
      .bind(createId("notif"), input.organizationId, input.userId, `Otomasyon: ${input.rule.name}`, detail.slice(0, 1000), input.rule.id, runId, claim));
  }
  writes.push(db.prepare(`UPDATE automation_rules SET last_run_at = CURRENT_TIMESTAMP, run_count = run_count + 1
    WHERE id = ? AND organization_id = ? AND EXISTS (SELECT 1 FROM automation_runs WHERE id=? AND detail=?)`)
    .bind(input.rule.id, input.organizationId, runId, claim));
  if (input.source === "manual") writes.push(auditStatement(input.userId, "trigger", "automation_rule", input.rule.id,
    `${input.rule.name} elle çalıştırıldı: ${matched} eşleşme.`, input.organizationId, true));
  writes.push(db.prepare("UPDATE automation_runs SET status = ?, scanned = ?, matched = ?, detail = ? WHERE id = ? AND detail = ?")
    .bind(status, scanned, matched, detail.slice(0, 1000), runId, claim));
  const [claimed] = await db.batch(writes);
  if (!claimed.meta?.changes) {
    const stopped = await isAutomationPaused(input.organizationId);
    return { runId, check, scanned: 0, matched: 0, status: "skipped" as const, detail: stopped
      ? "Otomasyonlar acil durdurma ile durduruldu."
      : "Bu kural bugün zaten zamanlayıcıyla çalıştı.", sample: [] as string[] };
  }
  return { runId, check, scanned, matched, status, detail, sample: labels };
}
