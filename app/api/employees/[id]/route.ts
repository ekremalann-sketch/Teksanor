import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
const STATUS = ["active", "on_leave", "inactive"];
const EMP_TYPE = ["full_time", "part_time", "contractor", "intern"];

export async function PUT(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    const body = await request.json() as Record<string, unknown>;
    const existing = await getDb().prepare("SELECT * FROM employees WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first<Record<string, unknown>>();
    if (!existing) return NextResponse.json({ error: "Çalışan bulunamadı." }, { status: 404 });
    const status = STATUS.includes(text(body.status)) ? text(body.status) : String(existing.status);
    const employmentType = EMP_TYPE.includes(text(body.employmentType)) ? text(body.employmentType) : String(existing.employment_type);
    await getDb().prepare(`UPDATE employees SET full_name = ?, title = ?, department = ?, email = ?, phone = ?,
      start_date = ?, status = ?, employment_type = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`)
      .bind(text(body.fullName) || String(existing.full_name),
        body.title !== undefined ? text(body.title) || null : existing.title,
        text(body.department) || String(existing.department),
        body.email !== undefined ? text(body.email) || null : existing.email,
        body.phone !== undefined ? text(body.phone) || null : existing.phone,
        body.startDate !== undefined ? text(body.startDate, 20) || null : existing.start_date,
        status, employmentType,
        body.notes !== undefined ? text(body.notes, 1200) || null : existing.notes, id, context.organization.id).run();
    await addAudit(user.id, "update", "employee", id, `${existing.full_name} çalışanı güncellendi.`, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışan güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    await getDb().prepare("DELETE FROM employees WHERE id = ? AND organization_id = ?").bind(id, context.organization.id).run();
    await addAudit(user.id, "delete", "employee", id, undefined, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışan silinemedi." }, { status: 400 });
  }
}
