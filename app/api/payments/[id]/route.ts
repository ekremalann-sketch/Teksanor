import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, addAudit, refreshOrganizationPeriodSummary } from "@/lib/db";
import { requireOrganization, canManageOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await ctx.params;
    const row = await getDb().prepare("SELECT * FROM payment_records WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first();
    if (!row) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    return NextResponse.json({ record: row });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kayıt alınamadı." }, { status: 403 });
  }
}

// Yönetici onayı / durum güncelleme
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    if (!canManageOrganization(user, context.organization)) return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    const { id } = await ctx.params;
    const existing = await getDb().prepare("SELECT period FROM payment_records WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first<{ period: string }>();
    if (!existing) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const workflow = ["submitted", "approved", "rejected"].includes(String(body.workflowStatus)) ? String(body.workflowStatus) : "approved";
    await getDb().prepare("UPDATE payment_records SET workflow_status = ?, updated_by = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?")
      .bind(workflow, user.id, id, context.organization.id).run();
    await refreshOrganizationPeriodSummary(context.organization.id, existing.period);
    await addAudit(user.id, "update", "payment_record", id, `Ödeme kaydı ${workflow} durumuna alındı.`, context.organization.id);
    return NextResponse.json({ ok: true, workflowStatus: workflow });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kayıt güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    if (!canManageOrganization(user, context.organization)) return NextResponse.json({ error: "Bu işlem için yetkiniz yok." }, { status: 403 });
    const { id } = await ctx.params;
    const existing = await getDb().prepare("SELECT period FROM payment_records WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first<{ period: string }>();
    await getDb().prepare("DELETE FROM payment_records WHERE id = ? AND organization_id = ?").bind(id, context.organization.id).run();
    if (existing) await refreshOrganizationPeriodSummary(context.organization.id, existing.period);
    await addAudit(user.id, "delete", "payment_record", id, undefined, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kayıt silinemedi." }, { status: 400 });
  }
}
