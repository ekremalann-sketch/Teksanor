import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requireOrganization, canManageOrganization } from "@/lib/tenancy";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const org = await getDb().prepare("SELECT id, name, slug, sector, created_at FROM organizations WHERE id = ?")
      .bind(context.organization.id).first();
    const members = await getDb().prepare(
      `SELECT u.id AS user_id, u.full_name, u.email, m.role
       FROM organization_members m JOIN users u ON u.id = m.user_id
       WHERE m.organization_id = ? ORDER BY m.role, u.full_name`).bind(context.organization.id).all();
    return NextResponse.json({ organization: org, role: context.role, canManage: canManageOrganization(user, context.organization), members: members.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Çalışma alanı alınamadı." }, { status: 403 });
  }
}
