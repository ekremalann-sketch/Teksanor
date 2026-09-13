import { NextResponse } from "next/server";
import { parseCookies, destroySession, clearSessionCookie, SESSION_COOKIE } from "@/lib/auth";
import { rejectCrossSiteMutation } from "@/lib/security";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const cookies = parseCookies(request);
  const sessionId = cookies[SESSION_COOKIE];
  if (sessionId) { try { await destroySession(sessionId); } catch { /* yoksay */ } }
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  return response;
}
