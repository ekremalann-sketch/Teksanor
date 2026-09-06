import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
const TYPE = ["inspection", "installation", "maintenance", "support", "audit", "other"];
const STATUS = ["planned", "completed", "cancelled"];

export async function PUT(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    const body = await request.json() as Record<string, unknown>;
    const existing = await getDb().prepare("SELECT * FROM field_visits WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first<Record<string, unknown>>();
    if (!existing) return NextResponse.json({ error: "Saha ziyareti bulunamadı." }, { status: 404 });
    const status = STATUS.includes(text(body.status)) ? text(body.status) : String(existing.status);
    const visitType = TYPE.includes(text(body.visitType)) ? text(body.visitType) : String(existing.visit_type);
    await getDb().prepare(`UPDATE field_visits SET visitor_name = ?, customer_name = ?, location = ?, visit_date = ?,
      visit_type = ?, status = ?, duration_hours = ?, findings = ?, actions_taken = ?, next_visit_date = ?
      WHERE id = ? AND organization_id = ?`)
      .bind(text(body.visitorName) || String(existing.visitor_name),
        body.customerName !== undefined ? text(body.customerName) || null : existing.customer_name,
        text(body.location) || String(existing.location), text(body.visitDate, 20) || String(existing.visit_date),
        visitType, status, Number(body.durationHours ?? existing.duration_hours ?? 0),
        body.findings !== undefined ? text(body.findings, 1200) || null : existing.findings,
        body.actionsTaken !== undefined ? text(body.actionsTaken, 1200) || null : existing.actions_taken,
        body.nextVisitDate !== undefined ? text(body.nextVisitDate, 20) || null : existing.next_visit_date,
        id, context.organization.id).run();
    await addAudit(user.id, "update", "field_visit", id, `${existing.visit_number} saha ziyareti güncellendi.`, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Saha ziyareti güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    await getDb().prepare("DELETE FROM field_visits WHERE id = ? AND organization_id = ?").bind(id, context.organization.id).run();
    await addAudit(user.id, "delete", "field_visit", id, undefined, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Saha ziyareti silinemedi." }, { status: 400 });
  }
}
