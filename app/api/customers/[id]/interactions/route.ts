import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, createId, addAudit } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 1200) { return String(value ?? "").trim().slice(0, max); }

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await ctx.params;
    const rows = await getDb().prepare(
      "SELECT * FROM customer_interactions WHERE customer_id = ? AND organization_id = ? ORDER BY interaction_date DESC, created_at DESC")
      .bind(id, context.organization.id).all();
    return NextResponse.json({ interactions: rows.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Görüşmeler alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await ctx.params;
    const customer = await getDb().prepare("SELECT id FROM customers WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first();
    if (!customer) return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const summary = text(body.summary, 600);
    if (!summary) return NextResponse.json({ error: "Görüşme özeti gereklidir." }, { status: 400 });
    const interactionId = createId("int");
    await getDb().prepare(`INSERT INTO customer_interactions
      (id, organization_id, customer_id, interaction_type, interaction_date, summary, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(interactionId, context.organization.id, id, text(body.interactionType) || "note",
        text(body.interactionDate, 20) || new Date().toISOString().slice(0, 10), summary, text(body.notes) || null, user.id).run();
    await addAudit(user.id, "create", "customer_interaction", interactionId, "Müşteri görüşmesi eklendi.", context.organization.id);
    return NextResponse.json({ ok: true, id: interactionId });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Görüşme eklenemedi." }, { status: 400 });
  }
}
