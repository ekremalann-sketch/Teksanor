import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
const STATUS = ["lead", "prospect", "active", "inactive"];

export async function GET(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    const customer = await getDb().prepare("SELECT * FROM customers WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first();
    if (!customer) return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
    const interactions = await getDb().prepare(
      "SELECT * FROM customer_interactions WHERE customer_id = ? AND organization_id = ? ORDER BY interaction_date DESC, created_at DESC")
      .bind(id, context.organization.id).all();
    return NextResponse.json({ customer, interactions: interactions.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Müşteri alınamadı." }, { status: 403 });
  }
}

export async function PUT(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    const body = await request.json() as Record<string, unknown>;
    const existing = await getDb().prepare("SELECT * FROM customers WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first<Record<string, unknown>>();
    if (!existing) return NextResponse.json({ error: "Müşteri bulunamadı." }, { status: 404 });
    const status = STATUS.includes(text(body.status)) ? text(body.status) : String(existing.status);
    await getDb().prepare(`UPDATE customers SET name = ?, company_name = ?, email = ?, phone = ?, address = ?, sector = ?,
      status = ?, total_value = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`)
      .bind(text(body.name) || String(existing.name),
        body.companyName !== undefined ? text(body.companyName) || null : existing.company_name,
        body.email !== undefined ? text(body.email) || null : existing.email,
        body.phone !== undefined ? text(body.phone) || null : existing.phone,
        body.address !== undefined ? text(body.address, 400) || null : existing.address,
        body.sector !== undefined ? text(body.sector) || null : existing.sector,
        status, Number(body.totalValue ?? existing.total_value ?? 0),
        body.notes !== undefined ? text(body.notes, 1200) || null : existing.notes, id, context.organization.id).run();
    await addAudit(user.id, "update", "customer", id, `${existing.name} müşterisi güncellendi.`, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Müşteri güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    await getDb().prepare("DELETE FROM customers WHERE id = ? AND organization_id = ?").bind(id, context.organization.id).run();
    await addAudit(user.id, "delete", "customer", id, undefined, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Müşteri silinemedi." }, { status: 400 });
  }
}
