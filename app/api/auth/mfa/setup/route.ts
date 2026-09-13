import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, addAudit } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    await getDb().prepare("UPDATE users SET mfa_enabled = 1, updated_at = CURRENT_TIMESTAMP WHERE id = ?").bind(user.id).run();
    await addAudit(user.id, "update", "user", user.id, "İki adımlı doğrulama etkinleştirildi.");
    return NextResponse.json({ ok: true, mfa_enabled: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "İki adımlı doğrulama açılamadı." }, { status: 400 });
  }
}
