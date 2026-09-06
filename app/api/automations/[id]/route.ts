import { requireModuleAccess } from "@/lib/access";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 300) { return String(value ?? "").trim().slice(0, max); }
const TRIGGER = ["schedule", "threshold", "status_change", "manual"];
const ACTION = ["notify", "create_task", "create_report", "flag_record"];

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
    await getDb().prepare(`UPDATE automation_rules SET name = ?, description = ?, trigger_type = ?, action_type = ?, is_active = ?,
      updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`)
      .bind(text(body.name) || String(existing.name),
        body.description !== undefined ? text(body.description, 800) || null : existing.description,
        triggerType, actionType, body.isActive !== undefined ? (body.isActive ? 1 : 0) : existing.is_active,
        id, context.organization.id).run();
    await addAudit(user.id, "update", "automation_rule", id, `${existing.name} kuralı güncellendi.`, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Otomasyon güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    await getDb().prepare("DELETE FROM automation_rules WHERE id = ? AND organization_id = ?").bind(id, context.organization.id).run();
    await addAudit(user.id, "delete", "automation_rule", id, undefined, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Otomasyon silinemedi." }, { status: 400 });
  }
}

// Manuel tetikleme — gerçek işlem yapmaz, uygun kayıtları tarayıp simülasyon sonucu döner.
export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const orgId = context.organization.id;
    const { id } = await routeContext.params;
    const db = getDb();
    const rule = await db.prepare("SELECT * FROM automation_rules WHERE id = ? AND organization_id = ?")
      .bind(id, orgId).first<Record<string, unknown>>();
    if (!rule) return NextResponse.json({ error: "Kural bulunamadı." }, { status: 404 });

    const today = new Date().toISOString().slice(0, 10);
    const soon = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    let scanned = 0;
    let matched = 0;
    let detail = "";

    const name = String(rule.name);
    if (name.includes("ödeme") || String(rule.action_type) === "notify") {
      await requireModuleAccess(user,context.organization,"payments");
      const payments = await db.prepare(
        "SELECT COUNT(*) AS c FROM payment_records WHERE organization_id = ? AND due_date IS NOT NULL AND due_date <= ?")
        .bind(orgId, soon).first<{ c: number }>();
      const total = await db.prepare("SELECT COUNT(*) AS c FROM payment_records WHERE organization_id = ?").bind(orgId).first<{ c: number }>();
      scanned = total?.c ?? 0;
      matched = payments?.c ?? 0;
      detail = `${matched} finans kaydının vadesi 7 gün içinde.`;
    } else if (name.includes("iş emri") || String(rule.action_type) === "create_task") {
      await requireModuleAccess(user,context.organization,"work-orders");
      const overdue = await db.prepare(
        "SELECT COUNT(*) AS c FROM work_orders WHERE organization_id = ? AND status NOT IN ('completed','cancelled') AND scheduled_date IS NOT NULL AND scheduled_date < ?")
        .bind(orgId, today).first<{ c: number }>();
      const total = await db.prepare("SELECT COUNT(*) AS c FROM work_orders WHERE organization_id = ?").bind(orgId).first<{ c: number }>();
      scanned = total?.c ?? 0;
      matched = overdue?.c ?? 0;
      detail = `${matched} iş emri planlanan tarihini geçmiş.`;
    } else if (name.includes("proje") || String(rule.action_type) === "create_report") {
      await requireModuleAccess(user,context.organization,"projects");
      const active = await db.prepare("SELECT COUNT(*) AS c FROM projects WHERE organization_id = ? AND status = 'active'").bind(orgId).first<{ c: number }>();
      const total = await db.prepare("SELECT COUNT(*) AS c FROM projects WHERE organization_id = ?").bind(orgId).first<{ c: number }>();
      scanned = total?.c ?? 0;
      matched = active?.c ?? 0;
      detail = `${matched} aktif proje rapora dahil edildi.`;
    } else {
      await requireModuleAccess(user,context.organization,"tasks");
      const tasks = await db.prepare(
        "SELECT COUNT(*) AS c FROM tasks WHERE organization_id = ? AND status != 'done' AND priority IN ('high','critical')")
        .bind(orgId).first<{ c: number }>();
      const total = await db.prepare("SELECT COUNT(*) AS c FROM tasks WHERE organization_id = ?").bind(orgId).first<{ c: number }>();
      scanned = total?.c ?? 0;
      matched = tasks?.c ?? 0;
      detail = `${matched} yüksek öncelikli görev tespit edildi.`;
    }

    // Simülasyon çıktısı olarak bir bildirim üret.
    await db.prepare(`INSERT INTO notifications (id, organization_id, user_id, title, body, type, entity_type, entity_id)
      VALUES (?, ?, ?, ?, ?, 'info', 'automation', ?)`)
      .bind(createId("notif"), orgId, user.id, `Otomasyon çalıştı: ${name}`, `${detail} (simülasyon)`, id).run();

    await db.prepare("UPDATE automation_rules SET last_run_at = CURRENT_TIMESTAMP, run_count = run_count + 1 WHERE id = ? AND organization_id = ?")
      .bind(id, orgId).run();
    await addAudit(user.id, "trigger", "automation_rule", id, `${name} manuel tetiklendi.`, orgId);

    const message = `${scanned} kayıt tarandı, ${matched} işlem simüle edildi. ${detail}`;
    return NextResponse.json({ ok: true, scanned, matched, message });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Otomasyon tetiklenemedi." }, { status: 400 });
  }
}
