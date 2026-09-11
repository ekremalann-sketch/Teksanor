import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb, refreshOrganizationPeriodSummary } from "@/lib/db";
import { canManageOrganization, requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";
import { assertPaymentAmounts, inferredPaymentStatus, parseOptionalLocalizedNumber } from "@/lib/finance";
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
  let values: Record<(typeof numericFields)[number], number | null>;
  try { values = Object.fromEntries(numericFields.map((field) => [field, parseOptionalLocalizedNumber(body[field], field)])) as typeof values; }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tutarlar geçersiz." }, { status: 400 }); }
  const totalDebt = values.totalDebt ?? 0;
  const paidAmount = values.paidAmount ?? 0;
  const missingFields = numericFields.filter((field) => values[field] === null);
  const stored = Object.fromEntries(numericFields.map((field) => [field, values[field] ?? 0])) as Record<(typeof numericFields)[number], number>;
  try { assertPaymentAmounts({ totalDebt, paidAmount }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tutarlar geçersiz." }, { status: 400 }); }
  const allowedStatuses = new Set(["planned", "partial", "paid", "overdue"]);
  const requestedStatus = body.paymentStatus ? String(body.paymentStatus) : inferredPaymentStatus({ totalDebt, paidAmount });
  if (!allowedStatuses.has(requestedStatus)) return NextResponse.json({ error: "Ödeme durumu geçersiz." }, { status: 400 });
  if ((requestedStatus === "paid" && totalDebt > 0 && paidAmount < totalDebt) || (requestedStatus === "partial" && (paidAmount <= 0 || paidAmount >= totalDebt))) {
    return NextResponse.json({ error: "Ödeme durumu ile ödenen tutar birbiriyle uyuşmuyor." }, { status: 400 });
  }
  const workflow = canManageOrganization(user, context.organization) ? "approved" : "submitted";
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
        due_date = ?, important_note = ?, paid_amount = ?, payment_status = ?, paid_at = ?, missing_fields = ?,
        workflow_status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ?`)
        .bind(
          stored.totalLimit, stored.totalDebt, stored.restructuring, stored.monthlyPayment, stored.nextInstallment,
          stored.overdraftDebt, stored.overdraftLimit, stored.interestRate, stored.interestDebt, stored.minimumPayment,
          body.dueDate ? String(body.dueDate) : null, body.importantNote ? String(body.importantNote) : null,
          stored.paidAmount,
          requestedStatus,
          body.paidAt ? String(body.paidAt) : null, JSON.stringify(missingFields), workflow, user.id, existing.id, context.organization.id,
        ).run();
      await refreshOrganizationPeriodSummary(context.organization.id, String(body.period));
      await addAudit(user.id, "update", "payment_record", existing.id, `${body.bankName} aktarım kaydı güncellendi.`, context.organization.id);
      return NextResponse.json({ id: existing.id, workflowStatus: workflow, updated: true });
    }
  }
  const id = createId("pay");
  await getDb().prepare(`INSERT INTO payment_records
    (id, period, owner_name, bank_name, account_name, total_limit, total_debt, restructuring, monthly_payment,
     next_installment, overdraft_debt, overdraft_limit, interest_rate, interest_debt, minimum_payment, due_date,
     important_note, workflow_status, created_by, updated_by, organization_id, paid_amount, payment_status, paid_at, missing_fields)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      id, String(body.period), String(body.ownerName), String(body.bankName), String(body.accountName),
      stored.totalLimit, stored.totalDebt, stored.restructuring, stored.monthlyPayment, stored.nextInstallment,
      stored.overdraftDebt, stored.overdraftLimit, stored.interestRate, stored.interestDebt, stored.minimumPayment,
      body.dueDate ? String(body.dueDate) : null, body.importantNote ? String(body.importantNote) : null,
      workflow, user.id, user.id, context.organization.id, stored.paidAmount,
      requestedStatus,
      body.paidAt ? String(body.paidAt) : null, JSON.stringify(missingFields),
    ).run();
  await refreshOrganizationPeriodSummary(context.organization.id, String(body.period));
  await addAudit(user.id, "create", "payment_record", id, `${body.bankName} kaydı eklendi.`, context.organization.id);
  return NextResponse.json({ id, workflowStatus: workflow }, { status: 201 });
}
