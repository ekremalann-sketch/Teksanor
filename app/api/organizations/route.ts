import { NextResponse } from "next/server";
import { mfaKeyConfigured } from "@/lib/mfa";
import { getCurrentUser } from "@/lib/auth";
import { getDb } from "@/lib/db";

// Platform yöneticisi için firma listesi ("firma gözünden gör" seçimi). Yalnız ad, tür ve özet sayılar döner.
export async function GET(request: Request) {
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  if (user.role !== "admin") return NextResponse.json({ error: "Platform yöneticisi gerekli." }, { status: 403 });

  const rows = await getDb().prepare(`SELECT o.id, o.name, o.kind, o.subscription_status, o.created_at,
      (SELECT COUNT(*) FROM organization_members m WHERE m.organization_id = o.id AND m.active = 1) AS members
    FROM organizations o WHERE o.active = 1 ORDER BY o.created_at DESC LIMIT 200`).all();
  return NextResponse.json({ organizations: rows.results }, { headers: { "cache-control": "no-store" } });
}
