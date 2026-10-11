import { NextResponse } from "next/server";
import { consumeMfaChallenge, consumeRecoveryChallenge, looksLikeRecoveryCode } from "@/lib/mfa";
import { auditNewLogin, createSession, sessionCookie, enforceAuthRateLimit } from "@/lib/auth";
import { addAudit } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  let body: { challengeToken?: string; code?: string };
  try { body = await request.json() as typeof body; } catch { return NextResponse.json({ error: "İstek okunamadı." }, { status: 400 }); }
  if (!body.challengeToken || !body.code) {
    return NextResponse.json({ error: "Doğrulama kodu gereklidir." }, { status: 400 });
  }
  // Ayrı "mfa" kovası: parola denemeleri doğrulama adımını kilitlemez.
  try { await enforceAuthRateLimit(request, "mfa"); } catch { return NextResponse.json({ error: "Çok fazla deneme yapıldı. 15 dakika sonra yeniden deneyin." }, { status: 429 }); }
  const recovery = looksLikeRecoveryCode(body.code);
  let userId: string | null = null;
  let remaining: number | null = null;
  try {
    if (recovery) {
      const result = await consumeRecoveryChallenge(body.challengeToken, body.code);
      if (result) { userId = result.userId; remaining = result.remaining; }
    } else {
      userId = await consumeMfaChallenge(body.challengeToken, body.code);
    }
  } catch { return NextResponse.json({ error: "Doğrulama kodu şu anda sunucuda kontrol edilemiyor. Kurtarma kodlarınızdan biriyle girebilir veya site yöneticisine bildirebilirsiniz." }, { status: 503 }); }
  if (!userId) {
    return NextResponse.json({ error: recovery
      ? "Kurtarma kodu geçersiz veya daha önce kullanılmış. Kodu tireli ya da tiresiz yazabilirsiniz."
      : "Kod geçersiz, daha önce kullanılmış veya giriş denemesinin süresi dolmuş. Telefon saatini otomatik ayarlayıp yeni kodu deneyin; telefonunuz yoksa kurtarma kodu kullanın." }, { status: 401 });
  }
  if (recovery) await addAudit(userId, "mfa_recovery_code_used", "user_security", userId, `Kurtarma kodu ile giriş. Kalan kod: ${remaining ?? 0}.`);
  const session = await createSession(userId);
  await auditNewLogin(request, userId, recovery ? "recovery_code" : "mfa");
  const response = NextResponse.json({ ok: true, ...(recovery ? { recoveryCodesLeft: remaining } : {}) });
  response.headers.set("Set-Cookie", sessionCookie(session));
  return response;
}
