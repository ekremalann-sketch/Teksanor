import { NextResponse } from "next/server";
import { clearSessionCookie, readCookie } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";
import { VIEW_AS_COOKIE } from "@/lib/tenancy";

async function hash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const token = readCookie(request, "teksanor_session");
  if (token) await getDb().prepare("DELETE FROM sessions WHERE token_hash = ?").bind(await hash(token)).run();
  const response = NextResponse.json({ ok: true });
  response.headers.set("Set-Cookie", clearSessionCookie());
  // Firma gözünden görünüm çerezi de çıkışta biter.
  response.headers.append("Set-Cookie", `${VIEW_AS_COOKIE}=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Strict`);
  return response;
}
