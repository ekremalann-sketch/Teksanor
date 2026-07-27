import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb, refreshOrganizationPeriodSummary } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";
import { assertPaymentAmounts, inferredPaymentStatus, parseLocalizedNumber } from "@/lib/finance";
import { requireModuleAccess } from "@/lib/access";

const numericFields = [
  "totalLimit", "totalDebt", "restructuring", "monthlyPayment", "nextInstallment",
  "overdraftDebt", "overdraftLimit", "interestRate", "interestDebt", "minimumPayment",
  "paidAmount",
] as const;

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  try { await requireModuleAccess(user, context.organization, "payments", "edit"); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Yetki reddedildi." }, { status: 403 }); }
  const body = (await request.json()) as Record<string, unknown>;
  if (!body.period || !body.ownerName || !body.bankName || !body.accountName) {
    return NextResponse.json({ error: "Dönem, kişi, banka ve hesap adı gereklidir." }, { status: 400 });
  }
  const values = Object.fromEntries(numericFields.map((field) => [field, parseLocalizedNumber(body[field])]));
  try { assertPaymentAmounts({ totalDebt: values.totalDebt, paidAmount: values.paidAmount }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tutarlar geçersiz." }, { status: 400 }); }
  if (body.upsert === true) {
    const existing = await getDb().prepare(`SELECT id FROM payment_records
      WHERE organization_id = ? AND period = ? AND owner_name = ? AND bank_name = ? AND account_name = ?
      ORDER BY updated_at DESC LIMIT 1`)
      .bind(
        context.organization.id, String(body.period), String(body.ownerName),
        String(body.bankName), String(body.accountName),
      ).first<{ id: string }>();
    if (existing) {
      await getDb().prepare(`UPDATE payment_records SET
        total_limit = ?, total_debt = ?, restructuring = ?, monthly_payment = ?, next_installment = ?,
        overdraft_debt = ?, overdraft_limit = ?, interest_rate = ?, interest_debt = ?, minimum_payment = ?,
        due_date = ?, important_note = ?, paid_amount = ?, payment_status = ?, paid_at = ?,
        workflow_status = 'approved', updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?`)
        .bind(
          values.totalLimit, values.totalDebt, values.restructuring, values.monthlyPayment, values.nextInstallment,
          values.overdraftDebt, values.overdraftLimit, values.interestRate, values.interestDebt, values.minimumPayment,
          body.dueDate ? String(body.dueDate) : null, body.importantNote ? String(body.importantNote) : null,
          values.paidAmount,
          String(body.paymentStatus || inferredPaymentStatus({ totalDebt: values.totalDebt, paidAmount: values.paidAmount })),
          body.paidAt ? String(body.paidAt) : null, user.id, existing.id, context.organization.id,
        ).run();
      await refreshOrganizationPeriodSummary(context.organization.id, String(body.period));
      await addAudit(user.id, "update", "payment_record", existing.id, `${body.bankName} aktarım kaydı güncellendi.`, context.organization.id);
      return NextResponse.json({ id: existing.id, workflowStatus: "approved", updated: true });
    }
  }
  const id = createId("pay");
  const workflow = "approved";
  await getDb().prepare(`INSERT INTO payment_records
    (id, period, owner_name, bank_name, account_name, total_limit, total_debt, restructuring, monthly_payment,
     next_installment, overdraft_debt, overdraft_limit, interest_rate, interest_debt, minimum_payment, due_date,
     important_note, workflow_status, created_by, updated_by, organization_id, paid_amount, payment_status, paid_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      id, String(body.period), String(body.ownerName), String(body.bankName), String(body.accountName),
      values.totalLimit, values.totalDebt, values.restructuring, values.monthlyPayment, values.nextInstallment,
      values.overdraftDebt, values.overdraftLimit, values.interestRate, values.interestDebt, values.minimumPayment,
      body.dueDate ? String(body.dueDate) : null, body.importantNote ? String(body.importantNote) : null,
      workflow, user.id, user.id, context.organization.id, values.paidAmount,
      String(body.paymentStatus || inferredPaymentStatus({ totalDebt: values.totalDebt, paidAmount: values.paidAmount })),
      body.paidAt ? String(body.paidAt) : null,
    ).run();
  await refreshOrganizationPeriodSummary(context.organization.id, String(body.period));
  await addAudit(user.id, "create", "payment_record", id, `${body.bankName} kaydı eklendi.`, context.organization.id);
  return NextResponse.json({ id, workflowStatus: workflow }, { status: 201 });
}
