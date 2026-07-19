import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";

const SENIORITIES = ["stajyer", "uzman-yardimcisi", "uzman", "kidemli-uzman", "yonetici", "direktor"] as const;
const WORK_STATUSES = ["todo", "in_progress", "done", "blocked"] as const;
const PRIORITIES = ["low", "normal", "high", "urgent"] as const;

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  const database = getDb();
  const organizationId = context.organization.id;
  const [departments, employees, workItems] = await Promise.all([
    database.prepare("SELECT * FROM departments WHERE organization_id = ? ORDER BY name").bind(organizationId).all(),
    database.prepare(`SELECT e.*, d.name AS department_name FROM employees e
      LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.organization_id = ? ORDER BY e.full_name`).bind(organizationId).all(),
    database.prepare(`SELECT w.*, d.name AS department_name, e.full_name AS employee_name, p.name AS project_name
      FROM work_items w
      LEFT JOIN departments d ON d.id = w.department_id
      LEFT JOIN employees e ON e.id = w.employee_id
      LEFT JOIN projects p ON p.id = w.project_id
      WHERE w.organization_id = ? ORDER BY w.created_at DESC LIMIT 200`).bind(organizationId).all(),
  ]);
  return NextResponse.json({ departments: departments.results, employees: employees.results, workItems: workItems.results });
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  const database = getDb();
  const organizationId = context.organization.id;
  const body = (await request.json()) as Record<string, string | undefined>;
  const action = body.action;

  if (action === "department") {
    if (!body.name?.trim()) return NextResponse.json({ error: "Departman adı gereklidir." }, { status: 400 });
    const id = createId("department");
    await database.prepare("INSERT INTO departments (id, organization_id, name, description, lead_name, created_by) VALUES (?, ?, ?, ?, ?, ?)")
      .bind(id, organizationId, body.name.trim(), body.description || null, body.leadName || null, user.id).run();
    await addAudit(user.id, "create", "department", id, `${body.name.trim()} departmanı eklendi.`, organizationId);
    return NextResponse.json({ id }, { status: 201 });
  }

  if (action === "employee") {
    if (!body.fullName?.trim()) return NextResponse.json({ error: "Çalışan adı gereklidir." }, { status: 400 });
    const seniority = SENIORITIES.includes(body.seniority as typeof SENIORITIES[number]) ? body.seniority : "uzman";
    const id = createId("employee");
    await database.prepare(`INSERT INTO employees
      (id, organization_id, department_id, full_name, position_title, seniority, email, phone, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, organizationId, body.departmentId || null, body.fullName.trim(), body.positionTitle || null,
        seniority, body.email || null, body.phone || null, user.id).run();
    await addAudit(user.id, "create", "employee", id, `${body.fullName.trim()} çalışan olarak eklendi.`, organizationId);
    return NextResponse.json({ id }, { status: 201 });
  }

  if (action === "workItem") {
    if (!body.title?.trim()) return NextResponse.json({ error: "İş başlığı gereklidir." }, { status: 400 });
    const priority = PRIORITIES.includes(body.priority as typeof PRIORITIES[number]) ? body.priority : "normal";
    const id = createId("work");
    await database.prepare(`INSERT INTO work_items
      (id, organization_id, department_id, employee_id, project_id, title, description, priority, due_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, organizationId, body.departmentId || null, body.employeeId || null, body.projectId || null,
        body.title.trim(), body.description || null, priority, body.dueDate || null, user.id).run();
    await addAudit(user.id, "create", "work_item", id, `${body.title.trim()} işi oluşturuldu.`, organizationId);
    return NextResponse.json({ id }, { status: 201 });
  }

  if (action === "workStatus") {
    if (!body.id || !WORK_STATUSES.includes(body.status as typeof WORK_STATUSES[number])) {
      return NextResponse.json({ error: "Geçersiz iş durumu." }, { status: 400 });
    }
    await database.prepare("UPDATE work_items SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?")
      .bind(body.status, body.id, organizationId).run();
    await addAudit(user.id, "update", "work_item", body.id, "İş durumu güncellendi.", organizationId);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
}
