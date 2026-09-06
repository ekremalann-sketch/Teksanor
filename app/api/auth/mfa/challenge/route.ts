import { NextResponse } from "next/server";
import { consumeMfaChallenge } from "@/lib/mfa";
import { createSession, sessionCookie, enforceAuthRateLimit } from "@/lib/auth";
import { rejectCrossSiteMutation } from "@/lib/security";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const body = await request.json() as { challengeToken?: string; code?: string };
  if (!body.challengeToken || !body.code) {
    return NextResponse.json({ error: "Doğrulama kodu gereklidir." }, { status: 400 });
  }
  try { await enforceAuthRateLimit(request, "login"); } catch { return NextResponse.json({error:"Çok fazla deneme."},{status:429}); }
  const userId = await consumeMfaChallenge(body.challengeToken, body.code);
  if (!userId) return NextResponse.json({ error: "Kod geçersiz veya süresi dolmuş." }, { status: 401 });
  const session = await createSession(userId);
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", sessionCookie(session));
  return response;
}
