import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
const STATUS = ["open", "in_progress", "done", "cancelled"];
const PRIORITY = ["low", "normal", "high", "critical"];

export async function PUT(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    const body = await request.json() as Record<string, unknown>;
    const existing = await getDb().prepare("SELECT * FROM tasks WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first<Record<string, unknown>>();
    if (!existing) return NextResponse.json({ error: "Görev bulunamadı." }, { status: 404 });
    const status = STATUS.includes(text(body.status)) ? text(body.status) : String(existing.status);
    const priority = PRIORITY.includes(text(body.priority)) ? text(body.priority) : String(existing.priority);
    const title = text(body.title) || String(existing.title);
    const completedAt = status === "done" ? (existing.completed_at || new Date().toISOString()) : null;
    await getDb().prepare(`UPDATE tasks SET title = ?, description = ?, department = ?, assignee_name = ?,
      status = ?, priority = ?, due_date = ?, completed_at = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ? AND organization_id = ?`)
      .bind(title, text(body.description, 1200) ?? existing.description, text(body.department) || String(existing.department),
        body.assigneeName !== undefined ? text(body.assigneeName) || null : existing.assignee_name,
        status, priority, body.dueDate !== undefined ? text(body.dueDate, 20) || null : existing.due_date,
        completedAt, id, context.organization.id).run();
    await addAudit(user.id, "update", "task", id, `${title} görevi güncellendi.`, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Görev güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    await getDb().prepare("DELETE FROM tasks WHERE id = ? AND organization_id = ?").bind(id, context.organization.id).run();
    await addAudit(user.id, "delete", "task", id, undefined, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Görev silinemedi." }, { status: 400 });
  }
}
