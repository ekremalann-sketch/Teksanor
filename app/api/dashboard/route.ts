import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";

async function count(sql: string, orgId: string): Promise<number> {
  const row = await getDb().prepare(sql).bind(orgId).first<{ c: number }>();
  return row?.c ?? 0;
}

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const orgId = context.organization.id;

    const memberships = await getDb().prepare(
      `SELECT o.id AS id, o.name AS name, m.role AS role
       FROM organization_members m JOIN organizations o ON o.id = m.organization_id
       WHERE m.user_id = ? ORDER BY o.name`).bind(user.id).all();

    const [openWorkOrders, activeAssets, duePlans, customers, employees, openTasks] = await Promise.all([
      count("SELECT COUNT(*) AS c FROM work_orders WHERE organization_id = ? AND status IN ('open','assigned','in_progress')", orgId),
      count("SELECT COUNT(*) AS c FROM assets WHERE organization_id = ? AND status = 'active'", orgId),
      count("SELECT COUNT(*) AS c FROM maintenance_plans WHERE organization_id = ? AND status = 'active'", orgId),
      count("SELECT COUNT(*) AS c FROM customers WHERE organization_id = ?", orgId),
      count("SELECT COUNT(*) AS c FROM employees WHERE organization_id = ?", orgId),
      count("SELECT COUNT(*) AS c FROM tasks WHERE organization_id = ? AND status != 'done'", orgId),
    ]);

    return NextResponse.json({
      user: { full_name: user.full_name, email: user.email },
      organization: { id: orgId, name: context.organization.name, role: context.role },
      organizations: memberships.results,
      stats: [
        { label: "Açık iş emri", value: openWorkOrders },
        { label: "Aktif varlık", value: activeAssets },
        { label: "Bakım planı", value: duePlans },
        { label: "Müşteri", value: customers },
        { label: "Çalışan", value: employees },
        { label: "Açık görev", value: openTasks },
      ],
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Panel verisi alınamadı." }, { status: 403 });
  }
}
