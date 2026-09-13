import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { requireOrganization } from "@/lib/tenancy";

export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const context = await requireOrganization(request, user);
    const rows = await getDb().prepare(
      `SELECT u.id, u.full_name, u.email, m.role
       FROM organization_members m JOIN users u ON u.id = m.user_id
       WHERE m.organization_id = ? ORDER BY m.role, u.full_name`).bind(context.organization.id).all();
    return NextResponse.json({ users: rows.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Kullanıcılar alınamadı." }, { status: 403 });
  }
}
