import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";

const STATUSES = ["planned", "active", "on_hold", "completed", "canceled"] as const;

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  const projects = await getDb().prepare(`SELECT p.*, d.name AS department_name FROM projects p
    LEFT JOIN departments d ON d.id = p.department_id
    WHERE p.organization_id = ? ORDER BY p.created_at DESC`).bind(context.organization.id).all();
  return NextResponse.json({ projects: projects.results });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  const body = (await request.json()) as {
    name?: string; description?: string; status?: string; ownerName?: string;
    departmentId?: string; budget?: number; progress?: number; startDate?: string; dueDate?: string;
  };
  if (!body.name?.trim()) return NextResponse.json({ error: "Proje adı gereklidir." }, { status: 400 });
  const status = STATUSES.includes(body.status as typeof STATUSES[number]) ? body.status : "planned";
  const progress = Math.min(100, Math.max(0, Number(body.progress ?? 0)));
  const id = createId("project");
  await getDb().prepare(`INSERT INTO projects
    (id, organization_id, name, description, status, owner_name, department_id, budget, progress, start_date, due_date, created_by)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, context.organization.id, body.name.trim(), body.description || null, status, body.ownerName || null,
      body.departmentId || null, Number(body.budget ?? 0), progress, body.startDate || null, body.dueDate || null, user.id)
    .run();
  await addAudit(user.id, "create", "project", id, `${body.name.trim()} projesi eklendi.`, context.organization.id);
  return NextResponse.json({ id }, { status: 201 });
}
