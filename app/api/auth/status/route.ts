import { NextResponse } from "next/server";
import { ensureDefaultAdminAccounts } from "@/lib/auth";

export async function GET() {
  try {
    await ensureDefaultAdminAccounts();
    return NextResponse.json({ ready: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Portal hazırlanamadı.";
    return NextResponse.json({ ready: false, error: message }, { status: 503 });
  }
}
