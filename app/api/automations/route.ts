import { NextResponse } from "next/server";
import { errorStatus } from "@/lib/access";
import { isRuleCheck } from "@/lib/automation-rules";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 300) { return String(value ?? "").trim().slice(0, max); }
const templates = [
  { name: "Vade yaklaşan ödemeler", description: "Son ödeme tarihi yaklaşan finans kayıtlarını günlük tarar ve bildirim oluşturur.", trigger_type: "schedule", action_type: "notify", check: "payments_due" },
  { name: "Geciken iş emirleri", description: "Planlanan tarihi geçmiş açık iş emirlerini günlük kontrol eder ve uygulama içi bildirim oluşturur.", trigger_type: "schedule", action_type: "notify", check: "work_orders_overdue" },
  { name: "Aylık proje raporu", description: "Aktif projeleri günlük sayar ve özet bildirimi oluşturur.", trigger_type: "schedule", action_type: "notify", check: "projects_active" },
  { name: "Yüksek öncelikli görev bildirimi", description: "Açık kritik ve yüksek öncelikli görevleri günlük kontrol eder ve uygulama içi bildirim oluşturur.", trigger_type: "schedule", action_type: "notify", check: "tasks_high_priority" },
];

async function seedTemplates(organizationId: string, userId: string) {
  const db = getDb();
  const count = await db.prepare("SELECT COUNT(*) AS c FROM automation_rules WHERE organization_id = ?").bind(organizationId).first<{ c: number }>();
  if ((count?.c ?? 0) > 0) return;
  for (const template of templates) {
    await db.prepare(`INSERT INTO automation_rules
      (id, organization_id, name, description, trigger_type, trigger_config, action_type, is_active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, 0, ?)`)
      .bind(createId("auto"), organizationId, template.name, template.description, template.trigger_type, JSON.stringify({ check: template.check }), template.action_type, userId).run();
  }
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    await seedTemplates(context.organization.id, user.id);
    const result = await getDb().prepare(
      "SELECT * FROM automation_rules WHERE organization_id = ? ORDER BY is_active DESC, created_at DESC")
      .bind(context.organization.id).all();
    return NextResponse.json({ automations: result.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Otomasyonlar alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const body = await request.json() as Record<string, unknown>;
    const name = text(body.name);
    if (!name) return NextResponse.json({ error: "Kural adı gereklidir." }, { status: 400 });
    if (!isRuleCheck(body.check)) return NextResponse.json({ error: "Kuralın neyi kontrol edeceğini seçin." }, { status: 400 });
    // Şu an yalnız iki gerçek tetik (günlük zamanlayıcı, el ile) ve bir gerçek eylem (uygulama içi bildirim) vardır.
    const triggerType = text(body.triggerType) === "manual" ? "manual" : "schedule";
    const actionType = "notify";
    const id = createId("auto");
    await getDb().prepare(`INSERT INTO automation_rules
      (id, organization_id, name, description, trigger_type, trigger_config, action_type, is_active, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, context.organization.id, name, text(body.description, 800) || null, triggerType, JSON.stringify({ check: body.check }), actionType,
        body.isActive === false ? 0 : 1, user.id).run();
    await addAudit(user.id, "create", "automation_rule", id, `${name} otomasyon kuralı oluşturuldu.`, context.organization.id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Otomasyon oluşturulamadı." }, { status: errorStatus(error) });
  }
}

export async function PATCH(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const body = await request.json() as Record<string, unknown>;
    const id = text(body.id, 80);
    if (!id) return NextResponse.json({ error: "Kural kimliği gereklidir." }, { status: 400 });
    const existing = await getDb().prepare("SELECT is_active FROM automation_rules WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first<{ is_active: number }>();
    if (!existing) return NextResponse.json({ error: "Kural bulunamadı." }, { status: 404 });
    const next = body.isActive !== undefined ? (body.isActive ? 1 : 0) : (existing.is_active ? 0 : 1);
    await getDb().prepare("UPDATE automation_rules SET is_active = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?")
      .bind(next, id, context.organization.id).run();
    await addAudit(user.id, "update", "automation_rule", id, `Otomasyon durumu ${next ? "aktif" : "pasif"} yapıldı.`, context.organization.id);
    return NextResponse.json({ ok: true, isActive: next });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Otomasyon güncellenemedi." }, { status: errorStatus(error) });
  }
}
