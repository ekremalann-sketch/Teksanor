import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { parseLocalizedNumber } from "@/lib/finance";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
const STATUS = ["draft", "pending", "approved", "ordered", "delivered", "cancelled"];
const PRIORITY = ["low", "normal", "high", "critical"];

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const result = await getDb().prepare(
      `SELECT * FROM procurement_requests WHERE organization_id = ?
       ORDER BY CASE status WHEN 'pending' THEN 1 WHEN 'approved' THEN 2 WHEN 'ordered' THEN 3 WHEN 'draft' THEN 4 WHEN 'delivered' THEN 5 ELSE 6 END, created_at DESC`)
      .bind(context.organization.id).all();
    return NextResponse.json({ procurement: result.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Satın alma talepleri alınamadı." }, { status: 403 });
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
    if (!title || !department) return NextResponse.json({ error: "Talep başlığı ve departman gereklidir." }, { status: 400 });
    const status = STATUS.includes(text(body.status)) ? text(body.status) : "pending";
    const priority = PRIORITY.includes(text(body.priority)) ? text(body.priority) : "normal";
    const quantity = Math.max(0, parseLocalizedNumber(body.quantity || 1));
    const unitPrice = Math.max(0, parseLocalizedNumber(body.unitPrice || 0));
    const totalPrice = quantity * unitPrice;
    const count = await getDb().prepare("SELECT COUNT(*) AS c FROM procurement_requests WHERE organization_id = ?").bind(context.organization.id).first<{ c: number }>();
    const requestNumber = `SA-${String((count?.c ?? 0) + 1).padStart(4, "0")}`;
    const id = createId("proc");
    await getDb().prepare(`INSERT INTO procurement_requests
      (id, organization_id, request_number, title, description, department, requested_by, supplier_name, quantity, unit, unit_price, total_price, currency, status, priority, required_date, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, context.organization.id, requestNumber, title, text(body.description, 1200) || null, department,
        text(body.requestedBy) || user.full_name, text(body.supplierName) || null, quantity, text(body.unit, 20) || "adet",
        unitPrice, totalPrice, text(body.currency, 8) || "TRY", status, priority, text(body.requiredDate, 20) || null,
        text(body.notes, 1200) || null, user.id).run();
    await addAudit(user.id, "create", "procurement_request", id, `${requestNumber} satın alma talebi oluşturuldu.`, context.organization.id);
    return NextResponse.json({ ok: true, id, requestNumber });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Satın alma talebi oluşturulamadı." }, { status: 400 });
  }
}
