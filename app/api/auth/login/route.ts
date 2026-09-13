import { NextResponse } from "next/server";
import { getDb, ensureSchema } from "@/lib/db";
import { createSession, sessionCookie } from "@/lib/auth";
import { verifyPassword } from "@/lib/passwords";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  try {
    await ensureSchema();
    const body = await request.json() as Record<string, unknown>;
    const email = text(body.email).toLowerCase();
    const password = text(body.password, 300);
    if (!email || !password) return NextResponse.json({ error: "E-posta ve parola gereklidir." }, { status: 400 });
    const user = await getDb().prepare("SELECT id, password_hash, password_salt, status FROM users WHERE email = ?")
      .bind(email).first<{ id: string; password_hash: string; password_salt: string; status: string }>();
    if (!user) return NextResponse.json({ error: "E-posta veya parola hatalı." }, { status: 401 });
    const ok = await verifyPassword(password, user.password_salt, user.password_hash);
    if (!ok) return NextResponse.json({ error: "E-posta veya parola hatalı." }, { status: 401 });
    if (user.status !== "active") return NextResponse.json({ error: "Hesap etkin değil." }, { status: 403 });
    const sessionId = await createSession(user.id, request);
    const response = NextResponse.json({ ok: true });
    response.headers.set("Set-Cookie", sessionCookie(sessionId));
    return response;
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Giriş yapılamadı." }, { status: 400 });
  }
}
