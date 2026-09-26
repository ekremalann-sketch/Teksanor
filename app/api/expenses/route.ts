import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb, refreshOrganizationPeriodSummary } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";
import { parseRequiredPositiveAmount } from "@/lib/finance";
import { requireModuleAccess } from "@/lib/access";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  try { await requireModuleAccess(user, context.organization, "expenses", "edit"); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Yetki reddedildi." }, { status: 403 }); }
  const body = (await request.json()) as { period?: string; ownerName?: string; category?: string; description?: string; amount?: unknown; dueDate?: string };
  if (!body.period || !body.ownerName || !body.category || !body.description) {
    return NextResponse.json({ error: "Dönem, kişi, kategori ve açıklama gereklidir." }, { status: 400 });
  }
  let amount: number;
  // "abc", negatif veya boş tutar sessizce 0 sayılmaz; dönem özetini bozmadan reddedilir.
  try { amount = parseRequiredPositiveAmount(body.amount, "Gider tutarı"); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Gider tutarı geçersiz." }, { status: 400 }); }
  const id = createId("expense");
  const workflow = "approved";
  // Aynı kullanıcının 60 sn içindeki birebir aynı gideri tek SQL adımında engellenir.
  const inserted = await getDb().prepare(`INSERT INTO expenses
    (id, period, owner_name, category, description, amount, due_date, workflow_status, created_by, organization_id)
    SELECT ?, ?, ?, ?, ?, ?, ?, ?, ?, ?
    WHERE NOT EXISTS (SELECT 1 FROM expenses WHERE organization_id = ? AND period = ? AND owner_name = ? AND category = ?
      AND description = ? AND amount = ? AND created_by = ? AND created_at > datetime('now', '-60 seconds'))`)
    .bind(id, body.period, body.ownerName, body.category, body.description, amount, body.dueDate || null, workflow, user.id, context.organization.id,
      context.organization.id, body.period, body.ownerName, body.category, body.description, amount, user.id)
    .run();
  if (!inserted.meta?.changes) return NextResponse.json({ workflowStatus: workflow, duplicate: true });
  await refreshOrganizationPeriodSummary(context.organization.id, body.period);
  await addAudit(user.id, "create", "expense", id, `${body.description} gideri eklendi.`, context.organization.id);
  return NextResponse.json({ id, workflowStatus: workflow }, { status: 201 });
}
