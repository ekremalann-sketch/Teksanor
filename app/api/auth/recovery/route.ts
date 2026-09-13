import { NextResponse } from "next/server";
import { getDb, ensureSchema } from "@/lib/db";
import { rejectCrossSiteMutation } from "@/lib/security";

function text(value: unknown, max = 200) { return String(value ?? "").trim().slice(0, max); }

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  try {
    await ensureSchema();
    const body = await request.json() as Record<string, unknown>;
    const email = text(body.email).toLowerCase();
    // Güvenlik gereği hesabın varlığı açık edilmez.
    if (email) {
      await getDb().prepare("SELECT id FROM users WHERE email = ?").bind(email).first();
    }
    return NextResponse.json({ ok: true, message: "Kayıtlı bir hesap varsa kurtarma talimatları gönderilecektir." });
  } catch {
    return NextResponse.json({ ok: true, message: "Kayıtlı bir hesap varsa kurtarma talimatları gönderilecektir." });
  }
}
