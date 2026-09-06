import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { addAudit, createId, getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }
const STATUS = ["lead", "prospect", "active", "inactive"];

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const result = await getDb().prepare(
      `SELECT * FROM customers WHERE organization_id = ?
       ORDER BY CASE status WHEN 'active' THEN 1 WHEN 'prospect' THEN 2 WHEN 'lead' THEN 3 ELSE 4 END, created_at DESC`)
      .bind(context.organization.id).all();
    return NextResponse.json({ customers: result.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Müşteriler alınamadı." }, { status: 403 });
  }
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const body = await request.json() as Record<string, unknown>;
    const name = text(body.name);
    if (!name) return NextResponse.json({ error: "Müşteri adı gereklidir." }, { status: 400 });
    const status = STATUS.includes(text(body.status)) ? text(body.status) : "lead";
    const id = createId("cust");
    await getDb().prepare(`INSERT INTO customers
      (id, organization_id, name, company_name, email, phone, address, sector, status, total_value, notes, created_by)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, context.organization.id, name, text(body.companyName) || null, text(body.email) || null, text(body.phone) || null,
        text(body.address, 400) || null, text(body.sector) || null, status, Math.max(0, Number(body.totalValue || 0)),
        text(body.notes, 1200) || null, user.id).run();
    await addAudit(user.id, "create", "customer", id, `${name} müşterisi eklendi.`, context.organization.id);
    return NextResponse.json({ ok: true, id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Müşteri eklenemedi." }, { status: 400 });
  }
}
