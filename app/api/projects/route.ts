import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, createId, addAudit } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
const STATUS = ["planned", "active", "on_hold", "completed", "cancelled"];

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const rows = await getDb().prepare("SELECT * FROM projects WHERE organization_id = ? ORDER BY created_at DESC")
      .bind(context.organization.id).all();
    return NextResponse.json({ projects: rows.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Projeler alınamadı." }, { status: 403 });
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
    if (!name) return NextResponse.json({ error: "Proje adı gereklidir." }, { status: 400 });
    const status = STATUS.includes(text(body.status)) ? text(body.status) : "planned";
    const id = createId("prj");
    const code = `PRJ-${id.slice(-6).toUpperCase()}`;
    await getDb().prepare(`INSERT INTO projects (id, organization_id, code, name, description, customer_name, status, progress, budget, start_date, end_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, context.organization.id, code, name, text(body.description, 1200) || null, text(body.customerName) || null, status,
        Math.max(0, Math.min(100, Number(body.progress || 0))), Number(body.budget || 0), text(body.startDate, 20) || null, text(body.endDate, 20) || null, user.id).run();
    await addAudit(user.id, "create", "project", id, `${name} projesi oluşturuldu.`, context.organization.id);
    return NextResponse.json({ ok: true, id, code });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Proje oluşturulamadı." }, { status: 400 });
  }
}
