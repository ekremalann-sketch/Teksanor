import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  let context;
  try { context = await requireOrganization(request, user); }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanına erişim reddedildi." }, { status: 403 }); }
  const organizationId = context.organization.id;
  const database = getDb();
  const [summaries, payments, expenses, pending, activity, profile] = await Promise.all([
    database.prepare("SELECT * FROM organization_period_summaries WHERE organization_id = ? ORDER BY sort_order").bind(organizationId).all(),
    database.prepare("SELECT * FROM payment_records WHERE organization_id = ? ORDER BY owner_name, total_debt DESC").bind(organizationId).all(),
    database.prepare("SELECT * FROM expenses WHERE organization_id = ? ORDER BY created_at DESC LIMIT 30").bind(organizationId).all(),
    database.prepare("SELECT COUNT(*) AS count FROM payment_records WHERE organization_id = ? AND important_note IS NOT NULL AND important_note <> ''").bind(organizationId).first<{ count: number }>(),
    database.prepare(`SELECT a.*, u.full_name FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id
      WHERE a.organization_id = ? ORDER BY a.created_at DESC LIMIT 8`).bind(organizationId).all(),
    database.prepare("SELECT * FROM organization_profiles WHERE organization_id = ?").bind(organizationId).first(),
  ]);
  return NextResponse.json({
    user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role },
    summaries: summaries.results,
    payments: payments.results,
    expenses: expenses.results,
    attentionCount: pending?.count ?? 0,
    activity: activity.results,
    organization: context.organization,
    organizations: context.organizations,
    profile,
  });
}
