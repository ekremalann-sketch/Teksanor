import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, getDb, refreshOrganizationPeriodSummary } from "@/lib/db";
import { canManageOrganization, requireOrganization } from "@/lib/tenancy";

export async function PATCH(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let orgContext;
  try { orgContext = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Erişim reddedildi." }, { status: 403 }); }
  if (!canManageOrganization(user, orgContext.organization)) return NextResponse.json({ error: "Şirket yöneticisi yetkisi gerekli." }, { status: 403 });
  const { id } = await routeContext.params;
  const body = (await request.json()) as { action?: string };
  if (body.action !== "approve") return NextResponse.json({ error: "Geçersiz işlem." }, { status: 400 });
  await getDb().prepare("UPDATE payment_records SET workflow_status = 'approved', updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?")
    .bind(user.id, id, orgContext.organization.id).run();
  await addAudit(user.id, "approve", "payment_record", id, undefined, orgContext.organization.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let orgContext;
  try { orgContext = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Erişim reddedildi." }, { status: 403 }); }
  if (!canManageOrganization(user, orgContext.organization)) return NextResponse.json({ error: "Şirket yöneticisi yetkisi gerekli." }, { status: 403 });
  const { id } = await routeContext.params;
  const record = await getDb().prepare("SELECT period FROM payment_records WHERE id = ? AND organization_id = ?")
    .bind(id, orgContext.organization.id).first<{ period: string }>();
  if (!record) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
  await getDb().prepare("DELETE FROM payment_records WHERE id = ? AND organization_id = ?").bind(id, orgContext.organization.id).run();
  await refreshOrganizationPeriodSummary(orgContext.organization.id, record.period);
  await addAudit(user.id, "delete", "payment_record", id, undefined, orgContext.organization.id);
  return NextResponse.json({ ok: true });
}
