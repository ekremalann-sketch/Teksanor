import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";

// Yaklaşan bakım planları ve saha ziyaretlerini hatırlatma olarak listeler.
export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const orgId = context.organization.id;
    const db = getDb();
    const horizon = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);

    const [plans, visits] = await Promise.all([
      db.prepare(
        `SELECT id, title, next_due_date AS due_date, status FROM maintenance_plans
         WHERE organization_id = ? AND status = 'active' AND next_due_date IS NOT NULL AND next_due_date <= ?
         ORDER BY next_due_date ASC LIMIT 50`).bind(orgId, horizon).all(),
      db.prepare(
        `SELECT id, visit_number, customer_name, location, visit_date AS due_date, status FROM field_visits
         WHERE organization_id = ? AND status IN ('planned','scheduled') AND visit_date IS NOT NULL AND visit_date <= ?
         ORDER BY visit_date ASC LIMIT 50`).bind(orgId, horizon).all(),
    ]);

    const reminders = [
      ...(plans.results as Record<string, unknown>[]).map((p) => ({
        type: "maintenance" as const, id: p.id, title: p.title, due_date: p.due_date, status: p.status,
      })),
      ...(visits.results as Record<string, unknown>[]).map((v) => ({
        type: "field_visit" as const, id: v.id, title: `${v.visit_number} · ${v.customer_name || v.location}`,
        due_date: v.due_date, status: v.status,
      })),
    ].sort((a, b) => String(a.due_date).localeCompare(String(b.due_date)));

    return NextResponse.json({ reminders });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Hatırlatmalar alınamadı." }, { status: 403 });
  }
}
