import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";

function text(value: unknown, max = 180) { return String(value ?? "").trim().slice(0, max); }

async function ensureProjectsTable() {
  const database = getDb();
  await database.prepare(`CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    organization_id TEXT NOT NULL,
    name TEXT NOT NULL,
    code TEXT,
    department TEXT NOT NULL,
    owner_name TEXT,
    status TEXT NOT NULL CHECK (status IN ('planning', 'active', 'on_hold', 'completed')) DEFAULT 'planning',
    priority TEXT NOT NULL CHECK (priority IN ('low', 'normal', 'high', 'critical')) DEFAULT 'normal',
    start_date TEXT,
    target_date TEXT,
    budget REAL NOT NULL DEFAULT 0,
    progress INTEGER NOT NULL DEFAULT 0,
    description TEXT,
    created_by TEXT,
    created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
  )`).run();
  await database.prepare("CREATE INDEX IF NOT EXISTS idx_projects_org ON projects(organization_id, status)").run();
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    await ensureProjectsTable();
    const result = await getDb().prepare("SELECT * FROM projects WHERE organization_id = ? ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'planning' THEN 2 WHEN 'on_hold' THEN 3 ELSE 4 END, created_at DESC")
      .bind(context.organization.id).all();
    return NextResponse.json({ projects: result.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Projeler alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    await ensureProjectsTable();
    const body = await request.json() as Record<string, unknown>;
    const name = text(body.name);
    const department = text(body.department);
    if (!name || !department) return NextResponse.json({ error: "Proje adı ve departman gereklidir." }, { status: 400 });
    const allowedStatus = ["planning", "active", "on_hold", "completed"];
    const allowedPriority = ["low", "normal", "high", "critical"];
    const status = allowedStatus.includes(text(body.status)) ? text(body.status) : "planning";
    const priority = allowedPriority.includes(text(body.priority)) ? text(body.priority) : "normal";
    const progress = Math.min(100, Math.max(0, Number(body.progress || 0)));
    const budget = Math.max(0, Number(body.budget || 0));
    const id = createId("project");
    await getDb().prepare(`INSERT INTO projects
      (id, organization_id, name, code, department, owner_name, status, priority, start_date, target_date, budget, progress, description, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, context.organization.id, name, text(body.code, 40) || null, department, text(body.ownerName) || null,
        status, priority, text(body.startDate, 20) || null, text(body.targetDate, 20) || null, budget, progress,
        text(body.description, 1200) || null, user.id).run();
    await addAudit(user.id, "create", "project", id, `${name} projesi oluşturuldu.`, context.organization.id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Proje oluşturulamadı." }, { status: 400 });
  }
}
