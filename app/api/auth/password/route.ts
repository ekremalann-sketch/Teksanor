import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { getDb, addAudit } from "@/lib/db";
import { hashPassword, verifyPassword, randomSalt } from "@/lib/passwords";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 300) { return String(value ?? "").trim().slice(0, max); }

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  try {
    const body = await request.json() as Record<string, unknown>;
    const current = text(body.current_password);
    const next = text(body.new_password);
    if (!current || !next) return NextResponse.json({ error: "Mevcut ve yeni parola gereklidir." }, { status: 400 });
    if (next.length < 6) return NextResponse.json({ error: "Yeni parola en az 6 karakter olmalıdır." }, { status: 400 });
    const record = await getDb().prepare("SELECT password_hash, password_salt FROM users WHERE id = ?")
      .bind(user.id).first<{ password_hash: string; password_salt: string }>();
    if (!record) return NextResponse.json({ error: "Kullanıcı bulunamadı." }, { status: 404 });
    const ok = await verifyPassword(current, record.password_salt, record.password_hash);
    if (!ok) return NextResponse.json({ error: "Mevcut parola hatalı." }, { status: 403 });
    const salt = randomSalt();
    const hash = await hashPassword(next, salt);
    await getDb().prepare("UPDATE users SET password_hash = ?, password_salt = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?")
      .bind(hash, salt, user.id).run();
    await addAudit(user.id, "update", "user", user.id, "Parola güncellendi.");
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Parola güncellenemedi." }, { status: 400 });
  }
}
