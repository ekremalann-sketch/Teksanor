import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb, refreshOrganizationPeriodSummary } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  const body = (await request.json()) as { period?: string; ownerName?: string; category?: string; description?: string; amount?: number; dueDate?: string };
  if (!body.period || !body.ownerName || !body.category || !body.description) {
    return NextResponse.json({ error: "Dönem, kişi, kategori ve açıklama gereklidir." }, { status: 400 });
  }
  const id = createId("expense");
  const workflow = "approved";
  await getDb().prepare(`INSERT INTO expenses
    (id, period, owner_name, category, description, amount, due_date, workflow_status, created_by, organization_id)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, body.period, body.ownerName, body.category, body.description, Number(body.amount ?? 0), body.dueDate || null, workflow, user.id, context.organization.id)
    .run();
  await refreshOrganizationPeriodSummary(context.organization.id, body.period);
  await addAudit(user.id, "create", "expense", id, `${body.description} gideri eklendi.`, context.organization.id);
  return NextResponse.json({ id, workflowStatus: workflow }, { status: 201 });
}
