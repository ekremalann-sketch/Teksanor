import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, getDb, refreshOrganizationPeriodSummary } from "@/lib/db";
import { canManageOrganization, requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";
import { assertPaymentAmounts, inferredPaymentStatus, parseOptionalLocalizedNumber } from "@/lib/finance";

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
  const numericFields = ["totalLimit", "totalDebt", "restructuring", "monthlyPayment", "nextInstallment", "overdraftDebt", "overdraftLimit", "interestRate", "interestDebt", "minimumPayment", "paidAmount"] as const;
  let values: Record<(typeof numericFields)[number], number | null>;
  try { values = Object.fromEntries(numericFields.map((key) => [key, parseOptionalLocalizedNumber(body[key], key)])) as typeof values; }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tutarlar geçersiz." }, { status: 400 }); }
  const totalDebt = values.totalDebt ?? 0;
  const paidAmount = values.paidAmount ?? 0;
  try { assertPaymentAmounts({ totalDebt, paidAmount }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tutarlar geçersiz." }, { status: 400 }); }
  const missingFields = numericFields.filter((key) => values[key] === null);
  const stored = Object.fromEntries(numericFields.map((key) => [key, values[key] ?? 0])) as Record<(typeof numericFields)[number], number>;
  const allowedStatuses = new Set(["planned", "partial", "paid", "overdue"]);
  const paymentStatus = body.paymentStatus ? String(body.paymentStatus) : inferredPaymentStatus({ totalDebt, paidAmount });
  if (!allowedStatuses.has(paymentStatus)) return NextResponse.json({ error: "Ödeme durumu geçersiz." }, { status: 400 });
  if ((paymentStatus === "paid" && totalDebt > 0 && paidAmount < totalDebt) || (paymentStatus === "partial" && (paidAmount <= 0 || paidAmount >= totalDebt))) {
    return NextResponse.json({ error: "Ödeme durumu ile ödenen tutar birbiriyle uyuşmuyor." }, { status: 400 });
  }
  await getDb().prepare(`UPDATE payment_records SET
    period = ?, owner_name = ?, bank_name = ?, account_name = ?, total_limit = ?, total_debt = ?, restructuring = ?,
    monthly_payment = ?, next_installment = ?, overdraft_debt = ?, overdraft_limit = ?, interest_rate = ?, interest_debt = ?, minimum_payment = ?,
    paid_amount = ?, payment_status = ?, paid_at = ?, missing_fields = ?, due_date = ?, important_note = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ? AND organization_id = ?`)
    .bind(
      String(body.period), String(body.ownerName), String(body.bankName), String(body.accountName),
      stored.totalLimit, stored.totalDebt, stored.restructuring, stored.monthlyPayment,
      stored.nextInstallment, stored.overdraftDebt, stored.overdraftLimit, stored.interestRate, stored.interestDebt, stored.minimumPayment,
      stored.paidAmount, paymentStatus, body.paidAt ? String(body.paidAt) : null, JSON.stringify(missingFields),
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
