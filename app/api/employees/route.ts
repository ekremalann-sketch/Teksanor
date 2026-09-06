import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
const STATUS = ["active", "on_leave", "inactive"];
const EMP_TYPE = ["full_time", "part_time", "contractor", "intern"];

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const result = await getDb().prepare(
      "SELECT * FROM employees WHERE organization_id = ? ORDER BY department, full_name")
      .bind(context.organization.id).all();
    return NextResponse.json({ employees: result.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışanlar alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const body = await request.json() as Record<string, unknown>;
    const fullName = text(body.fullName);
    const department = text(body.department);
    if (!fullName || !department) return NextResponse.json({ error: "Ad soyad ve departman gereklidir." }, { status: 400 });
    const status = STATUS.includes(text(body.status)) ? text(body.status) : "active";
    const employmentType = EMP_TYPE.includes(text(body.employmentType)) ? text(body.employmentType) : "full_time";
    const id = createId("emp");
    await getDb().prepare(`INSERT INTO employees
      (id, organization_id, full_name, title, department, email, phone, start_date, status, employment_type, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, context.organization.id, fullName, text(body.title) || null, department, text(body.email) || null,
        text(body.phone) || null, text(body.startDate, 20) || null, status, employmentType, text(body.notes, 1200) || null, user.id).run();
    await addAudit(user.id, "create", "employee", id, `${fullName} çalışan kaydı eklendi.`, context.organization.id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışan eklenemedi." }, { status: 400 });
  }
}
