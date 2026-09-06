import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
const TYPE = ["inspection", "installation", "maintenance", "support", "audit", "other"];
const STATUS = ["planned", "completed", "cancelled"];

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const result = await getDb().prepare(
      "SELECT * FROM field_visits WHERE organization_id = ? ORDER BY visit_date DESC, created_at DESC")
      .bind(context.organization.id).all();
    return NextResponse.json({ fieldVisits: result.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Saha ziyaretleri alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const body = await request.json() as Record<string, unknown>;
    const visitorName = text(body.visitorName);
    const location = text(body.location);
    const visitDate = text(body.visitDate, 20);
    if (!visitorName || !location || !visitDate) return NextResponse.json({ error: "Ziyaretçi, konum ve tarih gereklidir." }, { status: 400 });
    const visitType = TYPE.includes(text(body.visitType)) ? text(body.visitType) : "other";
    const status = STATUS.includes(text(body.status)) ? text(body.status) : "planned";
    const count = await getDb().prepare("SELECT COUNT(*) AS c FROM field_visits WHERE organization_id = ?").bind(context.organization.id).first<{ c: number }>();
    const visitNumber = `SZ-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
    if(body.workOrderId && !await getDb().prepare("SELECT id FROM work_orders WHERE id=? AND organization_id=?").bind(text(body.workOrderId),context.organization.id).first()) return NextResponse.json({error:"İş emri bu firmaya ait değil."},{status:404});
    const id = createId("fv");
    await getDb().prepare(`INSERT INTO field_visits
      (id, organization_id, visit_number, work_order_id, visitor_name, customer_name, location, visit_date, visit_type, status, duration_hours, findings, actions_taken, next_visit_date, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, context.organization.id, visitNumber, text(body.workOrderId) || null, visitorName, text(body.customerName) || null,
        location, visitDate, visitType, status, Math.max(0, Number(body.durationHours || 0)), text(body.findings, 1200) || null,
        text(body.actionsTaken, 1200) || null, text(body.nextVisitDate, 20) || null, user.id).run();
    await addAudit(user.id, "create", "field_visit", id, `${visitNumber} saha ziyareti oluşturuldu.`, context.organization.id);
    return NextResponse.json({ ok: true, id, visitNumber });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Saha ziyareti oluşturulamadı." }, { status: 400 });
  }
}
