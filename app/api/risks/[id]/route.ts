import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
const CATEGORY = ["financial", "operational", "legal", "technical", "hr", "other"];
const LIKELIHOOD = ["low", "medium", "high"];
const IMPACT = ["low", "medium", "high", "critical"];
const STATUS = ["identified", "mitigating", "resolved", "accepted"];

export async function PUT(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    const body = await request.json() as Record<string, unknown>;
    const existing = await getDb().prepare("SELECT * FROM risks WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first<Record<string, unknown>>();
    if (!existing) return NextResponse.json({ error: "Risk bulunamadı." }, { status: 404 });
    const category = CATEGORY.includes(text(body.category)) ? text(body.category) : String(existing.category);
    const likelihood = LIKELIHOOD.includes(text(body.likelihood)) ? text(body.likelihood) : String(existing.likelihood);
    const impact = IMPACT.includes(text(body.impact)) ? text(body.impact) : String(existing.impact);
    const status = STATUS.includes(text(body.status)) ? text(body.status) : String(existing.status);
    await getDb().prepare(`UPDATE risks SET title = ?, description = ?, department = ?, category = ?, likelihood = ?, impact = ?,
      status = ?, owner_name = ?, mitigation_plan = ?, review_date = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`)
      .bind(text(body.title) || String(existing.title), text(body.description, 1200) ?? existing.description,
        text(body.department) || String(existing.department), category, likelihood, impact, status,
        body.ownerName !== undefined ? text(body.ownerName) || null : existing.owner_name,
        body.mitigationPlan !== undefined ? text(body.mitigationPlan, 1200) || null : existing.mitigation_plan,
        body.reviewDate !== undefined ? text(body.reviewDate, 20) || null : existing.review_date, id, context.organization.id).run();
    await addAudit(user.id, "update", "risk", id, `${existing.title} riski güncellendi (${status}).`, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Risk güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    await getDb().prepare("DELETE FROM risks WHERE id = ? AND organization_id = ?").bind(id, context.organization.id).run();
    await addAudit(user.id, "delete", "risk", id, undefined, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Risk silinemedi." }, { status: 400 });
  }
}
