import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, getDb, refreshOrganizationPeriodSummary } from "@/lib/db";
import { canManageOrganization, requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

export async function PATCH(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let orgContext;
  try { orgContext = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Erişim reddedildi." }, { status: 403 }); }
  if (!canManageOrganization(user, orgContext.organization)) return NextResponse.json({ error: "Şirket yöneticisi yetkisi gerekli." }, { status: 403 });
  const { id } = await routeContext.params;
  const body = (await request.json()) as Record<string, unknown>;
  if (body.action === "approve") {
    await getDb().prepare("UPDATE payment_records SET workflow_status = 'approved', updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?")
      .bind(user.id, id, orgContext.organization.id).run();
    await addAudit(user.id, "approve", "payment_record", id, undefined, orgContext.organization.id);
    return NextResponse.json({ ok: true });
  }
  if (!body.period || !body.ownerName || !body.bankName || !body.accountName) {
    return NextResponse.json({ error: "Dönem, kişi, banka ve hesap adı gereklidir." }, { status: 400 });
  }
  const previous = await getDb().prepare("SELECT period FROM payment_records WHERE id = ? AND organization_id = ?")
    .bind(id, orgContext.organization.id).first<{ period: string }>();
  if (!previous) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
  const numberValue = (key: string) => Number(body[key] ?? 0) || 0;
  await getDb().prepare(`UPDATE payment_records SET
    period = ?, owner_name = ?, bank_name = ?, account_name = ?, total_limit = ?, total_debt = ?, restructuring = ?,
    monthly_payment = ?, next_installment = ?, overdraft_debt = ?, overdraft_limit = ?, minimum_payment = ?,
    due_date = ?, important_note = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?`)
    .bind(
      String(body.period), String(body.ownerName), String(body.bankName), String(body.accountName),
      numberValue("totalLimit"), numberValue("totalDebt"), numberValue("restructuring"), numberValue("monthlyPayment"),
      numberValue("nextInstallment"), numberValue("overdraftDebt"), numberValue("overdraftLimit"), numberValue("minimumPayment"),
      body.dueDate ? String(body.dueDate) : null, body.importantNote ? String(body.importantNote) : null,
      user.id, id, orgContext.organization.id,
    ).run();
  await refreshOrganizationPeriodSummary(orgContext.organization.id, previous.period);
  if (String(body.period) !== previous.period) await refreshOrganizationPeriodSummary(orgContext.organization.id, String(body.period));
  await addAudit(user.id, "update", "payment_record", id, `${body.bankName} kaydı güncellendi.`, orgContext.organization.id);
  return NextResponse.json({ ok: true });
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
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
