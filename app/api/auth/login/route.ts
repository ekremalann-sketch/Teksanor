import { NextResponse } from "next/server";
import { createSession, enforceAuthRateLimit, ensureDefaultAdminAccounts, loginWithUsername, sessionCookie } from "@/lib/auth";
import { beginMfaChallenge } from "@/lib/mfa";
import { rejectCrossSiteMutation } from "@/lib/security";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  try {
    const body = (await request.json()) as { username?: string; password?: string };
    if (!body.username || !body.password) {
      return NextResponse.json({ error: "Kullanıcı adı ve parola gereklidir." }, { status: 400 });
    }
    await enforceAuthRateLimit(request, "login");
    await enforceAuthRateLimit(request, "login", String(body.username));
    await ensureDefaultAdminAccounts();
    const user = await loginWithUsername({ username: body.username, password: body.password });
    if (user.mfa_enabled) {
      return NextResponse.json({
        mfaRequired: true,
        challengeToken: await beginMfaChallenge(user.id),
        message: "Kimlik doğrulama uygulamanızdaki 6 haneli kodu girin.",
      });
    }
    const token = await createSession(user.id);
    const response = NextResponse.json({
      user: { id: user.id, username: user.username, fullName: user.full_name, role: user.role },
      mfaEnrollmentRecommended: user.role === "admin",
    });
    response.headers.set("Set-Cookie", sessionCookie(token));
    return response;
  } catch (error) {
    const message = error instanceof Error ? error.message : "Giriş sırasında bir hata oluştu.";
    return NextResponse.json({ error: message }, { status: message.startsWith("Çok fazla deneme") ? 429 : 401 });
  }
}
