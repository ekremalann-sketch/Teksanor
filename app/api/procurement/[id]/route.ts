import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
const STATUS = ["draft", "pending", "approved", "ordered", "delivered", "cancelled"];
const PRIORITY = ["low", "normal", "high", "critical"];

export async function PUT(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    const body = await request.json() as Record<string, unknown>;
    const existing = await getDb().prepare("SELECT * FROM procurement_requests WHERE id = ? AND organization_id = ?")
      .bind(id, context.organization.id).first<Record<string, unknown>>();
    if (!existing) return NextResponse.json({ error: "Satın alma talebi bulunamadı." }, { status: 404 });
    const status = STATUS.includes(text(body.status)) ? text(body.status) : String(existing.status);
    const priority = PRIORITY.includes(text(body.priority)) ? text(body.priority) : String(existing.priority);
    const quantity = Number(body.quantity ?? existing.quantity ?? 1);
    const unitPrice = Number(body.unitPrice ?? existing.unit_price ?? 0);
    const totalPrice = quantity * unitPrice;
    const orderDate = status === "ordered" && !existing.order_date ? new Date().toISOString().slice(0, 10) : (existing.order_date ?? null);
    const deliveryDate = status === "delivered" && !existing.delivery_date ? new Date().toISOString().slice(0, 10) : (existing.delivery_date ?? null);
    await getDb().prepare(`UPDATE procurement_requests SET title = ?, description = ?, department = ?, supplier_name = ?,
      quantity = ?, unit = ?, unit_price = ?, total_price = ?, currency = ?, status = ?, priority = ?, required_date = ?,
      order_date = ?, delivery_date = ?, notes = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND organization_id = ?`)
      .bind(text(body.title) || String(existing.title), text(body.description, 1200) ?? existing.description,
        text(body.department) || String(existing.department),
        body.supplierName !== undefined ? text(body.supplierName) || null : existing.supplier_name,
        quantity, text(body.unit, 20) || String(existing.unit ?? "adet"), unitPrice, totalPrice,
        text(body.currency, 8) || String(existing.currency ?? "TRY"), status, priority,
        body.requiredDate !== undefined ? text(body.requiredDate, 20) || null : existing.required_date,
        orderDate, deliveryDate,
        body.notes !== undefined ? text(body.notes, 1200) || null : existing.notes, id, context.organization.id).run();
    await addAudit(user.id, "update", "procurement_request", id, `${existing.request_number} talebi güncellendi (${status}).`, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Satın alma talebi güncellenemedi." }, { status: 400 });
  }
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    await getDb().prepare("DELETE FROM procurement_requests WHERE id = ? AND organization_id = ?").bind(id, context.organization.id).run();
    await addAudit(user.id, "delete", "procurement_request", id, undefined, context.organization.id);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Satın alma talebi silinemedi." }, { status: 400 });
  }
}
