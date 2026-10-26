import { NextResponse } from "next/server";
import { errorStatus } from "@/lib/access";
import { getCurrentUser } from "@/lib/auth";
import { auditStatement, getDb } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";
import { requireOrganization } from "@/lib/tenancy";

const text = (value: unknown, max = 240) => String(value ?? "").trim().slice(0, max);
const statuses = new Set(["active", "maintenance", "inactive", "retired"]);

export async function PUT(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const { organization } = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    const existing = await getDb().prepare("SELECT * FROM assets WHERE id = ? AND organization_id = ?").bind(id, organization.id).first<Record<string, unknown>>();
    if (!existing) return NextResponse.json({ error: "Varlık bulunamadı." }, { status: 404 });
    const body = await request.json() as Record<string, unknown>;
    const status = statuses.has(text(body.status)) ? text(body.status) : String(existing.status);
    await getDb().batch([
      getDb().prepare(`UPDATE assets SET name=?, category=?, brand=?, model=?, serial_number=?, location=?, status=?,
      responsible_name=?, purchase_date=?, warranty_end=?, notes=?, updated_at=CURRENT_TIMESTAMP
      WHERE id=? AND organization_id=?`)
      .bind(text(body.name) || existing.name, text(body.category) || existing.category, text(body.brand) || null,
        text(body.model) || null, text(body.serialNumber) || null, text(body.location) || null, status,
        text(body.responsibleName) || null, text(body.purchaseDate, 20) || null, text(body.warrantyEnd, 20) || null,
        text(body.notes, 1500) || null, id, organization.id),
      auditStatement(user.id, "update", "asset", id, "Varlık güncellendi.", organization.id),
    ]);
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Varlık güncellenemedi." }, { status: errorStatus(error) });
  }
}

export async function DELETE(request: Request, routeContext: { params: Promise<{ id: string }> }) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const { organization } = await requireOrganization(request, user);
    const { id } = await routeContext.params;
    const results = await getDb().batch([
      getDb().prepare("DELETE FROM assets WHERE id=? AND organization_id=?").bind(id, organization.id),
      auditStatement(user.id, "delete", "asset", id, undefined, organization.id, true),
    ]);
    const removed = results[0] as { meta?: { changes?: number } };
    if (!removed.meta?.changes) return NextResponse.json({ error: "Kayıt bulunamadı." }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: "Varlık silinemedi." }, { status: errorStatus(error) });
  }
}
