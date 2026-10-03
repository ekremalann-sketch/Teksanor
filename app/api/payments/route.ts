import { optionalCalendarDate } from "@/lib/dates";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb, refreshOrganizationPeriodSummary } from "@/lib/db";
import { canManageOrganization, requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";
import { parseOptionalLocalizedNumber, paymentFieldLabels, resolvePaymentStatus } from "@/lib/finance";
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
  try { values = Object.fromEntries(numericFields.map((field) => [field, parseOptionalLocalizedNumber(body[field], paymentFieldLabels[field])])) as typeof values; }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tutarlar geçersiz." }, { status: 400 }); }
  let dueDate: string | null;
  let paidAt: string | null = null;
  try { dueDate = optionalCalendarDate(body.dueDate); paidAt = optionalCalendarDate(body.paidAt); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tarih geçersiz." }, { status: 400 }); }
  const missingFields = numericFields.filter((field) => values[field] === null);
  const stored = Object.fromEntries(numericFields.map((field) => [field, values[field] ?? 0])) as Record<(typeof numericFields)[number], number>;
  let requestedStatus: string;
  try { requestedStatus = resolvePaymentStatus({ totalDebt: values.totalDebt, paidAmount: values.paidAmount, status: body.paymentStatus }); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Tutarlar geçersiz." }, { status: 400 }); }
  const workflow = canManageOrganization(user, context.organization) ? "approved" : "submitted";
  if (body.upsert === true) {
    const existing = await getDb().prepare(`SELECT id, workflow_status FROM payment_records
      WHERE organization_id = ? AND period = ? AND owner_name = ? AND bank_name = ? AND account_name = ?
      ORDER BY updated_at DESC LIMIT 1`)
      .bind(
        context.organization.id, String(body.period), String(body.ownerName),
        String(body.bankName), String(body.accountName),
      ).first<{ id: string; workflow_status: string }>();
    if (existing) {
      if (existing.workflow_status === "approved" && !canManageOrganization(user, context.organization)) return NextResponse.json({ error: "Onaylı ödeme yalnız firma yöneticisi tarafından değiştirilebilir." }, { status: 403 });
      const history = getDb().prepare(`INSERT INTO audit_logs(id,user_id,action,entity_type,entity_id,details,organization_id)
        SELECT ?,?,'payment_snapshot','payment_record',id,json_object('period',period,'totalDebt',total_debt,'paidAmount',paid_amount,'monthlyPayment',monthly_payment,'workflowStatus',workflow_status,'missingFields',missing_fields,'dueDate',due_date),organization_id
        FROM payment_records WHERE id=? AND organization_id=? AND (workflow_status!='approved' OR ?=1)`)
        .bind(createId("audit"),user.id,existing.id,context.organization.id,canManageOrganization(user,context.organization)?1:0);
      const update = getDb().prepare(`UPDATE payment_records SET
        total_limit = ?, total_debt = ?, restructuring = ?, monthly_payment = ?, next_installment = ?,
        overdraft_debt = ?, overdraft_limit = ?, interest_rate = ?, interest_debt = ?, minimum_payment = ?,
        due_date = ?, important_note = ?, paid_amount = ?, payment_status = ?, paid_at = ?, missing_fields = ?,
        workflow_status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP
        WHERE id = ? AND organization_id = ? AND (workflow_status != 'approved' OR ? = 1)`)
        .bind(
          stored.totalLimit, stored.totalDebt, stored.restructuring, stored.monthlyPayment, stored.nextInstallment,
          stored.overdraftDebt, stored.overdraftLimit, stored.interestRate, stored.interestDebt, stored.minimumPayment,
          dueDate, body.importantNote ? String(body.importantNote) : null,
          stored.paidAmount,
          requestedStatus,
          paidAt, JSON.stringify(missingFields), workflow, user.id, existing.id, context.organization.id, canManageOrganization(user,context.organization)?1:0,
        );
      const [, updated] = await getDb().batch([history, update]);
      if (!(updated as { meta?: { changes?: number } }).meta?.changes) return NextResponse.json({ error: "Kayıt başka bir işlemle değişti veya onaylandı; yenileyin." }, { status: 409 });
      await refreshOrganizationPeriodSummary(context.organization.id, String(body.period));
      await addAudit(user.id, "update", "payment_record", existing.id, `${body.bankName} aktarım kaydı güncellendi.`, context.organization.id);
      return NextResponse.json({ id: existing.id, workflowStatus: workflow, updated: true });
    }
  }
  const id = createId("pay");
  // Çift tıklama / yeniden gönderim koruması: aynı kullanıcının 60 sn içindeki birebir
  // aynı kaydı tek SQL adımında engellenir (şema değişikliği gerektirmez).
  const inserted = await getDb().prepare(`INSERT INTO payment_records
    (id, period, owner_name, bank_name, account_name, total_limit, total_debt, restructuring, monthly_payment,
     next_installment, overdraft_debt, overdraft_limit, interest_rate, interest_debt, minimum_payment, due_date,
     important_note, workflow_status, created_by, updated_by, organization_id, paid_amount, payment_status, paid_at, missing_fields)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM payment_records WHERE organization_id = ? AND period = ? AND owner_name = ?
      AND bank_name = ? AND account_name = ? AND total_debt = ? AND paid_amount = ? AND created_by = ?
      AND created_at > datetime('now', '-60 seconds'))`)
    .bind(
      id, String(body.period), String(body.ownerName), String(body.bankName), String(body.accountName),
      stored.totalLimit, stored.totalDebt, stored.restructuring, stored.monthlyPayment, stored.nextInstallment,
      stored.overdraftDebt, stored.overdraftLimit, stored.interestRate, stored.interestDebt, stored.minimumPayment,
      dueDate, body.importantNote ? String(body.importantNote) : null,
      workflow, user.id, user.id, context.organization.id, stored.paidAmount,
      requestedStatus,
      paidAt, JSON.stringify(missingFields),
      context.organization.id, String(body.period), String(body.ownerName), String(body.bankName), String(body.accountName),
      stored.totalDebt, stored.paidAmount, user.id,
    ).run();
  if (!inserted.meta?.changes) {
    const duplicate = await getDb().prepare(`SELECT id, workflow_status FROM payment_records WHERE organization_id = ? AND period = ? AND owner_name = ?
      AND bank_name = ? AND account_name = ? AND created_by = ? ORDER BY created_at DESC LIMIT 1`)
      .bind(context.organization.id, String(body.period), String(body.ownerName), String(body.bankName), String(body.accountName), user.id)
      .first<{ id: string; workflow_status: string }>();
    return NextResponse.json({ id: duplicate?.id, workflowStatus: duplicate?.workflow_status, duplicate: true });
  }
  await refreshOrganizationPeriodSummary(context.organization.id, String(body.period));
  await addAudit(user.id, "create", "payment_record", id, `${body.bankName} kaydı eklendi.`, context.organization.id);
  return NextResponse.json({ id, workflowStatus: workflow }, { status: 201 });
}
