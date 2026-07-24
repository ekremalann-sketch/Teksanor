import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, getDb } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";
import { requireOrganization } from "@/lib/tenancy";

function nextDate(source: string, type: string, value: number) {
  const date = source ? new Date(`${source}T12:00:00Z`) : new Date();
  if (type === "day") date.setUTCDate(date.getUTCDate() + value);
  if (type === "week") date.setUTCDate(date.getUTCDate() + value * 7);
  if (type === "month") date.setUTCMonth(date.getUTCMonth() + value);
  if (type === "year") date.setUTCFullYear(date.getUTCFullYear() + value);
  return date.toISOString().slice(0, 10);
}

export async function PUT(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const { organization } = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    const current = await getDb().prepare("SELECT * FROM maintenance_plans WHERE id=? AND organization_id=?").bind(id, organization.id).first<Record<string, unknown>>();
    if (!current) return NextResponse.json({ error: "Bakım planı bulunamadı." }, { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const action = String(body.action || "");
    if (action === "complete") {
      const completed = new Date().toISOString().slice(0, 10);
      const next = current.frequency_type === "usage" ? current.next_due_date : nextDate(completed, String(current.frequency_type), Number(current.frequency_value || 1));
      await getDb().prepare("UPDATE maintenance_plans SET last_completed_at=?, next_due_date=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?")
        .bind(completed, next, id, organization.id).run();
      await addAudit(user.id, "complete", "maintenance_plan", id, "Bakım tamamlandı ve sonraki tarih hesaplandı.", organization.id);
    } else {
      const status = ["active", "paused", "completed"].includes(String(body.status)) ? String(body.status) : String(current.status);
      await getDb().prepare("UPDATE maintenance_plans SET status=?, next_due_date=?, assigned_to=?, updated_at=CURRENT_TIMESTAMP WHERE id=? AND organization_id=?")
        .bind(status, body.nextDueDate ?? current.next_due_date, body.assignedTo ?? current.assigned_to, id, organization.id).run();
      await addAudit(user.id, "update", "maintenance_plan", id, "Bakım planı güncellendi.", organization.id);
    }
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bakım planı güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const { organization } = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    await getDb().prepare("DELETE FROM maintenance_plans WHERE id=? AND organization_id=?").bind(id, organization.id).run();
    await addAudit(user.id, "delete", "maintenance_plan", id, undefined, organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bakım planı silinemedi." }, { status: 400 });
  }
}
