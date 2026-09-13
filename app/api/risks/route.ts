import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
const CATEGORY = ["financial", "operational", "legal", "technical", "hr", "other"];
const LIKELIHOOD = ["low", "medium", "high"];
const IMPACT = ["low", "medium", "high", "critical"];
const STATUS = ["identified", "mitigating", "resolved", "accepted"];

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const result = await getDb().prepare(
      `SELECT * FROM risks WHERE organization_id = ?
       ORDER BY CASE status WHEN 'identified' THEN 1 WHEN 'mitigating' THEN 2 WHEN 'accepted' THEN 3 ELSE 4 END, created_at DESC`)
      .bind(context.organization.id).all();
    return NextResponse.json({ risks: result.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Riskler alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const body = await request.json() as Record<string, unknown>;
    const title = text(body.title);
    const department = text(body.department);
    if (!title || !department) return NextResponse.json({ error: "Risk başlığı ve departman gereklidir." }, { status: 400 });
    const category = CATEGORY.includes(text(body.category)) ? text(body.category) : "other";
    const likelihood = LIKELIHOOD.includes(text(body.likelihood)) ? text(body.likelihood) : "medium";
    const impact = IMPACT.includes(text(body.impact)) ? text(body.impact) : "medium";
    const status = STATUS.includes(text(body.status)) ? text(body.status) : "identified";
    const id = createId("risk");
    await getDb().prepare(`INSERT INTO risks
      (id, organization_id, title, description, department, category, likelihood, impact, status, owner_name, mitigation_plan, review_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, context.organization.id, title, text(body.description, 1200) || null, department, category, likelihood, impact,
        status, text(body.ownerName) || null, text(body.mitigationPlan, 1200) || null, text(body.reviewDate, 20) || null, user.id).run();
    await addAudit(user.id, "create", "risk", id, `${title} riski kaydedildi.`, context.organization.id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Risk kaydedilemedi." }, { status: 400 });
  }
}
