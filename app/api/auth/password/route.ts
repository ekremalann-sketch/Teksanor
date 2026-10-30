import { NextResponse } from "next/server";
import { prepareSession, getCurrentUser, hashPassword, sessionCookie, verifyPassword } from "@/lib/auth";
import { auditStatement, getDb } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const body = (await request.json()) as { currentPassword?: string; newPassword?: string };
  if (!body.currentPassword || !body.newPassword || body.newPassword.length < 10 || body.newPassword.length > 128) {
    return NextResponse.json({ error: "Mevcut parola ve en az 10 karakterli yeni parola gereklidir." }, { status: 400 });
  }
  const database = getDb();
  const stored = await database.prepare("SELECT password_hash, password_salt FROM users WHERE id = ?").bind(user.id)
    .first<{ password_hash: string; password_salt: string }>();
  if (!stored || !(await verifyPassword(body.currentPassword, stored.password_salt, stored.password_hash))) {
    return NextResponse.json({ error: "Mevcut parola hatalı." }, { status: 403 });
  }
  const credentials = await hashPassword(body.newPassword);
  const session = await prepareSession(user.id);
  await database.batch([
    database.prepare("UPDATE users SET password_hash = ?, password_salt = ? WHERE id = ?").bind(credentials.hash, credentials.salt, user.id),
    database.prepare("DELETE FROM sessions WHERE user_id = ?").bind(user.id),
    session.statement,
    auditStatement(user.id, "password_change", "user", user.id, "Parola değiştirildi."),
  ]);
  const token = session.token;
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", sessionCookie(token));
  return response;
}
