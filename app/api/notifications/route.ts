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
      "SELECT * FROM notifications WHERE organization_id = ? AND (user_id IS NULL OR user_id = ?) ORDER BY created_at DESC LIMIT 50")
      .bind(context.organization.id, user.id).all();
    return NextResponse.json({ notifications: rows.results });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bildirimler alınamadı." }, { status: 403 });
  }
}
