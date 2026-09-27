import { canView, errorStatus, getMemberAccess } from "@/lib/access";
import { ensureRunsTable, isRuleCheck, runRule, resolveCheck, RULE_CHECKS } from "@/lib/automation-rules";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 300) { return String(value ?? "").trim().slice(0, max); }
const TRIGGER = ["schedule", "manual"];
const ACTION = ["notify"];

export async function PUT(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    const body = await request.json() as Record<string, unknown>;
    const existing = await getDb().prepare("SELECT * FROM automation_rules WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first<Record<string, unknown>>();
    if (!existing) return NextResponse.json({ error: "Kural bulunamadı." }, { status: 404 });
    const triggerType = TRIGGER.includes(text(body.triggerType)) ? text(body.triggerType) : String(existing.trigger_type);
    const actionType = ACTION.includes(text(body.actionType)) ? text(body.actionType) : String(existing.action_type);
    const triggerConfig = isRuleCheck(body.check) ? JSON.stringify({ check: body.check }) : existing.trigger_config ?? null;
    await getDb().prepare(`UPDATE automation_rules SET name = ?, description = ?, trigger_type = ?, action_type = ?, is_active = ?,
      trigger_config = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`)
      .bind(text(body.name) || String(existing.name),
        body.description !== undefined ? text(body.description, 800) || null : existing.description,
        triggerType, actionType, body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.is_active,
        triggerConfig,
        id, context.organization.id).run();
    await addAudit(user.id, "update", "automation_rule", id, `${existing.name} kuralı güncellendi.`, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Otomasyon güncellenemedi." }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    const removed = await getDb().prepare("DELETE FROM automation_rules WHERE id = ? AND organization_id = ?").bind(id, context.organization.id).run();
    // Başka firmanın veya olmayan bir kaydın silinmesi başarı ve denetim kaydı üretmez.
    if (!removed.meta?.changes) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    await addAudit(user.id, "delete", "automation_rule", id, undefined, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Otomasyon silinemedi." }, { status: errorStatus(error) });
  }
}

// "Şimdi çalıştır": kuralı gerçekten çalıştırır (uygulama içi bildirim + çalışma geçmişi).
// Harici e-posta/SMS göndermez; bu sınır arayüzde de yazılıdır.
export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const orgId = context.organization.id;
    const { id } = await routeContext.params;
    const rule = await getDb().prepare("SELECT id, name, action_type, trigger_config FROM automation_rules WHERE id = ? AND organization_id = ?")
      .bind(id, orgId).first<{ id: string; name: string; action_type: string; trigger_config: string | null }>();
    if (!rule) return NextResponse.json({ error: "Kural bulunamadı." }, { status: 404 });
    const access = await getMemberAccess(user, context.organization);
    const result = await runRule({ organizationId: orgId, rule, userId: user.id, access, source: "manual" });
    if (result.status !== "skipped") await addAudit(user.id, "trigger", "automation_rule", id, `${rule.name} elle çalıştırıldı: ${result.matched} eşleşme.`, orgId);
    const message = result.status === "skipped"
      ? result.detail
      : `${result.scanned} kayıt incelendi, ${result.matched} eşleşme. ${result.matched ? "Bildirim oluşturuldu." : "Bildirim gerekmedi."}`;
    return NextResponse.json({ ok: result.status !== "skipped", ...result, message }, { status: result.status === "skipped" ? 403 : 200 });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Otomasyon çalıştırılamadı." }, { status: errorStatus(error) });
  }
}

// Kuralın son 10 çalışması: ne zaman, kim/zamanlayıcı, kaç eşleşme, ne bulundu.
export async function GET(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    const rule = await getDb().prepare("SELECT id, name, action_type, trigger_config FROM automation_rules WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first<{ id: string; name: string; action_type: string; trigger_config: string | null }>();
    if (!rule) return NextResponse.json({ error: "Kural bulunamadı." }, { status: 404 });
    const check = resolveCheck(rule);
    if (!check || !canView(await getMemberAccess(user, context.organization), RULE_CHECKS[check].module))
      return NextResponse.json({ error: "Çalışma geçmişine erişim yok." }, { status: 403 });
    await ensureRunsTable();
    const runs = await getDb().prepare(`SELECT r.id, r.source, r.status, r.check_id, r.scanned, r.matched, r.detail, r.created_at, u.full_name AS run_by_name
      FROM automation_runs r LEFT JOIN users u ON u.id = r.run_by
      WHERE r.organization_id = ? AND r.rule_id = ? ORDER BY r.created_at DESC LIMIT 10`)
      .bind(context.organization.id, id).all();
    return NextResponse.json({ runs: runs.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma geçmişi alınamadı." }, { status: errorStatus(error, 403) });
  }
}
