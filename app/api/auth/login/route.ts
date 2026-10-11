import { NextResponse } from "next/server";
import { auditNewLogin, checkLoginRateLimit, clearLoginFailures, recordSessionPasswordProof, createSession, ensureDefaultAdminAccounts, loginWithUsername, recordLoginFailure, sessionCookie, RATE_LIMIT_MESSAGE } from "@/lib/auth";
import { beginMfaChallenge, mfaChallengeRequired } from "@/lib/mfa";
import { addAudit } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";

const noStore = { "Cache-Control": "private, no-store" };

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  let body: { username?: string; password?: string };
  try { body = (await request.json()) as typeof body; } catch { return NextResponse.json({ error: "İstek okunamadı." }, { status: 400 }); }
  const username = String(body.username ?? "").trim();
  if (!username || !body.password) {
    return NextResponse.json({ error: "Kullanıcı adı ve parola gereklidir." }, { status: 400 });
  }
  // Yalnız başarısız denemeler sayılır: IP başına 60, hesap başına 10 / 15 dk.
  try { await checkLoginRateLimit(request, username); }
  catch { return NextResponse.json({ error: RATE_LIMIT_MESSAGE }, { status: 429, headers: { ...noStore, "Retry-After": "900" } }); }
  try { await ensureDefaultAdminAccounts(); }
  catch { return NextResponse.json({ error: "Giriş sistemi henüz hazır değil (ilk yönetici hesabı yapılandırılmamış). Site yöneticisine bildirin." }, { status: 503, headers: noStore }); }
  let user;
  try { user = await loginWithUsername({ username, password: body.password }); }
  catch {
    await recordLoginFailure(request, username).catch(() => undefined);
    return NextResponse.json({ error: "Kullanıcı adı veya parola hatalı." }, { status: 401, headers: noStore });
  }
  await clearLoginFailures(username).catch(() => undefined);
  // MFA'yı etkinleştirmiş hesapta (MFA_MODE=off değilse) parola tek başına oturum açmaz: önce kod sorulur, çerez verilmez.
  if (mfaChallengeRequired(user)) {
    const challengeToken = await beginMfaChallenge(user.id);
    await addAudit(user.id, "login_mfa_challenge", "session", null, "Parola doğrulandı; iki aşamalı doğrulama kodu bekleniyor.");
    return NextResponse.json({ mfaRequired: true, challengeToken }, { headers: noStore });
  }
  const token = await createSession(user.id);
  await recordSessionPasswordProof(token, user.id);
  await auditNewLogin(request, user.id, "password");
  const response = NextResponse.json({
    user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role },
    mfaRequired: false,
  }, { headers: noStore });
  response.headers.set("Set-Cookie", sessionCookie(token));
  return response;
}
