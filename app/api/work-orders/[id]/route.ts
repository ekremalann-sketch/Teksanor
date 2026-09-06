import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
const TYPE = ["maintenance", "repair", "installation", "inspection", "other"];
const STATUS = ["open", "assigned", "in_progress", "completed", "cancelled"];
const PRIORITY = ["low", "normal", "high", "critical"];

export async function PUT(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    if(await getDb().prepare("SELECT id FROM service_jobs WHERE id=? AND organization_id=?").bind(id,context.organization.id).first())return NextResponse.json({error:"Bu kaydı Servis masası üzerinden yönetin."},{status:409});
    const body = await request.json() as Record<string, unknown>;
    const existing = await getDb().prepare("SELECT * FROM work_orders WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first<Record<string, unknown>>();
    if (!existing) return NextResponse.json({ error: "İş emri bulunamadı." }, { status: 404 });
    const status = STATUS.includes(text(body.status)) ? text(body.status) : String(existing.status);
    const orderType = TYPE.includes(text(body.orderType)) ? text(body.orderType) : String(existing.order_type);
    const priority = PRIORITY.includes(text(body.priority)) ? text(body.priority) : String(existing.priority);
    const completedDate = status === "completed" ? (existing.completed_date || new Date().toISOString().slice(0, 10)) : null;
    await getDb().prepare(`UPDATE work_orders SET title = ?, description = ?, customer_name = ?, location = ?, department = ?,
      order_type = ?, status = ?, priority = ?, assigned_to = ?, scheduled_date = ?, completed_date = ?, estimated_hours = ?,
      actual_hours = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`)
      .bind(text(body.title) || String(existing.title), body.description !== undefined ? text(body.description, 1200) : existing.description,
        body.customerName !== undefined ? text(body.customerName) || null : existing.customer_name,
        body.location !== undefined ? text(body.location) || null : existing.location,
        text(body.department) || String(existing.department), orderType, status, priority,
        body.assignedTo !== undefined ? text(body.assignedTo) || null : existing.assigned_to,
        body.scheduledDate !== undefined ? text(body.scheduledDate, 20) || null : existing.scheduled_date,
        completedDate, Number(body.estimatedHours ?? existing.estimated_hours ?? 0), Number(body.actualHours ?? existing.actual_hours ?? 0),
        body.notes !== undefined ? text(body.notes, 1200) || null : existing.notes, id, context.organization.id).run();
    await addAudit(user.id, "update", "work_order", id, `${existing.order_number} iş emri güncellendi.`, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "İş emri güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    if(await getDb().prepare("SELECT id FROM service_jobs WHERE id=? AND organization_id=?").bind(id,context.organization.id).first())return NextResponse.json({error:"Bu kaydı Servis masası üzerinden yönetin."},{status:409});
    await getDb().prepare("DELETE FROM work_orders WHERE id = ? AND organization_id = ?").bind(id, context.organization.id).run();
    await addAudit(user.id, "delete", "work_order", id, undefined, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "İş emri silinemedi." }, { status: 400 });
  }
}
