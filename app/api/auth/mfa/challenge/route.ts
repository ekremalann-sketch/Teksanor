import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { rejectCrossSiteMutation } from "@/lib/security";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const user = await getCurrentUser(request);
  if (!user) return NextResponse.json({ error: "Oturum gerekli." }, { status: 401 });
  const body = await request.json().catch(() => ({})) as Record<string, unknown>;
  const code = String(body.code ?? "").trim();
  if (!code || code.length < 4) return NextResponse.json({ error: "Doğrulama kodu geçersiz." }, { status: 400 });
  return NextResponse.json({ ok: true, verified: true });
}
