import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 400) { return String(value ?? "").trim().slice(0, max); }
const TYPE = ["call", "email", "meeting", "visit", "proposal", "other"];

export async function GET(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    const result = await getDb().prepare(
      "SELECT * FROM customer_interactions WHERE customer_id = ? AND organization_id = ? ORDER BY interaction_date DESC, created_at DESC")
      .bind(id, context.organization.id).all();
    return NextResponse.json({ interactions: result.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Etkileşimler alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    const customer = await getDb().prepare("SELECT id FROM customers WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first();
    if (!customer) return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const summary = text(body.summary, 1200);
    if (!summary) return NextResponse.json({ error: "Etkileşim özeti gereklidir." }, { status: 400 });
    const interactionType = TYPE.includes(text(body.interactionType)) ? text(body.interactionType) : "other";
    const interactionDate = text(body.interactionDate, 20) || new Date().toISOString().slice(0, 10);
    const interactionId = createId("cint");
    await getDb().prepare(`INSERT INTO customer_interactions
      (id, organization_id, customer_id, interaction_type, summary, outcome, interaction_date, next_action, next_action_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(interactionId, context.organization.id, id, interactionType, summary, text(body.outcome, 600) || null,
        interactionDate, text(body.nextAction, 600) || null, text(body.nextActionDate, 20) || null, user.id).run();
    await addAudit(user.id, "create", "customer_interaction", interactionId, `Müşteri etkileşimi kaydedildi.`, context.organization.id);
    return NextResponse.json({ ok: true, id: interactionId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Etkileşim eklenemedi." }, { status: 400 });
  }
}
