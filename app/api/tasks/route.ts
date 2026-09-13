import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
const STATUS = ["open", "in_progress", "done", "cancelled"];
const PRIORITY = ["low", "normal", "high", "critical"];

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const result = await getDb().prepare(
      `SELECT * FROM tasks WHERE organization_id = ?
       ORDER BY CASE status WHEN 'in_progress' THEN 1 WHEN 'open' THEN 2 WHEN 'done' THEN 3 ELSE 4 END,
       CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'normal' THEN 3 ELSE 4 END, created_at DESC`)
      .bind(context.organization.id).all();
    return NextResponse.json({ tasks: result.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Görevler alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const body = await request.json() as Record<string, unknown>;
    const title = text(body.title);
    const department = text(body.department);
    if (!title || !department) return NextResponse.json({ error: "Görev başlığı ve departman gereklidir." }, { status: 400 });
    const status = STATUS.includes(text(body.status)) ? text(body.status) : "open";
    const priority = PRIORITY.includes(text(body.priority)) ? text(body.priority) : "normal";
    const id = createId("task");
    await getDb().prepare(`INSERT INTO tasks
      (id, organization_id, title, description, department, assignee_name, status, priority, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, context.organization.id, title, text(body.description, 1200) || null, department,
        text(body.assigneeName) || null, status, priority, text(body.dueDate, 20) || null, user.id).run();
    await addAudit(user.id, "create", "task", id, `${title} görevi oluşturuldu.`, context.organization.id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Görev oluşturulamadı." }, { status: 400 });
  }
}
