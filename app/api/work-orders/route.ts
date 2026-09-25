import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";
import { getMemberAccess, errorStatus } from "@/lib/access";

const SERVICE_MANAGERS = ["owner", "company_admin", "ceo", "manager"];

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
const TYPE = ["maintenance", "repair", "installation", "inspection", "other"];
const STATUS = ["open", "assigned", "in_progress", "completed", "cancelled"];
const PRIORITY = ["low", "normal", "high", "critical"];

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    // Servis işine bağlı iş emirleri /api/service/jobs ile aynı kuralı izler:
    // yönetici olmayan rol yalnız kendisine atanmış servis işini görür.
    const access = await getMemberAccess(user, context.organization);
    const manage = SERVICE_MANAGERS.includes(access.profile);
    const result = await getDb().prepare(
      `SELECT w.* FROM work_orders w
       LEFT JOIN service_jobs s ON s.id = w.id AND s.organization_id = w.organization_id
       WHERE w.organization_id = ? AND (? = 1 OR s.id IS NULL OR s.assigned_user_id = ?)
       ORDER BY CASE w.status WHEN 'in_progress' THEN 1 WHEN 'assigned' THEN 2 WHEN 'open' THEN 3 WHEN 'completed' THEN 4 ELSE 5 END, w.created_at DESC`)
      .bind(context.organization.id, manage ? 1 : 0, user.id).all();
    return NextResponse.json({ workOrders: result.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "İş emirleri alınamadı." }, { status: 403 });
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
    if (!title) return NextResponse.json({ error: "İş emri başlığı gereklidir." }, { status: 400 });
    const orderType = TYPE.includes(text(body.orderType)) ? text(body.orderType) : "other";
    const status = STATUS.includes(text(body.status)) ? text(body.status) : "open";
    const priority = PRIORITY.includes(text(body.priority)) ? text(body.priority) : "normal";
    const count = await getDb().prepare("SELECT COUNT(*) AS c FROM work_orders WHERE organization_id = ?").bind(context.organization.id).first<{ c: number }>();
    const orderNumber = `IE-${crypto.randomUUID().slice(0, 12).toUpperCase()}`;
    const id = createId("wo");
    await getDb().prepare(`INSERT INTO work_orders
      (id, organization_id, order_number, title, description, customer_name, location, department, order_type, status, priority, assigned_to, scheduled_date, estimated_hours, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, context.organization.id, orderNumber, title, text(body.description, 1200) || null, text(body.customerName) || null,
        text(body.location) || null, text(body.department) || "Operasyon yönetimi", orderType, status, priority,
        text(body.assignedTo) || null, text(body.scheduledDate, 20) || null, Math.max(0, Number(body.estimatedHours || 0)),
        text(body.notes, 1200) || null, user.id).run();
    await addAudit(user.id, "create", "work_order", id, `${orderNumber} iş emri oluşturuldu.`, context.organization.id);
    return NextResponse.json({ ok: true, id, orderNumber });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "İş emri oluşturulamadı." }, { status: errorStatus(error) });
  }
}
