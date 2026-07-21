import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb, refreshOrganizationPeriodSummary } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

const numericFields = [
  "totalLimit", "totalDebt", "restructuring", "monthlyPayment", "nextInstallment",
  "overdraftDebt", "overdraftLimit", "interestRate", "interestDebt", "minimumPayment",
] as const;

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  const body = (await request.json()) as Record<string, unknown>;
  if (!body.period || !body.ownerName || !body.bankName || !body.accountName) {
    return NextResponse.json({ error: "Dönem, kişi, banka ve hesap adı gereklidir." }, { status: 400 });
  }
  const values = Object.fromEntries(numericFields.map((field) => [field, Number(body[field] ?? 0) || 0]));
  const id = createId("pay");
  const workflow = "approved";
  await getDb().prepare(`INSERT INTO payment_records
    (id, period, owner_name, bank_name, account_name, total_limit, total_debt, restructuring, monthly_payment,
     next_installment, overdraft_debt, overdraft_limit, interest_rate, interest_debt, minimum_payment, due_date,
     important_note, workflow_status, created_by, updated_by, organization_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(
      id, String(body.period), String(body.ownerName), String(body.bankName), String(body.accountName),
      values.totalLimit, values.totalDebt, values.restructuring, values.monthlyPayment, values.nextInstallment,
      values.overdraftDebt, values.overdraftLimit, values.interestRate, values.interestDebt, values.minimumPayment,
      body.dueDate ? String(body.dueDate) : null, body.importantNote ? String(body.importantNote) : null,
      workflow, user.id, user.id, context.organization.id,
    ).run();
  await refreshOrganizationPeriodSummary(context.organization.id, String(body.period));
  await addAudit(user.id, "create", "payment_record", id, `${body.bankName} kaydı eklendi.`, context.organization.id);
  return NextResponse.json({ id, workflowStatus: workflow }, { status: 201 });
}
